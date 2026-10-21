"""
按實際地圖產生低面數港漫風格大廈（資產庫 + 覆蓋層用）

    python tools/buildings/build_buildings.py data/11-NW-19D_pilot.json

讀：
  data/<pack>.json            大廈輪廓（本地街道座標 u/v）、層數、風格
  atlas/hk_comic_atlas.webp   共用貼圖（make_atlas.py 產生）
  packages/client/public/maps/<chunk>.glb  底圖：用嚟搵馬路（留行人路、判斷臨街面）

寫：out/<packId>/
  <id>.glb        每棟一個 GLB（≤1000 三角面、Y-up、1 單位 = 1 米、原點喺底部中心）
  manifest.json   後台「匯入大廈包」用：資產資料 + 擺放 transform（chunk __root__ 本地座標）
  plan.png        平面預覽（馬路 + 大廈輪廓 + 編號），方便核對位置

GLB 結構：
  <id>         外觀 mesh（牆、天台、簷篷、招牌），一個材質，貼圖名 `shared:hk_comic_atlas:<hash>`
               → 客戶端／編輯器見到同名貼圖會共用同一份 GPU 貼圖
  COL_<id>_<n> 隱形碰撞方塊（每個落地部分一個）→ 客戶端用佢做碰撞，唔會渲染；
               招牌、簷篷凸出行人路都唔會擋住玩家
"""

import hashlib
import json
import math
import os
import struct
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont
from shapely.geometry import Point, Polygon, box
from shapely.ops import unary_union

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", ".."))

MAX_TRIS = 1000
GROUND_FLOOR_H = 4.5
PARAPET_H = 1.0
SKIRT = 0.5          # 牆身向地下延伸，避免同地面之間有罅
TRIM_W = 0.15        # 牆角墨線闊度（港漫描邊）
CANOPY_Y = (3.9, 4.15)
CANOPY_DEPTH = 1.0
SIGN = dict(gap=0.25, out=1.6, h=2.4, t=0.16)

STYLES = {
    "tong_lau": dict(upper=["TL_cream", "TL_green", "TL_yellow", "TL_pink"],
                     ground=["SHOP_old", "SHOP_cafe", "SHOP_pawn", "SHOP_night"],
                     floor_h=3.2, signage_1f=0.5, signs=True, back="BACK", parapet="PARAPET_plain",
                     roof="ROOF_concrete"),
    "composite": dict(upper=["COMP_blue", "COMP_grey"],
                      ground=["SHOP_old", "SHOP_pawn", "SHOP_cafe", "SHOP_night"],
                      floor_h=3.0, signage_1f=0.6, signs=True, back="BACK", parapet="PARAPET_plain",
                      roof="ROOF_concrete"),
    "tower": dict(upper=["TOWER_beige", "TOWER_pink", "TOWER_teal"],
                  ground=["SHOP_lobby", "SHOP_cafe", "SHOP_pawn"],
                  floor_h=3.0, signage_1f=0.3, signs=True, back=None, parapet="PARAPET_tiled",
                  roof="ROOF_green"),
    "commercial": dict(upper=["COMM_glass", "COMM_stone"],
                       ground=["SHOP_mall", "SHOP_night"],
                       floor_h=3.6, signage_1f=0.0, signs=False, back=None, parapet="PARAPET_plain",
                       roof="ROOF_concrete"),
    "podium_tower": dict(upper=["COMM_stone"], tower=["TOWER_beige", "TOWER_teal", "TOWER_pink"],
                         ground=["SHOP_mall", "SHOP_lobby"],
                         floor_h=3.0, signage_1f=0.0, signs=False, back=None, parapet="PARAPET_tiled",
                         roof="ROOF_concrete"),
    "low": dict(upper=["TL_cream", "TL_yellow", "BACK"],
                ground=["SHOP_old", "SHOP_cafe", "SHOP_pawn"],
                floor_h=3.0, signage_1f=0.5, signs=True, back="BACK", parapet="PARAPET_plain",
                roof="ROOF_concrete"),
}


def h32(*parts):
    """穩定嘅偽隨機（同一份資料每次產生一模一樣）"""
    s = "|".join(str(p) for p in parts).encode("utf-8")
    return int(hashlib.md5(s).hexdigest()[:8], 16)


def pick(lst, *key):
    return lst[h32(*key) % len(lst)]


def chance(p, *key):
    return (h32(*key) % 10000) / 10000.0 < p


