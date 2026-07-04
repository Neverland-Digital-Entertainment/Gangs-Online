/**
 * Territory System (Phase 21: 佔領地盤系統)
 *
 * 核心規則（依 GDD 3.x + 決策確認）：
 * - 地盤由 Dashboard 地盤設置模組建立（territories collection），初始一律中立無主
 * - 中立地盤預設有基礎守衛把守（固定 5 個 Lv1），不需玩家手動處理即可攻打
 * - 換旗全自動、無需手動宣告佔領：擊敗地盤內全部守衛時，
 *   若擊殺最後一名守衛的玩家有社團 → 自動換旗成為新持有者；
 *   若沒有社團 → 地盤保持中立，守衛在一段時間後自動重新補滿
 * - 隨時可攻打（無排程開戰）：
 *   - 持有社團成員攻擊自家守衛 = 練功模式：守衛會重生（30 秒），經驗加成（等級越高經驗越多），
 *     強化石掉落率較野外高，掉落金幣的 20% 歸社團資金
 *   - 非持有社團玩家攻擊守衛 = 佔領模式：守衛不重生，全部存活守衛被清空即依上述規則換旗/保持中立
 * - 換旗後 30 分鐘保護期（不可被攻擊/佔領）；中立地盤無保護期，隨時可攻打
 * - 守衛招聘制（社團持有的地盤專用）：每塊地盤固定 10 個守衛位，換旗後清空，
 *   需社團個別付費招聘才會補上，守衛等級 1~10，可招聘等級受社團等級限制（社團 Lv N 可招 Lv N*2）
 * - 守衛駐守 AI：只在地盤範圍內追擊，離開範圍即回崗
 * - 地盤歸屬與守衛配置持久化到 Firebase（伺服器重啟不遺失）
 */
import { Room, Client } from "colyseus";
import { GameState, Player, Enemy, Loot, Item } from "../rooms/schema/GameState";
import {
    ITerritory,
    ITerritoryGuard,
    ITerritoryStatus,
    ITerritoryVertex,
    TERRITORY_CONFIG,
    GAME_CONSTANTS,
} from "@gangs-online/shared";
import { getFirestore } from "../services/FirebaseService";
import { societyService } from "../services/SocietyService";

const CFG = TERRITORY_CONFIG;
const TERRITORIES_PATH = "territories";

export class TerritorySystem {
    private room!: Room<GameState>;
    private territories: Map<string, ITerritory> = new Map();
    private contributionTimer: any = null;

    async initialize(room: Room<GameState>): Promise<void> {
        this.room = room;
        const db = getFirestore();
        if (!db) {
            console.warn("[Territory] Firebase 未初始化，地盤系統停用");
            return;
        }

        try {
            const snapshot = await db.collection(TERRITORIES_PATH).get();
            snapshot.forEach((doc: any) => {
                const t = doc.data() as ITerritory;
                t.id = doc.id;
                t.guards = t.guards || [];
                this.territories.set(t.id, t);
            });
            console.log(`[Territory] 已載入 ${this.territories.size} 塊地盤`);

            // 生成所有存活守衛
            this.territories.forEach((t) => {
                t.guards.forEach((g) => {
                    if (g.alive) this.spawnGuardEnemy(t, g);
                });
            });

            // 中立地盤（從未/不再被任何社團持有）預設要有基礎守衛把守，不需玩家手動處理
            this.territories.forEach((t) => {
                if (!t.ownerGuildId && t.guards.length === 0) this.seedNeutralGuards(t);
            });

            // 佔地計入社團貢獻（每小時）
            this.contributionTimer = this.room.clock.setInterval(() => {
                this.territories.forEach((t) => {
                    if (t.ownerGuildId) {
                        societyService.addTerritoryExp(t.ownerGuildId, CFG.MAX_GUARD_SLOTS === 10 ? 10 : 10)
                            .catch((e) => console.error("[Territory] 佔地貢獻寫入失敗:", e));
                    }
                });
            }, 60 * 60 * 1000);
        } catch (e) {
            console.error("[Territory] 載入地盤失敗:", e);
        }
    }

    // ==================== 幾何工具 ====================

