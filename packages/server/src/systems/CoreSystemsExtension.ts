/**
 * Core Systems Extension (Phase 21)
 *
 * 以「擴展」方式把 Phase 21 各新系統掛進 GameRoom：
 * - 武器升級（WeaponEnhanceSystem）
 * - 社團擴展（SocietyService：職級/權限/倉庫/貢獻度/社團商店）
 * - 佔領地盤（TerritorySystem：守衛雙模式/換旗/保護期）
 * - 組隊（PartySystem：5 人、範圍內全額經驗）
 *
 * GameRoom 只需：
 *   1. onCreate 呼叫 coreSystems.initialize(this, progressionSystem)
 *   2. 模擬迴圈呼叫 coreSystems.update()
 *   3. 擊殺路徑呼叫 isGuard()/handleGuardKill()/sharePartyXp()
 *   4. 攻擊守衛前呼叫 canAttackGuard()
 *   5. onJoin/onLeave 呼叫 onPlayerJoin()/onPlayerLeave()
 *   6. 玩家攻擊力使用 getPlayerDamage()
 */
import { Room, Client } from "colyseus";
import { GameState, Player, Item, Enemy } from "../rooms/schema/GameState";
import {
    GAME_CONSTANTS,
    getRankTitle,
    SOCIETY_SHOP_ITEMS,
    SOCIETY_CONFIG,
    SocietyRole,
    normalizeSocietyRole,
    getWeaponDef,
    getWeaponDisplayName,
    WEAPON_ENHANCE_CONFIG,
} from "@gangs-online/shared";
import { WeaponEnhanceSystem } from "./WeaponEnhanceSystem";
import { TerritorySystem } from "./TerritorySystem";
import { PartySystem } from "./PartySystem";
import { ProgressionSystem } from "./ProgressionSystem";
import { societyService } from "../services/SocietyService";
import { guildService } from "../services/GuildService";
import { savePlayer } from "../data/persistence";

export class CoreSystemsExtension {
    readonly weaponEnhance = new WeaponEnhanceSystem();
    readonly territory = new TerritorySystem();
    readonly party = new PartySystem();

    private room!: Room<GameState>;
    private progression!: ProgressionSystem;

    async initialize(room: Room<GameState>, progression: ProgressionSystem): Promise<void> {
        this.room = room;
        this.progression = progression;
        this.party.initialize(room);
        await this.territory.initialize(room);
        this.registerHandlers();
        console.log("✅ [Phase 21] Core systems extension initialized");
    }

    /** 每個模擬 tick 呼叫（守衛 AI / 重生） */
    update(): void {
        this.territory.update();
    }

    /** 玩家實際攻擊力 = 基礎 + 武器加成 */
    getPlayerDamage(player: Player): number {
        return GAME_CONSTANTS.ATTACK_DAMAGE + (player.attackBonus || 0);
    }

    isGuard(enemyId: string): boolean {
        return this.territory.isGuard(enemyId);
    }

    canAttackGuard(player: Player, enemyId: string): string | null {
        return this.territory.canAttackGuard(player, enemyId);
    }

    /**
     * 守衛被擊殺的完整結算（經驗/掉落/換旗/組隊分享），取代一般擊殺流程
     */
    handleGuardKill(client: Client, killer: Player, enemyId: string): void {
        const { xp, messages } = this.territory.handleGuardKilled(client, killer, enemyId);
        messages.forEach((m) => client.send("notification", m));

        const newLevel = this.progression.awardXP(killer, xp);
        if (newLevel !== null) {
            this.room.broadcast("chat", {
                sessionId: "SYSTEM",
                text: `🎉 ${killer.name} 升職了！現在是 ${getRankTitle(newLevel)} (Lv${newLevel})`,
            });
        }
        this.sharePartyXp(killer, xp, killer.x, killer.z);
    }

    /**
     * 組隊經驗分享：範圍內每位隊員各得「全額」經驗
     */
    sharePartyXp(killer: Player, xp: number, killX: number, killZ: number): void {
        const members = this.party.getXpShareMembers(killer, killX, killZ);
        members.forEach(({ player, client }) => {
            const newLevel = this.progression.awardXP(player, xp);
            client.send("notification", `[隊伍] 獲得 ${xp} 經驗（${killer.name} 的擊殺）`);
            if (newLevel !== null) {
                this.room.broadcast("chat", {
                    sessionId: "SYSTEM",
                    text: `🎉 ${player.name} 升職了！現在是 ${getRankTitle(newLevel)} (Lv${newLevel})`,
                });
            }
        });
    }