# ------------------------------------------------------------------ 座標

class Frame:
    def __init__(self, f):
        self.E0, self.N0 = f["originE"], f["originN"]
        a = math.radians(f["angleDeg"])
        self.angle = a
        self.c, self.s = math.cos(a), math.sin(a)

    def uv_to_EN(self, u, v):
        return self.E0 + u * self.c - v * self.s, self.N0 + u * self.s + v * self.c

    def EN_to_uv(self, E, N):
        dE, dN = E - self.E0, N - self.N0
        return dE * self.c + dN * self.s, -dE * self.s + dN * self.c


# ------------------------------------------------------------------ 讀底圖馬路

def read_glb(path):
    b = open(path, "rb").read()
    jl, = struct.unpack("<I", b[12:16])
    j = json.loads(b[20:20 + jl])
    off = 20 + jl
    bl, = struct.unpack("<I", b[off:off + 4])
    return j, b[off + 8:off + 8 + bl]


CT = {5121: np.uint8, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}
NC = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}


def accessor(j, bin_, i):
    a = j["accessors"][i]
    bv = j["bufferViews"][a["bufferView"]]
    dt, n = CT[a["componentType"]], NC[a["type"]]
    start = bv.get("byteOffset", 0) + a.get("byteOffset", 0)
    item = np.dtype(dt).itemsize * n
    stride = bv.get("byteStride") or item
    raw = np.frombuffer(bin_, dtype=np.uint8, count=stride * (a["count"] - 1) + item, offset=start)
    rows = np.lib.stride_tricks.as_strided(raw, shape=(a["count"], item), strides=(stride, 1))
    return rows.copy().view(dt).reshape(a["count"], n)


def quat_mat(q):
    x, y, z, w = q
    return np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
                     [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
                     [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])


# 底圖馬路材質：原本 Blender 匯出係 road；tools/ground/restyle_ground.py 改完係 ground_asphalt
ROAD_MATERIALS = {"road", "ground_asphalt"}


def load_roads(terrain_path, frame):
    """底圖入面馬路材質嘅三角形 → 本地 u/v 平面上嘅馬路多邊形"""
    j, bin_ = read_glb(terrain_path)
    polys = []
    for node in j["nodes"]:
        if "mesh" not in node:
            continue
        R = quat_mat(node.get("rotation", [0, 0, 0, 1]))
        S = np.array(node.get("scale", [1, 1, 1]))
        T = np.array(node.get("translation", [0, 0, 0]))
        for prim in j["meshes"][node["mesh"]]["primitives"]:
            mat = j["materials"][prim["material"]]["name"] if "material" in prim else ""
            if mat not in ROAD_MATERIALS:
                continue
            P = accessor(j, bin_, prim["attributes"]["POSITION"]).astype(np.float64)
            W = (R @ (P * S).T).T + T
            u, v = frame.EN_to_uv(W[:, 0], -W[:, 2])
            idx = accessor(j, bin_, prim["indices"]).reshape(-1, 3)
            for t in idx:
                p = Polygon(np.c_[u[t], v[t]])
                if p.area > 1e-6:
                    polys.append(p)
    return unary_union(polys).buffer(0.01)


# ------------------------------------------------------------------ 輪廓處理

def shrink_rect_away(rect, obstacle, label, warnings):
    """將長方形逐邊向內縮，直到唔再同障礙物重疊（保持長方形，碰撞方塊先貼合）"""
    u0, u1, v0, v1 = rect
    for _ in range(400):
        r = box(u0, v0, u1, v1)
        inter = r.intersection(obstacle)
        if inter.area < 0.01:
            break
        cx, cy = inter.centroid.x, inter.centroid.y
        du = [cx - u0, u1 - cx]
        dv = [cy - v0, v1 - cy]
        side = int(np.argmin(du + dv))
        step = 0.1
        if side == 0:
            u0 += step
        elif side == 1:
            u1 -= step
        elif side == 2:
            v0 += step
        else:
            v1 -= step
        if u1 - u0 < 2 or v1 - v0 < 2:
            warnings.append(f"{label}: 縮到太細，略過")
            return None
    if (u0, u1, v0, v1) != tuple(rect):
        warnings.append(f"{label}: 為留行人路由 {rect} 縮到 [{u0:.1f}, {u1:.1f}, {v0:.1f}, {v1:.1f}]")
    return [u0, u1, v0, v1]


