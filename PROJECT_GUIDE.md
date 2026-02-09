# Gangs Online - 項目架構指南

> **最後更新：** 2026-02-09
> **當前版本：** 0.16.3 - Shop & Economy System Complete
> **版本號位置：** `packages/shared/src/index.ts` - 所有端統一使用此版本號
> **目的：** 提供項目架構概覽，減少新對話中的重複代碼探索，節省 token 使用
>
> **重要：每次回應必須以繁體中文為主語言，再配以英文輔助**

---

## 📝 最新更新 (2026-02-09)

### Phase 19 - NPC 造型管理系統（開發中，標記為「即將推出」）

Dashboard 新增 NPC 造型管理頁面，使用 Babylon.js 3D 引擎在瀏覽器內即時預覽和編輯角色外觀。目前仍在開發中，Sidebar 已標記為「即將推出」，但頁面可通過 `/npc/appearances` 直接訪問進行測試。

#### 已完成功能
- **3D 角色預覽器**：使用 Babylon.js 7 的 `ArcRotateCamera` 實現 360° 旋轉查看
- **性別切換**：支援男性/女性身體模型載入（`body/male.glb`, `body/female.glb`）
- **裝備插槽系統**：6 個獨立插槽（hair, beard, head, top, bottom, shoe），支援獨立載入/卸載
- **性別專屬髮型**：男性（`hair/male/`）和女性（`hair/female/`）使用不同髮型資料夾
- **骨骼綁定**：有骨骼的裝備（髮型、鬍子）會綁定到身體骨骼（`mesh.skeleton = bodySkeletonRef`）
- **共享 TransformNode**：身體和所有裝備的 root 都 parent 到同一個 `characterRoot` 節點，確保位置對齊
- **髮色/鬍色修改**：即時修改 material 的 `albedoColor`/`diffuseColor`，材質先 clone 避免共用問題
- **性別感知 UI**：女性隱藏鬍子區塊，切換性別自動清除性別專屬裝備
- **3D 縮圖預覽**：使用離屏 Babylon engine 生成 128x128 縮圖，漸進式更新
- **Accordion UI**：6 欄位分類摺疊面板，選中項目顯示在 header，6 格/行的縮圖 grid
- **顏色選擇器**：髮型和鬍子區域有 `<input type="color">` 調色盤（選中配件後顯示）

#### 關鍵技術
- **Babylon.js SSR 安全**：使用 `dynamic()` + `{ ssr: false }` 載入 CharacterViewer
- **GLB 座標系統**：GLB `__root__` 節點有右手→左手座標轉換，不能手動旋轉模型，改用 camera alpha 調整視角
- **GLB 內建紋理**：GLB 自帶紋理和 UV mapping，不需要也不應該外部覆蓋 texture
- **共享資源**：`public/characters` → `../../../shared/characters` 符號連結，client 和 dashboard 共用
- **Shader 編譯**：縮圖生成必須 `await scene.whenReadyAsync()` 等待 shader 編譯完成，否則渲染空白
- **Bounding Box**：使用 `getHierarchyBoundingVectors(true)` 取得完整層級的邊界，過濾無頂點的 TransformNode

#### 已知問題
- **Cap 模型偏移**：`head/cap.glb` 頂點在 Z~-16 位置，且無 material，需要在 Blender 重新匯出（歸零原點、加上材質、綁定骨骼）
- **縮圖渲染**：部分骨骼綁定的配件縮圖可能仍有顯示問題（bounding box 受骨骼影響）
- **無骨骼裝備對齊**：服裝（top, bottom, shoe）無骨骼，依靠 TransformNode 父子關係對齊

#### 涉及的文件
- `app/npc/appearances/page.tsx` - 造型管理頁面（Accordion UI、性別切換、顏色選擇器）
- `components/npc/CharacterViewer.tsx` - 3D 角色預覽器（Babylon.js scene、裝備管理、骨骼綁定、顏色應用）
- `lib/character-thumbnails.ts` - 離屏 3D 縮圖生成器
- `components/layout/Sidebar.tsx` - 側邊欄新增造型管理入口（disabled, 即將推出）
- `app/npc/page.tsx` - NPC 管理頁新增造型管理卡片（coming soon）
- `locales/en.ts` / `locales/zh-TW.ts` - 新增 `npc.appearances.*` 相關翻譯 keys

#### 未來開發
- Phase 19.3: 動畫系統
- Phase 19.4: 更多顏色自訂（膚色等）
- Phase 19.5: UI 完善 + Firebase 資料持久化

---

### 過去更新 (2026-02-02)

### Dashboard UI/UX 改進
本次更新專注於改善 Dashboard 使用者體驗和一致性：

#### 1. 對話設定 UI 簡化
- **移除中間卡片 UI**：不再顯示「已設定對話樹，包含 X 個節點」的卡片
- **直接顯示編輯器**：打開 NPC 模板即直接看到 DialogueEditor
- **刪除功能改進**：刪除第一個對話節點 = 清空整個對話樹（含確認提示）
- **即時更新**：移除「儲存對話」按鈕，所有修改即時反映到表單，統一使用「更新模板」保存
- **技術細節**：
  - `DialogueEditor.tsx`: `onSave` → `onChange`，新增 `updateTree()` 統一更新邏輯
  - `TemplateForm.tsx`: 移除 `showDialogueEditor` 狀態，直接渲染編輯器
  - 所有 `setTree()` 改為 `updateTree()`，同步更新本地和父組件

#### 2. 側邊欄菜單更新
- **具體化菜單項**：
  - 第一項「即將推出」→「任務管理」(Quest Management)
  - 第二項「即將推出」→「設定」(Settings)
- **保持狀態**：維持「即將推出」badge 和 disabled 狀態
- **雙語支援**：zh-TW / en 翻譯同步更新

#### 3. NPC 管理列表樣式統一
- **按鈕風格一致**：所有按鈕統一使用 `btn-light` 樣式
  - 模板管理：啟用/停用、編輯、刪除按鈕
  - 實例管理：啟用/停用、編輯、刪除按鈕
- **刪除按鈕**：圖標改為紅色 (`text-red-500`)

#### 4. 物品管理列表增強
- **排序功能**：支援三個欄位排序（升序/降序）
  - 名稱 / 描述（使用名稱排序）
  - 類型（category）
  - 價格
- **排序 UI**：點擊 column header 切換，顯示圖標
  - `ArrowUpDown`: 未排序
  - `ArrowUp`: 升序
  - `ArrowDown`: 降序
- **欄位名稱**：「圖片網址」→「圖片」(Image URL → Image)
- **技術細節**：
  - 新增 `sortField`, `sortOrder` 狀態
  - `handleSort()` 處理排序切換
  - `applyFilters()` 整合排序邏輯
  - 使用 `localeCompare()` 處理字串排序

#### 5. 商店管理頁面優化
- **布局調整**：
  - 狀態 dropdown: 添加 `w-auto`，根據內容自動調整寬度
  - 搜尋輸入欄: 使用 `flex-1`，占用剩餘空間
- **篩選修復**：狀態篩選功能正常運作
  - 改為客戶端統一處理所有篩選
  - `filteredShops` 同時處理搜尋和狀態篩選
  - 移除 useEffect 對 filterActive 的依賴