    /** 玩家加入：載入社團職級與貢獻度到 schema */
    async onPlayerJoin(player: Player): Promise<void> {
        if (!player.guildId || !player.firebaseUid) return;
        try {
            const doc = await societyService.getSocietyDoc(player.guildId);
            if (doc) {
                player.societyRole = societyService.getMemberRole(doc, player.firebaseUid) || "";
                player.contribution = doc.society?.contributions?.[player.firebaseUid] || 0;
            }
        } catch (e) {
            console.error("[Phase 21] 載入社團職級失敗:", e);
        }
    }

    /** 玩家離開：清理隊伍 */
    onPlayerLeave(sessionId: string, player: Player | undefined): void {
        this.party.onPlayerLeave(sessionId, player);
    }

    // ==================== Message Handlers ====================

    private registerHandlers(): void {
        const room = this.room;

        const getPlayer = (client: Client): Player | undefined => {
            const p = room.state.players.get(client.sessionId);
            return p && p.hp > 0 ? p : undefined;
        };

        // ---------- 武器升級 ----------
        room.onMessage("enhanceWeapon", (client, payload: { itemIndex: number }) => {
            const player = getPlayer(client);
            if (!player) return;
            this.weaponEnhance.handleEnhance(client, player, payload.itemIndex);
        });

        room.onMessage("equipWeapon", (client, payload: { itemIndex: number }) => {
            const player = getPlayer(client);
            if (!player) return;
            this.weaponEnhance.handleEquip(client, player, payload.itemIndex);
        });

        // ---------- 社團 ----------
        room.onMessage("societyInfo", async (client) => {
            const player = room.state.players.get(client.sessionId);
            if (!player || !player.guildId) {
                client.send("societyInfo", null);
                return;
            }
            const doc = await societyService.getSocietyDoc(player.guildId);
            if (!doc || !doc.society) { client.send("societyInfo", null); return; }
            const myRole = societyService.getMemberRole(doc, player.firebaseUid) || "四九仔";
            player.societyRole = myRole;
            player.contribution = doc.society.contributions?.[player.firebaseUid] || 0;

            // 成員名稱：優先用線上玩家的即時名稱，離線玩家從 guildService（players collection）解析
            const onlineNames = new Map<string, string>();
            room.state.players.forEach((p) => { if (p.firebaseUid) onlineNames.set(p.firebaseUid, p.name); });
            const guildWithNames = await guildService.getGuild(player.guildId);

            client.send("societyInfo", {
                id: doc.id,
                name: doc.name,
                level: doc.society.level,
                exp: doc.society.exp,
                nextLevelExp: SOCIETY_CONFIG.LEVEL_EXP_THRESHOLDS[doc.society.level - 1] ?? null,
                funds: doc.society.funds,
                memberCap: societyService.getMemberCap(doc.society),
                memberCount: doc.memberCount,
                members: Object.entries(doc.members).map(([uid, m]) => ({
                    userId: uid,
                    name: onlineNames.get(uid) || guildWithNames?.members[uid]?.name || `玩家${uid.substring(0, 6)}`,
                    role: normalizeSocietyRole(m.role),
                    joinTime: m.joinTime,
                    contribution: doc.society!.contributions?.[uid] || 0,
                    totalContribution: doc.society!.totalContributions?.[uid] || 0,
                })),
                warehouse: doc.society.warehouse,
                myRole,
                myContribution: player.contribution,
                shopItems: SOCIETY_SHOP_ITEMS.filter((i) => i.minSocietyLevel <= doc.society!.level),
            });
        });

        room.onMessage("societyAppoint", async (client, payload: { targetUserId: string; role: SocietyRole }) => {
            const player = room.state.players.get(client.sessionId);
            if (!player || !player.guildId || !player.firebaseUid) return;
            const result = await societyService.appointRole(player.guildId, player.firebaseUid, payload.targetUserId, payload.role);
            if (result.success) {
                client.send("notification", `任免成功：該成員現在是「${payload.role}」`);
                // 若目標在線，同步其 schema
                room.state.players.forEach((p) => {
                    if (p.firebaseUid === payload.targetUserId) p.societyRole = payload.role;
                });
            } else {
                client.send("notification", result.error);
            }
        });

        room.onMessage("societyDonate", async (client, payload: { gold: number }) => {
            const player = getPlayer(client);
            if (!player || !player.guildId || !player.firebaseUid) return;
            const gold = Math.floor(payload.gold || 0);
            if (gold <= 0 || player.money < gold) {
                client.send("notification", "金幣不足"); return;
            }
            player.money -= gold; // 先扣，失敗退回
            const result = await societyService.donate(player.guildId, player.firebaseUid, gold);
            if (result.success) {
                player.contribution = result.total;
                client.send("notification", `捐獻 $${gold}，獲得 ${result.gained} 貢獻度（現有 ${result.total}）`);
                if (result.leveledUp) {
                    room.broadcast("chat", {
                        sessionId: "SYSTEM",
                        text: `🏮 社團「${player.guildName}」升級到 Lv${result.societyLevel}！`,
                    });
                }
                savePlayer(player, player.firebaseUid);
            } else {
                player.money += gold;
                client.send("notification", result.error);
            }
        });

        room.onMessage("societyDeposit", async (client, payload: { itemIndex: number }) => {
            const player = getPlayer(client);
            if (!player || !player.guildId || !player.firebaseUid) return;
            const idx = payload.itemIndex;
            if (idx < 0 || idx >= player.inventory.length) return;
            const item = player.inventory.at(idx)!;
            const result = await societyService.warehouseDeposit(player.guildId, player.firebaseUid, {
                id: item.baseId || item.id,
                name: item.name,
                type: item.type,
                value: item.value,
                enhanceLevel: item.enhanceLevel,
                quantity: 1,
            });
            if (result.success) {
                player.inventory.deleteAt(idx);
                this.weaponEnhance.onInventoryRemoved(player, idx);
                client.send("notification", `已存入社團倉庫：${item.name}`);
            } else {
                client.send("notification", result.error);
            }
        });

        room.onMessage("societyWithdraw", async (client, payload: { warehouseIndex: number }) => {
            const player = getPlayer(client);
            if (!player || !player.guildId || !player.firebaseUid) return;
            const result = await societyService.warehouseWithdraw(player.guildId, player.firebaseUid, payload.warehouseIndex);
            if (result.success) {
                const w = result.item;
                const item = new Item();
                item.id = `${w.id}_${Date.now()}`;
                item.baseId = w.id;
                item.name = w.name;
                item.type = w.type as any;
                item.value = w.value;
                item.enhanceLevel = w.enhanceLevel || 0;
                player.inventory.push(item);
                client.send("notification", `已從社團倉庫取出：${w.name}`);
            } else {
                client.send("notification", result.error);
            }
        });

        room.onMessage("societyShopBuy", async (client, payload: { itemId: string }) => {
            const player = getPlayer(client);
            if (!player || !player.guildId || !player.firebaseUid) return;
            const result = await societyService.shopBuy(player.guildId, player.firebaseUid, payload.itemId);
            if (result.success) {
                const s = result.item;
                const item = new Item();
                item.id = `${s.itemId}_${Date.now()}`;
                item.baseId = s.itemId;
                item.name = s.name;
                item.type = s.type as any;
                item.value = s.value;
                player.inventory.push(item);
                player.contribution = result.remaining;
                client.send("notification", `兌換成功：${s.name}（剩餘貢獻度 ${result.remaining}）`);
            } else {
                client.send("notification", result.error);
            }
        });

        room.onMessage("societyDisband", async (client) => {
            const player = room.state.players.get(client.sessionId);
            if (!player || !player.guildId || !player.firebaseUid) return;
            const result = await societyService.disband(player.guildId, player.firebaseUid);
            if (result.success) {
                const name = result.name;
                // 清空所有在線成員的社團欄位
                room.state.players.forEach((p) => {
                    if (p.guildId === player.guildId) {
                        p.guildId = ""; p.guildName = ""; p.societyRole = ""; p.contribution = 0;
                    }
                });
                room.broadcast("chat", { sessionId: "SYSTEM", text: `社團「${name}」已解散` });
            } else {
                client.send("notification", result.error);
            }
        });

        // ---------- 地盤 ----------
        room.onMessage("territoryList", (client) => {
            const player = room.state.players.get(client.sessionId);
            const current = player ? this.territory.getTerritoryAt(player.x, player.z) : null;
            client.send("territoryList", {
                territories: this.territory.getStatusList(),
                currentTerritoryId: current?.id || "",
            });
        });

        room.onMessage("territoryDetail", (client, payload: { territoryId: string }) => {
            const t = this.territory.getTerritory(payload.territoryId);
            client.send("territoryDetail", t || null);
        });

        room.onMessage("territoryHireGuard", (client, payload: { territoryId: string; slot: number; level: number }) => {
            const player = getPlayer(client);
            if (!player) return;
            this.territory.hireGuard(client, player, payload.territoryId, payload.slot, payload.level);
        });

        room.onMessage("territoryClaim", (client, payload: { territoryId: string }) => {
            const player = getPlayer(client);
            if (!player) return;
            this.territory.claimTerritory(client, player, payload.territoryId);
        });

        // ---------- 組隊 ----------
        room.onMessage("partyInvite", (client, payload: { target: string }) => {
            const player = getPlayer(client);
            if (!player) return;
            this.party.invite(client, player, payload.target);
        });

        room.onMessage("partyAccept", (client) => {
            const player = getPlayer(client);
            if (!player) return;
            this.party.accept(client, player);
        });

        room.onMessage("partyDecline", (client) => this.party.decline(client));

        room.onMessage("partyLeave", (client) => {
            const player = room.state.players.get(client.sessionId);
            if (!player) return;
            this.party.leave(client, player);
        });

        room.onMessage("partyInfo", (client) => {
            const player = room.state.players.get(client.sessionId);
            client.send("partyUpdate", player?.partyId ? this.party.getPartyInfo(player.partyId) : null);
        });

        // ---------- 測試工具（測試套件：武器 + 強化石 + 金幣） ----------
        // 安全 gating：production 環境預設停用（除非明確設 ENABLE_TEST_TOOLS=true）
        const testToolsEnabled =
            process.env.ENABLE_TEST_TOOLS === "true" || process.env.NODE_ENV !== "production";
        if (!testToolsEnabled) {
            room.onMessage("giveTestKit", (client) => client.send("notification", "測試工具已停用"));
            room.onMessage("spawnTestEnemies", (client) => client.send("notification", "測試工具已停用"));
            return;
        }

        room.onMessage("giveTestKit", (client) => {
            const player = getPlayer(client);
            if (!player) return;
            const weaponDef = getWeaponDef("weapon_tang_sword")!;
            const weapon = new Item();
            weapon.id = `${weaponDef.id}_${Date.now()}`;
            weapon.baseId = weaponDef.id;
            weapon.name = getWeaponDisplayName(weaponDef.name, 0);
            weapon.type = "weapon";
            weapon.value = weaponDef.baseAttack;
            player.inventory.push(weapon);

            for (let i = 0; i < 20; i++) {
                const stone = new Item();
                stone.id = `enhance_stone_${Date.now()}_${i}`;
                stone.baseId = WEAPON_ENHANCE_CONFIG.ENHANCE_STONE_ITEM_ID;
                stone.name = "強化石";
                stone.type = "material";
                player.inventory.push(stone);
            }
            player.money += 100000;
            client.send("notification", "測試套件已發放：唐刀 x1、強化石 x20、$100,000");
        });

        // 測試工具：在玩家附近生成 5 隻練功用敵人（現有地圖出生點離原點極遠，舊生成邏輯不適用）
        let testEnemyCounter = 0;
        room.onMessage("spawnTestEnemies", (client) => {
            const player = getPlayer(client);
            if (!player) return;
            for (let i = 0; i < 5; i++) {
                const enemy = new Enemy();
                enemy.id = `mob_thug_test_${++testEnemyCounter}`;
                const angle = (i / 5) * Math.PI * 2;
                // 生成在仇恨範圍（ENEMY_DETECT_RANGE=10）之外，避免立即圍攻玩家
                enemy.x = player.x + Math.cos(angle) * 15;
                enemy.z = player.z + Math.sin(angle) * 15;
                enemy.name = "街頭混混";
                enemy.hp = 50;
                enemy.maxHp = 50;
                enemy.type = "enemy";
                enemy.npcType = "gangs";
                room.state.enemies.set(enemy.id, enemy);
                console.log(`🧪 [TestEnemy] Spawned ${enemy.id} at (${enemy.x.toFixed(1)}, ${enemy.z.toFixed(1)})`);
            }
            client.send("notification", "已在 15 米外生成 5 隻街頭混混（練功測試用，靠近才會被攻擊）");
        });
    }
}

export const coreSystems = new CoreSystemsExtension();
