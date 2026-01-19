# 疑難排解指南

## 新增道具時卡在「建立中...」

### 問題 1: ERR_BLOCKED_BY_CLIENT 錯誤

**錯誤訊息：**
```
POST https://firestore.googleapis.com/... net::ERR_BLOCKED_BY_CLIENT
```

**原因：**
這個錯誤表示瀏覽器或瀏覽器擴充功能阻擋了對 Firebase 的請求。

**解決方法：**

1. **停用廣告攔截器**
   - uBlock Origin
   - AdBlock Plus
   - AdGuard
   - Privacy Badger
   - 任何其他內容攔截擴充功能

   步驟：
   - 點擊瀏覽器工具列上的擴充功能圖示
   - 找到廣告攔截器
   - 對當前網站停用或加入白名單

2. **停用隱私保護擴充功能**
   - DuckDuckGo Privacy Essentials
   - Ghostery
   - Privacy Badger
   - 等等

3. **檢查瀏覽器內建的追蹤保護**
   - **Chrome**: 設定 → 隱私權和安全性 → Cookie 和其他網站資料
   - **Firefox**: 設定 → 隱私權與安全性 → 增強型追蹤保護
   - **Edge**: 設定 → 隱私權、搜尋與服務 → 追蹤防止

4. **使用無痕模式測試**
   - 開啟無痕/私密瀏覽視窗（通常不會載入擴充功能）
   - 如果無痕模式可以正常使用，表示是擴充功能的問題

5. **暫時停用所有擴充功能**
   - Chrome: 設定 → 擴充功能 → 停用所有
   - Firefox: 附加元件 → 擴充套件 → 停用所有
   - 測試後逐一重新啟用，找出有問題的擴充功能

### 問題 2: Firebase 配置不完整

**錯誤訊息：**
```
❌ Firebase 配置錯誤：缺少以下環境變數：
   - NEXT_PUBLIC_FIREBASE_API_KEY
   ...
```

**解決方法：**
請參考 [FIREBASE_SETUP.md](./FIREBASE_SETUP.md) 的完整設定指南。

### 問題 3: Firebase 權限錯誤

**錯誤訊息：**
```
Firebase 權限不足。請檢查 Firestore 安全規則。
```

**解決方法：**

1. 前往 [Firebase Console](https://console.firebase.google.com/)
2. 選擇您的專案
3. 進入「Firestore Database」→「規則」
4. 暫時使用測試模式規則（僅供開發）：

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

**⚠️ 警告：** 這個規則允許所有人讀寫您的資料庫，僅供開發測試使用。上線前請設定適當的安全規則。

推薦的生產環境規則：

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

### 問題 4: 網路連線問題

**錯誤訊息：**
```
Firebase 服務暫時無法使用。請稍後再試。
```

**解決方法：**

1. 檢查網路連線
2. 檢查 Firebase 服務狀態：https://status.firebase.google.com/
3. 檢查防火牆設定是否阻擋 Firebase 網域
4. 嘗試使用不同的網路（例如手機熱點）

## 圖片破圖問題

如果道具圖片顯示為破圖，系統會自動顯示預設的 `no-image.png`。

**可能原因：**
1. 圖片 URL 無效
2. Firebase Storage 未正確配置
3. Storage 安全規則阻擋存取
4. 圖片檔案已被刪除

**解決方法：**

1. **檢查 Storage 安全規則**

   前往 Firebase Console → Storage → 規則：

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

2. **重新上傳圖片**
   - 編輯道具
   - 重新選擇圖片檔案
   - 儲存

## 除錯技巧

### 1. 開啟瀏覽器開發者工具

- **Windows/Linux**: `F12` 或 `Ctrl + Shift + I`
- **Mac**: `Cmd + Option + I`

### 2. 查看 Console 分頁

檢查是否有以下訊息：

✅ 成功訊息：
```
✅ Firebase 已成功初始化
🚀 開始新增道具...
✅ 道具新增成功！
```

❌ 錯誤訊息：
```
❌ Firebase 配置錯誤：...
❌ 新增道具失敗：...
```

### 3. 查看 Network 分頁

1. 切換到「Network」分頁
2. 勾選「Preserve log」
3. 嘗試新增道具
4. 查看失敗的請求（紅色）
5. 點擊失敗的請求查看詳細資訊

### 4. 常見的 Network 錯誤

| 錯誤代碼 | 說明 | 解決方法 |
|---------|------|---------|
| ERR_BLOCKED_BY_CLIENT | 被瀏覽器/擴充功能阻擋 | 停用廣告攔截器 |
| 403 Forbidden | 權限不足 | 檢查 Firebase 安全規則 |
| 404 Not Found | 資源不存在 | 檢查 URL 和配置 |
| 500 Internal Error | 伺服器錯誤 | 檢查 Firebase 服務狀態 |
| CORS Error | 跨域請求錯誤 | 檢查 Firebase 配置 |

## 聯絡支援

如果以上方法都無法解決您的問題，請提供以下資訊：

1. 完整的錯誤訊息（從瀏覽器 Console）
2. 瀏覽器版本和作業系統
3. 已嘗試的解決方法
4. 螢幕截圖（如果可能）

將這些資訊回報給開發團隊。