# ------------------------------------------------------------------ 幾何

class MeshData:
    def __init__(self):
        self.pos, self.nrm, self.uv, self.idx = [], [], [], []

    @property
    def tris(self):
        return len(self.idx) // 3

    def quad(self, corners, normal, uvs):
        """corners = 正面睇：左下、右下、右上、左上（逆時針 = glTF 正面）"""
        b = len(self.pos)
        self.pos += [tuple(c) for c in corners]
        self.nrm += [tuple(normal)] * 4
        self.uv += uvs
        self.idx += [b, b + 1, b + 2, b, b + 2, b + 3]

    def tri_fan(self, pts, normal, uvs):
        b = len(self.pos)
        self.pos += [tuple(p) for p in pts]
        self.nrm += [tuple(normal)] * len(pts)
        self.uv += uvs
        for i in range(1, len(pts) - 1):
            self.idx += [b, b + i, b + i + 1]


class Atlas:
    def __init__(self, layout):
        self.size = layout["size"]
        self.r = layout["regions"]

    def uv_rect(self, name, fu0=0.0, fu1=1.0, fv0=0.0, fv1=1.0):
        """區域內嘅一部分 → glTF UV（fv = 0 喺區域底，1 喺頂）。四邊內縮半像素防滲色"""
        g = self.r[name]
        S = float(self.size)
        x0 = g["x"] + 0.5 + (g["w"] - 1.0) * fu0
        x1 = g["x"] + 0.5 + (g["w"] - 1.0) * fu1
        yb = g["y"] + g["h"] - 0.5 - (g["h"] - 1.0) * fv0
        yt = g["y"] + g["h"] - 0.5 - (g["h"] - 1.0) * fv1
        # 左下、右下、右上、左上
        return [(x0 / S, yb / S), (x1 / S, yb / S), (x1 / S, yt / S), (x0 / S, yt / S)]

    def meters_w(self, name):
        return self.r[name]["metersW"]


def to3(u, v, y):
    """本地 u/v → 資產座標（x = u，z = -v，Y 向上）"""
    return (u, y, -v)


def add_wall(mesh, atlas, A, B, n_uv, y0, y1, region, phase, fv=(0.0, 1.0), t_range=None):
    """A→B 一段牆（u/v），按貼圖重複闊度切段，每段一個 quad"""
    A = np.array(A, float)
    B = np.array(B, float)
    L = float(np.linalg.norm(B - A))
    d = (B - A) / L
    t0, t1 = t_range if t_range else (0.0, L)
    if t1 - t0 < 1e-3 or y1 - y0 < 1e-3:
        return
    R = atlas.meters_w(region)
    normal = (n_uv[0], 0.0, -n_uv[1])
    cuts = [t0]
    k = math.floor((t0 + phase) / R) + 1
    while k * R - phase < t1 - 1e-3:
        cuts.append(k * R - phase)
        k += 1
    cuts.append(t1)
    for a, b in zip(cuts[:-1], cuts[1:]):
        fu0 = ((a + phase) % R) / R
        fu1 = fu0 + (b - a) / R
        if fu1 > 1.0 + 1e-6:
            fu1 = 1.0
        pa, pb = A + d * a, A + d * b
        corners = [to3(pa[0], pa[1], y0), to3(pb[0], pb[1], y0), to3(pb[0], pb[1], y1), to3(pa[0], pa[1], y1)]
        mesh.quad(corners, normal, atlas.uv_rect(region, fu0, fu1, fv[0], fv[1]))


