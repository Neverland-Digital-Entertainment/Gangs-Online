# 衣物綁定流程（紙娃娃換裝 SOP）

把「下載來的靜態衣服」變成「貼合身體、跟著骨架變形」的可換裝部件的標準流程。
適用於 NPC Appearance Management（造型管理）的 `top / bottom / shoe / head` 槽位
（`hair / beard` 本來就是綁好骨的資產）。

> 現在由自動工具完成：**`tools/paperdoll/`**（詳細用法、參數、驗收見該資料夾的 `README.md`）。
> 舊版「在 Blender 用 Automatic Weights 手動綁」的流程已淘汰——它會讓衫袖綁到上身、手臂穿出衫袖，
> 而且只對男身體有效。

---

## 1. 核心觀念

### 共用骨架（Shared Skeleton）

身體和每一件衣物都綁在**同一套 65 根骨頭的骨架**、同一個 T-pose bind pose 上。
`CharacterViewer.tsx` 的 `loadEquipmentSlot` 載入 skinned 衣物後會把它的 skeleton 換成身體的 skeleton，
所以衣物 GLB 必須：

- 骨頭數量、**順序**、inverse bind matrices 與身體完全一致
- vertex 座標就是「身體 bind pose」下的位置

### 男女各一份

男女身體骨架不同（女性膊頭窄約 6cm、矮 3–5cm、胸/臀形狀不同），而 vertex 是寫死在 bind pose 座標裡的，
**同一個 GLB 不可能同時合身兩個身體**。所以每件衣物都分開輸出：

```
packages/shared/characters/<slot>/male/<id>.glb
packages/shared/characters/<slot>/female/<id>.glb
```

`CharacterViewer` 會按性別從對應資料夾載入（`GENDER_SUBFOLDERED_SLOTS`）。

### 體型（瘦 ↔ 標準 ↔ 肥）

身體、衣物、頭髮、鬍鬚都帶住同名嘅 `thin` / `fat` morph target，Dashboard 嘅「體型」滑桿（-100…+100）同時控制全部。
`fit_garments.py` 會自動幫新衣物整埋瘦版同肥版，唔使另外出檔案（詳見 `tools/paperdoll/README.md`）。

---

## 2. 加一件新衣物（摘要）

1. 原始 GLB 放到 `tools/paperdoll/raw/<slot>/<id>.glb`
2. `tools/paperdoll/garments.json` 加一項（抄同類衣物再改；底層衣物排在外層前面）
3. `pip install -r tools/paperdoll/requirements.txt`（第一次）
4. `python tools/paperdoll/fit_garments.py <id>` → 看驗收輸出（skeleton OK、穿模數量）
5. Dashboard → 造型管理 檢查效果（或用 `tools/paperdoll/preview` 無頭截圖）
6. `packages/dashboard/main/src/app/npc/appearances/page.tsx` 的 `WEARABLES` 加 id，
   `src/locales/en.ts`、`zh-TW.ts` 加名稱

---

## 3. 以前踩過的坑（工具已自動處理）

| 坑 | 工具做法 |
|---|---|
| 下載的衣服是別的身體做的，尺寸不合 | optimizer 自動求縮放/各軸比例/位置 |
| 正反面相反 | `garments.json` 的 `yaw` |
| 衫袖是 45° 下垂造型、身體是 T-pose，衫袖被綁到上身 | 先把身體擺成衫袖角度再轉移權重，最後反向 skinning 回 T-pose |
| 衣服有厚度（內外兩層），碰撞時互相打架 | 自動刪除看不到的內層 |
| 肌肉位撐穿衣服、局部推出尖角 | 大範圍平滑膨脹 + Laplacian 碰撞 |
| 上衣衫腳和褲頭互穿 | 上衣以已 fit 好的褲作碰撞層（`over`） |
| 帽子尺寸差 5 倍、位置在 16 米高空 | 粗對位自動縮放；帽子以頭髮為厚度、只等比放大不變形 |

---

## 4. 驗收清單

`fit_garments.py` 會自動檢查並印出（任何一項不合格時 exit code = 1）：

- [ ] `skins` = 1，joints = 65，**骨頭順序與 IBM 與身體逐一相同**
- [ ] Dashboard A-pose：布 vertex 在身體內 < 1%、可見的皮膚穿出極少
- [ ] T-pose（bind pose）同樣乾淨
- [ ] 外層衣物沒有陷入內層衣物
- [ ] 人手確認：正面朝前、尺寸合身（看 Dashboard 或 preview 截圖）
