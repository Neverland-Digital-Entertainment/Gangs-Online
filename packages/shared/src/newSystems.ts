/**
 * ==================== Phase 21: Core Gameplay Systems ====================
 * 依據 GDD_Core_System v0.2 新增的核心系統類型與數值設定：
 * 1. 武器升級系統（+0 ~ +15，失敗只損失金錢與強化石，5 次保底）
 * 2. 社團系統擴展（三合會職級 / 權限矩陣 / 倉庫 / 貢獻度 / 社團商店）
 * 3. 佔領地盤系統（守衛雙模式：成員練功可重生、非成員佔領不重生）
 * 4. 練功掉落擴展（強化石掉落表）
 * 5. 組隊系統（5 人，範圍內隊員各得全額經驗）
 *
 * 所有數值集中在本檔案的 *_CONFIG 常數，方便後續調整。
 */

// ==================== 1. 武器升級系統 ====================

/**
 * 武器強化設定（+0 ~ +15）
 * - successRates[n] = 從 +n 升到 +n+1 的成功率（0~1）
 * - 失敗懲罰：只損失金錢與強化石（不降級、不損毀）
 * - 保底：同一把武器連續失敗 PITY_FAIL_COUNT 次後，下一次必定成功
 */
export const WEAPON_ENHANCE_CONFIG = {
    MAX_LEVEL: 15,
    PITY_FAIL_COUNT: 5,
    ENHANCE_STONE_ITEM_ID: "enhance_stone",
    // index = 目前等級（0-based：從 +0 升 +1 用 index 0）
    SUCCESS_RATES: [1.0, 1.0, 1.0, 1.0, 1.0, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.35, 0.3, 0.25, 0.2],
    // 每次強化消耗的金幣（index = 目前等級）
    GOLD_COSTS: [500, 800, 1200, 1700, 2300, 3000, 4000, 5200, 6600, 8200, 10000, 12500, 15500, 19000, 23000],
    // 每次強化消耗的強化石數量（index = 目前等級）
    STONE_COSTS: [1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3],
    // 每個強化等級的累計攻擊力加成（index = 強化等級，遞增曲線）
    ATTACK_BONUS: [0, 2, 4, 7, 10, 14, 18, 23, 28, 34, 41, 49, 58, 68, 79, 91],
};

/** 取得武器顯示名稱，如「唐刀 +7」 */
export const getWeaponDisplayName = (baseName: string, enhanceLevel: number): string =>
    enhanceLevel > 0 ? `${baseName} +${enhanceLevel}` : baseName;

/** 武器強化請求（Client → Server） */
export interface IEnhanceRequest {
    itemIndex: number; // 背包中武器的 index
}

/** 武器強化結果（Server → Client） */
export interface IEnhanceResult {
    success: boolean;       // 本次請求是否有效執行（資源不足等為 false）
    enhanceSuccess?: boolean; // 強化是否成功
    message: string;
    weaponName?: string;    // 強化後顯示名稱
    enhanceLevel?: number;  // 強化後等級
    failCount?: number;     // 目前連續失敗次數（保底用）
    pityTriggered?: boolean;
}

/** 武器強化紀錄（Firebase Collection: weapon_enhance_logs，供 Dashboard 檢視） */
export interface IEnhanceLog {
    userId: string;
    playerName: string;
    weaponId: string;
    weaponName: string;
    fromLevel: number;
    toLevel: number;
    success: boolean;
    pityTriggered: boolean;
    goldCost: number;
    stoneCost: number;
    timestamp: number;
}

// ==================== 2. 社團系統（擴展現有幫會系統） ====================

/**
 * 社團職級（參考三合會職銜）
 * 兼容舊資料：'龍頭' 視同 '話事人'、'成員' 視同 '四九仔'（見 normalizeSocietyRole）
 */
export type SocietyRole = '話事人' | '坐館' | '紅棍' | '白紙扇' | '草鞋' | '四九仔';

/** 舊職級 → 新職級的兼容轉換 */
export const normalizeSocietyRole = (role: string): SocietyRole => {
    switch (role) {
        case '龍頭': case '話事人': return '話事人';
        case '副幫主': case '坐館': return '坐館';
        case '堂主': case '紅棍': return '紅棍';
        case '護法': case '白紙扇': return '白紙扇';
        case '草鞋': return '草鞋';
        default: return '四九仔';
    }
};

/** 社團權限鍵 */
export type SocietyPermission =
    | 'appoint_all'          // 任免所有職級（含坐館）
    | 'appoint_mid'          // 任免紅棍以下職級
    | 'disband'              // 解散社團
    | 'manage_money'         // 動用社團資金（招聘守衛扣款等）
    | 'warehouse_withdraw'   // 從社團倉庫取出物品
    | 'warehouse_deposit'    // 存入社團倉庫
    | 'recruit'              // 招募新成員 / 處理入會申請
    | 'deploy_guards'        // 招聘 / 部署地盤守衛
    | 'shop_buy';            // 使用社團商店（貢獻度兌換）

