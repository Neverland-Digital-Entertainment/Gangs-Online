import { MapSchema } from "@colyseus/schema";
import { Enemy } from "../rooms/schema/GameState.js";

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
}
