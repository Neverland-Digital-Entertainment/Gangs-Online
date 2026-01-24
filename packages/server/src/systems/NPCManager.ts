import { MapSchema } from "@colyseus/schema";
import { Enemy, Player } from "../rooms/schema/GameState";
import { NPCType, EVIL_VALUE_CONSTANTS, GAME_CONSTANTS, INPCData } from "@gangs-online/shared";
import { EvilValueSystem } from "./EvilValueSystem";
import { PrisonSystem } from "./PrisonSystem";
import { npcService } from "../services/NPCService";

/**
 * NPCManager - 管理 NPC 生成和邏輯 (Phase 9, Phase 14: 擴展 NPC AI)
 * Phase 15: 僅載入 status === 'active' 的 NPC
 *
 * 功能：
 * - 從 Firebase 載入 NPC 定義
 * - 生成商店 NPC、市民、警察、古惑仔 NPC
 * - 管理 NPC 狀態和 AI 行為
 * - Phase 15: 根據 status 欄位過濾 NPC
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
     * 初始化 NPC（從 Firebase 載入 NPC 定義並生成）
     * Phase 15: 僅載入 status === 'active' 的 NPC
     */
    async initialize(): Promise<void> {
        // 初始化 NPC 服務（從 Firebase 載入）
        await npcService.initialize();

        // Phase 15: 從 NPCService 載入所有活躍的 NPC 並生成
        const activeNPCs = npcService.getActiveNPCs();
        const allNPCs = npcService.getAllNPCs();

        activeNPCs.forEach((npcData) => {
            this.spawnNPCFromData(npcData);
        });

        console.log(`✅ [NPCManager] Spawned ${activeNPCs.length}/${allNPCs.length} active NPCs (Phase 15: inactive NPCs not loaded)`);
    }

    /**
     * 從 NPC 定義資料生成 NPC (Phase 16-2: 支援自定義模型與對話樹)
     */
    private spawnNPCFromData(data: INPCData): void {
        const npc = new Enemy();
        npc.id = data.id;
        npc.x = data.spawnX ?? 0;
        npc.z = data.spawnZ ?? 0;
        npc.name = data.name;
        npc.type = "npc";
        npc.npcType = data.type;
        npc.state = "idle";
        npc.hp = data.hp;
        npc.maxHp = data.hp;
        npc.attack = data.attack;
        npc.modelId = data.modelId || ""; // Phase 16-2: 設定自定義模型 ID，空字串時客戶端使用預設模型
        npc.dialogueTreeJson = data.dialogueTree ? JSON.stringify(data.dialogueTree) : ""; // Phase 16-2: 序列化對話樹

        this.npcs.set(npc.id, npc);
        const modelInfo = data.modelId ? ` with model: ${data.modelId}` : ' with default model';
        const dialogueInfo = data.dialogueTree ? ' [has dialogue]' : '';
        console.log(`✅ [NPCManager] Spawned ${data.type} NPC "${data.name}" at (${npc.x}, ${npc.z})${modelInfo}${dialogueInfo}`);
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
     * 處理警察被攻擊（Phase 14）
     * 攻擊警察會增加罪惡值，警察很難被打敗
     * @returns 是否為攻擊警察
     */
    handlePoliceAttacked(attackerId: string, policeId: string): boolean {
        const police = this.npcs.get(policeId);
        if (!police || police.npcType !== "police") return false;

        // 警察被攻擊，扣血
        police.hp -= GAME_CONSTANTS.ATTACK_DAMAGE;
        console.log(`👮 [Police] ${police.name} 被攻擊！HP: ${police.hp}/${police.maxHp}`);

        if (police.hp <= 0) {
            police.hp = 0;
            console.log(`💀 [Police] ${police.name} 被擊敗！`);
            // 警察死亡後 2 分鐘重生
        }

        return true; // 確認是攻擊警察
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
