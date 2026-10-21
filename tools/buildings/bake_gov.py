"""
政府真實大廈體量 → 港漫風格低面數大廈 → 併入底圖 GLB

    python tools/buildings/bake_gov.py [data/11-NW-19D_gov.json]

讀：
  data/<chunk>_gov.json                        extract_gov.py 抽出嘅體量（HK1980 E/N + 逐級高度）
  atlas/hk_comic_atlas.webp                    共用港漫貼圖（同大廈包同一張）
  packages/client/public/maps/<chunk>.glb      底圖：搵馬路（判斷臨街面）＋寫返入去

寫：
  packages/client/public/maps/<chunk>.glb      加入 B<政府編號> 大廈 node（舊嘅 B node 會先清走，可以重複執行）
  out/<chunk>-gov/plan.png                     平面預覽
  out/<chunk>-gov/report.json                  每棟風格、高度、面數

底圖大廈係 B 字頭 mesh：ChunkLoaderSystem 會自動加碰撞、遮擋淡出；
地圖編輯器用 `chunkId:B<編號>` 做 key，可以逐棟隱藏、移動、替換。
所有大廈共用一個材質、一張貼圖；每棟 ≤1000 三角面，天台平頂唔放任何物件。
"""

import argparse
import hashlib
import json
import math
import os
import sys

import numpy as np
from PIL import Image, ImageDraw
from shapely import STRtree, constrained_delaunay_triangles
from shapely.geometry import Point, Polygon
from shapely.geometry.polygon import orient
from shapely.ops import unary_union

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import build_buildings as bb  # noqa: E402
from build_buildings import (  # noqa: E402
    GROUND_FLOOR_H, MAX_TRIS, PARAPET_H, SKIRT, TRIM_W, CANOPY_Y, CANOPY_DEPTH, SIGN, STYLES,
    Atlas, Frame, MeshData, add_box, add_wall, chance, h32, pick, load_roads, read_glb,
)
from glbio import Glb, compact  # noqa: E402

SPAWN = (835575.4, 819658.9)
ROAD_CLEAR = 0.3        # 底圖馬路同真實位置有少少偏差：大廈伸入馬路嘅部分切走（再留 0.3m）
SPAWN_CLEAR = 2.0       # 出生點周圍最少留空
MIN_EDGE = 0.25         # 短過呢個嘅牆唔整（簡化後殘留嘅碎邊）
GROUP_OVERLAP = 0.5     # 兩筆記錄重疊超過細嗰筆一半 → 同一棟
STACK_DZ = 3.0          # 有重疊而地面高度差 > 3m → 一筆疊喺另一筆上面，同一棟
MAX_GROUP_TIERS = 5
STRAIGHT_DEG = 8.0      # 轉角細過 8° 嘅頂點拉直（幾段差唔多同一直線嘅牆併做一面）
CORNER_DEG = 25.0       # 轉角大過 25° 先畫牆角墨線
PARTY_WINDOWS = 6.0     # 貼住隔籬嘅牆露出超過 6m → 有窗（後巷款），唔係成幅白牆


# ------------------------------------------------------------------ 讀體量

def tier_geom(t):
    polys = [Polygon(p["exterior"], p["holes"]) for p in t["polygons"]]
    return unary_union([p.buffer(0) for p in polys])


def polys_of(g):
    if g.is_empty:
        return []
    if isinstance(g, Polygon):
        return [g]
    return [p for p in getattr(g, "geoms", []) if isinstance(p, Polygon)]


