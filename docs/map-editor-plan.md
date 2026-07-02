# 後台地圖編輯器 — 製作計劃與進度

> 目的：在後台（dashboard）製作一個 Map Editor，讀取現有地圖、編輯地圖上的大廈與
> props（移走 / 移動 / 旋轉 / 縮放 / 替換 / 新增），並讓遊戲客戶端套用這些編輯。
>
> 最後更新：2026-06-19

---

## 進度總覽 (TODO)

| 階段 | 內容 | 狀態 |
|---|---|---|
| **P0** | 驗證：mesh 命名唯一性、GLB 格式、Storage 就緒 | ✅ 已完成 |
| **P1** | 後台 3D 檢視器：載底圖 → 渲染 → 射線點選大廈/props → 高亮 + Inspector 顯示 | ✅ 已完成 |
| **P2** | 操作既有：移走 / 移動 / 旋轉 / 縮放 + GizmoManager + 寫 `map_overrides` | ✅ 已完成 |
| **P3** | 資產庫：後台選檔上載 GLB 到 Storage + 縮圖 + `building_assets` CRUD | ✅ 已完成 |
| **P4** | 替換 / 新增：從資產庫挑模型放到地圖 | ✅ 已完成 |
| **P5** | 客戶端 `MapOverrideSystem`：讀取並套用全部 override（含碰撞/遮擋修補） | ✅ 已完成 |
| **P6** | 收尾：可編輯數值、啟用/停用 override、管理員權限 | ✅ 已完成 |

> 狀態圖例：⬜ 未開始 ／ 🔄 進行中 ／ ✅ 已完成
>
> **每完成一個階段，更新上表狀態，並在文末「進度紀錄」補一筆。**

---

## 鎖定的設計決定

- **呈現方式**：dashboard 內用 Babylon.js 真實 3D 檢視器（套件已具備，無需新增依賴）。
- **儲存機制**：Firebase 覆蓋層 — 原始 GLB **永不修改**，所有編輯以「指令」記錄在 Firestore，客戶端載入地圖後再套用。可隨時還原、可版本化。
- **能力**：移走 / 移動 / 旋轉 / 縮放既有大廈與 props ＋ 替換成上載的模型 ＋ 新增建築。
- **範圍 v1**：只做主地圖 chunks（`manifest.chunks`）。Prison 等室內場景命名不符規範、無法靠名稱定址，暫不支援。
- **底圖 GLB 來源**：維持靜態檔，由現有 Cloudflare Pages 免費供應，後台用網址 `fetch` 載入，**不佔 Firebase Storage 額度**。
- **上載資產來源**：後台選檔 → 上傳 **Firebase Storage**（`building-assets/` 路徑）+ 縮圖；metadata 存 Firestore `building_assets`。
- **大廈識別碼**：`chunkId:meshName`（P0 已驗證主地圖 mesh 名稱唯一，無需雜湊備援）。

---

## P0 驗證結論

| 項目 | 結果 |
|---|---|
| 大廈識別碼穩定性 | ✅ 主地圖 chunks 的 `B`/`T`/`I` mesh 名稱唯一（如 `B356181964601063A0`），`chunkId:meshName` 可直接當 key |
| GLB 格式 | ✅ 無 Draco，標準 glTF loader + `EXT_texture_webp` 即可載入；node 帶 `translation`，transform 覆蓋可乾淨套用 |
| 座標系 | ✅ 巨大原始世界座標（百萬級，非置中）→ 必須用真實 3D 檢視器，原 2D `MapPositionPicker` 不適用 |
| Firebase Storage | ✅ 後台 `firebase/config.ts` 已初始化並匯出 `storage`，可直接做選檔上載 |
| Prison 場景 | ⚠️ Sketchfab 匯出、254 node、名稱大量重複（`BED` x12 等）且 `B` 前綴會誤判（床被當建築）→ v1 排除 |

