/**
 * Guild System (Phase 13: Guild System)
 * 負責幫會 UI 和幫會相關操作
 */
import * as GUI from "@babylonjs/gui";
import { Room } from "colyseus.js";
import { IGuildData, GuildRole, GUILD_CONSTANTS } from "@gangs-online/shared";

/**
 * 幫會系統類別
 */
export class GuildSystem {
    private room: Room;
    private uiTexture: GUI.AdvancedDynamicTexture;
    private popupContent: GUI.StackPanel | null = null;
    private hidePopupCallback: (() => void) | null = null;

    // 當前幫會狀態
    private currentGuildId: string = "";
    private currentGuildName: string = "";
    private currentRole: GuildRole | "" = "";

    // 幫會列表（用於顯示可加入的幫會）
    private guildList: IGuildData[] = [];

    // 當前幫會資料
    private currentGuildData: IGuildData | null = null;

    // 刷新 popup 的回調
    private refreshPopupCallback: (() => void) | null = null;

    // 是否正在等待幫會列表刷新（用戶手動點擊刷新按鈕時設為 true）
    private pendingGuildListRefresh: boolean = false;

    constructor(room: Room, uiTexture: GUI.AdvancedDynamicTexture) {
        this.room = room;
        this.uiTexture = uiTexture;
        this.setupMessageHandlers();
    }

    /**
     * 設置 Popup 內容容器
     */
    setPopupContent(content: GUI.StackPanel | null): void {
        this.popupContent = content;
    }

    /**
     * 設置隱藏 Popup 的回調
     */
    setHidePopupCallback(callback: () => void): void {
        this.hidePopupCallback = callback;
    }

    /**
     * 設置刷新 Popup 的回調
     */
    setRefreshPopupCallback(callback: () => void): void {
        this.refreshPopupCallback = callback;
    }

    /**
     * 設置訊息處理器
     */
    private setupMessageHandlers(): void {
        // 幫會更新（創建/加入/離開）
        this.room.onMessage("guildUpdate", (data: { guildId: string; guildName: string; role: string }) => {
            this.currentGuildId = data.guildId;
            this.currentGuildName = data.guildName;
            this.currentRole = data.role as GuildRole | "";
            // 離開幫會時重置列表，讓下次打開 popup 時重新載入
            if (!data.guildId) {
                this.guildList = [];
                this.currentGuildData = null;
            }
            console.log(`[GuildSystem] 幫會更新: ${data.guildName} (${data.role})`);
        });

        // 幫會列表 - 只有在「首次載入」或「用戶手動刷新」時才刷新 popup
        this.room.onMessage("guildList", (guilds: IGuildData[]) => {
            const wasEmpty = this.guildList.length === 0;
            this.guildList = guilds;
            console.log(`[GuildSystem] 收到幫會列表: ${guilds.length} 個幫會`);
            // 首次載入（之前列表為空）或用戶手動刷新時才刷新 popup
            // 這樣可以避免在用戶輸入幫會名稱時，自動刷新破壞 InputText 焦點
            if ((wasEmpty || this.pendingGuildListRefresh) && this.refreshPopupCallback) {
                this.pendingGuildListRefresh = false;
                this.refreshPopupCallback();
            }
        });

        // 幫會詳細資訊 - 收到後刷新 popup
        this.room.onMessage("guildInfo", (guild: IGuildData) => {
            this.currentGuildData = guild;
            // Debug: 顯示完整成員資料以診斷問題
            console.log(`[GuildSystem] 收到幫會資訊: ${guild.name}`, JSON.stringify(guild.members, null, 2));
            // 刷新 popup 以顯示成員列表
            if (this.refreshPopupCallback) {
                this.refreshPopupCallback();
            }
        });
    }

    /**
     * 更新幫會狀態（從 Player 同步）
     */
    updateGuildState(guildId: string, guildName: string): void {
        this.currentGuildId = guildId;
        this.currentGuildName = guildName;
    }

    /**
     * 創建幫會 Popup 內容
     */
    createGuildPopupContent(): GUI.Control[] {
        const controls: GUI.Control[] = [];

        if (this.currentGuildId) {
            // 已有幫會：顯示幫會資訊和成員列表
            controls.push(...this.createGuildInfoContent());
        } else {
            // 無幫會：顯示創建/加入選項
            controls.push(...this.createGuildJoinContent());
        }

        return controls;
    }