def group_records(records):
    """
    政府數據會將一棟大廈拆做幾筆：塔樓（…01…）企喺平台（…02…）上面，塔樓嘅 ground 係平台頂。
    以下情況當同一棟：編號頭 11 位相同；或者兩筆輪廓重疊超過細嗰筆嘅一半；
    或者有重疊而地面高度差 > 3m（一筆疊喺另一筆上面）。
    """
    geo = [tier_geom(r["tiers"][0]) for r in records]
    parent = list(range(len(records)))

    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    def union(a, b):
        parent[find(a)] = find(b)

    by_prefix = {}
    for i, r in enumerate(records):
        by_prefix.setdefault(r["id"][:11], []).append(i)
    for members in by_prefix.values():
        for i in members[1:]:
            union(members[0], i)
    tree = STRtree(geo)
    for i, g in enumerate(geo):
        for j in tree.query(g):
            if j <= i:
                continue
            inter = g.intersection(geo[j]).area
            if inter <= 0.5:
                continue
            ratio = inter / min(g.area, geo[j].area)
            stacked = abs(records[i]["ground"] - records[j]["ground"]) > STACK_DZ
            if ratio > GROUP_OVERLAP or (ratio > 0.05 and stacked):
                union(i, j)
    groups = {}
    for i in range(len(records)):
        groups.setdefault(find(i), []).append(records[i])
    return list(groups.values())


def merge_group(members):
    """幾筆記錄 → 一棟：用絕對高度（mPD）重新分級，地面 = 最低嗰筆"""
    ground = min(m["ground"] for m in members)
    pieces = [(tier_geom(t), m["ground"] + t["height"]) for m in members for t in m["tiers"]]
    levels = sorted({round(h, 2) for _, h in pieces})
    clusters = []  # [門檻, 高度]：相差 1m 內嘅級併埋，用最高嗰個高度
    for L in levels:
        if clusters and L - clusters[-1][1] < 1.0:
            clusters[-1][1] = L
        else:
            clusters.append([L, L])
    tiers = []
    for thr, top in clusters:
        g = unary_union([g for g, h in pieces if h >= thr - 1e-6])
        if top - ground >= 2.5 and not g.is_empty:
            tiers.append((g, top - ground))
    while len(tiers) > MAX_GROUP_TIERS:
        k = min(range(1, len(tiers)), key=lambda i: tiers[i][0].area * (tiers[i][1] - tiers[i - 1][1]))
        del tiers[k]
    rep = max(members, key=lambda m: m["ground"] + m["tiers"][-1]["height"])
    return {"id": rep["id"], "members": [m["id"] for m in members], "ground": ground, "tiers": tiers}


def prepare(doc, roads):
    """併埋拆開嘅記錄、切走伸入馬路同出生點嘅部分；回傳 [{id, members, ground, tiers:[(geom, H)]}]"""
    block = unary_union([roads.buffer(ROAD_CLEAR), Point(SPAWN).buffer(SPAWN_CLEAR)])
    out, notes = [], []
    for members in group_records(doc["buildings"]):
        b = merge_group(members)
        tiers = []
        prev = None
        for g, H in b["tiers"]:
            cut = g.intersection(block).area
            g = g.difference(block)
            if prev is not None:
                g = g.intersection(prev)
            g = unary_union([p for p in polys_of(g.buffer(-0.3, join_style="mitre").buffer(0.3, join_style="mitre"))
                             if p.area >= 4.0])
            if g.is_empty:
                break
            if cut > 2.0 and not tiers:
                notes.append((cut, b["id"]))
            tiers.append((g, float(H)))
            prev = g
        if tiers:
            out.append({**b, "tiers": tiers})
    return out, notes


# ------------------------------------------------------------------ 風格

def choose_style(tiers):
    H = tiers[-1][1]
    A0 = tiers[0][0].area
    At = tiers[-1][0].area
    if H < 10:
        return "low"
    if A0 > 1500 and H < 30:
        return "commercial"
    if len(tiers) >= 2 and At < 0.6 * A0 and H > 40:
        return "podium_tower"
    if H >= 45:
        return "tower"
    if H <= 25 and A0 < 250:
        return "tong_lau"
    return "composite"


def floor_grid(H, style, merge=1):
    """[(y0, y1, 樓層序)]，地舖 4.5m、之後每層平均分，最高一層頂 = 天台女兒牆底。
    merge > 1：每幾層併做一條（貼圖拉高），超大型大廈先用"""
    fh0 = STYLES[style]["floor_h"] * merge
    top = H - PARAPET_H
    if top <= GROUND_FLOOR_H + 0.5:
        return [(0.0, max(top, 1.0), 0)]
    n = max(1, round((top - GROUND_FLOOR_H) / fh0))
    fh = (top - GROUND_FLOOR_H) / n
    return [(0.0, GROUND_FLOOR_H, 0)] + [
        (GROUND_FLOOR_H + i * fh, GROUND_FLOOR_H + (i + 1) * fh, i + 1) for i in range(n)]


