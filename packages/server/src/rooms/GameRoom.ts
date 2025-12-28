import { Room, Client } from "colyseus";
import { GameState, Player, Item } from "./schema/GameState";
import { IPlayerInput, GAME_CONSTANTS, EntityType, getRankTitle, IQuestDef } from "@gangs-online/shared";
import { EnemyManager } from "../systems/EnemyManager";
import { ProgressionSystem } from "../systems/ProgressionSystem";
import { LootSystem } from "../systems/LootSystem"; // Phase 8
import { SafeZoneSystem } from "../systems/SafeZoneSystem"; // Phase 9
import { ShopSystem } from "../systems/ShopSystem"; // Phase 9
import { NPCManager } from "../systems/NPCManager"; // Phase 9
import { QuestManager } from "../systems/QuestManager"; // Phase 10
import { initializeFirebase } from "../services/FirebaseService"; // Phase 12
import { savePlayer, loadPlayer } from "../data/persistence"; // Phase 12

export class GameRoom extends Room<GameState> {
    maxClients = 50;
    firstPlayerSessionId: string | null = null; // Track first player for special advantage
    private enemyManager!: EnemyManager; // 敵人管理系統
    private progressionSystem!: ProgressionSystem; // 進度系統 (Phase 7)
    private lootSystem!: LootSystem; // 戰利品系統 (Phase 8)
    private safeZoneSystem!: SafeZoneSystem; // 安全區系統 (Phase 9)
    private shopSystem!: ShopSystem; // 商店系統 (Phase 9)
    private npcManager!: NPCManager; // NPC 管理系統 (Phase 9)
    private questManager!: QuestManager; // 任務管理系統 (Phase 10)