#### 6. 預設語言調整
- **Dashboard 預設語言**：zh-TW → en
- **位置**：`packages/dashboard/main/src/contexts/i18n-context.tsx`
- **注意**：使用者的語言偏好仍會保存在 localStorage

### 修改的文件清單
```
packages/dashboard/main/src/
├── components/
│   ├── layout/Sidebar.tsx                    # 側邊欄菜單更新
│   ├── npc/DialogueEditor.tsx                 # 即時更新、刪除邏輯
│   └── npc/TemplateForm.tsx                   # 移除中間 UI 狀態
├── contexts/
│   └── i18n-context.tsx                       # 預設語言改為 en
├── locales/
│   ├── en.ts                                  # 翻譯更新
│   └── zh-TW.ts                               # 翻譯更新
└── app/
    ├── item/page.tsx                          # 排序功能
    ├── shop/page.tsx                          # 篩選修復、布局優化
    ├── npc/templates/page.tsx                 # 按鈕樣式統一
    └── npc/instances/page.tsx                 # 按鈕樣式統一
```

---

## 📦 項目結構

```
Gangs-Online/
├── packages/
│   ├── shared/          # 共享類型和常量（client + server + dashboard）
│   ├── client/          # Babylon.js 遊戲客戶端
│   ├── server/          # Colyseus 遊戲服務器
│   └── dashboard/main/  # Next.js 管理後台
```

---

## 🎯 核心系統架構

### 1. Shared Package (`@gangs-online/shared`)
**職責：** 定義所有跨包共享的類型、常量和接口

**關鍵文件：**
- `src/index.ts` - 所有共享類型和常量的單一導出點

**重要類型：**
- `PlayerData` (Colyseus Schema) - 玩家狀態同步（注意：使用 `firebaseUid` 而非 `uid`）
- `Enemy` (Colyseus Schema) - 敵人/NPC 狀態（注意：NPC 也使用此 schema，含 `linkedShopId` 欄位）
- `INPCTemplate` - NPC 模板接口（Firebase 存儲）
- `INPCInstance` - NPC 實例接口（Firebase 存儲，含 `shopId` 和 `isGuildOnly`）
- `INPCData` - 完整 NPC 數據（模板 + 實例組合，含 `linkedShopId`）
- `DialogueTree` / `DialogueNode` - 對話系統類型
- `IItem` - 道具接口（Firebase 存儲，含 `ItemCategory` 和價格）
- `IShop` - 商店接口（Firebase 存儲，含 `itemList` 和營業時間）
- `IShopItem` - 商店商品配置（庫存、限購、價格倍率）
- `IPurchaseRequest` / `IPurchaseResponse` - 購買請求/回應接口
- `GAME_CONSTANTS` - 遊戲常數（攻擊範圍、移動速度等）
- `GAME_VERSION` - **當前遊戲版本號（0.16.3）- 統一定義在此，所有端共用**

**注意事項：**
- `modelId` 字段為**可選** (`string | undefined`)
- 未設定時客戶端會加載預設模型 (HVGirl.glb)

---

### 2. Server Package (`@gangs-online/server`)
**職責：** Colyseus 多人遊戲服務器，處理遊戲邏輯和狀態同步

#### 核心文件結構

**房間系統：**
- `rooms/GameRoom.ts` - 主遊戲房間，處理玩家連接、移動、戰鬥
- `rooms/schema/GameState.ts` - Colyseus Schema 定義（玩家、敵人、戰利品狀態）

**服務層：**
- `services/FirebaseService.ts` - Firebase Admin SDK 初始化
- `services/NPCService.ts` - **NPC 數據管理服務**
  - 從 Firebase 載入 npc_templates 和 npc_instances
  - 組合模板和實例數據
  - **關鍵：** 從 `instance.shopId` 讀取並映射到 `npcData.linkedShopId`
  - 提供 `getAllNPCs()`, `getNPC(id)` 等方法
- `services/ShopService.ts` - **商店數據管理服務**（Phase 16.3）
  - 從 Firebase 載入 items 和 shops collection
  - 組合商店和商品數據（ShopWithItems）
  - 提供 `getShop(shopId)`, `getAllShops()` 等方法
  - 內存緩存以提升性能
- `services/PurchaseService.ts` - **購買處理服務**（Phase 16.3）
  - 處理購買請求（`handlePurchase()`）
  - 驗證商店狀態（營業時間）
  - 管理庫存（全局庫存、個人限購）
  - 載入和更新購買記錄
  - **注意：** 使用 `player.firebaseUid` 而非 `player.uid`

**系統層：**
- `systems/NPCManager.ts` - **NPC 生成和管理**
  - 從 NPCService 載入數據並生成 NPC
  - 將 NPC 添加到 room.state.enemies MapSchema
  - 處理 dialogueTree 序列化（轉為 JSON 字符串）
  - **關鍵邏輯：**
    - `npc.modelId = (data.modelId && data.modelId !== "undefined") ? data.modelId : ""`
    - `npc.linkedShopId = data.linkedShopId || ""` - 設定關聯商店 ID 到 Enemy schema

**重要數據流：**
```
Firebase (npc_templates + npc_instances)
  ↓
NPCService.initialize()
  ↓ 組合數據，從 instance.shopId 讀取
NPCService.getAllNPCs() → INPCData[] (含 linkedShopId)
  ↓
NPCManager.initialize()
  ↓ 創建 Enemy Schema
  ↓ 設定 npc.linkedShopId = data.linkedShopId
room.state.enemies.set(npcId, npc)
  ↓ Colyseus 自動同步（含 linkedShopId 欄位）
Client receives NPC data (含 linkedShopId)
```

**linkedShopId 傳輸流程（Phase 16-3 修復）：**
1. Firebase `npc_instances` 集合儲存 `shopId` 欄位
2. `NPCService.ts:169` 讀取 `instance.shopId` → 設定到 `npcData.linkedShopId`
3. `NPCManager.ts:79` 從 `data.linkedShopId` → 設定到 `npc.linkedShopId` (Enemy Schema)
4. `GameState.ts:94` Enemy Schema 定義 `@type("string") linkedShopId`
5. Colyseus 自動同步到 Client
6. Client 可從 `npcData.linkedShopId` 讀取並開啟商店

---

### 3. Client Package (`@gangs-online/client`)
**職責：** Babylon.js 3D 遊戲客戶端

#### 核心文件結構

**主入口：**
- `main.ts` - 遊戲初始化流程、Colyseus 連接、輸入處理

**實體管理器：**
- `entities/PlayerManager.ts` - 玩家角色管理（自己 + 其他玩家）
- `entities/EnemyManager.ts` - **敵人/NPC 3D 模型管理**
  - `createEnemy(enemyData, enemyId)` - 創建 3D 模型
  - **模型加載邏輯：**
    ```typescript
    // 檢查 modelId（防止 "undefined" 字符串）
    const useDefaultModel = !modelId || modelId.trim() === "" || modelId === "undefined";

    if (useDefaultModel) {
      // 預設模型：https://models.babylonjs.com/HVGirl.glb
    } else {
      // 自定義模型：/models/{modelId}.glb
    }
    ```
  - 監聽 Colyseus Schema 變化（位置、HP、狀態）
