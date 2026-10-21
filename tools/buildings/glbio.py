"""
GLB 讀寫小工具（tools/buildings 同 tools/ground 共用）

    j, bin_ = read_glb(path)
    g = Glb(*compact(j, bin_, keep_node=lambda n: ...))   # 刪 node + 清走冇用嘅資源
    g.acc(...) / g.texture(...) / g.material(...) / g.node(...)
    g.save(path)
"""

import json
import struct

import numpy as np

from build_buildings import read_glb, accessor  # noqa: F401  （畀其他工具一齊 import）


def pad4(b, fill=b"\x00"):
    return b + fill * ((4 - len(b) % 4) % 4)


def compact(j, bin_, keep_node):
    """只保留 keep_node(node) 為真嘅 node，再刪走冇人用嘅 mesh / accessor / 材質 / 貼圖…（重新排 buffer）"""
    keep_nodes = []
    old_nodes = j["nodes"]

    def keep(i):
        return keep_node(old_nodes[i])

    remap_node = {}
    for i, n in enumerate(old_nodes):
        if keep(i):
            remap_node[i] = len(keep_nodes)
            keep_nodes.append(dict(n))
    for n in keep_nodes:
        if "children" in n:
            n["children"] = [remap_node[c] for c in n["children"] if c in remap_node]
            if not n["children"]:
                del n["children"]
    scenes = [{**s, "nodes": [remap_node[i] for i in s.get("nodes", []) if i in remap_node]} for s in j["scenes"]]

    used_mesh = sorted({n["mesh"] for n in keep_nodes if "mesh" in n})
    mesh_map = {m: i for i, m in enumerate(used_mesh)}
    meshes = [json.loads(json.dumps(j["meshes"][m])) for m in used_mesh]
    for n in keep_nodes:
        if "mesh" in n:
            n["mesh"] = mesh_map[n["mesh"]]

    used_acc, used_mat = set(), set()
    for m in meshes:
        for pr in m["primitives"]:
            used_acc.update(pr["attributes"].values())
            if "indices" in pr:
                used_acc.add(pr["indices"])
            if "material" in pr:
                used_mat.add(pr["material"])
            for t in pr.get("targets", []):
                used_acc.update(t.values())
    acc_map = {a: i for i, a in enumerate(sorted(used_acc))}
    mat_map = {m: i for i, m in enumerate(sorted(used_mat))}
    materials = [json.loads(json.dumps(j["materials"][m])) for m in sorted(used_mat)]

    used_tex = set()

    def walk_tex(o):
        if isinstance(o, dict):
            for k, v in o.items():
                if k.endswith("Texture") and isinstance(v, dict) and "index" in v:
                    used_tex.add(v["index"])
                walk_tex(v)
        elif isinstance(o, list):
            for v in o:
                walk_tex(v)
    walk_tex(materials)
    tex_map = {t: i for i, t in enumerate(sorted(used_tex))}

    def remap_tex(o):
        if isinstance(o, dict):
            for k, v in o.items():
                if k.endswith("Texture") and isinstance(v, dict) and "index" in v:
                    v["index"] = tex_map[v["index"]]
                remap_tex(v)
        elif isinstance(o, list):
            for v in o:
                remap_tex(v)
    remap_tex(materials)
    textures = [json.loads(json.dumps(j["textures"][t])) for t in sorted(used_tex)]

    used_img, used_smp = set(), set()
    for t in textures:
        if "source" in t:
            used_img.add(t["source"])
        for ext in t.get("extensions", {}).values():
            if "source" in ext:
                used_img.add(ext["source"])
        if "sampler" in t:
            used_smp.add(t["sampler"])
    img_map = {i: k for k, i in enumerate(sorted(used_img))}
    smp_map = {s: k for k, s in enumerate(sorted(used_smp))}
    for t in textures:
        if "source" in t:
            t["source"] = img_map[t["source"]]
        for ext in t.get("extensions", {}).values():
            if "source" in ext:
                ext["source"] = img_map[ext["source"]]
        if "sampler" in t:
            t["sampler"] = smp_map[t["sampler"]]
    images = [dict(j["images"][i]) for i in sorted(used_img)]
    samplers = [dict(j["samplers"][s]) for s in sorted(used_smp)]

    for m in meshes:
        for pr in m["primitives"]:
            pr["attributes"] = {k: acc_map[v] for k, v in pr["attributes"].items()}
            if "indices" in pr:
                pr["indices"] = acc_map[pr["indices"]]
            if "material" in pr:
                pr["material"] = mat_map[pr["material"]]
            if "targets" in pr:
                pr["targets"] = [{k: acc_map[v] for k, v in t.items()} for t in pr["targets"]]

    accessors = [dict(j["accessors"][a]) for a in sorted(used_acc)]
    used_bv = sorted({a["bufferView"] for a in accessors if "bufferView" in a} |
                     {im["bufferView"] for im in images if "bufferView" in im})
    blob = bytearray()
    bv_map, views = {}, []
    for bvi in used_bv:
        bv = dict(j["bufferViews"][bvi])
        data = bin_[bv.get("byteOffset", 0): bv.get("byteOffset", 0) + bv["byteLength"]]
        while len(blob) % 4:
            blob.append(0)
        bv["byteOffset"] = len(blob)
        bv["buffer"] = 0
        blob.extend(data)
        bv_map[bvi] = len(views)
        views.append(bv)
    for a in accessors:
        if "bufferView" in a:
            a["bufferView"] = bv_map[a["bufferView"]]
    for im in images:
        if "bufferView" in im:
            im["bufferView"] = bv_map[im["bufferView"]]

    out = {k: v for k, v in j.items() if k not in (
        "nodes", "scenes", "meshes", "accessors", "bufferViews", "materials", "textures", "images",
        "samplers", "buffers")}
    out.update(nodes=keep_nodes, scenes=scenes, meshes=meshes, accessors=accessors, bufferViews=views,
               materials=materials, textures=textures, images=images, samplers=samplers)
    return out, blob



