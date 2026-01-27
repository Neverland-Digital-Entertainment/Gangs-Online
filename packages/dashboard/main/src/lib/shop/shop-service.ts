/**
 * Shop Service for Firebase Operations
 * Phase 16.3: Shop & Economy System
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';
import { getFirebaseServices } from '../firebase/config';
import type {
  Shop,
  ShopFormData,
  ShopFilter,
  ShopItemConfig,
  ItemForShop,
} from '@/types/shop';

const COLLECTION_NAME = 'shops';
const ITEMS_COLLECTION = 'items';

/**
 * Remove undefined values from an object to avoid Firebase errors
 * Firebase doesn't accept undefined values, only null or valid values
 */
function removeUndefinedFields<T extends Record<string, any>>(obj: T): Partial<T> {
  const cleaned: any = {};
  for (const key in obj) {
    if (obj[key] !== undefined) {
      cleaned[key] = obj[key];
    }
  }
  return cleaned;
}

export class ShopService {
  private static instance: ShopService;

  private constructor() {
    getFirebaseServices();
  }

  public static getInstance(): ShopService {
    if (!ShopService.instance) {
      ShopService.instance = new ShopService();
    }
    return ShopService.instance;
  }

  /**
   * Get all shops with optional filtering
   */
  async getAllShops(filter?: ShopFilter): Promise<Shop[]> {
    const { db } = getFirebaseServices();
    const shopsRef = collection(db, COLLECTION_NAME);

    let q = query(shopsRef, orderBy('updatedAt', 'desc'));

    if (filter?.isActive !== undefined) {
      q = query(shopsRef, where('isActive', '==', filter.isActive), orderBy('updatedAt', 'desc'));
    }

    const snapshot = await getDocs(q);
    let shops = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
      } as Shop;
    });

    // Client-side filtering for search (since Firestore doesn't support text search)
    if (filter?.search) {
      const searchLower = filter.search.toLowerCase();
      shops = shops.filter((shop) =>
        shop.name.toLowerCase().includes(searchLower) ||
        shop.description?.toLowerCase().includes(searchLower)
      );
    }

    return shops;
  }

  /**
   * Get a single shop by ID
   */
  async getShopById(id: string): Promise<Shop | null> {
    const { db } = getFirebaseServices();
    const shopRef = doc(db, COLLECTION_NAME, id);
    const shopDoc = await getDoc(shopRef);

    if (!shopDoc.exists()) {
      return null;
    }

    const data = shopDoc.data();
    return {
      id: shopDoc.id,
      ...data,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
    } as Shop;
  }

  /**
   * Create a new shop
   */
  async createShop(formData: ShopFormData): Promise<string> {
    const { db } = getFirebaseServices();
    const shopsRef = collection(db, COLLECTION_NAME);

    const now = Timestamp.now();
    const shopData = removeUndefinedFields({
      name: formData.name,
      description: formData.description || '',
      operatingHours: formData.operatingHours || null,
      itemList: formData.itemList || [],
      isActive: formData.isActive ?? true,
      createdAt: now,
      updatedAt: now,
    });

    const docRef = await addDoc(shopsRef, shopData);
    return docRef.id;
  }

  /**
   * Update an existing shop
   */
  async updateShop(id: string, formData: ShopFormData): Promise<void> {
    const { db } = getFirebaseServices();
    const shopRef = doc(db, COLLECTION_NAME, id);

    const updateData = removeUndefinedFields({
      name: formData.name,
      description: formData.description || '',
      operatingHours: formData.operatingHours || null,
      itemList: formData.itemList || [],
      isActive: formData.isActive ?? true,
      updatedAt: Timestamp.now(),
    });

    await updateDoc(shopRef, updateData);
  }

  /**
   * Delete a shop
   */
  async deleteShop(id: string): Promise<void> {
    const { db } = getFirebaseServices();
    const shopRef = doc(db, COLLECTION_NAME, id);
    await deleteDoc(shopRef);
  }

  /**
   * Add an item to a shop's item list
   */
  async addItemToShop(shopId: string, shopItem: ShopItemConfig): Promise<void> {
    const shop = await this.getShopById(shopId);
    if (!shop) {
      throw new Error('Shop not found');
    }

    // Check if item already exists
    const existingIndex = shop.itemList.findIndex(
      (item) => item.itemId === shopItem.itemId
    );

    if (existingIndex >= 0) {
      throw new Error('Item already exists in shop');
    }

    const updatedItemList = [...shop.itemList, shopItem];

    const { db } = getFirebaseServices();
    const shopRef = doc(db, COLLECTION_NAME, shopId);
    await updateDoc(shopRef, {
      itemList: updatedItemList,
      updatedAt: Timestamp.now(),
    });
  }

  /**
   * Remove an item from a shop's item list
   */
  async removeItemFromShop(shopId: string, itemId: string): Promise<void> {
    const shop = await this.getShopById(shopId);
    if (!shop) {
      throw new Error('Shop not found');
    }

    const updatedItemList = shop.itemList.filter(
      (item) => item.itemId !== itemId
    );

    const { db } = getFirebaseServices();
    const shopRef = doc(db, COLLECTION_NAME, shopId);
    await updateDoc(shopRef, {
      itemList: updatedItemList,
      updatedAt: Timestamp.now(),
    });
  }

  /**
   * Update a specific item's configuration in a shop
   */
  async updateShopItem(
    shopId: string,
    itemId: string,
    updates: Partial<ShopItemConfig>
  ): Promise<void> {
    const shop = await this.getShopById(shopId);
    if (!shop) {
      throw new Error('Shop not found');
    }

    const updatedItemList = shop.itemList.map((item) => {
      if (item.itemId === itemId) {
        return { ...item, ...updates };
      }
      return item;
    });

    const { db } = getFirebaseServices();
    const shopRef = doc(db, COLLECTION_NAME, shopId);
    await updateDoc(shopRef, {
      itemList: updatedItemList,
      updatedAt: Timestamp.now(),
    });
  }

  /**
   * Reset stock for a specific item or all items in a shop
   */
  async resetShopStock(shopId: string, itemId?: string): Promise<void> {
    const shop = await this.getShopById(shopId);
    if (!shop) {
      throw new Error('Shop not found');
    }

    const updatedItemList = shop.itemList.map((item) => {
      // If itemId is specified, only reset that item
      if (itemId && item.itemId !== itemId) {
        return item;
      }

      // Reset currentStock to globalStock
      if (item.globalStock > 0) {
        return {
          ...item,
          currentStock: item.globalStock,
        };
      }

      return item;
    });

    const { db } = getFirebaseServices();
    const shopRef = doc(db, COLLECTION_NAME, shopId);
    await updateDoc(shopRef, {
      itemList: updatedItemList,
      updatedAt: Timestamp.now(),
    });
  }

  /**
   * Get all available items for shop item selector
   * Note: Returns all items regardless of active status
   * Active/inactive filtering should be done on server/client side
   */
  async getAvailableItems(): Promise<ItemForShop[]> {
    const { db } = getFirebaseServices();
    const itemsRef = collection(db, ITEMS_COLLECTION);

    // Get all items, sorted by name
    const q = query(itemsRef, orderBy('name', 'asc'));
    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name || 'Unnamed Item',
        description: data.description || '',
        price: data.price || 0,
        category: data.category || 'consumable',
        imageUrl: data.imageUrl || '',
        isActive: data.isActive ?? true,
      } as ItemForShop;
    });
  }

  /**
   * Get items that are already in a shop (for filtering purposes)
   */
  async getShopItemIds(shopId: string): Promise<string[]> {
    const shop = await this.getShopById(shopId);
    if (!shop) {
      return [];
    }

    return shop.itemList.map((item) => item.itemId);
  }
}

// Export singleton instance
export const shopService = ShopService.getInstance();