- `entities/LootManager.ts` - 戰利品管理

**UI 系統：**
- `ui/DialogueSystem.ts` - **對話系統 UI**
  - `show(npcId, npcName, dialogueTree)` - 顯示對話
  - `hide()` - 關閉對話
  - `isActive()` - 檢查是否顯示中
  - 處理對話選項導航和動作執行
- `ui/ShopSystemV2.ts` - **商店系統 UI**（Phase 16.3）
  - `openShop(npcId, shopId)` - 開啟商店
  - `closeShop()` - 關閉商店
  - `purchaseItem(itemId, quantity)` - 發送購買請求
  - 處理 "shopData" 和 "purchaseResult" 消息
  - 顯示商品、庫存、價格、營業時間
- `systems/HUDManager.ts` - 主 HUD（血條、金錢、經驗值等）
  - Phase 16.3: 新增 `showShopPopupV2()` 商店提示
- `systems/UISystem.ts` - 3D 世界中的 UI（名牌、血條）

**場景管理：**
- `world/SceneManager.ts` - 場景/地圖加載（Phase 15 chunk loading）

**重要輸入處理邏輯（main.ts）：**
```typescript
scene.onPointerDown = (evt, pickResult) => {
  // Phase 16-2: 對話顯示時阻止所有輸入（除了 NPC 點擊）
  if (dialogueSystem.isActive()) {
    const target = findInteractiveTarget(...);
    if (target.type === 'npc') {
      // 允許重新點擊 NPC
    } else {
      return; // 阻止移動/攻擊/拾取
    }
  }

  // NPC 點擊處理
  if (target.type === 'npc') {
    const npcData = (room.state as any).enemies.get(target.id);

    // 檢查對話樹（優先）
    if (npcData.dialogueTreeJson && npcData.dialogueTreeJson !== "") {
      const dialogueTree = JSON.parse(npcData.dialogueTreeJson);
      dialogueSystem.show(target.id, npcData.name, dialogueTree);
      return;
    }

    // Phase 16.3: 檢查商店 NPC
    if (npcData.linkedShopId && npcData.linkedShopId !== "") {
      hudManager.showShopPopupV2(target.id, npcData.linkedShopId, npcData.name);
      shopSystemV2.openShop(target.id, npcData.linkedShopId);
      return;
    }

    // 根據 npcType 處理（quest, citizen, police, gangs）
  }

  // 其他輸入處理（移動、攻擊、拾取）...
};
```

---

### 4. Dashboard Package (`@gangs-online/dashboard/main`)
**職責：** Next.js 管理後台，管理遊戲數據

#### 核心文件結構

**頁面：**
- `app/page.tsx` - Dashboard 主頁（Phase 16.3 重新設計：分組顯示所有功能）
- `app/npc/templates/page.tsx` - NPC 模板列表
- `app/npc/instances/page.tsx` - NPC 實例列表
- `app/item/page.tsx` - 道具管理
- `app/npc/appearances/page.tsx` - NPC 造型管理（Phase 19，即將推出）
- `app/shop/page.tsx` - 商店列表（Phase 16.3）
- `app/shop/edit/page.tsx` - 商店編輯/新增（Phase 16.3）

**組件：**
- `components/layout/Sidebar.tsx` - 側邊欄導航
  - Phase 16.3: 重組結構（商店及物品父選單、NPC 子選單圖示）
  - MenuItem type 定義（支援 optional icon in subItems）
  - Auto-expand 邏輯（根據當前路徑）
- `components/npc/TemplateForm.tsx` - NPC 模板表單
  - `modelId` 為**可選字段**（不填則使用預設模型）
  - 驗證邏輯：`// modelId is now optional, will use default if not provided`
- `components/npc/DialogueEditor.tsx` - **對話樹編輯器（Phase 16-2 全新 Table 式介面）**
  - **表格顯示：** #順序、內容（inline 編輯）、動作類型（icon + 文字）、刪除按鈕
  - **Drag & Drop：** 拖曳 GripVertical 圖示可重新排序節點
  - **Inline 編輯：** 直接在表格中點擊 content 欄位即可修改
  - **展開編輯：** 點擊 ChevronDown/Right 圖示展開詳細設定（選項、動作參數）
  - **智慧預設：** 新增選項時自動將 nextNodeId 設為下一個節點
  - **自動清理：** 刪除節點時自動更新所有指向它的選項
  - **起始節點：** 第一個節點（★ 標記）永遠是起始節點，無需手動選擇
  - **動作模式：**
    - `next_dialogue` - 下一句對話（自動選擇下一個節點）
    - `player_options` - 玩家選項（可新增多個選項）
    - `open_shop` - 開啟商店（dropdown 選擇已有商店或使用 linkedShopId）
    - `end_dialogue` - 結束對話（單一對話預設模式）
  - **新增節點行為：** 自動將前一個「結束對話」節點改為「下一句對話」指向新節點
- `components/npc/CharacterViewer.tsx` - **3D 角色預覽器**（Phase 19，Babylon.js 7）
  - 裝備插槽管理、骨骼綁定、共享 TransformNode、髮色/鬍色修改
- `lib/character-thumbnails.ts` - **3D 縮圖生成器**（Phase 19，離屏 Babylon engine）
- `components/shop/ShopForm.tsx` - 商店表單（Phase 16.3）
  - Multi-select 商品選擇器（react-select）
  - 停用商品顯示 `[停用]` 標記
  - 完成後導向 `/shop` 列表頁
- `components/shop/ShopItemList.tsx` - 商店商品列表（Phase 16.3）

**服務：**
- `lib/npc/template-service.ts` - NPC 模板 CRUD 操作
  - 連接 Firebase `npc_templates` 集合
  - **搜索過濾：** `template.modelId?.toLowerCase()` (使用可選鏈)
- `lib/npc/instance-service.ts` - NPC 實例 CRUD 操作
- `lib/shop/shop-service.ts` - 商店 CRUD 操作（Phase 16.3）
  - 連接 Firebase `shops` 和 `items` 集合
  - **遞迴清理：** `removeUndefinedFields()` 處理巢狀物件和陣列
  - **安全轉換：** `convertToDate()` 處理多種 Timestamp 格式
  - `getAvailableItems()` 顯示所有商品（包括停用商品）

**類型：**
- `types/npc.ts` - Dashboard 專用 NPC 類型
  - `NpcTemplate` - `modelId?: string` (可選)
  - `NpcTemplateFormData` - `modelId?: string` (可選)

**國際化：**
- `contexts/i18n-context.tsx` - i18n 上下文
- `locales/en.ts` - 英文翻譯
- `locales/zh-TW.ts` - 繁體中文翻譯
- `lib/item-helpers.ts` - **道具分類翻譯輔助函數**（Phase 16-2 模組化）

---

## 🔄 關鍵數據流

### NPC 創建和顯示流程

