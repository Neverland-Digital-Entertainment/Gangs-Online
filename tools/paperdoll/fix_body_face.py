#!/usr/bin/env python3
"""
Restore the eyes and eyebrows of the body GLBs.

The bodies were exported without their face textures:
  - MI_Eyes has no texture, so the eyeballs render plain white (no iris/pupil).
  - MI_Hair_* (eyebrows) is plain white; the real brow colour only survived in
    the second vertex-colour set (COLOR_1), which glTF viewers ignore.

This paints an eye texture by rasterising the eyeball's UVs (TEXCOORD_0) and
colouring each texel by its angle from the gaze direction on the 3D eyeball,
embeds it as a PNG, and sets the brow material to the COLOR_1 colour.
Safe to re-run (it replaces what it added before).

    python tools/paperdoll/fix_body_face.py
"""
import io
import math
import os
import sys

import numpy as np
import pygltflib
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import paperdoll as pd  # noqa: E402

BODIES = [os.path.join(HERE, '..', '..', 'packages', 'shared', 'characters', 'body', f'{g}.glb') for g in ('male', 'female')]
RES = 256
EYE_IMAGE_NAME = 'eyes-generated'

# angles from the gaze direction, degrees
PUPIL, IRIS, LIMBUS = 11.0, 29.0, 31.5
SCLERA = np.array([236, 232, 224]) / 255
SCLERA_EDGE = np.array([214, 196, 190]) / 255
IRIS_INNER = np.array([120, 78, 40]) / 255
IRIS_OUTER = np.array([70, 42, 22]) / 255
LIMBAL = np.array([32, 20, 12]) / 255
PUPIL_C = np.array([12, 10, 10]) / 255


def smooth(edge0, edge1, x):
    t = np.clip((x - edge0) / (edge1 - edge0), 0, 1)
    return t * t * (3 - 2 * t)


def eye_color(theta, phi):
    """theta: angle from gaze (deg), phi: azimuth around it (rad) -> sRGB 0..1."""
    t = np.clip((theta - PUPIL) / (IRIS - PUPIL), 0, 1)[..., None]
    streak = 0.88 + 0.12 * np.sin(phi * 37.0 + np.sin(phi * 11.0) * 2.0)[..., None]
    iris = (IRIS_INNER * (1 - t) + IRIS_OUTER * t) * streak
    sclera = SCLERA + (SCLERA_EDGE - SCLERA) * smooth(55, 95, theta)[..., None]
    c = sclera
    c = c + (LIMBAL - c) * (1 - smooth(LIMBUS - 0.6, LIMBUS + 0.6, theta))[..., None]
    c = c + (iris - c) * (1 - smooth(IRIS - 0.6, IRIS + 0.6, theta))[..., None]
    c = c + (PUPIL_C - c) * (1 - smooth(PUPIL - 0.6, PUPIL + 0.6, theta))[..., None]
    return np.clip(c, 0, 1)


def paint_eye_texture(P, UV, F) -> Image.Image:
    # Both eyeballs share the same UVs; paint from the one at -x.
    left = P[:, 0] < 0
    center = P[left].mean(0)
    faces = F[left[F].all(1)]
    gaze = np.array([0.0, 0.0, -1.0])  # characters face -Z in glTF space
    # basis around the gaze for the azimuth
    ex, ey = np.array([1.0, 0, 0]), np.array([0, 1.0, 0])

    img = np.tile(SCLERA, (RES, RES, 1))
    for tri in faces:
        uv = UV[tri] * RES - 0.5   # texel-centre coordinates
        p = P[tri] - center
        u0, v0 = np.floor(uv.min(0)).astype(int)
        u1, v1 = np.ceil(uv.max(0)).astype(int)
        us, vs = np.meshgrid(np.arange(u0, u1 + 1), np.arange(v0, v1 + 1))
        pts = np.stack([us.ravel(), vs.ravel()], 1).astype(float)
        a, b, c = uv
        m = np.array([[b[0] - a[0], c[0] - a[0]], [b[1] - a[1], c[1] - a[1]]])
        if abs(np.linalg.det(m)) < 1e-12:
            continue
        l12 = np.linalg.solve(m, (pts - a).T).T
        bary = np.column_stack([1 - l12.sum(1), l12])
        inside = (bary >= -1e-3).all(1)
        if not inside.any():
            continue
        d = pd.unit(bary[inside] @ p)
        theta = np.degrees(np.arccos(np.clip(d @ gaze, -1, 1)))
        phi = np.arctan2(d @ ey, d @ ex)
        col = eye_color(theta, phi)
        px = pts[inside].astype(int)
        img[px[:, 1] % RES, px[:, 0] % RES] = col
    return Image.fromarray((img * 255).round().astype(np.uint8), 'RGB')


