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
 * Enemy Schema for PVE System (Phase 9: 也用於 NPC, Phase 14: 擴展 NPC 類型, Phase 16-2: 支援自定義模型)
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
}

/**
 * Game State - 包含所有玩家、敵人和戰利品 (Phase 8)
 */
export class GameState extends Schema {
    @type({ map: Player }) players = new MapSchema<Player>();
    @type({ map: Enemy }) enemies = new MapSchema<Enemy>();
    @type({ map: Loot }) lootItems = new MapSchema<Loot>();
}