```
1. Dashboard (Next.js)
   └─> 創建 NPC Template（可選 modelId）
   └─> 創建 NPC Instance（位置、等級等）
   └─> 存儲到 Firebase (npc_templates, npc_instances)

2. Server 啟動
   └─> NPCService.initialize()
       └─> 從 Firebase 載入 templates 和 instances
       └─> 組合成 NPCCompleteData
   └─> NPCManager.initialize()
       └─> 從 NPCService 獲取 NPC 數據
       └─> 創建 Enemy Schema
       └─> 設置 modelId (處理 undefined)
       └─> 序列化 dialogueTree 為 JSON
       └─> 添加到 room.state.enemies

3. Client 連接
   └─> 監聽 room.state.enemies.onAdd
   └─> EnemyManager.createEnemy()
       └─> 檢查 modelId (包括 "undefined" 字符串)
       └─> 加載 3D 模型（預設或自定義）
       └─> 設置位置、材質、動畫
       └─> 創建 UI (名牌、血條)

4. 玩家點擊 NPC
   └─> main.ts: scene.onPointerDown
       └─> 從 room.state.enemies 獲取 NPC 數據
       └─> 解析 dialogueTreeJson
       └─> dialogueSystem.show()
       └─> 阻止其他輸入直到對話關閉
```

### 道具分類翻譯流程（Phase 16-2 改進）

```
1. 定義翻譯 key
   └─> locales/en.ts: 'item.category.consumable': 'Consumables'
   └─> locales/zh-TW.ts: 'item.category.consumable': '消耗品'

2. 使用輔助函數（模組化）
   └─> lib/item-helpers.ts:
       └─> getCategoryTranslationKey(category) → 'item.category.{category}'
       └─> getAllCategories() → ['consumable', 'special', ...]

3. 在組件中使用
   └─> page.tsx: t(getCategoryTranslationKey(category))
   └─> BasicInfoSection.tsx: t(getCategoryTranslationKey(category))
```

### 商店系統購買流程（Phase 16-3）

```
1. Dashboard 商店管理
   └─> Dashboard: 創建/編輯商店（ShopForm）
       └─> 設定基本資訊（名稱、描述、營業時間）
       └─> 選擇商品（Multi-select）
       └─> 配置商品（庫存、限購、價格倍率）
       └─> 保存到 Firebase (shops collection)
   └─> Dashboard: NPC 關聯商店（InstanceForm）
       └─> 選擇 linkedShopId
       └─> 設定 isGuildOnly（公會專屬）
       └─> 更新 npc_instances

2. Server 啟動
   └─> ShopService.initialize()
       └─> 從 Firebase 載入 items collection
       └─> 從 Firebase 載入 shops collection
       └─> 組合成 ShopWithItems（含商品資料）
       └─> 緩存在內存中
   └─> PurchaseService.initialize()
       └─> 準備處理購買請求

3. Client 點擊商店 NPC
   └─> main.ts: 偵測到 NPC 有 linkedShopId
       └─> hudManager.showShopPopupV2(npcId, shopId, shopName)
       └─> shopSystemV2.openShop(npcId, shopId)
       └─> 發送 "openShop" 消息到 Server

4. Server 處理 openShop
   └─> GameRoom.onMessage("openShop")
       └─> shopService.getShop(shopId)
       └─> 獲取商店的所有商品資料
       └─> 發送 "shopData" 給 Client

5. Client 顯示商店 UI
   └─> shopSystemV2 接收 "shopData"
       └─> 更新 currentShop 和 shopItems
       └─> 刷新 UI（顯示商品、庫存、價格）
       └─> 檢查營業時間、顯示狀態

6. Client 購買商品
   └─> 玩家點擊"購買"按鈕
       └─> shopSystemV2.purchaseItem(itemId, quantity)
       └─> 發送 "purchase" 消息（IPurchaseRequest）

7. Server 處理購買
   └─> GameRoom.onMessage("purchase")
       └─> purchaseService.handlePurchase()
           └─> 驗證商店狀態（營業時間）
           └─> 驗證庫存（全局庫存）
           └─> 檢查個人限購（載入購買記錄）
           └─> 計算價格（含倍率）
           └─> 驗證玩家金錢
           └─> 執行購買（扣錢、更新庫存、記錄）
           └─> 發送 "purchaseResult" (IPurchaseResponse)

8. Client 處理結果
   └─> shopSystemV2 接收 "purchaseResult"
       └─> 成功：顯示通知、刷新 UI
       └─> 失敗：顯示錯誤訊息
```

---

## 🐛 已知問題和修復歷史

### Phase 16-3 關鍵問題修復

#### 1. Player Schema 屬性錯誤（已修復 - commit: e022d54）
**問題：** Server 使用 `player.uid` 但 Player Schema 使用 `firebaseUid`
**原因：** PurchaseService 引用了錯誤的屬性名稱
**修復：**
- PurchaseService.ts: 所有 `player.uid` 改為 `player.firebaseUid`
- 共修改 5 處（lines 197, 198, 201, 253, 258）

#### 2. Firebase Undefined Fields Error（已修復 - commit: 5f6f20e）
**問題：** `Function addDoc() called with invalid data. Unsupported field value: undefined`
**原因：** `removeUndefinedFields()` 只清理頂層字段，未遞迴處理巢狀陣列和物件
**修復：**
- shop-service.ts: 將 `removeUndefinedFields()` 改為遞迴函數
- 處理陣列時遞迴清理每個元素
- 處理物件時遞迴清理但保留 Date 和 Timestamp 類型

#### 3. Firestore Timestamp Conversion Error（已修復 - commit: 3601fff）
**問題：** "t.toDate is not a function"
**原因：** Firestore Timestamps 有多種格式（Date 物件、Timestamp with toDate()、純物件 with seconds）
**修復：**
- shop-service.ts: 新增 `convertToDate()` 輔助函數
- 安全處理三種格式：
  - `instanceof Date` → 直接返回
  - `typeof value.toDate === 'function'` → 調用 toDate()
  - `typeof value.seconds === 'number'` → new Date(seconds * 1000)

#### 4. TypeScript Build Errors（已修復 - commits: e49df2c, 57d74a8, 30b068f, 65437d9）
**問題：** 多個 TypeScript 編譯錯誤
**修復：**
- Sidebar.tsx: 新增 MenuItem type 定義（含 optional icon in subItems）
- Sidebar.tsx: 新增 null check `item.subItems &&`
- shop-service.ts: instanceof 使用 type assertion `(value as any)`
- shop-service.ts: Array map 參數加上 type annotation `(item: any)`

#### 5. Dashboard 商品選擇器無可用商品（已修復 - commit: 9bd9154）
**問題：** 只有啟用的商品可選擇，限制了商店配置彈性
**用戶反饋：** "就算未啟用都應該可以在設定商店時選擇，大不了在客戶端才執行'啟用才顯示'的邏輯"
**修復：**
- shop-service.ts: `getAvailableItems()` 移除 `where('isActive', '==', true)` 過濾
- ShopForm.tsx: 為停用商品加上 `[停用]` 標記
**影響：** 管理員可以預先配置商店，啟用/停用商品不需重新配置

### Phase 16-2 關鍵問題修復

