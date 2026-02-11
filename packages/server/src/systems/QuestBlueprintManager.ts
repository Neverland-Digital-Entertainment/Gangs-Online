/**
 * Quest Blueprint Manager (Phase 20)
 *
 * 負責：
 * 1. 從 Firebase 載入任務藍圖
 * 2. 根據 Start 節點的 positionX/positionZ 生成任務 NPC
 * 3. 解析節點圖並執行任務邏輯
 * 4. 追蹤每位玩家的任務進度
 * 5. 處理對話、選擇、任務目標、條件、動作等
 */
import { Client } from "colyseus";
import { Player, Item } from "../rooms/schema/GameState";
import {
    IQuestBlueprint, IQuestBlueprintNode, IQuestBlueprintEdge,
    IStartNodeData, IDialogueNodeData, IChoiceNodeData,
    ITaskNodeData, IConditionNodeData, IActionNodeData, IEndNodeData,
    QuestNodeType, getRankTitle
} from "@gangs-online/shared";
import { getFirestore } from "../services/FirebaseService";
import { npcService } from "../services/NPCService";

/**
 * 每位玩家的藍圖任務運行時狀態
 */
interface PlayerQuestState {
    blueprintId: string;
    currentNodeId: string;
    taskProgress: number;
    variables: Record<string, string>;
}

export class QuestBlueprintManager {
    private blueprints: Map<string, IQuestBlueprint> = new Map();
    // 以 sessionId 為 key 的玩家任務狀態
    private playerStates: Map<string, PlayerQuestState> = new Map();
    // 以 firebaseUid 為 key 的已完成任務
    private playerCompleted: Map<string, string[]> = new Map();
    // 藍圖生成的任務 NPC ID → NPC 模板 ID（用於 interact 時查找）
    private questNpcTemplateMap: Map<string, string> = new Map();

    /**
     * 初始化：從 Firebase 載入所有啟用的任務藍圖
     */
    async initialize(): Promise<void> {
        const db = getFirestore();
        if (!db) {
            console.warn("⚠️ [QBM] Firebase not initialized, skipping blueprint load");
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

            console.log(`✅ [QBM] Loaded ${this.blueprints.size} active quest blueprints`);
            this.blueprints.forEach((bp, id) => {
                const startNode = bp.nodes.find((n: IQuestBlueprintNode) => n.type === 'start');
                const startData = startNode?.data as IStartNodeData | undefined;
                console.log(`  📋 ${id}: "${bp.name}" (${bp.nodes.length} nodes, ${bp.edges.length} edges) → NPC: ${startData?.npcTemplateId || 'none'}, pos: (${startData?.positionX ?? 'N/A'}, ${startData?.positionZ ?? 'N/A'})`);
            });
        } catch (error) {
            console.error("❌ [QBM] Failed to load blueprints:", error);
        }
    }

    /**
     * 生成所有藍圖的任務 NPC（在 NPCManager 初始化後調用）
     * @param npcManager 用於生成 NPC
     */
    spawnQuestNPCs(npcManager: any): void {
        console.log(`📋 [QBM] Spawning quest NPCs for ${this.blueprints.size} blueprints...`);

        for (const [bpId, bp] of this.blueprints) {
            const startNode = bp.nodes.find((n: IQuestBlueprintNode) => n.type === 'start');
            if (!startNode) {
                console.warn(`  ⚠️ [QBM] Blueprint "${bp.name}" (${bpId}) has no start node, skipping`);
                continue;
            }

            const startData = startNode.data as IStartNodeData;
            const templateId = startData.npcTemplateId;
            const posX = startData.positionX;
            const posZ = startData.positionZ;

            if (!templateId) {
                console.warn(`  ⚠️ [QBM] Blueprint "${bp.name}" start node has no npcTemplateId, skipping`);
                continue;
            }

            if (posX === undefined || posZ === undefined || (posX === 0 && posZ === 0)) {
                console.warn(`  ⚠️ [QBM] Blueprint "${bp.name}" start node has no position (${posX}, ${posZ}), skipping NPC spawn`);
                continue;
            }

            // 從 NPC 模板獲取名稱和模型
            const template = npcService.getTemplate(templateId);
            const npcName = template ? template.name : templateId;
            const modelId = template?.modelId || "";

            // 生成唯一的 NPC ID
            const questNpcId = `quest_npc_${bpId}`;

            // 使用 NPCManager 生成任務 NPC
            npcManager.spawnQuestNPC(questNpcId, posX, posZ, npcName);

            // 記錄映射：NPC ID → 模板 ID
            this.questNpcTemplateMap.set(questNpcId, templateId);

            console.log(`  ✅ [QBM] Spawned quest NPC "${npcName}" (template: ${templateId}) at (${posX.toFixed(1)}, ${posZ.toFixed(1)}) for quest "${bp.name}"`);
        }

        console.log(`✅ [QBM] Quest NPC spawning complete. Total quest NPCs: ${this.questNpcTemplateMap.size}`);
    }