def add_box(mesh, atlas, center_uv, axis_u, axis_n, half, y0, y1, faces):
    """
    以 u/v 平面上兩條正交軸定義嘅方塊。
    axis_u：沿牆方向；axis_n：牆嘅外法線。half = (沿牆半長, 法線方向半長)
    faces：dict 面名 → (region, mirror)；面名 = +n -n +u -u top bottom
    """
    c = np.array(center_uv, float)
    au = np.array(axis_u, float)
    an = np.array(axis_n, float)
    hu, hn = half

    def P(su, sn, y):
        p = c + au * su * hu + an * sn * hn
        return to3(p[0], p[1], y)

    def N(vec):
        return (vec[0], 0.0, -vec[1])

    defs = {
        # 正面睇：左下、右下、右上、左上
        "+n": ([P(-1, 1, y0), P(1, 1, y0), P(1, 1, y1), P(-1, 1, y1)], N(an)),
        "-n": ([P(1, -1, y0), P(-1, -1, y0), P(-1, -1, y1), P(1, -1, y1)], N(-an)),
        "+u": ([P(1, 1, y0), P(1, -1, y0), P(1, -1, y1), P(1, 1, y1)], N(au)),
        "-u": ([P(-1, -1, y0), P(-1, 1, y0), P(-1, 1, y1), P(-1, -1, y1)], N(-au)),
        "top": ([P(-1, 1, y1), P(1, 1, y1), P(1, -1, y1), P(-1, -1, y1)], (0.0, 1.0, 0.0)),
        "bottom": ([P(-1, -1, y0), P(1, -1, y0), P(1, 1, y0), P(-1, 1, y0)], (0.0, -1.0, 0.0)),
    }
    for name, (region, mirror) in faces.items():
        corners, normal = defs[name]
        uvs = atlas.uv_rect(region)
        if mirror:
            uvs = [uvs[1], uvs[0], uvs[3], uvs[2]]
        mesh.quad(corners, normal, uvs)


def rect_corners(r):
    u0, u1, v0, v1 = r
    return [(u0, v0), (u1, v0), (u1, v1), (u0, v1)]  # 逆時針（由上望落）


def part_heights(part, style):
    """回傳 (base, 各層 [(y0, y1, 樓層序)], 女兒牆頂)"""
    st = STYLES[style]
    base = float(part.get("base", 0.0))
    if "height" in part:
        top = float(part["height"]) - PARAPET_H
        if base <= 0:
            n_up = max(0, round((top - GROUND_FLOOR_H) / st["floor_h"]))
            fh = (top - GROUND_FLOOR_H) / n_up if n_up else 0
            floors = [(0.0, GROUND_FLOOR_H, 0)] + [
                (GROUND_FLOOR_H + i * fh, GROUND_FLOOR_H + (i + 1) * fh, i + 1) for i in range(n_up)]
        else:
            n = max(1, round((top - base) / 3.0))
            fh = (top - base) / n
            floors = [(base + i * fh, base + (i + 1) * fh, 100 + i) for i in range(n)]
    else:
        nf = int(part["floors"])
        fh = st["floor_h"]
        floors = [(0.0, GROUND_FLOOR_H, 0)] + [
            (GROUND_FLOOR_H + i * fh, GROUND_FLOOR_H + (i + 1) * fh, i + 1) for i in range(nf - 1)]
        top = floors[-1][1]
    return base, floors, top + PARAPET_H


# ------------------------------------------------------------------ 每棟大廈

