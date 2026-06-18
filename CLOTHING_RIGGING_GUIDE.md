# 衣物綁定流程（紙娃娃換裝 SOP）

把「下載來的靜態衣服」變成「貼合身體、跟著骨架變形」的可換裝部件的標準流程。
適用於 NPC Appearance Management（造型管理）的 `top / bottom / shoe / head / hair / beard` 各槽位。

---

## 1. 核心觀念：共用骨架（Shared Skeleton）

紙娃娃換裝的關鍵是：**身體和每一件衣物都綁在「同一套骨架」上、同一個 bind pose**。
這樣每件衣物天生就對齊身體、會一起變形，位置不用手動喬。

- 身體骨架：**65 根骨頭**，bind pose 是 **T-pose**。
- 已正常運作的範例：**頭髮、鬍子**（它們本來就是 skinned）。
- 遊戲端（Babylon）載入衣物時，會自動把 skinned 衣物 rebind 到身體骨架
  （`CharacterViewer.tsx` 的 `loadEquipmentSlot`，靠「骨頭索引」對應）。

> ⚠️ 因此衣物匯出時 **必須含同一套骨架、骨頭順序與身體完全一致**。
> 做法：在 Blender 裡綁定到「從 `body/male.glb` 匯入的那套 armature」再匯出，順序就會一致。

身體 65 根骨頭順序（節點名）：
```
root, pelvis, spine_01, spine_02, spine_03, neck_01, Head,
clavicle_l, upperarm_l, lowerarm_l, hand_l, (左手手指…),
clavicle_r, upperarm_r, lowerarm_r, hand_r, (右手手指…),
thigh_l, calf_l, foot_l, ball_l, ball_leaf_l,
thigh_r, calf_r, foot_r, ball_r, ball_leaf_r
```

---

## 2. 三個必踩的坑（這次實做遇到的）

1. **尺寸不合**：下載的衣服是別的身體做的，常常偏大。例：第一版上衣比軀幹寬約 40%，
   不縮放就會浮在外面。→ 綁骨**之前**先縮放合身。
2. **正反面相反**：下載的模型朝向不一定對，綁完會背面朝前。→ 綁骨前先確認面向 +Z（正面）。
3. **骨頭順序不一致**：若用別的骨架匯出，遊戲端 rebind 會把頂點對到錯骨頭、變形亂掉。
   → 一定要綁到「從身體匯入的那套 armature」。

---

## 3. Blender 綁定流程（給接了 blender-mcp 的桌面版 Claude 或手動）

> 本機 Blender 跑這支沒問題。雲端沙盒的 `bpy` pip 模組有 glog 初始化崩潰問題，**不要**在雲端跑。

```python
import bpy

BODY    = r"<repo>/packages/shared/characters/body/male.glb"
GARMENT = r"<repo>/packages/shared/characters/top/shirt01.glb"   # 換成要處理的衣物
OUT     = r"<repo>/packages/shared/characters/top/shirt01_rigged.glb"

# 1) 乾淨場景
bpy.ops.wm.read_factory_settings(use_empty=True)

# 2) 匯入身體（帶 armature），確認骨頭數=65
bpy.ops.import_scene.gltf(filepath=BODY)
armature = next(o for o in bpy.context.scene.objects if o.type == 'ARMATURE')
assert len(armature.data.bones) == 65, "骨架骨頭數不對，請確認是正確的身體檔"

# 3) 匯入衣物，取得 mesh
before = set(bpy.context.scene.objects)
bpy.ops.import_scene.gltf(filepath=GARMENT)
garment = next(o for o in bpy.context.scene.objects
               if o not in before and o.type == 'MESH')

# 4) 合身：量身體目標區域寬度（Blender 是 Z-up，身高=Z；排除手臂取 |x|<0.3），等比縮放
def region_width(zmin, zmax):
    xs = []
    for o in bpy.context.scene.objects:
        if o.type == 'MESH' and o is not garment:
            for v in o.data.vertices:
                w = o.matrix_world @ v.co
                if zmin <= w.z <= zmax and abs(w.x) < 0.30:
                    xs.append(w.x)
    return (max(xs) - min(xs)) if xs else 0.0

body_w  = region_width(1.15, 1.35)            # top→胸口；bottom→改 0.7~0.95；shoe→0.0~0.15
gx = [(garment.matrix_world @ v.co).x for v in garment.data.vertices]
garment_w = max(gx) - min(gx)
if garment_w > 0 and body_w > 0:
    s = (body_w / garment_w) * 1.25           # ← 縮放係數；越大越寬鬆，視覺微調這個數字
    garment.scale = (s, s, s)                  # 只想拉長→改成 (1.1, 1.1, 1.3) 之類的逐軸值
    bpy.context.view_layer.objects.active = garment
    bpy.ops.object.transform_apply(scale=True)

# >>> 重要：這裡截一張「正面」和「側面」viewport 圖確認 <<<
#   - 大小是否包住身體？不合就調 garment.scale / garment.location 再截圖，反覆到貼合。
#   - 正反面對不對？衣服正面要朝 +Z（角色正面）。背面朝前就把衣服繞 Z 轉 180 度：
#       garment.rotation_euler[2] += 3.14159; bpy.ops.object.transform_apply(rotation=True)

# 5) 用身體骨架做 Automatic Weights 綁定
bpy.ops.object.select_all(action='DESELECT')
garment.select_set(True)
armature.select_set(True)
bpy.context.view_layer.objects.active = armature
bpy.ops.object.parent_set(type='ARMATURE_AUTO')

# 6) 驗證：把 upperarm_l / upperarm_r 各轉約 1 弧度擺 A-pose 截圖，確認衣物有跟著、不浮、無破面
#    驗證後把骨架轉回 T-pose 再匯出。

# 7) 只匯出「衣物 mesh + armature」
bpy.ops.object.select_all(action='DESELECT')
garment.select_set(True)
armature.select_set(True)
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB',
                          use_selection=True, export_skins=True)
print("DONE ->", OUT)
```

