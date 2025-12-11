
import { Schema, type } from "@colyseus/schema";

// Input sent from Client to Server
export interface IPlayerInput {
    x: number;
    z: number; // In 3D space, we move on X and Z
}

// Player Roles (Based on GDD)
export type PlayerRole = 'citizen' | 'triad' | 'police';

// Player Data Structure for Sync (Colyseus Schema)
export class PlayerData extends Schema {
    @type("string") id: string = "";
    @type("string") sessionId: string = "";
    @type("number") x: number = 0;
    @type("number") y: number = 0;
    @type("number") z: number = 0;
    @type("string") role: PlayerRole = 'citizen';
    @type("number") hp: number = 100;
    @type("number") maxHp: number = 100;
    @type("string") name: string = "";
    @type("string") inCombatWith: string = ""; // sessionId of target, empty = not in combat
}

// Game Constants
export const GAME_CONSTANTS = {
    MAP_WIDTH: 100,
    MAP_HEIGHT: 100,
    PLAYER_SPEED: 0.2,
    ATTACK_RANGE: 3.0, // Meters
    ATTACK_DAMAGE: 10,
    ATTACK_INTERVAL: 1000 // Milliseconds between auto-attacks
};
