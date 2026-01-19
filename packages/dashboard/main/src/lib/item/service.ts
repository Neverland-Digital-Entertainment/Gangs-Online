/**
 * Item Service for Firebase Operations
 * Version 0.16.1
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
  DocumentData,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { getFirebaseServices } from '../firebase/config';
import type { Item, ItemFormData, ItemFilter } from '@/types/item';

const COLLECTION_NAME = 'items';
const STORAGE_PATH = 'item-images';

export class ItemService {
  private static instance: ItemService;

  private constructor() {
    getFirebaseServices();
  }

  public static getInstance(): ItemService {
    if (!ItemService.instance) {
      ItemService.instance = new ItemService();
    }
    return ItemService.instance;
  }

  async uploadItemImage(file: File, itemId: string): Promise<string> {
    const { storage } = getFirebaseServices();
    const fileExtension = file.name.split('.').pop();
    const fileName = `${itemId}.${fileExtension}`;
    const storageRef = ref(storage, `${STORAGE_PATH}/${fileName}`);

    await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(storageRef);

    return downloadURL;
  }

  async deleteItemImage(imageUrl: string): Promise<void> {
    try {
      const { storage } = getFirebaseServices();
      const imageRef = ref(storage, imageUrl);
      await deleteObject(imageRef);
    } catch (error) {
      console.error('Error deleting image:', error);
    }
  }

  private documentToItem(id: string, data: DocumentData): Item {
    return {
      id,
      name: data.name,
      description: data.description,
      category: data.category,
      imageUrl: data.imageUrl,
      price: data.price,
      sellPrice: data.sellPrice,
      isTradeable: data.isTradeable,
      isDroppable: data.isDroppable,
      isActive: data.isActive,
      attributes: data.attributes,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
    };
  }

  async createItem(formData: ItemFormData): Promise<string> {
    console.log('🚀 [ItemService] createItem 開始執行...');
    console.log('📝 [ItemService] 表單資料:', JSON.stringify({
      name: formData.name,
      description: formData.description,
      category: formData.category,
      price: formData.price,
      sellPrice: formData.sellPrice,
      isTradeable: formData.isTradeable,
      isDroppable: formData.isDroppable,
      isActive: formData.isActive,
      hasImageFile: !!formData.imageFile,
      imageUrl: formData.imageUrl,
    }, null, 2));

    try {
      console.log('🔥 [ItemService] 獲取 Firebase 服務...');
      const { db } = getFirebaseServices();
      console.log('✅ [ItemService] Firebase db 已獲取');

      const itemsCollection = collection(db, COLLECTION_NAME);
      console.log(`📂 [ItemService] Collection 參考已建立: ${COLLECTION_NAME}`);

      const itemData = {
        name: formData.name,
        description: formData.description,
        category: formData.category,
        imageUrl: '',
        price: formData.price,
        sellPrice: formData.sellPrice,
        isTradeable: formData.isTradeable,
        isDroppable: formData.isDroppable,
        isActive: formData.isActive,
        attributes: formData.attributes,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };
      console.log('📄 [ItemService] 準備寫入的資料:', JSON.stringify(itemData, null, 2));

      console.log('⏳ [ItemService] 正在執行 addDoc...');
      const docRef = await addDoc(itemsCollection, itemData);
      console.log(`✅ [ItemService] addDoc 成功！文件 ID: ${docRef.id}`);

      let imageUrl = '/images/no-image.png';
      if (formData.imageFile) {
        console.log('📷 [ItemService] 開始上傳圖片...');
        imageUrl = await this.uploadItemImage(formData.imageFile, docRef.id);
        console.log(`✅ [ItemService] 圖片上傳成功: ${imageUrl}`);
      } else if (formData.imageUrl && formData.imageUrl !== '/images/no-image.png') {
        imageUrl = formData.imageUrl;
        console.log(`📷 [ItemService] 使用現有圖片 URL: ${imageUrl}`);
      }

      console.log('⏳ [ItemService] 正在更新圖片 URL...');
      await updateDoc(docRef, { imageUrl });
      console.log('✅ [ItemService] 圖片 URL 更新成功');

      console.log(`🎉 [ItemService] createItem 完成！道具 ID: ${docRef.id}`);
      return docRef.id;
    } catch (error: any) {
      console.error('❌ [ItemService] createItem 失敗！');
      console.error('錯誤類型:', error.constructor.name);
      console.error('錯誤代碼:', error.code);
      console.error('錯誤訊息:', error.message);
      console.error('完整錯誤:', error);
      throw error;
    }
  }

  async getItem(itemId: string): Promise<Item | null> {
    const { db } = getFirebaseServices();
    const docRef = doc(db, COLLECTION_NAME, itemId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return this.documentToItem(docSnap.id, docSnap.data());
    }

    return null;
  }

  async getItems(filter?: ItemFilter): Promise<Item[]> {
    console.log('📖 開始讀取道具列表...');
    const { db } = getFirebaseServices();
    const itemsCollection = collection(db, COLLECTION_NAME);

    try {
      // 先嘗試不使用 orderBy，避免索引問題
      let q = query(itemsCollection);

      if (filter?.category) {
        console.log('🔍 篩選分類:', filter.category);
        q = query(itemsCollection, where('category', '==', filter.category));
      }

      if (filter?.isActive !== undefined) {
        console.log('🔍 篩選狀態:', filter.isActive);
        q = query(itemsCollection, where('isActive', '==', filter.isActive));
      }

      console.log('⏳ 正在從 Firestore 讀取資料...');
      const querySnapshot = await getDocs(q);
      console.log(`✅ 讀取成功！找到 ${querySnapshot.size} 個道具`);

      const items: Item[] = [];

      querySnapshot.forEach((doc) => {
        console.log('📦 道具:', doc.id, doc.data());
        items.push(this.documentToItem(doc.id, doc.data()));
      });

      // 手動排序（避免 Firestore 索引問題）
      items.sort((a, b) => {
        const timeA = a.createdAt?.getTime() || 0;
        const timeB = b.createdAt?.getTime() || 0;
        return timeB - timeA; // 降序
      });

      if (filter?.search) {
        const searchLower = filter.search.toLowerCase();
        const filtered = items.filter(
          (item) =>
            item.name.toLowerCase().includes(searchLower) ||
            item.id.toLowerCase().includes(searchLower)
        );
        console.log(`🔍 搜尋 "${filter.search}" 後剩餘 ${filtered.length} 個道具`);
        return filtered;
      }

      console.log(`✨ 最終返回 ${items.length} 個道具`);
      return items;
    } catch (error: any) {
      console.error('❌ 讀取道具失敗！');
      console.error('錯誤訊息:', error.message);
      console.error('錯誤代碼:', error.code);
      console.error('完整錯誤:', error);

      // 如果是索引錯誤，提供解決方案
      if (error.message?.includes('index')) {
        console.error('⚠️ 可能需要建立 Firestore 索引');
        console.error('請查看 Firebase Console 的錯誤訊息中的索引建立連結');
      }

      throw error;
    }
  }

  async updateItem(itemId: string, formData: ItemFormData): Promise<void> {
    const { db } = getFirebaseServices();
    const docRef = doc(db, COLLECTION_NAME, itemId);

    let imageUrl = formData.imageUrl || '/images/no-image.png';
    if (formData.imageFile) {
      if (imageUrl && !imageUrl.includes('no-image.png')) {
        await this.deleteItemImage(imageUrl);
      }
      imageUrl = await this.uploadItemImage(formData.imageFile, itemId);
    }

    await updateDoc(docRef, {
      name: formData.name,
      description: formData.description,
      category: formData.category,
      imageUrl,
      price: formData.price,
      sellPrice: formData.sellPrice,
      isTradeable: formData.isTradeable,
      isDroppable: formData.isDroppable,
      isActive: formData.isActive,
      attributes: formData.attributes,
      updatedAt: Timestamp.now(),
    });
  }

  async deleteItem(itemId: string): Promise<void> {
    const { db } = getFirebaseServices();

    const item = await this.getItem(itemId);
    if (item && item.imageUrl && !item.imageUrl.includes('no-image.png')) {
      await this.deleteItemImage(item.imageUrl);
    }

    const docRef = doc(db, COLLECTION_NAME, itemId);
    await deleteDoc(docRef);
  }

  async duplicateItem(itemId: string): Promise<string> {
    const item = await this.getItem(itemId);
    if (!item) {
      throw new Error('Item not found');
    }

    const formData: ItemFormData = {
      name: `${item.name} (Copy)`,
      description: item.description,
      category: item.category,
      imageUrl: item.imageUrl,
      price: item.price,
      sellPrice: item.sellPrice,
      isTradeable: item.isTradeable,
      isDroppable: item.isDroppable,
      isActive: false,
      attributes: item.attributes,
    };

    return this.createItem(formData);
  }
}

export const itemService = ItemService.getInstance();
