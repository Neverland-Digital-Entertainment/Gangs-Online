/**
 * Purchase Service - Shop Purchase Logic (Phase 16.3)
 *
 * 負責：
 * 1. 處理玩家購買請求
 * 2. 驗證庫存和購買限制
 * 3. 管理個人購買記錄
 * 4. 執行購買交易
 */
import { Client } from "colyseus";
import { Player } from "../rooms/schema/GameState";
import { shopService } from "./ShopService";
import { getFirestore, isFirebaseInitialized, getFieldValue } from "./FirebaseService";
import { IPurchaseRequest, IPurchaseResponse, IPurchaseRecord } from "@gangs-online/shared";

class PurchaseService {
    // 玩家購買記錄快取 (playerId -> shopId -> itemId -> record)
    private purchaseRecords: Map<string, Map<string, Map<string, IPurchaseRecord>>> = new Map();
    private initialized: boolean = false;

    /**
     * 初始化購買服務
     */
    async initialize(): Promise<void> {
        if (this.initialized) return;

        const db = getFirestore();
        if (!db || !isFirebaseInitialized()) {
            console.warn("[PurchaseService] Firebase not initialized");
            this.initialized = true;
            return;
        }

        console.log("✅ [PurchaseService] Initialized");
        this.initialized = true;
    }

    /**
     * 載入玩家的購買記錄
     */
    async loadPlayerRecords(playerId: string): Promise<void> {
        const db = getFirestore();
        if (!db) return;

        try {
            const recordsSnapshot = await db
                .collection("players")
                .doc(playerId)
                .collection("purchase_records")
                .get();

            const shopMap = new Map<string, Map<string, IPurchaseRecord>>();

            recordsSnapshot.forEach((doc) => {
                const data = doc.data();
                const record: IPurchaseRecord = {
                    shopId: data.shopId,
                    itemId: data.itemId,
                    purchaseCount: data.purchaseCount || 0,
                    lastPurchaseAt: data.lastPurchaseAt,
                    resetAt: data.resetAt,
                };

                if (!shopMap.has(record.shopId)) {
                    shopMap.set(record.shopId, new Map());
                }
                shopMap.get(record.shopId)!.set(record.itemId, record);
            });

            this.purchaseRecords.set(playerId, shopMap);
        } catch (error) {
            console.error(`[PurchaseService] Failed to load records for player ${playerId}:`, error);
        }
    }

    /**
     * 獲取玩家對特定商品的購買記錄
     */
    private getPurchaseRecord(playerId: string, shopId: string, itemId: string): IPurchaseRecord | undefined {
        return this.purchaseRecords.get(playerId)?.get(shopId)?.get(itemId);
    }

    /**
     * 更新玩家的購買記錄
     */
    private async updatePurchaseRecord(
        playerId: string,
        shopId: string,
        itemId: string,
        quantity: number
    ): Promise<void> {
        const db = getFirestore();
        if (!db) return;

        const now = getFieldValue().serverTimestamp();
        const existingRecord = this.getPurchaseRecord(playerId, shopId, itemId);

        const newRecord: IPurchaseRecord = {
            shopId,
            itemId,
            purchaseCount: (existingRecord?.purchaseCount || 0) + quantity,
            lastPurchaseAt: now,
        };

        // 更新本地快取
        if (!this.purchaseRecords.has(playerId)) {
            this.purchaseRecords.set(playerId, new Map());
        }
        if (!this.purchaseRecords.get(playerId)!.has(shopId)) {
            this.purchaseRecords.get(playerId)!.set(shopId, new Map());
        }
        this.purchaseRecords.get(playerId)!.get(shopId)!.set(itemId, newRecord);

        // 更新 Firebase
        const recordId = `${shopId}_${itemId}`;
        await db
            .collection("players")
            .doc(playerId)
            .collection("purchase_records")
            .doc(recordId)
            .set(newRecord, { merge: true });
    }

