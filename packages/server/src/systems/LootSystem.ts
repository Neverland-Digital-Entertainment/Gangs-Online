import { Room } from "colyseus";
import { GameState, Loot, Item } from "../rooms/schema/GameState";
import { GAME_CONSTANTS } from "@gangs-online/shared";

/**
 * LootSystem - Phase 8
 * 管理戰利品的生成、清理和掉落邏輯
 */
export class LootSystem {
    private room: Room<GameState>;

    constructor(room: Room<GameState>) {
        this.room = room;
    }

    /**
     * 在指定位置生成戰利品
     * @param x X 座標
     * @param z Z 座標
     */
    spawnLoot(x: number, z: number): void {
        // 隨機檢查是否掉落
        if (Math.random() > GAME_CONSTANTS.DROP_CHANCE) {
            return;
        }

        const loot = new Loot();
        loot.id = `loot_${Math.random().toString(36).substr(2, 9)}`;
        loot.x = x + (Math.random() - 0.5) * 2; // 稍微偏移位置
        loot.z = z + (Math.random() - 0.5) * 2;
        loot.item = this.generateRandomItem();

        this.room.state.lootItems.set(loot.id, loot);

        // 30 秒後自動清除未拾取的戰利品
        this.room.clock.setTimeout(() => {
            if (this.room.state.lootItems.has(loot.id)) {
                this.room.state.lootItems.delete(loot.id);
            }
        }, 30000);
    }

    /**
     * 生成隨機物品
     * @returns 隨機生成的物品
     */
    private generateRandomItem(): Item {
        const item = new Item();

        // 50% 機率掉落金錢，50% 掉落消耗品
        if (Math.random() > 0.5) {
            // 金錢
            item.id = `money_${Date.now()}`;
            item.name = "港幣";
            item.type = "currency";
            item.value = Math.floor(Math.random() * 50) + 10; // 10-60 HKD
        } else {
            // 消耗品 - 隨機選擇一種
            const consumables = [
                { id: "food_bun", name: "叉燒包", value: 20 },
                { id: "food_noodle", name: "雲吞麵", value: 30 },
                { id: "drink_tea", name: "港式奶茶", value: 15 },
                { id: "food_dimsum", name: "蝦餃", value: 25 }
            ];

            const selected = consumables[Math.floor(Math.random() * consumables.length)];
            item.id = `${selected.id}_${Date.now()}`;
            item.name = selected.name;
            item.type = "consumable";
            item.value = selected.value; // 恢復的 HP 量
        }

        return item;
    }

    /**
     * 檢查玩家是否在拾取範圍內
     * @param playerX 玩家 X 座標
     * @param playerZ 玩家 Z 座標
     * @param lootX 戰利品 X 座標
     * @param lootZ 戰利品 Z 座標
     * @returns 是否在範圍內
     */
    isInPickupRange(playerX: number, playerZ: number, lootX: number, lootZ: number): boolean {
        const distance = Math.sqrt(
            Math.pow(playerX - lootX, 2) + Math.pow(playerZ - lootZ, 2)
        );
        return distance <= GAME_CONSTANTS.LOOT_PICKUP_RANGE;
    }
}
