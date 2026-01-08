Phase 15 開發規格書：實戰場景套用 (Real Scene Integration)
1. 核心目標
將目前的開發用測試場景替換為真實的銅鑼灣地圖 (CausewayBay.glb)，實作大型場景的載入優化、碰撞系統、以及動態建築透明效果。
2. 地圖資源與環境設定
資源路徑：使用 packages/client/maps/CausewayBay.glb 作為核心場景模型。
座標與朝向：
地圖模型中心點或起始點固定於世界座標 (0, 0, 0)。
場景方向強制設定為「永遠向北」。
攝影機控制：
維持現有的俯視角度 (Top-down view)。
禁止非必要的視角旋轉，確保操作感符合 2.5D MMORPG 體驗。
3. 載入與效能監控
載入介面：
在進入遊戲的 Loading 畫面中，新增一個視覺化的進度條 (Loading Bar)。
進度條需真實反映 CausewayBay.glb 檔案的載入百分比。
效能指標 (Debug UI)：
畫面頂部暫時加入即時監控面板，顯示：
FPS (每秒幀數)
Polygons (多邊形總數)
Triangles (三角形總數)
渲染優化：
針對大型模型進行優化處理（如：Occlusion Culling, Mesh Merging 或分塊顯示），確保在移動設備或低配電腦上仍能順暢運行。
4. 地形與建築邏輯 (物件命名規則)
根據 .glb 檔案內的物件名稱首字母執行特定邏輯：
地形物件 (T 字開頭)：
定義為可移動區域 (Ground/Terrain)。
角色點擊此類物件時執行尋路或移動指令。
建築物件 (B 字開頭)：
碰撞體：所有 B 字頭物件必須具備實體碰撞，角色不可穿透。
遮擋透明化：
支援點擊建築後移動：點擊建築物時，角色應嘗試移動到該建築後方的地形座標。
半透明效果：當角色位置處於建築物後方（被遮擋）時，該建築物需自動變為半透明狀態，確保玩家可見性。
5. NPC 與場景清理
移除安全區：清理所有硬編碼的「安全區 (Safe Zone)」邏輯，全地圖回歸實戰狀態。
NPC 載入機制更新 (Firebase)：
在 Firebase NPC Collection 中新增 status 欄位。
選項：active / inactive。
邏輯：僅載入 status == "active" 的 NPC。
測試設定：目前請將所有 NPC 預設設為 inactive，以便專注於場景效能與地圖邏輯測試。
6. 技術細節建議
使用 Babylon.js 的 AssetsManager 或 SceneLoader.OnProgress 來實現精確的載入進度。
建築透明化建議使用 raycast 偵測角色與相機之間是否存在 B 字頭物件，並透過材質的 alpha 值或 visibility 屬性進行控制。
7. 版本更新
Client: 0.15.0
Server: 0.15.0
Shared: 0.15.0
