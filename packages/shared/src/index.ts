// Input sent from Client to Server
export interface IPlayerInput {
    x: number;
    z: number;
}

export type PlayerRole = 'citizen' | 'triad' | 'police';

export interface IEntityData {
    id: string;
    x: number;
    z: number;
    hp: number;
    maxHp: number;
    name: string;
    type: 'player' | 'enemy';
}

// Player extends Entity
export interface IPlayerData extends IEntityData {
    sessionId: string;
    role: PlayerRole;
}

// Enemy extends Entity
export interface IEnemyData extends IEntityData {
    state: 'idle' | 'chase' | 'attack';
}

export const GAME_CONSTANTS = {
    MAP_WIDTH: 100,
    MAP_HEIGHT: 100,
    PLAYER_SPEED: 0.15,
    ENEMY_SPEED: 0.1, // Slower than players
    ATTACK_RANGE: 2.0,
    ATTACK_DAMAGE: 10,
    ENEMY_DETECT_RANGE: 10.0, // Aggro range
    ENEMY_SPAWN_COUNT: 10
};
