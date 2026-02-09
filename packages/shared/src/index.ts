
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

    // Evil Value & Prison System (Phase 14)
    @type("number") evilValue: number = 0; // 罪惡值 (0-3)
    @type("boolean") inPrison: boolean = false; // 是否在監獄中
    @type("number") prisonReleaseTime: number = 0; // 釋放時間戳
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

// Player Data Interface (Extended for Phase 14)
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
    // Phase 14: Evil Value & Prison System
    evilValue: number;
    inPrison: boolean;
    prisonReleaseTime: number;
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
    ENEMY_SPAWN_COUNT: 0, // Phase 15: 暫時設為 0 以便測試場景
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

// ==================== Phase 14: NPC Types & Evil Value System ====================

/**
 * NPC 類型（Phase 14）
 */
export type NPCType = 'citizen' | 'police' | 'gangs' | 'shop' | 'quest';

/**
 * NPC 掉落表項目（Phase 14）
 */
export interface ILootTableEntry {
    itemId: string;
    dropRate: number; // 0.05 = 5%
}

/**
 * NPC 狀態（Phase 15）
 */
export type NPCStatus = 'active' | 'inactive';

/**
 * 對話選項 (Phase 16-2)
 */
export interface DialogueOption {
    text: string;
    nextNodeId: string;
}

/**
 * 對話節點 (Phase 16-2)
 */
export interface DialogueNode {
    nodeId: string;
    speaker: string;
    content: string;
    options?: DialogueOption[];
    actionType?: 'open_shop' | 'accept_quest' | 'end_dialogue';
    actionData?: any;
}

/**
 * 對話樹 (Phase 16-2)
 */
export interface DialogueTree {
    nodes: DialogueNode[];
    startNodeId: string;
}

/**
 * NPC 模板數據 (Phase 16-2 - Firebase Collection: npc_templates)
 */
export interface INPCTemplate {
    id: string;
    name: string;
    type: NPCType;
    modelId?: string;
    description?: string;
    baseHp: number;
    baseAttack: number;
    baseDefense: number;
    baseSpeed: number;
    combatType?: 'MELEE' | 'RANGED';
    attackRange?: number;
    dialogueTree?: DialogueTree;
    createdAt: Date;
    updatedAt: Date;
    isActive: boolean;
}

/**
 * NPC 實例數據 (Phase 16-2 - Firebase Collection: npc_instances)
 * Phase 16-3: 新增 linkedShopId 和 isGuildOnly
 */
export interface INPCInstance {
    id: string;
    templateId: string;
    positionX: number;
    positionZ: number;
    rotation: number;
    level: number;
    interactionRadius: number;
    movementPattern: 'STATIC' | 'WANDERING' | 'PATROLLING';
    wanderRadius?: number;
    wanderCenter?: { x: number; z: number };
    patrolWaypoints?: { x: number; z: number }[];
    aggroRange?: number;
    chaseDistance?: number;
    shopId?: string;
    linkedShopId?: string; // Phase 16-3: 連結商店 ID
    isGuildOnly?: boolean; // Phase 16-3: 是否僅限社團成員
    isAttackable: boolean;
    mapId?: string;
    territoryId?: string;
    createdAt: Date;
    updatedAt: Date;
    isActive: boolean;
}

/**
 * NPC 數據結構（Phase 14 - Firebase Collection: npcs）
 * Phase 15: 新增 status 欄位
 * Phase 16-2: 新增 dialogueTree 支持, modelId 支持
 */
export interface INPCData {
    id: string;
    type: NPCType;
    name: string;
    hp: number;
    attack: number;
    modelId?: string; // Phase 16-2: 自定義模型 ID，不提供或空字串時使用預設模型
    lootTable?: ILootTableEntry[];
    dialogue?: string; // 簡單對話文本（向後兼容）
    dialogueTree?: DialogueTree; // Phase 16-2: 對話樹
    linkedShopId?: string; // Phase 16-3: 關聯商店 ID
    relatedQuests?: string[]; // 關聯任務 ID
    spawnX?: number;
    spawnZ?: number;
    status?: NPCStatus; // Phase 15: active/inactive 狀態
}

