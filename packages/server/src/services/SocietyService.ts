/**
 * Society Service (Phase 21: 社團系統擴展)
 *
 * 在現有 Phase 13 幫會系統（guilds collection）之上擴展：
 * - 三合會職級（話事人/坐館/紅棍/白紙扇/草鞋/四九仔），兼容舊職級（龍頭→話事人、成員→四九仔）
 * - 權限矩陣（SOCIETY_PERMISSION_MATRIX，權限依職能分離）
 * - 社團資金 / 倉庫 / 貢獻度 / 社團商店（貢獻度兌換）
 * - 社團等級（貢獻累計經驗值升級，提升成員上限與可招聘守衛等級）
 *
 * 資料儲存：沿用 guilds collection，新增 society 擴展欄位（ISocietyExtension）
 */
import { getFirestore, isFirebaseInitialized } from "./FirebaseService";
import {
    ISocietyExtension,
    ISocietyWarehouseItem,
    SocietyRole,
    SocietyPermission,
    hasSocietyPermission,
    normalizeSocietyRole,
    SOCIETY_ROLE_LIMITS,
    SOCIETY_CONFIG,
    SOCIETY_SHOP_ITEMS,
    IGuildDataStored,
} from "@gangs-online/shared";

const GUILDS_PATH = "guilds";

type Result<T = {}> = ({ success: true } & T) | { success: false; error: string };

/** guild 文件 + society 擴展欄位 */
export interface ISocietyDoc extends IGuildDataStored {
    society?: ISocietyExtension;
}

const DEFAULT_EXTENSION: ISocietyExtension = {
    level: 1,
    exp: 0,
    funds: 0,
    warehouse: [],
    contributions: {},
    totalContributions: {},
};

export class SocietyService {

    private db() {
        if (!isFirebaseInitialized()) return null;
        return getFirestore();
    }

    /** 讀取社團文件（含擴展欄位，未初始化時補預設值） */
    async getSocietyDoc(guildId: string): Promise<ISocietyDoc | null> {
        const db = this.db();
        if (!db) return null;
        const doc = await db.collection(GUILDS_PATH).doc(guildId).get();
        if (!doc.exists) return null;
        const data = doc.data() as ISocietyDoc;
        if (!data.society) {
            data.society = JSON.parse(JSON.stringify(DEFAULT_EXTENSION));
        }
        return data;
    }

    private async saveExtension(guildId: string, society: ISocietyExtension): Promise<void> {
        const db = this.db();
        if (!db) throw new Error("Firebase 未初始化");
        await db.collection(GUILDS_PATH).doc(guildId).set({ society }, { merge: true });
    }

    /** 取得成員職級（兼容舊資料：龍頭→話事人、成員→四九仔） */
    getMemberRole(doc: ISocietyDoc, userId: string): SocietyRole | null {
        const member = doc.members?.[userId];
        if (!member) return null;
        return normalizeSocietyRole(member.role);
    }

    /** 權限檢查 */
    checkPermission(doc: ISocietyDoc, userId: string, permission: SocietyPermission): boolean {
        const role = this.getMemberRole(doc, userId);
        if (!role) return false;
        return hasSocietyPermission(role, permission);
    }

    // ==================== 職級任免 ====================