    /**
     * 創建幫會資訊內容（已有幫會時顯示）
     */
    private createGuildInfoContent(): GUI.Control[] {
        const controls: GUI.Control[] = [];

        // 幫會名稱
        const titleText = new GUI.TextBlock();
        titleText.text = `🏯 ${this.currentGuildName}`;
        titleText.color = "#FFD700";
        titleText.fontSize = 20;
        titleText.height = "40px";
        titleText.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
        controls.push(titleText);

        // 職位
        const roleText = new GUI.TextBlock();
        roleText.text = `職位: ${this.currentRole}`;
        roleText.color = "#FFFFFF";
        roleText.fontSize = 16;
        roleText.height = "30px";
        roleText.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
        controls.push(roleText);

        // 分隔線
        const separator = new GUI.Rectangle();
        separator.height = "2px";
        separator.width = "80%";
        separator.background = "#444444";
        separator.thickness = 0;
        controls.push(separator);

        // 成員列表標題
        const memberTitle = new GUI.TextBlock();
        memberTitle.text = "成員列表";
        memberTitle.color = "#AAAAAA";
        memberTitle.fontSize = 14;
        memberTitle.height = "25px";
        memberTitle.top = "10px";
        controls.push(memberTitle);

        // 如果有幫會資料，顯示成員
        if (this.currentGuildData && this.currentGuildData.members) {
            for (const [, member] of Object.entries(this.currentGuildData.members)) {
                const memberRow = new GUI.TextBlock();
                memberRow.text = `${member.role === "龍頭" ? "👑" : "👤"} ${member.name || "未知"} (${member.role})`;
                memberRow.color = member.role === "龍頭" ? "#FFD700" : "#FFFFFF";
                memberRow.fontSize = 12;
                memberRow.height = "22px";
                memberRow.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
                memberRow.paddingLeft = "20px";
                controls.push(memberRow);
            }
        } else {
            // 請求幫會資訊
            this.room.send("getGuildInfo", { guildId: this.currentGuildId });

            const loadingText = new GUI.TextBlock();
            loadingText.text = "載入中...";
            loadingText.color = "#888888";
            loadingText.fontSize = 12;
            loadingText.height = "22px";
            controls.push(loadingText);
        }

        // 離開幫會按鈕
        const leaveBtn = GUI.Button.CreateSimpleButton("leaveGuildBtn", "離開幫會");
        leaveBtn.width = "120px";
        leaveBtn.height = "35px";
        leaveBtn.color = "white";
        leaveBtn.background = "#c0392b";
        leaveBtn.fontSize = 14;
        leaveBtn.top = "20px";
        leaveBtn.cornerRadius = 5;
        leaveBtn.onPointerClickObservable.add(() => {
            this.room.send("leaveGuild");
            if (this.hidePopupCallback) {
                this.hidePopupCallback();
            }
        });
        controls.push(leaveBtn);

        return controls;
    }

