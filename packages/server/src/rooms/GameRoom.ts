import { Room, Client } from "colyseus";
import { GameState, Player, Enemy } from "./schema/GameState";
import { IPlayerInput, GAME_CONSTANTS } from "@gangs-online/shared";

export class GameRoom extends Room<GameState> {
    maxClients = 50;

    onCreate(options: any) {
        console.log("Gangs Online: Room Created");
        this.setState(new GameState());

        // Setup AI Loop (Tick 20 times per second = 50ms)
        this.setSimulationInterval((deltaTime) => this.update(deltaTime));

        // Spawn Initial Enemies (Near spawn area: -10 to 10)
        console.log(`[NPC] Spawning ${GAME_CONSTANTS.ENEMY_SPAWN_COUNT} enemies...`);

        // Delay to ensure at least one player is connected to receive messages
        this.clock.setTimeout(() => {
            this.broadcast("chat", { sessionId: "DEBUG", text: `🎮 Spawning ${GAME_CONSTANTS.ENEMY_SPAWN_COUNT} NPCs...` });

            for(let i=0; i<GAME_CONSTANTS.ENEMY_SPAWN_COUNT; i++) {
                const enemy = new Enemy();
                enemy.id = `mob_${i}`;
                enemy.x = Math.random() * 20 - 10; // Closer to player spawn (-10 to 10)
                enemy.z = Math.random() * 20 - 10;
                enemy.name = "Street Thug";
                this.state.enemies.set(enemy.id, enemy);
                console.log(`[NPC] Spawned ${enemy.name} [${enemy.id}] at (${enemy.x.toFixed(2)}, ${enemy.z.toFixed(2)})`);
            }

            this.broadcast("chat", { sessionId: "DEBUG", text: `✅ Spawned ${this.state.enemies.size} NPCs` });
            console.log(`[NPC] ✓ All ${GAME_CONSTANTS.ENEMY_SPAWN_COUNT} enemies spawned`);
        }, 1000);

        this.onMessage("move", (client, input: IPlayerInput) => {
            const player = this.state.players.get(client.sessionId);
            if (player && player.hp > 0) {
                player.x = input.x;
                player.z = input.z;
            }
        });

        // Updated Attack Handler (Player vs Player OR Player vs Enemy)
        this.onMessage("attack", (client, payload: { targetId: string, type: 'player' | 'enemy' }) => {
            const attacker = this.state.players.get(client.sessionId);
            let target: Player | Enemy | undefined;

            if (payload.type === 'player') {
                target = this.state.players.get(payload.targetId);
            } else if (payload.type === 'enemy') {
                target = this.state.enemies.get(payload.targetId);
            }

            if (attacker && target && attacker.hp > 0 && target.hp > 0) {
                const dx = attacker.x - target.x;
                const dz = attacker.z - target.z;
                const dist = Math.sqrt(dx * dx + dz * dz);

                if (dist <= GAME_CONSTANTS.ATTACK_RANGE) {
                    target.hp -= GAME_CONSTANTS.ATTACK_DAMAGE;

                    if (target.hp <= 0) {
                        target.hp = 0;
                        this.broadcast("chat", { sessionId: "SYSTEM", text: `${attacker.name} killed ${target.name}!` });

                        // Respawn Logic
                        if (payload.type === 'player') {
                            this.clock.setTimeout(() => this.respawnPlayer(payload.targetId), 3000);
                        } else {
                            // Remove enemy and spawn new one later
                            this.state.enemies.delete(payload.targetId);
                            this.clock.setTimeout(() => this.spawnEnemy(), 5000);
                        }
                    }
                }
            }
        });

        this.onMessage("chat", (client, message: string) => {
            // Debug commands
            if (message === "/npcs") {
                client.send("chat", { sessionId: "DEBUG", text: `📍 NPC Positions (${this.state.enemies.size} total):` });
                this.state.enemies.forEach((enemy, id) => {
                    const dist = Math.sqrt(
                        Math.pow(this.state.players.get(client.sessionId)!.x - enemy.x, 2) +
                        Math.pow(this.state.players.get(client.sessionId)!.z - enemy.z, 2)
                    );
                    client.send("chat", { sessionId: "DEBUG", text: `${id}: (${enemy.x.toFixed(1)}, ${enemy.z.toFixed(1)}) ${dist.toFixed(1)}m away [${enemy.state}]` });
                });
                return;
            }

            if (message === "/help") {
                client.send("chat", { sessionId: "DEBUG", text: `Commands: /npcs, /help` });
                return;
            }

            this.broadcast("chat", { sessionId: client.sessionId, text: message });
        });
    }

