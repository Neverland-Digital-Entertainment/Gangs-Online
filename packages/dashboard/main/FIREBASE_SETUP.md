# Firebase 配置說明

Dashboard 使用 Firebase 作為後端服務，需要正確配置環境變數才能運作。

## 步驟 1：取得 Firebase 配置

1. 前往 [Firebase Console](https://console.firebase.google.com/)
2. 選擇您的專案（或創建新專案）
3. 點擊專案設定（齒輪圖示）
4. 在「一般」分頁中，向下捲動至「您的應用程式」
5. 選擇或新增一個 Web 應用程式
6. 複製 Firebase 配置資訊

## 步驟 2：設定環境變數

### 本地開發

1. 複製 `.env.example` 檔案為 `.env.local`：
   ```bash
   cp .env.example .env.local
   ```

2. 編輯 `.env.local`，填入您的 Firebase 配置：
   ```env
   NEXT_PUBLIC_FIREBASE_API_KEY=your_actual_api_key
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
   NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abcdef
   ```

3. 重新啟動開發伺服器：
   ```bash
   npm run dev
   ```

### Cloudflare Pages 部署

1. 前往您的 Cloudflare Pages 專案
2. 進入「設定」→「環境變數」
3. 添加以下環境變數（Production 和 Preview 都要設定）：
   - `NEXT_PUBLIC_FIREBASE_API_KEY`
   - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
   - `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
   - `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
   - `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
   - `NEXT_PUBLIC_FIREBASE_APP_ID`

4. 重新部署您的應用

## 步驟 3：配置 Firebase 服務

### Firestore Database

1. 在 Firebase Console 中，前往「Firestore Database」
2. 點擊「建立資料庫」
3. 選擇「以測試模式啟動」（稍後可以更改安全規則）
4. 選擇資料庫位置（建議選擇亞洲區域）

### Storage

1. 在 Firebase Console 中，前往「Storage」
2. 點擊「開始使用」
3. 使用預設的安全規則
4. 確認儲存空間位置

## 疑難排解

### 錯誤：Firebase 配置不完整

如果您在瀏覽器控制台看到類似以下錯誤：
```
❌ Firebase 配置錯誤：缺少以下環境變數：
   - NEXT_PUBLIC_FIREBASE_API_KEY
```

請確認：
1. 環境變數名稱正確（必須以 `NEXT_PUBLIC_` 開頭）
2. `.env.local` 檔案在正確的目錄（`packages/dashboard/main/`）
3. 重新啟動開發伺服器
4. 如果是 Cloudflare Pages，確認環境變數已在設定中正確添加

### 新增道具時卡在「建立中...」

這通常表示 Firebase 配置有問題：
1. 打開瀏覽器開發者工具（F12）
2. 查看 Console 分頁的錯誤訊息
3. 確認所有 Firebase 環境變數都已正確設定
4. 確認 Firestore 和 Storage 都已在 Firebase Console 中啟用

### 圖片顯示破圖

如果看到破圖，系統會自動顯示預設的 `no-image.svg`。確認：
1. 圖片檔案格式正確（PNG, JPG, WebP 等）
2. Firebase Storage 已正確配置
3. Storage 安全規則允許讀取

## 安全規則建議

### Firestore 規則

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /items/{itemId} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

### Storage 規則

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /item-images/{imageId} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

## 相關文件

- [Firebase 文件](https://firebase.google.com/docs)
- [Next.js 環境變數](https://nextjs.org/docs/app/building-your-application/configuring/environment-variables)
- [Cloudflare Pages 環境變數](https://developers.cloudflare.com/pages/configuration/build-configuration/)
