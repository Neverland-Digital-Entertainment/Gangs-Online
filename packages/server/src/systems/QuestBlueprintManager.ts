/**
 * Quest Blueprint Manager (Phase 20)
 *
 * 負責：
 * 1. 從 Firebase 載入任務藍圖
 * 2. 解析節點圖並執行任務邏輯
 * 3. 追蹤每位玩家的任務進度
 * 4. 處理對話、選擇、任務目標、條件、動作等
 */
import { Client } from "colyseus";
import { Player, Item } from "../rooms/schema/GameState";
import {
    IQuestBlueprint, IQuestBlueprintNode, IQuestBlueprintEdge,
    IStartNodeData, IDialogueNodeData, IChoiceNodeData,
    ITaskNodeData, IConditionNodeData, IActionNodeData, IEndNodeData,
    QuestNodeType, IBPQuestRuntimeState,
    getRankTitle
} from "@gangs-online/shared";
import { getFirestore } from "../services/FirebaseService";

/**
 * 每位玩家的藍圖任務運行時狀態
 */
interface PlayerQuestState {
    blueprintId: string;
    currentNodeId: string;
    taskProgress: number;
    variables: Record<string, string>;
}

/**
 * 已完成的任務列表（per player, keyed by firebaseUid）
 */
interface PlayerCompletedQuests {
    completedBlueprintIds: string[];
}

export class QuestBlueprintManager {
    private blueprints: Map<string, IQuestBlueprint> = new Map();
    // 以 sessionId 為 key 的玩家任務狀態
    private playerStates: Map<string, PlayerQuestState> = new Map();
    // 以 firebaseUid 為 key 的已完成任務
    private playerCompleted: Map<string, string[]> = new Map();

    /**
     * 初始化：從 Firebase 載入所有啟用的任務藍圖
     */
    async initialize(): Promise<void> {
        const db = getFirestore();
        if (!db) {
            console.warn("⚠️ [QuestBlueprintManager] Firebase not initialized, skipping blueprint load");
            return;
        }

        try {
            const snapshot = await db.collection("quest_blueprints")
                .where("isActive", "==", true)
                .get();

            snapshot.forEach((doc: any) => {
                const data = doc.data();
                const blueprint: IQuestBlueprint = {
                    id: doc.id,
                    name: data.name || "",
                    description: data.description || "",
                    nodes: data.nodes || [],
                    edges: data.edges || [],
                    isActive: data.isActive ?? true,
                    createdAt: data.createdAt,
                    updatedAt: data.updatedAt,
                };
                this.blueprints.set(doc.id, blueprint);
            });

            console.log(`✅ [QuestBlueprintManager] Loaded ${this.blueprints.size} active quest blueprints`);
            this.blueprints.forEach((bp, id) => {
                console.log(`  📋 ${id}: "${bp.name}" (${bp.nodes.length} nodes, ${bp.edges.length} edges)`);
            });
        } catch (error) {
            console.error("❌ [QuestBlueprintManager] Failed to load blueprints:", error);
        }
    }

    /**
     * 設置玩家已完成的藍圖任務列表（從 persistence 載入）
     */
    setPlayerCompleted(firebaseUid: string, completedIds: string[]): void {
        this.playerCompleted.set(firebaseUid, completedIds);
    }

    /**
     * 獲取玩家已完成的藍圖任務列表
     */
    getPlayerCompleted(firebaseUid: string): string[] {
        return this.playerCompleted.get(firebaseUid) || [];
    }

    /**
     * 獲取玩家的當前任務狀態（用於 persistence）
     */
    getPlayerState(sessionId: string): PlayerQuestState | undefined {
        return this.playerStates.get(sessionId);
    }

    /**
     * 從 persistence 恢復玩家任務狀態
     */
    restorePlayerState(sessionId: string, state: PlayerQuestState): void {
        this.playerStates.set(sessionId, state);
    }

    /**
     * 清除玩家狀態（玩家離開時調用）
     */
    clearPlayerState(sessionId: string): void {
        this.playerStates.delete(sessionId);
    }