    /**
     * 任免職級
     * 話事人可任免所有職級（含坐館）；坐館可任免紅棍以下
     * 各職級有名額上限（SOCIETY_ROLE_LIMITS）
     */
    async appointRole(guildId: string, actorId: string, targetId: string, newRole: SocietyRole): Promise<Result> {
        const doc = await this.getSocietyDoc(guildId);
        if (!doc) return { success: false, error: "社團不存在" };

        const actorRole = this.getMemberRole(doc, actorId);
        const targetRole = this.getMemberRole(doc, targetId);
        if (!actorRole || !targetRole) return { success: false, error: "操作者或目標不在社團中" };
        if (actorId === targetId) return { success: false, error: "不能任免自己" };
        if (newRole === '話事人') return { success: false, error: "話事人職位不能透過任免指派（請使用轉讓）" };
        if (targetRole === '話事人') return { success: false, error: "不能變更話事人的職級" };

        // 權限判斷
        const midRoles: SocietyRole[] = ['紅棍', '白紙扇', '草鞋', '四九仔'];
        const canAppoint =
            (actorRole === '話事人' && hasSocietyPermission(actorRole, 'appoint_all')) ||
            (hasSocietyPermission(actorRole, 'appoint_mid') && midRoles.includes(newRole) && midRoles.includes(targetRole));
        if (!canAppoint) return { success: false, error: "你沒有任免此職級的權限" };

        // 名額檢查
        const limit = SOCIETY_ROLE_LIMITS[newRole];
        if (limit > 0) {
            const count = Object.entries(doc.members)
                .filter(([uid, m]) => uid !== targetId && normalizeSocietyRole(m.role) === newRole)
                .length;
            if (count >= limit) return { success: false, error: `「${newRole}」職位已滿（上限 ${limit} 人）` };
        }

        const db = this.db();
        if (!db) return { success: false, error: "Firebase 未初始化" };
        await db.collection(GUILDS_PATH).doc(guildId).update({
            [`members.${targetId}.role`]: newRole,
        });
        console.log(`[Society] ${actorId} 將 ${targetId} 任免為 ${newRole}（社團 ${doc.name}）`);
        return { success: true };
    }

    // ==================== 貢獻度 ====================

    /**
     * 捐獻金幣換取貢獻度（呼叫端負責先驗證並扣除玩家金幣）
     * 比例：SOCIETY_CONFIG.GOLD_PER_CONTRIBUTION 金 = 1 貢獻，無上限
     * 同時計入社團經驗（可升級）
     */
    async donate(guildId: string, userId: string, goldAmount: number): Promise<Result<{ gained: number; total: number; societyLevel: number; leveledUp: boolean }>> {
        const doc = await this.getSocietyDoc(guildId);
        if (!doc || !doc.society) return { success: false, error: "社團不存在" };
        if (!doc.members?.[userId]) return { success: false, error: "你不在此社團中" };

        const gained = Math.floor(goldAmount / SOCIETY_CONFIG.GOLD_PER_CONTRIBUTION);
        if (gained <= 0) return { success: false, error: `至少需捐獻 $${SOCIETY_CONFIG.GOLD_PER_CONTRIBUTION}（100金 = 1貢獻）` };

        const s = doc.society;
        s.contributions[userId] = (s.contributions[userId] || 0) + gained;
        s.totalContributions[userId] = (s.totalContributions[userId] || 0) + gained;
        s.funds += goldAmount; // 捐獻的金幣進入社團資金
        const leveledUp = this.addExp(s, gained);

        await this.saveExtension(guildId, s);
        return { success: true, gained, total: s.contributions[userId], societyLevel: s.level, leveledUp };
    }

    /** 增加社團經驗並處理升級，回傳是否升級 */
    private addExp(s: ISocietyExtension, exp: number): boolean {
        s.exp += exp;
        let leveledUp = false;
        while (
            s.level < SOCIETY_CONFIG.MAX_SOCIETY_LEVEL &&
            s.exp >= SOCIETY_CONFIG.LEVEL_EXP_THRESHOLDS[s.level - 1]
        ) {
            s.level += 1;
            leveledUp = true;
        }
        return leveledUp;
    }

    /** 佔領地盤計入社團經驗（TerritorySystem 定時調用） */
    async addTerritoryExp(guildId: string, exp: number): Promise<void> {
        const doc = await this.getSocietyDoc(guildId);
        if (!doc || !doc.society) return;
        this.addExp(doc.society, exp);
        await this.saveExtension(guildId, doc.society);
    }

    /** 目前社團等級的成員上限 */
    getMemberCap(society: ISocietyExtension): number {
        return SOCIETY_CONFIG.MEMBER_CAPS[Math.min(society.level, SOCIETY_CONFIG.MEMBER_CAPS.length) - 1];
    }

    // ==================== 社團資金 ====================

    /** 動用社團資金（招聘守衛等），需 manage_money 或 deploy_guards 權限由呼叫端判斷 */
    async spendFunds(guildId: string, amount: number): Promise<Result<{ remaining: number }>> {
        const doc = await this.getSocietyDoc(guildId);
        if (!doc || !doc.society) return { success: false, error: "社團不存在" };
        if (doc.society.funds < amount) return { success: false, error: `社團資金不足（需要 $${amount}，現有 $${doc.society.funds}）` };
        doc.society.funds -= amount;
        await this.saveExtension(guildId, doc.society);
        return { success: true, remaining: doc.society.funds };
    }

