# Gangs Online - 雲端部署指南 ☁️

本指南將幫你把遊戲部署到雲端，讓你可以隨時隨地在線測試！

## 🎯 快速開始

### 方案 A：使用 Render + Vercel（推薦，完全免費）

這個方案使用：
- **Render.com** - 部署遊戲伺服器（支援 WebSocket）
- **Vercel** - 部署遊戲客戶端

---

## 📦 步驟 1：準備代碼

### 1.1 更新客戶端使用環境變量

編輯 `packages/client/src/main.ts`：

```typescript
// --- Configuration ---
const SERVER_URL = import.meta.env.VITE_SERVER_URL || "ws://localhost:2567";
```

### 1.2 創建環境變量配置文件

在 `packages/client/` 創建 `.env.production`：

```env
VITE_SERVER_URL=wss://your-server-name.onrender.com
```

---

## 🚀 步驟 2：部署伺服器到 Render.com

### 2.1 註冊 Render 帳號
1. 訪問 https://render.com
2. 使用 GitHub 帳號登錄

### 2.2 創建新的 Web Service
1. 點擊 "New +" → "Web Service"
2. 連接你的 GitHub 倉庫：`Neverland-Digital-Entertainment/Gangs-Online`
3. 配置如下：

**基本設置**
- **Name**: `gangs-online` （可自定義）
- **Region**: Singapore（新加坡，速度較快）
- **Branch**: `claude/phase-5-development-0132L6eh8SDDuwTumKtBtwBi`
- **Root Directory**: 留空（使用項目根目錄）
- **Runtime**: Node
- **Build Command**: `npm install && npm run build --workspace=@gangs-online/shared`
- **Start Command**: `cd packages/server && npm start`

**環境變量**
- `NODE_ENV` = `production`
- `PORT` = `2567`

### 2.3 部署
1. 點擊 "Create Web Service"
2. 等待構建完成（約 3-5 分鐘）
3. 記下你的伺服器 URL：`https://gangs-online.onrender.com`

**⚠️ 重要**：Render 免費方案會在 15 分鐘無活動後休眠。首次訪問會慢一些（約 30 秒喚醒）。

---

## 🌐 步驟 3：部署客戶端到 Vercel

### 3.1 註冊 Vercel 帳號
1. 訪問 https://vercel.com
2. 使用 GitHub 帳號登錄

### 3.2 導入項目
1. 點擊 "Add New..." → "Project"
2. 選擇 `Gangs-Online` 倉庫
3. 配置如下：

**項目設置**
- **Framework Preset**: Vite
- **Root Directory**: `packages/client`
- **Build Command**: `npm run build`
- **Output Directory**: `dist`

**環境變量**
- `VITE_SERVER_URL` = `wss://gangs-online-server.onrender.com`

### 3.3 部署
1. 點擊 "Deploy"
2. 等待構建完成（約 1-2 分鐘）
3. 你會得到一個 URL：`https://gangs-online.vercel.app`

---

## ✅ 步驟 4：測試部署

1. 訪問你的 Vercel URL：`https://gangs-online.vercel.app`
2. 等待約 30 秒（如果伺服器在休眠）
3. 打開瀏覽器控制台，檢查是否成功連接到伺服器
4. 你應該能看到你的角色和聊天系統！

### 測試清單
- [ ] 頁面正常加載
- [ ] 能看到 3D 場景
- [ ] 角色正常顯示並持有武器
- [ ] 可以移動角色
- [ ] 聊天功能正常
- [ ] 多個設備可以同時連接

---

## 📱 從手機訪問

現在你可以從任何設備訪問：
- **電腦**: 直接打開 Vercel URL
- **手機**: 掃描 QR 碼或輸入 URL
- **平板**: 同樣使用 Vercel URL

---

## 🐛 故障排除

### 問題：無法連接到伺服器
**解決方案**：
1. 檢查 Render 伺服器是否在運行（訪問 Render Dashboard）
2. 確認環境變量 `VITE_SERVER_URL` 正確設置
3. 檢查瀏覽器控制台的錯誤消息

### 問題：伺服器啟動很慢
**原因**：Render 免費方案會休眠
**解決方案**：等待 30-60 秒讓伺服器喚醒

### 問題：WebSocket 連接失敗
**檢查**：
1. 確保使用 `wss://`（不是 `ws://`）
2. 確認 Render 伺服器日誌沒有錯誤
3. 嘗試重新部署

---

## 💰 成本

這個部署方案**完全免費**！

**Render 免費方案**：
- ✅ 750 小時/月
- ✅ WebSocket 支援
- ⚠️ 15 分鐘無活動後休眠

**Vercel 免費方案**：
- ✅ 無限部署
- ✅ 自動 HTTPS
- ✅ 全球 CDN

---

## 🔄 自動部署

一旦設置完成：
1. 推送代碼到 GitHub
2. Vercel 和 Render 會自動重新部署
3. 約 2-5 分鐘後即可看到更新

---

## 📞 需要幫助？

如果遇到問題：
1. 檢查 Render 和 Vercel 的構建日誌
2. 查看瀏覽器控制台錯誤
3. 確認所有環境變量正確設置

祝你部署順利！🎮
# Force rebuild Mon Dec 29 14:09:41 UTC 2025