    /**
     * 檢查某個 NPC 是否有可接任務
     * 返回可接任務的 blueprintId，或 null
     */
    getAvailableQuestForNPC(npcTemplateId: string, player: Player): string | null {
        const completedIds = this.playerCompleted.get(player.firebaseUid) || [];
        const currentState = this.playerStates.get(player.sessionId);

        for (const [bpId, bp] of this.blueprints) {
            // 跳過已完成的任務
            if (completedIds.includes(bpId)) continue;

            // 跳過正在進行的任務
            if (currentState && currentState.blueprintId === bpId) continue;

            // 找到 Start 節點
            const startNode = bp.nodes.find((n: IQuestBlueprintNode) => n.type === 'start');
            if (!startNode) continue;

            const startData = startNode.data as IStartNodeData;

            // 檢查 NPC 模板 ID 是否匹配
            if (startData.npcTemplateId !== npcTemplateId) continue;

            // 檢查等級限制
            if (startData.minLevel && player.level < startData.minLevel) continue;
            if (startData.maxLevel && player.level > startData.maxLevel) continue;

            // 檢查前置任務
            if (startData.prerequisiteQuestId && !completedIds.includes(startData.prerequisiteQuestId)) continue;

            return bpId;
        }

        return null;
    }

    /**
     * 玩家是否有正在進行的藍圖任務
     */
    hasActiveQuest(sessionId: string): boolean {
        return this.playerStates.has(sessionId);
    }

    /**
     * 獲取正在進行的任務藍圖
     */
    getActiveBlueprint(sessionId: string): IQuestBlueprint | null {
        const state = this.playerStates.get(sessionId);
        if (!state) return null;
        return this.blueprints.get(state.blueprintId) || null;
    }

    /**
     * 開始任務：玩家接受任務，從 Start 節點開始走圖
     */
    startQuest(client: Client, player: Player, blueprintId: string): boolean {
        const blueprint = this.blueprints.get(blueprintId);
        if (!blueprint) {
            client.send("notification", "找不到這個任務！");
            return false;
        }

        // 檢查是否已有進行中的藍圖任務
        if (this.playerStates.has(player.sessionId)) {
            client.send("notification", "你已經有進行中的任務了！");
            return false;
        }

        // 找到 Start 節點
        const startNode = blueprint.nodes.find((n: IQuestBlueprintNode) => n.type === 'start');
        if (!startNode) {
            console.error(`[QuestBlueprintManager] Blueprint ${blueprintId} has no start node`);
            return false;
        }

        // 初始化玩家任務狀態
        const state: PlayerQuestState = {
            blueprintId,
            currentNodeId: startNode.id,
            taskProgress: 0,
            variables: {},
        };
        this.playerStates.set(player.sessionId, state);

        // 更新 Player schema 的藍圖任務字段
        player.activeBlueprintId = blueprintId;
        player.activeBlueprintName = blueprint.name;

        console.log(`📋 [QuestBlueprintManager] ${player.name} started quest: ${blueprint.name}`);
        client.send("notification", `接受任務: ${blueprint.name}`);

        // 從 Start 節點開始前進
        this.advanceFromNode(client, player, startNode.id);

        return true;
    }

    /**
     * 從指定節點出發，沿邊走到下一個節點
     */
    private advanceFromNode(client: Client, player: Player, fromNodeId: string, sourceHandle?: string): void {
        const state = this.playerStates.get(player.sessionId);
        if (!state) return;

        const blueprint = this.blueprints.get(state.blueprintId);
        if (!blueprint) return;

        // 找到從該節點出發的邊
        let edge: IQuestBlueprintEdge | undefined;
        if (sourceHandle) {
            // 選擇特定 handle 的邊（用於 choice/condition 分支）
            edge = blueprint.edges.find((e: IQuestBlueprintEdge) =>
                e.source === fromNodeId && e.sourceHandle === sourceHandle
            );
        } else {
            // 找默認邊
            edge = blueprint.edges.find((e: IQuestBlueprintEdge) => e.source === fromNodeId);
        }

        if (!edge) {
            console.log(`📋 [QuestBlueprintManager] No outgoing edge from node ${fromNodeId} (handle: ${sourceHandle || 'default'})`);
            // 死路 - 任務停留在當前狀態
            return;
        }

        // 走到下一個節點
        const nextNode = blueprint.nodes.find((n: IQuestBlueprintNode) => n.id === edge!.target);
        if (!nextNode) {
            console.error(`[QuestBlueprintManager] Target node ${edge.target} not found`);
            return;
        }

        state.currentNodeId = nextNode.id;
        this.processNode(client, player, nextNode);
    }

    /**
     * 處理節點邏輯
     */
    private processNode(client: Client, player: Player, node: IQuestBlueprintNode): void {
        const state = this.playerStates.get(player.sessionId);
        if (!state) return;

        console.log(`📋 [QuestBlueprintManager] Processing node: ${node.id} (type: ${node.type})`);

        switch (node.type) {
            case 'start':
                // Start 節點：直接前進
                this.advanceFromNode(client, player, node.id);
                break;

            case 'dialogue':
                this.handleDialogueNode(client, player, node);
                break;

            case 'choice':
                this.handleChoiceNode(client, player, node);
                break;

            case 'task':
                this.handleTaskNode(client, player, node);
                break;

            case 'condition':
                this.handleConditionNode(client, player, node);
                break;

            case 'action':
                this.handleActionNode(client, player, node);
                break;

            case 'end':
                this.handleEndNode(client, player, node);
                break;
        }
    }

