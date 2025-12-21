import * as GUI from "@babylonjs/gui";
import { Room } from "colyseus.js";
import { IQuestDef, IQuestState } from "@gangs-online/shared";

/**
 * 任務系統 (Phase 10: Data-Driven Quest System)
 * 負責管理客戶端的任務 UI 和交互
 */
export class QuestSystem {
    private room: Room;
    private uiTexture: GUI.AdvancedDynamicTexture;
    private popupContent: GUI.StackPanel | null = null;

    // 任務追蹤器 UI
    private questTrackerPanel: GUI.StackPanel | null = null;
    private questTrackerTitle: GUI.TextBlock | null = null;
    private questTrackerProgress: GUI.TextBlock | null = null;

    // 當前任務狀態
    private currentQuest: IQuestState | null = null;
    private availableQuest: IQuestDef | null = null;

    constructor(room: Room, uiTexture: GUI.AdvancedDynamicTexture) {
        this.room = room;
        this.uiTexture = uiTexture;
        this.setupQuestTracker();
        this.setupMessageHandlers();
    }

    /**
     * 設置任務追蹤器 UI（左側固定顯示）
     */
    private setupQuestTracker(): void {
        // 創建任務追蹤面板
        this.questTrackerPanel = new GUI.StackPanel("QuestTracker");
        this.questTrackerPanel.width = "220px";
        this.questTrackerPanel.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        this.questTrackerPanel.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP;
        this.questTrackerPanel.top = "150px";
        this.questTrackerPanel.left = "10px";
        this.questTrackerPanel.isVertical = true;
        this.questTrackerPanel.isVisible = false; // 默認隱藏
        this.uiTexture.addControl(this.questTrackerPanel);

        // 任務標題
        this.questTrackerTitle = new GUI.TextBlock("QuestTitle", "");
        this.questTrackerTitle.color = "#ffd700";
        this.questTrackerTitle.fontSize = 16;
        this.questTrackerTitle.fontWeight = "bold";
        this.questTrackerTitle.height = "25px";
        this.questTrackerTitle.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        this.questTrackerPanel.addControl(this.questTrackerTitle);

        // 任務進度
        this.questTrackerProgress = new GUI.TextBlock("QuestProgress", "");
        this.questTrackerProgress.color = "#ffffff";
        this.questTrackerProgress.fontSize = 14;
        this.questTrackerProgress.height = "20px";
        this.questTrackerProgress.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        this.questTrackerPanel.addControl(this.questTrackerProgress);
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
        this.updateQuestTracker();
    }

    /**
     * 更新任務追蹤器顯示
     */
    private updateQuestTracker(): void {
        if (!this.questTrackerPanel || !this.questTrackerTitle || !this.questTrackerProgress) {
            return;
        }

        if (this.currentQuest) {
            this.questTrackerPanel.isVisible = true;
            this.questTrackerTitle.text = `📋 ${this.currentQuest.name}`;

            if (this.currentQuest.completed) {
                this.questTrackerProgress.text = "✅ 任務完成！返回找浩南哥";
                this.questTrackerProgress.color = "#00ff00";
            } else {
                this.questTrackerProgress.text = `進度: ${this.currentQuest.currentCount}/${this.currentQuest.requiredCount}`;
                this.questTrackerProgress.color = "#ffffff";
            }
        } else {
            this.questTrackerPanel.isVisible = false;
        }
    }

    /**
     * 創建任務 Popup 內容
     */
    createQuestPopupContent(): GUI.Control[] {
        const controls: GUI.Control[] = [];

        if (this.currentQuest) {
            // 顯示當前任務
            controls.push(this.createCurrentQuestPanel());
        } else {
            // 顯示可接任務
            controls.push(this.createAvailableQuestPanel());
        }

        return controls;
    }

    /**
     * 創建當前任務面板
     */
    private createCurrentQuestPanel(): GUI.Container {
        const panel = new GUI.StackPanel();
        panel.isVertical = true;
        panel.width = "100%";
        panel.spacing = 10;
        panel.paddingTop = "20px";

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

        // 任務進度
        const progressBlock = new GUI.TextBlock();
        if (quest.completed) {
            progressBlock.text = "✅ 任務目標已達成！";
            progressBlock.color = "#00ff00";
        } else {
            progressBlock.text = `進度: ${quest.currentCount} / ${quest.requiredCount}`;
            progressBlock.color = "#ffffff";
        }
        progressBlock.fontSize = 18;
        progressBlock.height = "30px";
        progressBlock.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        panel.addControl(progressBlock);

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
        panel.addControl(buttonPanel);

        if (quest.completed) {
            // 完成任務按鈕
            const completeBtn = GUI.Button.CreateSimpleButton("completeBtn", "領取獎勵");
            completeBtn.width = "140px";
            completeBtn.height = "40px";
            completeBtn.color = "white";
            completeBtn.background = "#228B22";
            completeBtn.cornerRadius = 5;
            completeBtn.onPointerUpObservable.add(() => {
                this.room.send("completeQuest");
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
        abandonBtn.onPointerUpObservable.add(() => {
            this.room.send("abandonQuest");
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

        // 提示信息
        const tipBlock = new GUI.TextBlock();
        tipBlock.text = "💡 提示: 走近浩南哥 (紫色 NPC) 接取任務";
        tipBlock.color = "#888888";
        tipBlock.fontSize = 14;
        tipBlock.height = "30px";
        tipBlock.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        tipBlock.paddingTop = "20px";
        panel.addControl(tipBlock);

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
        container.height = "140px";
        container.background = "rgba(50, 50, 50, 0.8)";
        container.thickness = 1;
        container.color = "#666666";
        container.cornerRadius = 5;
        container.paddingTop = "10px";

        const panel = new GUI.StackPanel();
        panel.isVertical = true;
        panel.width = "95%";
        panel.spacing = 5;
        container.addControl(panel);

        // 任務名稱
        const nameBlock = new GUI.TextBlock();
        nameBlock.text = name;
        nameBlock.color = "#ffd700";
        nameBlock.fontSize = 18;
        nameBlock.fontWeight = "bold";
        nameBlock.height = "25px";
        nameBlock.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        panel.addControl(nameBlock);

        // 任務描述
        const descBlock = new GUI.TextBlock();
        descBlock.text = description;
        descBlock.color = "#cccccc";
        descBlock.fontSize = 14;
        descBlock.textWrapping = true;
        descBlock.height = "40px";
        descBlock.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        panel.addControl(descBlock);

        // 獎勵
        const rewardBlock = new GUI.TextBlock();
        rewardBlock.text = `獎勵: 💰 $${money}  ⭐ ${xp} XP`;
        rewardBlock.color = "#aaaaaa";
        rewardBlock.fontSize = 14;
        rewardBlock.height = "20px";
        rewardBlock.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        panel.addControl(rewardBlock);

        // 接受按鈕
        const acceptBtn = GUI.Button.CreateSimpleButton("acceptBtn", "接受任務");
        acceptBtn.width = "120px";
        acceptBtn.height = "30px";
        acceptBtn.color = "white";
        acceptBtn.background = "#1E90FF";
        acceptBtn.cornerRadius = 5;
        acceptBtn.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        acceptBtn.onPointerUpObservable.add(() => {
            this.room.send("acceptQuest", questId);
        });
        panel.addControl(acceptBtn);

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
        if (this.questTrackerPanel) {
            this.uiTexture.removeControl(this.questTrackerPanel);
        }
    }
}