/**
 * 職級權限矩陣（依 GDD 2.2：權限依職能分離）
 * 話事人：所有權限；坐館：任免紅棍以下；紅棍：守衛部署；
 * 白紙扇：資金/倉庫；草鞋：招募；四九仔：基礎功能
 */
export const SOCIETY_PERMISSION_MATRIX: Record<SocietyRole, SocietyPermission[]> = {
    '話事人': ['appoint_all', 'appoint_mid', 'disband', 'manage_money', 'warehouse_withdraw', 'warehouse_deposit', 'recruit', 'deploy_guards', 'shop_buy'],
    '坐館': ['appoint_mid', 'manage_money', 'warehouse_withdraw', 'warehouse_deposit', 'recruit', 'deploy_guards', 'shop_buy'],
    '紅棍': ['deploy_guards', 'warehouse_deposit', 'shop_buy'],
    '白紙扇': ['manage_money', 'warehouse_withdraw', 'warehouse_deposit', 'shop_buy'],
    '草鞋': ['recruit', 'warehouse_deposit', 'shop_buy'],
    '四九仔': ['warehouse_deposit', 'shop_buy'],
};

export const hasSocietyPermission = (role: string, permission: SocietyPermission): boolean =>
    SOCIETY_PERMISSION_MATRIX[normalizeSocietyRole(role)].includes(permission);

/** 各職級名額上限（話事人固定 1 人，四九仔不限） */
export const SOCIETY_ROLE_LIMITS: Record<SocietyRole, number> = {
    '話事人': 1,
    '坐館': 1,
    '紅棍': 2,
    '白紙扇': 1,
    '草鞋': 2,
    '四九仔': -1, // 不限
};

/** 社團系統數值設定 */
export const SOCIETY_CONFIG = {
    CREATE_MIN_LEVEL: 5,          // 建立社團的玩家等級門檻
    CREATE_GOLD_COST: 10000,      // 建立社團的金幣費用
    GOLD_PER_CONTRIBUTION: 100,   // 捐獻 100 金 = 1 貢獻度
    MAX_SOCIETY_LEVEL: 5,
    // 社團升級所需累計經驗（成員總貢獻 + 佔地貢獻），index = 目前等級-1 → 升下一級
    LEVEL_EXP_THRESHOLDS: [500, 2000, 6000, 15000, 40000],
    // 各社團等級的成員上限（index = 等級-1）
    MEMBER_CAPS: [20, 26, 32, 40, 50],
    TERRITORY_CONTRIBUTION_PER_HOUR: 10, // 每塊持有地盤每小時計入社團經驗
    WAREHOUSE_CAPACITY: 100,      // 社團倉庫格數
};

/** 社團倉庫物品（儲存在 guild doc 的 warehouse 陣列） */
export interface ISocietyWarehouseItem {
    id: string;
    name: string;
    type: string;
    value: number;
    enhanceLevel?: number; // 武器強化等級
    quantity: number;
}

/** 社團商店商品（貢獻度兌換，獨立於一般商店） */
export interface ISocietyShopItem {
    itemId: string;
    name: string;
    type: string;         // ItemType
    value: number;
    contributionPrice: number; // 貢獻度價格
    minSocietyLevel: number;   // 需要的社團等級
}

/** 預設社團商店商品清單（與強化石/稀有材料掛鉤） */
export const SOCIETY_SHOP_ITEMS: ISocietyShopItem[] = [
    { itemId: "enhance_stone", name: "強化石", type: "material", value: 0, contributionPrice: 20, minSocietyLevel: 1 },
    { itemId: "food_large", name: "叉燒飯 (Rice)", type: "consumable", value: 50, contributionPrice: 5, minSocietyLevel: 1 },
    { itemId: "weapon_watermelon_knife", name: "西瓜刀", type: "weapon", value: 12, contributionPrice: 100, minSocietyLevel: 1 },
    { itemId: "weapon_tang_sword", name: "唐刀", type: "weapon", value: 20, contributionPrice: 300, minSocietyLevel: 2 },
    { itemId: "rare_material_jade", name: "翡翠原石", type: "material", value: 500, contributionPrice: 150, minSocietyLevel: 3 },
];

/** 社團擴展資料（新增在 guilds collection 文件上的欄位） */
export interface ISocietyExtension {
    level: number;                 // 社團等級
    exp: number;                   // 社團經驗（總貢獻累計）
    funds: number;                 // 社團資金（金幣）
    warehouse: ISocietyWarehouseItem[];
    contributions: { [userId: string]: number }; // 各成員可用貢獻度
    totalContributions: { [userId: string]: number }; // 各成員歷史總貢獻
}

// ==================== 3. 佔領地盤系統 ====================

/** 地盤多邊形頂點 */
export interface ITerritoryVertex {
    x: number;
    z: number;
}

/** 守衛槽位狀態 */
export interface ITerritoryGuard {
    slot: number;        // 0~9
    level: number;       // 1~10
    alive: boolean;
    hp: number;
    maxHp: number;
    respawnAt: number;   // 練功模式被擊殺後的重生時間戳（0 = 不需重生）
}

