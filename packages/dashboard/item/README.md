# Gangs Online - Item Management Dashboard

道具管理系統 (Phase 16)

## 📁 專案結構

```
packages/dashboard/item/
├── src/
│   ├── app/              # Next.js 15 App Router
│   │   ├── page.tsx      # 道具列表頁面
│   │   ├── new/          # 新增道具
│   │   ├── edit/[id]/    # 編輯道具
│   │   ├── layout.tsx    # 根 Layout
│   │   └── globals.css   # 全局樣式
│   ├── components/       # 可重用組件
│   │   ├── AttributesSection.tsx    # 分類屬性編輯
│   │   ├── BasicInfoSection.tsx     # 基本資訊編輯
│   │   └── EconomicSection.tsx      # 經濟屬性編輯
│   ├── lib/              # 工具和服務
│   │   ├── firebase.ts         # Firebase 配置
│   │   └── item-service.ts     # 道具 CRUD 服務
│   └── types/            # TypeScript 類型定義
│       └── items.ts      # 道具類型
├── public/
│   └── images/           # 靜態圖片資源
│       └── no-image.png  # 預設圖片
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── next.config.mjs       # basePath: /item-admin

## 🚀 快速開始

### 1. 安裝依賴

```bash
cd packages/dashboard/item
npm install
```

### 2. 設定環境變數

複製 `.env.example` 並建立 `.env.local`:

```bash
cp .env.example .env.local
```

編輯 `.env.local` 並填入您的 Firebase 配置：

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

### 3. 啟動開發伺服器

```bash
npm run dev
```

應用將在 `http://localhost:3001` 啟動，並使用 basePath `/item-admin`

訪問: `http://localhost:3001/item-admin`

### 4. 建置生產版本

```bash
npm run build
```

輸出為靜態導出，位於 `out/` 目錄

## 📖 功能說明

### 道具分類

系統支援四種道具分類，每種分類有特定的屬性：

#### 1. 消耗品 (Consumables)
- **用途**: 恢復角色狀態
- **屬性**:
  - `hpRestore`: HP 恢復值
  - `vpRestore`: VP（精力值）恢復值
  - `cooldown`: 使用冷卻時間（秒）
- **範例**: 火雞、南瓜派

#### 2. 宗教道具 (Special Items)
- **用途**: 神打系統或特殊任務
- **屬性**:
  - `faithCost`: 信仰消耗量
  - `deityId`: 對應的神祇 ID（可選）
- **範例**: 香、聖水

#### 3. 非法物資 (Contraband)
- **用途**: 走私與黑市貿易
- **屬性**:
  - `crimeValue`: 罪惡值（攜帶時增加）
  - `policeDetectionMultiplier`: 警察查獲機率倍率
- **範例**: 走私菸酒、違禁品

#### 4. 素材 (Materials)
- **用途**: 烹飪、製藥或縫紉系統
- **屬性**:
  - `stackLimit`: 堆疊上限
- **範例**: 原料、材料

### 核心功能

#### ✅ CRUD 操作
- **創建**: 新增道具到 Firestore
- **讀取**: 查詢和過濾道具列表
- **更新**: 修改現有道具資訊
- **刪除**: 移除道具（包含圖片）
- **複製**: 快速複製現有道具

#### 🔍 搜尋與過濾
- 依名稱或 ID 搜尋
- 依分類篩選
- 依狀態篩選（啟用/停用）

#### 📸 圖片管理
- 上傳道具圖示到 Firebase Storage
- 自動產生唯一檔名
- 刪除道具時自動清理圖片
- 預覽功能

#### 💰 經濟系統
- 買入/賣出價格設定
- 可交易標記
- 可丟棄標記

## 🔧 API 參考

### ItemService

```typescript
// 創建道具
await itemService.createItem(formData: ItemFormData): Promise<string>

// 獲取道具
await itemService.getItem(itemId: string): Promise<Item | null>

// 獲取所有道具（含過濾）
await itemService.getItems(filter?: ItemFilter): Promise<Item[]>

// 更新道具
await itemService.updateItem(itemId: string, formData: ItemFormData): Promise<void>

// 刪除道具
await itemService.deleteItem(itemId: string): Promise<void>

// 複製道具
await itemService.duplicateItem(itemId: string): Promise<string>
```

## 📱 路由結構

- `/` - 道具列表（主頁）
- `/new` - 新增道具
- `/edit/[id]` - 編輯道具

實際 URL（with basePath）:
- `http://localhost:3001/item-admin` - 道具列表
- `http://localhost:3001/item-admin/new` - 新增道具
- `http://localhost:3001/item-admin/edit/[id]` - 編輯道具

## 🎨 UI 組件

### 基本組件（globals.css）
- `.btn`, `.btn-primary`, `.btn-light`, `.btn-danger` - 按鈕樣式
- `.card`, `.card-header`, `.card-body` - 卡片容器
- `.input`, `.select`, `.textarea` - 表單元素
- `.form-label`, `.form-hint` - 表單標籤

### 顏色主題
- Primary: #1976d2
- Success: #4caf50
- Warning: #ff9800
- Danger: #f44336

## 📦 部署

此應用使用靜態導出（`output: 'export'`），可部署到：

- **GitHub Pages**
- **Cloudflare Pages**
- **Vercel**
- **Netlify**

建置後的檔案位於 `out/` 目錄，確保伺服器支援 SPA 路由。

basePath 設定為 `/item-admin`，部署時無需修改配置。

## 🔐 Firebase 安全規則

建議在 Firestore 中設定安全規則：

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /items/{itemId} {
      // 僅允許認證用戶讀取
      allow read: if request.auth != null;

      // 僅允許管理員寫入
      allow write: if request.auth != null &&
                   request.auth.token.admin == true;
    }
  }
}
```

Storage 規則：

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /item-images/{imageId} {
      // 僅允許認證用戶讀取
      allow read: if request.auth != null;

      // 僅允許管理員上傳/刪除
      allow write: if request.auth != null &&
                   request.auth.token.admin == true;
    }
  }
}
```

## 🛠️ 技術棧

- **Next.js 15** - React 框架（App Router）
- **React 19** - UI 函式庫
- **TypeScript** - 型別安全
- **Tailwind CSS 4** - 樣式框架
- **Firebase 11** - 後端服務
  - Firestore - NoSQL 資料庫
  - Storage - 圖片儲存
- **Lucide React** - Icon 圖示

## 📝 開發注意事項

1. **模組化設計**: 組件可重用於未來的其他模組（NPC、Quest 等）
2. **類型安全**: 完整的 TypeScript 類型定義
3. **錯誤處理**: 完善的錯誤提示和驗證
4. **響應式設計**: 支援各種螢幕尺寸
5. **圖片最佳化**: 建議使用 128x128 或 64x64 像素

## 🔄 未來擴展

此模組設計為可擴展架構，未來可添加：

- **商店關聯**: 將道具分配到商店 NPC
- **掉落表**: 設定 NPC 掉落率
- **合成系統**: 道具合成配方
- **任務關聯**: 任務獎勵道具

## 🐛 疑難排解

### Firebase 連線錯誤
確認 `.env.local` 中的 Firebase 配置正確

### 圖片上傳失敗
檢查 Firebase Storage 規則是否正確設定

### 路由 404
確認開發伺服器使用正確的端口（3001）和 basePath

### 建置失敗
```bash
rm -rf .next node_modules
npm install
npm run build
```

## 📄 授權

此專案為 Gangs Online 專案的一部分，版權所有。
