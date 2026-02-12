/**
 * Quest Blueprint UI System (Phase 20)
 *
 * 負責：
 * 1. 顯示藍圖任務接受對話框
 * 2. 顯示任務對話（伺服器驅動）
 * 3. 顯示任務選擇
 * 4. 顯示任務目標追蹤 HUD
 * 5. 顯示任務完成通知
 */
import { Room } from "colyseus.js";
import {
    IBPQuestDialogue,
    IBPQuestChoices,
    IBPQuestTaskStart,
    IBPQuestTaskProgress,
    IBPQuestComplete,
    IBPQuestAvailable,
} from "@gangs-online/shared";

export class QuestBlueprintUI {
    private room: Room;
    private container: HTMLDivElement | null = null;
    private taskTracker: HTMLDivElement | null = null;
    private onInteractionStart: (() => void) | null = null;
    private onInteractionEnd: (() => void) | null = null;

    constructor(room: Room) {
        this.room = room;
        this.createContainer();
        this.createTaskTracker();
        this.setupMessageHandlers();
    }

    /**
     * 設置交互開始/結束回調（用於鎖定/解鎖玩家輸入）
     */
    setOnInteraction(onStart: () => void, onEnd: () => void): void {
        this.onInteractionStart = onStart;
        this.onInteractionEnd = onEnd;
    }

    /**
     * 創建主容器
     */
    private createContainer(): void {
        const container = document.createElement("div");
        container.id = "bp-quest-container";
        container.style.cssText = `
            display: none;
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            width: 600px;
            max-width: 90%;
            background: rgba(0, 0, 0, 0.92);
            border: 2px solid #FFD700;
            border-radius: 10px;
            padding: 20px;
            z-index: 1001;
            font-family: 'Microsoft JhengHei', 'Noto Sans TC', Arial, sans-serif;
            color: white;
        `;
        document.body.appendChild(container);
        this.container = container;
    }

    /**
     * 創建任務追蹤 HUD
     */
    private createTaskTracker(): void {
        const tracker = document.createElement("div");
        tracker.id = "bp-quest-tracker";
        tracker.style.cssText = `
            display: none;
            position: fixed;
            top: 80px;
            right: 20px;
            width: 280px;
            background: rgba(0, 0, 0, 0.8);
            border: 1px solid #FFD700;
            border-radius: 8px;
            padding: 12px 16px;
            z-index: 900;
            font-family: 'Microsoft JhengHei', 'Noto Sans TC', Arial, sans-serif;
            color: white;
        `;
        document.body.appendChild(tracker);
        this.taskTracker = tracker;
    }

    /**
     * 設置消息處理器
     */
    private setupMessageHandlers(): void {
        // 任務可接
        this.room.onMessage("bpQuestAvailable", (data: IBPQuestAvailable) => {
            console.log("📋 [BPUI] Quest available:", data.questName);
            this.showQuestAccept(data);
        });

        // 對話
        this.room.onMessage("bpQuestDialogue", (data: IBPQuestDialogue) => {
            console.log("💬 [BPUI] Dialogue:", data.text);
            this.showDialogue(data);
        });

        // 選擇
        this.room.onMessage("bpQuestChoices", (data: IBPQuestChoices) => {
            console.log("🔀 [BPUI] Choices:", data.options.length, "options");
            this.showChoices(data);
        });

        // 任務目標開始
        this.room.onMessage("bpQuestTaskStart", (data: IBPQuestTaskStart) => {
            console.log("🎯 [BPUI] Task start:", data.taskType, data.targetId, `0/${data.required}`);
            this.hideContainer();
            this.showTaskTracker(data);
        });

        // 任務進度更新
        this.room.onMessage("bpQuestTaskProgress", (data: IBPQuestTaskProgress) => {
            console.log("📊 [BPUI] Task progress:", `${data.current}/${data.required}`);
            this.updateTaskProgress(data);
        });

        // 任務完成
        this.room.onMessage("bpQuestComplete", (data: IBPQuestComplete) => {
            console.log("🎉 [BPUI] Quest complete:", data.questName);
            this.hideTaskTracker();
            this.showQuestComplete(data);
        });

        // 死路（選擇/條件後沒有後續節點）
        this.room.onMessage("bpQuestDeadEnd", () => {
            console.log("📋 [BPUI] Dead end - closing dialogue");
            this.hideContainer();
            this.onInteractionEnd?.();
        });

        // 任務放棄
        this.room.onMessage("bpQuestAbandoned", () => {
            console.log("❌ [BPUI] Quest abandoned");
            this.hideContainer();
            this.hideTaskTracker();
            this.onInteractionEnd?.();
        });
    }