/**
 * 地盤資料（Firebase Collection: territories）
 * 由 Dashboard 地盤設置模組建立（初始一律中立無主），伺服器運行時管理歸屬
 */
export interface ITerritory {
    id: string;
    name: string;
    vertices: ITerritoryVertex[];   // 封閉多邊形頂點（依序連線，數量不限）
    maxGuardSlots: number;          // 固定 10（對應 GDD 3.3）
    ownerGuildId: string;           // "" = 中立無主
    ownerGuildName: string;
    protectionUntil: number;        // 換旗保護期截止時間戳（30 分鐘）
    guards: ITerritoryGuard[];
    capturedAt: number;
    createdAt: number;
    updatedAt: number;
}

/** 地盤 / 守衛數值設定 */
export const TERRITORY_CONFIG = {
    MAX_GUARD_SLOTS: 10,                 // 全域固定值
    PROTECTION_DURATION_MS: 30 * 60 * 1000, // 換旗後 30 分鐘保護期
    MAX_GUARD_LEVEL: 10,
    // 招聘守衛費用（index = 守衛等級-1），從社團資金扣款
    GUARD_HIRE_COSTS: [1000, 2500, 5000, 8000, 12000, 17000, 23000, 30000, 40000, 50000],
    // 守衛屬性（依等級線性成長）
    GUARD_HP_PER_LEVEL: 200,
    GUARD_ATTACK_BASE: 5,
    GUARD_ATTACK_PER_LEVEL: 3,
    // 守衛練功經驗：等級越高經驗越多（成員在自家地盤打守衛）
    GUARD_XP_PER_LEVEL: 80,
    // 非持有社團成員攻擊守衛（佔領模式）獲得的經驗照一般怪計算
    // 守衛練功模式重生時間（毫秒）
    GUARD_TRAINING_RESPAWN_MS: 30 * 1000,
    // 社團等級 N 可招聘的最高守衛等級 = N * 2
    GUARD_LEVEL_PER_SOCIETY_LEVEL: 2,
    // 守衛掉落（差異化：強化石掉落率比野外高）
    GUARD_ENHANCE_STONE_DROP_RATE: 0.35,
    GUARD_GOLD_DROP_BASE: 50,       // 掉落金幣 = BASE * 守衛等級
    // 守衛練功產出歸公比例（掉落金幣的一部分進入社團資金）
    GUARD_INCOME_TO_SOCIETY_RATE: 0.2,
};

/** 地盤即時狀態摘要（Server → Client，地盤資訊面板用） */
export interface ITerritoryStatus {
    id: string;
    name: string;
    ownerGuildId: string;
    ownerGuildName: string;
    protectionUntil: number;
    guardCount: number;      // 存活守衛數
    hiredGuardCount: number; // 已招聘槽位數
    maxGuardSlots: number;
}

// ==================== 4. 練功掉落擴展 ====================

/** 野外練功掉落表（一般敵人） */
export const HUNTING_DROP_CONFIG = {
    ENHANCE_STONE_DROP_RATE: 0.15,  // 野外強化石掉落率（守衛為 0.35，差異化設計）
    GOLD_DROP_RATE: 0.5,
    GOLD_DROP_MIN: 10,
    GOLD_DROP_MAX: 50,
    CONSUMABLE_DROP_RATE: 0.3,
};

// ==================== 5. 組隊系統 ====================

/**
 * 組隊設定
 * 經驗分配：擊殺時，同 Room 且在擊殺點 XP_SHARE_RANGE 範圍內的每位隊員
 * 各獲得「全額」經驗（不均分 — 均分會使組隊失去價值）
 */
export const PARTY_CONFIG = {
    MAX_MEMBERS: 5,
    XP_SHARE_RANGE: 40, // 公尺
    INVITE_EXPIRE_MS: 30 * 1000,
};

/** 組隊狀態（Server → Client 同步用） */
export interface IPartyInfo {
    partyId: string;
    leaderSessionId: string;
    members: { sessionId: string; name: string; level: number }[];
}

// ==================== Phase 21: 測試用武器道具定義 ====================

/** 武器道具靜態定義（value = 基礎攻擊力） */
export interface IWeaponDef {
    id: string;
    name: string;
    baseAttack: number;
    price: number; // 一般商店金幣價格
}

export const WEAPON_DEFS: IWeaponDef[] = [
    { id: "weapon_watermelon_knife", name: "西瓜刀", baseAttack: 12, price: 2000 },
    { id: "weapon_machete", name: "開山刀", baseAttack: 16, price: 5000 },
    { id: "weapon_tang_sword", name: "唐刀", baseAttack: 20, price: 12000 },
    { id: "weapon_baseball_bat", name: "棒球棍", baseAttack: 8, price: 800 },
];

export const getWeaponDef = (id: string): IWeaponDef | undefined =>
    WEAPON_DEFS.find((w) => w.id === id);
