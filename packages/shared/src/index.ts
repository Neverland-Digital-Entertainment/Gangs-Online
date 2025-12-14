
import { Schema, type } from "@colyseus/schema";

// Input sent from Client to Server
export interface IPlayerInput {
    x: number;
    z: number; // In 3D space, we move on X and Z
}

// Player Roles (Based on GDD)
export type PlayerRole = 'citizen' | 'triad' | 'police';

// Entity Type
export type EntityType = 'player' | 'enemy';

// Base Entity Data (for both players and enemies)
export interface IEntityData {
    id: string;
    x: number;
    z: number;
    hp: number;
    maxHp: number;
    name: string;
    type: EntityType;
}

// Player Data Structure for Sync (Colyseus Schema)
export class PlayerData extends Schema implements IEntityData {
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
    @type("string") inCombatWith: string = ""; // sessionId of player target, empty = not in PvP combat
    @type("string") inCombatWithEnemy: string = ""; // enemyId target, empty = not in PvE combat (0.7.1)

    // Progression System (Phase 7)
    @type("number") level: number = 1;
    @type("number") xp: number = 0;
    @type("number") maxXp: number = 100;
}

// Enemy Data (for PVE)
export interface IEnemyData extends IEntityData {
    state: 'idle' | 'chase' | 'attack';
}

// Game Constants
export const GAME_CONSTANTS = {
    MAP_WIDTH: 100,
    MAP_HEIGHT: 100,
    PLAYER_SPEED: 0.2,
    ATTACK_RANGE: 3.0, // Meters
    ATTACK_DAMAGE: 10,
    ATTACK_INTERVAL: 1000, // Milliseconds between auto-attacks

    // Enemy/PVE Constants
    ENEMY_SPEED: 0.1, // Slower than players
    ENEMY_DETECT_RANGE: 10.0, // Aggro range
    ENEMY_SPAWN_COUNT: 10,
    ENEMY_ATTACK_DAMAGE: 5,
    ENEMY_ATTACK_CHANCE: 0.02, // 2% chance per tick to attack

    // Progression System (Phase 7)
    XP_PER_KILL: 50, // XP awarded for killing an enemy
    BASE_XP_TO_LEVEL: 100, // Base XP required to reach level 2
    XP_SCALING_FACTOR: 1.5, // Each level requires 1.5x more XP
    HP_PER_LEVEL: 20 // HP bonus per level
};

/**
 * 根據等級獲取三合會頭銜
 * @param level 玩家等級
 * @returns 對應的頭銜
 */
export const getRankTitle = (level: number): string => {
    if (level >= 10) return "紅棍 (Red Pole)";
    if (level >= 6) return "草鞋 (Straw Sandal)";
    if (level >= 3) return "四九 (49)";
    return "藍燈籠 (Blue Lantern)";
};

/**
 * 遊戲版本（0.7.1）
 */
export const GAME_VERSION = "0.7.1";
