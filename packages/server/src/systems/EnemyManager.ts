import { MapSchema } from "@colyseus/schema";
import { Enemy } from "../rooms/schema/GameState";
import { Player } from "../rooms/schema/GameState";
import { GAME_CONSTANTS } from "@gangs-online/shared";

/**
 * EnemyManager - 獨立的敵人管理系統
 * 負責：
 * 1. 生成敵人
 * 2. 敵人 AI（偵測、追逐、攻擊）
 * 3. 敵人重生
 */
export class EnemyManager {
    private enemies: MapSchema<Enemy>;
    private players: MapSchema<Player>;
    private enemyIdCounter: number = 0;

    constructor(enemies: MapSchema<Enemy>, players: MapSchema<Player>) {
        this.enemies = enemies;
        this.players = players;
    }

    /**
     * 初始化：生成初始敵人
     */
    initialize(): void {
        console.log(`🧟 Spawning ${GAME_CONSTANTS.ENEMY_SPAWN_COUNT} enemies...`);
        for (let i = 0; i < GAME_CONSTANTS.ENEMY_SPAWN_COUNT; i++) {
            this.spawnEnemy();
        }
    }

    /**
     * 生成一個敵人
     */
    spawnEnemy(): Enemy {
        const enemy = new Enemy();
        enemy.id = `enemy_${this.enemyIdCounter++}`;
        enemy.x = Math.random() * 40 - 20;
        enemy.z = Math.random() * 40 - 20;
        enemy.name = "街頭混混";
        enemy.hp = 50;
        enemy.maxHp = 50;
        enemy.state = "idle";

        this.enemies.set(enemy.id, enemy);
        console.log(`🧟 Spawned enemy: ${enemy.id} at (${enemy.x.toFixed(2)}, ${enemy.z.toFixed(2)})`);

        return enemy;
    }

    /**
     * 移除敵人
     */
    removeEnemy(enemyId: string): void {
        if (this.enemies.has(enemyId)) {
            this.enemies.delete(enemyId);
            console.log(`💀 Enemy ${enemyId} removed`);
        }
    }

    /**
     * AI 更新迴圈（每幀調用）
     * @param deltaTime - 時間差（毫秒）
     */
    update(deltaTime: number): void {
        // 收集需要移除的死亡敵人
        const deadEnemies: string[] = [];

        this.enemies.forEach((enemy, enemyId) => {
            // Phase 9: 跳過 NPC（NPC 是靜態的，不需要 AI）
            if (enemy.type === 'npc') {
                return;
            }

            if (enemy.hp <= 0) {
                // 收集死亡敵人 ID，稍後移除
                deadEnemies.push(enemyId);
                return;
            }

            // 尋找最近的活著的玩家
            const nearestPlayer = this.findNearestPlayer(enemy);

            if (nearestPlayer) {
                const distance = this.calculateDistance(enemy, nearestPlayer);

                if (distance < GAME_CONSTANTS.ENEMY_DETECT_RANGE) {
                    // 在偵測範圍內
                    if (distance > GAME_CONSTANTS.ATTACK_RANGE - 0.5) {
                        // 追逐模式
                        this.chasePlayer(enemy, nearestPlayer, distance);
                    } else {
                        // 攻擊模式
                        this.attackPlayer(enemy, nearestPlayer);
                    }
                } else {
                    // 閒置模式
                    enemy.state = "idle";
                }
            } else {
                // 沒有玩家，閒置
                enemy.state = "idle";
            }
        });

        // 清理所有死亡的敵人（避免在迭代中修改 Map）
        deadEnemies.forEach((enemyId) => {
            console.log(`🧹 Auto-removing dead enemy: ${enemyId}`);
            this.removeEnemy(enemyId);
        });
    }

    /**
     * 尋找最近的玩家
     */
    private findNearestPlayer(enemy: Enemy): Player | null {
        let nearestPlayer: Player | null = null;
        let minDistance = Infinity;

        this.players.forEach((player) => {
            if (player.hp <= 0) return; // 跳過死亡的玩家

            const distance = this.calculateDistance(enemy, player);
            if (distance < minDistance) {
                minDistance = distance;
                nearestPlayer = player;
            }
        });

        return nearestPlayer;
    }

    /**
     * 計算距離
     */
    private calculateDistance(entity1: { x: number; z: number }, entity2: { x: number; z: number }): number {
        const dx = entity1.x - entity2.x;
        const dz = entity1.z - entity2.z;
        return Math.sqrt(dx * dx + dz * dz);
    }

    /**
     * 追逐玩家
     */
    private chasePlayer(enemy: Enemy, player: Player, distance: number): void {
        enemy.state = "chase";

        // 計算移動方向
        const dx = player.x - enemy.x;
        const dz = player.z - enemy.z;

        // 正規化並移動
        enemy.x += (dx / distance) * GAME_CONSTANTS.ENEMY_SPEED;
        enemy.z += (dz / distance) * GAME_CONSTANTS.ENEMY_SPEED;
    }

    /**
     * 攻擊玩家
     */
    private attackPlayer(enemy: Enemy, player: Player): void {
        enemy.state = "attack";

        // 隨機機率攻擊（避免每幀都造成傷害）
        if (Math.random() < GAME_CONSTANTS.ENEMY_ATTACK_CHANCE) {
            player.hp -= GAME_CONSTANTS.ENEMY_ATTACK_DAMAGE;
            console.log(`🧟 ${enemy.name} attacked ${player.name} for ${GAME_CONSTANTS.ENEMY_ATTACK_DAMAGE} damage! HP: ${player.hp}/${player.maxHp}`);

            if (player.hp <= 0) {
                player.hp = 0;
                console.log(`💀 Player ${player.name} was killed by ${enemy.name}`);
            }
        }
    }

    /**
     * 敵人受到傷害
     * @returns 是否死亡
     */
    takeDamage(enemyId: string, damage: number): boolean {
        const enemy = this.enemies.get(enemyId);
        if (!enemy) return false;

        enemy.hp -= damage;
        console.log(`🗡️ Enemy ${enemyId} took ${damage} damage! HP: ${enemy.hp}/${enemy.maxHp}`);

        if (enemy.hp <= 0) {
            enemy.hp = 0;
            return true; // 死亡
        }

        return false; // 仍然存活
    }
}
