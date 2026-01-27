/**
 * Shop Service - Firebase Shop Management (Phase 16.3)
 *
 * 負責：
 * 1. 從 Firebase shops 集合載入商店定義
 * 2. 從 Firebase items 集合載入商品資料
 * 3. 管理商店庫存
 * 4. 驗證營業時間
 */
import { getFirestore, isFirebaseInitialized, getFieldValue } from "./FirebaseService";
import { IShop, IShopItemConfig } from "@gangs-online/shared";

interface ItemData {
    id: string;
    name: string;
    description: string;
    price: number;
    category: string;
    imageUrl: string;
    isActive: boolean;
}

interface ShopWithItems extends IShop {
    items: Map<string, ItemData>;
}

class ShopService {
    private shopCache: Map<string, ShopWithItems> = new Map();
    private itemCache: Map<string, ItemData> = new Map();
    private initialized: boolean = false;

    /**
     * 初始化商店服務，從 Firebase 載入商店和商品
     */
    async initialize(): Promise<void> {
        if (this.initialized) return;

        const db = getFirestore();
        if (!db || !isFirebaseInitialized()) {
            console.warn("[ShopService] Firebase not initialized, no shops will be loaded");
            this.initialized = true;
            return;
        }

        try {
            // 載入所有商品
            const itemsSnapshot = await db.collection("items").get();
            itemsSnapshot.forEach((doc) => {
                const data = doc.data();
                const item: ItemData = {
                    id: doc.id,
                    name: data.name,
                    description: data.description || '',
                    price: data.price || 0,
                    category: data.category || 'special',
                    imageUrl: data.imageUrl || '',
                    isActive: data.isActive ?? true,
                };
                this.itemCache.set(doc.id, item);
            });

            // 載入所有商店
            const shopsSnapshot = await db.collection("shops").get();
            shopsSnapshot.forEach((doc) => {
                const data = doc.data();
                const shop: IShop = {
                    id: doc.id,
                    name: data.name,
                    description: data.description,
                    operatingHours: data.operatingHours,
                    itemList: data.itemList || [],
                    isActive: data.isActive ?? true,
                    createdAt: data.createdAt,
                    updatedAt: data.updatedAt,
                };

                // 只載入啟用的商店
                if (shop.isActive) {
                    const shopWithItems: ShopWithItems = {
                        ...shop,
                        items: new Map(),
                    };

                    // 將商店的商品列表與商品資料關聯
                    shop.itemList.forEach((itemConfig) => {
                        const item = this.itemCache.get(itemConfig.itemId);
                        if (item && item.isActive) {
                            shopWithItems.items.set(itemConfig.itemId, item);
                        }
                    });

                    this.shopCache.set(doc.id, shopWithItems);
                }
            });

            console.log(`✅ [ShopService] Loaded ${this.itemCache.size} items and ${this.shopCache.size} shops`);
            this.initialized = true;
        } catch (error) {
            console.error("[ShopService] Failed to load shops from Firebase:", error);
            this.initialized = true;
        }
    }

    /**
     * 獲取商店資料
     */
    getShop(shopId: string): ShopWithItems | undefined {
        return this.shopCache.get(shopId);
    }

    /**
     * 獲取商品資料
     */
    getItem(itemId: string): ItemData | undefined {
        return this.itemCache.get(itemId);
    }

    /**
     * 獲取商店中的商品配置
     */
    getShopItemConfig(shopId: string, itemId: string): IShopItemConfig | undefined {
        const shop = this.shopCache.get(shopId);
        if (!shop) return undefined;

        return shop.itemList.find((config) => config.itemId === itemId);
    }

    /**
     * 檢查商店是否營業中
     * @param shop 商店資料
     * @returns 是否營業中
     */
    isShopOpen(shop: IShop): boolean {
        // 如果沒有營業時間，表示 24 小時營業
        if (!shop.operatingHours) {
            return true;
        }

        const now = new Date();
        const currentHour = now.getUTCHours() + 8; // UTC+8 for Hong Kong time
        const adjustedHour = currentHour >= 24 ? currentHour - 24 : currentHour;

        const { start, end } = shop.operatingHours;

        // 處理跨午夜的情況（例如 22:00 - 06:00）
        if (start > end) {
            return adjustedHour >= start || adjustedHour < end;
        } else {
            return adjustedHour >= start && adjustedHour < end;
        }
    }

    /**
     * 更新商店商品庫存（寫入 Firebase）
     */
    async updateShopStock(shopId: string, itemId: string, newStock: number): Promise<void> {
        const db = getFirestore();
        if (!db) {
            throw new Error("Firebase not initialized");
        }

        const shop = this.shopCache.get(shopId);
        if (!shop) {
            throw new Error(`Shop ${shopId} not found`);
        }

        // 更新本地快取
        const itemConfig = shop.itemList.find((config) => config.itemId === itemId);
        if (itemConfig) {
            itemConfig.currentStock = newStock;
        }

        // 更新 Firebase
        await db.collection("shops").doc(shopId).update({
            itemList: shop.itemList,
            updatedAt: getFieldValue().serverTimestamp(),
        });
    }

    /**
     * 獲取所有商店
     */
    getAllShops(): ShopWithItems[] {
        return Array.from(this.shopCache.values());
    }

    /**
     * 重新載入商店（從 Firebase）
     */
    async reload(): Promise<void> {
        this.initialized = false;
        this.shopCache.clear();
        this.itemCache.clear();
        await this.initialize();
    }
}

export const shopService = new ShopService();