    /**
     * 處理對話節點 - 發送對話給客戶端，等待確認
     */
    private handleDialogueNode(client: Client, player: Player, node: IQuestBlueprintNode): void {
        const data = node.data as IDialogueNodeData;

        // 查找 NPC 名稱（透過 speakerId 對應 NPC 模板名稱）
        const npcName = data.speakerId || "NPC";

        client.send("bpQuestDialogue", {
            npcName: npcName,
            speaker: data.speakerId,
            expression: data.expression || "",
            text: data.textZh || data.textEn || "",
        });
    }

    /**
     * 處理選擇節點 - 發送選項給客戶端，等待選擇
     */
    private handleChoiceNode(client: Client, player: Player, node: IQuestBlueprintNode): void {
        const data = node.data as IChoiceNodeData;

        const options = (data.options || []).map((opt: any) => ({
            text: opt.textZh || opt.textEn || "...",
            targetHandleId: opt.targetHandleId || "",
        }));

        client.send("bpQuestChoices", {
            npcName: "",
            speaker: "",
            options: options,
        });
    }

    /**
     * 處理任務目標節點 - 暫停在這裡等待任務完成
     */
    private handleTaskNode(client: Client, player: Player, node: IQuestBlueprintNode): void {
        const data = node.data as ITaskNodeData;
        const state = this.playerStates.get(player.sessionId);
        if (!state) return;

        // 重置任務進度
        state.taskProgress = 0;

        // 更新 Player schema 字段
        player.activeTaskType = data.taskType;
        player.activeTaskTarget = data.targetId;
        player.activeTaskDesc = data.description || `${data.taskType}: ${data.targetId}`;
        player.activeTaskCurrent = 0;
        player.activeTaskRequired = data.requiredCount;

        console.log(`📋 [QuestBlueprintManager] Task started: ${data.taskType} - ${data.targetId} x${data.requiredCount}`);

        client.send("bpQuestTaskStart", {
            blueprintId: state.blueprintId,
            questName: player.activeBlueprintName,
            taskType: data.taskType,
            targetId: data.targetId,
            description: player.activeTaskDesc,
            required: data.requiredCount,
        });
    }

    /**
     * 處理條件節點 - 即時檢查，根據結果分支
     */
    private handleConditionNode(client: Client, player: Player, node: IQuestBlueprintNode): void {
        const data = node.data as IConditionNodeData;
        const state = this.playerStates.get(player.sessionId);
        if (!state) return;

        let conditionMet = false;

        switch (data.conditionType) {
            case 'money':
                conditionMet = player.money >= data.requiredAmount;
                break;
            case 'item': {
                // 檢查玩家背包中是否有足夠數量的指定物品
                let count = 0;
                for (let i = 0; i < player.inventory.length; i++) {
                    const item = player.inventory.at(i);
                    if (item && item.id === data.targetId) {
                        count++;
                    }
                }
                conditionMet = count >= data.requiredAmount;
                break;
            }
            case 'variable':
                // 檢查任務變數
                const varValue = state.variables[data.targetId || ""];
                conditionMet = varValue !== undefined && parseInt(varValue) >= data.requiredAmount;
                break;
        }

        console.log(`📋 [QuestBlueprintManager] Condition check: ${data.conditionType} ${data.targetId || ''} >= ${data.requiredAmount} → ${conditionMet}`);

        // 根據結果選擇分支
        // Condition 節點有兩個 handle: 'success' 和 'fail'
        const handle = conditionMet ? 'success' : 'fail';
        this.advanceFromNode(client, player, node.id, handle);
    }

