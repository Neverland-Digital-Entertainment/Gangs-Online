開發需求說明書：Gangs Online 後台管理系統 - 道具模組 (Item Module)
1. 專案背景
本模組為《Gangs Online》（古惑仔 Online）後台管理程式的核心組件。主要目的在於管理遊戲中所有的動態道具數據，並為後續的「商店系統」提供基礎資料。開發環境基於 Firebase (Firestore, Cloud Storage)。
2. 核心目標
建立一個直觀的界面，允許開發人員或 GM（遊戲管理員）對遊戲內的所有道具進行 CRUD（增刪查改） 操作。
3. 道具分類與業務邏輯
道具必須支援以下分類，且不同分類具有特定的欄位需求：
A. 消耗品 (Consumables)
用途： 恢復角色狀態。
核心欄位： HP 恢復值、VP（精力值）恢復值、使用冷卻時間。
範例： 火雞、南瓜派。
B. 宗教/特殊道具 (Special Items)
用途： 用於神打系統或特殊任務。
核心欄位： 信仰消耗量、對應的神祇 ID。
範例： 香、聖水。
C. 非法物資 (Contraband)
用途： 走私與黑市貿易。
核心欄位： 罪惡值（攜帶時增加）、警察查獲機率倍率。
範例： 走私菸酒、違禁品。
D. 素材 (Materials)
用途： 烹飪、製藥或縫紉系統。
核心欄位： 堆疊上限。
4. 功能需求描述
4.1 道具列表頁面 (Item Library)
搜尋與過濾： 支援透過名稱、道具 ID 或「類別」進行篩選。
表格視圖： 顯示道具縮圖、名稱、基本價格 (price) 以及當前庫存/狀態。
快速操作： 提供「複製現有道具」的功能，以便快速建立相似物品。
4.2 道具編輯器 (Item Editor)
編輯介面需分為三個區塊：
基本資訊： 道具名稱、唯一 ID（自動生成或手動指定）、圖示上傳（至 Firebase Storage）、道具說明文案（支援多行文字）、狀態(設定道具是否是否可以在遊戲中出現)。
經濟屬性： 買入價格 (price)、賣出價格 (price)、是否可交易、是否可丟棄。
動態屬性 (JSON 結構預留)： 根據道具分類顯示對應的數值設定（如恢復量、Buff 持續時間等）。
4.3 圖片資產管理
上傳道具圖示時，需自動關聯至 Firebase Storage，並將 URL 儲存於 Firestore 的對應文件內。
上傳前需提示建議尺寸（例如 64x64 或 128x128）。
沒有圖像資料時用/packages/client/public/images/no-image.png代替
5. 技術約束與資料結構建議 (由 Claude Code 自行實現)
資料庫： 使用 Firestore 作為 NoSQL 存儲。請思考如何設計 items 集合，以兼顧查詢效率與欄位的擴充性。
狀態管理： 確保 UI 能即時反映資料庫的變更（如使用 Real-time listeners）。
校驗邏輯： 數值欄位（如價格、恢復量）必須為正整數，避免負數導致遊戲漏洞。
6. 後續擴展預留 (Future Proofing)
商店關聯： 每個道具未來需能被分配到一個或多個「商店 NPC」的清單中。
掉落表關聯： 道具 ID 將被用於設定 NPC 的死亡掉落率。

給 Claude Code 的開發建議流程：
Schema 設計： 請先建立 Firestore 的 items 集合文件結構。
UI 框架： 使用  /packages/dashboard/metronic/中的模板建立 Dashboard。
Firebase 整合： 實作 Firebase Auth 安全驗證（確保只有管理員能修改數據）及 Firestore CRUD。
模組化： 將編輯器的欄位組件化，以便未來裝備模組 (Equipment) 可以復用。
開發資料夾：在/packages/dashboard/中進行開發並把相關檔案儲存在這裡

