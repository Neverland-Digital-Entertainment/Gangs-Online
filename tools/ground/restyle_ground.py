"""
底圖地板（T 字頭地形）換港漫風格：港式方階磚行人路、路邊石墨線、瀝青馬路

    python tools/ground/make_ground_textures.py      # 改咗貼圖畫法先要重跑
    python tools/ground/restyle_ground.py            # 預設改 packages/client/public/maps/11-NW-19D.glb

原本嘅地板：
- 行人路（材質 walk）：紅磚貼圖用原本 UV 鋪 360 次，node 有不等比縮放 → 磚拉長、遠睇出斜紋；仲開咗清漆反光。
  而且係兩塊重疊嘅板（頂 0.05m 同 0.2m），路邊有兩級
- 馬路（材質 road）：平色深灰；路面黃線（其他材質）同馬路一樣高，會閃（z-fighting）

改完：
- 行人路重做成一塊板：頂 0.2m（同以前一樣，玩家照樣行得上），邊落到 -0.05m
  - 頂面：方階磚，UV 按真實米數、跟街道方向（偏 10°）
  - 貼住馬路嘅邊：外面 10cm 墨線 + 30cm 淺灰路邊石；側面灰色；貼住隔籬 chunk 嘅邊唔畫
- 馬路：瀝青貼圖（按米數）；只保留向上嘅面
- 黃線：港式黃色、啞光，抬高到 1.5cm
- 全部改用世界座標（node 唔再有旋轉、縮放），材質一律啞光
- 可以重複執行：已經改過嘅地板會照樣認得，重新產生
"""

import argparse
import math
import json
import os
import sys

import numpy as np
from shapely import constrained_delaunay_triangles
from shapely.geometry import Polygon
from shapely.geometry.polygon import orient
from shapely.ops import unary_union

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", ".."))
sys.path.insert(0, os.path.join(REPO, "tools", "buildings"))
from glbio import Glb, accessor, compact, read_glb  # noqa: E402
from build_buildings import quat_mat  # noqa: E402

TOP_Y = 0.2             # 行人路面高度
BOTTOM_Y = -0.05        # 路邊側面落到馬路以下少少，唔會有罅
MARKING_Y = 0.015       # 黃線高過馬路
INK_W = 0.10            # 路邊墨線闊度
STONE_W = 0.30          # 路邊石闊度
GRID_DEG = 10.0         # 街道網格方向（階磚跟住佢排）

WALK = {"walk", "ground_pavement", "ground_kerb_ink", "ground_kerb_stone", "ground_kerb_side"}
ROAD = {"road", "ground_asphalt"}


def srgb_to_linear(rgb):
    def f(c):
        c /= 255.0
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    return tuple(round(f(float(c)), 4) for c in rgb)


COLORS = {
    "ground_kerb_ink": srgb_to_linear((30, 27, 34)),
    "ground_kerb_stone": srgb_to_linear((216, 211, 200)),
    "ground_kerb_side": srgb_to_linear((168, 163, 153)),
    "ground_marking": srgb_to_linear((240, 192, 40)),
}


def polys_of(g):
    if g.is_empty:
        return []
    if isinstance(g, Polygon):
        return [g]
    return [p for p in getattr(g, "geoms", []) if isinstance(p, Polygon)]


def world_triangles(j, bin_, node):
    """node 入面每個 primitive → (材質名, 世界座標三角形 (n,3,3))"""
    R = quat_mat(node.get("rotation", [0, 0, 0, 1]))
    S = np.array(node.get("scale", [1, 1, 1]), float)
    T = np.array(node.get("translation", [0, 0, 0]), float)
    out = []
    for pr in j["meshes"][node["mesh"]]["primitives"]:
        mat = j["materials"][pr["material"]]["name"] if "material" in pr else ""
        P = accessor(j, bin_, pr["attributes"]["POSITION"]).astype(np.float64)
        W = (R @ (P * S).T).T + T
        idx = accessor(j, bin_, pr["indices"]).reshape(-1, 3) if "indices" in pr else \
            np.arange(len(W)).reshape(-1, 3)
        out.append((mat, W[idx]))
    return out