    onCreate(options: any) {
        console.log("Gangs Online: Room Created");
        this.setState(new GameState());

        // Phase 12: 初始化 Firebase
        initializeFirebase();

        // 初始化敵人管理系統
        this.enemyManager = new EnemyManager(this.state.enemies, this.state.players);
        this.enemyManager.initialize();

        // 初始化進度系統 (Phase 7)
        this.progressionSystem = new ProgressionSystem();

        // 初始化戰利品系統 (Phase 8)
        this.lootSystem = new LootSystem(this);

        // 初始化安全區系統 (Phase 9)
        this.safeZoneSystem = new SafeZoneSystem();

        // 初始化商店系統 (Phase 9)
        this.shopSystem = new ShopSystem();

        // 初始化 NPC 管理系統 (Phase 9)
        this.npcManager = new NPCManager(this.state.enemies);
        this.npcManager.initialize();

        // 初始化任務管理系統 (Phase 10)
        this.questManager = new QuestManager();
        // 生成任務 NPC - 浩南哥
        this.npcManager.spawnQuestNPC("npc_quest", 5, 5, "浩南 (Quest)");

        // 設置 AI 更新迴圈（每 50ms 執行一次 = 20 FPS）
        this.setSimulationInterval((deltaTime) => {
            this.enemyManager.update(deltaTime);
        });

        // Handle Movement
        this.onMessage("move", (client, input: IPlayerInput) => {
            const player = this.state.players.get(client.sessionId);
            if (player && player.hp > 0) { // Can only move if alive
                player.x = input.x;
                player.z = input.z;
            }
        });

        // Handle Attack (支援攻擊玩家或敵人) - Phase 9: 增加安全區檢查
        this.onMessage("attack", (client, payload: { targetId: string; type: EntityType }) => {
            const attacker = this.state.players.get(client.sessionId);

            if (!attacker || attacker.hp <= 0) {
                console.log(`❌ Attack failed: attacker not found or dead`);
                return; // 攻擊者不存在或已死亡
            }

            // Phase 9: 檢查攻擊者是否在安全區內
            if (this.safeZoneSystem.isInSafeZone(attacker.x, attacker.z)) {
                client.send("notification", "這裡是安全區，不能打架！");
                return;
            }

            if (payload.type === "player") {
                // 攻擊玩家（PVP）
                this.handlePlayerVsPlayer(client, attacker, payload.targetId);
            } else if (payload.type === "enemy") {
                // 診斷：檢查敵人是否存在
                const enemy = this.state.enemies.get(payload.targetId);
                if (!enemy) {
                    console.log(`❌ Attack failed: enemy ${payload.targetId} not found on server!`);
                    console.log(`Current enemies:`, Array.from(this.state.enemies.keys()));
                    return;
                }

                // Phase 9: 檢查是否攻擊 NPC
                if (this.npcManager.isNPC(payload.targetId)) {
                    client.send("notification", "唔好打十三叔！佢係好人嚟架！");
                    return;
                }

                console.log(`✅ Attacking enemy ${payload.targetId}, HP: ${enemy.hp}/${enemy.maxHp}`);
                // 攻擊敵人（PVE） - Phase 10: 傳入 client 用於任務更新
                this.handlePlayerVsEnemy(client, attacker, payload.targetId);
            }
        });

        // --- NEW: CHAT HANDLER ---
        this.onMessage("chat", (client, message: string) => {
            const player = this.state.players.get(client.sessionId);
            if (player) {
                // Broadcast to everyone including sender
                this.broadcast("chat", { sessionId: client.sessionId, text: message });
            }
        });

        // --- PHASE 8: PICKUP ITEM HANDLER ---
        this.onMessage("pickup", (client, lootId: string) => {
            const player = this.state.players.get(client.sessionId);
            const loot = this.state.lootItems.get(lootId);

            if (player && loot && player.hp > 0) {
                // 檢查距離
                if (this.lootSystem.isInPickupRange(player.x, player.z, loot.x, loot.z)) {
                    // 添加到背包
                    if (loot.item.type === 'currency') {
                        // 金錢直接加到 money
                        player.money += loot.item.value;
                        client.send("notification", `執到 $${loot.item.value}`);
                    } else {
                        // 消耗品加到背包
                        const newItem = new Item();
                        newItem.id = loot.item.id;
                        newItem.name = loot.item.name;
                        newItem.type = loot.item.type;
                        newItem.value = loot.item.value;
                        player.inventory.push(newItem);
                        client.send("notification", `執到 ${loot.item.name}`);
                    }

                    // 從世界中移除
                    this.state.lootItems.delete(lootId);
                }
            }
        });

        // --- PHASE 8: USE ITEM HANDLER ---
        this.onMessage("useItem", (client, itemIndex: number) => {
            const player = this.state.players.get(client.sessionId);

            if (player && player.hp > 0 && itemIndex >= 0 && itemIndex < player.inventory.length) {
                const item = player.inventory.at(itemIndex);

                if (item && item.type === 'consumable') {
                    // 恢復 HP
                    const healAmount = item.value;
                    player.hp = Math.min(player.hp + healAmount, player.maxHp);

                    // 從背包中移除
                    player.inventory.deleteAt(itemIndex);

                    client.send("notification", `食咗 ${item.name}，回復 ${healAmount} HP`);
                }
            }
        });

        // --- PHASE 9: BUY ITEM HANDLER ---
        this.onMessage("buy", (client, itemId: string) => {
            const player = this.state.players.get(client.sessionId);
            if (player && player.hp > 0) {
                this.shopSystem.handlePurchase(client, player, itemId);
            }
        });

        // --- PHASE 10: QUEST HANDLERS ---
        this.onMessage("acceptQuest", (client, questId: string) => {
            console.log("📋 [Server] acceptQuest received, questId:", questId);
            const player = this.state.players.get(client.sessionId);
            console.log("📋 [Server] Player found:", player ? player.name : "NOT FOUND");
            if (player && player.hp > 0) {
                // 檢查是否靠近任務 NPC
                const questNpc = this.state.enemies.get("npc_quest");
                console.log("📋 [Server] questNpc:", questNpc ? `found at (${questNpc.x}, ${questNpc.z})` : "NOT FOUND");
                if (questNpc) {
                    const dist = Math.sqrt(
                        Math.pow(player.x - questNpc.x, 2) + Math.pow(player.z - questNpc.z, 2)
                    );
                    console.log("📋 [Server] Distance:", dist, "Max allowed:", GAME_CONSTANTS.SHOP_INTERACTION_RANGE);
                    if (dist <= GAME_CONSTANTS.SHOP_INTERACTION_RANGE) {
                        console.log("📋 [Server] Calling questManager.acceptQuest...");
                        this.questManager.acceptQuest(client, player, questId);
                    } else {
                        console.log("📋 [Server] Too far from NPC!");
                        client.send("notification", "離浩南哥太遠了！");
                    }
                } else {
                    console.log("📋 [Server] ERROR: npc_quest not found in enemies!");
                    console.log("📋 [Server] Available enemies:", Array.from(this.state.enemies.keys()));
                }
            }
        });

        this.onMessage("completeQuest", (client) => {
            const player = this.state.players.get(client.sessionId);
            if (player && player.hp > 0) {
                // 檢查是否靠近任務 NPC
                const questNpc = this.state.enemies.get("npc_quest");
                if (questNpc) {
                    const dist = Math.sqrt(
                        Math.pow(player.x - questNpc.x, 2) + Math.pow(player.z - questNpc.z, 2)
                    );
                    if (dist <= GAME_CONSTANTS.SHOP_INTERACTION_RANGE) {
                        this.questManager.completeQuest(client, player, (type, data) =>
                            this.broadcast(type, data)
                        );
                    } else {
                        client.send("notification", "離浩南哥太遠了！");
                    }
                }
            }
        });

        this.onMessage("abandonQuest", (client) => {
            const player = this.state.players.get(client.sessionId);
            if (player) {
                this.questManager.abandonQuest(client, player);
            }
        });

        this.onMessage("getQuestInfo", (client) => {
            // 發送可用任務信息到客戶端
            const quest = this.questManager.getFirstAvailableQuest();
            if (quest) {
                client.send("questInfo", quest);
            }
        });

        // Auto-Combat Loop (runs every ATTACK_INTERVAL) - 0.7.1: 添加 PvE 支援
        this.clock.setInterval(() => {
            this.state.players.forEach((player) => {
                if (player.hp <= 0) return; // 跳過死亡玩家

                // PvP 戰鬥
                if (player.inCombatWith) {
                    const target = this.state.players.get(player.inCombatWith);

                    if (target && target.hp > 0) {
                        // Continue attacking
                        this.dealDamage(player, target);
                    } else {
                        // Target is dead or disconnected, end combat
                        player.inCombatWith = "";
                    }
                }

                // PvE 戰鬥（0.7.1）
                if (player.inCombatWithEnemy) {
                    const enemy = this.state.enemies.get(player.inCombatWithEnemy);

                    if (enemy && enemy.hp > 0) {
                        // 玩家攻擊敵人
                        const isDead = this.enemyManager.takeDamage(player.inCombatWithEnemy, GAME_CONSTANTS.ATTACK_DAMAGE);
                        console.log(`🗡️ ${player.name} hits ${enemy.name} for ${GAME_CONSTANTS.ATTACK_DAMAGE} damage! HP: ${enemy.hp}/${enemy.maxHp}`);

                        if (isDead) {
                            // 敵人死亡
                            const deadEnemyId = player.inCombatWithEnemy; // 保存 ID 用於移除
                            console.log(`💀 Enemy ${deadEnemyId} was killed by ${player.name}`);
                            this.broadcast("chat", {
                                sessionId: "SYSTEM",
                                text: `${player.name} 擊敗了 ${enemy.name}！`,
                            });

                            // 獎勵經驗值
                            const xpGained = this.progressionSystem.getXPForEnemyKill();
                            const newLevel = this.progressionSystem.awardXP(player, xpGained);

                            if (newLevel !== null) {
                                const newTitle = getRankTitle(newLevel);
                                this.broadcast("chat", {
                                    sessionId: "SYSTEM",
                                    text: `🎉 ${player.name} 升職了！現在是 ${newTitle} (Lv${newLevel})`,
                                });
                            }

                            // Phase 8: 掉落戰利品
                            this.lootSystem.spawnLoot(enemy.x, enemy.z);

                            // Phase 10: 更新任務進度
                            const playerClient = this.clients.find((c) => c.sessionId === player.sessionId);
                            if (playerClient) {
                                this.questManager.updateKillProgress(playerClient, player, deadEnemyId);
                            }

                            // 結束戰鬥並移除敵人（修正 bug）
                            player.inCombatWithEnemy = "";
                            this.enemyManager.removeEnemy(deadEnemyId);
                            // 1 分鐘後重生 NPC
                            this.clock.setTimeout(() => {
                                this.enemyManager.spawnEnemy();
                            }, 60000); // 60 秒
                        } else {
                            // 敵人反擊
                            player.hp -= GAME_CONSTANTS.ENEMY_ATTACK_DAMAGE;
                            console.log(`🧟 ${enemy.name} hits ${player.name} for ${GAME_CONSTANTS.ENEMY_ATTACK_DAMAGE} damage! HP: ${player.hp}/${player.maxHp}`);

                            if (player.hp <= 0) {
                                player.hp = 0;
                                player.inCombatWithEnemy = "";
                                console.log(`💀 Player ${player.name} was killed by ${enemy.name}`);

                                // 重生玩家
                                this.clock.setTimeout(() => {
                                    if (this.state.players.has(player.sessionId)) {
                                        const respawnedPlayer = this.state.players.get(player.sessionId);
                                        if (respawnedPlayer) {
                                            respawnedPlayer.hp = respawnedPlayer.maxHp;
                                            respawnedPlayer.x = Math.random() * 10 - 5;
                                            respawnedPlayer.z = Math.random() * 10 - 5;
                                        }
                                    }
                                }, 3000);
                            }
                        }
                    } else {
                        // 敵人已死亡或不存在，結束戰鬥
                        player.inCombatWithEnemy = "";
                    }
                }
            });
        }, GAME_CONSTANTS.ATTACK_INTERVAL);
    }