/**
 * 罪惡值系統常數（Phase 14）
 */
export const EVIL_VALUE_CONSTANTS = {
    MAX_EVIL_VALUE: 3, // 最大罪惡值
    EVIL_INCREMENT: 1, // 每次攻擊無辜增加的罪惡值
    PRISON_DURATION: 30000, // 監獄停留時間（毫秒）= 30 秒
    POLICE_SCAN_RANGE: 15.0, // 警察掃描範圍
    POLICE_SCAN_INTERVAL: 2000, // 警察掃描間隔（毫秒）
};

/**
 * 監獄系統常數（Phase 14）
 */
export const PRISON_CONSTANTS = {
    // Phase 15: 監獄位置（場景西北角，避開建築物）
    PRISON_X: -350,
    PRISON_Z: 500,
    PRISON_RADIUS: 10.0, // 監獄活動範圍
    // Phase 15: 釋放後重生點（場景南邊道路）
    RELEASE_X: 0,
    RELEASE_Z: -450,
};

// ==================== Phase 16.3: Shop & Economy System ====================

/**
 * 道具分類（Phase 16.3）
 * 重要：Contraband (非法物品) 已改為 Equipment (裝備)
 */
export type ItemCategory = 'consumable' | 'equipment' | 'special' | 'material';

/**
 * 商店道具配置（Phase 16.3）
 * 用於商店的道具列表，包含庫存和限購設定
 */
export interface IShopItemConfig {
    itemId: string;                // 連結至 items 集合的道具 ID
    globalStock: number;           // 商店總庫存（-1 = 無限，預設 -1）
    currentStock?: number;         // 當前剩餘庫存（僅當 globalStock > 0 時使用）
    personalLimit: number;         // 每位玩家限購件數（0 = 不限，預設 0）
    priceMultiplier?: number;      // 價格倍數（預設 1.0，例如 1.2 = 漲價 20%）
}

/**
 * 商店數據結構（Phase 16.3 - Firebase Collection: shops）
 */
export interface IShop {
    id: string;                    // 商店唯一識別碼
    name: string;                  // 商店名稱（例如："廟街便利店"）
    description?: string;          // 商店描述（可選）
    operatingHours?: {             // 營業時間（24 小時制）
        start: number;             // 0-23，開始時間（未設定則 24 小時營業）
        end: number;               // 0-23，結束時間（支援跨夜，如 22-04）
    };
    itemList: IShopItemConfig[];   // 商店販售的道具列表
    isActive: boolean;             // 是否啟用（預設 true）
    createdAt: any;                // Firestore Timestamp - 創建時間
    updatedAt: any;                // Firestore Timestamp - 更新時間
}

/**
 * 購買紀錄（Phase 16.3 - Firebase Subcollection: users/{userId}/purchaseHistory/{shopId}_{itemId}）
 */
export interface IPurchaseRecord {
    shopId: string;                // 商店 ID
    itemId: string;                // 道具 ID
    purchaseCount: number;         // 已購買數量
    lastPurchaseAt: any;           // Firestore Timestamp - 最後購買時間
    resetAt?: any;                 // Firestore Timestamp - 重置時間（若實作每日重置）
}

/**
 * 商店購買請求（Phase 16.3 - Colyseus 消息）
 */
export interface IPurchaseRequest {
    shopId: string;
    itemId: string;
    quantity: number;
}

/**
 * 商店購買響應（Phase 16.3 - Colyseus 消息）
 */
export interface IPurchaseResponse {
    success: boolean;
    message: string;
    remainingStock?: number;
    remainingPersonalLimit?: number;
}

// ==================== Phase 20: Quest Blueprint System ====================

