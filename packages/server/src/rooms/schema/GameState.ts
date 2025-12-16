import { Schema, MapSchema, ArraySchema, type } from "@colyseus/schema";
import { IEnemyData, ILootData, IItem, EntityType, ItemType, PlayerRole } from "@gangs-online/shared";

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
 * Player Schema (Complete definition - not extending from shared due to ESM/CJS compatibility)
 */
export class Player extends Schema {
    @type("string") id: string = "";
    @type("string") sessionId: string = "";
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
 * Enemy Schema for PVE System (Phase 9: 也用於 NPC)
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
}

/**
 * Game State - 包含所有玩家、敵人和戰利品 (Phase 8)
 */
export class GameState extends Schema {
    @type({ map: Player }) players = new MapSchema<Player>();
    @type({ map: Enemy }) enemies = new MapSchema<Enemy>();
    @type({ map: Loot }) lootItems = new MapSchema<Loot>();
}
