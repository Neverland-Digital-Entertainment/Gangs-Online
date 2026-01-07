Phase 14 開發規格書：兵賊對立與紅名系統 (Roles & Wanted System)
1. 核心目標
建立 NPC 的持久化數據管理架構，實作基於「罪惡值 (Evil Value)」的紅名機制，以及對應的警察執法與監獄重生邏輯。
2. Firebase NPC 數據庫 (Collection: npcs)
在 Firebase 根目錄建立 npcs 集合，存儲所有非玩家單位的靜態與動態屬性。
基礎數值：
id: 唯一識別碼。
type: 類型（citizen, police, gangs, shop, quest）。
name: 顯示名稱。
hp: 生命值。
attack: 攻擊力。
物品掉落 (lootTable)：
陣列格式，包含 itemId、dropRate (例如 0.05 代表 5%)。
互動設定：
dialogue: 點擊後的對話內容（僅限 citizen, shop）。
relatedQuests: 關聯的任務 ID。
外觀表現：
若無指定特定的 GLTF 路徑，預設直接套用 Babylon.js 的預設幾何模型或內建模型作為預留位置。
3. 角色職能與 AI 行為邏輯 (Colyseus 實作)
市民 (Citizen)：
行為：中立、不具備攻擊性。
被攻擊行為：不還手，僅觸發玩家的罪惡值增加。
警察 (Police)：
行為：巡邏或駐守。
掃描邏輯：定時掃描範圍內玩家的 Evil Value 狀態。
戰鬥觸發：僅針對「紅名」玩家（Evil Value > 0）主動發動攻擊。
古惑仔 (Gangs)：
行為：維持主動攻擊機制，對進入感應範圍的所有玩家發動攻擊。
4. 紅名與罪惡值系統 (PK System)
罪惡值計算：
觸發條件：攻擊無辜玩家或「市民 NPC」時。
數值變動：Evil Value +1（Max:3）。
視覺表現 (Frontend)：
玩家名稱顏色：當玩家數據中的 Evil Value > 0 時，其名稱標籤強制顯示為紅色。
UI 狀態欄：左上角 Status 區域本來「紅色圓形圖示」。
預設：hidden。
狀態：當玩家為紅名時切換為 visible。
死亡懲罰：
紅名玩家死亡時，玩家身上道具隨機掉落物品。
5. 監獄系統 (Prison System)
獨立場景設計：
建立一個名為 Prison 的極小範圍場景或隔離區。
限制：玩家在此場景內僅能局部移動，無法執行任何傳送或切換場景指令。
傳送機制：
若玩家在紅名狀態下被警察 NPC 擊倒，伺服器強制將其重生座標設定在「監獄」場景。
釋放邏輯：
玩家需在監獄中停留 30 秒。
倒數結束後：
自動重置玩家的 Evil Value 為 0。
隱藏左上角紅名圖示。
將玩家傳送回主場景（例如：銅鑼灣重生點）。
6. 技術細節建議
同步：Evil Value 需由 Colyseus Server 計算並即時寫回 Firebase，確保數據持久化。
檢測：警察 NPC 的目標選定邏輯應放在伺服器端循環中，避免客戶端作弊。
7. 版本更新
Client: 0.14.0
Server: 0.14.0
Shared: 0.14.0