def build_building(bld, ctx):
    style = bld["style"]
    st = STYLES[style]
    atlas = ctx["atlas"]
    bid = bld["id"]
    mesh = MeshData()
    colliders = []
    parts = bld["_parts"]

    upper = bld.get("upper") or pick(st["upper"], bid, "upper")
    tower_upper = bld.get("towerUpper") or (pick(st["tower"], bid, "tower") if "tower" in st else upper)
    signage_1f = chance(st["signage_1f"], bid, "1f")

    # 中心（原點）＝所有部分外框中心
    allr = np.array([p["rect"] for p in parts])
    uc = (allr[:, 0].min() + allr[:, 1].max()) / 2
    vc = (allr[:, 2].min() + allr[:, 3].max()) / 2

    others = ctx["footprints_other"][bid]
    roads = ctx["roads"]
    sign_count = 0

    for pi, part in enumerate(parts):
        r = part["rect"]
        lr = [r[0] - uc, r[1] - uc, r[2] - vc, r[3] - vc]
        base, floors, top = part_heights(part, style)
        corners_world = rect_corners(r)
        corners = rect_corners(lr)
        is_ground = base <= 0
        region_upper = tower_upper if not is_ground else upper

        for ei in range(4):
            A, B = np.array(corners[ei]), np.array(corners[(ei + 1) % 4])
            Aw, Bw = np.array(corners_world[ei]), np.array(corners_world[(ei + 1) % 4])
            L = float(np.linalg.norm(B - A))
            d = (B - A) / L
            n = np.array([d[1], -d[0]])  # 逆時針多邊形嘅外法線
            mid_w = (Aw + Bw) / 2

            # 同一棟其他部分遮住呢面牆？
            start_y = -SKIRT if is_ground else base
            hidden = False
            for pj, other in enumerate(parts):
                if pj == pi:
                    continue
                if box(other["rect"][0], other["rect"][2], other["rect"][1], other["rect"][3]).contains(
                        Point(mid_w + n * 0.3)):
                    _, _, otop = part_heights(other, style)
                    if otop >= top - 1e-3:
                        hidden = True
                    else:
                        start_y = max(start_y, otop)
            if hidden:
                continue

            # 牆面類型：party（貼住鄰居）／street（臨街或空地）／lane（後巷）
            probes = [Aw + (Bw - Aw) * f + n * 0.8 for f in (0.25, 0.5, 0.75)]
            if sum(1 for p in probes if others.contains(Point(p))) >= 2:
                kind = "party"
            else:
                kind = "lane"
                for dist in np.arange(1.0, 12.5, 1.0):
                    p = Point(mid_w + n * dist)
                    if roads.contains(p):
                        kind = "street"
                        break
                    if others.contains(p):
                        break
                else:
                    kind = "street"  # 一路冇撞到其他大廈 → 空地 / 廣場，當臨街
            phase = (h32(bid, pi, ei) % 2400) / 100.0
            if os.environ.get("DEBUG_EDGES"):
                side = {(0, -1): "S", (1, 0): "E", (0, 1): "N", (-1, 0): "W"}[(round(n[0]), round(n[1]))]
                print(f"   {bid}#{pi} {side} L={L:5.1f} {kind}")

            ground_region = {
                "street": pick(st["ground"], bid, pi, ei, "g"),
                "lane": st["back"] or region_upper,
                "party": "BLANK",
            }[kind]

            bands = []
            for (y0, y1, idx) in floors:
                if idx == 0:
                    reg = ground_region
                elif kind == "party":
                    reg = "BLANK"
                elif kind == "lane" and st["back"] and is_ground:
                    reg = st["back"]
                elif idx == 1 and signage_1f and kind == "street":
                    reg = "SIGN_1F"
                else:
                    reg = region_upper
                bands.append((y0, y1, reg))
            bands.append((floors[-1][1], top, st["parapet"]))
            if is_ground:
                bands.insert(0, (-SKIRT, 0.0, "INK"))

            trim = TRIM_W if L > 2 * TRIM_W + 0.2 else 0.0
            for (y0, y1, reg) in bands:
                if y1 <= start_y + 1e-3:
                    continue
                fv0 = 0.0
                if y0 < start_y:
                    fv0 = (start_y - y0) / (y1 - y0)
                    y0 = start_y
                ph = phase if reg not in ("INK",) else 0.0
                add_wall(mesh, atlas, A, B, n, y0, y1, reg, ph, fv=(fv0, 1.0), t_range=(trim, L - trim))
            if trim:
                for (ta, tb) in ((0.0, trim), (L - trim, L)):
                    add_wall(mesh, atlas, A, B, n, start_y, top, "INK", 0.0, t_range=(ta, tb))

            # 簷篷 + 直招牌（只限臨街嘅地面部分）
            if is_ground and kind == "street" and L >= 3.0:
                c = (A + B) / 2 + n * (CANOPY_DEPTH / 2)
                add_box(mesh, atlas, c, d, n, (L / 2 - 0.3, CANOPY_DEPTH / 2), CANOPY_Y[0], CANOPY_Y[1],
                        {"+n": ("CANOPY", False), "top": ("ROOF_concrete", False),
                         "bottom": ("CANOPY", False), "+u": ("INK", False), "-u": ("INK", False)})
                n_floors = len(floors)
                if st["signs"] and n_floors >= 3 and L >= 5.0:
                    count = min(3, int(L // 6) or 1)
                    for k in range(count):
                        if sign_count >= 6:
                            break
                        t = (k + 0.5) * L / count + ((h32(bid, pi, ei, k, "t") % 200) / 100.0 - 1.0)
                        t = min(max(t, 1.0), L - 1.0)
                        level = h32(bid, pi, ei, k, "y") % 2 if n_floors >= 4 else 0
                        y0 = 4.6 + level * 2.8
                        y1 = y0 + SIGN["h"]
                        if y1 > top - PARAPET_H:
                            continue
                        sc = A + d * t + n * (SIGN["gap"] + SIGN["out"] / 2)
                        region = f"SIGN_{h32(bid, pi, ei, k, 's') % 16:02d}"
                        # 招牌兩大面向沿街兩邊；外端同頂底用墨色
                        add_box(mesh, atlas, sc, d, n, (SIGN["t"] / 2, SIGN["out"] / 2), y0, y1,
                                {"+u": (region, False), "-u": (region, False),
                                 "+n": ("INK", False), "top": ("INK", False), "bottom": ("INK", False)})
                        sign_count += 1

        # 天台（平頂，唔放任何物件）
        u0, u1, v0, v1 = lr
        roof_pts = [to3(u0, v0, top), to3(u1, v0, top), to3(u1, v1, top), to3(u0, v1, top)]
        ru = atlas.uv_rect(st["roof"], 0.0, min(1.0, (u1 - u0) / atlas.meters_w(st["roof"])), 0.0, 1.0)
        mesh.tri_fan(roof_pts, (0.0, 1.0, 0.0), ru)

        if is_ground:
            colliders.append((lr, -SKIRT, top))

    return mesh, colliders, (uc, vc), upper


def collider_mesh(lr, y0, y1):
    m = MeshData()
    u0, u1, v0, v1 = lr
    c = ((u0 + u1) / 2, (v0 + v1) / 2)

    class _A:  # 碰撞方塊唔需要貼圖，畀個假 atlas
        def uv_rect(self, *a, **k):
            return [(0, 0), (1, 0), (1, 1), (0, 1)]
    add_box(m, _A(), c, (1, 0), (0, 1), ((u1 - u0) / 2, (v1 - v0) / 2), y0, y1,
            {f: ("", False) for f in ("+n", "-n", "+u", "-u", "top", "bottom")})
    return m


# ------------------------------------------------------------------ GLB 輸出

def pad4(b, fill=b"\x00"):
    return b + fill * ((4 - len(b) % 4) % 4)


def write_glb(path, body_name, body, colliders, image_bytes, image_name):
    gltf = {
        "asset": {"version": "2.0", "generator": "Gangs-Online tools/buildings"},
        "extensionsUsed": ["EXT_texture_webp", "KHR_materials_specular"],
        "extensionsRequired": ["EXT_texture_webp"],
        "scene": 0, "scenes": [{"nodes": []}],
        "nodes": [], "meshes": [], "accessors": [], "bufferViews": [],
        "materials": [{
            "name": "hk_comic_atlas",
            "pbrMetallicRoughness": {"baseColorTexture": {"index": 0}, "metallicFactor": 0.0,
                                     "roughnessFactor": 1.0},
            "extensions": {"KHR_materials_specular": {"specularFactor": 0.0}},
        }],
        "samplers": [{"magFilter": 9729, "minFilter": 9987, "wrapS": 33071, "wrapT": 33071}],
        "textures": [{"sampler": 0, "extensions": {"EXT_texture_webp": {"source": 0}}}],
        "images": [],
    }
    blob = bytearray()

    def add_view(data, target=None):
        off = len(blob)
        blob.extend(pad4(bytes(data)))
        v = {"buffer": 0, "byteOffset": off, "byteLength": len(data)}
        if target:
            v["target"] = target
        gltf["bufferViews"].append(v)
        return len(gltf["bufferViews"]) - 1

    def add_acc(arr, ctype, typ, target, minmax=False):
        view = add_view(arr.tobytes(), target)
        a = {"bufferView": view, "componentType": ctype, "count": int(arr.shape[0]), "type": typ}
        if minmax:
            a["min"] = [float(x) for x in arr.min(0)]
            a["max"] = [float(x) for x in arr.max(0)]
        gltf["accessors"].append(a)
        return len(gltf["accessors"]) - 1

    def add_mesh(name, m, material):
        pos = np.array(m.pos, np.float32)
        nrm = np.array(m.nrm, np.float32)
        nrm /= np.maximum(np.linalg.norm(nrm, axis=1, keepdims=True), 1e-9)
        uv = np.array(m.uv, np.float32)
        idx = np.array(m.idx, np.uint16 if len(m.pos) < 65536 else np.uint32)
        prim = {"attributes": {
            "POSITION": add_acc(pos, 5126, "VEC3", 34962, True),
            "NORMAL": add_acc(nrm, 5126, "VEC3", 34962),
            "TEXCOORD_0": add_acc(uv, 5126, "VEC2", 34962),
        }, "indices": add_acc(idx.reshape(-1, 1), 5123 if idx.dtype == np.uint16 else 5125, "SCALAR", 34963)}
        if material is not None:
            prim["material"] = material
        gltf["meshes"].append({"name": name, "primitives": [prim]})
        gltf["nodes"].append({"name": name, "mesh": len(gltf["meshes"]) - 1})
        gltf["scenes"][0]["nodes"].append(len(gltf["nodes"]) - 1)

    add_mesh(body_name, body, 0)
    for i, cm in enumerate(colliders):
        add_mesh(f"COL_{body_name}_{i}", cm, None)
    img_view = add_view(image_bytes)
    gltf["images"].append({"name": image_name, "mimeType": "image/webp", "bufferView": img_view})
    gltf["buffers"] = [{"byteLength": len(blob)}]

    js = pad4(json.dumps(gltf, ensure_ascii=False, separators=(",", ":")).encode("utf-8"), b" ")
    bin_ = pad4(bytes(blob))
    total = 12 + 8 + len(js) + 8 + len(bin_)
    with open(path, "wb") as f:
        f.write(struct.pack("<III", 0x46546C67, 2, total))
        f.write(struct.pack("<II", len(js), 0x4E4F534A))
        f.write(js)
        f.write(struct.pack("<II", len(bin_), 0x004E4942))
        f.write(bin_)


# ------------------------------------------------------------------ 平面預覽

def draw_plan(path, buildings, roads, spawn_r):
    allr = np.array([p["rect"] for b in buildings for p in b["_parts"]])
    u0, u1 = allr[:, 0].min() - 15, allr[:, 1].max() + 15
    v0, v1 = allr[:, 2].min() - 15, allr[:, 3].max() + 15
    ppm = 5
    W, H = int((u1 - u0) * ppm), int((v1 - v0) * ppm)
    img = Image.new("RGB", (W, H), (226, 222, 210))
    d = ImageDraw.Draw(img)

    def P(u, v):
        return ((u - u0) * ppm, (v1 - v) * ppm)
    geoms = getattr(roads, "geoms", [roads])
    for g in geoms:
        clipped = g.intersection(box(u0, v0, u1, v1))
        for gg in getattr(clipped, "geoms", [clipped]):
            if gg.is_empty or gg.geom_type != "Polygon":
                continue
            d.polygon([P(x, y) for x, y in gg.exterior.coords], fill=(70, 70, 80))
    f = ImageFont.truetype("/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc", 12)
    for b in buildings:
        col = {"gov3d": (120, 170, 230), "estimate": (240, 160, 160)}.get(b["source"], (250, 214, 120))
        for p in b["_parts"]:
            r = p["rect"]
            d.rectangle((*P(r[0], r[3]), *P(r[1], r[2])), fill=col if p.get("base", 0) <= 0 else None,
                        outline=(20, 20, 30), width=2)
        r = b["_parts"][0]["rect"]
        cx, cy = P((r[0] + r[1]) / 2, (r[2] + r[3]) / 2)
        d.text((cx, cy), f"{b['id']}\n{b['_floorsLabel']}", font=f, fill=(20, 20, 30), anchor="mm", align="center")
    sx, sy = P(0, 0)
    d.ellipse((sx - spawn_r * ppm, sy - spawn_r * ppm, sx + spawn_r * ppm, sy + spawn_r * ppm), outline=(220, 0, 160), width=3)
    d.text((sx + 4, sy + 10), "出生點", font=f, fill=(220, 0, 160))
    img.save(path)


# ------------------------------------------------------------------ main

def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    data_path = sys.argv[1]
    if not os.path.isabs(data_path):
        data_path = os.path.join(HERE, data_path) if not os.path.exists(data_path) else data_path
    data = json.load(open(data_path, encoding="utf-8"))
    frame = Frame(data["frame"])
    layout = json.load(open(os.path.join(HERE, "atlas", "atlas_layout.json"), encoding="utf-8"))
    atlas = Atlas(layout)
    image_bytes = open(os.path.join(HERE, "atlas", "hk_comic_atlas.webp"), "rb").read()
    image_name = "shared:hk_comic_atlas:" + hashlib.sha1(image_bytes).hexdigest()[:10]

    roads = load_roads(os.path.join(REPO, data["terrain"]), frame)
    pavement = roads.buffer(data.get("pavementMin", 2.0))
    spawn = Point(0, 0).buffer(data.get("spawnClearance", 3.0))
    obstacle = unary_union([pavement, spawn])

    warnings = []
    for b in data["buildings"]:
        parts = []
        for i, p in enumerate(b["parts"]):
            r = shrink_rect_away(p["rect"], obstacle, f"{b['id']}#{i}", warnings)
            if r:
                parts.append({**p, "rect": r})
        b["_parts"] = parts

    footprints = {b["id"]: unary_union([box(p["rect"][0], p["rect"][2], p["rect"][1], p["rect"][3])
                                        for p in b["_parts"] if p.get("base", 0) <= 0])
                  for b in data["buildings"] if b["_parts"]}
    ctx = {"atlas": atlas, "roads": roads,
           "footprints_other": {bid: unary_union([fp for o, fp in footprints.items() if o != bid])
                                for bid in footprints}}

    # 重疊檢查
    ids = list(footprints)
    for i in range(len(ids)):
        for k in range(i + 1, len(ids)):
            a = footprints[ids[i]].intersection(footprints[ids[k]]).area
            if a > 0.5:
                warnings.append(f"{ids[i]} 同 {ids[k]} 重疊 {a:.1f} m²")

    out_dir = os.path.join(HERE, "out", data["packId"])
    os.makedirs(out_dir, exist_ok=True)
    for old in os.listdir(out_dir):
        if old.endswith(".glb"):
            os.remove(os.path.join(out_dir, old))

    manifest = {
        "format": "gangs-online/building-pack@1",
        "packId": data["packId"], "packVersion": data.get("packVersion", 1),
        "mapName": data["mapName"], "chunkId": data["chunkId"],
        "atlas": image_name,
        "notes": data.get("notes", []),
        "buildings": [],
    }
    worst = 0
    for b in data["buildings"]:
        if not b["_parts"]:
            continue
        mesh, cols, (uc, vc), upper = build_building(b, ctx)
        col_meshes = [collider_mesh(lr, y0, y1) for (lr, y0, y1) in cols]
        tris = mesh.tris + sum(c.tris for c in col_meshes)
        worst = max(worst, tris)
        if tris > MAX_TRIS:
            raise SystemExit(f"{b['id']}: {tris} 三角面，超過 {MAX_TRIS}")
        height = max(part_heights(p, b["style"])[2] for p in b["_parts"])
        floors_label = "/".join(
            str(p["floors"]) + "F" if "floors" in p else f"{p['height']:.0f}m" for p in b["_parts"])
        b["_floorsLabel"] = floors_label
        body_name = f"19D-{b['id']}" if data["chunkId"] == "11-NW-19D" else f"{data['chunkId']}-{b['id']}"
        fname = f"{b['id']}.glb"
        write_glb(os.path.join(out_dir, fname), body_name, mesh, col_meshes, image_bytes, image_name)

        E, N = frame.uv_to_EN(uc, vc)
        manifest["buildings"].append({
            "id": b["id"],
            "file": fname,
            "name": f"{data['chunkId']} {b['id']} {b['name']} {floors_label}",
            "kind": "building",
            "category": data["chunkId"],
            "tags": [data["chunkId"], data["packId"], b["style"], b["source"]],
            "key": f"add:{data['packId']}:{b['id']}",
            "transform": {
                "position": {"x": round(E, 3), "y": data.get("groundY", 0.0), "z": round(-N, 3)},
                "rotation": {"x": 0.0, "y": round(frame.angle, 6), "z": 0.0},
                "scale": {"x": 1.0, "y": 1.0, "z": 1.0},
            },
            "style": b["style"], "facade": upper, "source": b["source"],
            "height": round(height, 1), "floors": floors_label, "tris": tris,
            "bytes": os.path.getsize(os.path.join(out_dir, fname)),
        })
        print(f"{b['id']:5s} {b['style']:12s} {floors_label:10s} h={height:5.1f}m tris={tris:4d}")

    with open(os.path.join(out_dir, "manifest.json"), "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
    draw_plan(os.path.join(out_dir, "plan.png"), [b for b in data["buildings"] if b["_parts"]], roads,
              data.get("spawnClearance", 3.0))
    total = sum(x["bytes"] for x in manifest["buildings"])
    print(f"\n{len(manifest['buildings'])} 棟，最多 {worst} 三角面，GLB 合共 {total / 1024:.0f} KB -> {out_dir}")
    if warnings:
        print("\n注意：")
        for w in warnings:
            print("  -", w)


if __name__ == "__main__":
    main()