#### 1. NPC 模型不可見（已修復 - commit: bfb7f77）
**問題：** `modelId` 為 undefined 時被轉換成字符串 `"undefined"`
**原因：** JavaScript `||` 運算符和模板字符串的行為
**修復：**
- Server: `npc.modelId = (data.modelId && data.modelId !== "undefined") ? data.modelId : ""`
- Client: `const useDefaultModel = !modelId || modelId.trim() === "" || modelId === "undefined"`

#### 2. 對話框關閉後無法移動（已修復 - commit: 505aef5）
**問題：** 對話顯示時沒有阻止遊戲輸入
**修復：** 在 `scene.onPointerDown` 開頭檢查 `dialogueSystem.isActive()`

#### 3. TypeScript Build Errors（已修復）
- Dashboard: `template.modelId` 可能為 undefined → 使用 `?.` 可選鏈
- Client: `room.state` 類型 unknown → 使用 `(room.state as any)`

---

## 📋 當前進度

### ✅ 已完成功能

**Phase 19 (開發中 - 即將推出):**
- 🚧 NPC 造型管理系統（Babylon.js 3D 角色預覽）
- ✅ 3D 角色預覽器（ArcRotateCamera、燈光、地板）
- ✅ 性別切換（男/女身體模型）
- ✅ 6 個裝備插槽（hair, beard, head, top, bottom, shoe）
- ✅ 性別專屬髮型路徑（`hair/male/`, `hair/female/`）
- ✅ 骨骼綁定 + 共享 TransformNode 對齊
- ✅ 髮色/鬍色即時修改（Color Picker）
- ✅ 3D 縮圖預覽（離屏 Babylon engine）
- ✅ Accordion UI + 6 格 grid + 女性隱藏鬍子
- ⬜ Cap 模型修正（需 Blender 重新匯出）
- ⬜ 動畫系統
- ⬜ Firebase 資料持久化

**Phase 16-3 (當前):**
- ✅ 動態商店系統（Firebase）
- ✅ 商店 CRUD（Dashboard 管理界面）
- ✅ 商店配置（營業時間、庫存、價格倍率）
- ✅ 購買限制（全局庫存、個人限購）
- ✅ NPC-商店關聯（linkedShopId 完整傳輸流程）
- ✅ 公會專屬商店（isGuildOnly）
- ✅ Server 端購買邏輯（庫存管理、限制驗證）
- ✅ Client 端商店 UI（ShopSystemV2）
- ✅ Multi-select 商品選擇器（react-select）
- ✅ 商品選擇器支援停用商品顯示（含 [停用] 標記）
- ✅ Dashboard 側邊欄重組（商店及物品父選單、NPC 子選單圖示）
- ✅ 商店表單完成後導向列表頁
- ✅ Dashboard 主頁重新設計（分組顯示所有功能）
- ✅ Firestore Timestamp 安全轉換
- ✅ 遞迴 undefined 清理（支援巢狀物件和陣列）

**Phase 16-2:**
- ✅ NPC 模板和實例管理（Firebase）
- ✅ NPC 對話系統（DialogueTree）
- ✅ **對話樹 Table 式編輯器**（Drag & Drop、Inline 編輯、展開詳細設定）
- ✅ **對話樹智慧功能**（自動清理、智慧預設、起始節點鎖定）
- ✅ **對話動作系統**（下一句對話、玩家選項、開啟商店、結束對話）
- ✅ 多語言支持（i18n）
- ✅ 道具分類翻譯模組化
- ✅ NPC 自定義模型支持（可選 modelId）
- ✅ 對話框輸入控制

**早期階段:**
- Phase 15: 場景分塊加載、監獄系統
- Phase 14: 罪惡值系統、NPC 類型擴展
- Phase 13: 幫會系統、聊天系統
- Phase 12: Firebase 持久化
- Phase 10: 任務系統
- Phase 8: 戰利品系統
- Phase 7: 等級系統

### 🚧 待辦事項

**高優先級：**
- [ ] 對話系統動作執行（open_shop, accept_quest）
- [ ] NPC 商店整合到對話系統
- [ ] 背包系統整合（購買後添加到背包）
- [ ] 商店庫存重置機制（每日重置）

**中優先級：**
- [ ] 自定義模型上傳功能
- [ ] NPC 移動模式（WANDERING, PATROLLING）
- [ ] NPC AI 行為系統

**低優先級：**
- [ ] 更多對話動作類型
- [ ] 對話條件和變量系統
- [ ] NPC 表情和動畫

---

## 🔑 重要技術決策

### 為什麼 NPC 使用 Enemy Schema？
- **決策：** NPC 重用 `Enemy` Schema 而不是創建獨立 `NPC` Schema
- **原因：**
  1. Colyseus Schema 不支持繼承
  2. NPC 和 Enemy 共享大量字段（位置、HP、名稱等）
  3. 通過 `type` 字段區分（"npc" vs "enemy"）
  4. 通過 `npcType` 字段細分 NPC 類型
- **影響：** 客戶端的 `EnemyManager` 同時處理敵人和 NPC

### 為什麼對話樹序列化為 JSON 字符串？
- **決策：** `dialogueTreeJson: string` 而不是 Colyseus Schema
- **原因：**
  1. Colyseus Schema 不支持嵌套複雜對象
  2. 對話樹是靜態數據，不需要實時同步更新
  3. JSON 字符串可以完整保留結構
- **影響：** 客戶端需要 `JSON.parse(npcData.dialogueTreeJson)`

### 為什麼 modelId 設為可選？
- **決策：** `modelId?: string` 而不是必填字段
- **原因：**
  1. 大多數 NPC 可以使用預設模型
  2. 降低創建 NPC 的門檻
  3. 方便快速原型開發
- **影響：** 需要在多處檢查 undefined 和 "undefined" 字符串

### 為什麼商店系統使用 Firebase 而非硬編碼？（Phase 16.3）
- **決策：** 動態商店系統（Firebase）取代 `SHOP_ITEMS` 常量
- **原因：**
  1. 運營靈活性：不需要部署即可調整商品、價格、庫存
  2. 多商店支持：不同 NPC 可以銷售不同商品
  3. 營業時間控制：特定時段限定商品
  4. 數據持久化：購買記錄、庫存狀態
- **影響：**
  - Server 需要在啟動時載入商店數據
  - Client 需要通過消息獲取商店數據（不能直接訪問）

### 為什麼庫存使用 currentStock 和 globalStock 雙字段？
- **決策：** `currentStock?: number` 和 `globalStock: number`
- **原因：**
  1. `globalStock` 是配置（初始庫存），不變
  2. `currentStock` 是當前剩餘量，動態變化
  3. 重置時只需 `currentStock = globalStock`
- **影響：** 讀取庫存需要：`currentStock ?? globalStock`

### 為什麼需要遞迴清理 undefined 和安全的 Timestamp 轉換？（Phase 16.3）
- **決策：** `removeUndefinedFields()` 遞迴處理，`convertToDate()` 多格式支援
- **原因：**
  1. Firebase 不接受 undefined 值，但 TypeScript 可選字段可能是 undefined
  2. 巢狀陣列和物件（如 `itemList`）也需要清理
  3. Firestore Timestamp 在不同情況下有不同格式（Date、Timestamp、Plain Object）
  4. 需要保留 Date 和 Timestamp 類型，不進行遞迴