    /**
     * 處理玩家對玩家的攻擊（PVP） - Phase 9: 增加安全區檢查
     */
    private handlePlayerVsPlayer(client: Client, attacker: Player, targetSessionId: string): void {
        const target = this.state.players.get(targetSessionId);

        if (target && target.hp > 0) {
            // Phase 9: 檢查目標是否在安全區內
            if (this.safeZoneSystem.isInSafeZone(target.x, target.z)) {
                client.send("notification", "對方在安全區內！");
                return;
            }

            // Check if not already in combat
            if (!attacker.inCombatWith && !target.inCombatWith) {
                // Calculate Distance
                const dx = attacker.x - target.x;
                const dz = attacker.z - target.z;
                const dist = Math.sqrt(dx * dx + dz * dz);

                // Validate Range
                if (dist <= GAME_CONSTANTS.ATTACK_RANGE) {
                    // START AUTO-COMBAT
                    attacker.inCombatWith = target.sessionId;
                    target.inCombatWith = attacker.sessionId;

                    console.log(`Combat started: ${attacker.sessionId} vs ${target.sessionId}`);

                    // Immediately deal first damage from both sides
                    this.dealDamage(attacker, target);
                    this.dealDamage(target, attacker);
                } else {
                    console.log(`Attack failed: Target out of range (${dist.toFixed(2)}m > ${GAME_CONSTANTS.ATTACK_RANGE}m)`);
                }
            }
        }
    }

