# Gangs Online - 商店與經濟系統 (Phase 16.3)

> **版本更新：** 0.16.2 → 0.16.3
> **目標：** 建立商店配置系統，連結道具（Items）與 NPC，並實作時間限制與購買限制邏輯
> **預期完成：** 商店編輯器、NPC 商店連結、客戶端商店 UI、購買邏輯

---

## 📋 目錄

1. [專案背景與版本](#1-專案背景與版本)
2. [道具分類規範](#2-道具分類規範-item-categories)
3. [資料架構設計](#3-資料架構設計)
4. [NPC 整合邏輯](#4-npc-整合邏輯)
5. [限制邏輯規範](#5-限制邏輯規範)
6. [實作清單](#6-實作清單)
7. [資料流程圖](#7-資料流程圖)
8. [技術實作細節](#8-技術實作細節)

---

## 1. 專案背景與版本

### 1.1 版本更新
- **當前版本：** 0.16.2 (NPC Dialogue System & Multi-language Support)
- **目標版本：** 0.16.3 (Shop & Economy System)

### 1.2 更新範圍
以下文件需要更新版本號至 `0.16.3`：
- `packages/shared/src/index.ts` - `GAME_VERSION`
- `packages/client/package.json`
- `packages/server/package.json`
- `packages/dashboard/main/package.json`
- `PROJECT_GUIDE.md` - 頂部版本資訊

### 1.3 核心目標
1. 建立商店配置系統（Firebase `shops` 集合）
2. 連結道具（Items）與商店
3. NPC 與商店關聯（`linkedShopId`）
4. 實作營業時間限制
5. 實作庫存與購買限制邏輯
6. Dashboard 商店編輯器
7. Client 商店 UI 與購買流程

---

## 2. 道具分類規範 (Item Categories)

### 2.1 分類調整
**重要變更：** `Contraband` (非法物品) → `Equipment` (裝備)

所有道具必須歸類為以下四種之一：

| 分類 | 英文 Key | 中文名稱 | 說明 | 範例 |
|------|----------|----------|------|------|
| `consumable` | Consumables | 消耗品 | 食物、藥品、即時恢復道具 | 便當、水、急救包 |
| `equipment` | Equipment | 裝備 | 武器、衣服、可穿戴物品 | 西瓜刀、防彈衣 |
| `special` | Special Items | 特殊物品 | 提供 Buff/Debuff 的道具 | 神打符咒、加成道具 |
| `material` | Materials | 素材 | 用於升級或合成裝備 | 鋼鐵、布料 |

### 2.2 實作任務
- [ ] 更新 `packages/shared/src/index.ts` 中的 `ItemCategory` 類型
- [ ] 更新 Dashboard `locales/en.ts` 和 `locales/zh-TW.ts` 翻譯
- [ ] 更新 `lib/item-helpers.ts` 中的 `getAllCategories()` 函數
- [ ] 檢查所有現有道具是否正確分類

---

## 3. 資料架構設計

### 3.1 Firebase 集合：`shops`

#### 商店文檔結構
```typescript
interface IShop {
  id: string;                    // 商店唯一識別碼（自動生成）
  name: string;                  // 商店名稱（例如："廟街便利店"）
  description?: string;          // 商店描述（可選）

  // 營業時間（24 小時制）
  operatingHours?: {
    start: number;               // 0-23，開始時間（未設定則 24 小時營業）
    end: number;                 // 0-23，結束時間（支援跨夜，如 22-04）
  };

  // 商店道具清單
  itemList: IShopItem[];         // 商店販售的道具列表

  // 元數據
  isActive: boolean;             // 是否啟用（預設 true）
  createdAt: Timestamp;          // 創建時間
  updatedAt: Timestamp;          // 更新時間
}

interface IShopItem {
  itemId: string;                // 連結至 items 集合的道具 ID

  // 庫存設定
  globalStock: number;           // 商店總庫存（-1 = 無限，預設 -1）
  currentStock?: number;         // 當前剩餘庫存（僅當 globalStock > 0 時使用）

  // 購買限制
  personalLimit: number;         // 每位玩家限購件數（0 = 不限，預設 0）

  // 價格調整（可選，未來擴展用）
  priceMultiplier?: number;      // 價格倍數（預設 1.0，例如 1.2 = 漲價 20%）
}
```

#### 索引設定（Firebase Console）
```
shops
  ├── isActive (ASC/DESC)
  └── updatedAt (DESC)
```

### 3.2 更新現有集合：`npc_instances`

#### 新增欄位
```typescript
interface INPCInstance {
  // ... 現有欄位 ...

  // 商店整合（新增）
  linkedShopId?: string;         // 連結的商店 ID（可選）
  isGuildOnly?: boolean;         // 是否僅限社團成員訪問（預設 false）
}
```

### 3.3 更新現有集合：`users`（玩家購買紀錄）

#### 新增子集合：`purchaseHistory`
```typescript
// 路徑：users/{userId}/purchaseHistory/{shopId_itemId}
interface IPurchaseRecord {
  shopId: string;                // 商店 ID
  itemId: string;                // 道具 ID
  purchaseCount: number;         // 已購買數量
  lastPurchaseAt: Timestamp;     // 最後購買時間
  resetAt?: Timestamp;           // 重置時間（若實作每日重置）
}
```

**注意：** 文檔 ID 格式為 `{shopId}_{itemId}`，便於快速查詢

### 3.4 更新 Shared Types

#### `packages/shared/src/index.ts` 新增類型
```typescript
// 道具分類更新
export type ItemCategory = 'consumable' | 'equipment' | 'special' | 'material';

// 商店系統類型
export interface IShop {
  id: string;
  name: string;
  description?: string;
  operatingHours?: {
    start: number;
    end: number;
  };
  itemList: IShopItem[];
  isActive: boolean;
  createdAt: any; // Firestore Timestamp
  updatedAt: any;
}

export interface IShopItem {
  itemId: string;
  globalStock: number;
  currentStock?: number;
  personalLimit: number;
  priceMultiplier?: number;
}

export interface IPurchaseRecord {
  shopId: string;
  itemId: string;
  purchaseCount: number;
  lastPurchaseAt: any; // Firestore Timestamp
  resetAt?: any;
}

// 商店購買請求/響應（Colyseus 消息）
export interface IPurchaseRequest {
  shopId: string;
  itemId: string;
  quantity: number;
}

export interface IPurchaseResponse {
  success: boolean;
  message: string;
  remainingStock?: number;
  remainingPersonalLimit?: number;
}
```

---

## 4. NPC 整合邏輯

### 4.1 NPC 連結商店

#### 在 NPC Instance 中設定
```typescript
// npc_instances 文檔
{
  id: "npc_shop_keeper_01",
  templateId: "template_shopkeeper",
  linkedShopId: "shop_temple_street",  // 連結商店 ID
  isGuildOnly: false,                  // 是否僅限社團成員
  // ... 其他欄位 ...
}
```

#### 點擊 NPC 行為邏輯（Client）
```typescript
// packages/client/src/main.ts
if (target.type === 'npc') {
  const npcData = (room.state as any).enemies.get(target.id);

  // 優先檢查對話樹
  if (npcData.dialogueTreeJson && npcData.dialogueTreeJson !== "") {
    const dialogueTree = JSON.parse(npcData.dialogueTreeJson);
    dialogueSystem.show(target.id, npcData.name, dialogueTree);
    return;
  }

  // 檢查商店連結（新增）
  if (npcData.linkedShopId) {
    // 檢查是否為社團專屬
    if (npcData.isGuildOnly && !playerData.guildId) {
      showNotification("此商店僅限社團成員使用");
      return;
    }

    // 打開商店 UI
    shopSystem.open(npcData.linkedShopId, npcData.name);
    return;
  }

  // 根據 npcType 處理（shop, quest, citizen, police, gangs）
  // ...
}
```

### 4.2 社團專屬商店（isGuildOnly）

#### 驗證邏輯
1. Client 發送購買請求時包含 `userId`
2. Server 檢查 `npc.isGuildOnly`
3. 若為 `true`，查詢 `users/{userId}` 的 `guildId`
4. 若 `guildId` 為空，拒絕購買

**注意：** 社團領地 NPC 的設定將在 Dashboard 中實作領地管理時完成

---

## 5. 限制邏輯規範

### 5.1 庫存系統（Global Stock）

#### 設計決策
- **位置：** 放在 `shops` 集合中（而非 `items`）
- **原因：** 允許不同商店擁有不同庫存數量
- **範例：**
  - 廟街便利店：西瓜刀 × 10
  - 銅鑼灣武器店：西瓜刀 × 50

#### 實作邏輯
```typescript
// 購買時檢查庫存
if (shopItem.globalStock > 0) {
  if (shopItem.currentStock === undefined) {
    shopItem.currentStock = shopItem.globalStock;
  }

  if (shopItem.currentStock < quantity) {
    return { success: false, message: "庫存不足" };
  }

  shopItem.currentStock -= quantity;
  await updateShopStock(shopId, itemId, shopItem.currentStock);
}
```

#### 庫存重置
- **每日重置：** 使用 Cron Job（未來實作）
- **手動重置：** Dashboard 提供「重置庫存」按鈕

### 5.2 個人購買限制（Personal Limit）

#### 實作方式
1. 當 `personalLimit > 0` 時，檢查玩家購買紀錄
2. 查詢 `users/{userId}/purchaseHistory/{shopId}_{itemId}`
3. 計算已購買數量 + 當前購買數量
4. 若超過限制，拒絕購買

#### 購買流程
```typescript
async function validatePurchase(userId: string, shopId: string, itemId: string, quantity: number): Promise<boolean> {
  const shopItem = await getShopItem(shopId, itemId);

  if (shopItem.personalLimit > 0) {
    const recordId = `${shopId}_${itemId}`;
    const record = await db.collection('users').doc(userId)
      .collection('purchaseHistory').doc(recordId).get();

    const purchasedCount = record.exists ? record.data()!.purchaseCount : 0;

    if (purchasedCount + quantity > shopItem.personalLimit) {
      return false; // 超過限購
    }
  }

  return true;
}
```

#### 重置邏輯選項
- **永久限購：** 不重置，直到商店管理員手動重置
- **每日重置：** 每天 00:00 UTC 重置（需實作 Cron）
- **每週重置：** 每週一 00:00 UTC 重置

**本階段實作：** 永久限購（簡化實作）

### 5.3 營業時間檢查

#### 時間驗證邏輯
```typescript
function isShopOpen(operatingHours?: { start: number; end: number }): boolean {
  if (!operatingHours) return true; // 未設定則 24 小時營業

  const now = new Date();
  const currentHour = now.getUTCHours(); // 使用 UTC 時間（或改為伺服器時區）

  const { start, end } = operatingHours;

  // 正常營業時間（例如：09:00 - 18:00）
  if (start < end) {
    return currentHour >= start && currentHour < end;
  }

  // 跨夜營業時間（例如：22:00 - 04:00）
  if (start > end) {
    return currentHour >= start || currentHour < end;
  }

  // start === end（無效設定，預設開放）
  return true;
}
```

---

## 6. 實作清單

### 6.1 Shared Package 更新
- [ ] 更新 `ItemCategory` 類型（移除 `contraband`，新增 `equipment`）
- [ ] 新增 `IShop`, `IShopItem`, `IPurchaseRecord` 介面
- [ ] 新增 `IPurchaseRequest`, `IPurchaseResponse` Colyseus 消息類型
- [ ] 更新 `GAME_VERSION` 至 `0.16.3`

### 6.2 Server Package 實作
- [ ] 創建 `services/ShopService.ts` - 商店數據管理
  - `getAllShops(): Promise<IShop[]>`
  - `getShop(shopId): Promise<IShop | null>`
  - `updateShopStock(shopId, itemId, newStock): Promise<void>`
  - `isShopOpen(shopId): boolean`
- [ ] 創建 `services/PurchaseService.ts` - 購買邏輯
  - `validatePurchase(userId, shopId, itemId, quantity): Promise<ValidationResult>`
  - `executePurchase(userId, shopId, itemId, quantity): Promise<IPurchaseResponse>`
  - `recordPurchase(userId, shopId, itemId, quantity): Promise<void>`
- [ ] 在 `rooms/GameRoom.ts` 註冊購買消息處理
  ```typescript
  this.onMessage("purchase_item", (client, message: IPurchaseRequest) => {
    // 處理購買邏輯
  });
  ```
- [ ] 更新 `services/NPCService.ts` - 載入 NPC 時包含 `linkedShopId` 和 `isGuildOnly`

### 6.3 Client Package 實作
- [ ] 創建 `ui/ShopSystem.ts` - 商店 UI 系統
  - `open(shopId, npcName): void` - 打開商店界面
  - `close(): void` - 關閉商店界面
  - `displayItems(items, shopName): void` - 顯示商品列表
  - `purchaseItem(itemId, quantity): void` - 發送購買請求
- [ ] 創建 `systems/ShopManager.ts` - 商店狀態管理
  - 快取商店數據
  - 處理購買響應
  - 更新玩家庫存
- [ ] 更新 `main.ts` - NPC 點擊邏輯（檢查 `linkedShopId`）
- [ ] 創建 CSS 樣式表 `styles/shop.css`

### 6.4 Dashboard Package 實作

#### 商店管理頁面
- [ ] 創建 `app/shop/page.tsx` - 商店列表頁
- [ ] 創建 `app/shop/[id]/page.tsx` - 商店編輯頁
- [ ] 創建 `components/shop/ShopForm.tsx` - 商店基本資訊表單
- [ ] 創建 `components/shop/ShopItemList.tsx` - 商店道具列表
- [ ] 創建 `components/shop/ItemSelector.tsx` - 道具選擇器（從 items 集合選擇）
- [ ] 創建 `components/shop/OperatingHoursEditor.tsx` - 營業時間編輯器

#### 服務層
- [ ] 創建 `lib/shop/shop-service.ts` - 商店 CRUD 操作
  - `getShops(filters?): Promise<IShop[]>`
  - `getShop(id): Promise<IShop | null>`
  - `createShop(data): Promise<string>`
  - `updateShop(id, data): Promise<void>`
  - `deleteShop(id): Promise<void>`
  - `addItemToShop(shopId, shopItem): Promise<void>`
  - `removeItemFromShop(shopId, itemId): Promise<void>`
  - `resetShopStock(shopId, itemId?): Promise<void>`

#### NPC 連結更新
- [ ] 更新 `components/npc/InstanceForm.tsx`
  - 新增 `linkedShopId` 下拉選單（從 shops 集合載入）
  - 新增 `isGuildOnly` 開關
- [ ] 更新 `lib/npc/instance-service.ts` - 包含新欄位

#### 國際化
- [ ] 更新 `locales/en.ts`
  - 商店相關翻譯（shop.name, shop.operatingHours, etc.）
  - 道具分類更新（equipment 取代 contraband）
- [ ] 更新 `locales/zh-TW.ts` - 相同翻譯
- [ ] 更新 `lib/item-helpers.ts`
  - `getAllCategories()` - 包含 'equipment'

### 6.5 資料驗證
- [ ] 營業時間驗證（start/end 範圍 0-23）
- [ ] 跨夜營業邏輯測試（start > end）
- [ ] 庫存數量驗證（globalStock >= -1）
- [ ] 個人限購驗證（personalLimit >= 0）
- [ ] 價格倍數驗證（priceMultiplier > 0）

---

## 7. 資料流程圖

### 7.1 商店創建流程
```
Dashboard (Shop Editor)
  ↓ 填寫商店資訊
  ↓ 選擇道具（從 items 集合）
  ↓ 設定庫存、限購、營業時間
  ↓
lib/shop/shop-service.ts
  ↓ createShop()
  ↓
Firebase (shops 集合)
  ↓ 存儲商店配置
  ↓
Server 重啟 / 動態載入
  ↓ ShopService.initialize()
  ↓
Server 記憶體中的商店數據
```

### 7.2 NPC 商店連結流程
```
Dashboard (NPC Instance Editor)
  ↓ 選擇 NPC
  ↓ 設定 linkedShopId（下拉選單）
  ↓ 設定 isGuildOnly（開關）
  ↓
lib/npc/instance-service.ts
  ↓ updateInstance()
  ↓
Firebase (npc_instances 集合)
  ↓
Server 重啟
  ↓ NPCService.initialize()
  ↓ NPCManager.initialize()
  ↓
room.state.enemies（包含 linkedShopId）
  ↓ Colyseus 同步
  ↓
Client (main.ts)
  ↓ 點擊 NPC
  ↓ 檢查 npcData.linkedShopId
  ↓
ShopSystem.open(shopId)
```

### 7.3 商店購買流程
```
Client (ShopSystem)
  ↓ 玩家點擊「購買」按鈕
  ↓ room.send("purchase_item", { shopId, itemId, quantity })
  ↓
Server (GameRoom)
  ↓ onMessage("purchase_item")
  ↓ PurchaseService.validatePurchase()
  ↓   ├─ 檢查營業時間
  ↓   ├─ 檢查庫存（globalStock）
  ↓   ├─ 檢查個人限購（purchaseHistory）
  ↓   └─ 檢查玩家金錢
  ↓
  ↓ 驗證通過
  ↓ PurchaseService.executePurchase()
  ↓   ├─ 扣除玩家金錢
  ↓   ├─ 增加玩家道具
  ↓   ├─ 更新商店庫存（若非無限）
  ↓   └─ 記錄購買紀錄（若有限購）
  ↓
  ↓ 返回 IPurchaseResponse
  ↓
Client (ShopSystem)
  ↓ 收到購買結果
  ↓ 顯示成功/失敗訊息
  ↓ 更新 UI（庫存、金錢、道具列表）
```

---

## 8. 技術實作細節

### 8.1 Dashboard: 營業時間編輯器 UI

#### 組件設計（OperatingHoursEditor.tsx）
```tsx
import React from 'react';

interface OperatingHoursEditorProps {
  value?: { start: number; end: number };
  onChange: (value?: { start: number; end: number }) => void;
}

export function OperatingHoursEditor({ value, onChange }: OperatingHoursEditorProps) {
  const [enabled, setEnabled] = React.useState(!!value);

  const handleToggle = (checked: boolean) => {
    setEnabled(checked);
    if (!checked) {
      onChange(undefined); // 24 小時營業
    } else {
      onChange({ start: 0, end: 23 }); // 預設值
    }
  };

  return (
    <div>
      <label>
        <input type="checkbox" checked={enabled} onChange={e => handleToggle(e.target.checked)} />
        設定營業時間（未勾選則 24 小時營業）
      </label>

      {enabled && (
        <div>
          <label>
            開始時間：
            <select value={value?.start ?? 0} onChange={e => onChange({ ...value!, start: Number(e.target.value) })}>
              {[...Array(24)].map((_, i) => (
                <option key={i} value={i}>{i.toString().padStart(2, '0')}:00</option>
              ))}
            </select>
          </label>

          <label>
            結束時間：
            <select value={value?.end ?? 23} onChange={e => onChange({ ...value!, end: Number(e.target.value) })}>
              {[...Array(24)].map((_, i) => (
                <option key={i} value={i}>{i.toString().padStart(2, '0')}:00</option>
              ))}
            </select>
          </label>

          {value && value.start > value.end && (
            <p style={{ color: 'orange' }}>⚠️ 跨夜營業模式（例如：22:00 - 04:00）</p>
          )}
        </div>
      )}
    </div>
  );
}
```

### 8.2 Client: 商店 UI HTML 結構

#### 商店界面（shop.html 或內嵌於 index.html）
```html
<div id="shop-ui" class="shop-container" style="display: none;">
  <div class="shop-panel">
    <!-- 標題欄 -->
    <div class="shop-header">
      <h2 id="shop-title">商店名稱</h2>
      <button id="shop-close-btn" class="close-btn">✕</button>
    </div>

    <!-- 過濾器 -->
    <div class="shop-filters">
      <button class="filter-btn active" data-category="all">全部</button>
      <button class="filter-btn" data-category="consumable">消耗品</button>
      <button class="filter-btn" data-category="equipment">裝備</button>
      <button class="filter-btn" data-category="special">特殊物品</button>
      <button class="filter-btn" data-category="material">素材</button>
    </div>

    <!-- 商品列表 -->
    <div id="shop-items-list" class="shop-items">
      <!-- 動態生成商品卡片 -->
      <!-- 範例：
      <div class="shop-item" data-item-id="item_001">
        <img src="/items/item_001.png" alt="便當" />
        <div class="item-info">
          <h3>便當</h3>
          <p class="item-description">恢復 50 HP</p>
          <p class="item-price">$100</p>
          <p class="item-stock">庫存：10 / 限購：5</p>
        </div>
        <button class="buy-btn">購買</button>
      </div>
      -->
    </div>

    <!-- 購買確認對話框 -->
    <div id="shop-purchase-dialog" class="purchase-dialog" style="display: none;">
      <h3>確認購買</h3>
      <p id="purchase-item-name"></p>
      <input type="number" id="purchase-quantity" min="1" value="1" />
      <p id="purchase-total-price">總價：$0</p>
      <button id="purchase-confirm-btn">確認</button>
      <button id="purchase-cancel-btn">取消</button>
    </div>
  </div>
</div>
```

### 8.3 Server: 購買驗證邏輯

#### PurchaseService.ts 核心方法
```typescript
import { db } from './FirebaseService';
import { ShopService } from './ShopService';
import { IShop, IShopItem, IPurchaseResponse } from '@gangs-online/shared';

export class PurchaseService {

  /**
   * 驗證購買請求
   */
  static async validatePurchase(
    userId: string,
    shopId: string,
    itemId: string,
    quantity: number
  ): Promise<{ valid: boolean; message?: string }> {

    // 1. 檢查商店是否存在
    const shop = await ShopService.getShop(shopId);
    if (!shop) {
      return { valid: false, message: "商店不存在" };
    }

    // 2. 檢查營業時間
    if (!ShopService.isShopOpen(shop)) {
      return { valid: false, message: "商店未營業" };
    }

    // 3. 檢查商品是否在商店中
    const shopItem = shop.itemList.find(item => item.itemId === itemId);
    if (!shopItem) {
      return { valid: false, message: "商店未販售此商品" };
    }

    // 4. 檢查庫存
    if (shopItem.globalStock > 0) {
      const currentStock = shopItem.currentStock ?? shopItem.globalStock;
      if (currentStock < quantity) {
        return { valid: false, message: `庫存不足（剩餘 ${currentStock}）` };
      }
    }

    // 5. 檢查個人限購
    if (shopItem.personalLimit > 0) {
      const recordId = `${shopId}_${itemId}`;
      const recordDoc = await db.collection('users').doc(userId)
        .collection('purchaseHistory').doc(recordId).get();

      const purchasedCount = recordDoc.exists ? recordDoc.data()!.purchaseCount : 0;
      const remainingLimit = shopItem.personalLimit - purchasedCount;

      if (remainingLimit < quantity) {
        return { valid: false, message: `超過限購數量（剩餘 ${remainingLimit}）` };
      }
    }

    // 6. 檢查道具價格（從 items 集合讀取）
    const itemDoc = await db.collection('items').doc(itemId).get();
    if (!itemDoc.exists) {
      return { valid: false, message: "道具不存在" };
    }

    const itemPrice = itemDoc.data()!.price || 0;
    const priceMultiplier = shopItem.priceMultiplier ?? 1.0;
    const totalPrice = Math.floor(itemPrice * priceMultiplier * quantity);

    // 7. 檢查玩家金錢（從 users 集合讀取）
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return { valid: false, message: "玩家不存在" };
    }

    const playerMoney = userDoc.data()!.money || 0;
    if (playerMoney < totalPrice) {
      return { valid: false, message: `金錢不足（需要 $${totalPrice}）` };
    }

    return { valid: true };
  }

  /**
   * 執行購買
   */
  static async executePurchase(
    userId: string,
    shopId: string,
    itemId: string,
    quantity: number
  ): Promise<IPurchaseResponse> {

    // 驗證
    const validation = await this.validatePurchase(userId, shopId, itemId, quantity);
    if (!validation.valid) {
      return { success: false, message: validation.message! };
    }

    // 獲取道具價格
    const itemDoc = await db.collection('items').doc(itemId).get();
    const itemPrice = itemDoc.data()!.price || 0;

    const shop = await ShopService.getShop(shopId);
    const shopItem = shop!.itemList.find(item => item.itemId === itemId)!;
    const priceMultiplier = shopItem.priceMultiplier ?? 1.0;
    const totalPrice = Math.floor(itemPrice * priceMultiplier * quantity);

    const batch = db.batch();

    // 1. 扣除玩家金錢
    const userRef = db.collection('users').doc(userId);
    batch.update(userRef, {
      money: admin.firestore.FieldValue.increment(-totalPrice)
    });

    // 2. 增加玩家道具（inventory 子集合）
    const inventoryRef = userRef.collection('inventory').doc(itemId);
    batch.set(inventoryRef, {
      itemId: itemId,
      quantity: admin.firestore.FieldValue.increment(quantity)
    }, { merge: true });

    // 3. 更新商店庫存（若非無限）
    if (shopItem.globalStock > 0) {
      const shopRef = db.collection('shops').doc(shopId);
      const newStock = (shopItem.currentStock ?? shopItem.globalStock) - quantity;

      // 更新 itemList 中的 currentStock
      const updatedItemList = shop!.itemList.map(item => {
        if (item.itemId === itemId) {
          return { ...item, currentStock: newStock };
        }
        return item;
      });

      batch.update(shopRef, { itemList: updatedItemList });
    }

    // 4. 記錄購買紀錄（若有限購）
    if (shopItem.personalLimit > 0) {
      const recordId = `${shopId}_${itemId}`;
      const recordRef = userRef.collection('purchaseHistory').doc(recordId);
      batch.set(recordRef, {
        shopId: shopId,
        itemId: itemId,
        purchaseCount: admin.firestore.FieldValue.increment(quantity),
        lastPurchaseAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    }

    // 提交批次操作
    await batch.commit();

    // 計算剩餘數量
    const remainingStock = shopItem.globalStock > 0
      ? (shopItem.currentStock ?? shopItem.globalStock) - quantity
      : undefined;

    const remainingPersonalLimit = shopItem.personalLimit > 0
      ? shopItem.personalLimit - quantity
      : undefined;

    return {
      success: true,
      message: "購買成功",
      remainingStock,
      remainingPersonalLimit
    };
  }
}
```

### 8.4 測試案例

#### 商店創建測試
```typescript
// 測試案例 1: 建立 24 小時便利店
{
  name: "廟街 24 小時便利店",
  operatingHours: undefined, // 24 小時營業
  itemList: [
    { itemId: "item_bento", globalStock: -1, personalLimit: 0 }, // 無限庫存，不限購
    { itemId: "item_water", globalStock: 100, personalLimit: 10 } // 限量 100，每人限購 10
  ]
}

// 測試案例 2: 建立跨夜武器店
{
  name: "銅鑼灣武器店",
  operatingHours: { start: 22, end: 4 }, // 22:00 - 04:00
  itemList: [
    { itemId: "item_knife", globalStock: 50, personalLimit: 1 } // 限量 50，每人限購 1
  ]
}
```

#### 購買邏輯測試
```typescript
// 測試案例 1: 正常購買
await executePurchase('user_001', 'shop_001', 'item_bento', 2);
// 預期：成功，扣除金錢，增加道具

// 測試案例 2: 庫存不足
await executePurchase('user_001', 'shop_001', 'item_knife', 100);
// 預期：失敗，message: "庫存不足"

// 測試案例 3: 超過限購
await executePurchase('user_001', 'shop_001', 'item_water', 11);
// 預期：失敗，message: "超過限購數量"

// 測試案例 4: 非營業時間
// 當前時間：05:00，商店營業時間：22:00 - 04:00
await executePurchase('user_001', 'shop_002', 'item_knife', 1);
// 預期：失敗，message: "商店未營業"
```

---

## 9. 未來擴展

### 9.1 每日庫存重置（Phase 16.4+）
- 實作 Cloud Functions 定時任務
- 每日 00:00 UTC 重置 `currentStock` 為 `globalStock`

### 9.2 動態定價（Phase 17+）
- 根據供需調整 `priceMultiplier`
- 稀有道具價格波動

### 9.3 玩家商店（Player-owned Shops）
- 允許玩家開設商店
- 玩家自訂價格和庫存

### 9.4 拍賣系統
- 玩家之間交易
- 競標機制

---

## 10. 注意事項

### 10.1 效能考量
- **商店數據快取：** Server 啟動時載入所有商店至記憶體
- **購買紀錄查詢：** 使用複合索引加速查詢
- **批次操作：** 使用 Firestore Batch 確保原子性

### 10.2 安全性
- **伺服器端驗證：** 所有購買邏輯在 Server 執行，Client 不可信任
- **防刷錢：** 使用 Firestore Transaction 防止並發問題
- **權限控制：** 社團專屬商店需驗證 `guildId`

### 10.3 用戶體驗
- **即時反饋：** 購買成功後立即更新 UI
- **錯誤提示：** 清楚顯示失敗原因（庫存不足、金錢不足等）
- **營業時間提示：** 關閉時顯示「下次營業時間」

---

## 11. 驗收標準

- [ ] Dashboard 可以創建/編輯/刪除商店
- [ ] Dashboard 可以為商店添加道具並設定庫存、限購
- [ ] Dashboard 可以設定營業時間（含跨夜驗證）
- [ ] Dashboard 可以在 NPC Instance 中連結商店
- [ ] Client 點擊連結商店的 NPC 可打開商店 UI
- [ ] Client 商店 UI 顯示道具、價格、庫存、限購資訊
- [ ] Client 可以成功購買道具（扣錢、增加道具、更新庫存）
- [ ] 非營業時間無法購買（顯示錯誤訊息）
- [ ] 庫存不足時無法購買
- [ ] 超過個人限購時無法購買
- [ ] 社團專屬商店非成員無法訪問
- [ ] 所有操作通過 TypeScript 類型檢查
- [ ] 版本號已更新至 0.16.3

---

**最後更新：** 2026-01-26
**文檔作者：** Claude Code
**狀態：** 待實作
