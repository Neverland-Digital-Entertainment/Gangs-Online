import { Schema, MapSchema, type } from "@colyseus/schema";
import { PlayerData, IEnemyData, EntityType } from "@gangs-online/shared";

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
 * Game State - 包含所有玩家和敵人
 */
export class GameState extends Schema {
    @type({ map: PlayerData }) players = new MapSchema<PlayerData>();
    @type({ map: Enemy }) enemies = new MapSchema<Enemy>();
}

export { PlayerData as Player };