# ------------------------------------------------------------------ 鄰居

class Neighbours:
    """所有大廈每一級，用嚟搵某點上面隔籬大廈有幾高"""

    def __init__(self, buildings):
        self.geoms, self.meta = [], []
        for b in buildings:
            for g, H in b["tiers"]:
                for p in polys_of(g):
                    self.geoms.append(p)
                    self.meta.append((b["id"], H))
        self.tree = STRtree(self.geoms)

    def height_at(self, pt, exclude):
        best = None
        for i in self.tree.query(pt):
            bid, H = self.meta[i]
            if bid != exclude and self.geoms[i].contains(pt):
                best = H if best is None else max(best, H)
        return best


def classify(A, B, n, bid, neigh, roads):
    """回傳 (kind, 鄰居高度)。kind = party（貼住隔籬）/ street（臨街或空地）/ lane（後巷）"""
    hs = []
    for f in (0.2, 0.5, 0.8):
        p = A + (B - A) * f + n * 0.6
        hs.append(neigh.height_at(Point(p), bid))
    inside = [h for h in hs if h is not None]
    if len(inside) >= 2:
        return "party", min(inside)
    mid = (A + B) / 2
    for dist in np.arange(1.0, 12.5, 1.0):
        p = Point(mid + n * dist)
        if roads.contains(p):
            return "street", 0.0
        if neigh.height_at(p, bid) is not None:
            return "lane", 0.0
    return "street", 0.0


# ------------------------------------------------------------------ 每棟

def turn_deg(a, b, c):
    """a→b→c 喺 b 轉幾多度（0 = 直行）"""
    u, v = np.subtract(b, a), np.subtract(c, b)
    cross = u[0] * v[1] - u[1] * v[0]
    return abs(math.degrees(math.atan2(cross, float(np.dot(u, v)))))


def straighten(coords):
    """閉合環 → 拉直差唔多直線嘅頂點；回傳 [(x, y, 係咪真轉角)]（唔重複第一點）"""
    pts = [tuple(c) for c in coords[:-1]]
    changed = True
    while changed and len(pts) > 3:
        changed = False
        for i in range(len(pts)):
            if turn_deg(pts[i - 1], pts[i], pts[(i + 1) % len(pts)]) < STRAIGHT_DEG:
                del pts[i]
                changed = True
                break
    return [(x, y, turn_deg(pts[i - 1], (x, y), pts[(i + 1) % len(pts)]) >= CORNER_DEG)
            for i, (x, y) in enumerate(pts)]


def roof_tris(mesh, atlas, geom, y, region, origin):
    """平頂（constrained Delaunay），UV 將外框拉入天台貼圖"""
    minx, miny, maxx, maxy = geom.bounds
    w, h = max(maxx - minx, 1e-3), max(maxy - miny, 1e-3)
    uv = atlas.uv_rect(region)  # 左下、右下、右上、左上
    (u0, v0), (u1, _), (_, v1) = uv[0], uv[1], uv[2]
    for tri in polys_of(constrained_delaunay_triangles(geom)):
        tri = orient(tri, 1.0)
        pts = list(tri.exterior.coords)[:3]
        b = len(mesh.pos)
        for (x, yy) in pts:
            mesh.pos.append((x - origin[0], y, -(yy - origin[1])))
            mesh.nrm.append((0.0, 1.0, 0.0))
            mesh.uv.append((u0 + (u1 - u0) * (x - minx) / w, v0 + (v1 - v0) * (yy - miny) / h))
        mesh.idx += [b, b + 1, b + 2]


# 超過 1000 面時逐級減細節：(牆角墨線, 輪廓簡化 m, 幾層併一條)
LODS = [(True, 0.0, 1), (False, 0.0, 1), (False, 1.0, 1), (False, 1.0, 2),
        (False, 2.0, 2), (False, 2.0, 3), (False, 3.0, 4)]


