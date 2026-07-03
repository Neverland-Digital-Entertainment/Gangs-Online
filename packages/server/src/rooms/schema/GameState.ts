import { Schema, MapSchema, ArraySchema, type } from "@colyseus/schema";
import { IEnemyData, ILootData, IItem, IQuestState, EntityType, ItemType, PlayerRole, NPCType } from "@gangs-online/shared";

/**
 * Item Schema (Phase 8)
 */
export class Item extends Schema implements IItem {
    @type("string") id: string = "";
    @type("string") name: string = "";
    @type("string") type: ItemType = "consumable";
    @type("number") value: number = 0;

    // Phase 21: 武器升級系統
    @type("string") baseId: string = "";      // 靜態定義 ID（如 weapon_tang_sword / enhance_stone）
    @type("number") enhanceLevel: number = 0; // 武器強化等級 +0 ~ +15
    @type("number") failCount: number = 0;    // 連續強化失敗次數（保底用）
}

/**
 * Quest Schema (Phase 10: Dynamic Quest State)
 */
export class Quest extends Schema implements IQuestState {
    @type("string") id: string = "";
    @type("string") name: string = "";
    @type("string") description: string = "";
    @type("number") currentCount: number = 0;
    @type("number") requiredCount: number = 0;
    @type("boolean") completed: boolean = false;
    @type("number") rewardXp: number = 0;
    @type("number") rewardMoney: number = 0;
}

/**
 * Player Schema (Complete definition - not extending from shared due to ESM/CJS compatibility)
 */
export class Player extends Schema {
    @type("string") id: string = "";
    @type("string") sessionId: string = "";
    @type("string") firebaseUid: string = ""; // Phase 12: Firebase User ID for persistence
    @type("number") x: number = 0;
    @type("number") y: number = 0;
    @type("number") z: number = 0;
    @type("string") role: PlayerRole = 'citizen';
    @type("number") hp: number = 100;
    @type("number") maxHp: number = 100;
    @type("string") name: string = "";
    @type("string") type: EntityType = "player";
    @type("string") inCombatWith: string = "";
    @type("string") inCombatWithEnemy: string = "";

    // Progression System (Phase 7)
    @type("number") level: number = 1;
    @type("number") xp: number = 0;
    @type("number") maxXp: number = 100;

    // Inventory System (Phase 8)
    @type("number") money: number = 0;
    @type([Item]) inventory = new ArraySchema<Item>();

    // Quest System (Phase 10)
    @type(Quest) activeQuest: Quest | null = null;

    // Guild System (Phase 13)
    @type("string") guildId: string = "";
    @type("string") guildName: string = "";

    // Evil Value & Prison System (Phase 14)
    @type("number") evilValue: number = 0; // 罪惡值 (0-3)
    @type("boolean") inPrison: boolean = false; // 是否在監獄中
    @type("number") prisonReleaseTime: number = 0; // 釋放時間戳

    // Phase 21: 武器升級系統（裝備中武器的攻擊加成）
    @type("number") attackBonus: number = 0;
    @type("number") equippedWeaponIndex: number = -1; // 背包 index，-1 = 未裝備
    @type("string") equippedWeaponName: string = "";

    // Phase 21: 社團系統擴展
    @type("string") societyRole: string = ""; // 話事人/坐館/紅棍/白紙扇/草鞋/四九仔
    @type("number") contribution: number = 0; // 可用貢獻度

    // Phase 21: 組隊系統
    @type("string") partyId: string = "";

    // Blueprint Quest System (Phase 20)
    @type("string") activeBlueprintId: string = ""; // 當前藍圖任務 ID
    @type("string") activeBlueprintName: string = ""; // 當前任務名稱
    @type("string") activeTaskType: string = ""; // 當前任務目標類型 (kill/collect/interact/location)
    @type("string") activeTaskTarget: string = ""; // 當前目標 ID
    @type("string") activeTaskDesc: string = ""; // 當前任務描述
    @type("number") activeTaskCurrent: number = 0; // 當前進度
    @type("number") activeTaskRequired: number = 0; // 需要數量
}

/**
 * Loot Schema (Phase 8)
 */
export class Loot extends Schema implements ILootData {
    @type("string") id: string = "";
    @type("number") x: number = 0;
    @type("number") z: number = 0;
    @type(Item) item: Item = new Item();
}

/**
 * Enemy Schema for PVE System (Phase 9: 也用於 NPC, Phase 14: 擴展 NPC 類型, Phase 16-2: 支援自定義模型與對話樹)
 */
export class Enemy extends Schema implements IEnemyData {
    @type("string") id: string = "";
    @type("number") x: number = 0;
    @type("number") z: number = 0;
    @type("number") hp: number = 50;
    @type("number") maxHp: number = 50;
    @type("string") name: string = "街頭混混";
    @type("string") state: 'idle' | 'chase' | 'attack' = "idle";
    @type("string") type: EntityType = "enemy"; // Phase 9: 可以是 'enemy' 或 'npc'
    @type("string") npcType: NPCType = "gangs"; // Phase 14: NPC 類型 (citizen, police, gangs, shop, quest)
    @type("number") attack: number = 5; // Phase 14: 攻擊力
    @type("string") modelId: string = ""; // Phase 16-2: 自定義模型 ID，空字串時使用預設模型
    @type("string") dialogueTreeJson: string = ""; // Phase 16-2: 對話樹 JSON（序列化的 DialogueTree）
    @type("string") linkedShopId: string = ""; // Phase 16-3: 關聯商店 ID

    // Phase 21: 佔領地盤系統（守衛）
    @type("string") territoryId: string = "";   // 所屬地盤 ID（非守衛為空）
    @type("number") guardLevel: number = 0;     // 守衛等級 1~10（非守衛為 0）
    @type("string") ownerGuildId: string = "";  // 守衛所屬社團 ID
    @type("string") ownerGuildName: string = "";
}

/**
 * Game State - 包含所有玩家、敵人和戰利品 (Phase 8)
 */
export class GameState extends Schema {
    @type({ map: Player }) players = new MapSchema<Player>();
    @type({ map: Enemy }) enemies = new MapSchema<Enemy>();
    @type({ map: Loot }) lootItems = new MapSchema<Loot>();
}
