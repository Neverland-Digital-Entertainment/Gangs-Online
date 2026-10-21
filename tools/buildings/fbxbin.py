"""
最簡單嘅 FBX（binary 7.x）讀取器：只讀 node 樹、mesh 同 model transform。

地政總署 3D 空間數據（FBX0，冇貼圖版）每棟一個 FBX，Z 向上、單位米、座標 = HK1980 Grid，
用唔到 Blender / FBX SDK 都讀得到。
"""
import struct
import zlib

import numpy as np


class Node:
    __slots__ = ("name", "props", "children")

    def __init__(self, name, props, children):
        self.name = name
        self.props = props
        self.children = children

    def find(self, name):
        for c in self.children:
            if c.name == name:
                return c
        return None

    def findall(self, name):
        return [c for c in self.children if c.name == name]

    def __repr__(self):
        return f"Node({self.name}, {len(self.props)} props, {len(self.children)} kids)"


_ARR = {"f": "<f4", "d": "<f8", "l": "<i8", "i": "<i4", "b": "<u1"}


def _read_prop(buf, off):
    t = chr(buf[off])
    off += 1
    if t == "Y":
        return struct.unpack_from("<h", buf, off)[0], off + 2
    if t == "C":
        return bool(buf[off]), off + 1
    if t == "I":
        return struct.unpack_from("<i", buf, off)[0], off + 4
    if t == "F":
        return struct.unpack_from("<f", buf, off)[0], off + 4
    if t == "D":
        return struct.unpack_from("<d", buf, off)[0], off + 8
    if t == "L":
        return struct.unpack_from("<q", buf, off)[0], off + 8
    if t in _ARR:
        n, enc, clen = struct.unpack_from("<III", buf, off)
        off += 12
        raw = buf[off:off + clen]
        off += clen
        if enc == 1:
            raw = zlib.decompress(raw)
        return np.frombuffer(raw, dtype=_ARR[t], count=n), off
    if t in "SR":
        n = struct.unpack_from("<I", buf, off)[0]
        off += 4
        v = bytes(buf[off:off + n])
        off += n
        if t == "S":
            v = v.decode("utf-8", "replace")
        return v, off
    raise ValueError(f"unknown FBX property type {t!r} at {off}")


def _read_node(buf, off, wide):
    if wide:
        end, nprops, _plen = struct.unpack_from("<QQQ", buf, off)
        off += 24
    else:
        end, nprops, _plen = struct.unpack_from("<III", buf, off)
        off += 12
    nlen = buf[off]
    off += 1
    if end == 0:
        return None, off
    name = bytes(buf[off:off + nlen]).decode("ascii", "replace")
    off += nlen
    props = []
    for _ in range(nprops):
        v, off = _read_prop(buf, off)
        props.append(v)
    children = []
    null_len = 25 if wide else 13
    while off < end - null_len:
        child, off = _read_node(buf, off, wide)
        if child is None:
            break
        children.append(child)
    return Node(name, props, children), end


def read(path):
    buf = memoryview(open(path, "rb").read())
    if bytes(buf[:20]) != b"Kaydara FBX Binary  ":
        raise ValueError("not a binary FBX")
    version = struct.unpack_from("<I", buf, 23)[0]
    wide = version >= 7500
    off = 27
    top = []
    while off < len(buf):
        node, off = _read_node(buf, off, wide)
        if node is None:
            break
        top.append(node)
    return version, Node("", [], top)


def props70(node):
    """Properties70 -> {name: values tuple}."""
    out = {}
    p = node.find("Properties70") if node else None
    if p is None:
        return out
    for P in p.findall("P"):
        out[P.props[0]] = tuple(P.props[4:])
    return out


def euler_xyz(rx, ry, rz):
    """FBX 預設旋轉次序 XYZ（R = Rz·Ry·Rx），單位度"""
    rx, ry, rz = np.radians([rx, ry, rz])
    cx, sx, cy, sy, cz, sz = np.cos(rx), np.sin(rx), np.cos(ry), np.sin(ry), np.cos(rz), np.sin(rz)
    Rx = np.array([[1, 0, 0], [0, cx, -sx], [0, sx, cx]])
    Ry = np.array([[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]])
    Rz = np.array([[cz, -sz, 0], [sz, cz, 0], [0, 0, 1]])
    return Rz @ Ry @ Rx


def model_matrix(p):
    """Model 嘅本地 4x4 矩陣（唔計 pivot；地政總署數據冇用 pivot）"""
    t = np.array(p.get("Lcl Translation", (0, 0, 0)), float)
    r = p.get("Lcl Rotation", (0, 0, 0))
    s = np.array(p.get("Lcl Scaling", (1, 1, 1)), float)
    pre = p.get("PreRotation", (0, 0, 0))
    post = p.get("PostRotation", (0, 0, 0))
    M = np.eye(4)
    R = euler_xyz(*pre) @ euler_xyz(*r) @ np.linalg.inv(euler_xyz(*post))
    M[:3, :3] = R @ np.diag(s)
    M[:3, 3] = t
    return M


def geometric_matrix(p):
    t = np.array(p.get("GeometricTranslation", (0, 0, 0)), float)
    r = p.get("GeometricRotation", (0, 0, 0))
    s = np.array(p.get("GeometricScaling", (1, 1, 1)), float)
    M = np.eye(4)
    M[:3, :3] = euler_xyz(*r) @ np.diag(s)
    M[:3, 3] = t
    return M


def load_meshes(path):
    """回傳 (version, GlobalSettings, [{model, geom, verts（世界座標，FBX 軸）, polys}])"""
    version, root = read(path)
    gs = props70(root.find("GlobalSettings"))
    objs = root.find("Objects")
    conns = root.find("Connections")
    geoms, models = {}, {}
    for o in objs.children:
        if o.name == "Geometry" and o.props[2] == "Mesh":
            geoms[o.props[0]] = o
        elif o.name == "Model":
            models[o.props[0]] = o
    parent = {}
    geom_of = {}
    for c in conns.findall("C"):
        if c.props[0] != "OO":
            continue
        src, dst = c.props[1], c.props[2]
        if src in geoms and dst in models:
            geom_of.setdefault(dst, []).append(src)
        elif src in models:
            parent[src] = dst

    def world(mid):
        M = np.eye(4)
        chain = []
        while mid in models:
            chain.append(mid)
            mid = parent.get(mid, 0)
        for m in reversed(chain):
            M = M @ model_matrix(props70(models[m]))
        return M

    out = []
    for mid, gids in geom_of.items():
        mp = props70(models[mid])
        W = world(mid) @ geometric_matrix(mp)
        for gid in gids:
            g = geoms[gid]
            v = g.find("Vertices").props[0].reshape(-1, 3)
            pvi = g.find("PolygonVertexIndex").props[0]
            polys, cur = [], []
            for i in pvi:
                if i < 0:
                    cur.append(-i - 1)
                    polys.append(cur)
                    cur = []
                else:
                    cur.append(int(i))
            vw = (np.c_[v, np.ones(len(v))] @ W.T)[:, :3]
            out.append({
                "model": models[mid].props[1].split("\x00")[0],
                "geom": g.props[1].split("\x00")[0],
                "verts": vw,
                "polys": polys,
                "pivots": {k: mp[k] for k in ("RotationPivot", "ScalingPivot", "RotationOffset", "ScalingOffset") if k in mp},
            })
    return version, gs, out
