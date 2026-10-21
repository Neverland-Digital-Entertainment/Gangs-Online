"""
地政總署 3D 大廈（FBX）→ 簡化體量 JSON（逐級：平台、塔樓…）

    python tools/buildings/extract_gov.py <解壓咗嘅資料夾> [--radius 200] [--out data/11-NW-19D_gov.json]

<解壓咗嘅資料夾> = 地政總署「3D 空間數據」FBX0（冇貼圖版）zip 解壓後，入面有 BUILDING/<id>/<id>.fbx。
原始 FBX 每棟幾百至幾萬個三角面，又有天台水箱、樓梯屋、招牌、簷篷，遊戲用唔到；
呢度只抽出遊戲需要嘅「體量」：

- 外輪廓：所有三角面由上望落嘅聯集（補返模型裂縫，去走 1m 以下嘅幼條，例如招牌、冷氣機、簷篷邊）
- 逐級高度：向上嘅面按高度分組，每組以上嘅範圍 = 一級（平台 → 塔樓 → …）
- 天台物件（樓梯屋、升降機機房、水箱）：比下一級高唔夠 7m 又細過佢 35% 嘅一級 → 刪走
- 相差 < 2.5m 或者只係細咗一圈 < 2m 嘅兩級合併；最低一級矮過 2.5m（後院、地台）唔當大廈
- 細過 30m² 嘅天井填滿；最多保留 4 級

輸出嘅 JSON 用 HK1980 Grid（E, N），高度由大廈地面計（地面 mPD 另外記錄），
之後由 bake_gov.py 套港漫外牆、併入底圖 GLB。JSON 細，可以 commit；原始 zip 唔使留喺 repo。
"""

import argparse
import glob
import json
import os
import sys

import numpy as np
from shapely import constrained_delaunay_triangles  # noqa: F401  確認 shapely ≥ 2.1（bake_gov 要用）
from shapely.geometry import MultiPoint, Point, Polygon
from shapely.geometry.polygon import orient
from shapely.ops import unary_union

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import fbxbin  # noqa: E402

SPAWN = (835575.4, 819658.9)   # 出生點（HK1980），同 GAME_CONSTANTS.SPAWN_X/Z 一致
LEVEL_GAP = 1.5                # 向上嘅面高度相差 1.5m 以內當同一級
CRACK = 0.3                    # 閉運算半徑：模型面同面之間 0.6m 以下嘅罅補返
SLIVER = 0.5                   # 開運算半徑：闊度細過 1m 嘅部分刪走
MIN_PIECE = 4.0                # 細過 4m² 嘅碎片刪走
FILL_HOLE = 30.0               # 天井細過 30m² 就填滿
ROOFTOP_DH, ROOFTOP_RATIO = 7.0, 0.35
MERGE_DH = 2.5                 # 兩級相差 2.5m 以內合併（女兒牆高低、斜天台）
THIN_RING = 2.0                # 上一級只係細咗一圈 2m 以下 → 合併
MIN_HEIGHT = 2.5               # 最低一級矮過 2.5m = 地台，唔當大廈
MAX_TIERS = 4
SIMPLIFY = 0.35


def load_triangles(path):
    _, gs, meshes = fbxbin.load_meshes(path)
    if gs.get("UpAxis", (2,))[0] != 2 or abs(gs.get("UnitScaleFactor", (100.0,))[0] - 100.0) > 1e-3:
        raise ValueError(f"{path}: 預期 Z 向上、單位米，實際 {gs.get('UpAxis')} / {gs.get('UnitScaleFactor')}")
    tris = []
    for m in meshes:
        if m["pivots"]:
            raise ValueError(f"{path}: 有 pivot，model_matrix 未支援")
        V = m["verts"]
        for q in m["polys"]:
            for k in range(1, len(q) - 1):
                tris.append(V[[q[0], q[k], q[k + 1]]])
    return np.array(tris)


def polys_of(g):
    if g.is_empty:
        return []
    if isinstance(g, Polygon):
        return [g]
    return [p for p in getattr(g, "geoms", []) if isinstance(p, Polygon)]


def clean(g, fill_holes=FILL_HOLE):
    """閉運算補模型裂縫 → 開運算去幼條 → 填細天井 → 去碎片"""
    g = g.buffer(CRACK, join_style="mitre").buffer(-CRACK, join_style="mitre")
    g = g.buffer(-SLIVER, join_style="mitre").buffer(SLIVER, join_style="mitre")
    out = []
    for p in polys_of(g):
        holes = [h for h in p.interiors if Polygon(h).area >= fill_holes]
        p = Polygon(p.exterior, holes)
        if p.area >= MIN_PIECE:
            out.append(p)
    return unary_union(out) if out else Polygon()


