/**
 * Dialogue System - 對話系統 (Phase 16-2)
 * 
 * 負責：
 * 1. 顯示 NPC 對話樹 UI
 * 2. 處理對話選項導航
 * 3. 執行對話動作（商店、任務等）
 */
import { DialogueTree, DialogueNode } from "@gangs-online/shared";

export class DialogueSystem {
    private dialogueContainer: HTMLDivElement | null = null;
    private currentTree: DialogueTree | null = null;
    private currentNode: DialogueNode | null = null;
    private npcId: string | null = null;
    private npcName: string | null = null;
    private linkedShopId: string | null = null; // Phase 16-3: 關聯的商店 ID
    private onClose: (() => void) | null = null;
    private onOpenShop: ((npcId: string, shopId: string, npcName: string) => void) | null = null;

    constructor() {
        this.createDialogueUI();
    }

    /**
     * 創建對話 UI 容器
     */
    private createDialogueUI(): void {
        // 創建對話容器
        const container = document.createElement("div");
        container.id = "dialogue-container";
        container.style.cssText = `
            display: none;
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            width: 600px;
            max-width: 90%;
            background: rgba(0, 0, 0, 0.9);
            border: 2px solid #FFD700;
            border-radius: 10px;
            padding: 20px;
            z-index: 1000;
            font-family: 'Microsoft JhengHei', 'Noto Sans TC', Arial, sans-serif;
            color: white;
        `;

        document.body.appendChild(container);
        this.dialogueContainer = container;

        console.log("✅ [DialogueSystem] UI Created");
    }

    /**
     * 顯示對話
     * @param npcId NPC ID
     * @param npcName NPC 名稱
     * @param tree 對話樹
     * @param linkedShopId 可選的關聯商店 ID（用於 open_shop 動作）
     */
    public show(npcId: string, npcName: string, tree: DialogueTree, linkedShopId?: string): void {
        if (!this.dialogueContainer) return;

        this.npcId = npcId;
        this.npcName = npcName;
        this.currentTree = tree;
        this.linkedShopId = linkedShopId || null;

        // 找到起始節點
        const startNode = tree.nodes.find(n => n.nodeId === tree.startNodeId);
        if (!startNode) {
            console.error("[DialogueSystem] Start node not found");
            return;
        }

        this.showNode(startNode);
        this.dialogueContainer.style.display = "block";

        console.log(`💬 [DialogueSystem] Showing dialogue with ${npcName}`);
    }

    /**
     * 顯示對話節點
     */
    private showNode(node: DialogueNode): void {
        if (!this.dialogueContainer) return;

        this.currentNode = node;

        // 清空容器
        this.dialogueContainer.innerHTML = "";

        // NPC 名字
        const nameDiv = document.createElement("div");
        nameDiv.style.cssText = `
            font-size: 18px;
            font-weight: bold;
            color: #FFD700;
            margin-bottom: 10px;
        `;
        // 防止顯示 node ID 作為說話者名稱（如 node_xxx 格式）
        const speakerName = (node.speaker && !node.speaker.startsWith("node_"))
            ? node.speaker
            : (this.npcName || "NPC");
        nameDiv.textContent = speakerName;
        this.dialogueContainer.appendChild(nameDiv);

        // 對話內容
        const contentDiv = document.createElement("div");
        contentDiv.style.cssText = `
            font-size: 16px;
            line-height: 1.6;
            margin-bottom: 20px;
            white-space: pre-wrap;
        `;
        contentDiv.textContent = node.content;
        this.dialogueContainer.appendChild(contentDiv);

        // 選項按鈕
        if (node.options && node.options.length > 0) {
            const optionsDiv = document.createElement("div");
            optionsDiv.style.cssText = `
                display: flex;
                flex-direction: column;
                gap: 10px;
            `;

            node.options.forEach((option) => {
                const button = document.createElement("button");
                button.textContent = option.text;
                button.style.cssText = `
                    padding: 10px 20px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    border: none;
                    border-radius: 5px;
                    color: white;
                    font-size: 14px;
                    cursor: pointer;
                    transition: all 0.3s;
                `;
                button.onmouseover = () => {
                    button.style.background = "linear-gradient(135deg, #764ba2 0%, #667eea 100%)";
                    button.style.transform = "scale(1.05)";
                };
                button.onmouseout = () => {
                    button.style.background = "linear-gradient(135deg, #667eea 0%, #764ba2 100%)";
                    button.style.transform = "scale(1)";
                };
                button.onclick = () => this.selectOption(option.nextNodeId);

                optionsDiv.appendChild(button);
            });

            this.dialogueContainer.appendChild(optionsDiv);
        } else {
            // 沒有選項，顯示關閉按鈕
            const closeButton = document.createElement("button");
            closeButton.textContent = "關閉";
            closeButton.style.cssText = `
                padding: 10px 20px;
                background: #666;
                border: none;
                border-radius: 5px;
                color: white;
                font-size: 14px;
                cursor: pointer;
                transition: all 0.3s;
            `;
            closeButton.onmouseover = () => {
                closeButton.style.background = "#888";
            };
            closeButton.onmouseout = () => {
                closeButton.style.background = "#666";
            };
            closeButton.onclick = () => {
                this.executeAction(node);
                this.hide();
            };

            this.dialogueContainer.appendChild(closeButton);
        }
    }

    /**
     * 選擇對話選項
     */
    private selectOption(nextNodeId: string): void {
        if (!this.currentTree) return;

        // 找到下一個節點
        const nextNode = this.currentTree.nodes.find(n => n.nodeId === nextNodeId);
        if (!nextNode) {
            console.error(`[DialogueSystem] Node ${nextNodeId} not found`);
            this.hide();
            return;
        }

        this.showNode(nextNode);
    }

    /**
     * 執行對話動作
     */
    private executeAction(node: DialogueNode): void {
        if (!node.actionType) return;

        console.log(`🎬 [DialogueSystem] Executing action: ${node.actionType}`, node.actionData);

        switch (node.actionType) {
            case 'open_shop':
                // 從 actionData 或 linkedShopId 獲取商店 ID
                const shopId = node.actionData?.shopId || this.linkedShopId;
                if (shopId && this.npcId && this.onOpenShop) {
                    console.log(`🏪 [DialogueSystem] Opening shop: ${shopId}`);
                    this.onOpenShop(this.npcId, shopId, this.npcName || "商店");
                } else {
                    console.warn("[DialogueSystem] Cannot open shop: missing shopId or callback");
                }
                break;
            case 'accept_quest':
                // TODO: 接受任務
                console.log("[DialogueSystem] Accepting quest:", node.actionData);
                break;
            case 'end_dialogue':
                this.hide();
                break;
        }
    }

    /**
     * 隱藏對話 UI
     */
    public hide(): void {
        if (!this.dialogueContainer) return;

        this.dialogueContainer.style.display = "none";
        this.currentTree = null;
        this.currentNode = null;
        this.npcId = null;
        this.npcName = null;
        this.linkedShopId = null;

        if (this.onClose) {
            this.onClose();
            this.onClose = null;
        }

        console.log("💬 [DialogueSystem] Dialogue closed");
    }

    /**
     * 檢查對話是否顯示中
     */
    public isActive(): boolean {
        return this.dialogueContainer?.style.display === "block";
    }

    /**
     * 設置關閉回調
     */
    public setOnClose(callback: () => void): void {
        this.onClose = callback;
    }

    /**
     * 設置打開商店回調 (Phase 16-3)
     */
    public setOnOpenShop(callback: (npcId: string, shopId: string, npcName: string) => void): void {
        this.onOpenShop = callback;
    }
}
