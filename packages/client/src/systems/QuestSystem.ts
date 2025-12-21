import * as GUI from "@babylonjs/gui";
import { Room } from "colyseus.js";
import { IQuestDef, IQuestState } from "@gangs-online/shared";

/**
 * 任務系統 (Phase 10: Data-Driven Quest System)
 * 負責管理客戶端的任務 UI 和交互
 * 任務進度直接顯示在 popup 中
 */
export class QuestSystem {
    private room: Room;
    private uiTexture: GUI.AdvancedDynamicTexture;
    private popupContent: GUI.StackPanel | null = null;

    // 當前任務狀態
    private currentQuest: IQuestState | null = null;
    private availableQuest: IQuestDef | null = null;

    // 關閉 popup 的回調
    private hidePopupCallback: (() => void) | null = null;

    constructor(room: Room, uiTexture: GUI.AdvancedDynamicTexture) {
        this.room = room;
        this.uiTexture = uiTexture;
        this.setupMessageHandlers();
    }

    /**
     * 設置關閉 popup 的回調
     */
    setHidePopupCallback(callback: () => void): void {
        this.hidePopupCallback = callback;
    }

    /**
     * 設置消息處理器
     */
    private setupMessageHandlers(): void {
        // 接收可用任務信息
        this.room.onMessage("questInfo", (quest: IQuestDef) => {
            this.availableQuest = quest;
            console.log("📋 Received quest info:", quest.name);
        });
    }

    /**
     * 更新任務狀態（從玩家數據同步）
     */
    updateQuestState(quest: IQuestState | null): void {
        this.currentQuest = quest;
    }

    /**
     * 獲取當前任務狀態
     */
    getCurrentQuest(): IQuestState | null {
        return this.currentQuest;
    }

    /**
     * 創建任務 Popup 內容
     */
    createQuestPopupContent(): GUI.Control[] {
        const controls: GUI.Control[] = [];

        if (this.currentQuest) {
            // 顯示當前任務進度
            controls.push(this.createCurrentQuestPanel());
        } else {
            // 顯示可接任務
            controls.push(this.createAvailableQuestPanel());
        }

        return controls;
    }