    /**
     * 顯示任務接受對話框
     */
    private showQuestAccept(data: IBPQuestAvailable): void {
        if (!this.container) return;

        this.onInteractionStart?.();
        this.container.innerHTML = "";

        // 標題
        const title = document.createElement("div");
        title.style.cssText = `
            font-size: 20px;
            font-weight: bold;
            color: #FFD700;
            margin-bottom: 12px;
        `;
        title.textContent = "📜 新任務";
        this.container.appendChild(title);

        // 任務名稱
        const name = document.createElement("div");
        name.style.cssText = `
            font-size: 18px;
            color: #ffffff;
            margin-bottom: 16px;
            line-height: 1.5;
        `;
        name.textContent = data.questName;
        this.container.appendChild(name);

        // 按鈕容器
        const btnContainer = document.createElement("div");
        btnContainer.style.cssText = `
            display: flex;
            gap: 12px;
            justify-content: center;
        `;

        // 接受按鈕
        const acceptBtn = this.createButton("✅ 接受任務", "#1E90FF", () => {
            this.hideContainer();
            this.room.send("bpQuestAccept", { blueprintId: data.blueprintId });
        });

        // 拒絕按鈕
        const declineBtn = this.createButton("❌ 拒絕", "#666", () => {
            this.hideContainer();
            this.onInteractionEnd?.();
        });

        btnContainer.appendChild(acceptBtn);
        btnContainer.appendChild(declineBtn);
        this.container.appendChild(btnContainer);

        this.container.style.display = "block";
    }

    /**
     * 顯示對話
     */
    private showDialogue(data: IBPQuestDialogue): void {
        if (!this.container) return;

        this.onInteractionStart?.();
        this.container.innerHTML = "";

        // 說話者
        const speaker = document.createElement("div");
        speaker.style.cssText = `
            font-size: 18px;
            font-weight: bold;
            color: #FFD700;
            margin-bottom: 8px;
        `;
        // 如果有 expression，顯示表情
        const exprText = data.expression ? ` ${data.expression}` : "";
        speaker.textContent = `${data.npcName || data.speaker}${exprText}`;
        this.container.appendChild(speaker);

        // 對話內容
        const content = document.createElement("div");
        content.style.cssText = `
            font-size: 16px;
            line-height: 1.6;
            margin-bottom: 20px;
            white-space: pre-wrap;
        `;
        content.textContent = data.text;
        this.container.appendChild(content);

        // 繼續按鈕
        const nextBtn = this.createButton("繼續 ▶", "#1E90FF", () => {
            this.room.send("bpQuestDialogueNext");
        });
        nextBtn.style.marginLeft = "auto";
        nextBtn.style.display = "block";
        this.container.appendChild(nextBtn);

        this.container.style.display = "block";
    }