**檢測檔案**：`packages/client/public/maps/{11-NW-19D,11-NW-19B,Prison}.glb`
- `11-NW-19D`：5 大廈 + 3 props + 1 地形，名稱全唯一（主要內容）
- `11-NW-19B`：僅 1 塊地形，無大廈
- `Prison`：室內場景，命名不可靠（排除）

---

## 系統架構與資料流

```
底圖 GLB（靜態, Cloudflare Pages, 免費, 不佔額度）
        │ fetch
        ▼
後台 MapEditor3D ──選檔上載──► Firebase Storage (building-assets/*.glb, 小檔)
        │                              │
        │ 寫編輯指令                     │ metadata
        ▼                              ▼
Firestore: map_overrides          Firestore: building_assets
        │
        │ 客戶端載完底圖後讀取並套用
        ▼
遊戲 client: MapOverrideSystem
  （隱藏/變換既有 mesh、載入資產、補回碰撞與遮擋）
```

**核心原則**：原始 GLB 永不修改。編輯 = 一筆筆 override 指令疊加在底圖上。

---

## 資料模型（Firestore）

### `building_assets` — 上載的建築資產
| 欄位 | 說明 |
|---|---|
| `id` | 文件 ID |
| `name` | 顯示名稱 |
| `glbPath` | Firebase Storage 路徑（`building-assets/xxx.glb`） |
| `thumbnailUrl` | 縮圖網址 |
| `category` | 分類（住宅/商業/幫派…） |
| `defaultScale` | 預設縮放 |
| `tags` | 標籤 |
| `createdAt` | 建立時間 |

### `map_overrides` — 每筆 = 一個編輯動作
| 欄位 | 說明 |
|---|---|
| `id` | 文件 ID |
| `mapName` | 所屬地圖（如 `HongKong`） |
| `chunkId` | 所屬 chunk（如 `11-NW-19D`） |
| `targetBuildingKey` | 被操作的原始物件識別碼 = `chunkId:meshName` |
| `action` | `delete` ／ `transform` ／ `replace` ／ `add` |
| `assetId` | 指向 `building_assets`（`replace` / `add` 用） |
| `transform` | `{ position:{x,y,z}, rotation:{x,y,z}, scale:{x,y,z} }` |
| `isActive` | 是否生效（可停用以還原） |
| `createdAt` / `updatedAt` / `updatedBy` | 稽核欄位 |

**action 對應客戶端行為**
| action | 客戶端動作 |
|---|---|
| `delete` | `mesh.setEnabled(false)` 隱藏既有 mesh |
| `transform` | 改既有 mesh 的 position / rotation / scale |
| `replace` | 隱藏原 mesh，於原位載入 `assetId` 的 GLB + 套 transform |
| `add` | 於指定位置載入 `assetId` 的 GLB |

---

## 要新增的檔案（規劃）

### dashboard（`packages/dashboard/main`）
| 層 | 檔案 | 職責 |
|---|---|---|
| 型別 | `src/types/map.ts` | `BuildingAsset`、`MapOverride` 介面 |
| 服務 | `src/lib/map/asset-service.ts` | 資產 CRUD + Storage 上載 + 縮圖 |
| 服務 | `src/lib/map/override-service.ts` | 覆蓋層 CRUD（仿 `lib/npc/instance-service.ts`） |
| 頁面 | `src/app/map/page.tsx` | 選地圖進編輯器 |
| 頁面 | `src/app/map/assets/` | 資產庫 CRUD + 上載 GLB |
| 元件 | `src/components/map/MapEditor3D.tsx` | 核心 3D 場景：載 GLB、射線選取、GizmoManager |
| 元件 | `src/components/map/BuildingInspector.tsx` | 右側面板：替換 / transform / 刪除 |
| 元件 | `src/components/map/AssetPicker.tsx` | 從資產庫挑模型 |

### client（`packages/client`）
| 檔案 | 職責 |
|---|---|
| `src/systems/MapOverrideSystem.ts` | 在 `SceneManager.initialize()` 載完 chunks 後讀取並套用 override |

---

## 各階段細節