    /**
     * 獲取藍圖生成的任務 NPC 的模板 ID
     * 用於 interact handler 查找 NPC 對應的模板
     */
    getQuestNPCTemplateId(npcId: string): string | undefined {
        return this.questNpcTemplateMap.get(npcId);
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
     * 檢查是否可以恢復已保存的任務狀態
     * 只有 task 節點（有進度追蹤）才能有意義地恢復
     * 對話、選擇、條件等節點的 UI 狀態在斷線後已丟失，無法恢復
     */
    canRestoreState(blueprintId: string, currentNodeId: string): boolean {
        const blueprint = this.blueprints.get(blueprintId);
        if (!blueprint) {
            console.log(`[QBM] canRestore: blueprint ${blueprintId} not found`);
            return false;
        }

        if (!currentNodeId) {
            console.log(`[QBM] canRestore: no currentNodeId`);
            return false;
        }

        const node = blueprint.nodes.find((n: IQuestBlueprintNode) => n.id === currentNodeId);
        if (!node) {
            console.log(`[QBM] canRestore: node ${currentNodeId} not found in blueprint`);
            return false;
        }

        // 只有 task 節點可以恢復（有進度追蹤的任務）
        const canRestore = node.type === 'task';
        console.log(`[QBM] canRestore: node ${currentNodeId} is type "${node.type}" → ${canRestore ? 'YES' : 'NO'}`);
        return canRestore;
    }

    /**
     * 檢查某個 NPC 是否有可接任務
     * 返回 { blueprintId, reason }
     */
    getAvailableQuestForNPC(npcTemplateId: string, player: Player): { blueprintId: string | null; reason: string } {
        const completedIds = this.playerCompleted.get(player.firebaseUid) || [];
        const currentState = this.playerStates.get(player.sessionId);

        console.log(`📋 [QBM] getAvailableQuest: template=${npcTemplateId}, uid=${player.firebaseUid || 'none'}, session=${player.sessionId}, completed=[${completedIds.join(',')}], hasActiveState=${!!currentState}`);

        let lastReason = `no blueprint matched template "${npcTemplateId}" (total: ${this.blueprints.size})`;

        for (const [bpId, bp] of this.blueprints) {
            // 跳過已完成的任務
            if (completedIds.includes(bpId)) {
                lastReason = `${bpId} already completed`;
                console.log(`  📋 Skip ${bpId}: already completed`);
                continue;
            }

            // 跳過正在進行的任務
            if (currentState && currentState.blueprintId === bpId) {
                lastReason = `${bpId} already in progress (node: ${currentState.currentNodeId})`;
                console.log(`  📋 Skip ${bpId}: already in progress (node: ${currentState.currentNodeId})`);
                continue;
            }

            // 找到 Start 節點
            const startNode = bp.nodes.find((n: IQuestBlueprintNode) => n.type === 'start');
            if (!startNode) {
                lastReason = `${bpId} has no start node`;
                continue;
            }

            const startData = startNode.data as IStartNodeData;

            // 檢查 NPC 模板 ID 是否匹配
            if (startData.npcTemplateId !== npcTemplateId) {
                console.log(`  📋 Skip ${bpId}: template mismatch (blueprint="${startData.npcTemplateId}" vs query="${npcTemplateId}")`);
                lastReason = `${bpId} template mismatch: "${startData.npcTemplateId}" vs "${npcTemplateId}"`;
                continue;
            }

            // 檢查等級限制
            if (startData.minLevel && player.level < startData.minLevel) {
                lastReason = `${bpId} level too low (${player.level} < ${startData.minLevel})`;
                console.log(`  📋 Skip ${bpId}: ${lastReason}`);
                continue;
            }
            if (startData.maxLevel && player.level > startData.maxLevel) {
                lastReason = `${bpId} level too high (${player.level} > ${startData.maxLevel})`;
                console.log(`  📋 Skip ${bpId}: ${lastReason}`);
                continue;
            }

            // 檢查前置任務
            if (startData.prerequisiteQuestId && !completedIds.includes(startData.prerequisiteQuestId)) {
                lastReason = `${bpId} prerequisite "${startData.prerequisiteQuestId}" not completed`;
                console.log(`  📋 Skip ${bpId}: ${lastReason}`);
                continue;
            }

            console.log(`  📋 Found available: ${bpId} ("${bp.name}")`);
            return { blueprintId: bpId, reason: "found" };
        }

        console.log(`  📋 No available quest: ${lastReason}`);
        return { blueprintId: null, reason: lastReason };
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
            console.error(`[QBM] Blueprint ${blueprintId} has no start node`);
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

        console.log(`📋 [QBM] ${player.name} started quest: ${blueprint.name}`);
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
            edge = blueprint.edges.find((e: IQuestBlueprintEdge) =>
                e.source === fromNodeId && e.sourceHandle === sourceHandle
            );
        } else {
            edge = blueprint.edges.find((e: IQuestBlueprintEdge) => e.source === fromNodeId);
        }

        if (!edge) {
            console.log(`📋 [QBM] Dead end: no edge from node ${fromNodeId} (handle: ${sourceHandle || 'default'})`);
            // 死路：清除任務狀態，讓玩家可以重新接任務
            this.playerStates.delete(player.sessionId);
            // 清除 Player schema 上的任務欄位
            player.activeBlueprintId = "";
            player.activeBlueprintName = "";
            player.activeTaskType = "";
            player.activeTaskTarget = "";
            player.activeTaskDesc = "";
            player.activeTaskCurrent = 0;
            player.activeTaskRequired = 0;
            client.send("bpQuestDeadEnd", {});
            return;
        }

        const nextNode = blueprint.nodes.find((n: IQuestBlueprintNode) => n.id === edge!.target);
        if (!nextNode) {
            console.error(`[QBM] Target node ${edge.target} not found in blueprint`);
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

        console.log(`📋 [QBM] Processing: ${node.type} node (${node.id})`);

        switch (node.type) {
            case 'start':
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
     * 處理對話節點
     */
    private handleDialogueNode(client: Client, player: Player, node: IQuestBlueprintNode): void {
        const data = node.data as IDialogueNodeData;

        // 用 speakerId 查找 NPC 名稱
        const template = npcService.getTemplate(data.speakerId);
        const npcName = template?.name || data.speakerId || "NPC";

        client.send("bpQuestDialogue", {
            npcName,
            speaker: data.speakerId,
            expression: data.expression || "",
            text: data.textZh || data.textEn || "",
        });
    }

    /**
     * 處理選擇節點
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
            options,
        });
    }

    /**
     * 處理任務目標節點
     */
    private handleTaskNode(client: Client, player: Player, node: IQuestBlueprintNode): void {
        const data = node.data as ITaskNodeData;
        const state = this.playerStates.get(player.sessionId);
        if (!state) return;

        state.taskProgress = 0;

        player.activeTaskType = data.taskType;
        player.activeTaskTarget = data.targetId;
        player.activeTaskDesc = data.description || `${data.taskType}: ${data.targetId}`;
        player.activeTaskCurrent = 0;
        player.activeTaskRequired = data.requiredCount;

        console.log(`📋 [QBM] Task started: ${data.taskType} ${data.targetId} x${data.requiredCount}`);

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
     * 處理條件節點
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
                let count = 0;
                for (let i = 0; i < player.inventory.length; i++) {
                    const item = player.inventory.at(i);
                    if (item && item.id === data.targetId) count++;
                }
                conditionMet = count >= data.requiredAmount;
                break;
            }
            case 'variable': {
                const varValue = state.variables[data.targetId || ""];
                conditionMet = varValue !== undefined && parseInt(varValue) >= data.requiredAmount;
                break;
            }
        }

        console.log(`📋 [QBM] Condition: ${data.conditionType} ${data.targetId || ''} >= ${data.requiredAmount} → ${conditionMet}`);

        const handle = conditionMet ? 'success' : 'fail';
        this.advanceFromNode(client, player, node.id, handle);
    }

    /**
     * 處理動作節點
     */
    private handleActionNode(client: Client, player: Player, node: IQuestBlueprintNode): void {
        const data = node.data as IActionNodeData;
        const state = this.playerStates.get(player.sessionId);
        if (!state) return;

        switch (data.actionType) {
            case 'remove_item': {
                let toRemove = data.amount || 1;
                for (let i = player.inventory.length - 1; i >= 0 && toRemove > 0; i--) {
                    const item = player.inventory.at(i);
                    if (item && item.id === data.targetId) {
                        player.inventory.deleteAt(i);
                        toRemove--;
                    }
                }
                break;
            }
            case 'remove_money':
                player.money = Math.max(0, player.money - (data.amount || 0));
                break;
            case 'spawn_npc':
                console.log(`📋 [QBM] spawn_npc not yet implemented`);
                break;
            case 'set_variable':
                state.variables[data.targetId || ""] = data.value || "";
                console.log(`📋 [QBM] Set variable: ${data.targetId} = ${data.value}`);
                break;
        }

        this.advanceFromNode(client, player, node.id);
    }

    /**
     * 處理結束節點
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
            if (player.xp >= player.maxXp) {
                player.xp -= player.maxXp;
                player.level++;
                player.maxXp = Math.floor(player.maxXp * 1.5);
                player.maxHp += 20;
                player.hp = player.maxHp;
                const newTitle = getRankTitle(player.level);
                console.log(`🎉 [QBM] ${player.name} leveled up to Lv${player.level} (${newTitle})`);
            }
        }

        if (data.rewardMoney > 0) {
            player.money += data.rewardMoney;
        }

        if (data.rewardItems && data.rewardItems.length > 0) {
            data.rewardItems.forEach((reward: any) => {
                for (let i = 0; i < reward.quantity; i++) {
                    const item = new Item();
                    item.id = reward.itemId;
                    item.name = reward.itemId;
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

        console.log(`🎉 [QBM] ${player.name} completed: ${questName} (+${data.rewardXp}XP, +$${data.rewardMoney})`);

        client.send("bpQuestComplete", {
            questName,
            rewardXp: data.rewardXp,
            rewardMoney: data.rewardMoney,
            rewardItems: data.rewardItems,
        });

        client.send("notification", `任務完成！${questName} (+$${data.rewardMoney}, +${data.rewardXp}XP)`);

        // 清除狀態
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
     * 玩家確認對話，前進到下一個節點
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
        console.log(`📋 [QBM] ${player.name} chose: ${selectedOption.textZh}`);

        this.advanceFromNode(client, player, currentNode.id, selectedOption.targetHandleId);
    }

    /**
     * 更新擊殺進度
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

        const targetMatches = enemyId.includes(data.targetId) ||
            (enemyTemplateId && enemyTemplateId.includes(data.targetId));
        if (!targetMatches) return false;

        state.taskProgress++;
        player.activeTaskCurrent = state.taskProgress;

        client.send("bpQuestTaskProgress", {
            current: state.taskProgress,
            required: data.requiredCount,
        });

        if (state.taskProgress >= data.requiredCount) {
            client.send("notification", "任務目標達成！");
            player.activeTaskCurrent = data.requiredCount;
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
        console.log(`❌ [QBM] ${player.name} abandoned: ${questName}`);

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
