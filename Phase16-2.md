開發需求說明書：Gangs Online 後台管理系統 - NPC 模組 (Final Spec)
1. 專案背景
本模組用於管理《Gangs Online》的 NPC 數據。為了平衡「全域數值調整」與「個別地圖配置」的靈活性，系統採用 「模板 (Template)」與「實例 (Instance)」 分離的資料架構。

2. 資料架構設計 (Firestore)
2.1 npc_templates (定義表)
儲存靜態、通用的 NPC 資訊，由內容企劃（或實習生）維護。

基本欄位：name, type (citizen/police/gangs/shop/quest), modelId, dialogueTree (對話樹結構)。

能力數值：基礎 HP、攻擊力、防禦力等（用於等級公式計算）。

2.2 npcs (實例表 / 現有 Collection)
儲存實際放置在地圖上的 NPC 實體。

連結：templateId (指向模板)。

動態欄位：position (x, z), rotation, level, interactionRadius。

行為欄位：movementPattern (Static/Wandering/Patrolling), aggroRange, chaseDistance。

特殊邏輯：

警察/爛仔：設定等級以套用能力值公式。

商店：shopId (關聯至商店配置)。

任務：isAttackable (開關)。

地盤歸屬：此處不儲存 ownerId。NPC 的歸屬由 地盤資料 (Territory Data) 中的 npcList 紀錄該 NPC 的 ID。

3. NPC 類型與行為定義
平民 (Citizen)：點擊觸發對話。

警察 (Police)：

自動偵測半徑內的「紅名」玩家並主動攻擊。

支援「近戰 (Melee)」或「遠攻 (Ranged)」。

爛仔 (Gangs)：

練功用 NPC 或地盤僱傭兵。

透過地盤系統 (Territory System) 進行管理與聘請。

商店 (Shop)：

不可攻擊，點擊開啟交易界面（連接臨時 shops_temp 集合）。

任務 (Quest)：

透過後台勾選決定當前狀態下是否可被玩家攻擊。

4. 功能需求 (UI/UX)
4.1 視覺化對話編輯器 (GUI Dialogue Editor)
為了讓非技術人員（如實習生）操作，必須提供圖形化界面：

卡片式設計：每段對話為一個卡片，可設定說話者名稱及內容。

分支連結：可新增選項按鈕，並以線條或 ID 連結至下一張對話卡片。

觸發預留：可在對話結束處設定「開啟商店」或「接受任務」的 Hook。

4.2 AI 與戰鬥設定
行動模式 (Movement)：

Wandering：設定中心點與隨機移動半徑。

Patrolling：編輯多個 Waypoints 座標點。

仇恨邏輯 (Aggro)：設定「偵測範圍」與「追擊距離」。

4.3 地圖座標同步方案
技術路徑：Client Side (Babylon.js) 生成地圖的頂視角截圖 (Top-down Screenshot) 與 Metadata 上傳至 Firebase。

後台顯示：管理程式讀取該截圖作為底圖，讓使用者在地圖上點擊位置，直接取得最新的 (X, Z) 座標，無需手動輸入。

5. 開發導引 (給 Claude Code)
實作對話編輯器：這是首要任務，確保資料能轉化為 JSON 並存入 npc_templates。

建立實例配置界面：讓使用者選擇模板後，在地圖底圖上放置 NPC 並設定行為模式。

數值連結：當使用者在 UI 設定 Level 時，即時顯示從公式計算出的能力值預覽。