    /** 射線法判斷點是否在多邊形內 */
    static pointInPolygon(x: number, z: number, vertices: ITerritoryVertex[]): boolean {
        let inside = false;
        for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
            const xi = vertices[i].x, zi = vertices[i].z;
            const xj = vertices[j].x, zj = vertices[j].z;
            if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) {
                inside = !inside;
            }
        }
        return inside;
    }

    private centroid(vertices: ITerritoryVertex[]): ITerritoryVertex {
        const n = vertices.length;
        return {
            x: vertices.reduce((s, v) => s + v.x, 0) / n,
            z: vertices.reduce((s, v) => s + v.z, 0) / n,
        };
    }

    /** 玩家所在的地盤（無則 null） */
    getTerritoryAt(x: number, z: number): ITerritory | null {
        for (const t of this.territories.values()) {
            if (t.vertices?.length >= 3 && TerritorySystem.pointInPolygon(x, z, t.vertices)) return t;
        }
        return null;
    }

    // ==================== 守衛生成 / AI ====================

    private guardEnemyId(territoryId: string, slot: number): string {
        return `guard_${territoryId}_${slot}`;
    }

    isGuard(enemyId: string): boolean {
        return enemyId.startsWith("guard_");
    }

    private parseGuardId(enemyId: string): { territory: ITerritory; guard: ITerritoryGuard } | null {
        if (!this.isGuard(enemyId)) return null;
        const parts = enemyId.split("_");
        const slot = parseInt(parts[parts.length - 1], 10);
        const territoryId = parts.slice(1, -1).join("_");
        const territory = this.territories.get(territoryId);
        if (!territory) return null;
        const guard = territory.guards.find((g) => g.slot === slot);
        if (!guard) return null;
        return { territory, guard };
    }

    /**
     * 補滿中立地盤的預設守衛（固定 5 個 Lv1）
     * 用於：伺服器啟動時的初始播種、以及地盤被打回中立後的延遲補滿
     */
    private seedNeutralGuards(t: ITerritory): void {
        for (let slot = 0; slot < CFG.NEUTRAL_GUARD_COUNT; slot++) {
            const guard: ITerritoryGuard = {
                slot,
                level: CFG.NEUTRAL_GUARD_LEVEL,
                alive: true,
                hp: CFG.GUARD_HP_PER_LEVEL * CFG.NEUTRAL_GUARD_LEVEL,
                maxHp: CFG.GUARD_HP_PER_LEVEL * CFG.NEUTRAL_GUARD_LEVEL,
                respawnAt: 0,
            };
            t.guards.push(guard);
            this.spawnGuardEnemy(t, guard);
        }
        this.persist(t);
        console.log(`[Territory] ${t.name} 中立守衛已補滿（${CFG.NEUTRAL_GUARD_COUNT} x Lv${CFG.NEUTRAL_GUARD_LEVEL}）`);
    }

    /** 地盤打回中立後，延遲一段時間再重新補滿守衛（避免立刻被同一批人再次清空） */
    private scheduleNeutralRestock(t: ITerritory): void {
        this.room.clock.setTimeout(() => {
            // 補滿前再次確認仍是中立且無守衛，避免與其間發生的佔領/招聘衝突
            if (!t.ownerGuildId && t.guards.length === 0) this.seedNeutralGuards(t);
        }, CFG.NEUTRAL_GUARD_RESTOCK_MS);
    }

    private spawnGuardEnemy(t: ITerritory, g: ITerritoryGuard): void {
        const c = this.centroid(t.vertices);
        const enemy = new Enemy();
        enemy.id = this.guardEnemyId(t.id, g.slot);
        // 守衛崗位沿地盤中心散開
        const angle = (g.slot / CFG.MAX_GUARD_SLOTS) * Math.PI * 2;
        enemy.x = c.x + Math.cos(angle) * 3;
        enemy.z = c.z + Math.sin(angle) * 3;
        enemy.name = `${t.ownerGuildName || "無主"}守衛 Lv${g.level}`;
        enemy.hp = g.hp;
        enemy.maxHp = g.maxHp;
        enemy.type = "enemy";
        enemy.npcType = "gangs";
        enemy.attack = CFG.GUARD_ATTACK_BASE + CFG.GUARD_ATTACK_PER_LEVEL * g.level;
        enemy.territoryId = t.id;
        enemy.guardLevel = g.level;
        enemy.ownerGuildId = t.ownerGuildId;
        enemy.ownerGuildName = t.ownerGuildName;
        this.room.state.enemies.set(enemy.id, enemy);
        console.log(`[Territory] 守衛進駐: ${enemy.id} Lv${g.level} @ ${t.name}`);
    }

    /**
     * 守衛駐守 AI（每 tick 由 GameRoom 調用）：
     * 只追擊地盤範圍內的敵對玩家，超出範圍回崗
     */
    update(): void {
        this.territories.forEach((t) => {
            if (!t.guards.some((g) => g.alive)) return;
            const c = this.centroid(t.vertices);
            t.guards.forEach((g) => {
                if (!g.alive) return;
                const enemy = this.room.state.enemies.get(this.guardEnemyId(t.id, g.slot));
                if (!enemy) return;

                // 找地盤內最近的非持有社團玩家
                let target: Player | null = null;
                let minDist = Infinity;
                this.room.state.players.forEach((p) => {
                    if (p.hp <= 0) return;
                    if (t.ownerGuildId && p.guildId === t.ownerGuildId) return; // 不主動攻擊自家成員
                    if (!TerritorySystem.pointInPolygon(p.x, p.z, t.vertices)) return;
                    const d = Math.hypot(p.x - enemy.x, p.z - enemy.z);
                    if (d < minDist) { minDist = d; target = p; }
                });

                if (target && minDist > GAME_CONSTANTS.ATTACK_RANGE - 0.5) {
                    // 追擊（不離開地盤）
                    const tp = target as Player;
                    const nx = enemy.x + ((tp.x - enemy.x) / minDist) * GAME_CONSTANTS.ENEMY_SPEED;
                    const nz = enemy.z + ((tp.z - enemy.z) / minDist) * GAME_CONSTANTS.ENEMY_SPEED;
                    if (TerritorySystem.pointInPolygon(nx, nz, t.vertices)) {
                        enemy.x = nx; enemy.z = nz; enemy.state = "chase";
                    }
                } else if (target) {
                    enemy.state = "attack";
                    if (Math.random() < GAME_CONSTANTS.ENEMY_ATTACK_CHANCE * 2) {
                        const tp = target as Player;
                        tp.hp = Math.max(0, tp.hp - enemy.attack);
                    }
                } else {
                    // 回崗
                    const angle = (g.slot / CFG.MAX_GUARD_SLOTS) * Math.PI * 2;
                    const px = c.x + Math.cos(angle) * 3, pz = c.z + Math.sin(angle) * 3;
                    const d = Math.hypot(px - enemy.x, pz - enemy.z);
                    if (d > 0.5) {
                        enemy.x += ((px - enemy.x) / d) * GAME_CONSTANTS.ENEMY_SPEED;
                        enemy.z += ((pz - enemy.z) / d) * GAME_CONSTANTS.ENEMY_SPEED;
                        enemy.state = "chase";
                    } else {
                        enemy.state = "idle";
                    }
                }
            });

            // 練功模式守衛重生
            const now = Date.now();
            t.guards.forEach((g) => {
                if (!g.alive && g.respawnAt > 0 && now >= g.respawnAt) {
                    g.alive = true;
                    g.hp = g.maxHp;
                    g.respawnAt = 0;
                    this.spawnGuardEnemy(t, g);
                }
            });
        });
    }

    // ==================== 攻擊 / 擊殺規則 ====================

    /**
     * 攻擊守衛前的規則檢查（GameRoom attack handler 調用）
     * @returns null = 可攻擊；否則回傳阻擋原因
     */
    canAttackGuard(player: Player, enemyId: string): string | null {
        const parsed = this.parseGuardId(enemyId);
        if (!parsed) return "守衛資料異常";
        const { territory } = parsed;

        const isMember = !!territory.ownerGuildId && player.guildId === territory.ownerGuildId;
        if (!isMember && territory.protectionUntil > Date.now()) {
            const mins = Math.ceil((territory.protectionUntil - Date.now()) / 60000);
            return `此地盤在換旗保護期內（剩餘 ${mins} 分鐘）`;
        }
        return null;
    }

    /**
     * 守衛被擊殺（GameRoom 擊殺路徑調用）
     * 回傳給呼叫端的擊殺結果（經驗值與訊息由呼叫端發放/廣播）
     */
    onGuardKilled(client: Client, killer: Player): { xp: number; messages: string[] } {
        const enemyId = killer.inCombatWithEnemy || "";
        return this.handleGuardKilled(client, killer, enemyId);
    }

    handleGuardKilled(client: Client, killer: Player, enemyId: string): { xp: number; messages: string[] } {
        const parsed = this.parseGuardId(enemyId);
        if (!parsed) return { xp: GAME_CONSTANTS.XP_PER_KILL, messages: [] };
        const { territory: t, guard: g } = parsed;
        const messages: string[] = [];

        const enemyEntity = this.room.state.enemies.get(enemyId);
        const dropX = enemyEntity?.x ?? killer.x;
        const dropZ = enemyEntity?.z ?? killer.z;
        this.room.state.enemies.delete(enemyId);
        g.alive = false;
        g.hp = 0;

        const isMember = !!t.ownerGuildId && killer.guildId === t.ownerGuildId;
        let xp: number;

        if (isMember) {
            // ===== 練功模式：守衛重生、經驗加成、差異化掉落 =====
            g.respawnAt = Date.now() + CFG.GUARD_TRAINING_RESPAWN_MS;
            xp = CFG.GUARD_XP_PER_LEVEL * g.level;

            // 掉落金幣（部分歸公）
            const gold = CFG.GUARD_GOLD_DROP_BASE * g.level;
            const toSociety = Math.floor(gold * CFG.GUARD_INCOME_TO_SOCIETY_RATE);
            killer.money += gold - toSociety;
            societyService.addFunds(t.ownerGuildId, toSociety)
                .catch((e) => console.error("[Territory] 歸公金幣寫入失敗:", e));
            messages.push(`守衛練功：獲得 $${gold - toSociety}（$${toSociety} 歸社團資金）`);

            // 強化石高掉落率
            if (Math.random() < CFG.GUARD_ENHANCE_STONE_DROP_RATE) {
                this.dropEnhanceStone(dropX, dropZ);
                messages.push("守衛掉落了 強化石！");
            }
        } else {
            // ===== 佔領模式：守衛不重生，全滅即換旗 =====
            g.respawnAt = 0;
            xp = GAME_CONSTANTS.XP_PER_KILL;

            const aliveCount = t.guards.filter((x) => x.alive).length;
            if (aliveCount === 0) {
                this.captureTerritory(t, killer, messages);
            } else {
                messages.push(`${t.name} 還剩 ${aliveCount} 名守衛！`);
            }
        }

        this.persist(t);
        return { xp, messages };
    }

    /** 在擊殺點生成強化石戰利品（沿用 lootItems 機制） */
    private dropEnhanceStone(x: number, z: number): void {
        const loot = new Loot();
        loot.id = `loot_${Math.random().toString(36).substring(2, 11)}`;
        const item = new Item();
        item.id = `enhance_stone_${Date.now()}`;
        item.baseId = "enhance_stone";
        item.name = "強化石";
        item.type = "material";
        item.value = 0;
        loot.item = item;
        loot.x = x + (Math.random() - 0.5) * 2;
        loot.z = z + (Math.random() - 0.5) * 2;
        this.room.state.lootItems.set(loot.id, loot);
        this.room.clock.setTimeout(() => {
            if (this.room.state.lootItems.has(loot.id)) this.room.state.lootItems.delete(loot.id);
        }, 30000);
    }

    /** 換旗 */
    private captureTerritory(t: ITerritory, capturer: Player, messages: string[]): void {
        const oldOwner = t.ownerGuildName || "無主";
        if (capturer.guildId) {
            t.ownerGuildId = capturer.guildId;
            t.ownerGuildName = capturer.guildName;
            t.protectionUntil = Date.now() + CFG.PROTECTION_DURATION_MS;
            t.capturedAt = Date.now();
            // 換旗後守衛位清空（需重新招聘 — 招聘制核心設計）
            t.guards = [];
            messages.push(`⚑ ${capturer.guildName} 攻陷了 ${t.name}！（原持有：${oldOwner}，保護期 30 分鐘）`);
            this.room.broadcast("chat", {
                sessionId: "SYSTEM",
                text: `⚑ 社團「${capturer.guildName}」佔領了地盤「${t.name}」！`,
            });
        } else {
            // 無社團玩家清空守衛 → 地盤變回中立，一段時間後重新補滿基礎守衛
            t.ownerGuildId = "";
            t.ownerGuildName = "";
            t.protectionUntil = 0;
            t.guards = [];
            messages.push(`${t.name} 的守衛已被清空，地盤變為無主狀態（守衛將於一段時間後重新駐守）`);
            this.scheduleNeutralRestock(t);
        }
    }

    // ==================== 招聘守衛 ====================

    /**
     * 招聘守衛（需 deploy_guards 權限：紅棍以上）
     * 費用從社團資金扣除，可招聘等級受社團等級限制
     */
    async hireGuard(client: Client, player: Player, territoryId: string, slot: number, level: number): Promise<void> {
        const t = this.territories.get(territoryId);
        if (!t) { client.send("notification", "找不到該地盤"); return; }
        if (!player.guildId || t.ownerGuildId !== player.guildId) {
            client.send("notification", "只能在自己社團持有的地盤招聘守衛"); return;
        }
        if (slot < 0 || slot >= CFG.MAX_GUARD_SLOTS) { client.send("notification", "無效的守衛位"); return; }
        if (level < 1 || level > CFG.MAX_GUARD_LEVEL) { client.send("notification", "無效的守衛等級"); return; }
        if (t.guards.some((g) => g.slot === slot)) { client.send("notification", "該守衛位已有守衛"); return; }

        const doc = await societyService.getSocietyDoc(player.guildId);
        if (!doc || !doc.society) { client.send("notification", "社團資料異常"); return; }
        if (!societyService.checkPermission(doc, player.firebaseUid, 'deploy_guards')) {
            client.send("notification", "你沒有招聘守衛的權限（需紅棍以上）"); return;
        }
        const maxLevel = doc.society.level * CFG.GUARD_LEVEL_PER_SOCIETY_LEVEL;
        if (level > maxLevel) {
            client.send("notification", `社團等級 Lv${doc.society.level} 最高只能招聘 Lv${maxLevel} 守衛`); return;
        }

        const cost = CFG.GUARD_HIRE_COSTS[level - 1];
        const spend = await societyService.spendFunds(player.guildId, cost);
        if (!spend.success) { client.send("notification", spend.error); return; }

        const guard: ITerritoryGuard = {
            slot,
            level,
            alive: true,
            hp: CFG.GUARD_HP_PER_LEVEL * level,
            maxHp: CFG.GUARD_HP_PER_LEVEL * level,
            respawnAt: 0,
        };
        t.guards.push(guard);
        this.spawnGuardEnemy(t, guard);
        this.persist(t);
        client.send("notification", `已招聘 Lv${level} 守衛進駐 ${t.name} 守衛位 ${slot + 1}（花費社團資金 $${cost}）`);
    }

    // ==================== 查詢 / 持久化 ====================

    getStatusList(): ITerritoryStatus[] {
        return Array.from(this.territories.values()).map((t) => ({
            id: t.id,
            name: t.name,
            ownerGuildId: t.ownerGuildId,
            ownerGuildName: t.ownerGuildName,
            protectionUntil: t.protectionUntil,
            guardCount: t.guards.filter((g) => g.alive).length,
            hiredGuardCount: t.guards.length,
            maxGuardSlots: t.maxGuardSlots || CFG.MAX_GUARD_SLOTS,
        }));
    }

    getTerritory(id: string): ITerritory | undefined {
        return this.territories.get(id);
    }

    private persist(t: ITerritory): void {
        const db = getFirestore();
        if (!db) return;
        t.updatedAt = Date.now();
        db.collection(TERRITORIES_PATH).doc(t.id).set({
            name: t.name,
            vertices: t.vertices,
            maxGuardSlots: t.maxGuardSlots || CFG.MAX_GUARD_SLOTS,
            ownerGuildId: t.ownerGuildId,
            ownerGuildName: t.ownerGuildName,
            protectionUntil: t.protectionUntil,
            guards: t.guards,
            capturedAt: t.capturedAt || 0,
            updatedAt: t.updatedAt,
        }, { merge: true }).catch((e: any) => console.error(`[Territory] 持久化 ${t.id} 失敗:`, e));
    }

    dispose(): void {
        if (this.contributionTimer) this.contributionTimer.clear();
    }
}
