#!/usr/bin/env python3
"""
Add a "fat" morph target to the body GLBs (肥佬 / 肥婆 body shape).

The fat shape uses the very same mesh (topology, UVs, skin weights) and
skeleton as the normal body, so polygon count and texture stay the same and
the dashboard can blend between the two with a slider (morph influence 0..1).

The displacement is a smooth "fat field":
  * every skin vertex moves out along its normal by an amount blended from
    its skin weights (belly/waist/thighs a lot, hands/feet almost nothing);
  * a few shaped extras on top: a forward-and-down hanging belly, chest,
    buttocks, a double chin, fuller cheeks;
  * inner thighs are damped so the legs do not swallow each other;
  * the result is Laplacian-smoothed so there are no creases.
Eyes and eyebrows get the delta of the face under them so they stay attached.

    python tools/paperdoll/body_shapes.py            # writes the morph into both bodies
    python tools/paperdoll/body_shapes.py --preview  # only prints stats
"""
import argparse
import os
import sys

import numpy as np
import pygltflib
from scipy import sparse
from scipy.spatial import cKDTree

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import paperdoll as pd  # noqa: E402

CHAR = os.path.join(HERE, '..', '..', 'packages', 'shared', 'characters')
MORPH_NAME = 'fat'

# Outward push (metres) per bone, blended by skin weight.
BONE_FAT = {
    'male': {
        'pelvis': 0.070, 'spine_01': 0.100, 'spine_02': 0.085, 'spine_03': 0.055,
        'clavicle_l': 0.030, 'clavicle_r': 0.030, 'neck_01': 0.036, 'Head': 0.0,
        'upperarm_l': 0.045, 'upperarm_r': 0.045, 'lowerarm_l': 0.018, 'lowerarm_r': 0.018,
        'thigh_l': 0.055, 'thigh_r': 0.055, 'calf_l': 0.020, 'calf_r': 0.020,
    },
    'female': {
        'pelvis': 0.080, 'spine_01': 0.080, 'spine_02': 0.065, 'spine_03': 0.042,
        'clavicle_l': 0.026, 'clavicle_r': 0.026, 'neck_01': 0.028, 'Head': 0.0,
        'upperarm_l': 0.042, 'upperarm_r': 0.042, 'lowerarm_l': 0.016, 'lowerarm_r': 0.016,
        'thigh_l': 0.065, 'thigh_r': 0.065, 'calf_l': 0.022, 'calf_r': 0.022,
    },
}
# Shaped extras: amplitudes in metres
EXTRAS = {
    'male': {'belly': 0.12, 'waist': 0.045, 'chest': 0.03, 'butt': 0.035, 'chin': 0.028, 'cheek': 0.012},
    'female': {'belly': 0.09, 'waist': 0.035, 'chest': 0.022, 'butt': 0.06, 'chin': 0.022, 'cheek': 0.010},
}


def gaussian(V, c, r):
    d = (V - c) / r
    return np.exp(-0.5 * (d * d).sum(1))


