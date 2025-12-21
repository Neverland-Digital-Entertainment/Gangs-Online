import { MapSchema } from "@colyseus/schema";
import { Enemy } from "../rooms/schema/GameState";

/**
 * NPCManager - 管理 NPC 生成和邏輯 (Phase 9)
 *
 * 功能：
 * - 生成商店 NPC
 * - 管理 NPC 狀態
 */
export class NPCManager {
    private npcs: MapSchema<Enemy>;

    constructor(npcs: MapSchema<Enemy>) {
        this.npcs = npcs;
    }

    /**
     * 初始化 NPC（生成商店老闆）
     */
    initialize(): void {
        this.spawnShopkeeper();
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
        shopkeeper.state = "idle";
        shopkeeper.hp = 9999; // 無敵
        shopkeeper.maxHp = 9999;

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
        questNpc.state = "idle";
        questNpc.hp = 9999; // 無敵
        questNpc.maxHp = 9999;

        this.npcs.set(questNpc.id, questNpc);
        console.log(`✅ Quest NPC "${name}" spawned at (${x}, ${z})`);
    }
}