### P1 — 後台 3D 檢視器（唯讀）
- 以 `@babylonjs/core` + `@babylonjs/loaders/glTF` 在 React 元件中建立 Babylon 場景。
- `fetch` 底圖 GLB（沿用客戶端分類邏輯：`B`=大廈、`I`=props、`T`=地形）。
- 滑鼠射線點選 → 高亮選中 mesh → Inspector 顯示名稱、座標、包圍盒。
- 產出：可瀏覽地圖、可選取物件。

### P2 — 操作既有物件
- 整合 Babylon **GizmoManager**（移動/旋轉/縮放手柄）。
- 「移走」= 寫 `delete` override；「移動/旋轉/縮放」= 寫 `transform` override。
- 編輯器即時套用 override 呈現結果。
- 產出：後台可編輯既有大廈/props 並存檔。

### P3 — 資產庫
- 後台 `<input type="file">` 選檔 → `uploadBytes()` 上傳到 Storage `building-assets/`。
- 自動產生縮圖（可用 Babylon 離屏渲染擷圖）。
- `building_assets` 的 CRUD 頁面。
- 產出：可累積可替換/新增用的建築素材。

### P4 — 替換 / 新增
- Inspector 加「替換」：選資產 → 寫 `replace` override。
- 「新增」：從資產庫拖入 → 寫 `add` override。
- 產出：完整編輯能力。

### P5 — 客戶端套用
- `MapOverrideSystem` 讀 `map_overrides`（依 `mapName`/`chunkId`）。
- 依 action 套用；replace/add 載入的 mesh 要**補回** `checkCollisions`、`isPickable`、`metadata.type="building"`，並註冊進 `BuildingOcclusionSystem`。
- 產出：遊戲內看到編輯結果，碰撞與遮擋正常。

### P6 — 收尾
- override 還原 / 停用（`isActive`）。
- 管理者權限驗證（地圖編輯影響全服）。
- 編輯器內「最終效果預覽」（套用所有 active override）。

---

## 已知風險與注意事項

1. **Prison 等室內場景**：命名不可靠，v1 不支援。日後若要支援，需以「名稱 + 包圍盒中心雜湊」當識別碼。
2. **資產規格一致性**：上載的建築 GLB 座標系/原點/縮放需與現有地圖一致，否則放上去會歪或大小不對。
3. **Storage 容量**：免費約 5GB。底圖維持靜態檔不佔額度；只有上載的小建築佔用。日後若不足可改用 Cloudflare R2（免費 10GB、無下載流量費）。
4. **底圖跨來源讀取**：後台從 Cloudflare Pages 網址 fetch 底圖 GLB 需處理 CORS。
5. **碰撞/遮擋修補**：replace/add 進來的 mesh 必須補齊原本的設定，否則玩家會穿牆或透明遮擋失效。

---

## 進度紀錄

- **2026-06-19** — P0 完成。驗證主地圖 mesh 命名唯一、GLB 無 Draco、Firebase Storage 就緒；確立完整設計決定並建立本計劃文件。
- **2026-06-21** — P1 完成。後台新增 `/map` 地圖編輯器頁面（側欄已掛入口）：
  - `src/types/map.ts`：型別 + `classifyMeshName` / `buildObjectKey`
  - `src/lib/map/map-loader.ts`：從 `NEXT_PUBLIC_MAP_BASE_URL` 載入 manifest 與 GLB
  - `src/components/map/MapEditor3D.tsx`：Babylon 3D 場景，載入 chunk、依名稱分類、射線點選 + 黃色高亮
  - `src/components/map/BuildingInspector.tsx`：右側面板顯示選中物件（名稱/類型/區塊/key/位置/旋轉/縮放/尺寸）
  - 中英文語系與 `.env.example` 已更新。
  - 已通過 `tsc --noEmit`。**瀏覽器實機驗證待辦**：需先把 `NEXT_PUBLIC_MAP_BASE_URL` 指向有在執行的地圖來源（本地預設 `http://localhost:5173/maps`，即 client `npm run dev:client`）。