- **影響：**
  - 必須在所有 Firebase 寫入操作前調用 `removeUndefinedFields()`
  - 讀取時間戳時使用 `convertToDate()` 而非直接 `.toDate()`
  - TypeScript instanceof 檢查需要 type assertion: `(value as any) instanceof Date`

---

## 🛠️ 常見操作指南

### 如何添加新的 NPC？
1. Dashboard: 創建 NPC Template（設定基礎屬性、對話樹）
2. Dashboard: 創建 NPC Instance（設定位置、等級）
3. Server: 自動從 Firebase 載入（重啟後生效）
4. Client: 自動創建 3D 模型和 UI

### 如何修改 NPC 對話？
1. Dashboard: 編輯 NPC Template
2. 使用 DialogueEditor 組件編輯對話樹
   - **拖曳排序：** 拖動 GripVertical 圖示重新排序節點
   - **快速編輯：** 直接點擊內容欄位修改文字
   - **詳細設定：** 點擊 ChevronDown 展開編輯選項和動作
   - **動作選擇：** 從 dropdown 選擇下一句對話、玩家選項、開啟商店、結束對話
   - **商店關聯：** 選擇「開啟商店」時可指定商店或使用 NPC 的 linkedShopId
3. 保存後服務器需要重啟以載入最新數據
4. 客戶端重新連接後自動獲取新對話

### 如何添加新的翻譯？
1. `locales/en.ts` 和 `locales/zh-TW.ts` 添加 key
2. 組件中使用 `t('your.key')`
3. 對於道具分類等模組化翻譯，使用 `item-helpers.ts` 輔助函數

### 如何創建新商店？（Phase 16.3）
1. Dashboard: 先創建商品（Items 頁面）
   - 設定名稱、描述、基礎價格、分類
2. Dashboard: 創建商店（Shop 頁面）
   - 設定商店名稱、描述
   - 設定營業時間（可選，不設定則 24 小時營業）
   - 使用 Multi-select 選擇要銷售的商品
   - 為每個商品配置：
     - 全局庫存（-1 = 無限，0+ = 限量）
     - 個人限購（0 = 無限制，1+ = 每人限購）
     - 價格倍率（可選，不設定則使用原價）
3. Dashboard: 將商店關聯到 NPC
   - 編輯 NPC Instance
   - 選擇 linkedShopId
   - 設定 isGuildOnly（可選）
4. Server: 重啟後自動載入新商店
5. Client: 玩家點擊 NPC 即可看到商店

### 如何修改商店配置？
1. Dashboard: 編輯商店（Shop 頁面 → Edit）
2. 修改營業時間、新增/移除商品、調整配置
3. Server: 重啟後生效（庫存數據會重置）
4. Client: 玩家重新打開商店即可看到更新

### Dashboard 導航和 UX（Phase 16.3 改進）
**側邊欄結構：**
- 「商店及物品」（ShoppingBag 圖示）
  - 道具管理（Package 圖示）
  - 商店管理（Store 圖示）
- 「NPC管理」（Users 圖示）
  - 模板管理（FileText 圖示）
  - 實例管理（UserCheck 圖示）

**主頁設計：**
- 分組顯示所有功能（一頁看完，無需轉頁）
- 每個功能卡片包含圖示、標題、描述、「管理」按鈕

**商店表單行為：**
- 完成建立或更新後自動跳回商店列表頁（`/shop`）
- 可選擇所有商品（包括停用商品，會顯示 [停用] 標記）
- Multi-select dropdown 文字顏色：選中時白色，hover 時深色，未 hover 時白色

### 如何調試 NPC 模型問題？
查看瀏覽器控制台日誌：
- `📦 Model ID for [id]:` - 檢查 modelId 值
- `📦 Using default model` 或 `📦 Loading custom model` - 確認加載路徑
- `✅ NPC model loaded:` - 確認模型創建成功
- 檢查 `position`, `visibility`, `isEnabled` 值

---

## 📞 緊急問題快速參考

### NPC 模型不顯示
1. 檢查控制台是否有 `✅ NPC model loaded` 日誌
2. 檢查 `modelId` 是否為 `"undefined"` 字符串
3. 檢查 NPC Instance 的 `positionX/Z` 是否正確
4. 檢查 NPC Template 和 Instance 的 `isActive` 狀態

### 對話框無法關閉或關閉後無法移動
1. 檢查 `DialogueSystem.hide()` 是否被調用
2. 檢查 `main.ts` 中是否有 `dialogueSystem.isActive()` 檢查
3. 清除瀏覽器緩存重新載入

### TypeScript Build Error
1. Dashboard: 檢查可選字段是否使用 `?.` 可選鏈
2. Client: 檢查 `room.state` 是否使用 `as any` 斷言
3. 檢查 `modelId` 字段是否標記為可選 (`?`)

### Firebase 數據未同步
1. 檢查 Firebase Console 中的數據是否正確
2. 重啟服務器以重新載入 Firebase 數據
3. 檢查 NPCService 初始化日誌

### 商店創建失敗：Unsupported field value: undefined（Phase 16.3）
1. 檢查是否使用了 `removeUndefinedFields()` 清理數據
2. 確認 `removeUndefinedFields()` 是遞迴版本（處理巢狀陣列）
3. 檢查 `itemList` 陣列中是否有 undefined 字段
4. 查看瀏覽器控制台的完整錯誤訊息，確認哪個字段是 undefined

### Timestamp Conversion Error: t.toDate is not a function（Phase 16.3）
1. 檢查是否使用了 `convertToDate()` 輔助函數
2. 確認 `convertToDate()` 支援三種格式：Date、Timestamp、Plain Object
3. 不要直接調用 `.toDate()`，改用 `convertToDate(timestamp)`

### 商店選擇器沒有可用商品（Phase 16.3）
1. 檢查 `getAvailableItems()` 是否移除了 `isActive` 過濾
2. 確認商品確實存在於 Firebase `items` collection
3. 停用商品應該顯示 `[停用]` 標記
4. 檢查瀏覽器控制台是否有載入錯誤

### NPC 對話樹無法保存（Phase 16.3 後續修復）
1. 檢查 `removeUndefinedFields()` 函數是否為**遞迴版本**
2. 確認遞迴函數正確處理：
   - 巢狀物件（dialogueTree.nodes）
   - 巢狀陣列（node.options）
   - Date 和 Timestamp 物件（不要遞迴處理）
3. 參考 `shop-service.ts` 中的實現模式
4. 檢查 Firebase 錯誤訊息中指出的具體字段路徑

### NPC 對話樹在 Firebase 存在但 UI 不顯示（Phase 16.3 後續修復）
1. 檢查 `formData` 初始化是否包含 `dialogueTree` 字段
2. 確認有 `useEffect` 監聽 `template` prop 並更新 `formData`
3. 檢查 `TemplateForm.tsx` 中的 useEffect 依賴陣列
4. 驗證 Firebase Console 中的 dialogueTree 結構是否完整
5. 檢查瀏覽器控制台是否有解析錯誤

