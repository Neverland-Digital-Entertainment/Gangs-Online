# Firebase 測試用 Dummy Item

## 測試道具資料

請將以下 JSON 資料手動新增到 Firebase Firestore，測試讀取功能是否正常。

---

## 步驟 1：複製以下 JSON 資料

```json
{
  "name": "測試燒賣",
  "description": "這是手動新增的測試道具，用於驗證 Firebase 讀取功能",
  "category": "consumable",
  "imageUrl": "/images/no-image.png",
  "price": 50,
  "sellPrice": 25,
  "isTradeable": true,
  "isDroppable": true,
  "isActive": true,
  "attributes": {
    "hpRestore": 30,
    "vpRestore": 0,
    "cooldown": 2
  }
}
```

**⚠️ 重要**：不要複製 `createdAt` 和 `updatedAt` 欄位，Firebase Console 會自動處理時間戳記。

---

## 步驟 2：前往 Firebase Console 新增資料

1. **開啟 Firebase Console**
   前往：https://console.firebase.google.com/

2. **選擇您的專案**
   點擊您的 Gangs Online 專案

3. **進入 Firestore Database**
   - 點擊左側選單的 "Firestore Database"
   - 如果還沒建立資料庫，點擊 "建立資料庫"
   - 選擇 "以測試模式啟動"（暫時允許讀寫）
   - 選擇資料庫位置（建議選擇最接近您的地區）

4. **建立 Collection**（如果還沒有）
   - 點擊 "開始收集"
   - 收集 ID 輸入：`items`
   - 點擊 "下一步"

5. **新增文件**
   - 文件 ID：留空（讓 Firebase 自動生成）或輸入 `test-item-001`
   - 點擊 "新增欄位" 按鈕，逐一新增以下欄位：

### 欄位設定

| 欄位名稱 | 類型 | 值 |
|---------|------|-----|
| `name` | string | `測試燒賣` |
| `description` | string | `這是手動新增的測試道具，用於驗證 Firebase 讀取功能` |
| `category` | string | `consumable` |
| `imageUrl` | string | `/images/no-image.png` |
| `price` | number | `50` |
| `sellPrice` | number | `25` |
| `isTradeable` | boolean | `true` |
| `isDroppable` | boolean | `true` |
| `isActive` | boolean | `true` |
| `createdAt` | timestamp | *點擊時鐘圖示，選擇當前時間* |
| `updatedAt` | timestamp | *點擊時鐘圖示，選擇當前時間* |

### 新增 attributes 子物件

1. 新增欄位 `attributes`，類型選擇 `map`
2. 在 `attributes` 內新增以下子欄位：

| 欄位名稱 | 類型 | 值 |
|---------|------|-----|
| `hpRestore` | number | `30` |
| `vpRestore` | number | `0` |
| `cooldown` | number | `2` |

6. **儲存文件**
   點擊 "儲存" 按鈕

---

## 步驟 3：在 Dashboard 驗證讀取功能

1. **開啟 Dashboard**
   前往：`您的網址/item/`

2. **檢查是否顯示測試道具**
   - 如果能看到 "測試燒賣"，表示 **讀取功能正常** ✅
   - 如果看不到，請檢查 Firebase 安全規則

---

## 步驟 4：檢查 Firebase 安全規則

如果無法讀取，可能是安全規則阻擋。請到 Firebase Console：

1. 點擊 "Firestore Database" → "規則" 標籤
2. 暫時設定為以下規則（僅測試用）：

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

3. 點擊 "發布"

**⚠️ 警告**：這個規則允許任何人讀寫您的資料庫，僅供測試使用。正式環境請設定適當的安全規則。

---

## 預期結果

### ✅ 如果讀取成功

表示：
- Firebase 連接正常
- 環境變數配置正確
- 安全規則設定正確
- **問題確實出在瀏覽器擴充功能阻擋寫入請求**

**解決方案**：使用無痕模式即可新增道具

### ❌ 如果讀取失敗

可能原因：
1. Firebase 安全規則阻擋讀取
2. 環境變數設定錯誤
3. Collection 名稱不是 `items`

請檢查瀏覽器 Console 的錯誤訊息。

---

## 更多測試資料（可選）

### 消耗品 (Consumable)
```json
{
  "name": "生命藥水",
  "description": "恢復 50 HP",
  "category": "consumable",
  "imageUrl": "/images/no-image.png",
  "price": 100,
  "sellPrice": 50,
  "isTradeable": true,
  "isDroppable": true,
  "isActive": true,
  "attributes": {
    "hpRestore": 50,
    "vpRestore": 0,
    "cooldown": 3
  }
}
```

### 特殊道具 (Special)
```json
{
  "name": "信仰符咒",
  "description": "需要消耗信仰值使用",
  "category": "special",
  "imageUrl": "/images/no-image.png",
  "price": 500,
  "sellPrice": 250,
  "isTradeable": false,
  "isDroppable": false,
  "isActive": true,
  "attributes": {
    "faithCost": 10,
    "deityId": "deity-001"
  }
}
```

### 違禁品 (Contraband)
```json
{
  "name": "走私香菸",
  "description": "高犯罪值的違禁品",
  "category": "contraband",
  "imageUrl": "/images/no-image.png",
  "price": 200,
  "sellPrice": 100,
  "isTradeable": true,
  "isDroppable": true,
  "isActive": true,
  "attributes": {
    "crimeValue": 50,
    "policeDetectionMultiplier": 1.5
  }
}
```

### 材料 (Material)
```json
{
  "name": "鐵礦石",
  "description": "可堆疊的材料",
  "category": "material",
  "imageUrl": "/images/no-image.png",
  "price": 20,
  "sellPrice": 10,
  "isTradeable": true,
  "isDroppable": true,
  "isActive": true,
  "attributes": {
    "stackLimit": 999
  }
}
```

---

## 快速新增方法（使用 Firebase CLI）

如果您熟悉命令列，可以使用以下腳本快速新增：

```javascript
// 在瀏覽器 Console 執行（需先載入 Firebase）
const { getFirestore, collection, addDoc, Timestamp } = await import('https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js');

const testItem = {
  name: "測試燒賣",
  description: "這是手動新增的測試道具，用於驗證 Firebase 讀取功能",
  category: "consumable",
  imageUrl: "/images/no-image.png",
  price: 50,
  sellPrice: 25,
  isTradeable: true,
  isDroppable: true,
  isActive: true,
  attributes: {
    hpRestore: 30,
    vpRestore: 0,
    cooldown: 2
  },
  createdAt: Timestamp.now(),
  updatedAt: Timestamp.now()
};

const db = getFirestore();
const docRef = await addDoc(collection(db, 'items'), testItem);
console.log('✨ 道具已新增，ID:', docRef.id);
```

**⚠️ 注意**：這個方法仍然會被瀏覽器擴充功能阻擋，建議使用 Firebase Console 手動新增。
