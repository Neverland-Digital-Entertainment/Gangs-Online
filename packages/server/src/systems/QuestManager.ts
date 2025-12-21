import { Client } from "colyseus";
import { Player, Quest } from "../rooms/schema/GameState";
import { IQuestDef, getRankTitle } from "@gangs-online/shared";
import * as fs from "fs";
import * as path from "path";

/**
 * 任務管理器 (Phase 10: Data-Driven Quest System)
 * 負責管理任務數據和處理任務邏輯
 */
export class QuestManager {
    private questDefinitions: Map<string, IQuestDef> = new Map();

    constructor() {
        this.loadQuestData();
    }

    /**
     * 從 JSON 文件加載任務數據
     */
    private loadQuestData(): void {
        try {
            const questPath = path.join(__dirname, "../data/quests.json");
            const questData = fs.readFileSync(questPath, "utf-8");
            const quests: IQuestDef[] = JSON.parse(questData);

            quests.forEach((quest) => {
                this.questDefinitions.set(quest.id, quest);
            });

            console.log(`✅ QuestManager: Loaded ${this.questDefinitions.size} quests`);
        } catch (error) {
            console.error("❌ QuestManager: Failed to load quest data:", error);
        }
    }

    /**
     * 獲取任務定義
     */
    getQuestDefinition(questId: string): IQuestDef | undefined {
        return this.questDefinitions.get(questId);
    }

    /**
     * 獲取所有任務定義
     */
    getAllQuestDefinitions(): IQuestDef[] {
        return Array.from(this.questDefinitions.values());
    }

    /**
     * 獲取第一個可接任務（沒有前置任務的）
     */
    getFirstAvailableQuest(): IQuestDef | undefined {
        // 目前返回第一個任務
        return this.questDefinitions.get("q1_first_blood");
    }

    /**
     * 接受任務
     */
    acceptQuest(client: Client, player: Player, questId: string): boolean {
        const questDef = this.questDefinitions.get(questId);

        if (!questDef) {
            client.send("notification", "找不到這個任務！");
            return false;
        }

        if (player.activeQuest) {
            client.send("notification", "你已經有進行中的任務了！");
            return false;
        }

        // 創建新的任務狀態
        const newQuest = new Quest();
        newQuest.id = questDef.id;
        newQuest.name = questDef.name;
        newQuest.description = questDef.description;
        newQuest.requiredCount = questDef.requiredCount;
        newQuest.currentCount = 0;
        newQuest.completed = false;
        newQuest.rewardXp = questDef.reward.xp;
        newQuest.rewardMoney = questDef.reward.money;

        player.activeQuest = newQuest;

        // 發送任務狀態更新消息到客戶端
        client.send("questStateUpdate", {
            id: newQuest.id,
            name: newQuest.name,
            description: newQuest.description,
            currentCount: newQuest.currentCount,
            requiredCount: newQuest.requiredCount,
            completed: newQuest.completed,
            rewardXp: newQuest.rewardXp,
            rewardMoney: newQuest.rewardMoney,
        });

        client.send("notification", `接受任務: ${questDef.name}`);
        console.log(`📋 ${player.name} accepted quest: ${questDef.name}`);

        return true;
    }

    /**
     * 更新任務進度（擊殺敵人時調用）
     */
    updateKillProgress(client: Client, player: Player, enemyId: string): void {
        if (!player.activeQuest || player.activeQuest.completed) return;

        const questDef = this.questDefinitions.get(player.activeQuest.id);
        if (!questDef || questDef.type !== "kill") return;

        // 檢查是否是目標敵人（使用 includes 允許 "mob_thug_1" 匹配 "mob_thug"）
        if (enemyId.includes(questDef.targetId)) {
            player.activeQuest.currentCount++;
            console.log(`📋 Quest progress: ${player.activeQuest.currentCount}/${player.activeQuest.requiredCount}`);

            if (player.activeQuest.currentCount >= player.activeQuest.requiredCount) {
                player.activeQuest.completed = true;
                client.send("notification", "任務目標達成！返回找浩南哥。");
                console.log(`✅ Quest completed: ${player.activeQuest.name}`);
            } else {
                client.send(
                    "notification",
                    `任務進度: ${player.activeQuest.currentCount}/${player.activeQuest.requiredCount}`
                );
            }

            // 發送任務狀態更新消息
            client.send("questStateUpdate", {
                id: player.activeQuest.id,
                name: player.activeQuest.name,
                description: player.activeQuest.description,
                currentCount: player.activeQuest.currentCount,
                requiredCount: player.activeQuest.requiredCount,
                completed: player.activeQuest.completed,
                rewardXp: player.activeQuest.rewardXp,
                rewardMoney: player.activeQuest.rewardMoney,
            });
        }
    }

    /**
     * 完成任務並領取獎勵
     */
    completeQuest(
        client: Client,
        player: Player,
        broadcast: (type: string, data: any) => void
    ): { xpGained: number; moneyGained: number; newLevel: number | null } | null {
        if (!player.activeQuest || !player.activeQuest.completed) {
            client.send("notification", "你還沒有完成任務！");
            return null;
        }

        const quest = player.activeQuest;
        const questDef = this.questDefinitions.get(quest.id);

        // 發放獎勵
        const xpGained = quest.rewardXp;
        const moneyGained = quest.rewardMoney;

        player.xp += xpGained;
        player.money += moneyGained;

        // 檢查升級
        let newLevel: number | null = null;
        if (player.xp >= player.maxXp) {
            player.xp -= player.maxXp;
            player.level++;
            player.maxXp = Math.floor(player.maxXp * 1.5);
            player.maxHp += 20;
            player.hp = player.maxHp;
            newLevel = player.level;

            const newTitle = getRankTitle(newLevel);
            broadcast("chat", {
                sessionId: "SYSTEM",
                text: `${player.name} 升職了！現在是 ${newTitle} (Lv${newLevel})`,
            });
        }

        client.send("notification", `任務完成！獲得 $${moneyGained}, ${xpGained}XP`);
        console.log(`🎉 ${player.name} completed quest: ${quest.name}`);

        // 清除當前任務
        player.activeQuest = null;

        // 發送任務清除消息
        client.send("questStateUpdate", null);

        return { xpGained, moneyGained, newLevel };
    }

    /**
     * 放棄任務
     */
    abandonQuest(client: Client, player: Player): boolean {
        if (!player.activeQuest) {
            client.send("notification", "你沒有進行中的任務！");
            return false;
        }

        const questName = player.activeQuest.name;
        player.activeQuest = null;

        // 發送任務清除消息
        client.send("questStateUpdate", null);

        client.send("notification", `已放棄任務: ${questName}`);
        console.log(`❌ ${player.name} abandoned quest: ${questName}`);

        return true;
    }
}