    /**
     * 處理玩家對敵人的攻擊（PVE）- 0.7.1: 改為自動戰鬥模式
     * Phase 10: 添加 client 參數用於任務更新
     */
    private handlePlayerVsEnemy(client: Client, attacker: Player, enemyId: string): void {
        const enemy = this.state.enemies.get(enemyId);

        if (enemy && enemy.hp > 0) {
            // 檢查是否已經在戰鬥中
            if (attacker.inCombatWithEnemy || attacker.inCombatWith) {
                console.log(`Player ${attacker.name} is already in combat`);
                return;
            }

            // Calculate Distance
            const dx = attacker.x - enemy.x;
            const dz = attacker.z - enemy.z;
            const dist = Math.sqrt(dx * dx + dz * dz);

            // Validate Range
            if (dist <= GAME_CONSTANTS.ATTACK_RANGE) {
                // 開始自動戰鬥
                attacker.inCombatWithEnemy = enemyId;
                console.log(`⚔️ Auto-combat started: ${attacker.name} vs ${enemy.name}`);

                // 立即進行第一次攻擊
                const isDead = this.enemyManager.takeDamage(enemyId, GAME_CONSTANTS.ATTACK_DAMAGE);
                console.log(`🗡️ ${attacker.name} hits ${enemy.name} for ${GAME_CONSTANTS.ATTACK_DAMAGE} damage! HP: ${enemy.hp}/${enemy.maxHp}`);

                if (isDead) {
                    // 第一擊就擊殺
                    console.log(`💀 Enemy ${enemyId} was killed by ${attacker.name} (first strike)`);
                    this.broadcast("chat", {
                        sessionId: "SYSTEM",
                        text: `${attacker.name} 秒殺了 ${enemy.name}！`,
                    });

                    const xpGained = this.progressionSystem.getXPForEnemyKill();
                    const newLevel = this.progressionSystem.awardXP(attacker, xpGained);

                    if (newLevel !== null) {
                        const newTitle = getRankTitle(newLevel);
                        this.broadcast("chat", {
                            sessionId: "SYSTEM",
                            text: `🎉 ${attacker.name} 升職了！現在是 ${newTitle} (Lv${newLevel})`,
                        });
                    }

                    // Phase 8: 掉落戰利品
                    this.lootSystem.spawnLoot(enemy.x, enemy.z);

                    // Phase 10: 更新任務進度
                    this.questManager.updateKillProgress(client, attacker, enemyId);

                    // 清除戰鬥狀態並立即移除敵人
                    attacker.inCombatWithEnemy = "";
                    this.enemyManager.removeEnemy(enemyId);
                    console.log(`🧹 Removed dead enemy: ${enemyId}`);

                    // 1 分鐘後重生 NPC
                    this.clock.setTimeout(() => {
                        this.enemyManager.spawnEnemy();
                    }, 60000); // 60 秒
                }
                // 否則，自動戰鬥迴圈會繼續攻擊
            } else {
                console.log(`Attack failed: Enemy out of range (${dist.toFixed(2)}m > ${GAME_CONSTANTS.ATTACK_RANGE}m)`);
            }
        }
    }

