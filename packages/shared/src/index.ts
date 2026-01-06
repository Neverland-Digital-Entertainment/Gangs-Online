
import { Schema, type } from "@colyseus/schema";

// Input sent from Client to Server
export interface IPlayerInput {
    x: number;
    z: number; // In 3D space, we move on X and Z
}

// Player Roles (Based on GDD)
export type PlayerRole = 'citizen' | 'triad' | 'police';

// ==================== Phase 13: Guild System ====================

/**
 * 幫會職位（Phase 13）
 * 目前只有龍頭和成員，預留未來擴展
 */
export type GuildRole = '龍頭' | '副幫主' | '堂主' | '護法' | '成員';

/**
 * 幫會成員資料（儲存在 Firestore，不包含 name）
 */
export interface IGuildMemberStored {
    userId: string;
    role: GuildRole;
    joinTime: number; // timestamp
}

/**
 * 幫會成員資料（返回給客戶端，包含從 players 集合取得的 name）
 */
export interface IGuildMember {
    userId: string;
    name: string; // 從 players 集合動態取得
    role: GuildRole;
    joinTime: number; // timestamp
}

/**
 * 幫會資料結構（儲存在 Firestore）
 */
export interface IGuildDataStored {
    id: string;
    name: string;
    leaderId: string;
    createdAt: number; // timestamp
    memberCount: number;
    description: string;
    members: { [userId: string]: IGuildMemberStored };
}

/**
 * 幫會資料結構（返回給客戶端，成員包含 name）
 */
export interface IGuildData {
    id: string;
    name: string;
    leaderId: string;
    createdAt: number; // timestamp
    memberCount: number;
    description: string;
    members: { [userId: string]: IGuildMember };
}

/**
 * 聊天訊息類型（Phase 13）
 */
export type ChatMessageType = 'GLOBAL' | 'GUILD' | 'PRIVATE' | 'SYSTEM';

/**
 * 聊天訊息結構
 */
export interface IChatMessage {
    id?: string;
    senderId: string;
    senderName: string;
    text: string;
    type: ChatMessageType;
    targetId?: string; // 幫會 ID 或私聊對象 ID
    timestamp: number;
}

/**
 * 幫會系統常數
 */
export const GUILD_CONSTANTS = {
    MAX_GUILD_NAME_LENGTH: 20,
    MIN_GUILD_NAME_LENGTH: 2,
    MAX_GUILD_DESCRIPTION_LENGTH: 100,
    MAX_GUILD_MEMBERS: 50,
    CHAT_HISTORY_LIMIT: 50, // 進入房間時載入的歷史訊息數量
};

// Entity Type (Phase 9: 增加 NPC)
export type EntityType = 'player' | 'enemy' | 'npc';

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

/**
 * Quest Data Schema (Phase 10: Data-Driven Quest System)
 * 任務狀態同步 Schema
 */
export class QuestData extends Schema implements IQuestState {
    @type("string") id: string = "";
    @type("string") name: string = "";
    @type("string") description: string = "";
    @type("number") currentCount: number = 0;
    @type("number") requiredCount: number = 0;
    @type("boolean") completed: boolean = false;
    @type("number") rewardXp: number = 0;
    @type("number") rewardMoney: number = 0;
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

    // Economy System (Phase 8)
    @type("number") money: number = 0;

    // Quest System (Phase 10)
    @type(QuestData) activeQuest: QuestData | null = null;

    // Guild System (Phase 13)
    @type("string") guildId: string = "";
    @type("string") guildName: string = "";
}

// Enemy Data (for PVE)
export interface IEnemyData extends IEntityData {
    state: 'idle' | 'chase' | 'attack';
}

// Item Types (Phase 8)
export type ItemType = 'currency' | 'consumable';

// Quest Types (Phase 10)
export type QuestType = 'kill' | 'talk' | 'collect';

/**
 * 任務定義（靜態數據，從 JSON 加載）
 * Phase 10: Data-Driven Quest System
 */
export interface IQuestDef {
    id: string;
    name: string;
    description: string;
    type: QuestType;
    targetId: string;
    requiredCount: number;
    reward: {
        xp: number;
        money: number;
        itemId?: string;
    };
    nextQuestId?: string;
}

/**
 * 任務狀態（動態數據，同步到客戶端）
 * Phase 10: Data-Driven Quest System
 */
export interface IQuestState {
    id: string;
    name: string;
    description: string;
    currentCount: number;
    requiredCount: number;
    completed: boolean;
    rewardXp: number;
    rewardMoney: number;
}

// Item Interface (Phase 8)
export interface IItem {
    id: string;
    name: string;
    type: ItemType;
    value: number; // Amount for currency, Heal amount for consumable
}

// Loot Data (Phase 8)
export interface ILootData {
    id: string;
    x: number;
    z: number;
    item: IItem;
}

// Player Data Interface (Extended for Phase 13)
export interface IPlayerData extends IEntityData {
    sessionId: string;
    role: PlayerRole;
    level: number;
    xp: number;
    maxXp: number;
    money: number;
    inventory: IItem[];
    // Phase 10: Active Quest State
    activeQuest: IQuestState | null;
    // Phase 13: Guild System
    guildId: string;
    guildName: string;
}

// Game Constants
export const GAME_CONSTANTS = {
    MAP_WIDTH: 100,
    MAP_HEIGHT: 100,
    PLAYER_SPEED: 0.2,
    ATTACK_RANGE: 3.0, // Meters
    ATTACK_DAMAGE: 30, // 提高玩家攻擊力（原本 10）
    ATTACK_INTERVAL: 1000, // Milliseconds between auto-attacks

    // Enemy/PVE Constants
    ENEMY_SPEED: 0.1, // Slower than players
    ENEMY_DETECT_RANGE: 10.0, // Aggro range
    ENEMY_SPAWN_COUNT: 5, // 初始 NPC 數量
    ENEMY_ATTACK_DAMAGE: 3, // 降低敵人攻擊力（原本 5）
    ENEMY_ATTACK_CHANCE: 0.02, // 2% chance per tick to attack

    // Progression System (Phase 7)
    XP_PER_KILL: 50, // XP awarded for killing an enemy
    BASE_XP_TO_LEVEL: 100, // Base XP required to reach level 2
    XP_SCALING_FACTOR: 1.5, // Each level requires 1.5x more XP
    HP_PER_LEVEL: 20, // HP bonus per level

    // Loot System (Phase 8)
    LOOT_PICKUP_RANGE: 2.0, // Distance to pickup loot
    DROP_CHANCE: 0.8, // 80% chance to drop loot

    // Safe Zone & Shop System (Phase 9)
    SAFE_ZONE_RADIUS: 8.0, // 安全區半徑（地圖中心）- 縮小方便測試
    SHOP_INTERACTION_RANGE: 5.0, // 與商店 NPC 互動距離
};

/**
 * 商店物品定義 (Phase 9)
 */
export interface IShopItem {
    id: string;
    name: string;
    price: number;
    value: number;
    type: ItemType;
}

/**
 * 商店物品列表 (Phase 9)
 */
export const SHOP_ITEMS: IShopItem[] = [
    { id: "food_small", name: "魚蛋 (Fishball)", price: 50, value: 20, type: "consumable" },
    { id: "food_large", name: "叉燒飯 (Rice)", price: 100, value: 50, type: "consumable" }
];

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
 * 遊戲版本（0.13.1 - North-Up Camera & Causeway Bay Map）
 */
export const GAME_VERSION = "0.13.1";