def build(bld, ctx, lod=0):
    """lod 越大越簡化（見 LODS）；併層 = 貼圖拉高，十字形／圓角高樓先會用到"""
    atlas, neigh, roads = ctx["atlas"], ctx["neigh"], ctx["roads"]
    bid = bld["id"]
    tiers = bld["tiers"]
    with_trims, tol, merge = LODS[lod]
    if tol:
        tiers = [(g.simplify(tol, preserve_topology=True), H) for g, H in tiers]
    style = choose_style(tiers)
    st = STYLES[style]
    upper = pick(st["upper"], bid, "upper")
    tower_upper = pick(st["tower"], bid, "tower") if "tower" in st else upper
    signage_1f = chance(st["signage_1f"], bid, "1f")
    grid = floor_grid(tiers[-1][1], style, merge=merge)
    c = tiers[0][0].centroid
    origin = (c.x, c.y)
    mesh = MeshData()
    sign_count = 0

    def local(p):
        return np.array([p[0] - origin[0], p[1] - origin[1]])

    for k, (geom, H) in enumerate(tiers):
        y_base = tiers[k - 1][1] if k else -SKIRT
        region_upper = tower_upper if (k >= 1 and style == "podium_tower") else upper
        rings = []
        for p in polys_of(geom):
            p = orient(p, 1.0)
            rings.append(straighten(p.exterior.coords))
            rings += [straighten(r.coords) for r in p.interiors]
        for ri, ring in enumerate(rings):
            for ei in range(len(ring)):
                a, b2 = ring[ei], ring[(ei + 1) % len(ring)]
                Aw, Bw = np.array(a[:2], float), np.array(b2[:2], float)
                L = float(np.linalg.norm(Bw - Aw))
                if L < MIN_EDGE:
                    continue
                d = (Bw - Aw) / L
                n = np.array([d[1], -d[0]])  # 逆時針外圈 / 順時針天井 → 都係向外
                kind, nh = classify(Aw, Bw, n, bid, neigh, roads)
                start = y_base
                if kind == "party":
                    if nh >= H - 0.05:
                        continue
                    start = max(start, nh)
                    if H - start > PARTY_WINDOWS:
                        kind = "lane"  # 高過隔籬好多：露出嘅牆有窗
                A, B = local(Aw), local(Bw)
                phase = (h32(bid, k, ri, ei) % 2400) / 100.0

                # bands：(y0, y1, 貼圖區域, 貼圖由幾高開始, 到幾高)；樓層俾女兒牆截短時貼圖都截返
                if kind == "party":
                    bands = [(start, H, "BLANK", 0.0, 1.0)]
                else:
                    ground = pick(st["ground"], bid, k, ri, ei, "g") if kind == "street" else (st["back"] or region_upper)
                    bands = [(-SKIRT, 0.0, "INK", 0.0, 1.0)] if k == 0 else []
                    for (g0, g1, idx) in grid:
                        y1 = min(g1, H - PARAPET_H)
                        if y1 <= g0:
                            break
                        if idx == 0:
                            reg = ground
                        elif kind == "lane" and st["back"]:
                            reg = st["back"]
                        elif idx == 1 and signage_1f and kind == "street":
                            reg = "SIGN_1F"
                        else:
                            reg = region_upper
                        bands.append((g0, y1, reg, 0.0, (y1 - g0) / (g1 - g0)))
                    bands.append((H - PARAPET_H, H, st["parapet"], 0.0, 1.0))

                trim = TRIM_W if (with_trims and L > 2 * TRIM_W + 0.2) else 0.0
                trims = [(0.0, trim)] if (trim and a[2]) else []
                trims += [(L - trim, L)] if (trim and b2[2]) else []
                t_lo = trim if (trim and a[2]) else 0.0
                t_hi = L - trim if (trim and b2[2]) else L
                for (y0, y1, reg, fv0, fv1) in bands:
                    if y1 <= start + 1e-3:
                        continue
                    if y0 < start:
                        fv0 += (fv1 - fv0) * (start - y0) / (y1 - y0)
                        y0 = start
                    ph = 0.0 if reg == "INK" else phase
                    add_wall(mesh, atlas, A, B, n, y0, y1, reg, ph, fv=(fv0, fv1), t_range=(t_lo, t_hi))
                for (ta, tb) in trims:
                    add_wall(mesh, atlas, A, B, n, start, H, "INK", 0.0, t_range=(ta, tb))

                # 簷篷 + 直招牌：只限地面一級、臨街、睇得到地面
                if k == 0 and kind == "street" and start <= 0.0 and L >= 3.0 and H >= 6.0:
                    cc = (A + B) / 2 + n * (CANOPY_DEPTH / 2)
                    add_box(mesh, atlas, cc, d, n, (L / 2 - 0.3, CANOPY_DEPTH / 2), CANOPY_Y[0], CANOPY_Y[1],
                            {"+n": ("CANOPY", False), "top": ("ROOF_concrete", False),
                             "bottom": ("CANOPY", False), "+u": ("INK", False), "-u": ("INK", False)})
                    if st["signs"] and len(grid) >= 3 and L >= 5.0:
                        count = min(3, int(L // 6) or 1)
                        for s in range(count):
                            if sign_count >= 6:
                                break
                            t = (s + 0.5) * L / count + ((h32(bid, ri, ei, s, "t") % 200) / 100.0 - 1.0)
                            t = min(max(t, 1.0), L - 1.0)
                            level = h32(bid, ri, ei, s, "y") % 2 if len(grid) >= 4 else 0
                            y0 = 4.6 + level * 2.8
                            y1 = y0 + SIGN["h"]
                            if y1 > H - PARAPET_H:
                                continue
                            sc = A + d * t + n * (SIGN["gap"] + SIGN["out"] / 2)
                            region = f"SIGN_{h32(bid, ri, ei, s, 's') % 16:02d}"
                            add_box(mesh, atlas, sc, d, n, (SIGN["t"] / 2, SIGN["out"] / 2), y0, y1,
                                    {"+u": (region, False), "-u": (region, False),
                                     "+n": ("INK", False), "top": ("INK", False), "bottom": ("INK", False)})
                            sign_count += 1

        # 天台：呢一級減去上一級蓋住嘅部分
        roof = geom.difference(tiers[k + 1][0]) if k + 1 < len(tiers) else geom
        for p in polys_of(roof):
            if p.area > 0.5:
                roof_tris(mesh, atlas, p, H, st["roof"], origin)

    return mesh, origin, style, upper


def build_within_budget(bld, ctx):
    for lod in range(len(LODS)):
        mesh, origin, style, upper = build(bld, ctx, lod)
        if mesh.tris <= MAX_TRIS:
            return mesh, origin, style, upper, lod
    raise SystemExit(f"{bld['id']}: 簡化到盡都仲有 {mesh.tris} 三角面")


# ------------------------------------------------------------------ 寫入底圖 GLB

def bake(map_path, buildings, image_bytes, image_name):
    """清走舊嘅 B node，再加入新大廈（其他 node，例如地形，原封不動）"""
    j, bin_ = read_glb(map_path)
    g = Glb(*compact(j, bin_, keep_node=lambda n: not n.get("name", "").upper().startswith("B")))
    mat = g.material("hk_comic_atlas", texture=g.texture(image_bytes, image_name, wrap=33071))
    for name, mesh, (E, N) in buildings:
        prim = g.primitive(mesh.pos, mesh.nrm, mesh.uv, mesh.idx, mat)
        g.node(name, [prim], translation=(round(E, 3), 0.0, round(-N, 3)))
    g.save(map_path)


# ------------------------------------------------------------------ 平面預覽

def draw_plan(path, buildings, roads, center, radius):
    E0, N0 = center
    half = radius + 30
    ppm = 3
    W = int(2 * half * ppm)
    img = Image.new("RGB", (W, W), (245, 242, 235))
    d = ImageDraw.Draw(img, "RGBA")

    def P(x, y):
        return ((x - E0 + half) * ppm, (half - (y - N0)) * ppm)

    def poly(g, **kw):
        for p in polys_of(g):
            d.polygon([P(*c) for c in p.exterior.coords], **kw)
            for h in p.interiors:
                d.polygon([P(*c) for c in h.coords], fill=(245, 242, 235))
    view = Point(center).buffer(half, cap_style="square")
    poly(roads.intersection(view), fill=(130, 130, 130))
    Hmax = max(t[-1][1] for b in buildings for t in [b["tiers"]])
    for b in buildings:
        for g, H in b["tiers"]:
            v = int(235 - 190 * min(H / Hmax, 1.0))
            poly(g, fill=(v, v, 255, 255), outline=(20, 30, 90))
    r = 4 * ppm
    cx, cy = P(E0, N0)
    d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=(255, 0, 200), width=3)
    img.save(path)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("data", nargs="?", default=os.path.join(HERE, "data", "11-NW-19D_gov.json"))
    ap.add_argument("--map", default=None, help="底圖 GLB（預設 packages/client/public/maps/<chunk>.glb）")
    a = ap.parse_args()
    doc = json.load(open(a.data, encoding="utf-8"))
    chunk = doc["chunkId"]
    map_path = a.map or os.path.join(bb.REPO, "packages", "client", "public", "maps", f"{chunk}.glb")

    layout = json.load(open(os.path.join(HERE, "atlas", "atlas_layout.json"), encoding="utf-8"))
    atlas = Atlas(layout)
    image_bytes = open(os.path.join(HERE, "atlas", "hk_comic_atlas.webp"), "rb").read()
    image_name = "shared:hk_comic_atlas:" + hashlib.sha1(image_bytes).hexdigest()[:10]
    roads = load_roads(map_path, Frame(dict(originE=0, originN=0, angleDeg=0)))

    buildings, notes = prepare(doc, roads)
    ctx = {"atlas": atlas, "roads": roads, "neigh": Neighbours(buildings)}

    out_dir = os.path.join(HERE, "out", f"{chunk}-gov")
    os.makedirs(out_dir, exist_ok=True)
    baked, report, worst = [], [], 0
    lods = [0] * len(LODS)
    for b in buildings:
        mesh, origin, style, upper, lod = build_within_budget(b, ctx)
        worst = max(worst, mesh.tris)
        lods[lod] += 1
        baked.append((b["id"], mesh, origin))
        report.append({"id": b["id"], "members": b["members"], "style": style, "facade": upper,
                       "height": round(b["tiers"][-1][1], 1), "tiers": len(b["tiers"]),
                       "tris": mesh.tris, "lod": lod})
    bake(map_path, baked, image_bytes, image_name)
    draw_plan(os.path.join(out_dir, "plan.png"), buildings, roads, doc["center"], doc["radius"])
    with open(os.path.join(out_dir, "report.json"), "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=1)

    tris = [r["tris"] for r in report]
    styles = {}
    for r in report:
        styles[r["style"]] = styles.get(r["style"], 0) + 1
    merged = sum(1 for r in report if len(r["members"]) > 1)
    print(f"{len(baked)} 棟（{len(doc['buildings'])} 筆政府記錄，{merged} 棟由幾筆合併）→ "
          f"{os.path.relpath(map_path, bb.REPO)}（{os.path.getsize(map_path) / 1024 / 1024:.1f} MB）")
    print(f"三角面：最多 {worst}、平均 {sum(tris) / len(tris):.0f}、合共 {sum(tris)}；"
          f"要減細節：冇墨線 {lods[1]}、簡化輪廓 {lods[2]}、併層 {sum(lods[3:])} 棟")
    print("風格：" + "、".join(f"{k} {v}" for k, v in sorted(styles.items())))
    if notes:
        notes.sort(reverse=True)
        print(f"{len(notes)} 棟伸入底圖馬路／出生點，切走咗；最多：" +
              "、".join(f"{bid} {cut:.0f}m²" for cut, bid in notes[:5]))


if __name__ == "__main__":
    main()
