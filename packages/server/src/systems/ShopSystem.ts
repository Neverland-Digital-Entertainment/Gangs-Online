import { Client } from "colyseus";
import { Player, Item } from "../rooms/schema/GameState";
import { GAME_CONSTANTS, SHOP_ITEMS } from "@gangs-online/shared";

/**
 * ShopSystem - 管理商店邏輯 (Phase 9)
 *
 * 功能：
 * - 檢查玩家是否在商店範圍內
 * - 處理物品購買
 * - 驗證金錢和距離
 */
export class ShopSystem {
    /**
     * 檢查玩家是否在商店範圍內（接近地圖中心的 NPC）
     * @param playerX 玩家 X 座標
     * @param playerZ 玩家 Z 座標
     * @returns 是否在商店範圍內
     */
    isNearShop(playerX: number, playerZ: number): boolean {
        const distanceFromCenter = Math.sqrt(playerX * playerX + playerZ * playerZ);
        return distanceFromCenter <= GAME_CONSTANTS.SHOP_INTERACTION_RANGE;
    }

    /**
     * 處理購買請求
     * @param client 客戶端
     * @param player 玩家
     * @param itemId 物品 ID
     * @returns 購買是否成功
     */
    handlePurchase(client: Client, player: Player, itemId: string): boolean {
        // 檢查距離
        if (!this.isNearShop(player.x, player.z)) {
            client.send("notification", "太遠了！要去十三叔那邊買。");
            return false;
        }

        // 查找商品
        const shopItem = SHOP_ITEMS.find(item => item.id === itemId);
        if (!shopItem) {
            client.send("notification", "找不到這個商品。");
            return false;
        }

        // 檢查金錢
        if (player.money < shopItem.price) {
            client.send("notification", "錢唔夠！去打多幾個古惑仔啦。");
            return false;
        }

        // 扣錢並添加到背包
        player.money -= shopItem.price;

        const newItem = new Item();
        newItem.id = shopItem.id;
        newItem.name = shopItem.name;
        newItem.type = shopItem.type;
        newItem.value = shopItem.value;
        player.inventory.push(newItem);

        client.send("notification", `買咗 ${shopItem.name} (-$${shopItem.price})`);
        return true;
    }
}