def up_faces(tris, flip_down=True):
    """只要水平面；向下嘅翻轉做向上（原本材質係雙面，繞向唔一定啱）"""
    n = np.cross(tris[:, 1] - tris[:, 0], tris[:, 2] - tris[:, 0])
    ny = n[:, 1] / np.maximum(np.linalg.norm(n, axis=1), 1e-12)
    up = tris[ny > 0.5]
    if flip_down:
        down = tris[ny < -0.5][:, ::-1]
        up = np.concatenate([up, down]) if len(down) else up
    return up


def plan(tris):
    """世界座標三角形 → E/N 平面多邊形聯集（glTF z = -N）"""
    return unary_union([Polygon(np.c_[t[:, 0], -t[:, 2]]) for t in tris]).buffer(0)


class Builder:
    """一個 primitive 嘅頂點（去索引，每個三角形自己三個頂點）"""

    def __init__(self, origin):
        self.E0, self.N0 = origin
        self.pos, self.nrm, self.uv = [], [], []

    def tri(self, pts_en_y, normal, uv_fn=None):
        for (E, N, y) in pts_en_y:
            self.pos.append((E - self.E0, y, -(N - self.N0)))
            self.nrm.append(normal)
            if uv_fn:
                self.uv.append(uv_fn(E, N))

    def flat(self, geom, y, uv_fn=None):
        for t in polys_of(constrained_delaunay_triangles(geom)):
            c = list(orient(t, 1.0).exterior.coords)[:3]  # 由上望落逆時針 = glTF 正面向上
            self.tri([(E, N, y) for E, N in c], (0.0, 1.0, 0.0), uv_fn)

    def gltf_tris(self, tris, uv_fn=None):
        """世界座標三角形（glTF 軸）照搬"""
        for t in tris:
            n = np.cross(t[1] - t[0], t[2] - t[0])
            n = tuple(n / max(np.linalg.norm(n), 1e-12))
            self.tri([(p[0], -p[2], p[1]) for p in t], n, uv_fn)

    def wall(self, A, B, y0, y1):
        """A→B（E/N，外圈逆時針）一面向外嘅側牆"""
        d = (B - A) / np.linalg.norm(B - A)
        n = (float(d[1]), 0.0, float(d[0]))  # 外法線 (d.N, -d.E) → glTF (nE, 0, -nN)
        quad = [(A, y0), (B, y0), (B, y1), (A, y1)]
        for k in (0, 1, 2, 0, 2, 3):
            P, y = quad[k]
            self.tri([(P[0], P[1], y)], n)

    def primitive(self, glb, material):
        idx = np.arange(len(self.pos))
        return glb.primitive(self.pos, self.nrm, self.uv or None, idx, material)


def grid_uv(origin, metres):
    E0, N0 = origin
    c, s = math.cos(math.radians(GRID_DEG)), math.sin(math.radians(GRID_DEG))

    def f(E, N):
        e, n = E - E0, N - N0
        return ((e * c + n * s) / metres, (-e * s + n * c) / metres)
    return f


