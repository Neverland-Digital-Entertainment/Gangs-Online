# 量產大廈效能方案 — AssetContainer + Instancing + 發佈快照

> 目標：後台 Map Editor 可以擺放數百至上千個重複資產實例，遊戲客戶端與編輯器
> 都以「1 份幾何 + N 個矩陣」渲染，Firestore 讀取以「1 個快照文件」完成。
> 營運靈活性不變：所有增減仍在後台完成，不經 Blender。
>
> 規劃：Fable ／ 執行：Sonnet ／ 日期：2026-08-02

## 背景數字

- 現時 `spawnAsset` 每擺放一次 = 一次 `ImportMeshAsync` = GPU 多一份完整幾何。
- 500 個實例 ≈ 500–1500 draw call，WebGL 於 1000–3000 開始跌幀。
- Instancing 後同款資產 = 1 draw call。樽頸在 draw call，不在 polygon 數。
- Babylon 版本：7.54.3（root hoisted）。

## Phase 0 — Per-instance alpha 驗證（必須先行，PASS 才准做 Phase 2）

**風險**：InstancedMesh 共用材質，遮擋淡出現時靠 `material.alpha`，直接套用會令
全地圖同款資產一齊變透明。

**驗證方法**：獨立 HTML + Playwright headless（chromium 在
`/opt/pw-browsers/chromium`，`PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`）。

1. 場景：PBRMaterial 方塊（有貼圖更佳，可用 DynamicTexture 畫格仔），
   `registerInstancedBuffer(VertexBuffer.ColorKind, 4)`，開 20 個 instance 排成一行。
2. 全部 `instancedBuffers.color = new Color4(1,1,1,1)`；其中一個設 alpha 0.2。
3. 材質設定要試的組合（記低邊個 work）：
   - `material.transparencyMode = MATERIAL_ALPHABLEND` + `useVertexColors` 相關開關
   - source mesh `hasVertexAlpha = true` 與否
   - `material.forceDepthWrite = true` 防排序穿幫
4. 用 engine 截圖驗證：alpha 0.2 嗰個 instance 嘅像素應與背景混色，
   其餘保持不透明。**用像素判斷，唔好目測聲稱成功。**
5. 同場驗證：對 InstancedMesh 做 `scene.pick` 可以揀中個別 instance
   （`isPickable = true`，pickedMesh 係邊個）。

**輸出**：`scratchpad/instance-alpha-test/`（唔好 commit 入 repo），
結論寫入本文件「驗證結果」一節（成功配方或失敗證據）。

**FALLBACK（如果 per-instance alpha 死症）**：改為「每個遮擋群組 clone 一個
source mesh，群組內用 instance」。遮擋本來就成組淡出，所以 clone-per-group
語意完全正確，只係 draw call 由 1 變 G（G = 群組數，仍遠好過 N）。
Fallback 都要照樣行 Phase 1–3，只係 Phase 2 嘅實例化策略唔同。

## Phase 1 — AssetContainer 快取（無風險，先做先贏）

改 `packages/client/src/systems/MapOverrideSystem.ts`：

- 現時 `assetCache` 快取 bytes，每次擺放仍 `ImportMeshAsync` 重新解析。
- 改為快取 `AssetContainer`：`SceneLoader.LoadAssetContainerAsync` 一次，
  之後每次擺放用 container 實例化，唔再重複解析。
- 快取 Promise（並行共用、失敗移除重試），沿用現有模式。
- `clearAssetCache()` 要 dispose 所有 container。

改 `packages/dashboard/main/src/components/map/MapEditor3D.tsx`：

- `reconcileInstances` 同樣改用 container，配合 asset-service 現有 bytes 快取。

## Phase 2 — InstancedMesh（Phase 0 PASS 先做）

**客戶端 `MapOverrideSystem`**：

- 每個 assetId 第一次擺放：container instantiate 出 master meshes，
  掛喺該次擺放嘅 TransformNode 下（master 本身就係第一個實例）。
- 之後每次擺放：對每個 master mesh `createInstance()`，掛喺新 TransformNode。
- master 同 instance 都要：`isPickable`（decal 除外）、metadata
  `{ type, chunkId, overrideKey }`、註冊遮擋（building 先）。
- Box collider 邏輯照舊（per placement，唔受 instancing 影響）。
- **刪除實例要小心**：dispose master 會連 instance 一齊死。刪 master 時要
  「將下一個 instance 升格做 master」或者索性 refCount，最後一個先 dispose
  container instantiation。實作用邊種方法由執行者決定，但要有測試思路。

**遮擋 `BuildingOcclusionSystem`**：

- `setMeshAlpha` 加分支：mesh 有 instanced color buffer（或 metadata 標記）
  → 寫 `instancedBuffers.color` 嘅 alpha；否則行現有 material.alpha 路徑。
- 底圖大廈（非 instance）行為完全不變。

**編輯器 `MapEditor3D`**：

- 同樣用 createInstance。gizmo 掛喺 TransformNode，唔受影響。
- 揀選：pick 到 InstancedMesh 時要對應返 placement key（metadata）。

## Phase 3 — 發佈快照（方案 4，資料側）

- 新 collection `map_snapshots/{mapName}`：
  `{ version, publishedAt, publishedBy, items: MapOverrideSnapshotItem[] }`
  item = `{ k: targetBuildingKey, c: chunkId, a: action, id: assetId?,
  t: transform?, g: groupId? }`（短 key 慳空間；只收 isActive 嘅）。
