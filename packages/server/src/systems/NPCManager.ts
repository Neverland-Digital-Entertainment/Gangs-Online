import { MapSchema } from "@colyseus/schema";
import { Enemy, Player } from "../rooms/schema/GameState";
import { NPCType, EVIL_VALUE_CONSTANTS, GAME_CONSTANTS } from "@gangs-online/shared";
import { EvilValueSystem } from "./EvilValueSystem";
import { PrisonSystem } from "./PrisonSystem";

/**
 * NPCManager - 管理 NPC 生成和邏輯 (Phase 9, Phase 14: 擴展 NPC AI)
 *
 * 功能：
 * - 生成商店 NPC
 * - 生成市民、警察、古惑仔 NPC (Phase 14)
 * - 管理 NPC 狀態和 AI 行為
 */
export class NPCManager {
    private npcs: MapSchema<Enemy>;
    private players: MapSchema<Player> | null = null;
    private evilValueSystem: EvilValueSystem | null = null;
    private prisonSystem: PrisonSystem | null = null;
    private npcIdCounter: number = 0;

    constructor(npcs: MapSchema<Enemy>) {
        this.npcs = npcs;
    }

    /**
     * 設置玩家引用和系統引用（Phase 14）
     */
    setReferences(
        players: MapSchema<Player>,
        evilValueSystem: EvilValueSystem,
        prisonSystem: PrisonSystem
    ): void {
        this.players = players;
        this.evilValueSystem = evilValueSystem;
        this.prisonSystem = prisonSystem;
    }

    /**
     * 初始化 NPC（生成商店老闆和 Phase 14 NPC）
     */
    initialize(): void {
        this.spawnShopkeeper();

        // Phase 14: 生成市民和警察
        this.spawnCitizens(3);
        this.spawnPolice(2);
    }

    /**
     * 在地圖中心生成商店老闆 NPC
     */
    private spawnShopkeeper(): void {
        const shopkeeper = new Enemy();
        shopkeeper.id = "npc_shopkeeper";
        shopkeeper.x = 0;
        shopkeeper.z = 0;
        shopkeeper.name = "十三叔 (Shop)";
        shopkeeper.type = "npc";
        shopkeeper.npcType = "shop";
        shopkeeper.state = "idle";
        shopkeeper.hp = 9999; // 無敵
        shopkeeper.maxHp = 9999;
        shopkeeper.attack = 0;

        this.npcs.set(shopkeeper.id, shopkeeper);
        console.log("✅ Shopkeeper NPC spawned at map center (0, 0)");
    }

    /**
     * 檢查實體是否為 NPC
     * @param entityId 實體 ID
     * @returns 是否為 NPC
     */
    isNPC(entityId: string): boolean {
        const entity = this.npcs.get(entityId);
        return entity !== undefined && entity.type === "npc";
    }

    /**
     * 獲取 NPC 類型（Phase 14）
     */
    getNPCType(entityId: string): NPCType | null {
        const entity = this.npcs.get(entityId);
        if (entity && entity.type === "npc") {
            return entity.npcType;
        }
        return null;
    }

    /**
     * 檢查 NPC 是否為市民（無辜）
     */
    isCitizen(entityId: string): boolean {
        return this.getNPCType(entityId) === "citizen";
    }

    /**
     * 檢查 NPC 是否為警察
     */
    isPolice(entityId: string): boolean {
        return this.getNPCType(entityId) === "police";
    }

    /**
     * 生成任務 NPC (Phase 10)
     * @param id NPC ID
     * @param x X 座標
     * @param z Z 座標
     * @param name NPC 名稱
     */
    spawnQuestNPC(id: string, x: number, z: number, name: string): void {
        const questNpc = new Enemy();
        questNpc.id = id;
        questNpc.x = x;
        questNpc.z = z;
        questNpc.name = name;
        questNpc.type = "npc";
        questNpc.npcType = "quest";
        questNpc.state = "idle";
        questNpc.hp = 9999; // 無敵
        questNpc.maxHp = 9999;
        questNpc.attack = 0;

        this.npcs.set(questNpc.id, questNpc);
        console.log(`✅ Quest NPC "${name}" spawned at (${x}, ${z})`);
    }

    /**
     * 生成市民 NPC（Phase 14）
     * @param count 數量
     */
    spawnCitizens(count: number): void {
        const names = ["路人甲", "阿婆", "學生仔", "上班族", "遊客"];
        for (let i = 0; i < count; i++) {
            const citizen = new Enemy();
            citizen.id = `npc_citizen_${this.npcIdCounter++}`;
            citizen.x = Math.random() * 30 - 15;
            citizen.z = Math.random() * 30 - 15;
            citizen.name = names[Math.floor(Math.random() * names.length)];
            citizen.type = "npc";
            citizen.npcType = "citizen";
            citizen.state = "idle";
            citizen.hp = 30;
            citizen.maxHp = 30;
            citizen.attack = 0; // 市民不攻擊

            this.npcs.set(citizen.id, citizen);
            console.log(`👤 [Phase 14] Citizen "${citizen.name}" spawned at (${citizen.x.toFixed(2)}, ${citizen.z.toFixed(2)})`);
        }
    }

