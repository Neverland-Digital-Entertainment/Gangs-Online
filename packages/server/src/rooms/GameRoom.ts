import { Room, Client } from "colyseus";
import { GameState, Player } from "./schema/GameState";
import { IPlayerInput, GAME_CONSTANTS } from "@gangs-online/shared";

export class GameRoom extends Room<GameState> {
    maxClients = 50;
    firstPlayerSessionId: string | null = null; // Track first player for special advantage

    onCreate(options: any) {
        console.log("Gangs Online: Room Created");
        this.setState(new GameState());

        // Handle Movement
        this.onMessage("move", (client, input: IPlayerInput) => {
            const player = this.state.players.get(client.sessionId);
            if (player && player.hp > 0) { // Can only move if alive
                player.x = input.x;
                player.z = input.z;
            }
        });

        // Handle Attack (Start Combat)
        this.onMessage("attack", (client, payload: { targetSessionId: string }) => {
            const attacker = this.state.players.get(client.sessionId);
            const target = this.state.players.get(payload.targetSessionId);

            if (attacker && target && attacker.hp > 0 && target.hp > 0) {
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

    // Helper function to deal damage
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