    /**
     * 造成傷害（玩家對玩家）
     */
    dealDamage(attacker: Player, target: Player) {
        // Special advantage: First player (me) deals 50 damage, others deal 10
        const damage = attacker.sessionId === this.firstPlayerSessionId ? 50 : GAME_CONSTANTS.ATTACK_DAMAGE;

        target.hp -= damage;
        console.log(`${attacker.sessionId} hit ${target.sessionId} for ${damage} damage! HP: ${target.hp}/${target.maxHp}`);

        if (target.hp <= 0) {
            target.hp = 0;
            target.inCombatWith = ""; // Stop target from attacking

            // Stop attacker's combat
            attacker.inCombatWith = "";

            console.log(`Player ${target.sessionId} was killed by ${attacker.sessionId}`);

            // Special respawn for first player (me): immediate full heal
            if (target.sessionId === this.firstPlayerSessionId) {
                console.log(`First player died - instant respawn with full HP`);
                this.clock.setTimeout(() => {
                    if (this.state.players.has(target.sessionId)) {
                        const respawnedPlayer = this.state.players.get(target.sessionId);
                        if (respawnedPlayer) {
                            respawnedPlayer.hp = respawnedPlayer.maxHp;
                            respawnedPlayer.x = Math.random() * 10 - 5;
                            respawnedPlayer.z = Math.random() * 10 - 5;
                            console.log(`First player respawned`);
                        }
                    }
                }, 1000); // 1 second respawn for first player
            } else {
                // Regular respawn (3 seconds)
                this.clock.setTimeout(() => {
                    if (this.state.players.has(target.sessionId)) {
                        const respawnedPlayer = this.state.players.get(target.sessionId);
                        if (respawnedPlayer) {
                            respawnedPlayer.hp = respawnedPlayer.maxHp;
                            respawnedPlayer.x = Math.random() * 10 - 5;
                            respawnedPlayer.z = Math.random() * 10 - 5;
                            console.log(`Player ${target.sessionId} respawned`);
                        }
                    }
                }, 3000);
            }
        }
    }

    async onJoin(client: Client, options: any) {
        // Phase 12: 取得 Firebase UID 和用戶名
        const firebaseUid = options.userId || "";
        const username = options.username || `玩家${client.sessionId.substring(0, 6)}`;

        console.log(`Player ${username} (UID: ${firebaseUid}) joined Gangs Online`);

        // Track first player for special advantage
        if (!this.firstPlayerSessionId) {
            this.firstPlayerSessionId = client.sessionId;
            console.log(`First player detected: ${client.sessionId} - Will deal 50 damage per hit`);
        }

        const player = new Player();
        player.sessionId = client.sessionId;
        player.firebaseUid = firebaseUid; // Phase 12: 儲存 Firebase UID
        player.name = username;

        // Phase 12: 嘗試從 Firebase 載入已儲存的玩家資料
        let loaded = false;
        if (firebaseUid) {
            loaded = await loadPlayer(player, firebaseUid, this.questManager.getQuestDefinitions());
        }

        if (!loaded) {
            // 新玩家：使用預設值
            player.x = Math.random() * 10 - 5;
            player.z = Math.random() * 10 - 5;
            player.hp = 100;
            player.maxHp = 100;
            player.inCombatWith = "";
            player.inCombatWithEnemy = "";

            // === Phase 7: 初始化進度系統 ===
            this.progressionSystem.initializePlayer(player);

            // === Phase 8: 初始化背包系統 ===
            player.money = 0;
        } else {
            // 已載入的玩家：確保戰鬥狀態清空
            player.inCombatWith = "";
            player.inCombatWithEnemy = "";
        }

        this.state.players.set(client.sessionId, player);
    }

    async onLeave(client: Client, consented: boolean) {
        const leavingPlayer = this.state.players.get(client.sessionId);

        if (leavingPlayer) {
            // If player was in combat, end combat for opponent
            if (leavingPlayer.inCombatWith) {
                const opponent = this.state.players.get(leavingPlayer.inCombatWith);
                if (opponent) {
                    opponent.inCombatWith = "";
                }
            }

            // Phase 12: 儲存玩家資料到 Firebase
            if (leavingPlayer.firebaseUid) {
                await savePlayer(leavingPlayer, leavingPlayer.firebaseUid);
            }
        }

        this.state.players.delete(client.sessionId);
    }
}