    /**
     * 創建加入/創建幫會內容（無幫會時顯示）
     */
    private createGuildJoinContent(): GUI.Control[] {
        const controls: GUI.Control[] = [];

        // 標題
        const titleText = new GUI.TextBlock();
        titleText.text = "你還沒有加入幫會";
        titleText.color = "#AAAAAA";
        titleText.fontSize = 16;
        titleText.height = "30px";
        titleText.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
        controls.push(titleText);

        // === 創建幫會區塊 ===
        const createTitle = new GUI.TextBlock();
        createTitle.text = "創建新幫會";
        createTitle.color = "#FFD700";
        createTitle.fontSize = 14;
        createTitle.height = "25px";
        createTitle.top = "15px";
        controls.push(createTitle);

        // 幫會名稱輸入框
        const nameInput = new GUI.InputText();
        nameInput.width = "200px";
        nameInput.height = "35px";
        nameInput.text = "";
        nameInput.color = "white";
        nameInput.background = "rgba(0,0,0,0.5)";
        nameInput.placeholderText = "輸入幫會名稱...";
        nameInput.placeholderColor = "#666666";
        nameInput.fontSize = 14;
        nameInput.thickness = 1;
        nameInput.focusedBackground = "rgba(0,0,0,0.7)";
        nameInput.autoStretchWidth = false;
        // 點擊時自動獲取焦點
        nameInput.onPointerDownObservable.add(() => {
            nameInput.focus();
        });
        controls.push(nameInput);

        // 創建按鈕
        const createBtn = GUI.Button.CreateSimpleButton("createGuildBtn", "創建幫會");
        createBtn.width = "120px";
        createBtn.height = "35px";
        createBtn.color = "white";
        createBtn.background = "#27ae60";
        createBtn.fontSize = 14;
        createBtn.cornerRadius = 5;
        createBtn.top = "5px";
        createBtn.onPointerClickObservable.add(() => {
            console.log("[GuildSystem] 創建幫會按鈕被點擊");
            const guildName = nameInput.text.trim();
            console.log(`[GuildSystem] 輸入的幫會名稱: "${guildName}" (長度: ${guildName.length})`);
            if (guildName.length < GUILD_CONSTANTS.MIN_GUILD_NAME_LENGTH) {
                console.log(`[GuildSystem] 幫會名稱太短 (最少 ${GUILD_CONSTANTS.MIN_GUILD_NAME_LENGTH} 字)`);
                return;
            }
            if (guildName.length > GUILD_CONSTANTS.MAX_GUILD_NAME_LENGTH) {
                console.log(`[GuildSystem] 幫會名稱太長 (最多 ${GUILD_CONSTANTS.MAX_GUILD_NAME_LENGTH} 字)`);
                return;
            }
            console.log(`[GuildSystem] 發送 createGuild 訊息: ${guildName}`);
            this.room.send("createGuild", { name: guildName });
            if (this.hidePopupCallback) {
                this.hidePopupCallback();
            }
        });
        controls.push(createBtn);

        // === 分隔線 ===
        const separator = new GUI.Rectangle();
        separator.height = "2px";
        separator.width = "80%";
        separator.background = "#444444";
        separator.thickness = 0;
        separator.top = "15px";
        controls.push(separator);

        // === 加入幫會區塊 ===
        const joinTitle = new GUI.TextBlock();
        joinTitle.text = "加入現有幫會";
        joinTitle.color = "#3498db";
        joinTitle.fontSize = 14;
        joinTitle.height = "25px";
        joinTitle.top = "15px";
        controls.push(joinTitle);

        // 請求幫會列表
        this.room.send("getGuildList");

        // 幫會列表
        if (this.guildList.length > 0) {
            for (const guild of this.guildList.slice(0, 5)) {
                const guildRow = this.createGuildListRow(guild);
                controls.push(guildRow);
            }
        } else {
            const noGuildText = new GUI.TextBlock();
            noGuildText.text = "目前沒有幫會可加入";
            noGuildText.color = "#666666";
            noGuildText.fontSize = 12;
            noGuildText.height = "22px";
            controls.push(noGuildText);
        }

        // 刷新按鈕
        const refreshBtn = GUI.Button.CreateSimpleButton("refreshGuildBtn", "🔄 刷新列表");
        refreshBtn.width = "100px";
        refreshBtn.height = "30px";
        refreshBtn.color = "white";
        refreshBtn.background = "#7f8c8d";
        refreshBtn.fontSize = 12;
        refreshBtn.cornerRadius = 5;
        refreshBtn.top = "10px";
        refreshBtn.onPointerClickObservable.add(() => {
            // 設置標記，讓收到回應時刷新 popup
            this.pendingGuildListRefresh = true;
            this.room.send("getGuildList");
        });
        controls.push(refreshBtn);

        return controls;
    }

    /**
     * 創建幫會列表行
     */
    private createGuildListRow(guild: IGuildData): GUI.Container {
        const row = new GUI.Rectangle();
        row.width = "90%";
        row.height = "40px";
        row.background = "rgba(52, 73, 94, 0.5)";
        row.thickness = 0;
        row.cornerRadius = 5;
        row.top = "5px";

        const stack = new GUI.StackPanel();
        stack.isVertical = false;
        stack.width = "100%";
        stack.height = "100%";
        row.addControl(stack);

        // 幫會名稱
        const nameText = new GUI.TextBlock();
        nameText.text = `🏯 ${guild.name}`;
        nameText.color = "white";
        nameText.fontSize = 12;
        nameText.width = "60%";
        nameText.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        nameText.paddingLeft = "10px";
        stack.addControl(nameText);

        // 成員數
        const countText = new GUI.TextBlock();
        countText.text = `${guild.memberCount}/${GUILD_CONSTANTS.MAX_GUILD_MEMBERS}`;
        countText.color = "#AAAAAA";
        countText.fontSize = 10;
        countText.width = "15%";
        stack.addControl(countText);

        // 加入按鈕
        const joinBtn = GUI.Button.CreateSimpleButton("joinBtn", "加入");
        joinBtn.width = "50px";
        joinBtn.height = "25px";
        joinBtn.color = "white";
        joinBtn.background = "#3498db";
        joinBtn.fontSize = 10;
        joinBtn.cornerRadius = 3;
        joinBtn.onPointerClickObservable.add(() => {
            this.room.send("joinGuild", { guildId: guild.id });
            if (this.hidePopupCallback) {
                this.hidePopupCallback();
            }
        });
        stack.addControl(joinBtn);

        return row;
    }

    /**
     * 檢查玩家是否有幫會
     */
    hasGuild(): boolean {
        return this.currentGuildId !== "";
    }

    /**
     * 獲取當前幫會 ID
     */
    getGuildId(): string {
        return this.currentGuildId;
    }

    /**
     * 獲取當前幫會名稱
     */
    getGuildName(): string {
        return this.currentGuildName;
    }

    /**
     * 釋放資源
     */
    dispose(): void {
        this.guildList = [];
        this.currentGuildData = null;
    }
}