def massing(T):
    z0 = float(T[:, :, 2].min())
    xy = T[:, :, :2]
    area2 = (xy[:, 1, 0] - xy[:, 0, 0]) * (xy[:, 2, 1] - xy[:, 0, 1]) - \
            (xy[:, 2, 0] - xy[:, 0, 0]) * (xy[:, 1, 1] - xy[:, 0, 1])
    flat = np.abs(area2) > 0.02
    fp = unary_union([Polygon(t) for t in xy[flat]])

    n = np.cross(T[:, 1] - T[:, 0], T[:, 2] - T[:, 0])
    nz = n[:, 2] / np.maximum(np.linalg.norm(n, axis=1), 1e-12)
    up = flat & (nz > 0.5)
    top = T[:, :, 2].max(1) - z0

    # 由高至低分組；每組以上嘅範圍逐步累積
    order = np.argsort(-top[up])
    up_idx = np.nonzero(up)[0][order]
    groups = []  # [hmax, hmin, [tri idx]]
    for i in up_idx:
        h = top[i]
        if groups and groups[-1][1] - h <= LEVEL_GAP:
            groups[-1][1] = h
            groups[-1][2].append(i)
        else:
            groups.append([h, h, [i]])
    tiers = []
    cum = Polygon()
    for hmax, _, idx in groups:
        cum = unary_union([cum] + [Polygon(xy[i]) for i in idx])
        tiers.append([cum, float(hmax)])
    tiers.reverse()  # 由低至高
    if not tiers:
        return z0, []
    tiers[0][0] = unary_union([fp, tiers[0][0]])

    # 清理 + 確保一級包住上一級
    out = []
    for P, H in tiers:
        P = clean(P)
        if out:
            P = clean(P.intersection(out[-1][0]), fill_holes=0)
        if P.area >= MIN_PIECE:
            out.append([P, H])
    tiers = out

    # 最低嗰級得地台咁高（後院、通道、地台石屎）→ 唔係建築物，由上一級做底
    while tiers and tiers[0][1] < MIN_HEIGHT:
        del tiers[0]

    # 刪天台物件、合併相近嘅級
    changed = True
    while changed and len(tiers) > 1:
        changed = False
        for i in range(len(tiers) - 1, 0, -1):
            (Pl, Hl), (Pi, Hi) = tiers[i - 1], tiers[i]
            dh, ratio = Hi - Hl, Pi.area / max(Pl.area, 1e-9)
            # 下一級只係多出一圈幼邊（< 2m 退台、外露樓板）→ 當同一級
            thin_ring = Pl.difference(Pi).buffer(-THIN_RING / 2, join_style="mitre").is_empty
            if Pi.area < 15.0 or (dh < ROOFTOP_DH and ratio < ROOFTOP_RATIO):
                del tiers[i]
            elif dh < MERGE_DH or thin_ring:
                if ratio > 0.6:
                    tiers[i - 1][1] = Hi
                del tiers[i]
            else:
                continue
            changed = True
            break
    while len(tiers) > MAX_TIERS:
        k = min(range(1, len(tiers)), key=lambda i: tiers[i][0].area * (tiers[i][1] - tiers[i - 1][1]))
        del tiers[k]

    result = []
    prev = None
    for P, H in tiers:
        P = P.simplify(SIMPLIFY, preserve_topology=True)
        if prev is not None:
            P = P.intersection(prev)
        P = clean(P, fill_holes=0)
        if P.area < MIN_PIECE:
            continue
        result.append((P, H))
        prev = P
    return z0, result


def poly_json(P):
    out = []
    for p in polys_of(P):
        p = orient(p, 1.0)  # 外圈逆時針、天井順時針（由上望落）
        out.append({
            "exterior": [[round(x, 2), round(y, 2)] for x, y in p.exterior.coords[:-1]],
            "holes": [[[round(x, 2), round(y, 2)] for x, y in h.coords[:-1]] for h in p.interiors],
        })
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("--radius", type=float, default=200.0, help="出生點幾多米範圍內（大廈任何部分）")
    ap.add_argument("--chunk", default="11-NW-19D")
    ap.add_argument("--out", default=None)
    a = ap.parse_args()
    out_path = a.out or os.path.join(HERE, "data", f"{a.chunk}_gov.json")

    paths = sorted(glob.glob(os.path.join(a.src, "BUILDING", "*", "*.fbx")))
    if not paths:
        sys.exit(f"搵唔到 {a.src}/BUILDING/*/*.fbx")
    spawn = Point(SPAWN)
    buildings, skipped = [], 0
    for path in paths:
        bid = os.path.basename(path)[:-4]
        T = load_triangles(path)
        fp_quick = MultiPoint(T[:, :, :2].reshape(-1, 2)).convex_hull
        if fp_quick.distance(spawn) > a.radius + 30:
            skipped += 1
            continue
        z0, tiers = massing(T)
        if not tiers or tiers[0][0].distance(spawn) > a.radius:
            skipped += 1
            continue
        buildings.append({
            "id": bid,
            "ground": round(z0, 2),
            "sourceTris": int(len(T)),
            "tiers": [{"height": round(H, 2), "polygons": poly_json(P)} for P, H in tiers],
        })
        print(f"  {bid}  {len(T):6d} 面 → {len(tiers)} 級 "
              + " / ".join(f"{H:.1f}m {P.area:.0f}m²" for P, H in tiers))

    doc = {
        "format": "gangs-online/gov-massing@1",
        "chunkId": a.chunk,
        "source": "地政總署 3D 空間數據（FBX0）",
        "crs": "HK1980 Grid（EPSG:2326），E/N 米；height 由 ground（mPD）起計",
        "center": list(SPAWN),
        "radius": a.radius,
        "buildings": buildings,
    }
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(doc, f, ensure_ascii=False, separators=(",", ":"))
    print(f"\n{len(buildings)} 棟（略過 {skipped} 棟喺範圍外）→ {os.path.relpath(out_path)}")


if __name__ == "__main__":
    main()