    /** 存入社團資金（守衛練功產出歸公等） */
    async addFunds(guildId: string, amount: number): Promise<void> {
        const doc = await this.getSocietyDoc(guildId);
        if (!doc || !doc.society) return;
        doc.society.funds += amount;
        await this.saveExtension(guildId, doc.society);
    }

    // ==================== 社團倉庫 ====================

    /** 存入物品（任何成員可存） */
    async warehouseDeposit(guildId: string, userId: string, item: ISocietyWarehouseItem): Promise<Result> {
        const doc = await this.getSocietyDoc(guildId);
        if (!doc || !doc.society) return { success: false, error: "社團不存在" };
        if (!this.checkPermission(doc, userId, 'warehouse_deposit')) return { success: false, error: "你沒有存入倉庫的權限" };
        if (doc.society.warehouse.length >= SOCIETY_CONFIG.WAREHOUSE_CAPACITY) return { success: false, error: "社團倉庫已滿" };

        doc.society.warehouse.push(item);
        await this.saveExtension(guildId, doc.society);
        return { success: true };
    }

    /** 取出物品（需 warehouse_withdraw 權限：話事人/坐館/白紙扇） */
    async warehouseWithdraw(guildId: string, userId: string, warehouseIndex: number): Promise<Result<{ item: ISocietyWarehouseItem }>> {
        const doc = await this.getSocietyDoc(guildId);
        if (!doc || !doc.society) return { success: false, error: "社團不存在" };
        if (!this.checkPermission(doc, userId, 'warehouse_withdraw')) return { success: false, error: "你沒有取出倉庫物品的權限（僅話事人/坐館/白紙扇）" };
        if (warehouseIndex < 0 || warehouseIndex >= doc.society.warehouse.length) return { success: false, error: "找不到該倉庫物品" };

        const [item] = doc.society.warehouse.splice(warehouseIndex, 1);
        await this.saveExtension(guildId, doc.society);
        return { success: true, item };
    }

    // ==================== 社團商店 ====================

    /**
     * 貢獻度兌換社團商店商品
     * 回傳兌換到的商品定義（呼叫端負責放入玩家背包）
     */
    async shopBuy(guildId: string, userId: string, itemId: string): Promise<Result<{ item: typeof SOCIETY_SHOP_ITEMS[number]; remaining: number }>> {
        const doc = await this.getSocietyDoc(guildId);
        if (!doc || !doc.society) return { success: false, error: "社團不存在" };
        if (!this.checkPermission(doc, userId, 'shop_buy')) return { success: false, error: "你沒有使用社團商店的權限" };

        const shopItem = SOCIETY_SHOP_ITEMS.find((i) => i.itemId === itemId);
        if (!shopItem) return { success: false, error: "社團商店沒有此商品" };
        if (doc.society.level < shopItem.minSocietyLevel) return { success: false, error: `需要社團等級 Lv${shopItem.minSocietyLevel}` };

        const balance = doc.society.contributions[userId] || 0;
        if (balance < shopItem.contributionPrice) return { success: false, error: `貢獻度不足（需要 ${shopItem.contributionPrice}，現有 ${balance}）` };

        doc.society.contributions[userId] = balance - shopItem.contributionPrice;
        await this.saveExtension(guildId, doc.society);
        return { success: true, item: shopItem, remaining: doc.society.contributions[userId] };
    }

    // ==================== 解散 ====================

    /** 解散社團（僅話事人） */
    async disband(guildId: string, actorId: string): Promise<Result<{ name: string }>> {
        const doc = await this.getSocietyDoc(guildId);
        if (!doc) return { success: false, error: "社團不存在" };
        if (!this.checkPermission(doc, actorId, 'disband')) return { success: false, error: "只有話事人可以解散社團" };

        const db = this.db();
        if (!db) return { success: false, error: "Firebase 未初始化" };
        await db.collection(GUILDS_PATH).doc(guildId).delete();
        console.log(`[Society] 社團已解散: ${doc.name}`);
        return { success: true, name: doc.name };
    }
}

export const societyService = new SocietyService();