def fat_field(body: pd.Body, gender: str, eye_centers=()) -> np.ndarray:
    V, F = body.V, body.F
    n = pd.vertex_normals(V, F)
    W = pd.node_worlds(body.gltf)
    J = lambda name: W[body.node_index[name]][:3, 3]  # noqa: E731

    amp = np.zeros(len(V))
    for bone, a in BONE_FAT[gender].items():
        amp += body.Wdense[:, body.joint_index[bone]] * a
    # damp the inner thighs (normal pointing at the other leg) and the armpit side of the arms
    leg = body.Wdense[:, [body.joint_index[b] for b in ('thigh_l', 'thigh_r', 'calf_l', 'calf_r')]].sum(1)
    inward = np.maximum(-np.sign(V[:, 0]) * n[:, 0], 0)
    amp *= 1 - 0.75 * leg * inward
    D = amp[:, None] * n

    ex = EXTRAS[gender]
    front = -1.0  # characters face -Z
    z_front = lambda y: V[np.abs(V[:, 1] - y) < 0.02][:, 2].min()  # noqa: E731
    facing_front = np.clip(-n[:, 2], 0, 1)
    facing_back = np.clip(n[:, 2], 0, 1)
    torso = body.Wdense[:, [body.joint_index[b] for b in ('pelvis', 'spine_01', 'spine_02', 'spine_03')]].sum(1)

    # hanging belly: forward, a bit down, strongest just below the navel
    yb = (J('pelvis')[1] + J('spine_01')[1]) / 2 + 0.02
    g = gaussian(V, np.array([0, yb, z_front(yb)]), np.array([0.17, 0.15, 0.20])) * facing_front * torso
    D += ex['belly'] * g[:, None] * np.array([0, -0.35, front])

    # love handles: sideways at the waist
    yw = J('spine_01')[1] - 0.01
    for sx in (-1, 1):
        g = gaussian(V, np.array([sx * 0.16, yw, 0.02]), np.array([0.07, 0.10, 0.12])) * np.clip(sx * n[:, 0], 0, 1) * torso
        D += ex['waist'] * g[:, None] * np.array([sx, -0.2, 0])

    # chest (male: soft "moobs"; female: fuller bust)
    yc = J('spine_03')[1] + 0.02
    for sx in (-1, 1):
        g = gaussian(V, np.array([sx * 0.085, yc, z_front(yc)]), np.array([0.08, 0.07, 0.12])) * facing_front
        D += ex['chest'] * g[:, None] * np.array([0, -0.5, front])

    # buttocks
    yp = J('pelvis')[1] - 0.05
    z_back = V[np.abs(V[:, 1] - yp) < 0.02][:, 2].max()
    for sx in (-1, 1):
        g = gaussian(V, np.array([sx * 0.08, yp, z_back]), np.array([0.09, 0.09, 0.12])) * facing_back
        D += ex['butt'] * g[:, None] * np.array([0, -0.3, 1.0])

    # double chin: under the jaw, down and forward
    head = J('Head')
    yj = head[1] + 0.015
    g = gaussian(V, np.array([0, yj, z_front(yj) + 0.03]), np.array([0.055, 0.03, 0.05])) * np.clip(-n[:, 1] + 0.3, 0, 1)
    D += ex['chin'] * g[:, None] * np.array([0, -0.6, front * 0.8])

    # fuller cheeks
    yk = head[1] + 0.04
    for sx in (-1, 1):
        g = gaussian(V, np.array([sx * 0.05, yk, z_front(yk) + 0.03]), np.array([0.03, 0.025, 0.04]))
        D += ex['cheek'] * g[:, None] * n

    # keep the eye sockets still so the lids don't close over the eyeballs
    for c in eye_centers:
        d = np.linalg.norm(V - c, axis=1)
        D *= np.clip((d - 0.02) / 0.025, 0, 1)[:, None] ** 2

    # and the lips (cheeks/chin would otherwise puff them up)
    if len(eye_centers):
        ey = np.mean([c[1] for c in eye_centers])
        ym = ey - 0.065
        mouth = np.array([0.0, ym, z_front(ym)])
        d = np.linalg.norm((V - mouth) / np.array([1.0, 1.4, 1.0]), axis=1)
        D *= np.clip((d - 0.018) / 0.025, 0, 1)[:, None]

    # smooth so nothing creases
    adj = sparse.coo_matrix((np.ones(F.size), (F[:, [1, 2, 0]].ravel(), F.ravel())), shape=(len(V), len(V))).tocsr()
    adj = ((adj + adj.T) > 0).astype(float)
    deg = np.maximum(np.asarray(adj.sum(1)).ravel(), 1)
    for _ in range(6):
        D = 0.5 * D + 0.5 * (adj @ D) / deg[:, None]
    return D


def prim_weld_map(g, blob, prim):
    P = pd.read_accessor(g, blob, prim.attributes.POSITION).astype(float)
    return P, pd.weld(P)


def write_body_morph(path: str, gender: str, preview: bool = False):
    body = pd.Body(path)
    g = pygltflib.GLTF2().load(path)
    blob = bytearray(g.binary_blob())
    eyes = g.meshes[next(n.mesh for n in g.nodes if n.name == 'Eyes')].primitives[0]
    EP = pd.read_accessor(g, bytes(blob), eyes.attributes.POSITION).astype(float)
    eye_centers = [EP[EP[:, 0] < 0].mean(0), EP[EP[:, 0] > 0].mean(0)]
    Dw = fat_field(body, gender, eye_centers)  # per welded body vertex

    # map welded deltas back to every primitive vertex
    tree = cKDTree(body.V)
    stats = []
    for mi, mesh in enumerate(g.meshes):
        for pi, prim in enumerate(mesh.primitives):
            P = pd.read_accessor(g, bytes(blob), prim.attributes.POSITION).astype(float)
            dist, idx = tree.query(P)
            dpos = Dw[idx]  # eyes/brows: delta of the closest face vertex
            # normal deltas from the deformed welded surface
            Vf = body.V + Dw
            n0 = pd.vertex_normals(body.V, body.F)[idx]
            n1 = pd.vertex_normals(Vf, body.F)[idx]
            if prim.attributes.NORMAL is not None and len(P) == max(
                    g.accessors[p.attributes.POSITION].count for m in g.meshes for p in m.primitives):
                nrm = pd.read_accessor(g, bytes(blob), prim.attributes.NORMAL).astype(float)
                # rotate the authored normal by the surface change (keeps eye/brow shading)
                dn = pd.unit(nrm + (n1 - n0)) - nrm
            else:
                dn = None
            stats.append((mesh.name, len(P), float(np.linalg.norm(dpos, axis=1).max())))
            if not preview:
                pd.set_morph_target(g, blob, mi, pi, MORPH_NAME, dpos, dn)
    for s in stats:
        print(f'  {gender}: {s[0]:28s} verts={s[1]:5d} max shift={s[2] * 100:.1f}cm')
    if preview:
        return Dw
    new_blob = pd.repack(g, bytes(blob))
    g.set_binary_blob(new_blob)
    g.save_binary(path)
    print(f'  wrote {os.path.relpath(path)} ({len(new_blob) // 1024} KB)')
    return Dw


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--preview', action='store_true')
    ap.add_argument('--gender', choices=['male', 'female'], action='append')
    args = ap.parse_args()
    for gender in args.gender or ['male', 'female']:
        write_body_morph(os.path.abspath(os.path.join(CHAR, 'body', f'{gender}.glb')), gender, args.preview)
