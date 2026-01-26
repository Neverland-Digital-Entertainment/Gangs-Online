開發需求說明書：Gangs Online - 商店與經濟系統 (Phase 16.3)
1. 專案背景與版本
所有版本號更新： 0.16.3

目標： 建立商店配置系統，連結道具（Items）與 NPC，並實作時間限制與購買限制邏輯。

2. 道具分類規範 (Item Categories)
檢查所有道具必須歸類為以下四種之一，這將影響商店的顯示過濾：

- 消耗品 (Consumables)： 食物、藥品。
- 非法物品(Contraband)更改為裝備 (Equipment)： 武器、衣服。
- 特殊物品 (Special Items)： 提供 Buff/Debuff 的道具（如神打相關）。
- 素材 (Materials)： 用於升級或合成裝備。

3. 商店配置資料架構 (Firestore: shops)
商店不再只是道具清單，而是一個包含邏輯的配置文件。

3.1 核心欄位
shopId: 唯一識別碼。

operatingHours: { start: 0-23, end: 0-23 }（支援跨夜設定，如 22:00 - 04:00）。

itemList: 陣列物件，包含：

itemId: 連結至道具。

globalStock: 該商店的總庫存（若為 -1 則無限，預設-1）。

personalLimit: 每位玩家限購件數（若為 0 則不限）。

3.2 買賣邏輯
買價 (Buying Price)：直接讀取 items 集合中的 price。

回收 (Buyback)：玩家出售道具後，該道具 直接消失，不進入商店庫存。

4. NPC 整合邏輯 (NPC Instance)
在 npcs 實例中增加以下設定：

linkedShopId: 選擇此 NPC 營運哪家商店。

isGuildOnly (Boolean)：

若為 true，僅有社團成員可開啟。

在後台設置社團領地時，才能增加此類 NPC。

5. 限制邏輯建議 (Logic Specs)
5.1 限量商品放在哪裡？ (Limited Stock)
建議：放在 shops 集合中。

原因： 如果放在 items，全伺服器所有商店會共用同一個庫存（這屬於「世界唯一」道具）。如果放在 shops，你可以設定「廟街商店」只有 10 個，而「銅鑼灣商店」有 50 個。

5.2 每人限買件數 (Personal Limit)
實作方式： 當玩家購買限購商品時，需在玩家資料 (User Profile) 下的 purchaseHistory 紀錄 shopId_itemId 與數量。

重置邏輯： 你可以考慮是否需要「每日重置」或是「永久限購」。

6. 功能清單 (To-do for Claude Code)

商店編輯器：
- 從 items 列表選擇道具並加入商店。
- 為每個商店道具設定 globalStock 與 personalLimit。
- 設定 24 小時制的營業時間撥盤。

NPC 連結界面：
- 在 NPC 編輯器加入 isGuildOnly 開關。
- 下拉選單關聯 shopId。

資料驗證：
檢查營業時間邏輯（例如當 start > end 時，代表跨夜營運），沒有設定時間時預設24小時永久營業。
