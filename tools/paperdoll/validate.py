"""Checks for fitted paper-doll garments (structure + clipping in the viewer poses)."""
import os

import numpy as np
import trimesh

import paperdoll as pd

VIEWER_ARM_REST_ANGLE = 1.15  # CharacterViewer.tsx ARM_REST_ANGLE


load_skinned = pd.load_skinned_garment


def clipping(body, garment, cfg, pose, min_ok=0.0):
    """(garment verts inside body, body verts poking through garment) in `pose`."""
    Vb, mats = body.posed(pose)
    G = pd.lbs(mats, garment['P'], garment['J'], garment['W'])
    surf = pd.Surface(Vb, body.F)
    cpg, ng, sd, _, _ = surf.closest(G)
    inside_mask = sd < min_ok
    # cloth caught in a body crease (e.g. between fat thighs) is hidden from view
    hidden_inside = 0
    if inside_mask.any():
        bm = trimesh.Trimesh(Vb, body.F, process=False)
        o = cpg[inside_mask] + ng[inside_mask] * 0.003
        bl, bri, _ = bm.ray.intersects_location(o, ng[inside_mask], multiple_hits=False)
        near = np.linalg.norm(bl - o[bri], axis=1) < 0.04
        hidden_inside = int(len(np.unique(bri[near])))
    inside = int(inside_mask.sum()) - hidden_inside
    region = cfg.get('region_bones')
    mask = body.region_mask(region) if region else np.ones(len(Vb), bool)
    S, NS = pd.skin_samples(Vb, body.F, surf.vn, mask)
    gm = trimesh.Trimesh(G, garment['F'], process=False)
    depth = 0.02
    origins = S - NS * depth
    loc, ri, _ = gm.ray.intersects_location(origins, NS, multiple_hits=False)
    t = np.einsum('ij,ij->i', loc - origins[ri], NS[ri])
    poking = ri[(t < depth) & (t > -0.01)]
    # Skin in a crease (another body part right in front of it, e.g. inner arm vs
    # ribs in the armpit) is hidden from view; report it separately.
    body_mesh = trimesh.Trimesh(Vb, body.F, process=False)
    crease = np.zeros(len(S), bool)
    if len(poking):
        # occluded = most of the hemisphere above the skin is blocked by the body
        # within 5cm (armpit, between fat thighs, under the bust)
        k = 8
        dirs = pd._hemisphere_dirs(NS[poking], k).reshape(-1, 3)
        orig = np.repeat(S[poking] + NS[poking] * 0.003, k, axis=0)
        bl, bri, _ = body_mesh.ray.intersects_location(orig, dirs, multiple_hits=False)
        blocked = np.zeros(len(orig), bool)
        blocked[bri[np.linalg.norm(bl - orig[bri], axis=1) < 0.05]] = True
        crease[poking[blocked.reshape(-1, k).mean(1) >= 0.5]] = True
    visible = int((~crease[poking]).sum())
    return inside, visible, int(crease.sum()) + hidden_inside, len(G), len(S)


def validate(body, path, cfg):
    gar = load_skinned(path, body.morph)
    lines, ok = [], True
    same_joints = gar['joints'] == body.joint_names
    ibm_diff = float(np.abs(gar['ibm'] - body.ibm_raw).max())
    wsum = np.abs(gar['W'].sum(1) - 1).max()
    struct_ok = same_joints and ibm_diff < 1e-6 and wsum < 1e-3 and len(gar['gltf'].skins) == 1
    ok &= struct_ok
    lines.append(f"skeleton: joints={len(gar['joints'])} order==body:{same_joints} IBM max diff={ibm_diff:.1e} weight-sum err={wsum:.1e} -> {'OK' if struct_ok else 'FAIL'}")
    for label, pose in (('T-pose', {}), ('viewer A-pose', {'arms': VIEWER_ARM_REST_ANGLE})):
        inside, poke, crease, n, nb = clipping(body, gar, cfg, pose)
        lines.append(f"{label:14s}: cloth verts inside body {inside}/{n} ({inside / n:.1%}), visible skin poking through {poke}/{nb}"
                     + (f", hidden crease contacts {crease}" if crease else ''))
        if label == 'viewer A-pose':
            ok &= inside / n < 0.01 and poke <= max(3, nb * cfg.get('poke_tolerance', 0.01))
            for up in cfg.get('_over_paths', []):
                under = load_skinned(up, body.morph)
                Vb, mats = body.posed(pose)
                G = pd.lbs(mats, gar['P'], gar['J'], gar['W'])
                U = pd.lbs(mats, under['P'], under['J'], under['W'])
                usurf = pd.Surface(U, under['F'])
                bsurf = pd.Surface(Vb, body.F)
                cpb, _, _, _, _ = bsurf.closest(U)
                sign = 1.0 if np.mean(np.einsum('ij,ij->i', usurf.vn, U - cpb) > 0) >= 0.5 else -1.0
                ucp, _, usd, _, _ = usurf.closest(G)
                near = np.linalg.norm(G - ucp, axis=1) < 0.05
                below = int(((usd * sign) < 0)[near].sum())
                if cfg.get('under_as_thickness'):
                    # e.g. a cap over hair: it is meant to squash the hair a little
                    # (under_compress), and hair cards have no real inside.
                    lines.append(f"{'':14s}  over {os.path.basename(up)}: presses into it at {below}/{int(near.sum())} verts (by design, under_compress)")
                    continue
                lines.append(f"{'':14s}  under {os.path.basename(up)}: verts inside it {below}/{int(near.sum())} overlapping")
                ok &= below <= max(3, near.sum() * 0.01)
    return {'ok': bool(ok), 'lines': lines}
