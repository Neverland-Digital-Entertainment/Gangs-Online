# Gangs Online - 管理後台

版本：0.16.1

## 📁 統一的 Dashboard 架構

這是一個統一的管理後台應用，所有模組共用相同的 UI 框架和導航系統。

```
packages/dashboard/main/
├── src/
│   ├── app/
│   │   ├── layout.tsx          # 共用 Layout (側邊欄、導航)
│   │   ├── page.tsx            # Dashboard 主頁
│   │   ├── item/               # 道具管理模組
│   │   │   ├── page.tsx        # /dashboard/item/
│   │   │   ├── new/            # /dashboard/item/new/
│   │   │   └── edit/[id]/      # /dashboard/item/edit/[id]/
│   │   ├── npc/                # NPC 管理 (未來)
│   │   └── quest/              # 任務管理 (未來)
│   ├── components/
│   │   ├── layout/             # 共用 Layout 組件
│   │   │   └── Sidebar.tsx
│   │   └── item/               # 道具模組組件
│   ├── lib/
│   │   ├── firebase/           # Firebase 配置
│   │   └── item/               # 道具服務
│   └── types/                  # TypeScript 類型定義
├── public/images/              # 靜態資源
├── next.config.mjs             # basePath: /dashboard
└── package.json                # v0.16.1
```

## 🚀 快速開始

### 1. 安裝依賴

```bash
cd packages/dashboard/main
npm install
```

### 2. 設定環境變數

```bash
cp .env.example .env.local
```

編輯 `.env.local` 並填入 Firebase 配置。

### 3. 啟動開發伺服器

```bash
npm run dev
```

訪問：`http://localhost:3001/dashboard`

### 4. 建置用於部署

```bash
npm run build
```

輸出到 `out/` 目錄，可部署到 Cloudflare Pages。

## 🌐 部署到 Cloudflare Pages

### URL 結構

部署後的訪問路徑：

```
https://your-domain.pages.dev/dashboard/          # 主頁
https://your-domain.pages.dev/dashboard/item/     # 道具管理
https://your-domain.pages.dev/dashboard/npc/      # NPC 管理 (未來)
https://your-domain.pages.dev/dashboard/quest/    # 任務管理 (未來)
```

### 部署步驟

1. **連接到 Git 儲存庫**
2. **Build 設定：**
   - Build command: `cd packages/dashboard/main && npm install && npm run build`
   - Build output directory: `packages/dashboard/main/out`
3. **環境變數：** 在 Cloudflare Pages 設定中添加 Firebase 環境變數

## 📦 模組系統

### 當前模組

#### 道具管理 (`/dashboard/item/`)
- ✅ 完整的 CRUD 操作
- ✅ 四種道具分類（消耗品、宗教道具、非法物資、素材）
- ✅ 圖片上傳到 Firebase Storage
- ✅ 搜尋和過濾功能
- ✅ 即時預覽

### 未來模組

#### NPC 管理 (`/dashboard/npc/`)
- 📋 計劃中

#### 任務管理 (`/dashboard/quest/`)
- 📋 計劃中

#### 商店管理 (`/dashboard/shop/`)
- 📋 計劃中

## 🎨 共用 UI 組件

所有模組共用以下 UI 元素：

- **側邊欄導航** (`Sidebar.tsx`)
- **全局樣式** (`globals.css`)
- **按鈕、卡片、表單** 等共用組件

新增模組時只需：
1. 在 `src/app/` 下創建新資料夾
2. 在 `Sidebar.tsx` 添加導航項目
3. 實現模組特定的頁面和組件

## 🔧 技術棧

- **Next.js 15** - App Router
- **React 19** - UI 框架
- **TypeScript** - 型別安全
- **Tailwind CSS 4** - 樣式框架
- **Firebase 11** - 後端服務
  - Firestore - 資料庫
  - Storage - 圖片儲存
- **Lucide React** - 圖標

## 📝 開發注意事項

### 添加新模組

1. **創建路由**
   ```
   src/app/your-module/page.tsx
   ```

2. **添加導航**
   在 `src/components/layout/Sidebar.tsx` 添加選單項目

3. **創建組件**
   ```
   src/components/your-module/YourComponent.tsx
   ```

4. **創建服務**
   ```
   src/lib/your-module/service.ts
   ```

5. **定義類型**
   ```
   src/types/your-module.ts
   ```

### 版本管理

當前版本：**0.16.1**

更新版本時需修改：
- `package.json`
- `Sidebar.tsx` (底部版本顯示)
- `README.md`

## 🔐 Firebase 安全規則

### Firestore

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /items/{itemId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null &&
                   request.auth.token.admin == true;
    }
  }
}
```

### Storage

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /item-images/{imageId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null &&
                   request.auth.token.admin == true;
    }
  }
}
```

## 📖 API 參考

### Item Service

```typescript
// 創建道具
await itemService.createItem(formData: ItemFormData): Promise<string>

// 獲取道具
await itemService.getItem(itemId: string): Promise<Item | null>

// 獲取所有道具
await itemService.getItems(filter?: ItemFilter): Promise<Item[]>

// 更新道具
await itemService.updateItem(itemId: string, formData: ItemFormData): Promise<void>

// 刪除道具
await itemService.deleteItem(itemId: string): Promise<void>

// 複製道具
await itemService.duplicateItem(itemId: string): Promise<string>
```

## 🐛 疑難排解

### Firebase 連線錯誤
檢查 `.env.local` 中的 Firebase 配置是否正確。

### 圖片上傳失敗
確認 Firebase Storage 規則已正確設定。

### 路由 404
確保開發伺服器使用正確的 basePath (`/dashboard`)。

### 建置失敗
```bash
rm -rf .next node_modules
npm install
npm run build
```

## 📄 授權

此專案為 Gangs Online 專案的一部分，版權所有。