    /**
     * 創建當前任務面板（顯示進度）
     */
    private createCurrentQuestPanel(): GUI.Container {
        const panel = new GUI.StackPanel();
        panel.isVertical = true;
        panel.width = "100%";
        panel.spacing = 10;
        panel.paddingTop = "20px";
        panel.isPointerBlocker = false;

        const quest = this.currentQuest!;

        // 任務標題
        const titleBlock = new GUI.TextBlock();
        titleBlock.text = `📋 ${quest.name}`;
        titleBlock.color = "#ffd700";
        titleBlock.fontSize = 22;
        titleBlock.fontWeight = "bold";
        titleBlock.height = "35px";
        titleBlock.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        panel.addControl(titleBlock);

        // 分隔線
        const separator = new GUI.Rectangle();
        separator.width = "100%";
        separator.height = "2px";
        separator.background = "#444444";
        separator.thickness = 0;
        panel.addControl(separator);

        // 任務描述
        const descBlock = new GUI.TextBlock();
        descBlock.text = quest.description;
        descBlock.color = "#cccccc";
        descBlock.fontSize = 16;
        descBlock.textWrapping = true;
        descBlock.height = "80px";
        descBlock.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        descBlock.textVerticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP;
        descBlock.paddingTop = "10px";
        panel.addControl(descBlock);

        // 任務進度 - 重點顯示
        const progressContainer = new GUI.Rectangle();
        progressContainer.width = "100%";
        progressContainer.height = "50px";
        progressContainer.background = quest.completed ? "rgba(34, 139, 34, 0.3)" : "rgba(30, 144, 255, 0.3)";
        progressContainer.thickness = 2;
        progressContainer.color = quest.completed ? "#00ff00" : "#1E90FF";
        progressContainer.cornerRadius = 8;
        panel.addControl(progressContainer);

        const progressBlock = new GUI.TextBlock();
        if (quest.completed) {
            progressBlock.text = "✅ 任務完成！可以領取獎勵";
            progressBlock.color = "#00ff00";
        } else {
            progressBlock.text = `🎯 進度: ${quest.currentCount} / ${quest.requiredCount}`;
            progressBlock.color = "#ffffff";
        }
        progressBlock.fontSize = 20;
        progressBlock.fontWeight = "bold";
        progressContainer.addControl(progressBlock);

        // 獎勵信息
        const rewardTitle = new GUI.TextBlock();
        rewardTitle.text = "🎁 獎勵:";
        rewardTitle.color = "#ffd700";
        rewardTitle.fontSize = 16;
        rewardTitle.height = "25px";
        rewardTitle.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        rewardTitle.paddingTop = "15px";
        panel.addControl(rewardTitle);

        const rewardBlock = new GUI.TextBlock();
        rewardBlock.text = `  💰 $${quest.rewardMoney}    ⭐ ${quest.rewardXp} XP`;
        rewardBlock.color = "#ffffff";
        rewardBlock.fontSize = 16;
        rewardBlock.height = "25px";
        rewardBlock.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        panel.addControl(rewardBlock);

        // 按鈕區域
        const buttonPanel = new GUI.StackPanel();
        buttonPanel.isVertical = false;
        buttonPanel.height = "50px";
        buttonPanel.paddingTop = "20px";
        buttonPanel.spacing = 20;
        buttonPanel.isPointerBlocker = false;
        panel.addControl(buttonPanel);

        if (quest.completed) {
            // 完成任務按鈕
            const completeBtn = GUI.Button.CreateSimpleButton("completeBtn", "🎁 領取獎勵");
            completeBtn.width = "160px";
            completeBtn.height = "45px";
            completeBtn.color = "white";
            completeBtn.background = "#228B22";
            completeBtn.cornerRadius = 8;
            completeBtn.fontSize = 18;
            completeBtn.fontWeight = "bold";
            completeBtn.isPointerBlocker = true;
            completeBtn.onPointerUpObservable.add(() => {
                console.log("📋 Completing quest");
                this.room.send("completeQuest");
                if (this.hidePopupCallback) {
                    this.hidePopupCallback();
                }
            });
            buttonPanel.addControl(completeBtn);
        }

        // 放棄任務按鈕
        const abandonBtn = GUI.Button.CreateSimpleButton("abandonBtn", "放棄任務");
        abandonBtn.width = "120px";
        abandonBtn.height = "40px";
        abandonBtn.color = "white";
        abandonBtn.background = "#8B0000";
        abandonBtn.cornerRadius = 5;
        abandonBtn.isPointerBlocker = true;
        abandonBtn.onPointerUpObservable.add(() => {
            console.log("📋 Abandoning quest");
            this.room.send("abandonQuest");
            if (this.hidePopupCallback) {
                this.hidePopupCallback();
            }
        });
        buttonPanel.addControl(abandonBtn);

        return panel;
    }

    /**
     * 創建可接任務面板
     */
    private createAvailableQuestPanel(): GUI.Container {
        const panel = new GUI.StackPanel();
        panel.isVertical = true;
        panel.width = "100%";
        panel.spacing = 10;
        panel.paddingTop = "20px";
        panel.isPointerBlocker = false;

        // 請求可用任務信息
        this.room.send("getQuestInfo");

        // 標題
        const titleBlock = new GUI.TextBlock();
        titleBlock.text = "📜 可接任務";
        titleBlock.color = "#ffd700";
        titleBlock.fontSize = 22;
        titleBlock.fontWeight = "bold";
        titleBlock.height = "35px";
        titleBlock.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        panel.addControl(titleBlock);

        // 分隔線
        const separator = new GUI.Rectangle();
        separator.width = "100%";
        separator.height = "2px";
        separator.background = "#444444";
        separator.thickness = 0;
        panel.addControl(separator);

        // 第一個任務：清理門戶
        const quest1Panel = this.createQuestItem(
            "q1_first_blood",
            "清理門戶",
            "浩南哥話最近有班廢青係銅鑼灣搞事，你去教訓下 3 個小混混。",
            500,
            300
        );
        panel.addControl(quest1Panel);

        return panel;
    }

