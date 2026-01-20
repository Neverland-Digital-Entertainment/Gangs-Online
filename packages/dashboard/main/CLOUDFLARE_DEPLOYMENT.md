# Cloudflare Pages 部署指南

## 📋 部署到 Cloudflare Pages

### 1. 連接 Git 儲存庫

1. 登入 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 進入 **Pages**
3. 點擊 **Create a project**
4. 連接您的 GitHub 儲存庫：`Neverland-Digital-Entertainment/Gangs-Online`

### 2. 建置設定

在 Cloudflare Pages 專案設定中：

#### Build Configuration
```
Framework preset: Next.js
Build command: cd packages/dashboard/main && npm install && npm run build
Build output directory: packages/dashboard/main/out
Root directory: (leave empty)
```

#### Environment Variables
添加以下環境變數：

```
NEXT_PUBLIC_FIREBASE_API_KEY=your_actual_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

### 3. 部署

1. 點擊 **Save and Deploy**
2. Cloudflare 將自動：
   - 克隆儲存庫
   - 執行建置命令
   - 部署靜態文件

### 4. 訪問您的 Dashboard

部署完成後，Dashboard 將可通過以下 URL 訪問：

```
https://your-project.pages.dev/dashboard/          # 主頁
https://your-project.pages.dev/dashboard/item/     # 道具管理
```

### 5. 自定義域名（可選）

在 Cloudflare Pages 專案設定中：
1. 進入 **Custom domains**
2. 添加您的域名
3. 設定 DNS 記錄

訪問：
```
https://dashboard.your-domain.com/dashboard/
```

## 🔄 自動部署

每次推送到 main 分支時，Cloudflare Pages 會自動：
1. 拉取最新代碼
2. 執行建置
3. 部署新版本

## 📝 注意事項

### BasePath
應用使用 `/dashboard` 作為 basePath，所有路由都會自動包含此前綴。

### 靜態導出
應用配置為靜態導出（`output: 'export'`），完全兼容 Cloudflare Pages。

### Firebase 配置
確保在 Cloudflare Pages 環境變數中正確設定所有 Firebase 配置。

### 圖片優化
圖片優化已禁用（`images.unoptimized: true`），以支持靜態導出。

## 🐛 疑難排解

### 建置失敗

如果建置失敗，檢查：
1. Build command 路徑是否正確
2. 環境變數是否已設定
3. Node.js 版本（Cloudflare 使用 Node 18+）

### 404 錯誤

如果訪問頁面出現 404：
1. 確認 basePath 設定為 `/dashboard`
2. 檢查 URL 是否包含 `/dashboard` 前綴
3. 確認靜態文件已正確生成

### Firebase 連線錯誤

如果 Firebase 無法連線：
1. 檢查環境變數是否正確
2. 確認 Firebase 專案設定
3. 檢查 Firebase 規則是否允許訪問

## 📊 效能優化

Cloudflare Pages 自動提供：
- 全球 CDN 分發
- 自動 HTTPS
- HTTP/3 支援
- Brotli 壓縮

## 🔐 安全性

建議設定：
1. 啟用 Cloudflare Access（限制管理員訪問）
2. 設定 Firebase 安全規則
3. 使用環境變數保護敏感資訊

## 📈 監控

在 Cloudflare Dashboard 中可以查看：
- 部署歷史
- 流量統計
- 錯誤日誌
- 效能指標
