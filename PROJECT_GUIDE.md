# Gangs Online - 項目架構指南

> **最後更新：** 2026-01-24
> **當前版本：** 0.16.2 - NPC Dialogue System & Multi-language Support
> **目的：** 提供項目架構概覽，減少新對話中的重複代碼探索，節省 token 使用

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
- `PlayerData` (Colyseus Schema) - 玩家狀態同步
- `Enemy` (Colyseus Schema) - 敵人/NPC 狀態（注意：NPC 也使用此 schema）
- `INPCTemplate` - NPC 模板接口（Firebase 存儲）
- `INPCInstance` - NPC 實例接口（Firebase 存儲）
- `INPCData` - 完整 NPC 數據（模板 + 實例組合）
- `DialogueTree` / `DialogueNode` - 對話系統類型
- `GAME_CONSTANTS` - 遊戲常數（攻擊範圍、移動速度等）
- `GAME_VERSION` - 當前遊戲版本號

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
  - 提供 `getAllNPCs()`, `getNPC(id)` 等方法

**系統層：**
- `systems/NPCManager.ts` - **NPC 生成和管理**
  - 從 NPCService 載入數據並生成 NPC
  - 將 NPC 添加到 room.state.enemies MapSchema
  - 處理 dialogueTree 序列化（轉為 JSON 字符串）
  - **關鍵邏輯：** `npc.modelId = (data.modelId && data.modelId !== "undefined") ? data.modelId : ""`

**重要數據流：**
```
Firebase (npc_templates + npc_instances)
  ↓
NPCService.initialize()
  ↓ 組合數據
NPCService.getAllNPCs() → INPCData[]
  ↓
NPCManager.initialize()
  ↓ 創建 Enemy Schema
room.state.enemies.set(npcId, npc)
  ↓ Colyseus 自動同步
Client receives NPC data
```

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
- `systems/HUDManager.ts` - 主 HUD（血條、金錢、經驗值等）
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

    // 檢查對話樹
    if (npcData.dialogueTreeJson && npcData.dialogueTreeJson !== "") {
      const dialogueTree = JSON.parse(npcData.dialogueTreeJson);
      dialogueSystem.show(target.id, npcData.name, dialogueTree);
      return;
    }

    // 根據 npcType 處理（shop, quest, citizen, police, gangs）
  }

  // 其他輸入處理（移動、攻擊、拾取）...
};
```

---

### 4. Dashboard Package (`@gangs-online/dashboard/main`)
**職責：** Next.js 管理後台，管理遊戲數據

#### 核心文件結構

**頁面：**
- `app/npc/templates/page.tsx` - NPC 模板列表
- `app/npc/instances/page.tsx` - NPC 實例列表
- `app/item/page.tsx` - 道具管理

**組件：**
- `components/npc/TemplateForm.tsx` - NPC 模板表單
  - `modelId` 為**可選字段**（不填則使用預設模型）
  - 驗證邏輯：`// modelId is now optional, will use default if not provided`
- `components/npc/DialogueEditor.tsx` - 對話樹編輯器

**服務：**
- `lib/npc/template-service.ts` - NPC 模板 CRUD 操作
  - 連接 Firebase `npc_templates` 集合
  - **搜索過濾：** `template.modelId?.toLowerCase()` (使用可選鏈)
- `lib/npc/instance-service.ts` - NPC 實例 CRUD 操作

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

---

## 🐛 已知問題和修復歷史

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

**Phase 16-2 (當前):**
- ✅ NPC 模板和實例管理（Firebase）
- ✅ NPC 對話系統（DialogueTree）
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
- [ ] NPC 任務整合到對話系統

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
3. 保存後服務器需要重啟以載入最新數據
4. 客戶端重新連接後自動獲取新對話

### 如何添加新的翻譯？
1. `locales/en.ts` 和 `locales/zh-TW.ts` 添加 key
2. 組件中使用 `t('your.key')`
3. 對於道具分類等模組化翻譯，使用 `item-helpers.ts` 輔助函數

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
