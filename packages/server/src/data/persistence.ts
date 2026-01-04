/**
 * Player Persistence Module (Phase 12: Firebase Persistence & Auth)
 * 負責玩家資料的儲存和載入
 */
import { Player, Item, Quest } from "../rooms/schema/GameState";
import { IQuestDef } from "@gangs-online/shared";
import { getFirestore, getFieldValue, isFirebaseInitialized } from "../services/FirebaseService";

/**
 * 儲存玩家資料到 Firebase
 * @param player 玩家物件
 * @param firebaseUid Firebase 用戶 ID
 */
export const savePlayer = async (player: Player, firebaseUid: string): Promise<boolean> => {
    const db = getFirestore();
    if (!db) {
        console.warn("[Persistence] Firebase not initialized, skip save.");
        return false;
    }

    // 序列化背包 (過濾掉 undefined 值)
    const inventory = Array.from(player.inventory)
        .filter((item): item is Item => item !== undefined)
        .map((item) => ({
            id: item.id,
            name: item.name,
            type: item.type,
            value: item.value
        }));

    // 序列化任務
    let activeQuest: any = null;
    if (player.activeQuest) {
        activeQuest = {
            id: player.activeQuest.id,
            currentCount: player.activeQuest.currentCount,
            completed: player.activeQuest.completed
        };
    }

    const saveData = {
        name: player.name,
        level: player.level,
        xp: player.xp,
        maxXp: player.maxXp,
        money: player.money,
        maxHp: player.maxHp,
        x: player.x,
        z: player.z,
        inventory: inventory,
        activeQuest: activeQuest,
        // Phase 13: Guild data
        guildId: player.guildId || "",
        guildName: player.guildName || "",
        lastOnline: getFieldValue().serverTimestamp()
    };

    try {
        await db.collection("players").doc(firebaseUid).set(saveData, { merge: true });
        console.log(`[Persistence] Saved player ${player.name} (${firebaseUid})`);
        return true;
    } catch (error) {
        console.error("[Persistence] Save failed:", error);
        return false;
    }
};

/**
 * 從 Firebase 載入玩家資料
 * @param player 要填充資料的玩家物件
 * @param firebaseUid Firebase 用戶 ID
 * @param questDefs 任務定義（用於還原任務）
 * @returns 是否成功載入已存在的資料
 */
export const loadPlayer = async (
    player: Player,
    firebaseUid: string,
    questDefs: Map<string, IQuestDef>
): Promise<boolean> => {
    const db = getFirestore();
    if (!db) {
        console.warn("[Persistence] Firebase not initialized, skip load.");
        return false;
    }

    try {
        const doc = await db.collection("players").doc(firebaseUid).get();

        if (doc.exists) {
            const saved = doc.data() as any;
            console.log(`[Persistence] Restoring player ${saved.name}...`);

            // 還原基本屬性
            player.name = saved.name || player.name;
            player.level = saved.level ?? 1;
            player.xp = saved.xp ?? 0;
            player.maxXp = saved.maxXp ?? 100;
            player.money = saved.money ?? 0;
            player.maxHp = saved.maxHp ?? 100;
            player.hp = saved.maxHp ?? 100; // 登入時恢復滿血
            player.x = saved.x ?? 0;
            player.z = saved.z ?? 0;

            // 還原背包
            if (saved.inventory && Array.isArray(saved.inventory)) {
                saved.inventory.forEach((itemData: any) => {
                    const item = new Item();
                    item.id = itemData.id;
                    item.name = itemData.name;
                    item.type = itemData.type;
                    item.value = itemData.value;
                    player.inventory.push(item);
                });
            }

            // 還原任務
            if (saved.activeQuest && saved.activeQuest.id) {
                const questDef = questDefs.get(saved.activeQuest.id);
                if (questDef) {
                    const quest = new Quest();
                    quest.id = questDef.id;
                    quest.name = questDef.name;
                    quest.description = questDef.description;
                    quest.requiredCount = questDef.requiredCount;
                    quest.rewardXp = questDef.reward.xp;
                    quest.rewardMoney = questDef.reward.money;
                    quest.currentCount = saved.activeQuest.currentCount ?? 0;
                    quest.completed = saved.activeQuest.completed ?? false;
                    player.activeQuest = quest;
                }
            }

            // Phase 13: 還原幫會資料
            player.guildId = saved.guildId || "";
            player.guildName = saved.guildName || "";

            console.log(`[Persistence] Player ${saved.name} restored successfully.`);
            return true;
        } else {
            console.log(`[Persistence] No saved data for ${firebaseUid}, creating new player.`);
            return false;
        }
    } catch (error) {
        console.error("[Persistence] Load failed:", error);
        return false;
    }
};

/**
 * 檢查持久化系統是否可用
 */
export const isPersistenceAvailable = (): boolean => {
    return isFirebaseInitialized();
};