### NPC 相關翻譯顯示為 key（Phase 16.3 後續修復）
問題：UI 顯示 `npc.type.CITIZEN` 而不是「市民」
1. 確認 `locales/zh-TW.ts` 和 `locales/en.ts` 有對應翻譯 key
2. 檢查組件是否使用 `t(\`npc.type.${type}\`)` 而不是硬編碼常數
3. 確認移除了硬編碼的 `NPC_TYPE_LABELS`、`MOVEMENT_PATTERN_LABELS` 等常數
4. 檢查 `useI18n()` hook 是否正確導入和使用

### Dashboard Build 失敗：Module not found 'react-i18next'（Phase 16.3 後續修復）
錯誤：`Can't resolve 'react-i18next'`
1. 專案使用 `@/contexts/i18n-context` 而不是 `react-i18next`
2. 將 `import { useTranslation } from 'react-i18next'` 改為：
   ```typescript
   import { useI18n } from '@/contexts/i18n-context';
   const { t } = useI18n();
   ```
3. 檢查所有新增或修改的組件是否使用正確的 import

---

## 🔄 重要修改總結

### Phase 16-3 & 16-2 關鍵修改（2026-02-02 更新）

#### 1. 版本號統一管理
**修改：** 所有端的版本號統一在 `packages/shared/src/index.ts`
**位置：** `export const GAME_VERSION = "0.16.3";`
**影響：**
- Client、Server、Dashboard 都從 `@gangs-online/shared` 導入版本號
- 不再有分散在不同檔案的版本號
- 確保所有端版本同步

#### 2. linkedShopId 傳輸問題修復
**問題：** NPC 的商店關聯無法正確傳到 Client
**原因：** 數據流不完整，Firebase → Service → Manager → Schema 缺少環節
**修復流程：**
1. `INPCInstance` interface 定義 `shopId?: string` 欄位
2. `NPCService.ts:169` 從 `instance.shopId` 讀取 → `linkedShopId: instance.shopId`
3. `NPCManager.ts:79` 設定到 Enemy Schema → `npc.linkedShopId = data.linkedShopId || ""`
4. `GameState.ts:94` Enemy Schema 新增 `@type("string") linkedShopId: string = ""`
5. Colyseus 自動同步到 Client
6. Client `main.ts:174` 可從 `npcData.linkedShopId` 讀取並開啟商店

**關鍵檔案：**
- `packages/shared/src/index.ts:391` - INPCInstance 定義 shopId
- `packages/server/src/services/NPCService.ts:169` - 映射 shopId → linkedShopId
- `packages/server/src/systems/NPCManager.ts:79` - 設定到 Enemy schema
- `packages/server/src/rooms/schema/GameState.ts:94` - Enemy schema 新增欄位
- `packages/client/src/main.ts:174` - Client 讀取 linkedShopId

#### 3. 對話樹 Table 式編輯器（Phase 16-2 重大更新）

**全新介面特點：**
- **表格佈局：** 清晰顯示 #順序、內容、動作類型、刪除按鈕
- **視覺回饋：**
  - 第一個節點有 ★ 標記（永遠是起始節點）
  - 深灰色 header（`bg-gray-100 dark:bg-gray-800`）確保可見
  - 動作類型顯示 icon + 文字（ArrowRight、ListOrdered、Store、XCircle）
- **直覺操作：**
  - 拖曳 GripVertical 圖示可重新排序
  - 直接點擊內容欄位即可修改（inline editing）
  - 點擊 ChevronDown/Right 展開詳細設定

**智慧功能：**
1. **自動預設 nextNodeId：** 新增選項時自動指向下一個節點
2. **自動清理：** 刪除節點時自動更新所有指向它的選項
3. **連鎖新增：** 新增節點時自動將前一個「結束對話」改為「下一句對話」
4. **鎖定起始節點：** 第一個節點永遠是起始，無需手動選擇

**動作模式：**
- `next_dialogue` - 下一句對話（藍色 ArrowRight 圖示）
- `player_options` - 玩家選項（紫色 ListOrdered 圖示）
- `open_shop` - 開啟商店（綠色 Store 圖示，dropdown 選擇商店）
- `end_dialogue` - 結束對話（灰色 XCircle 圖示，單一對話預設）

**關鍵檔案：**
- `packages/dashboard/main/src/components/npc/DialogueEditor.tsx` (617 lines)

**實現細節：**
- Lines 283-309: Drag & Drop 邏輯
- Lines 425-434: Inline content 編輯
- Lines 461-589: 展開詳細設定區
- Lines 109-135: 新增節點自動連鎖邏輯
- Lines 137-170: 刪除節點自動清理邏輯
- Lines 234-249: 智慧預設 nextNodeId

#### 4. 對話樹編輯器改進清單

| 改進項目 | 狀態 | 說明 |
|---------|------|------|
| ✅ 移除「發言者」欄位 | 完成 | 使用 NPC 名稱，無需額外欄位 |
| ✅ 移除「起始節點」選擇器 | 完成 | 第一個節點（★）永遠是起始 |
| ✅ 「開啟商店」dropdown | 完成 | 選擇已有商店或使用 linkedShopId |
| ✅ 單一對話預設「結束對話」 | 完成 | 新節點預設 `actionType: 'end_dialogue'` |
| ✅ Table header 可見樣式 | 完成 | `bg-gray-100 dark:bg-gray-800` + 文字顏色 |
| ✅ 動作欄 icon + 文字 | 完成 | 每種動作有專屬顏色 icon |
| ✅ 新增節點連鎖邏輯 | 完成 | 自動將前一句改為「下一句對話」|

### 其他修復的問題（2026-01-28）

#### 1. NPC 對話樹數據完整性問題
**問題：** 對話樹無法保存到 Firebase，錯誤：`Unsupported field value: undefined`
**原因：** `removeUndefinedFields()` 只清理頂層字段，未處理巢狀結構
**解決方案：**
- 重構 `removeUndefinedFields()` 為遞迴函數
- 正確處理陣列和巢狀物件
- 保護 Date 和 Timestamp 物件不被遞迴處理
- 檔案：`packages/dashboard/main/src/lib/npc/template-service.ts`
- Commit: `2593558`

#### 2. NPC 對話樹 UI 同步問題
**問題：** Firebase 中有 dialogueTree 數據，但編輯模板時 UI 顯示「尚未設定對話樹」
**原因：**
- `formData` 初始化缺少 `dialogueTree` 字段
- 沒有 useEffect 監聽 template prop 變更
**解決方案：**
- 在 `formData` 初始化時添加 `dialogueTree` 字段
- 添加 useEffect 監聽 `template` 並更新 `formData`
- 檔案：`packages/dashboard/main/src/components/npc/TemplateForm.tsx`
- Commit: `3b222b4`

#### 3. Timestamp 轉換錯誤
**問題：** `TypeError: a.toDate is not a function` 在載入 NPC 模板時
**原因：** Firebase Timestamp 可能是多種格式（Date、Timestamp、Plain Object）
**解決方案：**
- 創建 `convertToDate()` 輔助函數處理三種格式
- 應用於 `getAllTemplates()` 和 `getTemplateById()`
- 檔案：`packages/dashboard/main/src/lib/npc/template-service.ts`
- Commit: `ca83e93`

