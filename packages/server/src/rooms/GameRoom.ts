import { Room, Client } from "colyseus";
import { GameState, Player } from "./schema/GameState";
import { IPlayerInput, GAME_CONSTANTS, EntityType } from "@gangs-online/shared";
import { EnemyManager } from "../systems/EnemyManager";

export class GameRoom extends Room<GameState> {
    maxClients = 50;
    firstPlayerSessionId: string | null = null; // Track first player for special advantage
    private enemyManager!: EnemyManager; // 敵人管理系統

    onCreate(options: any) {
        console.log("Gangs Online: Room Created");
        this.setState(new GameState());

        // 初始化敵人管理系統
        this.enemyManager = new EnemyManager(this.state.enemies, this.state.players);
        this.enemyManager.initialize();

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

        // Handle Attack (支援攻擊玩家或敵人)
        this.onMessage("attack", (client, payload: { targetId: string; type: EntityType }) => {
            const attacker = this.state.players.get(client.sessionId);

            if (!attacker || attacker.hp <= 0) {
                return; // 攻擊者不存在或已死亡
            }

            if (payload.type === "player") {
                // 攻擊玩家（PVP）
                this.handlePlayerVsPlayer(client, attacker, payload.targetId);
            } else if (payload.type === "enemy") {
                // 攻擊敵人（PVE）
                this.handlePlayerVsEnemy(attacker, payload.targetId);
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

        // Auto-Combat Loop (runs every ATTACK_INTERVAL)
        this.clock.setInterval(() => {
            this.state.players.forEach((player) => {
                if (player.inCombatWith && player.hp > 0) {
                    const target = this.state.players.get(player.inCombatWith);

                    if (target && target.hp > 0) {
                        // Continue attacking
                        this.dealDamage(player, target);
                    } else {
                        // Target is dead or disconnected, end combat
                        player.inCombatWith = "";
                    }
                }
            });
        }, GAME_CONSTANTS.ATTACK_INTERVAL);
    }

    /**
     * 處理玩家對玩家的攻擊（PVP）
     */
    private handlePlayerVsPlayer(client: Client, attacker: Player, targetSessionId: string): void {
        const target = this.state.players.get(targetSessionId);

        if (target && target.hp > 0) {
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
     * 處理玩家對敵人的攻擊（PVE）
     */
    private handlePlayerVsEnemy(attacker: Player, enemyId: string): void {
        const enemy = this.state.enemies.get(enemyId);

        if (enemy && enemy.hp > 0) {
            // Calculate Distance
            const dx = attacker.x - enemy.x;
            const dz = attacker.z - enemy.z;
            const dist = Math.sqrt(dx * dx + dz * dz);

            // Validate Range
            if (dist <= GAME_CONSTANTS.ATTACK_RANGE) {
                // 造成傷害
                const isDead = this.enemyManager.takeDamage(enemyId, GAME_CONSTANTS.ATTACK_DAMAGE);

                if (isDead) {
                    console.log(`💀 Enemy ${enemyId} was killed by ${attacker.name}`);
                    this.broadcast("chat", {
                        sessionId: "SYSTEM",
                        text: `${attacker.name} 擊敗了 ${enemy.name}！`,
                    });

                    // 移除敵人並延遲重生
                    this.enemyManager.removeEnemy(enemyId);
                    this.clock.setTimeout(() => {
                        this.enemyManager.spawnEnemy();
                    }, 5000); // 5 秒後重生新敵人
                }
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

    onJoin(client: Client, options: any) {
        console.log(`Player ${client.sessionId} joined Gangs Online`);

        // Track first player for special advantage
        if (!this.firstPlayerSessionId) {
            this.firstPlayerSessionId = client.sessionId;
            console.log(`First player detected: ${client.sessionId} - Will deal 50 damage per hit`);
        }

        const player = new Player();
        player.sessionId = client.sessionId;
        // Random Spawn
        player.x = Math.random() * 10 - 5;
        player.z = Math.random() * 10 - 5;
        // Initialize HP
        player.hp = 100;
        player.maxHp = 100;
        player.inCombatWith = "";
        this.state.players.set(client.sessionId, player);
    }

    onLeave(client: Client, consented: boolean) {
        // If player was in combat, end combat for opponent
        const leavingPlayer = this.state.players.get(client.sessionId);
        if (leavingPlayer && leavingPlayer.inCombatWith) {
            const opponent = this.state.players.get(leavingPlayer.inCombatWith);
            if (opponent) {
                opponent.inCombatWith = "";
            }
        }

        this.state.players.delete(client.sessionId);
    }
}