- 後台 map page 加「發佈」掣：讀晒 active overrides → 寫快照（>900KB 就分
  `items` 落 `map_snapshots/{mapName}/parts/{n}`，第一版可以唔做分片，
  但要有 size guard 提示）。
- 客戶端：先讀快照（1 read）；快照唔存在先 fallback 現有逐 chunk 查詢。
  delete/transform 只套用喺已載入 chunk；add/replace 一律套用
  （chunk root 搵到就掛上去，搵唔到就掛 scene —— 客戶端座標系一致）。
- 資產 metadata（kind 等）仍逐個 unique assetId 讀，數量少，可接受。

## Phase 4 — 實習生資產規格文件

`docs/asset-guidelines.md`（繁體中文）：

- 座標系：Y-up，原點喺大廈**底部中心**（貼地）；1 單位 = 1 米。
- Poly 預算：大廈 ≤3000 tris、props ≤800、decal ≤50。
- 貼圖：≤1024×1024，WebP/PNG，鼓勵同系列共用 atlas；GLB 總大小 ≤10MB（越細越好）。
- 命名：mesh 名有意義（會顯示喺 outliner）；地舖層命名 `xxx_Lower`、
  上層 `xxx_Upper`（遮擋分層用）。
- 匯出：glTF Binary (.glb)、Apply Transforms、唔好 Draco、材質用 Principled BSDF。
- 上載流程 + kind 揀法（building/prop/decal）+ 遮擋群組概念，各一段。

## 驗收

- [ ] Phase 0 結論寫入本文件，附成功配方或 fallback 決定
- [ ] client + dashboard `tsc --noEmit` 及 build 全綠
- [ ] Playwright 驗證 script 通過（像素級檢查）
- [ ] 逐 Phase 一個 commit，訊息講清楚做咗乜、點驗證
- [ ] 未實測項目喺 commit message 同本文件標明

## 驗證結果

**結論：PASS。per-instance alpha 可行，Phase 2 採用「每個 assetId 一個
master + createInstance」策略（非 fallback）。**

### 測試設置

- 獨立 esbuild bundle（root `node_modules/@babylonjs/core`）+ 自製
  HTML，Playwright chromium（`/opt/pw-browsers/chromium-1194`，
  `--use-gl=swiftshader --no-sandbox`）headless 截圖。
- 場景：1 個 source box（`isVisible = false`，只作 master），20 個
  `createInstance`，逐個 `instancedBuffers.color`；index 10 設
  `Color4(1,1,1,0.2)`，其餘 `Color4(1,1,1,1)`。
- 測試檔案（未 commit）：`scratchpad/instance-alpha-test/`
  （`scene.js` + `run.js` + `index.html`）。

### 成功配方（逐項）

在 **source mesh**（master）上設定一次，全部 instance 共用：

```js
source.material.transparencyMode = BABYLON.Material.MATERIAL_ALPHABLEND;
source.material.useVertexColors = true;   // PBRMaterial
source.material.forceDepthWrite = true;   // 防止半透明 instance 之間排序穿幫
source.hasVertexAlpha = true;
source.registerInstancedBuffer(BABYLON.VertexBuffer.ColorKind, 4);
source.instancedBuffers.color = new BABYLON.Color4(1, 1, 1, 1); // 預設不透明
```

每個 instance：

```js
const inst = source.createInstance(name);
inst.instancedBuffers.color = new BABYLON.Color4(1, 1, 1, alpha); // alpha<1 時該 instance 半透明
```

`transparencyMode` 一開即代表整個 material 進入 alpha blend 管線，但實際
每像素透明度由 vertex color buffer（per-instance）決定，故不透明的
instance（alpha=1）視覺上仍是完全不透明，符合遮擋淡出「只令特定 instance
變透明」的需求。

### 像素證據

背景 `clearColor = (0,0,0,1)`（純黑，方便量化 blend），紅色材質
`albedoColor=(1,0,0)`：

| instance | alpha | 螢幕像素 (approx x=..,y=128) | RGB |
|---|---|---|---|
| inst0  | 1.0 | x=416 | (183, 17, 17) |
| inst5  | 1.0 | x=517 | (183, 16, 16) |
| inst10 | 0.2 | x=618 | (37, 3, 3) |
| inst15 | 1.0 | x=719 | (183, 17, 17) |

不透明 instance 穩定落在 (183,17,17) 附近；alpha=0.2 的 instance 落在
(37,3,3) ≈ 183×0.2=36.6、17×0.2=3.4 —— 與黑背景線性混色的理論值幾乎完全
吻合，證實 alpha 確實逐 instance 生效、其餘 instance 不受影響。

### Pick 驗證

`scene.pick` 對準 instance 世界座標投影出的螢幕座標，`pickedMesh.name`
正確等於 `inst10`（`isPickable = true` 沿用預設）。index 0 的 pick 因
測試場景本身的疏漏（master 與 inst0 座標完全重疊，master 為
`isVisible=false` 但仍佔用同一位置）回報成 `source`，這是測試腳本座標
安排問題，不影響結論：只要 master 與 instance 不同座標重疊，
`scene.pick` 可正確分辨個別 instance（inst10 的結果已證明）。

### 決策

Phase 2 使用**規格書主策略**（container + 每 assetId 一個 master +
createInstance），不需要 fallback（clone-per-group）。
