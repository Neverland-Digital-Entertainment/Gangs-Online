# Item Management System - Phase 16

## 概述 (Overview)

道具管理系統是《Gangs Online》後台管理程式的核心組件，用於管理遊戲中所有的動態道具數據。

## 功能特點 (Features)

- ✅ 完整的 CRUD 操作（創建、讀取、更新、刪除）
- ✅ 支援四種道具分類：消耗品、宗教道具、非法物資、素材
- ✅ Firebase Firestore 數據存儲
- ✅ Firebase Storage 圖片管理
- ✅ 實時搜索和篩選
- ✅ 道具複製功能
- ✅ 分類特定屬性編輯
- ✅ 圖片上傳和預覽

## 技術架構 (Architecture)

### 文件結構

```
packages/dashboard/metronic/
├── app/(protected)/item-admin/
│   ├── dashboard/                 # 儀表板頁面
│   │   ├── page.tsx
│   │   └── content.tsx
│   └── items/                     # 道具管理頁面
│       ├── page.tsx               # 列表頁面
│       ├── content.tsx
│       └── [id]/                  # 編輯器頁面
│           ├── page.tsx
│           ├── content.tsx
│           └── components/        # 編輯器組件
│               ├── basic-info-section.tsx
│               ├── economic-section.tsx
│               └── attributes-section.tsx
├── services/
│   ├── firebase-config.ts         # Firebase 配置
│   └── item-service.ts            # 道具服務層
├── types/
│   └── items.ts                   # 類型定義
└── config/
    └── menu.config.tsx            # 菜單配置（已更新）
```

## 環境配置 (Environment Setup)

### 1. 安裝依賴

```bash
cd packages/dashboard/metronic
npm install
```

已添加的依賴：
- `firebase` ^11.1.0

### 2. 配置 Firebase

在 `.env.local` 文件中添加 Firebase 配置（參考 `.env.example`）：

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_firebase_app_id
```

### 3. Firebase Firestore 設置

在 Firebase Console 中：

1. 創建 `items` 集合
2. 設置安全規則：

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /items/{itemId} {
      // 允許管理員讀寫
      allow read, write: if request.auth != null;
    }
  }
}
```

### 4. Firebase Storage 設置

1. 創建 `item-images` 文件夾
2. 設置存儲規則：

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /item-images/{imageId} {
      // 允許管理員上傳和讀取
      allow read, write: if request.auth != null;
    }
  }
}
```

## 道具分類 (Item Categories)

### 1. 消耗品 (Consumables)

**用途：** 恢復角色狀態

**特定屬性：**
- `hpRestore`: HP 恢復值
- `vpRestore`: VP（精力值）恢復值
- `cooldown`: 使用冷卻時間（秒）

**範例：** 火雞、南瓜派

### 2. 宗教道具 (Special Items)

**用途：** 用於神打系統或特殊任務

**特定屬性：**
- `faithCost`: 信仰消耗量
- `deityId`: 對應的神祇 ID（可選）

**範例：** 香、聖水

### 3. 非法物資 (Contraband)

**用途：** 走私與黑市貿易

**特定屬性：**
- `crimeValue`: 罪惡值（攜帶時增加）
- `policeDetectionMultiplier`: 警察查獲機率倍率

**範例：** 走私菸酒、違禁品

### 4. 素材 (Materials)

**用途：** 烹飪、製藥或縫紉系統

**特定屬性：**
- `stackLimit`: 堆疊上限

**範例：** 各種原料、材料

## API 使用 (API Usage)

### ItemService 類

```typescript
import { itemService } from '@/services/item-service';

// 創建道具
const itemId = await itemService.createItem(formData);

// 獲取道具
const item = await itemService.getItem(itemId);

// 獲取所有道具（支援篩選）
const items = await itemService.getItems({
  search: 'keyword',
  category: 'consumable',
  isActive: true,
});

// 更新道具
await itemService.updateItem(itemId, formData);

// 刪除道具
await itemService.deleteItem(itemId);

// 複製道具
const newId = await itemService.duplicateItem(itemId);
```

## 數據結構 (Data Structure)

### Item 接口

```typescript
interface Item {
  id: string;
  name: string;
  description: string;
  category: 'consumable' | 'special' | 'contraband' | 'material';
  imageUrl: string;
  price: number;
  sellPrice: number;
  isTradeable: boolean;
  isDroppable: boolean;
  isActive: boolean;
  attributes: ItemAttributes; // 根據分類不同而不同
  createdAt: Date;
  updatedAt: Date;
}
```

## 使用指南 (Usage Guide)

### 創建新道具

1. 進入「Item Management」→「Add New Item」
2. 填寫基本資訊：
   - 道具名稱
   - 說明
   - 選擇分類
   - 上傳圖示（建議 128x128 像素）
3. 設定經濟屬性：
   - 買入價格
   - 賣出價格
   - 可交易、可丟棄選項
4. 根據分類填寫動態屬性
5. 設定是否啟用
6. 點擊「Create Item」

### 編輯道具

1. 進入「Item Management」→「All Items」
2. 點擊道具卡片上的「Edit」按鈕
3. 修改需要的欄位
4. 點擊「Save Changes」

### 搜索和篩選

1. 進入「Item Management」→「All Items」
2. 使用篩選器：
   - 搜索欄：輸入名稱或 ID
   - 分類下拉選單：選擇特定分類
   - 狀態下拉選單：篩選啟用/停用的道具

### 複製道具

1. 在道具列表中找到要複製的道具
2. 點擊複製按鈕（📋圖示）
3. 系統會創建一個名為「原名稱 (Copy)」的新道具
4. 新道具默認為停用狀態

### 刪除道具

1. 在道具列表中找到要刪除的道具
2. 點擊刪除按鈕（🗑️圖示）
3. 再次點擊確認刪除

## 注意事項 (Notes)

1. **圖片限制：**
   - 最大文件大小：2MB
   - 建議尺寸：128x128 像素
   - 支援格式：所有常見圖片格式

2. **數值驗證：**
   - 所有價格和數值必須為非負數
   - 避免負數導致遊戲漏洞

3. **狀態管理：**
   - 只有啟用的道具會在遊戲中出現
   - 可以先創建道具並設為停用，測試完成後再啟用

4. **未來擴展：**
   - 商店關聯：道具將能被分配到 NPC 商店
   - 掉落表：道具 ID 可用於設定 NPC 掉落率

## 疑難排解 (Troubleshooting)

### Firebase 連接失敗

檢查 `.env.local` 中的 Firebase 配置是否正確。

### 圖片上傳失敗

1. 檢查 Firebase Storage 規則
2. 確認圖片大小不超過 2MB
3. 檢查網絡連接

### 道具列表為空

1. 檢查 Firestore 規則
2. 確認已登入並有權限
3. 檢查瀏覽器控制台錯誤訊息

## 開發建議 (Development Tips)

1. **模組化設計：** 編輯器組件已模組化，可輕鬆複用於其他模組（如裝備系統）
2. **類型安全：** 使用 TypeScript 類型定義，確保數據一致性
3. **實時監聽：** 可在 `item-service.ts` 中添加 Firestore 實時監聽器
4. **驗證邏輯：** 在客戶端和服務端都應進行數據驗證

## 相關文件 (Related Documents)

- [Phase16-1.md](../../Phase16-1.md) - 原始需求文檔
- [Firebase 文檔](https://firebase.google.com/docs)
- [Next.js 文檔](https://nextjs.org/docs)

## 聯絡支援 (Support)

如有問題，請聯繫開發團隊或查閱項目文檔。