def restyle(map_path, layout, tex_dir):
    j, bin_ = read_glb(map_path)
    terrain = [n for n in j["nodes"] if n.get("name", "").upper().startswith("T") and "mesh" in n]
    if len(terrain) != 1:
        raise SystemExit(f"預期一個 T 字頭地形 node，搵到 {len(terrain)} 個")
    node = terrain[0]
    parts = world_triangles(j, bin_, node)
    walk = [t for m, t in parts if m in WALK]
    road = [t for m, t in parts if m in ROAD]
    marks = [t for m, t in parts if m not in WALK | ROAD]
    if not walk or not road:
        raise SystemExit(f"搵唔到行人路／馬路材質：{sorted({m for m, _ in parts})}")

    walk_up = up_faces(np.concatenate(walk), flip_down=False)
    road_up = up_faces(np.concatenate(road))
    PV = plan(walk_up).buffer(0.01, join_style="mitre").buffer(-0.01, join_style="mitre")
    PV = unary_union([p for p in polys_of(PV.simplify(0.02, preserve_topology=True)) if p.area > 0.05])
    RD = plan(road_up)

    # 路邊帶：只喺貼住馬路嘅邊畫（隔籬 chunk 嗰邊唔畫）
    inner_ink = PV.buffer(-INK_W, join_style="mitre")
    inner_stone = PV.buffer(-(INK_W + STONE_W), join_style="mitre")
    ink = PV.difference(inner_ink).intersection(RD.buffer(0.15))
    stone = inner_ink.difference(inner_stone).intersection(RD.buffer(INK_W + STONE_W + 0.15))
    paving = PV.difference(ink).difference(stone)

    minx, miny, maxx, maxy = PV.union(RD).bounds
    origin = (round((minx + maxx) / 2), round((miny + maxy) / 2))

    g = Glb(*compact(j, bin_, keep_node=lambda n: n is not node))
    with open(os.path.join(tex_dir, layout["pavement"]["file"]), "rb") as f:
        pav_tex = g.texture(f.read(), "ground:pavement")
    with open(os.path.join(tex_dir, layout["asphalt"]["file"]), "rb") as f:
        asp_tex = g.texture(f.read(), "ground:asphalt")
    mats = {
        "ground_pavement": g.material("ground_pavement", texture=pav_tex),
        "ground_asphalt": g.material("ground_asphalt", texture=asp_tex),
    }
    for name, color in COLORS.items():
        mats[name] = g.material(name, color=color)

    prims = []
    b = Builder(origin)
    b.flat(paving, TOP_Y, grid_uv(origin, layout["pavement"]["metres"]))
    prims.append(b.primitive(g, mats["ground_pavement"]))
    for name, geom in (("ground_kerb_ink", ink), ("ground_kerb_stone", stone)):
        b = Builder(origin)
        b.flat(geom, TOP_Y)
        prims.append(b.primitive(g, mats[name]))

    b = Builder(origin)
    walls = 0
    for p in polys_of(PV):
        p = orient(p, 1.0)
        for ring in [p.exterior, *p.interiors]:
            pts = [np.array(c) for c in ring.coords]
            for A, B in zip(pts[:-1], pts[1:]):
                if np.linalg.norm(B - A) > 1e-3:
                    b.wall(A, B, BOTTOM_Y, TOP_Y)
                    walls += 1
    prims.append(b.primitive(g, mats["ground_kerb_side"]))

    b = Builder(origin)
    b.gltf_tris(road_up, grid_uv(origin, layout["asphalt"]["metres"]))
    prims.append(b.primitive(g, mats["ground_asphalt"]))

    if marks:
        m = up_faces(np.concatenate(marks)).copy()
        m[:, :, 1] = MARKING_Y
        b = Builder(origin)
        b.gltf_tris(m)
        prims.append(b.primitive(g, mats["ground_marking"]))

    g.node(node["name"], prims, translation=(origin[0], 0.0, -origin[1]))
    used = {e for m in g.g["materials"] for e in m.get("extensions", {})}
    used |= {e for t in g.g["textures"] for e in t.get("extensions", {})}
    g.g["extensionsUsed"] = [e for e in g.g.get("extensionsUsed", []) if e in used]
    if "extensionsRequired" in g.g:
        g.g["extensionsRequired"] = [e for e in g.g["extensionsRequired"] if e in used]
        if not g.g["extensionsRequired"]:
            del g.g["extensionsRequired"]  # 規格唔准空 list
    g.save(map_path)

    tris = sum(g.g["accessors"][p["indices"]]["count"] for p in prims) // 3
    print(f"{node['name']}：行人路 {PV.area:,.0f} m²（{len(polys_of(PV))} 塊）、路邊 {ink.length / 2:,.0f} m、"
          f"馬路 {RD.area:,.0f} m²、黃線 {sum(len(t) for t in marks)} 個三角形；地板合共 {tris:,} 三角形")
    print(f"→ {os.path.relpath(map_path, REPO)}（{os.path.getsize(map_path) / 1024 / 1024:.1f} MB）")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--map", default=os.path.join(REPO, "packages", "client", "public", "maps", "11-NW-19D.glb"))
    a = ap.parse_args()
    tex_dir = os.path.join(HERE, "textures")
    layout = json.load(open(os.path.join(tex_dir, "layout.json"), encoding="utf-8"))
    restyle(a.map, layout, tex_dir)


if __name__ == "__main__":
    main()