class Glb:
    """喺 compact() 嘅結果上面加嘢，最後 save()"""

    def __init__(self, g, blob):
        self.g, self.blob = g, blob
        for key in ("textures", "images", "samplers", "materials", "meshes", "nodes", "accessors", "bufferViews"):
            g.setdefault(key, [])

    def view(self, data, target=None):
        while len(self.blob) % 4:
            self.blob.append(0)
        off = len(self.blob)
        self.blob.extend(data)
        v = {"buffer": 0, "byteOffset": off, "byteLength": len(data)}
        if target:
            v["target"] = target
        self.g["bufferViews"].append(v)
        return len(self.g["bufferViews"]) - 1

    def acc(self, arr, ctype, typ, target, minmax=False):
        a = {"bufferView": self.view(arr.tobytes(), target), "componentType": ctype,
             "count": int(arr.shape[0]), "type": typ}
        if minmax:
            a["min"] = [float(x) for x in arr.min(0)]
            a["max"] = [float(x) for x in arr.max(0)]
        self.g["accessors"].append(a)
        return len(self.g["accessors"]) - 1

    def use_ext(self, *names):
        for ext in names:
            if ext not in self.g.setdefault("extensionsUsed", []):
                self.g["extensionsUsed"].append(ext)

    def texture(self, image_bytes, name, wrap=10497):
        """WebP 貼圖；wrap 10497 = REPEAT，33071 = CLAMP"""
        self.g["samplers"].append({"magFilter": 9729, "minFilter": 9987, "wrapS": wrap, "wrapT": wrap})
        self.g["images"].append({"name": name, "mimeType": "image/webp", "bufferView": self.view(image_bytes)})
        self.g["textures"].append({"sampler": len(self.g["samplers"]) - 1,
                                   "extensions": {"EXT_texture_webp": {"source": len(self.g["images"]) - 1}}})
        self.use_ext("EXT_texture_webp")
        return len(self.g["textures"]) - 1

    def material(self, name, texture=None, color=None):
        """啞光材質（冇金屬感、冇高光），配合港漫平塗"""
        pbr = {"metallicFactor": 0.0, "roughnessFactor": 1.0}
        if texture is not None:
            pbr["baseColorTexture"] = {"index": texture}
        if color is not None:
            pbr["baseColorFactor"] = list(color) + [1.0]
        self.g["materials"].append({"name": name, "pbrMetallicRoughness": pbr,
                                    "extensions": {"KHR_materials_specular": {"specularFactor": 0.0}}})
        self.use_ext("KHR_materials_specular")
        return len(self.g["materials"]) - 1

    def primitive(self, pos, nrm, uv, idx, material):
        pos = np.asarray(pos, np.float32)
        nrm = np.asarray(nrm, np.float32)
        nrm = nrm / np.maximum(np.linalg.norm(nrm, axis=1, keepdims=True), 1e-9)
        idx = np.asarray(idx, np.uint16 if len(pos) < 65536 else np.uint32)
        attrs = {"POSITION": self.acc(pos, 5126, "VEC3", 34962, True),
                 "NORMAL": self.acc(nrm, 5126, "VEC3", 34962)}
        if uv is not None:
            attrs["TEXCOORD_0"] = self.acc(np.asarray(uv, np.float32), 5126, "VEC2", 34962)
        return {"attributes": attrs, "material": material,
                "indices": self.acc(idx.reshape(-1, 1), 5123 if idx.dtype == np.uint16 else 5125, "SCALAR", 34963)}

    def node(self, name, primitives, translation=(0.0, 0.0, 0.0)):
        self.g["meshes"].append({"name": name, "primitives": primitives})
        self.g["nodes"].append({"name": name, "mesh": len(self.g["meshes"]) - 1,
                                "translation": [float(v) for v in translation]})
        self.g["scenes"][self.g.get("scene", 0)]["nodes"].append(len(self.g["nodes"]) - 1)
        return len(self.g["nodes"]) - 1

    def save(self, path):
        self.g["buffers"] = [{"byteLength": len(self.blob)}]
        js = pad4(json.dumps(self.g, ensure_ascii=False, separators=(",", ":")).encode("utf-8"), b" ")
        bin_out = pad4(bytes(self.blob))
        with open(path, "wb") as f:
            f.write(struct.pack("<III", 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(bin_out)))
            f.write(struct.pack("<II", len(js), 0x4E4F534A))
            f.write(js)
            f.write(struct.pack("<II", len(bin_out), 0x004E4942))
            f.write(bin_out)
