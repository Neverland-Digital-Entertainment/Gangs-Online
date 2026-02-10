/**
 * Quest Blueprint Service for Firebase Operations
 * Phase 20: Quest Blueprint System
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  orderBy,
  query,
  Timestamp,
} from 'firebase/firestore';
import { getFirebaseServices } from '../firebase/config';
import type {
  QuestBlueprint,
  QuestBlueprintFormData,
} from '@/types/quest';

const COLLECTION_NAME = 'quest_blueprints';

/**
 * Recursively remove undefined values from an object to avoid Firebase errors
 */
function removeUndefinedFields<T extends Record<string, any>>(obj: T): Partial<T> {
  const cleaned: any = {};

  for (const key in obj) {
    const value = obj[key];

    if (value === undefined) {
      continue;
    } else if (Array.isArray(value)) {
      cleaned[key] = value.map((item: any) => {
        if (typeof item === 'object' && item !== null) {
          return removeUndefinedFields(item);
        }
        return item;
      });
    } else if (typeof value === 'object' && value !== null) {
      const isDate = (value as any) instanceof Date;
      const isTimestamp = (value as any).constructor?.name === 'Timestamp';

      if (!isDate && !isTimestamp) {
        cleaned[key] = removeUndefinedFields(value);
      } else {
        cleaned[key] = value;
      }
    } else {
      cleaned[key] = value;
    }
  }

  return cleaned;
}

/**
 * Safe Timestamp to Date conversion
 */
function convertToDate(value: any): Date {
  if (value instanceof Date) return value;
  if (value && typeof value.toDate === 'function') return value.toDate();
  if (value && typeof value.seconds === 'number') {
    return new Date(value.seconds * 1000);
  }
  return new Date();
}

export class QuestBlueprintService {
  private static instance: QuestBlueprintService;

  private constructor() {
    getFirebaseServices();
  }

  public static getInstance(): QuestBlueprintService {
    if (!QuestBlueprintService.instance) {
      QuestBlueprintService.instance = new QuestBlueprintService();
    }
    return QuestBlueprintService.instance;
  }

  /**
   * Get all quest blueprints
   */
  async getAllBlueprints(): Promise<QuestBlueprint[]> {
    const { db } = getFirebaseServices();
    const q = query(
      collection(db, COLLECTION_NAME),
      orderBy('updatedAt', 'desc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name || '',
        description: data.description || '',
        nodes: data.nodes || [],
        edges: data.edges || [],
        isActive: data.isActive ?? true,
        createdAt: convertToDate(data.createdAt),
        updatedAt: convertToDate(data.updatedAt),
      } as QuestBlueprint;
    });
  }

  /**
   * Get a single quest blueprint by ID
   */
  async getBlueprintById(id: string): Promise<QuestBlueprint | null> {
    const { db } = getFirebaseServices();
    const docRef = doc(db, COLLECTION_NAME, id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) return null;

    const data = docSnap.data();
    return {
      id: docSnap.id,
      name: data.name || '',
      description: data.description || '',
      nodes: data.nodes || [],
      edges: data.edges || [],
      isActive: data.isActive ?? true,
      createdAt: convertToDate(data.createdAt),
      updatedAt: convertToDate(data.updatedAt),
    } as QuestBlueprint;
  }

  /**
   * Create a new quest blueprint
   */
  async createBlueprint(formData: QuestBlueprintFormData): Promise<string> {
    const { db } = getFirebaseServices();

    const cleanedData = removeUndefinedFields({
      ...formData,
      isActive: true,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    const docRef = await addDoc(
      collection(db, COLLECTION_NAME),
      cleanedData
    );
    return docRef.id;
  }

  /**
   * Update an existing quest blueprint
   */
  async updateBlueprint(id: string, formData: Partial<QuestBlueprintFormData> & { isActive?: boolean }): Promise<void> {
    const { db } = getFirebaseServices();
    const docRef = doc(db, COLLECTION_NAME, id);

    const cleanedData = removeUndefinedFields({
      ...formData,
      updatedAt: Timestamp.now(),
    });

    await updateDoc(docRef, cleanedData);
  }

  /**
   * Delete a quest blueprint
   */
  async deleteBlueprint(id: string): Promise<void> {
    const { db } = getFirebaseServices();
    const docRef = doc(db, COLLECTION_NAME, id);
    await deleteDoc(docRef);
  }

  /**
   * Toggle quest blueprint active status
   */
  async toggleActive(id: string, isActive: boolean): Promise<void> {
    await this.updateBlueprint(id, { isActive });
  }
}
