# 專案規格書：Gangs Online  
## 模組化角色系統 (Modular Character System)

## 1. 系統概述 (System Overview)

本專案旨在為 MMORPG《Gangs Online》建立一個基於 Web 的 3D 角色客製化系統。  
此系統將同時用於：

- 後台 NPC 製作 Dashboard
- 前台玩家創角介面

核心目標是利用 **Babylon.js** 實現高效能、低多邊形（Low Poly）的紙娃娃換裝功能，  
並將角色設定數據儲存於 **Firebase**。

---

## 2. 功能需求 (Functional Requirements)

### 2.1 3D 渲染與展示

#### 素體 (Base Body)

- 支援男性與女性兩種基礎模型
- Low Poly 風格（面數 < 3000），已經 Decimate 優化
- 必須包含完整骨架（Skeleton）與權重（Rigging）

#### 場景環境 (Scene)

- 簡單攝影棚燈光，確保模型無死角
- 攝影機可圍繞角色旋轉（ArcRotateCamera），方便預覽背面

---

### 2.2 換裝機制 (Equipment System)

#### 部位拆分

系統需支援以下部位的獨立更換：

- 髮型（Hair）：獨立 Mesh
- 上衣（Top）：獨立 Mesh（如 T-shirt、夾克）
- 下身（Bottom）：獨立 Mesh（如 牛仔褲、短褲）
- 鞋子（Shoes）：獨立 Mesh

#### 骨架綁定 (Skeleton Linking)

- 所有穿戴裝備必須綁定至素體的主骨架
- 素體播放動畫（Idle、Walk）時：
  - 衣服需同步運動
  - 不可穿模或脫落

---

### 2.3 客製化調整 (Customization)

#### 顏色變更

- 髮型需支援 RGB 顏色即時修改
  - 透過 Material 的 Albedo Color
- 其他部位預設使用貼圖
  - 保留未來換色的擴充彈性

---

### 2.4 資料持久化 (Data Persistence)

#### 輸出 (Output)

- 生成角色外觀設定的 JSON 物件
- 包含：
  - 各部位 ID
  - 顏色參數

#### 輸入 (Input)

- 可讀取 JSON
- 自動還原角色外觀

---

## 3. 開發路徑圖  
### (Development Roadmap for Claude Code)

請 AI **依 Phase 順序開發**，每個 Phase 完成並測試無誤後才進入下一階段。

---

### Phase 1：基礎場景與素體載入 (The Foundation)

**目標**  
在 Next.js 頁面建立 Babylon.js 畫布，並載入靜態男性素體。

**工序**

- 初始化 Babylon.js Engine 與 Scene
- 加入 HemisphericLight 與 Camera
- 使用 SceneLoader 載入 `male_body.glb`

**驗收標準**

- 網頁顯示男性模型
- 滑鼠可旋轉觀看

**資料夾及檔案位置**

- 所有3D model相關檔案都放在/packages/shared/characters/
- 素體: /packages/shared/characters/body/
- 髮型和鬍子: /packages/shared/characters/hair/
- 貼圖: /packages/shared/characters/texture/

---

### Phase 2：資產容器與動態加載 (Asset Management)

**目標**  
建立資產管理器，預載並切換髮型與服裝。

**工序**

- 使用 AssetContainer 載入所有 `.glb`（身體、頭髮、衣服）
- 實作 `equipItem(category, itemId)`
- 切換時移除舊 Mesh，實例化新 Mesh

**驗收標準**

- 點擊測試按鈕
- 頭髮可在「光頭」與「髮型 A」間切換

---

### Phase 3：骨架同步與動畫 (Animation Sync)

**目標**  
確保穿戴裝備隨角色動畫移動。

**工序**

- 載入動畫（如 `idle.glb`）
- 在 `equipItem` 中將新 Mesh 的 skeleton 指向素體 skeleton

**驗收標準**

- 角色播放待機動畫
- 衣服貼合移動，無分離

---

### Phase 4：顏色更換系統 (Color Customization)

**目標**  
支援髮色即時變更。

**工序**

- 取得髮型 Mesh 的 Material
- 實作 `changeColor(mesh, hexColor)`

**驗收標準**

- 使用顏色選擇器
- 髮色即時改變

---

### Phase 5：UI 整合與資料串接 (UI & Data)

**目標**  
完成 UI 與 Firebase 整合。

**工序**

- 建立側欄 UI（Tabs：髮型 / 上衣 / 褲子）
- 實作：
  - `getCharacterConfig()`
  - `loadCharacterConfig(json)`
- 整合 Firebase Firestore 的存取功能

**驗收標準**

- 調整角色後重新整理
- 角色外觀自動恢復