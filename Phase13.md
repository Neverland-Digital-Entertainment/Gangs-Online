Phase 13 開發規範：幫會系統與聊天架構遷移
此文件定義了 Phase 13 的核心功能開發需求，專供 Claude Code 作為實作指南。
1. 核心目標
幫會系統 (Guild System)：建立基礎幫會框架。
架構遷移：使用 Colyseus (實時廣播) + Firebase (資料持久化) 模式。
2. 幫會系統 (Guild System)
2.1 職位架構
目前僅實作兩層職位：
龍頭 (Leader/Dragon Head)：創辦者，擁有最高管理權限。
成員 (Member)：一般加入的玩家。
備註：未來將擴展「副幫主」、「堂主」等職位，請在設計 Enum 或資料結構時保留擴充性。
2.2 Firestore 資料結構 (Firebase)
所有幫會數據存放在 /artifacts/{appId}/public/data/guilds。
Document: guilds/{guildId}
{
  "name": "幫會名稱",
  "leaderId": "龍頭的UserId",
  "createdAt": "Timestamp",
  "memberCount": 1,
  "description": "幫會簡介",
  "members": {
    "userId_1": { "role": "龍頭", "joinTime": "Timestamp" },
    "userId_2": { "role": "成員", "joinTime": "Timestamp" }
  }
}


Document: users/{userId} (更新)
{
  "guildId": "所屬幫會ID",
  "guildName": "幫會名稱"
}


3. 聊天系統遷移 (Chat System Migration)
3.1 採用 Colyseus + Firebase 模式
實時傳輸 (Colyseus)：
使用 ChatRoom (Colyseus Room) 處理在線玩家的即時訊息廣播。
訊息類型：GLOBAL (全服), GUILD (幫會), PRIVATE (私聊)。
歷史紀錄 (Firebase)：
訊息發送後，由 Server 端或 Client 端（視安全需求）寫入 Firestore 集合 /artifacts/{appId}/public/data/chat_history。
進入房間時，先從 Firestore 讀取最近 50 條訊息。
4. Claude Code 開發指令與步驟
請 Claude 依照下列順序執行實作：
第一階段：幫會基礎邏輯
建立幫會服務 (GuildService)：實作 createGuild(name, userId)。
驗證玩家是否已在其他幫會。
在 Firestore 建立文檔，初始職位設為 龍頭。
加入/退出邏輯：實作 joinGuild(guildId, userId) 與 leaveGuild(userId)。
joinGuild 預設為直接加入（成員職位），待後續優化審核制。
第二階段：Colyseus 聊天室更新
Room 定義：更新 ChatRoom.ts。
實作 onMessage("send_msg", ...) 處理邏輯。
根據玩家的 guildId 進行過濾廣播（針對幫會頻道）。
訊息持久化：
在 onMessage 觸發時，同步執行 admin.firestore().collection(...).add(...)。
第三階段：前端 UI 調整
幫會面板：新增幫會創建介面與成員清單顯示。
聊天切換：聊天視窗增加「幫會」分頁，僅當玩家有幫會時啟用。
5. 技術約束與安全性 (Crucial)
Firestore 存取限制：
嚴格遵守路徑規範：/artifacts/{appId}/public/data/{collection}。
查詢時不可使用 orderBy 或多重 where（除非在記憶體內過濾）。
驗證機制：
執行幫會管理動作（如踢人、修改公告）前，必須檢查該 userId 在 Firestore 中的 role 是否為 龍頭。
Colyseus 狀態管理：
將 guildId 儲存在 Colyseus 的 Client.userData 或 State 中，以便快速決定訊息廣播範圍。
6. 後續擴展預留 (Future Scope)
幫會等級系統。
更多職位（副幫主、護法等）。
幫會領地與戰鬥系統。
