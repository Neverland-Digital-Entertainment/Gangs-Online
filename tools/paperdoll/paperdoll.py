"""
Paper-doll garment fitting pipeline (紙娃娃衣物自動綁定).

Takes a static garment mesh (downloaded/modelled for some other body), fits it
onto one of our character bodies and turns it into a skinned GLB that shares
the body's 65-bone skeleton, so CharacterViewer can rebind it to the body
exactly like hair.

Steps (per garment, per gender):
  1. Load + clean the raw garment: yaw fix, drop the hidden inner layer of a
     thick cloth shell, optional subdivision/smoothing.
  2. Pose the body into the garment's pose (e.g. arms down to the sleeve angle)
     and solve a scale/offset/anisotropy (+ pose angle) that fits it best.
  3. Make room: a broad smooth inflation where whole regions are too tight,
     then an active-set Laplacian collision solve so no cloth is inside the
     skin (or under-layers such as trousers) and no skin pokes through.
  4. Transfer skin weights from the closest point on the posed body surface,
     only where cloth and skin face the same way (robust weight transfer).
  5. Carry the garment into the dashboard's A-pose, relax it (rotated
     Laplacian) so blended areas keep their cloth shape, collide again there.
  6. Un-skin (inverse LBS) back into the body's T-pose bind space and export a
     GLB carrying the body's exact skeleton + inverse bind matrices.
Rigid items (hats) skip 3-5: they follow one bone and are grown, never bent.

See README.md in this folder for usage.
"""
from __future__ import annotations

import json
import math
from dataclasses import dataclass, field

import numpy as np
import pygltflib
import trimesh
from scipy import sparse
import scipy.sparse.linalg  # noqa: F401  (sparse.linalg.factorized)
from scipy.optimize import minimize
from scipy.sparse.csgraph import connected_components
from scipy.spatial import cKDTree

# ---------------------------------------------------------------------------
# glTF reading helpers
# ---------------------------------------------------------------------------

_COMP = {5126: np.float32, 5123: np.uint16, 5121: np.uint8, 5125: np.uint32, 5122: np.int16, 5120: np.int8}
_NCOMP = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}


def read_accessor(g: pygltflib.GLTF2, blob: bytes, idx: int) -> np.ndarray:
    a = g.accessors[idx]
    bv = g.bufferViews[a.bufferView]
    comp = _COMP[a.componentType]
    n = _NCOMP[a.type]
    off = (bv.byteOffset or 0) + (a.byteOffset or 0)
    itemsize = np.dtype(comp).itemsize * n
    stride = bv.byteStride
    if stride and stride != itemsize:
        raw = np.frombuffer(blob, dtype=np.uint8, count=stride * (a.count - 1) + itemsize, offset=off)
        rows = np.lib.stride_tricks.as_strided(raw, (a.count, itemsize), (stride, 1)).copy()
        arr = np.frombuffer(rows.tobytes(), dtype=comp).reshape(a.count, n)
    else:
        arr = np.frombuffer(blob, dtype=comp, count=a.count * n, offset=off).reshape(a.count, n).copy()
    if a.normalized and comp != np.float32:
        arr = arr.astype(np.float32) / np.iinfo(comp).max
    return arr