    /**
     * 處理動作節點 - 即時執行，然後前進
     */
    private handleActionNode(client: Client, player: Player, node: IQuestBlueprintNode): void {
        const data = node.data as IActionNodeData;
        const state = this.playerStates.get(player.sessionId);
        if (!state) return;

        switch (data.actionType) {
            case 'remove_item': {
                // 移除指定數量的物品
                let toRemove = data.amount || 1;
                for (let i = player.inventory.length - 1; i >= 0 && toRemove > 0; i--) {
                    const item = player.inventory.at(i);
                    if (item && item.id === data.targetId) {
                        player.inventory.deleteAt(i);
                        toRemove--;
                    }
                }
                console.log(`📋 [QuestBlueprintManager] Removed ${(data.amount || 1) - toRemove}x ${data.targetId}`);
                break;
            }
            case 'remove_money':
                player.money = Math.max(0, player.money - (data.amount || 0));
                console.log(`📋 [QuestBlueprintManager] Removed $${data.amount} from ${player.name}`);
                break;
            case 'spawn_npc':
                // TODO: 動態生成 NPC（Phase 20 擴展）
                console.log(`📋 [QuestBlueprintManager] spawn_npc not yet implemented`);
                break;
            case 'set_variable':
                state.variables[data.targetId || ""] = data.value || "";
                console.log(`📋 [QuestBlueprintManager] Set variable: ${data.targetId} = ${data.value}`);
                break;
        }

        // 動作完成後前進
        this.advanceFromNode(client, player, node.id);
    }

    /**
     * 處理結束節點 - 發放獎勵，完成任務
     */
    private handleEndNode(client: Client, player: Player, node: IQuestBlueprintNode): void {
        const data = node.data as IEndNodeData;
        const state = this.playerStates.get(player.sessionId);
        if (!state) return;

        const blueprint = this.blueprints.get(state.blueprintId);
        const questName = blueprint?.name || "未知任務";

        // 發放獎勵
        if (data.rewardXp > 0) {
            player.xp += data.rewardXp;
            // 檢查升級
            if (player.xp >= player.maxXp) {
                player.xp -= player.maxXp;
                player.level++;
                player.maxXp = Math.floor(player.maxXp * 1.5);
                player.maxHp += 20;
                player.hp = player.maxHp;
                const newTitle = getRankTitle(player.level);
                console.log(`🎉 [QuestBlueprintManager] ${player.name} leveled up to Lv${player.level} (${newTitle})`);
            }
        }

        if (data.rewardMoney > 0) {
            player.money += data.rewardMoney;
        }

        // 發放道具獎勵
        if (data.rewardItems && data.rewardItems.length > 0) {
            data.rewardItems.forEach((reward: any) => {
                for (let i = 0; i < reward.quantity; i++) {
                    const item = new Item();
                    item.id = reward.itemId;
                    item.name = reward.itemId; // 簡化：使用 itemId 作為名稱
                    item.type = "consumable";
                    item.value = 0;
                    player.inventory.push(item);
                }
            });
        }

        // 記錄已完成
        const completedIds = this.playerCompleted.get(player.firebaseUid) || [];
        if (!completedIds.includes(state.blueprintId)) {
            completedIds.push(state.blueprintId);
            this.playerCompleted.set(player.firebaseUid, completedIds);
        }

        console.log(`🎉 [QuestBlueprintManager] ${player.name} completed quest: ${questName} (+${data.rewardXp}XP, +$${data.rewardMoney})`);

        // 發送完成消息
        client.send("bpQuestComplete", {
            questName,
            rewardXp: data.rewardXp,
            rewardMoney: data.rewardMoney,
            rewardItems: data.rewardItems,
        });

        client.send("notification", `任務完成！${questName} (+$${data.rewardMoney}, +${data.rewardXp}XP)`);

        // 清除玩家任務狀態
        this.playerStates.delete(player.sessionId);
        player.activeBlueprintId = "";
        player.activeBlueprintName = "";
        player.activeTaskType = "";
        player.activeTaskTarget = "";
        player.activeTaskDesc = "";
        player.activeTaskCurrent = 0;
        player.activeTaskRequired = 0;
    }

    /**
     * 玩家確認對話（點擊繼續），前進到下一個節點
     */
    handleDialogueNext(client: Client, player: Player): void {
        const state = this.playerStates.get(player.sessionId);
        if (!state) return;

        this.advanceFromNode(client, player, state.currentNodeId);
    }

    /**
     * 玩家選擇選項
     */
    handleChoice(client: Client, player: Player, optionIndex: number): void {
        const state = this.playerStates.get(player.sessionId);
        if (!state) return;

        const blueprint = this.blueprints.get(state.blueprintId);
        if (!blueprint) return;

        const currentNode = blueprint.nodes.find((n: IQuestBlueprintNode) => n.id === state.currentNodeId);
        if (!currentNode || currentNode.type !== 'choice') return;

        const data = currentNode.data as IChoiceNodeData;
        if (optionIndex < 0 || optionIndex >= data.options.length) return;

        const selectedOption = data.options[optionIndex];
        console.log(`📋 [QuestBlueprintManager] ${player.name} chose option ${optionIndex}: ${selectedOption.textZh}`);

        // 用 targetHandleId 找到對應的邊
        this.advanceFromNode(client, player, currentNode.id, selectedOption.targetHandleId);
    }