    /**
     * 創建單個任務項目
     */
    private createQuestItem(
        questId: string,
        name: string,
        description: string,
        money: number,
        xp: number
    ): GUI.Container {
        const container = new GUI.Rectangle();
        container.width = "100%";
        container.height = "180px";
        container.background = "rgba(50, 50, 50, 0.8)";
        container.thickness = 1;
        container.color = "#666666";
        container.cornerRadius = 8;
        container.paddingTop = "10px";
        container.isPointerBlocker = false;

        const panel = new GUI.StackPanel();
        panel.isVertical = true;
        panel.width = "95%";
        panel.spacing = 8;
        panel.isPointerBlocker = false;
        container.addControl(panel);

        // 任務名稱
        const nameBlock = new GUI.TextBlock();
        nameBlock.text = `📋 ${name}`;
        nameBlock.color = "#ffd700";
        nameBlock.fontSize = 20;
        nameBlock.fontWeight = "bold";
        nameBlock.height = "30px";
        nameBlock.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        panel.addControl(nameBlock);

        // 任務描述
        const descBlock = new GUI.TextBlock();
        descBlock.text = description;
        descBlock.color = "#cccccc";
        descBlock.fontSize = 14;
        descBlock.textWrapping = true;
        descBlock.height = "45px";
        descBlock.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        panel.addControl(descBlock);

        // 任務目標
        const targetBlock = new GUI.TextBlock();
        targetBlock.text = "🎯 目標: 擊敗 3 個小混混";
        targetBlock.color = "#1E90FF";
        targetBlock.fontSize = 14;
        targetBlock.height = "22px";
        targetBlock.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        panel.addControl(targetBlock);

        // 獎勵
        const rewardBlock = new GUI.TextBlock();
        rewardBlock.text = `🎁 獎勵: 💰 $${money}  ⭐ ${xp} XP`;
        rewardBlock.color = "#aaaaaa";
        rewardBlock.fontSize = 14;
        rewardBlock.height = "22px";
        rewardBlock.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        panel.addControl(rewardBlock);

        // 接受按鈕
        const btnContainer = new GUI.Rectangle();
        btnContainer.width = "100%";
        btnContainer.height = "45px";
        btnContainer.thickness = 0;
        btnContainer.isPointerBlocker = false;
        panel.addControl(btnContainer);

        const acceptBtn = GUI.Button.CreateSimpleButton(`acceptBtn_${questId}`, "✅ 接受任務");
        acceptBtn.width = "140px";
        acceptBtn.height = "40px";
        acceptBtn.color = "white";
        acceptBtn.background = "#1E90FF";
        acceptBtn.cornerRadius = 8;
        acceptBtn.fontSize = 16;
        acceptBtn.fontWeight = "bold";
        acceptBtn.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        acceptBtn.isPointerBlocker = true;
        acceptBtn.onPointerUpObservable.add(() => {
            console.log(`📋 Accepting quest: ${questId}`);
            this.room.send("acceptQuest", questId);
            if (this.hidePopupCallback) {
                this.hidePopupCallback();
            }
        });
        btnContainer.addControl(acceptBtn);

        return container;
    }

    /**
     * 設置 Popup 內容面板引用
     */
    setPopupContent(popupContent: GUI.StackPanel | null): void {
        this.popupContent = popupContent;
    }

    /**
     * 釋放資源
     */
    dispose(): void {
        // 無需清理左側追蹤器，因為已移除
    }
}