/**
 * 任務藍圖節點類型（Phase 20）
 */
export type QuestNodeType =
    | 'start'           // 開始節點
    | 'dialogue'        // 對話節點
    | 'choice'          // 選擇節點
    | 'task'            // 任務目標節點
    | 'condition'       // 條件判定節點
    | 'action'          // 動作執行節點
    | 'end';            // 結束節點

/**
 * 任務目標類型（Phase 20）
 */
export type QuestTaskType = 'collect' | 'kill' | 'interact' | 'location';

/**
 * 任務狀態機（Phase 20）
 */
export type QuestStatus = 'locked' | 'available' | 'active' | 'completed';

/**
 * 開始節點數據（Phase 20）
 */
export interface IStartNodeData {
    npcTemplateId: string;       // 掛載的 NPC 模板 ID
    minLevel?: number;           // 最低等級限制
    maxLevel?: number;           // 最高等級限制
    prerequisiteQuestId?: string; // 前置任務 ID（需已完成）
}

/**
 * 對話節點數據（Phase 20）
 */
export interface IDialogueNodeData {
    speakerId: string;           // 說話者 NPC ID
    expression?: string;         // 表情代碼
    textZh: string;              // 繁體中文文本
    textEn: string;              // 英文文本
}

/**
 * 選擇節點數據（Phase 20）
 */
export interface IChoiceNodeData {
    options: {
        textZh: string;
        textEn: string;
        targetHandleId: string;  // 連接到下一個節點的 handle ID
    }[];
}

/**
 * 任務目標節點數據（Phase 20）
 */
export interface ITaskNodeData {
    taskType: QuestTaskType;
    targetId: string;            // 道具 ID / 敵人模板 ID / NPC ID
    requiredCount: number;
    description?: string;
    timeLimit?: number;          // 秒數（僅 location 使用）
    locationX?: number;          // 位置 X（僅 location 使用）
    locationZ?: number;          // 位置 Z（僅 location 使用）
    locationRadius?: number;     // 位置半徑（僅 location 使用）
}

/**
 * 條件判定節點數據（Phase 20）
 */
export interface IConditionNodeData {
    conditionType: 'money' | 'item' | 'variable';
    targetId?: string;           // 道具 ID 或變數名稱
    requiredAmount: number;
}

/**
 * 動作執行節點數據（Phase 20）
 */
export interface IActionNodeData {
    actionType: 'remove_item' | 'remove_money' | 'spawn_npc' | 'set_variable';
    targetId?: string;
    amount?: number;
    value?: string;
}

/**
 * 結束節點數據（Phase 20）
 */
export interface IEndNodeData {
    rewardXp: number;
    rewardMoney: number;
    rewardItems?: {
        itemId: string;
        quantity: number;
    }[];
}

/**
 * 任務藍圖節點（Phase 20 - React Flow 節點數據）
 */
export interface IQuestBlueprintNode {
    id: string;
    type: QuestNodeType;
    position: { x: number; y: number };
    data: IStartNodeData | IDialogueNodeData | IChoiceNodeData |
          ITaskNodeData | IConditionNodeData | IActionNodeData | IEndNodeData;
}

/**
 * 任務藍圖邊（Phase 20 - React Flow 邊數據）
 */
export interface IQuestBlueprintEdge {
    id: string;
    source: string;
    target: string;
    sourceHandle?: string;
    targetHandle?: string;
    label?: string;
}

/**
 * 任務藍圖數據（Phase 20 - Firebase Collection: quest_blueprints）
 */
export interface IQuestBlueprint {
    id: string;
    name: string;
    description?: string;
    nodes: IQuestBlueprintNode[];
    edges: IQuestBlueprintEdge[];
    isActive: boolean;
    createdAt: any;
    updatedAt: any;
}

/**
 * 遊戲版本（0.20.0 - Quest Blueprint System）
 */
export const GAME_VERSION = "0.20.0";
