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

  private extractStoragePath(imageUrl: string): string | null {
    // 只處理 Firebase Storage URL
    if (!imageUrl.includes('firebasestorage.googleapis.com')) {
      return null;
    }

    try {
      // Firebase Storage URL 格式: https://firebasestorage.googleapis.com/v0/b/{bucket}/o/{encoded-path}?...
      const url = new URL(imageUrl);
      const pathMatch = url.pathname.match(/\/o\/(.+)$/);
      if (pathMatch) {
        return decodeURIComponent(pathMatch[1]);
      }
    } catch {
      // URL 解析失敗
    }
    return null;
  }

  async deleteItemImage(imageUrl: string): Promise<void> {
    try {
      const storagePath = this.extractStoragePath(imageUrl);
      if (!storagePath) {
        console.log('Skipping image deletion - not a Firebase Storage URL');
        return;
      }

      const { storage } = getFirebaseServices();
      const imageRef = ref(storage, storagePath);
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
    const { db } = getFirebaseServices();
    const itemsCollection = collection(db, COLLECTION_NAME);

    const docRef = await addDoc(itemsCollection, {
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
    });

    let imageUrl = '/images/no-image.png';
    if (formData.imageFile) {
      imageUrl = await this.uploadItemImage(formData.imageFile, docRef.id);
    } else if (formData.imageUrl) {
      imageUrl = formData.imageUrl;
    }

    await updateDoc(docRef, { imageUrl });

    return docRef.id;
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
    const { db } = getFirebaseServices();
    const itemsCollection = collection(db, COLLECTION_NAME);

    let q = query(itemsCollection, orderBy('createdAt', 'desc'));

    if (filter?.category) {
      q = query(itemsCollection, where('category', '==', filter.category), orderBy('createdAt', 'desc'));
    }

    if (filter?.isActive !== undefined) {
      q = query(
        itemsCollection,
        where('isActive', '==', filter.isActive),
        orderBy('createdAt', 'desc')
      );
    }

    const querySnapshot = await getDocs(q);
    const items: Item[] = [];

    querySnapshot.forEach((doc) => {
      items.push(this.documentToItem(doc.id, doc.data()));
    });

    if (filter?.search) {
      const searchLower = filter.search.toLowerCase();
      return items.filter(
        (item) =>
          item.name.toLowerCase().includes(searchLower) ||
          item.id.toLowerCase().includes(searchLower)
      );
    }

    return items;
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
    // 只刪除屬於這個 item 的圖片（圖片路徑包含 item ID）
    // 這樣複製的 item 不會刪除原始 item 的圖片
    if (
      item &&
      item.imageUrl &&
      !item.imageUrl.includes('no-image.png') &&
      item.imageUrl.includes(itemId)
    ) {
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
