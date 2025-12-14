import { Schema, MapSchema, ArraySchema, type } from "@colyseus/schema";
import { PlayerData as BasePlayerData, IEnemyData, ILootData, IItem, EntityType, ItemType, GAME_CONSTANTS } from "@gangs-online/shared";

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
 * Player Schema (Extended for Phase 8 Inventory)
 */
export class PlayerData extends BasePlayerData {
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
 * Enemy Schema for PVE System
 */
export class Enemy extends Schema implements IEnemyData {
    @type("string") id: string = "";
    @type("number") x: number = 0;
    @type("number") z: number = 0;
    @type("number") hp: number = 50;
    @type("number") maxHp: number = 50;
    @type("string") name: string = "街頭混混";
    @type("string") state: 'idle' | 'chase' | 'attack' = "idle";
    @type("string") type: EntityType = "enemy";
}

/**
 * Game State - 包含所有玩家、敵人和戰利品 (Phase 8)
 */
export class GameState extends Schema {
    @type({ map: PlayerData }) players = new MapSchema<PlayerData>();
    @type({ map: Enemy }) enemies = new MapSchema<Enemy>();
    @type({ map: Loot }) lootItems = new MapSchema<Loot>();
}

export { PlayerData as Player };