- **2026-06-21** — P2 完成。既有物件編輯（移動/旋轉/縮放/移走）+ Firestore：
  - `src/lib/map/override-service.ts`：`map_overrides` 的 Firestore CRUD（仿 instance-service）
  - `MapEditor3D.tsx`：整合 `GizmoManager`（移動/旋轉/縮放）、拖曳即時回報 transform、
    依 `overrides` 調和場景（transform 套用、delete 隱藏、無 override 還原原始）
  - `BuildingInspector.tsx`：操作模式切換、即時 transform、儲存/移走/還原、狀態徽章
  - `app/map/page.tsx`：載入該 chunk 的 overrides、儲存/移走/還原寫入 Firestore
  - 中英文語系新增 `map.editor.*` / `map.status.*`
  - 已通過 `tsc --noEmit` 與 `next build`（含 /map 路由）。
  - **資料寫入待你以真實 Firebase 環境實測**（需 Firestore 規則允許後台寫入 `map_overrides`）。

- **2026-06-21** — P3 完成。建築資產庫（上載 + 縮圖 + CRUD）：
  - `src/lib/map/asset-service.ts`：`building_assets` Firestore + Storage CRUD
    （GLB 存 `building-assets/`、縮圖存 `building-thumbnails/`）
  - `src/lib/map/thumbnail.ts`：離屏 Babylon 渲染自動產生 GLB 縮圖（動態 import，SSR 安全）
  - `src/app/map/assets/page.tsx`：選檔上載（檔名/分類/縮放/標籤）、縮圖網格、編輯、刪除
  - 側欄改為「地圖管理」群組（地圖編輯器 + 建築資產）
  - `BuildingAsset` 型別調整為 `glbUrl` + `storagePath`，新增 `BuildingAssetInput`
  - 中英文語系新增 `nav.mapEditor/mapAssets`、`map.assets.*`
  - 已通過 `tsc --noEmit` 與 `next build`。
  - **待真實 Firebase 實測**：上載需 Storage 規則允許寫入 `building-assets/`、`building-thumbnails/`。

- **2026-06-21** — P3 修正。上載卡在 "Uploading..." 幾分鐘的問題：
  - 改為「先上傳 GLB 成功才寫完整 doc」（避免 Storage 失敗留下半成品 doc）
  - Storage 操作加逾時 + 縮短 `maxUploadRetryTime`（~20s 內就失敗並顯示真正錯誤）
  - 縮圖改為非阻斷（GLB 上傳完資產即建立，縮圖另外嘗試）
  - 上載錯誤訊息會附帶實際原因，方便診斷（多半是 Storage bucket 設定或安全規則）

- **2026-06-21** — P3 改儲存後端（免費方案無 Firebase Storage）。改為 **Firestore-only**：
  - GLB 以 base64 分塊存子集合 `building_assets/{id}/chunks/{index}`（每塊 <1MB）
  - 縮圖改 JPEG，以 data URL 存在 `building_assets` 文件
  - `asset-service` 移除所有 Storage 呼叫，改用 `writeBatch` 寫入；新增
    `loadGlbObjectUrl(id)` 供 P4/P5 重組成 object URL 載入
  - 上載大小上限 10MB（`MAX_ASSET_BYTES`），超過前端擋下
  - `BuildingAsset` 型別：移除 `glbUrl/storagePath/thumbnailPath`，新增 `mimeType/chunkCount`
  - 已通過 `tsc --noEmit` 與 `next build`。**完全免付費、用現有 Firestore 即可。**

- **2026-06-21** — P4 完成。替換 / 新增：
  - `MapEditor3D`：用 `loadGlbObjectUrl` 從 Firestore 載入資產 GLB，掛在容器
    TransformNode 下並 parent 到底圖 `__root__`（與既有大廈共用 local 座標）；
    依 overrides 調和 replace（隱藏原 mesh + 顯示資產）與 add（新增資產實例），
    可點選、gizmo 移動/旋轉/縮放、即時回報 transform
  - `AssetPicker.tsx`：從資產庫挑模型（縮圖網格）
  - `BuildingInspector`：新增「替換成資產／更換資產」、replaced/added 狀態、
    新增物件的「刪除此建築」
  - `app/map/page.tsx`：載入 assets、「新增建築」按鈕、replace/add 寫入 `map_overrides`，
    儲存時保留 replace/add 的 action
  - 中英文語系新增 `map.status.replaced/added`、`map.editor.replace/changeAsset/addBuilding/deleteBuilding`
  - 已通過 `tsc --noEmit` 與 `next build`。
  - **待瀏覽器實測**：替換/新增的初始擺放位置與朝向可能需用 gizmo 微調（座標/朝向
    在編輯器與客戶端會一致）；縮圖空白仍為已知小問題。