    /**
     * 生成警察 NPC（Phase 14）
     * @param count 數量
     */
    spawnPolice(count: number): void {
        for (let i = 0; i < count; i++) {
            const police = new Enemy();
            police.id = `npc_police_${this.npcIdCounter++}`;
            // 警察在安全區附近巡邏
            police.x = (Math.random() * 10 - 5) + GAME_CONSTANTS.SAFE_ZONE_RADIUS;
            police.z = (Math.random() * 10 - 5) + GAME_CONSTANTS.SAFE_ZONE_RADIUS;
            police.name = "警察";
            police.type = "npc";
            police.npcType = "police";
            police.state = "idle";
            police.hp = 200; // 警察較強
            police.maxHp = 200;
            police.attack = 20;

            this.npcs.set(police.id, police);
            console.log(`👮 [Phase 14] Police spawned at (${police.x.toFixed(2)}, ${police.z.toFixed(2)})`);
        }
    }

    /**
     * 警察 AI 更新迴圈（Phase 14）
     * 掃描範圍內的紅名玩家並攻擊
     */
    updatePoliceAI(deltaTime: number): void {
        if (!this.players || !this.evilValueSystem || !this.prisonSystem) return;

        this.npcs.forEach((npc, npcId) => {
            // 只處理警察 NPC
            if (npc.npcType !== "police" || npc.hp <= 0) return;

            // 尋找範圍內的紅名玩家
            let targetPlayer: Player | null = null;
            let minDistance = Infinity;

            this.players!.forEach((player) => {
                if (player.hp <= 0 || player.inPrison) return;

                // 只攻擊紅名玩家
                if (!this.evilValueSystem!.isWanted(player)) return;

                const dx = player.x - npc.x;
                const dz = player.z - npc.z;
                const distance = Math.sqrt(dx * dx + dz * dz);

                if (distance < EVIL_VALUE_CONSTANTS.POLICE_SCAN_RANGE && distance < minDistance) {
                    minDistance = distance;
                    targetPlayer = player;
                }
            });

            if (targetPlayer) {
                const target = targetPlayer as Player; // Type assertion to fix TS inference
                const distance = minDistance;

                if (distance > GAME_CONSTANTS.ATTACK_RANGE) {
                    // 追逐紅名玩家
                    npc.state = "chase";
                    const dx = target.x - npc.x;
                    const dz = target.z - npc.z;
                    npc.x += (dx / distance) * GAME_CONSTANTS.ENEMY_SPEED * 1.5; // 警察移動較快
                    npc.z += (dz / distance) * GAME_CONSTANTS.ENEMY_SPEED * 1.5;
                } else {
                    // 攻擊紅名玩家
                    npc.state = "attack";

                    // 隨機機率攻擊
                    if (Math.random() < GAME_CONSTANTS.ENEMY_ATTACK_CHANCE * 2) {
                        target.hp -= npc.attack;
                        console.log(`👮 [Police] 警察攻擊紅名玩家 ${target.name}，造成 ${npc.attack} 傷害！HP: ${target.hp}/${target.maxHp}`);

                        if (target.hp <= 0) {
                            target.hp = 0;
                            // 紅名玩家被警察擊倒 -> 送進監獄
                            console.log(`🚔 [Police] ${target.name} 被警察擊倒，送進監獄！`);
                            this.prisonSystem!.sendToPrison(target);
                        }
                    }
                }
            } else {
                // 沒有目標，巡邏
                npc.state = "idle";
            }
        });
    }

    /**
     * 處理市民被攻擊（Phase 14）
     * 市民不還手，但會觸發罪惡值增加
     * @returns 是否為攻擊市民
     */
    handleCitizenAttacked(attackerId: string, citizenId: string): boolean {
        const citizen = this.npcs.get(citizenId);
        if (!citizen || citizen.npcType !== "citizen") return false;

        // 市民被攻擊，扣血
        citizen.hp -= GAME_CONSTANTS.ATTACK_DAMAGE;
        console.log(`😱 [Citizen] ${citizen.name} 被攻擊！HP: ${citizen.hp}/${citizen.maxHp}`);

        if (citizen.hp <= 0) {
            citizen.hp = 0;
            console.log(`💀 [Citizen] ${citizen.name} 死亡`);
            // 1 分鐘後重生
            // 注意：重生邏輯需要在 GameRoom 中處理
        }

        return true; // 確認是攻擊市民
    }

    /**
     * 移除死亡的 NPC
     */
    removeDeadNPCs(): string[] {
        const deadNPCs: string[] = [];
        this.npcs.forEach((npc, npcId) => {
            if (npc.hp <= 0 && npc.npcType === "citizen") {
                deadNPCs.push(npcId);
            }
        });

        deadNPCs.forEach((npcId) => {
            this.npcs.delete(npcId);
            console.log(`🧹 [NPC] Removed dead NPC: ${npcId}`);
        });

        return deadNPCs;
    }

    /**
     * 重生市民（在指定時間後）
     */
    respawnCitizen(): void {
        this.spawnCitizens(1);
    }
}