def quat_to_mat(q) -> np.ndarray:
    x, y, z, w = q
    return np.array([
        [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
        [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
        [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)],
    ])


def node_local(n) -> np.ndarray:
    if n.matrix:
        return np.array(n.matrix, dtype=float).reshape(4, 4).T
    m = np.eye(4)
    m[:3, :3] = quat_to_mat(n.rotation or [0, 0, 0, 1]) @ np.diag(n.scale or [1, 1, 1])
    m[:3, 3] = n.translation or [0, 0, 0]
    return m


def node_worlds(g: pygltflib.GLTF2, overrides: dict | None = None) -> dict[int, np.ndarray]:
    """World matrix of every node; `overrides` replaces local matrices by node index."""
    out: dict[int, np.ndarray] = {}

    def rec(i: int, parent: np.ndarray):
        loc = overrides[i] if overrides and i in overrides else node_local(g.nodes[i])
        out[i] = parent @ loc
        for c in g.nodes[i].children or []:
            rec(c, out[i])

    for r in g.scenes[g.scene or 0].nodes:
        rec(r, np.eye(4))
    return out


def axis_angle(axis, angle) -> np.ndarray:
    axis = np.asarray(axis, float)
    axis = axis / np.linalg.norm(axis)
    x, y, z = axis
    c, s = math.cos(angle), math.sin(angle)
    C = 1 - c
    m = np.eye(4)
    m[:3, :3] = [[c + x * x * C, x * y * C - z * s, x * z * C + y * s],
                 [y * x * C + z * s, c + y * y * C, y * z * C - x * s],
                 [z * x * C - y * s, z * y * C + x * s, c + z * z * C]]
    return m


def weld(points: np.ndarray, tol: float = 1e-5) -> np.ndarray:
    """Map every point to a welded id (points closer than `tol` share an id)."""
    pairs = cKDTree(points).query_pairs(tol, output_type='ndarray')
    n = len(points)
    graph = sparse.coo_matrix((np.ones(len(pairs)), (pairs[:, 0], pairs[:, 1])), shape=(n, n)) if len(pairs) else sparse.coo_matrix((n, n))
    _, labels = connected_components(graph, directed=False)
    return labels


def face_normals(V: np.ndarray, F: np.ndarray) -> np.ndarray:
    n = np.cross(V[F[:, 1]] - V[F[:, 0]], V[F[:, 2]] - V[F[:, 0]])
    return n  # area-weighted (not normalised)


def vertex_normals(V: np.ndarray, F: np.ndarray) -> np.ndarray:
    fn = face_normals(V, F)
    vn = np.zeros_like(V)
    for k in range(3):
        np.add.at(vn, F[:, k], fn)
    return vn / (np.linalg.norm(vn, axis=1, keepdims=True) + 1e-12)


def unit(v: np.ndarray) -> np.ndarray:
    return v / (np.linalg.norm(v, axis=-1, keepdims=True) + 1e-12)


VIEWER_ARM_REST_ANGLE = 1.15  # CharacterViewer.tsx ARM_REST_ANGLE

# ---------------------------------------------------------------------------
# Body: skeleton, skin weights, posing and linear blend skinning
# ---------------------------------------------------------------------------

class Body:
    def __init__(self, path: str, morph: float = 0.0):
        """morph: influence of the body's 'fat' morph target (0 = normal, 1 = fat)."""
        g = pygltflib.GLTF2().load(path)
        blob = g.binary_blob()
        self.path = path
        self.gltf = g
        skin = g.skins[0]
        self.joint_nodes = list(skin.joints)
        self.joint_names = [g.nodes[j].name for j in self.joint_nodes]
        self.ibm_raw = read_accessor(g, blob, skin.inverseBindMatrices).astype(np.float32)
        self.ibm = self.ibm_raw.reshape(-1, 4, 4).transpose(0, 2, 1).astype(float)
        self.node_index = {n.name: i for i, n in enumerate(g.nodes)}
        self.joint_index = {n: k for k, n in enumerate(self.joint_names)}

        # Main body surface = skinned primitive with the most vertices (skip eyes/brows).
        best = None
        for n in g.nodes:
            if n.mesh is None or n.skin is None:
                continue
            for pr in g.meshes[n.mesh].primitives:
                if best is None or g.accessors[pr.attributes.POSITION].count > g.accessors[best.attributes.POSITION].count:
                    best = pr
        P = read_accessor(g, blob, best.attributes.POSITION).astype(float)
        F = read_accessor(g, blob, best.indices).reshape(-1, 3).astype(np.int64)
        J = read_accessor(g, blob, best.attributes.JOINTS_0).astype(np.int64)
        W = read_accessor(g, blob, best.attributes.WEIGHTS_0).astype(float)
        # Weld UV seams so normals/weights are continuous across them.
        labels = weld(P)
        _, first = np.unique(labels, return_index=True)
        remap = np.empty(labels.max() + 1, np.int64)
        remap[labels[first]] = np.arange(len(first))
        self.morph = morph
        self.V = P[first] + morph * read_morph(g, blob, best)[first]
        self.F = remap[labels[F]]
        self.F = self.F[(self.F[:, 0] != self.F[:, 1]) & (self.F[:, 1] != self.F[:, 2]) & (self.F[:, 0] != self.F[:, 2])]
        self.J = J[first]
        self.W = W[first] / W[first].sum(1, keepdims=True)
        nj = len(self.joint_names)
        self.Wdense = np.zeros((len(self.V), nj))
        for k in range(4):
            np.add.at(self.Wdense, (np.arange(len(self.V)), self.J[:, k]), self.W[:, k])
        self.dominant = self.Wdense.argmax(1)

    # -- landmarks ---------------------------------------------------------
    def joint_pos(self, name: str, worlds: dict | None = None) -> np.ndarray:
        worlds = worlds or node_worlds(self.gltf)
        return worlds[self.node_index[name]][:3, 3]

    def landmark_y(self, name: str, V: np.ndarray | None = None, worlds: dict | None = None) -> float:
        V = self.V if V is None else V
        if name == 'ground':
            return float(V[:, 1].min())
        if name == 'head_top':
            return float(V[self.dominant == self.joint_index['Head'], 1].max())
        return float(self.joint_pos(name, worlds)[1])

    def region_mask(self, bones: list[str]) -> np.ndarray:
        ids = [self.joint_index[b] for b in bones]
        return self.Wdense[:, ids].sum(1) > 0.5

    # -- posing --------------------------------------------------------------
    def pose_overrides(self, pose: dict) -> dict[int, np.ndarray]:
        """Local-matrix overrides for a simple symmetric pose.

        arms: swing both upper arms down from the T-pose by this many radians,
              about each upper arm's LOCAL Z axis — identical to
              CharacterViewer.poseArmsToRest (incl. its per-arm sign check).
        legs: spread both thighs outward (about world Z through the hip) in radians.
        """
        g = self.gltf
        over: dict[int, np.ndarray] = {}
        rest = node_worlds(g)
        arms = pose.get('arms', 0.0)
        if arms:
            for upper, hand in (('upperarm_l', 'hand_l'), ('upperarm_r', 'hand_r')):
                ni, hi = self.node_index[upper], self.node_index[hand]
                base = node_local(g.nodes[ni])
                for sgn in (-1.0, 1.0):
                    over[ni] = base @ axis_angle([0, 0, 1], sgn * arms)
                    if node_worlds(g, over)[hi][1, 3] < rest[hi][1, 3]:
                        break
        legs = pose.get('legs', 0.0)
        if legs:
            for thigh, foot in (('thigh_l', 'foot_l'), ('thigh_r', 'foot_r')):
                ni, fi = self.node_index[thigh], self.node_index[foot]
                parent = next(i for i, n in enumerate(g.nodes) if ni in (n.children or []))
                for sgn in (-1.0, 1.0):
                    cur = node_worlds(g, over)
                    p = cur[ni][:3, 3]
                    T = np.eye(4); T[:3, 3] = p
                    Ti = np.eye(4); Ti[:3, 3] = -p
                    new_world = T @ axis_angle([0, 0, 1], sgn * legs) @ Ti @ cur[ni]
                    trial = dict(over)
                    trial[ni] = np.linalg.inv(cur[parent]) @ new_world
                    if abs(node_worlds(g, trial)[fi][0, 3]) > abs(rest[fi][0, 3]):
                        over = trial
                        break
        return over

    def skin_matrices(self, pose: dict | None = None) -> np.ndarray:
        worlds = node_worlds(self.gltf, self.pose_overrides(pose or {}))
        jw = np.array([worlds[j] for j in self.joint_nodes])
        return np.einsum('nij,njk->nik', jw, self.ibm)

    def posed(self, pose: dict | None = None):
        mats = self.skin_matrices(pose)
        V = lbs(mats, self.V, self.J, self.W)
        return V, mats


def load_skinned_garment(path: str, morph: float = 0.0) -> dict:
    g = pygltflib.GLTF2().load(path)
    blob = g.binary_blob()
    pr = g.meshes[0].primitives[0]
    a = pr.attributes
    return dict(
        gltf=g,
        P=read_accessor(g, blob, a.POSITION).astype(float) + morph * read_morph(g, blob, pr),
        J=read_accessor(g, blob, a.JOINTS_0).astype(np.int64),
        W=read_accessor(g, blob, a.WEIGHTS_0).astype(float),
        F=read_accessor(g, blob, pr.indices).reshape(-1, 3).astype(np.int64),
        ibm=read_accessor(g, blob, g.skins[0].inverseBindMatrices),
        joints=[g.nodes[j].name for j in g.skins[0].joints],
    )


def skin_samples(V: np.ndarray, F: np.ndarray, vn: np.ndarray, vmask: np.ndarray):
    """Skin points (vertices + centres of faces fully inside `vmask`) and normals."""
    fmask = vmask[F].all(1)
    C = V[F[fmask]].mean(1)
    NC = unit(face_normals(V, F[fmask]))
    return np.vstack([V[vmask], C]), np.vstack([vn[vmask], NC])


def blend_matrices(mats: np.ndarray, J: np.ndarray, W: np.ndarray) -> np.ndarray:
    return np.einsum('nk,nkij->nij', W, mats[J])


def lbs(mats: np.ndarray, V: np.ndarray, J: np.ndarray, W: np.ndarray) -> np.ndarray:
    A = blend_matrices(mats, J, W)
    return np.einsum('nij,nj->ni', A[:, :3, :3], V) + A[:, :3, 3]


def inverse_lbs(mats: np.ndarray, V: np.ndarray, J: np.ndarray, W: np.ndarray) -> np.ndarray:
    A = blend_matrices(mats, J, W)
    Ainv = np.linalg.inv(A)
    return np.einsum('nij,nj->ni', Ainv[:, :3, :3], V) + Ainv[:, :3, 3]


class Surface:
    """Closest-point queries against a (posed) triangle mesh with smooth normals."""

    def __init__(self, V: np.ndarray, F: np.ndarray):
        self.V, self.F = V, F
        self.mesh = trimesh.Trimesh(V, F, process=False)
        self.vn = vertex_normals(V, F)
        self.tree = cKDTree(V)

    def closest(self, P: np.ndarray):
        cp, dist, tri = trimesh.proximity.closest_point(self.mesh, P)
        bary = trimesh.triangles.points_to_barycentric(self.mesh.triangles[tri], cp)
        bary = np.clip(bary, 0, 1)
        bary /= bary.sum(1, keepdims=True)
        corners = self.F[tri]
        n = unit(np.einsum('nk,nkj->nj', bary, self.vn[corners]))
        sd = np.einsum('ij,ij->i', P - cp, n)
        return cp, n, sd, corners, bary


# ---------------------------------------------------------------------------
# Garment: raw mesh loading & clean-up
# ---------------------------------------------------------------------------

@dataclass
class GarmentMesh:
    P: np.ndarray          # (n,3) positions (render vertices)
    UV: np.ndarray         # (n,2)
    F: np.ndarray          # (m,3) render faces
    weld: np.ndarray = field(default=None)  # (n,) welded id per render vertex
    part: np.ndarray = field(default=None)  # (n,) connected component per render vertex

    def rebuild_topology(self):
        self.weld = weld(self.P)
        wf = self.weld[self.F]
        n = self.weld.max() + 1
        rows = np.concatenate([wf[:, 0], wf[:, 1], wf[:, 2]])
        cols = np.concatenate([wf[:, 1], wf[:, 2], wf[:, 0]])
        adj = sparse.coo_matrix((np.ones(len(rows)), (rows, cols)), shape=(n, n)).tocsr()
        adj = ((adj + adj.T) > 0).astype(float)
        self.adj = adj
        _, comp = connected_components(adj, directed=False)
        self.part = comp[self.weld]
        _, first = np.unique(self.weld, return_index=True)
        self.first = first  # one render vertex per welded id

    @property
    def Pw(self) -> np.ndarray:
        return self.P[self.first]

    def set_welded_positions(self, Pw: np.ndarray):
        self.P = Pw[self.weld].copy()

    @property
    def Fw(self) -> np.ndarray:
        return self.weld[self.F]


def load_raw_garment(path: str) -> GarmentMesh:
    g = pygltflib.GLTF2().load(path)
    blob = g.binary_blob()
    worlds = node_worlds(g)
    Ps, UVs, Fs, off = [], [], [], 0
    for i, n in enumerate(g.nodes):
        if n.mesh is None:
            continue
        M = worlds[i]
        for pr in g.meshes[n.mesh].primitives:
            P = read_accessor(g, blob, pr.attributes.POSITION).astype(float)
            uv = read_accessor(g, blob, pr.attributes.TEXCOORD_0).astype(float) if pr.attributes.TEXCOORD_0 is not None else np.zeros((len(P), 2))
            F = read_accessor(g, blob, pr.indices).reshape(-1, 3).astype(np.int64)
            Ps.append(P @ M[:3, :3].T + M[:3, 3])
            UVs.append(uv)
            Fs.append(F + off)
            off += len(P)
    gm = GarmentMesh(np.concatenate(Ps), np.concatenate(UVs), np.concatenate(Fs))
    gm.rebuild_topology()
    return gm


def subdivide_midpoint(gm: GarmentMesh) -> GarmentMesh:
    F = gm.F
    edges = np.sort(np.stack([F[:, [0, 1]], F[:, [1, 2]], F[:, [2, 0]]], 1).reshape(-1, 2), axis=1)
    uniq, inv = np.unique(edges, axis=0, return_inverse=True)
    mid = len(gm.P) + np.arange(len(uniq))
    P = np.vstack([gm.P, (gm.P[uniq[:, 0]] + gm.P[uniq[:, 1]]) / 2])
    UV = np.vstack([gm.UV, (gm.UV[uniq[:, 0]] + gm.UV[uniq[:, 1]]) / 2])
    m = mid[inv.reshape(-1)].reshape(-1, 3)
    a, b, c = F.T
    m01, m12, m20 = m.T
    F2 = np.concatenate([np.stack([a, m01, m20], 1), np.stack([m01, b, m12], 1),
                         np.stack([m20, m12, c], 1), np.stack([m01, m12, m20], 1)])
    out = GarmentMesh(P, UV, F2)
    out.rebuild_topology()
    return out


def laplacian_step(gm: GarmentMesh, Pw: np.ndarray, factor: float) -> np.ndarray:
    deg = np.asarray(gm.adj.sum(1)).ravel()
    avg = (gm.adj @ Pw) / np.maximum(deg, 1)[:, None]
    return Pw + factor * (avg - Pw)


def taubin_smooth(gm: GarmentMesh, iterations: int, lam: float = 0.5, mu: float = -0.53):
    Pw = gm.Pw
    for _ in range(iterations):
        Pw = laplacian_step(gm, Pw, lam)
        Pw = laplacian_step(gm, Pw, mu)
    gm.set_welded_positions(Pw)


def spatial_smooth(values: np.ndarray, points: np.ndarray, radius: float, tree: cKDTree | None = None) -> np.ndarray:
    """Gaussian-weighted average of per-point values over a 3D neighbourhood.

    Spatial (not graph) smoothing keeps the inner and outer layers of a
    thick cloth shell moving together even though they are not connected.
    """
    tree = tree or cKDTree(points)
    sigma = radius / 2.0
    nbrs = tree.query_ball_point(points, radius)
    out = np.empty_like(values)
    for i, nb in enumerate(nbrs):
        d2 = ((points[nb] - points[i]) ** 2).sum(1)
        w = np.exp(-d2 / (2 * sigma * sigma))
        out[i] = (w[:, None] * values[nb]).sum(0) / w.sum()
    return out


# ---------------------------------------------------------------------------
# Fitting
# ---------------------------------------------------------------------------

@dataclass
class FitResult:
    params: dict
    pose: dict
    cost: float


class Fitter:
    def __init__(self, body: Body, gm: GarmentMesh, cfg: dict, log=print):
        self.body, self.gm, self.cfg, self.log = body, gm, cfg, log
        self.target = cfg.get('target_offset', 0.012)
        self.min_off = cfg.get('min_offset', 0.006)
        self._pose_cache: dict = {}
        # Garments this one is worn over (already fitted skinned GLBs).
        self.under = [load_skinned_garment(p, body.morph) for p in cfg.get('_over_paths', [])]
        self.extra = self._under_thickness() if cfg.get('under_as_thickness') else np.zeros(len(body.V))

    def _under_thickness(self) -> np.ndarray:
        """Per skin vertex: how far under-layers (hair) stick out along its normal.

        Hair is made of open cards, so instead of colliding with it as a surface
        it is turned into extra thickness on the scalp; the item is then fitted to
        skin + hair as one volume.
        """
        V, vn = self.body.V, vertex_normals(self.body.V, self.body.F)
        extra = np.zeros(len(V))
        bones = self.cfg.get('region_bones')
        idx = np.nonzero(self.body.region_mask(bones))[0] if bones else np.arange(len(V))
        mats = self.body.skin_matrices({})
        for u in self.under:
            P = lbs(mats, u['P'], u['J'], u['W'])
            pts, _ = skin_samples(P, u['F'], vertex_normals(P, u['F']), np.ones(len(P), bool))
            tree = cKDTree(pts)
            for i, nb in zip(idx, tree.query_ball_point(V[idx], 0.06)):
                if not nb:
                    continue
                d = pts[nb] - V[i]
                h = d @ vn[i]
                lateral = np.linalg.norm(d - h[:, None] * vn[i], axis=1)
                ok = lateral < 0.02
                if ok.any():
                    extra[i] = max(extra[i], h[ok].max())
        # hair squashes a little under a hat
        extra = np.maximum(extra, 0.0) * self.cfg.get('under_compress', 1.0)
        if extra.any():
            extra[extra > 0] += self.cfg.get('layer_gap', 0.006)
        return extra

    def under_surfaces(self, pose: dict, Vb: np.ndarray):
        out = []
        if not self.under:
            return out
        mats = self.body.skin_matrices(pose)
        body_surf = Surface(Vb, self.body.F)
        for u in self.under:
            P = lbs(mats, u['P'], u['J'], u['W'])
            surf = Surface(P, u['F'])
            cpb, _, _, _, _ = body_surf.closest(P)
            sign = 1.0 if np.mean(np.einsum('ij,ij->i', surf.vn, P - cpb) > 0) >= 0.5 else -1.0
            out.append((surf, sign))
        return out

    # -- coarse similarity / anisotropic fit ----------------------------------
    def _posed_surface_points(self, pose: dict):
        key = tuple(sorted((k, round(v, 4)) for k, v in pose.items()))
        if key not in self._pose_cache:
            V, _ = self.body.posed(pose)
            self._pose_cache[key] = (V, vertex_normals(V, self.body.F), cKDTree(V))
        return self._pose_cache[key]

    @staticmethod
    def apply(P: np.ndarray, center: np.ndarray, s: float, ax: float, az: float, t: np.ndarray, ay: float = 1.0) -> np.ndarray:
        return (P - center) * (s * np.array([ax, ay, az])) + center + t

    def _anchor_terms(self, Pt: np.ndarray, Vb: np.ndarray, worlds) -> float:
        cost = 0.0
        for side, spec in (self.cfg.get('anchors') or {}).items():
            name, offset = spec[0], spec[1]
            target = self.body.landmark_y(name, Vb, worlds) + offset
            y = np.percentile(Pt[:, 1], 99.5) if side == 'top' else np.percentile(Pt[:, 1], 0.5)
            cost += 50.0 * (y - target) ** 2
        return cost

    def coarse_fit(self, part_mask: np.ndarray | None = None) -> FitResult:
        cfg = self.cfg
        Pw = self.gm.Pw
        sel = np.ones(len(Pw), bool) if part_mask is None else part_mask
        P = Pw[sel]
        rng = np.random.default_rng(0)
        sample = P[rng.choice(len(P), min(len(P), 1500), replace=False)]
        center = P.mean(0)

        pose_keys = list((cfg.get('pose') or {}).keys())
        pose_bounds = [tuple(cfg['pose'][k]) for k in pose_keys]
        init = cfg.get('init', {})

        # Initial scale/offset from the body region this part should cover.
        region = cfg.get('init_bones') or cfg.get('region_bones')
        pose0 = {k: (lo + hi) / 2 for k, (lo, hi) in zip(pose_keys, pose_bounds)}
        Vb0, _, _ = self._posed_surface_points(pose0)
        if region:
            rmask = self.body.region_mask(region)
            if part_mask is not None and cfg.get('per_part'):
                # pick the side (left/right) that this part sits on
                side = np.sign(center[0]) or 1.0
                rmask &= np.sign(Vb0[:, 0]) == side
            R = Vb0[rmask]
            axis = {'x': 0, 'y': 1, 'z': 2}[cfg.get('init_axis', 'x')]
            ext_r = np.ptp(R[:, axis]); ext_g = np.ptp(P[:, axis])
            s0 = init.get('scale', ext_r / ext_g * cfg.get('init_ease', 1.1))
            t0 = (R.min(0) + R.max(0)) / 2 - center
        else:
            s0, t0 = init.get('scale', 1.0), np.zeros(3)
        t0 = t0 + np.array(init.get('offset', [0, 0, 0]))

        # Mild inside penalty: the coarse stage picks the best overall size; local
        # penetrations (e.g. a muscular arm in a slim sleeve) are fixed by collide().
        A_in = cfg.get('inside_weight', 5.0)
        cap = cfg.get('loose_cap', 0.08)
        aniso_reg = cfg.get('aniso_reg', 2.0)
        # Body -> garment coverage: body parts the garment should cover must not
        # end up far from it (stops the optimiser inflating an oversized garment).
        cover = cfg.get('cover_bones') or cfg.get('init_bones') or cfg.get('region_bones')
        cmask = self.body.region_mask(cover) if cover else None
        if cmask is not None and part_mask is not None and cfg.get('per_part'):
            cmask &= np.sign(Vb0[:, 0]) == (np.sign(center[0]) or 1.0)
        cover_w = cfg.get('cover_weight', 1.0)

        free_y = bool(cfg.get('aniso_y'))

        def unpack(x):
            s = math.exp(x[0]); t = x[1:4]; ax = math.exp(x[4]); az = math.exp(x[5])
            pose = {k: x[6 + i] for i, k in enumerate(pose_keys)}
            ay = math.exp(x[6 + len(pose_keys)]) if free_y else 1.0
            return s, t, ax, az, pose, ay

        def cost(x):
            s, t, ax, az, pose, ay = unpack(x)
            Vb, Nb, tree = self._posed_surface_points(pose)
            G = self.apply(sample, center, s, ax, az, t, ay)
            _, idx = tree.query(G)
            sd = np.einsum('ij,ij->i', G - Vb[idx], Nb[idx]) - self.extra[idx]
            inside = np.maximum(self.min_off - sd, 0)
            loose = np.minimum((sd - self.target) ** 2, cap ** 2)
            c = A_in * np.mean(inside ** 2) + np.mean(loose)
            if cmask is not None and cover_w:
                ylo, yhi = np.percentile(G[:, 1], [1, 99])
                Bc, Ec = Vb[cmask], self.extra[cmask]
                band = (Bc[:, 1] > ylo + 0.02) & (Bc[:, 1] < yhi - 0.02)
                Bc, Ec = Bc[band], Ec[band]
                if len(Bc):
                    dcov, _ = cKDTree(G).query(Bc)
                    c += cover_w * np.mean(np.minimum(np.maximum(dcov - Ec - (self.target + 0.01), 0) ** 2, cap ** 2))
            worlds = node_worlds(self.body.gltf, self.body.pose_overrides(pose))
            c += self._anchor_terms(G, Vb, worlds) * cfg.get('anchor_weight', 1.0) / 1000.0
            c += aniso_reg * 1e-3 * (x[4] ** 2 + x[5] ** 2 + (x[-1] ** 2 if free_y else 0.0))
            return c

        lim = cfg.get('aniso_limit', 0.25)
        bounds = [(math.log(s0) - 0.6, math.log(s0) + 0.6)] + [(t0[i] - 0.25, t0[i] + 0.25) for i in range(3)] + \
                 [(-lim, lim), (-lim, lim)] + pose_bounds + ([(-lim, lim)] if free_y else [])
        best = None
        # A couple of starting points for the pose angle(s) and scale.
        starts = []
        for pv in ([pose0] if not pose_keys else [{k: lo + f * (hi - lo) for k, (lo, hi) in zip(pose_keys, pose_bounds)} for f in (0.25, 0.5, 0.75)]):
            for sm in (0.9, 1.0, 1.1):
                starts.append(np.array([math.log(s0 * sm), *t0, 0.0, 0.0, *[pv[k] for k in pose_keys]] + ([0.0] if free_y else [])))
        for x0 in starts:
            x0 = np.clip(x0, [b[0] for b in bounds], [b[1] for b in bounds])
            r = minimize(cost, x0, method='Powell', bounds=bounds, options={'maxiter': 4000, 'xtol': 1e-4, 'ftol': 1e-7})
            if best is None or r.fun < best.fun:
                best = r
        s, t, ax, az, pose, ay = unpack(best.x)
        self.log(f"    coarse fit: scale={s:.3f} aniso=({ax:.3f},{ay:.3f},{az:.3f}) offset={np.round(t, 3)} pose={ {k: round(float(v), 3) for k, v in pose.items()} } cost={best.fun:.6f}")
        return FitResult({'s': s, 't': t, 'ax': ax, 'az': az, 'ay': ay, 'center': center}, pose, best.fun)

    # -- collision / drape pass ------------------------------------------------
    def collide(self, Pw: np.ndarray, pose: dict, iterations: int = 12) -> np.ndarray:
        """Push the cloth out of the body while keeping its local shape.

        Each round finds (a) cloth vertices inside / too close to the skin and
        (b) skin vertices poking through the cloth, turns them into positional
        targets, and solves a Laplacian least-squares problem
            min |L x - L x0|^2 + w_c |x_c - target|^2 + w_s |x - x_prev|^2
        so the correction spreads into a smooth bulge instead of spikes.
        """
        cfg = self.cfg
        Vb, _ = self.body.posed(pose)
        surf = Surface(Vb, self.body.F)
        Fw = self.gm.Fw
        L = uniform_laplacian(self.gm.adj)
        d0 = L @ Pw
        LtL = (L.T @ L).tocsr()
        unders = self.under_surfaces(pose, Vb)
        S, NS = self.cover_samples(Pw, Vb, surf, unders)
        depth = 0.02
        w_c, w_s = cfg.get('collide_weight', 20.0), cfg.get('collide_stay', 0.05)
        x = Pw.copy()
        # Active-set half-space constraints, re-targeted from the current shape every
        # round (stale absolute targets fight each other and pull spikes):
        #   cloth vertex v      : stays >= min offset outside the skin / under-layers
        #   skin sample k (tri, bary): that cloth point stays >= min offset above it
        vert_active: set[int] = set()
        poke_active: dict[int, tuple] = {}
        worlds = node_worlds(self.body.gltf, self.body.pose_overrides(pose))
        layer_gap = cfg.get('layer_gap', 0.006)
        req_v = None
        best = None
        max_push = cfg.get('max_push', 0.03)
        for it in range(iterations):
            cp, n, sd, _, _ = surf.closest(x)
            req_v = self.min_offset_at(x, Vb, worlds) + 0.001
            need = np.maximum(req_v - sd, 0.0)
            D = need[:, None] * n
            # Stay outside the garments this one is worn over (e.g. shirt over trousers).
            for usurf, sign in unders:
                ucp, un, usd, _, _ = usurf.closest(x)
                un, usd = un * sign, usd * sign
                near = np.linalg.norm(x - ucp, axis=1) < 0.05
                uneed = np.where(near, np.maximum(layer_gap - usd, 0.0), 0.0)
                bigger = uneed > np.linalg.norm(D, axis=1)
                D[bigger] = uneed[bigger, None] * un[bigger]
                need = np.maximum(need, uneed)
            vert_active.update(np.nonzero(need > 1e-6)[0].tolist())
            n_poke = 0
            if cfg.get('poke', True):
                gmesh = trimesh.Trimesh(x, Fw, process=False)
                origins = S - NS * depth
                loc, ri, ti = gmesh.ray.intersects_location(origins, NS, multiple_hits=False)
                if len(ri):
                    tdist = np.einsum('ij,ij->i', loc - origins[ri], NS[ri])
                    bad = (tdist < depth + self.min_off) & (tdist > -0.01)
                    # Only push cloth that actually covers this patch of skin (its own
                    # closest body point is nearby) — a ray from the arm must not shove
                    # the torso part of a shirt around, and vice versa.
                    bad &= np.linalg.norm(cp[Fw[ti]].mean(1) - S[ri], axis=1) < cfg.get('poke_reach', 0.04)
                    n_poke = int(bad.sum())
                    bary = trimesh.triangles.points_to_barycentric(gmesh.triangles[ti[bad]], loc[bad])
                    for r_i, t_i, b in zip(ri[bad], ti[bad], bary):
                        b = np.clip(b, 0, 1)
                        poke_active[int(r_i)] = (int(t_i), b / b.sum())
            score = int((need > 1e-6).sum()) + n_poke
            if best is None or score < best[0]:
                best = (score, x.copy())
            if it == 0 or it == iterations - 1:
                self.log(f"    collide iter {it}: cloth inside/too close={int((need > 1e-6).sum())}/{len(x)}, skin poking={n_poke}, min sd={sd.min()*1000:.1f}mm")
            if not vert_active and not poke_active:
                break
            rows, cols, vals, tgts = [], [], [], []
            for r, v in enumerate(sorted(vert_active)):
                rows.append(r); cols.append(v); vals.append(1.0); tgts.append(x[v] + D[v])
            base = len(tgts)
            r = 0
            for k, (t_i, b) in list(poke_active.items()):
                tri = Fw[t_i]
                q = b @ x[tri]
                push = max(self.min_off + 0.001 - np.dot(q - S[k], NS[k]), 0.0)
                if push > max_push:  # implausible match (e.g. ray grazed the far side)
                    del poke_active[k]
                    continue
                for j in range(3):
                    rows.append(base + r); cols.append(tri[j]); vals.append(b[j])
                tgts.append(q + push * NS[k])
                r += 1
            C = sparse.coo_matrix((vals, (rows, cols)), shape=(len(tgts), len(x))).tocsr()
            T = np.array(tgts)
            M = (LtL + w_c * (C.T @ C) + w_s * sparse.identity(len(x))).tocsc()
            rhs = L.T @ d0 + w_s * x + w_c * (C.T @ T)
            solve = sparse.linalg.factorized(M)
            x = np.stack([solve(rhs[:, k]) for k in range(3)], 1)
        # Final check: if the last rounds made things worse, keep the best round.
        if best is not None and best[0] < self._violations(x, surf, S, NS, Fw, depth):
            self.log(f"    collide: keeping best round (score {best[0]})")
            x = best[1]
        return x

    def cover_samples(self, Pw, Vb, surf, unders):
        """Points that must stay under the cloth, with their outward directions.

        Skin vertices and face centres of the covered region (a big skin triangle
        can bulge through between its corners), plus under-layers such as hair
        cards under a cap (their outward direction is the skin normal below them).
        """
        bones = self.cfg.get('region_bones')
        vmask = self.body.region_mask(bones) if bones else np.ones(len(Vb), bool)
        S, NS = skin_samples(Vb, self.body.F, surf.vn, vmask)
        near_cloth = cKDTree(Pw)
        if self.cfg.get('under_as_thickness'):
            unders = []  # already part of the skin as thickness
        for usurf, _ in unders:
            US, _ = skin_samples(usurf.V, usurf.F, usurf.vn, np.ones(len(usurf.V), bool))
            keep = near_cloth.query(US)[0] < 0.08
            if keep.any():
                _, un, _, _, _ = surf.closest(US[keep])
                S, NS = np.vstack([S, US[keep]]), np.vstack([NS, un])
        return S, NS

    def rigid_resolve(self, Pw: np.ndarray, pose: dict) -> np.ndarray:
        """Clear a rigid item (hat, helmet) by growing it, never by bending it.

        Grows width (x/z) and height (y) separately about the bottom-centre of the
        item, so its rim stays put, and picks the smallest growth that leaves
        nothing inside it (or the fewest contacts within the allowed range).
        """
        Vb, _ = self.body.posed(pose)
        surf = Surface(Vb, self.body.F)
        unders = self.under_surfaces(pose, Vb)
        S, NS = self.cover_samples(Pw, Vb, surf, unders)
        c = Pw.mean(0)
        c[1] = Pw[:, 1].min()  # nothing moves down (the brim stays above the eyes)
        tol = self.cfg.get('rigid_tolerance', 2)
        kmax = self.cfg.get('rigid_max_growth', 1.15)
        steps = np.arange(1.0, kmax + 1e-9, 0.02)
        best = None
        for kxz in steps:
            for ky in steps:
                size = (kxz - 1) ** 2 * 2 + (ky - 1) ** 2
                if best is not None and best[1] <= tol and size >= best[0]:
                    continue
                x = (Pw - c) * np.array([kxz, ky, kxz]) + c
                v = self._violations(x, surf, S, NS, self.gm.Fw, 0.02, margin=0.0)
                key = (v > tol, v if v > tol else 0, size)
                if best is None or key < best[2]:
                    best = (size, v, key, x, kxz, ky)
        self.log(f"    rigid resolve: grew width {best[4]:.2f}x height {best[5]:.2f}x, remaining contacts {best[1]}")
        return best[3]

    def _violations(self, x, surf, S, NS, Fw, depth, margin: float | None = None) -> int:
        margin = self.min_off if margin is None else margin
        _, _, sd, corners, _ = surf.closest(x)
        sd = sd - self.extra[corners].max(1)
        gmesh = trimesh.Trimesh(x, Fw, process=False)
        loc, ri, _ = gmesh.ray.intersects_location(S - NS * depth, NS, multiple_hits=False)
        t = np.einsum('ij,ij->i', loc - (S - NS * depth)[ri], NS[ri])
        return int((sd < margin).sum()) + int(((t < depth + margin) & (t > -0.01)).sum())

    def bridge(self, Pw: np.ndarray, pose: dict, iterations: int = 15) -> np.ndarray:
        """Let cloth span hollows instead of sinking into them (cleavage, armpits).

        Real fabric is pulled taut across a concave dip; skinned cloth just copies
        the skin. Each step moves a vertex towards its neighbours' average but
        only outward (along the skin normal), which fills dips and never pulls
        cloth into the body.
        """
        Vb, _ = self.body.posed(pose)
        surf = Surface(Vb, self.body.F)
        deg = np.maximum(np.asarray(self.gm.adj.sum(1)).ravel(), 1)
        x = Pw.copy()
        for _ in range(iterations):
            _, n, _, _, _ = surf.closest(x)
            disp = (self.gm.adj @ x) / deg[:, None] - x
            out = np.maximum(np.einsum('ij,ij->i', disp, n), 0.0)
            x = x + 0.6 * out[:, None] * n
        return x

    def inflate(self, Pw: np.ndarray, pose: dict, rounds: int = 4) -> np.ndarray:
        """Broad, smooth inflation where whole regions are too tight.

        A slim sleeve over a muscular arm needs several centimetres of room; doing
        that with local collision pulls a spike where the sleeve meets the torso.
        Spreading the needed push over a wide neighbourhood first makes the whole
        sleeve swell evenly; collide() then fixes what is left locally.
        """
        radius = self.cfg.get('inflate_radius', 0.06)
        if not radius:
            return Pw
        Vb, _ = self.body.posed(pose)
        surf = Surface(Vb, self.body.F)
        worlds = node_worlds(self.body.gltf, self.body.pose_overrides(pose))
        x = Pw.copy()
        for _ in range(rounds):
            _, n, sd, _, _ = surf.closest(x)
            need = np.maximum(self.min_offset_at(x, Vb, worlds) - sd, 0.0)
            if need.max() < 0.003:
                break
            Ds = spatial_smooth(need[:, None] * n, x, radius)
            x = x + 1.5 * Ds
        return x

    def min_offset_at(self, x: np.ndarray, Vb: np.ndarray, worlds) -> np.ndarray:
        """Per-vertex minimum cloth-skin gap.

        `min_offset_zones` lets an outer layer keep extra room where it overlaps
        an inner one, e.g. a shirt hem below the waist stays outside the trousers:
            {"below": ["pelvis", 0.10], "min_offset": 0.016}
        """
        m = np.full(len(x), self.min_off)
        if self.extra.any():
            _, nearest = cKDTree(Vb).query(x)
            m = m + self.extra[nearest]
        for z in self.cfg.get('min_offset_zones', []):
            name, off = z['below']
            y0 = self.body.landmark_y(name, Vb, worlds) + off
            blend = np.clip((y0 - x[:, 1]) / 0.04 + 0.5, 0, 1)  # 4cm soft edge
            m = np.maximum(m, self.min_off + blend * (z['min_offset'] - self.min_off))
        return m

    def tighten(self, Pw: np.ndarray, pose: dict) -> np.ndarray:
        """Optionally pull very loose areas towards the body (cfg.tighten)."""
        t = self.cfg.get('tighten')
        if not t:
            return Pw
        Vb, _ = self.body.posed(pose)
        surf = Surface(Vb, self.body.F)
        cp, n, sd, _, _ = surf.closest(Pw)
        excess = np.maximum(sd - t['max_offset'], 0.0)
        excess = np.where(sd < t.get('ignore_beyond', 0.12), excess, 0.0)
        D = -(excess * t.get('strength', 0.6))[:, None] * n
        D = spatial_smooth(D, Pw, self.cfg.get('smooth_radius', 0.03))
        return Pw + D


def uniform_laplacian(adj: sparse.csr_matrix) -> sparse.csr_matrix:
    deg = np.asarray(adj.sum(1)).ravel()
    Dinv = sparse.diags(1.0 / np.maximum(deg, 1))
    return (sparse.identity(adj.shape[0]) - Dinv @ adj).tocsr()


def nearest_rotations(A: np.ndarray) -> np.ndarray:
    U, _, Vt = np.linalg.svd(A)
    R = U @ Vt
    flip = np.linalg.det(R) < 0
    U[flip, :, -1] *= -1
    return U @ Vt


def relax_after_pose(gm: GarmentMesh, P_src: np.ndarray, A_src: np.ndarray, P_dst_lbs: np.ndarray,
                     A_dst: np.ndarray, stiffness: float = 0.15) -> np.ndarray:
    """Re-pose a garment while keeping its local cloth shape.

    LBS alone crushes cloth wherever bone influences blend (armpits, crotch) and
    leaves crumpled spikes. Here each vertex's Laplacian (local shape) from the
    source pose is rotated by that vertex's skinning rotation and the positions are
    solved in least squares, softly pinned to the LBS result:
        min |L x - R d|^2 + stiffness |x - x_lbs|^2
    """
    L = uniform_laplacian(gm.adj)
    d = L @ P_src
    B = np.einsum('nij,njk->nik', A_dst[:, :3, :3], np.linalg.inv(A_src[:, :3, :3]))
    R = nearest_rotations(B)
    d_rot = np.einsum('nij,nj->ni', R, d)
    M = (L.T @ L + stiffness * sparse.identity(L.shape[0])).tocsc()
    rhs = L.T @ d_rot + stiffness * P_dst_lbs
    solve = sparse.linalg.factorized(M)
    return np.stack([solve(rhs[:, k]) for k in range(3)], 1)


def _hemisphere_dirs(n: np.ndarray, k: int = 24) -> np.ndarray:
    """k deterministic unit directions in the hemisphere around each normal."""
    golden = math.pi * (3 - math.sqrt(5))
    i = np.arange(k) + 0.5
    z = i / k  # cos(theta) in (0,1]
    r = np.sqrt(1 - z * z)
    phi = golden * np.arange(k)
    local = np.stack([r * np.cos(phi), r * np.sin(phi), z], 1)
    # orthonormal basis per normal
    a = np.where(np.abs(n[:, :1]) < 0.9, np.array([[1.0, 0, 0]]), np.array([[0, 1.0, 0]]))
    t = unit(np.cross(n, a))
    b = np.cross(n, t)
    return local[None, :, 0:1] * t[:, None] + local[None, :, 1:2] * b[:, None] + local[None, :, 2:3] * n[:, None]


def drop_inner_layer(gm: GarmentMesh, max_thickness: float = 0.006, log=print) -> GarmentMesh:
    """Turn a thick closed cloth shell into a single outer layer.

    Downloaded clothes are often modelled with a few millimetres of thickness.
    The inner layer is invisible (the material is double-sided) but it makes
    collision and weighting fight with itself. Run on the raw mesh: a face is
    inner when another layer sits right behind it and it is more enclosed
    (its hemisphere of rays hits the garment more often) than that layer.
    """
    Pw, Fw = gm.Pw, gm.Fw
    tm = trimesh.Trimesh(Pw, Fw, process=False)
    c = tm.triangles_center
    n = unit(face_normals(Pw, Fw))
    loc, ri, ti = tm.ray.intersects_location(c - n * 1e-5, -n, multiple_hits=False)
    if not len(ri):
        return gm
    close = np.linalg.norm(loc - c[ri], axis=1) < max_thickness
    f_has, partner = ri[close], ti[close]
    if len(f_has) < 0.5 * len(Fw):
        return gm  # not a thick shell
    k = 24
    dirs = _hemisphere_dirs(n, k).reshape(-1, 3)
    origins = np.repeat(c + n * 1e-4, k, axis=0)
    hit = tm.ray.intersects_any(origins, dirs).reshape(-1, k).mean(1)
    inner = np.zeros(len(Fw), bool)
    inner[f_has[hit[f_has] > hit[partner]]] = True
    # neighbour vote to remove isolated mistakes (faces sharing a welded vertex)
    vf = sparse.coo_matrix((np.ones(Fw.size), (np.repeat(np.arange(len(Fw)), 3), Fw.ravel()))).tocsr()
    ff = (vf @ vf.T).tocsr()
    has = np.zeros(len(Fw), bool); has[f_has] = True
    for _ in range(3):
        votes = ff @ inner.astype(float)
        total = ff @ has.astype(float)
        inner = has & (votes > 0.5 * total)
    keep = ~inner
    F = gm.F[keep]
    used = np.unique(F)
    remap = -np.ones(len(gm.P), np.int64)
    remap[used] = np.arange(len(used))
    out = GarmentMesh(gm.P[used], gm.UV[used], remap[F])
    out.rebuild_topology()
    log(f"    dropped inner cloth layer: {inner.sum()} of {len(Fw)} faces")
    return out


# ---------------------------------------------------------------------------
# Skin weights
# ---------------------------------------------------------------------------

def transfer_weights(body: Body, Vb_posed: np.ndarray, Pw: np.ndarray, cfg: dict, Fw: np.ndarray | None = None) -> np.ndarray:
    nj = len(body.joint_names)
    if cfg.get('rigid_bone'):
        W = np.zeros((len(Pw), nj))
        W[:, body.joint_index[cfg['rigid_bone']]] = 1.0
        return W
    surf = Surface(Vb_posed, body.F)
    cp, nb, sd, corners, bary = surf.closest(Pw)
    W = np.einsum('nk,nkj->nj', bary, body.Wdense[corners])
    # Robust transfer: only trust a match when the cloth faces the same way as the
    # skin it copies from. This stops e.g. the underside of a sleeve (facing the
    # ribs) from copying spine weights; such vertices take the weights of the
    # nearest trusted cloth vertex instead (the inner layer of a thick shell
    # copies its outer layer the same way).
    if Fw is not None:
        ng = vertex_normals(Pw, Fw)
        vol = trimesh.Trimesh(Pw, Fw, process=False).volume
        if not (cfg.get('closed_shell') or abs(vol) > 1e-6 and trimesh.Trimesh(Pw, Fw, process=False).is_watertight):
            # open single-layer surface: orient normals away from the body by majority vote
            if np.mean(np.einsum('ij,ij->i', ng, Pw - cp) > 0) < 0.5:
                ng = -ng
        elif vol < 0:
            ng = -ng
        cos_ok = math.cos(math.radians(cfg.get('match_angle', 60)))
        trusted = (np.einsum('ij,ij->i', ng, nb) > cos_ok) & (np.linalg.norm(Pw - cp, axis=1) < cfg.get('match_dist', 0.12))
        if trusted.sum() > 0.2 * len(Pw):
            _, nn = cKDTree(Pw[trusted]).query(Pw[~trusted])
            W[~trusted] = W[trusted][nn]
    for _ in range(cfg.get('weight_smooth_iters', 2)):
        W = spatial_smooth(W, Pw, cfg.get('weight_smooth_radius', 0.02))
    return W


def top4(W: np.ndarray):
    idx = np.argsort(-W, axis=1)[:, :4]
    w = np.take_along_axis(W, idx, 1)
    w = np.maximum(w, 0)
    w[w < 1e-3] = 0
    w /= w.sum(1, keepdims=True)
    order = np.argsort(-w, axis=1)
    return np.take_along_axis(idx, order, 1), np.take_along_axis(w, order, 1)


# ---------------------------------------------------------------------------
# Render mesh (normals) + GLB export
# ---------------------------------------------------------------------------

def build_render_mesh(gm: GarmentMesh, Pw: np.ndarray, J: np.ndarray, W: np.ndarray, crease_deg: float):
    """Split vertices by (welded id, uv, smoothed normal) with an auto-smooth crease angle."""
    Fw = gm.Fw
    fn = face_normals(Pw, Fw)
    fnu = unit(fn)
    cos_c = math.cos(math.radians(crease_deg))
    # faces around each welded vertex
    nverts = len(Pw)
    v2f = [[] for _ in range(nverts)]
    for f, tri in enumerate(Fw):
        for v in tri:
            v2f[v].append(f)
    corner_n = np.zeros((len(Fw), 3, 3))
    for f, tri in enumerate(Fw):
        for k, v in enumerate(tri):
            fs = v2f[v]
            ok = [o for o in fs if np.dot(fnu[o], fnu[f]) >= cos_c]
            corner_n[f, k] = unit(fn[ok].sum(0))
    uv_c = gm.UV[gm.F]
    key = np.concatenate([Fw.reshape(-1, 1).astype(float),
                          np.round(uv_c.reshape(-1, 2) * 1e5),
                          np.round(corner_n.reshape(-1, 3) * 1e3)], 1)
    uniq, first, inv = np.unique(key, axis=0, return_index=True, return_inverse=True)
    wid = Fw.reshape(-1)[first]
    P = Pw[wid]
    N = corner_n.reshape(-1, 3)[first]
    UV = uv_c.reshape(-1, 2)[first]
    F = inv.reshape(-1, 3)
    return P, N, UV, F, J[wid], W[wid]


def _pad4(b: bytes) -> bytes:
    return b + b'\x00' * ((4 - len(b) % 4) % 4)


def export_skinned_glb(path: str, body: Body, name: str, P, N, UV, F, J, W, color, roughness=0.85):
    src = body.gltf
    keep = [i for i, n in enumerate(src.nodes) if n.mesh is None]
    remap = {old: new for new, old in enumerate(keep)}
    nodes = []
    for old in keep:
        n = src.nodes[old]
        nodes.append(pygltflib.Node(
            name=n.name, translation=n.translation, rotation=n.rotation, scale=n.scale, matrix=n.matrix,
            children=[remap[c] for c in (n.children or []) if c in remap] or None))
    mesh_node = len(nodes)
    nodes.append(pygltflib.Node(name=name, mesh=0, skin=0))
    roots = [remap[r] for r in src.scenes[src.scene or 0].nodes if r in remap]
    root = roots[0]
    nodes[root].children = (nodes[root].children or []) + [mesh_node]

    blob = b''
    views, accessors = [], []

    def add(arr: np.ndarray, comp: int, typ: str, target=None, minmax=False):
        nonlocal blob
        data = _pad4(arr.tobytes())
        views.append(pygltflib.BufferView(buffer=0, byteOffset=len(blob), byteLength=arr.nbytes, target=target))
        blob += data
        acc = pygltflib.Accessor(bufferView=len(views) - 1, componentType=comp, count=len(arr), type=typ)
        if minmax:
            acc.min = arr.min(0).astype(float).tolist()
            acc.max = arr.max(0).astype(float).tolist()
        accessors.append(acc)
        return len(accessors) - 1

    F32, U16, U8, U32 = 5126, 5123, 5121, 5125
    a_pos = add(P.astype(np.float32), F32, 'VEC3', 34962, minmax=True)
    a_nrm = add(unit(N).astype(np.float32), F32, 'VEC3', 34962)
    a_uv = add(UV.astype(np.float32), F32, 'VEC2', 34962)
    a_j = add(J.astype(np.uint8 if J.max() < 256 else np.uint16), U8 if J.max() < 256 else U16, 'VEC4', 34962)
    a_w = add(W.astype(np.float32), F32, 'VEC4', 34962)
    idx_dtype, idx_comp = (np.uint16, U16) if len(P) < 65536 else (np.uint32, U32)
    a_idx = add(F.reshape(-1).astype(idx_dtype), idx_comp, 'SCALAR', 34963)
    a_ibm = add(body.ibm_raw.astype(np.float32), F32, 'MAT4')

    skin = pygltflib.Skin(joints=[remap[j] for j in body.joint_nodes], inverseBindMatrices=a_ibm)
    mat = pygltflib.Material(
        name=f'MI_{name}', doubleSided=True,
        pbrMetallicRoughness=pygltflib.PbrMetallicRoughness(baseColorFactor=list(color) + [1.0][:4 - len(color)], metallicFactor=0.0, roughnessFactor=roughness))
    prim = pygltflib.Primitive(attributes=pygltflib.Attributes(POSITION=a_pos, NORMAL=a_nrm, TEXCOORD_0=a_uv, JOINTS_0=a_j, WEIGHTS_0=a_w), indices=a_idx, material=0)
    out = pygltflib.GLTF2(
        asset=pygltflib.Asset(version='2.0', generator='Gangs-Online paperdoll fitter'),
        scene=0, scenes=[pygltflib.Scene(nodes=roots)], nodes=nodes,
        meshes=[pygltflib.Mesh(name=name, primitives=[prim])], skins=[skin], materials=[mat],
        accessors=accessors, bufferViews=views, buffers=[pygltflib.Buffer(byteLength=len(blob))])
    out.set_binary_blob(blob)
    out.save_binary(path)


# ---------------------------------------------------------------------------
# Orchestration
# ---------------------------------------------------------------------------

def prepare_garment(raw_path: str, cfg: dict) -> GarmentMesh:
    gm = load_raw_garment(raw_path)
    yaw = cfg.get('yaw', 0)
    if yaw:
        R = axis_angle([0, 1, 0], math.radians(yaw))[:3, :3]
        # per_part items (a pair of shoes) turn each piece in place so the left
        # shoe stays on the left foot.
        groups = [gm.part == p for p in np.unique(gm.part)] if cfg.get('per_part') else [np.ones(len(gm.P), bool)]
        for m in groups:
            c = gm.P[m].mean(0)
            gm.P[m] = (gm.P[m] - c) @ R.T + c
        gm.rebuild_topology()
    if cfg.get('drop_inner_layer', True):
        gm = drop_inner_layer(gm)
    for _ in range(cfg.get('subdivide', 0)):
        gm = subdivide_midpoint(gm)
    if cfg.get('taubin', 0):
        taubin_smooth(gm, cfg['taubin'])
    return gm


def fit_garment(body: Body, raw_path: str, cfg: dict, out_path: str, log=print) -> dict:
    gm = prepare_garment(raw_path, cfg)
    fitter = Fitter(body, gm, cfg, log)
    Pw = gm.Pw.copy()
    welded_part = np.zeros(len(Pw), np.int64)
    welded_part[gm.weld] = gm.part
    parts = np.unique(welded_part)
    poses = []
    if cfg.get('per_part') and len(parts) > 1:
        for p in parts:
            m = welded_part == p
            log(f"   part {p}: {m.sum()} verts")
            r = fitter.coarse_fit(m)
            Pw[m] = Fitter.apply(Pw[m], r.params['center'], r.params['s'], r.params['ax'], r.params['az'], r.params['t'], r.params['ay'])
            poses.append(r.pose)
    else:
        r = fitter.coarse_fit()
        Pw = Fitter.apply(Pw, r.params['center'], r.params['s'], r.params['ax'], r.params['az'], r.params['t'], r.params['ay'])
        poses.append(r.pose)
    pose = poses[0]
    Vb, mats = body.posed(pose)
    if cfg.get('rigid_bone'):
        # Rigid items keep their modelled shape; they follow one bone, so the
        # viewer pose cannot change them either.
        Pw = fitter.rigid_resolve(Pw, pose)
        J, W = top4(transfer_weights(body, Vb, Pw, cfg))
        P, N, UV, F, Jr, Wr = build_render_mesh(gm, Pw, J, W, cfg.get('crease_deg', 60))
        export_skinned_glb(out_path, body, cfg['name'], P, N, UV, F, Jr, Wr, cfg.get('color', [0.8, 0.8, 0.8]), cfg.get('roughness', 0.85))
        return {'pose': pose, 'verts': len(P), 'faces': len(F)}
    Pw = fitter.tighten(Pw, pose)
    Pw = fitter.inflate(Pw, pose)
    Pw = fitter.collide(Pw, pose, cfg.get('collide_iters', 12))

    # Weights are transferred in the garment's own pose (sleeves around the arms)...
    Wd = transfer_weights(body, Vb, Pw, cfg, gm.Fw)
    J, W = top4(Wd)
    A_fit = blend_matrices(mats, J, W)
    # ...then the garment is carried into the pose the viewer actually shows,
    # relaxed so blended areas keep their cloth shape, and collided again there.
    display = cfg.get('display_pose', {'arms': VIEWER_ARM_REST_ANGLE})
    mats_d = body.skin_matrices(display)
    A_disp = blend_matrices(mats_d, J, W)
    P_bind = inverse_lbs(mats, Pw, J, W)
    P_disp = lbs(mats_d, P_bind, J, W)
    if cfg.get('relax', True):
        P_disp = relax_after_pose(gm, Pw, A_fit, P_disp, A_disp, cfg.get('relax_stiffness', 0.15))
    P_disp = fitter.inflate(P_disp, display)
    P_disp = fitter.collide(P_disp, display, cfg.get('collide_iters', 12))
    P_bind = inverse_lbs(mats_d, P_disp, J, W)
    P, N, UV, F, Jr, Wr = build_render_mesh(gm, P_bind, J, W, cfg.get('crease_deg', 60))
    export_skinned_glb(out_path, body, cfg['name'], P, N, UV, F, Jr, Wr, cfg.get('color', [0.8, 0.8, 0.8]), cfg.get('roughness', 0.85))
    return {'pose': pose, 'verts': len(P), 'faces': len(F)}


def load_config(path: str) -> dict:
    with open(path, encoding='utf-8') as f:
        return json.load(f)


# ---------------------------------------------------------------------------
# Editing existing GLBs in place (morph targets, extra images)
# ---------------------------------------------------------------------------

def append_bytes(g: pygltflib.GLTF2, blob: bytearray, data: bytes, target=None) -> int:
    """Append raw bytes to the GLB buffer; returns the new bufferView index."""
    while len(blob) % 4:
        blob.append(0)
    g.bufferViews.append(pygltflib.BufferView(buffer=0, byteOffset=len(blob), byteLength=len(data), target=target))
    blob += data
    return len(g.bufferViews) - 1


def append_accessor(g, blob, arr: np.ndarray, typ: str, minmax=False, target=34962) -> int:
    arr = np.ascontiguousarray(arr.astype(np.float32))
    bv = append_bytes(g, blob, arr.tobytes(), target)
    acc = pygltflib.Accessor(bufferView=bv, componentType=5126, count=len(arr), type=typ)
    if minmax:
        acc.min = arr.min(0).astype(float).tolist()
        acc.max = arr.max(0).astype(float).tolist()
    g.accessors.append(acc)
    return len(g.accessors) - 1


def repack(g: pygltflib.GLTF2, blob: bytes) -> bytes:
    """Drop accessors and buffer data nothing uses any more (keeps re-runs from growing the file)."""
    def ints(d):
        return [v for v in (d.values() if isinstance(d, dict) else d.__dict__.values()) if isinstance(v, int)]

    # 1) accessors still referenced
    used_acc = set()
    for m in g.meshes:
        for pr in m.primitives:
            used_acc |= set(ints(pr.attributes))
            if pr.indices is not None:
                used_acc.add(pr.indices)
            for t in pr.targets or []:
                used_acc |= set(ints(t))
    for s_ in g.skins or []:
        if s_.inverseBindMatrices is not None:
            used_acc.add(s_.inverseBindMatrices)
    for a in g.animations or []:
        for smp in a.samplers:
            used_acc |= {smp.input, smp.output}
    acc_map, accs = {}, []
    for i, a in enumerate(g.accessors):
        if i in used_acc:
            acc_map[i] = len(accs)
            accs.append(a)
    g.accessors = accs

    # 2) buffer views still referenced by those accessors / images
    used = sorted({a.bufferView for a in g.accessors if a.bufferView is not None} |
                  {im.bufferView for im in (g.images or []) if im.bufferView is not None})
    remap, views, out = {}, [], bytearray()
    for old in used:
        bv = g.bufferViews[old]
        while len(out) % 4:
            out.append(0)
        start = bv.byteOffset or 0
        views.append(pygltflib.BufferView(buffer=0, byteOffset=len(out), byteLength=bv.byteLength,
                                          byteStride=bv.byteStride, target=bv.target, name=bv.name))
        out += blob[start:start + bv.byteLength]
        remap[old] = len(views) - 1
    for a in g.accessors:
        if a.bufferView is not None:
            a.bufferView = remap[a.bufferView]
    for im in g.images or []:
        if im.bufferView is not None:
            im.bufferView = remap[im.bufferView]
    g.bufferViews = views

    # 3) re-point everything at the compacted accessors
    for m in g.meshes:
        for pr in m.primitives:
            for k, v in pr.attributes.__dict__.items():
                if isinstance(v, int):
                    setattr(pr.attributes, k, acc_map[v])
            if pr.indices is not None:
                pr.indices = acc_map[pr.indices]
            if pr.targets:
                pr.targets = [{k: acc_map[v] for k, v in (t.items() if isinstance(t, dict) else t.__dict__.items())
                               if isinstance(v, int)} for t in pr.targets]
    for s_ in g.skins or []:
        if s_.inverseBindMatrices is not None:
            s_.inverseBindMatrices = acc_map[s_.inverseBindMatrices]
    for a in g.animations or []:
        for smp in a.samplers:
            smp.input, smp.output = acc_map[smp.input], acc_map[smp.output]
    while len(out) % 4:
        out.append(0)
    g.buffers[0].byteLength = len(out)
    return bytes(out)


def set_morph_target(g, blob: bytearray, mesh_index: int, prim_index: int, name: str,
                     dpos: np.ndarray, dnorm: np.ndarray | None = None):
    """Replace a primitive's morph targets with a single named target."""
    mesh = g.meshes[mesh_index]
    pr = mesh.primitives[prim_index]
    t = {'POSITION': append_accessor(g, blob, dpos, 'VEC3', minmax=True)}
    if dnorm is not None:
        t['NORMAL'] = append_accessor(g, blob, dnorm, 'VEC3')
    pr.targets = [t]
    mesh.weights = [0.0]
    mesh.extras = dict(mesh.extras or {}, targetNames=[name])


def read_morph(g, blob, prim, name='fat'):
    """POSITION delta of a named morph target (zeros if absent)."""
    n = g.accessors[prim.attributes.POSITION].count
    if not prim.targets:
        return np.zeros((n, 3))
    t = prim.targets[0]
    idx = t['POSITION'] if isinstance(t, dict) else t.POSITION
    return read_accessor(g, blob, idx).astype(float)


# ---------------------------------------------------------------------------
# Body-shape morph for fitted assets
# ---------------------------------------------------------------------------

def transfer_body_morph(slim: Body, fat: Body, P: np.ndarray, smooth_radius: float = 0.03) -> np.ndarray:
    """Displacement for points on/around the slim body that follows the fat morph."""
    surf = Surface(slim.V, slim.F)
    _, _, _, corners, bary = surf.closest(P)
    D = np.einsum('nk,nkj->nj', bary, (fat.V - slim.V)[corners])
    if smooth_radius:
        D = spatial_smooth(D, P, smooth_radius)
    return D


def add_fat_morph(slim: Body, fat: Body, path: str, cfg: dict, collide: bool = True, log=print) -> dict:
    """Fit an already-exported skinned asset onto the fat body as a 'fat' morph target.

    Topology, UVs and weights stay identical; only the morph delta is added, so
    the viewer can blend continuously between the two shapes.
    """
    g = pygltflib.GLTF2().load(path)
    blob = bytearray(g.binary_blob())
    pr = g.meshes[0].primitives[0]
    a = pr.attributes
    P = read_accessor(g, bytes(blob), a.POSITION).astype(float)
    N = read_accessor(g, bytes(blob), a.NORMAL).astype(float)
    F = read_accessor(g, bytes(blob), pr.indices).reshape(-1, 3).astype(np.int64)
    J = read_accessor(g, bytes(blob), a.JOINTS_0).astype(np.int64)
    W = read_accessor(g, bytes(blob), a.WEIGHTS_0).astype(float)
    UV = read_accessor(g, bytes(blob), a.TEXCOORD_0).astype(float) if a.TEXCOORD_0 is not None else np.zeros((len(P), 2))

    gm = GarmentMesh(P.copy(), UV, F)
    gm.rebuild_topology()
    Pw = gm.Pw
    Jw, Ww = J[gm.first], W[gm.first]
    D = transfer_body_morph(slim, fat, Pw, cfg.get('morph_smooth', 0.06))
    if cfg.get('rigid_bone'):
        D[:] = D.mean(0)  # rigid items just ride along
        Pf = Pw + D
    else:
        Pf = Pw + D
        if collide:
            fitter = Fitter(fat, gm, cfg, log)
            display = cfg.get('display_pose', {'arms': VIEWER_ARM_REST_ANGLE})
            mats_d = fat.skin_matrices(display)
            P_disp = lbs(mats_d, Pf, Jw, Ww)
            P_disp = fitter.inflate(P_disp, display)
            P_disp = fitter.bridge(P_disp, display, cfg.get('bridge_iters', 15))
            P_disp = fitter.collide(P_disp, display, cfg.get('collide_iters', 12))
            Pf = inverse_lbs(mats_d, P_disp, Jw, Ww)
    dpos = (Pf - Pw)[gm.weld]
    n_slim = vertex_normals(Pw, gm.Fw)[gm.weld]
    n_fat = vertex_normals(Pf, gm.Fw)[gm.weld]
    dn = unit(N + (n_fat - n_slim)) - N
    set_morph_target(g, blob, 0, 0, 'fat', dpos, dn)
    new_blob = repack(g, bytes(blob))
    g.set_binary_blob(new_blob)
    g.save_binary(path)
    return {'max_shift': float(np.linalg.norm(dpos, axis=1).max())}