- **2026-06-22** — P4 座標修正 + 診斷：
  - 改以「物件節點」(底圖 `__root__` 直接子節點，帶真實座標) 為操作單位，
    取代先前誤用的 primitive mesh（本身 0,0,0）→ 修正既有大廈顯示真實座標、
    replace 預設放回原位
  - 新增建築預設放到目前鏡頭焦點（視角中央）
  - 雙擊物件 → 鏡頭拉近至該模型實際大小（hierarchy bounding）
  - 物件列表 + 點選聚焦 + 載入失敗診斷

- **2026-06-22** — P5 完成。遊戲客戶端套用 override：
  - `client/src/systems/MapOverrideSystem.ts`：載完 chunks 後從 Firestore 讀
    `map_overrides`（依 chunkId），套用 delete（隱藏節點）/ transform（套 local
    transform）/ replace（隱藏原節點 + 載資產）/ add（載資產）；資產 GLB 從
    `building_assets/{id}/chunks` 重組 object URL 載入；新增/替換的 mesh 補上
    `checkCollisions`、`isPickable`、`metadata.type=building`、材質複製，並註冊進
    `BuildingOcclusionSystem`
  - `FirebaseService.getApp()`、`SceneManager.getOcclusionSystem()` 對外暴露
  - `main.ts`：`sceneManager.initialize()` 完成後呼叫 `mapOverrideSystem.apply()`
  - 客戶端不平移地圖；override.transform 為節點 local 座標，掛在該 chunk __root__
    下套用即對齊原始世界座標（與後台一致）
  - 已通過 client `tsc --noEmit`（需先 build shared）與 `vite build`。
  - **端到端待實測**：在後台編輯並儲存後，進遊戲應看到移走/移動/替換/新增生效。

- **2026-06-22** — P6 完成：
  - Inspector 的位置/旋轉(度)/縮放改為可手動輸入，即時套用到 3D 並可儲存
  - override 可啟用/停用（isActive），停用不刪除、遊戲端不套用；列表/Inspector 顯示「已停用」
  - 管理員權限：Firebase Auth（Google 登入）+ `NEXT_PUBLIC_ADMIN_EMAILS` email 白名單，
    `AuthProvider` + `AuthGate` 包住整個後台；側欄顯示登入帳號與登出
  - 已通過 `tsc --noEmit` 與 `next build`
  - 後續安全強化：應在 Firestore/Storage 規則層強制管理員（前端閘門僅第一層）

### 地圖來源（同源 /maps）
後台預設以同源 `/maps` 供應底圖，免第二個 server、無 CORS：
- `scripts/copy-maps.mjs` 會在 `npm run dev` / `npm run build` 前（`predev`/`prebuild`）
  自動把 `packages/client/public/maps` 複製到 `packages/dashboard/main/public/maps`
  （該資料夾已 gitignore，不進版控、不佔 Firebase 額度）。
- 若要改從外部來源載入，設定 `NEXT_PUBLIC_MAP_BASE_URL`（該來源需允許本後台 origin 的 CORS）。

### 本地測試方式
1. `cd packages/dashboard/main && npm run dev`（port 3001；predev 會自動複製地圖）。
   設定好 `.env.local`（Firebase 變數即可，`NEXT_PUBLIC_MAP_BASE_URL` 可不設）。
2. 開 `http://localhost:3001/map`，選擇 chunk（預設 `11-NW-19D`），點擊大廈/props 檢視資訊。