    // AI Loop
    update(deltaTime: number) {
        this.state.enemies.forEach(enemy => {
            if (enemy.hp <= 0) return;

            let nearestPlayer: Player | null = null;
            let minDist = 9999;

            // Find nearest player
            this.state.players.forEach(player => {
                if (player.hp <= 0) return;
                const dx = player.x - enemy.x;
                const dz = player.z - enemy.z;
                const dist = Math.sqrt(dx*dx + dz*dz);
                if (dist < minDist) {
                    minDist = dist;
                    nearestPlayer = player;
                }
            });

            if (nearestPlayer && minDist < GAME_CONSTANTS.ENEMY_DETECT_RANGE) {
                if (minDist > GAME_CONSTANTS.ATTACK_RANGE - 0.5) {
                    // Chase
                    enemy.state = "chase";
                    const dx = nearestPlayer.x - enemy.x;
                    const dz = nearestPlayer.z - enemy.z;
                    // Normalize and move
                    enemy.x += (dx / minDist) * GAME_CONSTANTS.ENEMY_SPEED;
                    enemy.z += (dz / minDist) * GAME_CONSTANTS.ENEMY_SPEED;
                } else {
                    // Attack (Simple cooldown logic could go here)
                    enemy.state = "attack";
                    if (Math.random() < 0.02) { // Random chance to hit per tick
                        nearestPlayer.hp -= 5;
                         if (nearestPlayer.hp <= 0) {
                             nearestPlayer.hp = 0;
                             this.respawnPlayer(nearestPlayer.sessionId);
                         }
                    }
                }
            } else {
                enemy.state = "idle";
            }
        });
    }

    respawnPlayer(sessionId: string) {
        const p = this.state.players.get(sessionId);
        if (p) {
            p.hp = p.maxHp;
            p.x = Math.random() * 10 - 5;
            p.z = Math.random() * 10 - 5;
        }
    }

    spawnEnemy() {
        const enemy = new Enemy();
        enemy.id = `mob_${Math.random().toString(36).substr(2, 5)}`;
        enemy.x = Math.random() * 20 - 10; // Closer to player spawn (-10 to 10)
        enemy.z = Math.random() * 20 - 10;
        enemy.name = "Street Thug";
        this.state.enemies.set(enemy.id, enemy);
        console.log(`[NPC] Respawned ${enemy.name} [${enemy.id}] at (${enemy.x.toFixed(2)}, ${enemy.z.toFixed(2)})`);
    }

    onJoin(client: Client, options: any) {
        const player = new Player();
        player.sessionId = client.sessionId;
        player.x = Math.random() * 10 - 5;
        player.z = Math.random() * 10 - 5;
        player.name = options.name || `Gangster ${client.sessionId.substr(0, 4)}`;
        this.state.players.set(client.sessionId, player);

        // Send welcome message with NPC count
        this.clock.setTimeout(() => {
            client.send("chat", { sessionId: "DEBUG", text: `📊 NPCs active: ${this.state.enemies.size}` });
            client.send("chat", { sessionId: "DEBUG", text: `📍 Player spawn: (${player.x.toFixed(1)}, ${player.z.toFixed(1)})` });
        }, 500);
    }

    onLeave(client: Client) {
        this.state.players.delete(client.sessionId);
    }
}