**各槽位的目標區域高度帶（`region_width` 的參數，Blender Z-up）：**

| 槽位 | 區域 | z 範圍參考 |
|------|------|-----------|
| top（上衣） | 胸口 | `1.15 ~ 1.35` |
| bottom（褲） | 臀/大腿 | `0.70 ~ 0.95` |
| shoe（鞋） | 腳 | `0.00 ~ 0.15` |
| head（帽） | 頭 | 多用 attach 到 Head 骨，見下 |

> 剛性配件（帽子、武器、眼鏡）不需變形，可改用「綁到單一骨頭（如 Head）」而非整套權重。

---

## 4. 接進遊戲（dashboard 端）

1. **放檔案**：`packages/shared/characters/<slot>/<id>.glb`
   （注意：`packages/dashboard/main/public/characters` 是指向 `packages/shared/characters` 的符號連結，
   檔案要放在 `shared` 那邊才會被 git 追蹤。）

2. **加選項**：`packages/dashboard/main/src/app/npc/appearances/page.tsx` 的 `SHARED_CATALOG`：
   ```ts
   top: [
     { id: null, labelKey: 'npc.appearances.none' },
     { id: 'shirt01', labelKey: 'npc.appearances.top.shirt01', thumbnailKey: 'top/shirt01' },
     { id: 'shirt01_rigged', labelKey: 'npc.appearances.top.shirt01Rigged', thumbnailKey: 'top/shirt01_rigged' },
   ],
   ```

3. **加語系**：`src/locales/en.ts` 與 `src/locales/zh-TW.ts` 各加一行對應的 `labelKey`。

4. **不用改渲染邏輯**：`CharacterViewer.tsx` 的 `loadEquipmentSlot` 已會自動 rebind skinned 衣物到身體骨架。

---

## 5. 驗收清單

匯出後，這幾項要全過（可請雲端 Claude 解析 GLB 驗證）：

- [ ] `skins` = 1，mesh 有 `JOINTS_0` 和 `WEIGHTS_0`
- [ ] joints = 65，且**骨頭順序與身體逐一相同**
- [ ] 套到身體上：貼合、不浮、跟著 A-pose 動、無明顯破面
- [ ] 正面朝前（正反面正確）
- [ ] 尺寸合身（不會太大太鬆或太小露肉）

---

## 附：本次上衣（shirt01）實做紀錄

- 來源：下載的靜態 `shirt01.glb`，比軀幹寬約 40%、無骨架。
- 處理：縮放合身 → Automatic Weights 綁到身體 65 骨架 → 修正正反面 → 匯出 `shirt01_rigged.glb`。
- 結果：skinned、骨頭順序相符，貼合並跟著身體姿勢。造型管理多了「襯衫（綁骨版）」選項。