    /**
     * 處理購買請求
     * @param client 客戶端
     * @param player 玩家
     * @param request 購買請求
     * @returns 購買結果
     */
    async handlePurchase(
        client: Client,
        player: Player,
        request: IPurchaseRequest
    ): Promise<IPurchaseResponse> {
        const { shopId, itemId, quantity } = request;

        // 驗證數量
        if (quantity <= 0) {
            return {
                success: false,
                message: "購買數量必須大於 0",
            };
        }

        // 獲取商店資料
        const shop = shopService.getShop(shopId);
        if (!shop) {
            return {
                success: false,
                message: "找不到這家商店",
            };
        }

        // 檢查商店是否營業
        if (!shopService.isShopOpen(shop)) {
            return {
                success: false,
                message: `${shop.name} 現在休息緊，請稍後再來`,
            };
        }

        // 獲取商品配置
        const itemConfig = shopService.getShopItemConfig(shopId, itemId);
        if (!itemConfig) {
            return {
                success: false,
                message: "這家商店沒有賣這個商品",
            };
        }

        // 獲取商品資料
        const item = shopService.getItem(itemId);
        if (!item) {
            return {
                success: false,
                message: "找不到這個商品",
            };
        }

        // 檢查全局庫存
        const currentStock = itemConfig.currentStock ?? itemConfig.globalStock;
        if (currentStock !== -1) {
            // -1 表示無限庫存
            if (currentStock < quantity) {
                return {
                    success: false,
                    message: `庫存不足！剩餘: ${currentStock}`,
                    remainingStock: currentStock,
                };
            }
        }

        // 檢查個人購買限制
        if (itemConfig.personalLimit > 0) {
            // 確保已載入玩家購買記錄
            if (!this.purchaseRecords.has(player.firebaseUid)) {
                await this.loadPlayerRecords(player.firebaseUid);
            }

            const purchaseRecord = this.getPurchaseRecord(player.firebaseUid, shopId, itemId);
            const purchasedCount = purchaseRecord?.purchaseCount || 0;
            const remainingLimit = itemConfig.personalLimit - purchasedCount;

            if (remainingLimit <= 0) {
                return {
                    success: false,
                    message: `你已經買夠了！個人限購: ${itemConfig.personalLimit}`,
                    remainingPersonalLimit: 0,
                };
            }

            if (quantity > remainingLimit) {
                return {
                    success: false,
                    message: `超過個人限購！你最多還能買 ${remainingLimit} 個`,
                    remainingPersonalLimit: remainingLimit,
                };
            }
        }

        // 計算價格
        const basePrice = item.price;
        const priceMultiplier = itemConfig.priceMultiplier || 1.0;
        const finalPrice = Math.floor(basePrice * priceMultiplier);
        const totalPrice = finalPrice * quantity;

        // 檢查金錢
        if (player.money < totalPrice) {
            return {
                success: false,
                message: `錢唔夠！需要 $${totalPrice}，你只有 $${player.money}`,
            };
        }

        // 執行購買
        try {
            // 扣錢
            player.money -= totalPrice;

            // 添加到背包（這裡需要根據實際的背包系統調整）
            // TODO: 根據 item.type 和實際系統決定如何添加到背包
            // 暫時使用簡單的通知

            // 更新庫存
            if (currentStock !== -1) {
                const newStock = currentStock - quantity;
                await shopService.updateShopStock(shopId, itemId, newStock);
            }

            // 更新購買記錄
            if (itemConfig.personalLimit > 0) {
                await this.updatePurchaseRecord(player.firebaseUid, shopId, itemId, quantity);
            }

            const remainingStock =
                currentStock === -1 ? undefined : currentStock - quantity;
            const purchaseRecord = this.getPurchaseRecord(player.firebaseUid, shopId, itemId);
            const remainingPersonalLimit =
                itemConfig.personalLimit > 0
                    ? itemConfig.personalLimit - (purchaseRecord?.purchaseCount || 0)
                    : undefined;

            // 發送成功通知
            client.send("notification", `成功購買 ${quantity}x ${item.name}！(-$${totalPrice})`);

            return {
                success: true,
                message: `成功購買 ${quantity}x ${item.name}`,
                remainingStock,
                remainingPersonalLimit,
            };
        } catch (error) {
            console.error("[PurchaseService] Purchase failed:", error);
            return {
                success: false,
                message: "購買失敗，請稍後再試",
            };
        }
    }

    /**
     * 重置所有購買記錄（用於每日重置等）
     */
    async resetPurchaseRecords(playerId: string): Promise<void> {
        const db = getFirestore();
        if (!db) return;

        try {
            const recordsSnapshot = await db
                .collection("players")
                .doc(playerId)
                .collection("purchase_records")
                .get();

            const batch = db.batch();
            recordsSnapshot.forEach((doc) => {
                batch.delete(doc.ref);
            });
            await batch.commit();

            // 清除本地快取
            this.purchaseRecords.delete(playerId);

            console.log(`✅ [PurchaseService] Reset purchase records for player ${playerId}`);
        } catch (error) {
            console.error(`[PurchaseService] Failed to reset records for player ${playerId}:`, error);
        }
    }
}

export const purchaseService = new PurchaseService();