#### 4. NPC 模組完整國際化
**問題：** NPC 相關頁面和組件有大量硬編碼中文，英文版無法正確顯示
**範圍：**
- NPC Type dropdown（CITIZEN, POLICE, GANGS, SHOP, QUEST）
- Movement Pattern dropdown（STATIC, WANDERING, PATROLLING）
- Combat Type dropdown（MELEE, RANGED）
- Dialogue Editor（所有 UI 文字）
- Edit Template 頁面（標題、按鈕、訊息）
- Edit Instance 頁面（標題、按鈕、訊息）

**解決方案：**
- 新增 40+ 個翻譯 key 到 `locales/zh-TW.ts` 和 `locales/en.ts`
- 移除硬編碼常數：`NPC_TYPE_LABELS`, `MOVEMENT_PATTERN_LABELS`, `COMBAT_TYPE_LABELS`, `ACTION_TYPE_LABELS`
- 所有組件改用 `t(\`npc.type.${type}\`)` 等動態翻譯
- 修正錯誤的 `react-i18next` import 為專案的 `@/contexts/i18n-context`
- 檔案：
  - `locales/zh-TW.ts`, `locales/en.ts`
  - `DialogueEditor.tsx`
  - `EditTemplateContent.tsx`, `EditInstanceContent.tsx`
  - `TemplateForm.tsx`, `InstanceForm.tsx`
  - `templates/page.tsx`, `instances/page.tsx`
- Commits: `82931c9`, `3ac21ce`, `f1cc852`

### 新增的翻譯 Keys

#### NPC Type
```typescript
'npc.type.CITIZEN': '市民' / 'Citizen'
'npc.type.POLICE': '警察' / 'Police'
'npc.type.GANGS': '幫派成員' / 'Gang Member'
'npc.type.SHOP': '商店老闆' / 'Shop Owner'
'npc.type.QUEST': '任務 NPC' / 'Quest NPC'
```

#### Movement Pattern
```typescript
'npc.movementPattern.STATIC': '靜止' / 'Static'
'npc.movementPattern.WANDERING': '徘徊' / 'Wandering'
'npc.movementPattern.PATROLLING': '巡邏' / 'Patrolling'
```

#### Combat Type
```typescript
'npc.combatType.MELEE': '近戰' / 'Melee'
'npc.combatType.RANGED': '遠程' / 'Ranged'
```

#### Action Type
```typescript
'npc.actionType.open_shop': '開啟商店' / 'Open Shop'
'npc.actionType.accept_quest': '接受任務' / 'Accept Quest'
'npc.actionType.end_dialogue': '結束對話' / 'End Dialogue'
```

#### Dialogue Editor
```typescript
'npc.dialogueEditor.title': '對話樹編輯器' / 'Dialogue Tree Editor'
'npc.dialogueEditor.addNode': '新增節點' / 'Add Node'
'npc.dialogueEditor.speaker': '發言者' / 'Speaker'
'npc.dialogueEditor.content': '對話內容' / 'Content'
'npc.dialogueEditor.actionType': '動作類型' / 'Action Type'
'npc.dialogueEditor.playerOptions': '玩家選項' / 'Player Options'
'npc.dialogueEditor.saveTree': '儲存對話樹' / 'Save Dialogue Tree'
// ... 等 20+ 個 keys
```

#### Edit Pages
```typescript
'npc.template.editTitle': '編輯 NPC 模板' / 'Edit NPC Template'
'npc.template.editSubtitle': '修改 NPC 模板設定' / 'Modify NPC template settings'
'npc.instance.editTitle': '編輯 NPC 實例' / 'Edit NPC Instance'
'npc.instance.editSubtitle': '修改 NPC 實例設定' / 'Modify NPC instance settings'
'npc.instance.unknownTemplate': '未知模板' / 'Unknown Template'
```

### 重構的程式碼模式

#### 遞迴清理 undefined 字段
```typescript
// Before: 只清理頂層
function removeUndefinedFields<T>(obj: T): Partial<T> {
  const cleaned: any = {};
  for (const key in obj) {
    if (obj[key] !== undefined) {
      cleaned[key] = obj[key];
    }
  }
  return cleaned;
}

// After: 遞迴處理巢狀結構
function removeUndefinedFields<T>(obj: T): Partial<T> {
  const cleaned: any = {};
  for (const key in obj) {
    const value = obj[key];
    if (value === undefined) continue;

    if (Array.isArray(value)) {
      cleaned[key] = value.map(item =>
        typeof item === 'object' ? removeUndefinedFields(item) : item
      );
    } else if (typeof value === 'object' && !isDateOrTimestamp(value)) {
      cleaned[key] = removeUndefinedFields(value);
    } else {
      cleaned[key] = value;
    }
  }
  return cleaned;
}
```

#### 安全的 Timestamp 轉換
```typescript
// Before: 直接調用 toDate()
createdAt: data.createdAt.toDate()  // ❌ 可能出錯

// After: 使用輔助函數
private convertToDate(value: any): Date {
  if (value instanceof Date) return value;
  if (value && typeof value.toDate === 'function') return value.toDate();
  if (value && typeof value.seconds === 'number') {
    return new Date(value.seconds * 1000);
  }
  return new Date();
}

createdAt: this.convertToDate(data.createdAt)  // ✅ 安全
```

#### 正確的 i18n 使用
```typescript
// Before: 硬編碼常數
const NPC_TYPE_LABELS = {
  CITIZEN: '市民',
  POLICE: '警察',
  // ...
};
<option>{NPC_TYPE_LABELS[type]}</option>  // ❌ 無法切換語言

// After: 動態翻譯
import { useI18n } from '@/contexts/i18n-context';
const { t } = useI18n();
<option>{t(`npc.type.${type}`)}</option>  // ✅ 支援多語言
```

### 最佳實踐經驗

1. **Firebase 數據清理**：所有 Firebase 寫入操作前必須遞迴清理 undefined
2. **Timestamp 處理**：統一使用 `convertToDate()` 輔助函數，不直接調用 `.toDate()`
3. **React 表單同步**：複雜表單需要 useEffect 監聽 props 並更新 state
4. **i18n 一致性**：專案統一使用 `@/contexts/i18n-context`，不使用 `react-i18next`
5. **翻譯 key 命名**：遵循 `{module}.{subModule}.{element}` 結構（例如 `npc.type.CITIZEN`）
6. **停用項目顯示**：選擇器應顯示停用項目並加上 `[停用]` 標記，讓管理員能預先配置

---

## 📚 延伸閱讀

**框架文檔：**
- [Colyseus Documentation](https://docs.colyseus.io/)
- [Babylon.js Documentation](https://doc.babylonjs.com/)
- [Next.js Documentation](https://nextjs.org/docs)
- [Firebase Admin SDK](https://firebase.google.com/docs/admin/setup)

**項目特定：**
- 參考 `packages/shared/src/index.ts` 了解所有類型定義
- 參考 `packages/client/src/main.ts` 了解完整遊戲流程
- 參考各 Phase 的 commit 歷史了解功能演進

---

**注意：** 此文檔應在每次重大更新後同步更新，以保持準確性。
