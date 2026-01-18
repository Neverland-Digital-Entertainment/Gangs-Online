/**
 * Item Service for Firebase Operations
 * Phase 16 - Item Module
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
import { getFirebaseServices } from './firebase-config';
import type { Item, ItemFormData, ItemFilter } from '../types/items';

const COLLECTION_NAME = 'items';
const STORAGE_PATH = 'item-images';

export class ItemService {
  private static instance: ItemService;

  private constructor() {
    // Initialize Firebase
    getFirebaseServices();
  }

  public static getInstance(): ItemService {
    if (!ItemService.instance) {
      ItemService.instance = new ItemService();
    }
    return ItemService.instance;
  }

  /**
   * Upload item image to Firebase Storage
   */
  async uploadItemImage(file: File, itemId: string): Promise<string> {
    const { storage } = getFirebaseServices();
    const fileExtension = file.name.split('.').pop();
    const fileName = `${itemId}.${fileExtension}`;
    const storageRef = ref(storage, `${STORAGE_PATH}/${fileName}`);

    await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(storageRef);

    return downloadURL;
  }

  /**
   * Delete item image from Firebase Storage
   */
  async deleteItemImage(imageUrl: string): Promise<void> {
    try {
      const { storage } = getFirebaseServices();
      const imageRef = ref(storage, imageUrl);
      await deleteObject(imageRef);
    } catch (error) {
      console.error('Error deleting image:', error);
      // Don't throw error if image doesn't exist
    }
  }

  /**
   * Convert Firestore document to Item
   */
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

  /**
   * Create a new item
   */
  async createItem(formData: ItemFormData): Promise<string> {
    const { db } = getFirebaseServices();
    const itemsCollection = collection(db, COLLECTION_NAME);

    // Create document first to get ID
    const docRef = await addDoc(itemsCollection, {
      name: formData.name,
      description: formData.description,
      category: formData.category,
      imageUrl: '', // Temporary
      price: formData.price,
      sellPrice: formData.sellPrice,
      isTradeable: formData.isTradeable,
      isDroppable: formData.isDroppable,
      isActive: formData.isActive,
      attributes: formData.attributes,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    // Upload image if provided
    let imageUrl = '/images/no-image.png';
    if (formData.imageFile) {
      imageUrl = await this.uploadItemImage(formData.imageFile, docRef.id);
    } else if (formData.imageUrl) {
      imageUrl = formData.imageUrl;
    }

    // Update document with image URL
    await updateDoc(docRef, { imageUrl });

    return docRef.id;
  }

  /**
   * Get item by ID
   */
  async getItem(itemId: string): Promise<Item | null> {
    const { db } = getFirebaseServices();
    const docRef = doc(db, COLLECTION_NAME, itemId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return this.documentToItem(docSnap.id, docSnap.data());
    }

    return null;
  }

  /**
   * Get all items with optional filters
   */
  async getItems(filter?: ItemFilter): Promise<Item[]> {
    const { db } = getFirebaseServices();
    const itemsCollection = collection(db, COLLECTION_NAME);

    let q = query(itemsCollection, orderBy('createdAt', 'desc'));

    // Apply filters
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

    // Client-side search filter
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

  /**
   * Update an existing item
   */
  async updateItem(itemId: string, formData: ItemFormData): Promise<void> {
    const { db } = getFirebaseServices();
    const docRef = doc(db, COLLECTION_NAME, itemId);

    // Handle image upload if new file provided
    let imageUrl = formData.imageUrl || '/images/no-image.png';
    if (formData.imageFile) {
      // Delete old image if exists and not default
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

  /**
   * Delete an item
   */
  async deleteItem(itemId: string): Promise<void> {
    const { db } = getFirebaseServices();

    // Get item to delete image
    const item = await this.getItem(itemId);
    if (item && item.imageUrl && !item.imageUrl.includes('no-image.png')) {
      await this.deleteItemImage(item.imageUrl);
    }

    const docRef = doc(db, COLLECTION_NAME, itemId);
    await deleteDoc(docRef);
  }

  /**
   * Duplicate an existing item
   */
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
      isActive: false, // Set inactive by default for duplicates
      attributes: item.attributes,
    };

    return this.createItem(formData);
  }
}

export const itemService = ItemService.getInstance();