def fix_body(path: str):
    g = pygltflib.GLTF2().load(path)
    blob = bytearray(g.binary_blob())
    by_name = {n.name: n for n in g.nodes}
    eyes = g.meshes[by_name['Eyes'].mesh].primitives[0]
    brows = g.meshes[by_name['Eyebrows'].mesh].primitives[0]

    # --- eyebrows: use the colour kept in COLOR_1
    brow_rgb = pd.read_accessor(g, bytes(blob), brows.attributes.COLOR_1)[:, :3].mean(0)
    brow_mat = g.materials[brows.material]
    brow_mat.pbrMetallicRoughness.baseColorFactor = [float(x) for x in brow_rgb] + [1.0]

    # --- eyes: generated texture on TEXCOORD_0
    P = pd.read_accessor(g, bytes(blob), eyes.attributes.POSITION).astype(float)
    UV = pd.read_accessor(g, bytes(blob), eyes.attributes.TEXCOORD_0).astype(float)
    F = pd.read_accessor(g, bytes(blob), eyes.indices).reshape(-1, 3).astype(np.int64)
    png = io.BytesIO()
    paint_eye_texture(P, UV, F).save(png, 'PNG', optimize=True)
    data = png.getvalue()

    existing = next((i for i, im in enumerate(g.images) if im.name == EYE_IMAGE_NAME), None)
    if existing is not None:
        # re-run: drop the previously appended bytes (they were appended last)
        bv = g.bufferViews[g.images[existing].bufferView]
        assert bv.byteOffset + bv.byteLength >= len(blob) - 3, 'generated eye image is not at the end of the buffer'
        del blob[bv.byteOffset:]
    while len(blob) % 4:
        blob.append(0)
    offset = len(blob)
    blob += data
    while len(blob) % 4:
        blob.append(0)
    if existing is None:
        g.bufferViews.append(pygltflib.BufferView(buffer=0, byteOffset=offset, byteLength=len(data)))
        g.images.append(pygltflib.Image(name=EYE_IMAGE_NAME, mimeType='image/png', bufferView=len(g.bufferViews) - 1))
        g.textures.append(pygltflib.Texture(sampler=0, source=len(g.images) - 1))
        tex_index = len(g.textures) - 1
    else:
        bv.byteOffset, bv.byteLength = offset, len(data)
        tex_index = next(i for i, t in enumerate(g.textures) if t.source == existing)
    eye_mat = g.materials[eyes.material]
    eye_mat.pbrMetallicRoughness.baseColorTexture = pygltflib.TextureInfo(index=tex_index, texCoord=0)
    eye_mat.pbrMetallicRoughness.baseColorFactor = [1.0, 1.0, 1.0, 1.0]

    g.buffers[0].byteLength = len(blob)
    g.set_binary_blob(bytes(blob))
    g.save_binary(path)
    print(f'{os.path.relpath(path)}: brows -> {np.round(brow_rgb, 3)}, eye texture {len(data) // 1024} KB')


if __name__ == '__main__':
    for p in BODIES:
        fix_body(os.path.abspath(p))