    /**
     * 顯示選擇
     */
    private showChoices(data: IBPQuestChoices): void {
        if (!this.container) return;

        this.onInteractionStart?.();
        this.container.innerHTML = "";

        // 標題
        if (data.speaker) {
            const speaker = document.createElement("div");
            speaker.style.cssText = `
                font-size: 18px;
                font-weight: bold;
                color: #FFD700;
                margin-bottom: 12px;
            `;
            speaker.textContent = data.npcName || data.speaker;
            this.container.appendChild(speaker);
        }

        // 選項
        const optionsDiv = document.createElement("div");
        optionsDiv.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: 10px;
        `;

        data.options.forEach((option: any, index: number) => {
            const btn = document.createElement("button");
            btn.textContent = option.text;
            btn.style.cssText = `
                padding: 12px 20px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                border: none;
                border-radius: 5px;
                color: white;
                font-size: 15px;
                cursor: pointer;
                transition: all 0.3s;
                text-align: left;
            `;
            btn.onmouseover = () => {
                btn.style.background = "linear-gradient(135deg, #764ba2 0%, #667eea 100%)";
                btn.style.transform = "scale(1.02)";
            };
            btn.onmouseout = () => {
                btn.style.background = "linear-gradient(135deg, #667eea 0%, #764ba2 100%)";
                btn.style.transform = "scale(1)";
            };
            btn.onclick = () => {
                this.room.send("bpQuestChoice", { optionIndex: index });
            };
            optionsDiv.appendChild(btn);
        });

        this.container.appendChild(optionsDiv);
        this.container.style.display = "block";
    }

    /**
     * 顯示任務追蹤 HUD
     */
    private showTaskTracker(data: IBPQuestTaskStart): void {
        if (!this.taskTracker) return;

        this.onInteractionEnd?.();

        const taskTypeLabels: Record<string, string> = {
            kill: "擊敗",
            collect: "收集",
            interact: "互動",
            location: "前往",
        };

        this.taskTracker.innerHTML = `
            <div style="font-size: 14px; color: #FFD700; font-weight: bold; margin-bottom: 6px;">
                📋 ${data.questName}
            </div>
            <div style="font-size: 13px; color: #ccc; margin-bottom: 8px;">
                ${data.description}
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 13px; color: #1E90FF;">
                    🎯 ${taskTypeLabels[data.taskType] || data.taskType}
                </span>
                <span id="bp-task-progress" style="font-size: 15px; font-weight: bold; color: #fff;">
                    0 / ${data.required}
                </span>
            </div>
            <div style="margin-top: 8px; background: #333; border-radius: 4px; height: 6px; overflow: hidden;">
                <div id="bp-task-bar" style="height: 100%; background: #1E90FF; width: 0%; transition: width 0.3s;"></div>
            </div>
        `;

        this.taskTracker.style.display = "block";
    }

    /**
     * 更新任務進度
     */
    private updateTaskProgress(data: IBPQuestTaskProgress): void {
        const progressEl = document.getElementById("bp-task-progress");
        const barEl = document.getElementById("bp-task-bar");

        if (progressEl) {
            progressEl.textContent = `${data.current} / ${data.required}`;
            if (data.current >= data.required) {
                progressEl.style.color = "#00ff00";
            }
        }

        if (barEl) {
            const pct = Math.min(100, (data.current / data.required) * 100);
            barEl.style.width = `${pct}%`;
            if (data.current >= data.required) {
                barEl.style.background = "#00ff00";
            }
        }
    }

    /**
     * 顯示任務完成
     */
    private showQuestComplete(data: IBPQuestComplete): void {
        if (!this.container) return;

        this.container.innerHTML = "";

        // 標題
        const title = document.createElement("div");
        title.style.cssText = `
            font-size: 22px;
            font-weight: bold;
            color: #FFD700;
            text-align: center;
            margin-bottom: 12px;
        `;
        title.textContent = "🎉 任務完成！";
        this.container.appendChild(title);

        // 任務名稱
        const name = document.createElement("div");
        name.style.cssText = `
            font-size: 16px;
            color: #fff;
            text-align: center;
            margin-bottom: 16px;
        `;
        name.textContent = data.questName;
        this.container.appendChild(name);

        // 獎勵
        const rewards = document.createElement("div");
        rewards.style.cssText = `
            background: rgba(34, 139, 34, 0.3);
            border: 1px solid #00ff00;
            border-radius: 8px;
            padding: 12px;
            text-align: center;
            margin-bottom: 16px;
        `;

        let rewardText = "";
        if (data.rewardMoney > 0) rewardText += `💰 $${data.rewardMoney}  `;
        if (data.rewardXp > 0) rewardText += `⭐ ${data.rewardXp} XP  `;
        if (data.rewardItems && data.rewardItems.length > 0) {
            data.rewardItems.forEach((item: any) => {
                rewardText += `📦 ${item.itemName || item.itemId} x${item.quantity}  `;
            });
        }

        rewards.innerHTML = `
            <div style="font-size: 14px; color: #aaa; margin-bottom: 6px;">獎勵</div>
            <div style="font-size: 16px; color: #fff; font-weight: bold;">${rewardText || "無"}</div>
        `;
        this.container.appendChild(rewards);

        // 關閉按鈕
        const closeBtn = this.createButton("確認", "#228B22", () => {
            this.hideContainer();
            this.onInteractionEnd?.();
        });
        closeBtn.style.margin = "0 auto";
        closeBtn.style.display = "block";
        this.container.appendChild(closeBtn);

        this.container.style.display = "block";
    }

    /**
     * 創建按鈕
     */
    private createButton(text: string, bgColor: string, onClick: () => void): HTMLButtonElement {
        const btn = document.createElement("button");
        btn.textContent = text;
        btn.style.cssText = `
            padding: 10px 24px;
            background: ${bgColor};
            border: none;
            border-radius: 6px;
            color: white;
            font-size: 15px;
            font-weight: bold;
            cursor: pointer;
            transition: all 0.2s;
        `;
        btn.onmouseover = () => {
            btn.style.opacity = "0.85";
            btn.style.transform = "scale(1.03)";
        };
        btn.onmouseout = () => {
            btn.style.opacity = "1";
            btn.style.transform = "scale(1)";
        };
        btn.onclick = onClick;
        return btn;
    }

    /**
     * 隱藏主容器
     */
    private hideContainer(): void {
        if (this.container) {
            this.container.style.display = "none";
        }
    }

    /**
     * 隱藏任務追蹤
     */
    private hideTaskTracker(): void {
        if (this.taskTracker) {
            this.taskTracker.style.display = "none";
        }
    }

    /**
     * 檢查 UI 是否活躍
     */
    isActive(): boolean {
        return this.container?.style.display === "block";
    }

    /**
     * 釋放資源
     */
    dispose(): void {
        if (this.container) {
            this.container.remove();
            this.container = null;
        }
        if (this.taskTracker) {
            this.taskTracker.remove();
            this.taskTracker = null;
        }
    }
}