    /**
     * 更新任務進度（擊殺敵人時）
     * 返回 true 如果任務進度有更新
     */
    updateKillProgress(client: Client, player: Player, enemyId: string, enemyTemplateId?: string): boolean {
        const state = this.playerStates.get(player.sessionId);
        if (!state) return false;

        const blueprint = this.blueprints.get(state.blueprintId);
        if (!blueprint) return false;

        const currentNode = blueprint.nodes.find((n: IQuestBlueprintNode) => n.id === state.currentNodeId);
        if (!currentNode || currentNode.type !== 'task') return false;

        const data = currentNode.data as ITaskNodeData;
        if (data.taskType !== 'kill') return false;

        // 檢查目標是否匹配（用 includes 允許部分匹配）
        const targetMatches = enemyId.includes(data.targetId) ||
            (enemyTemplateId && enemyTemplateId.includes(data.targetId));
        if (!targetMatches) return false;

        state.taskProgress++;
        player.activeTaskCurrent = state.taskProgress;

        console.log(`📋 [QuestBlueprintManager] Kill progress: ${state.taskProgress}/${data.requiredCount}`);

        client.send("bpQuestTaskProgress", {
            current: state.taskProgress,
            required: data.requiredCount,
        });

        if (state.taskProgress >= data.requiredCount) {
            // 任務目標達成，前進到下一個節點
            client.send("notification", "任務目標達成！");
            player.activeTaskCurrent = data.requiredCount;

            // 清除任務追蹤字段
            player.activeTaskType = "";
            player.activeTaskTarget = "";
            player.activeTaskDesc = "";

            this.advanceFromNode(client, player, currentNode.id);
        } else {
            client.send("notification", `任務進度: ${state.taskProgress}/${data.requiredCount}`);
        }

        return true;
    }

    /**
     * 更新收集進度
     */
    updateCollectProgress(client: Client, player: Player, itemId: string): boolean {
        const state = this.playerStates.get(player.sessionId);
        if (!state) return false;

        const blueprint = this.blueprints.get(state.blueprintId);
        if (!blueprint) return false;

        const currentNode = blueprint.nodes.find((n: IQuestBlueprintNode) => n.id === state.currentNodeId);
        if (!currentNode || currentNode.type !== 'task') return false;

        const data = currentNode.data as ITaskNodeData;
        if (data.taskType !== 'collect' || data.targetId !== itemId) return false;

        state.taskProgress++;
        player.activeTaskCurrent = state.taskProgress;

        console.log(`📋 [QuestBlueprintManager] Collect progress: ${state.taskProgress}/${data.requiredCount}`);

        client.send("bpQuestTaskProgress", {
            current: state.taskProgress,
            required: data.requiredCount,
        });

        if (state.taskProgress >= data.requiredCount) {
            client.send("notification", "任務目標達成！");
            player.activeTaskType = "";
            player.activeTaskTarget = "";
            player.activeTaskDesc = "";
            this.advanceFromNode(client, player, currentNode.id);
        } else {
            client.send("notification", `收集進度: ${state.taskProgress}/${data.requiredCount}`);
        }

        return true;
    }

    /**
     * 放棄任務
     */
    abandonQuest(client: Client, player: Player): boolean {
        const state = this.playerStates.get(player.sessionId);
        if (!state) {
            client.send("notification", "你沒有進行中的藍圖任務！");
            return false;
        }

        const blueprint = this.blueprints.get(state.blueprintId);
        const questName = blueprint?.name || "未知任務";

        // 清除所有狀態
        this.playerStates.delete(player.sessionId);
        player.activeBlueprintId = "";
        player.activeBlueprintName = "";
        player.activeTaskType = "";
        player.activeTaskTarget = "";
        player.activeTaskDesc = "";
        player.activeTaskCurrent = 0;
        player.activeTaskRequired = 0;

        client.send("notification", `已放棄任務: ${questName}`);
        client.send("bpQuestAbandoned", {});
        console.log(`❌ [QuestBlueprintManager] ${player.name} abandoned quest: ${questName}`);

        return true;
    }

    /**
     * 獲取藍圖名稱
     */
    getBlueprintName(blueprintId: string): string {
        return this.blueprints.get(blueprintId)?.name || "";
    }

    /**
     * 獲取所有藍圖
     */
    getAllBlueprints(): Map<string, IQuestBlueprint> {
        return this.blueprints;
    }
}
