/**
 * NPC Template Service for Firebase Operations
 * Phase 16-2: NPC Management Module
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
} from 'firebase/firestore';
import { getFirebaseServices } from '../firebase/config';
import type {
  NpcTemplate,
  NpcTemplateFormData,
  NpcTemplateFilter,
} from '@/types/npc';

const COLLECTION_NAME = 'npc_templates';

/**
 * Recursively remove undefined values from an object to avoid Firebase errors
 * Firebase doesn't accept undefined values, only null or valid values
 * Handles nested objects and arrays (e.g., dialogueTree structure)
 */
function removeUndefinedFields<T extends Record<string, any>>(obj: T): Partial<T> {
  const cleaned: any = {};

  for (const key in obj) {
    const value = obj[key];

    if (value === undefined) {
      continue;
    } else if (Array.isArray(value)) {
      // Recursively clean arrays
      cleaned[key] = value.map((item: any) => {
        if (typeof item === 'object' && item !== null) {
          return removeUndefinedFields(item);
        }
        return item;
      });
    } else if (typeof value === 'object' && value !== null) {
      // Check if it's a Date or Timestamp
      const isDate = (value as any) instanceof Date;
      const isTimestamp = (value as any).constructor?.name === 'Timestamp';

      if (!isDate && !isTimestamp) {
        // Recursively clean nested objects
        cleaned[key] = removeUndefinedFields(value);
      } else {
        // Keep Date and Timestamp as-is
        cleaned[key] = value;
      }
    } else {
      cleaned[key] = value;
    }
  }

  return cleaned;
}

export class NpcTemplateService {
  private static instance: NpcTemplateService;

  private constructor() {
    getFirebaseServices();
  }

  public static getInstance(): NpcTemplateService {
    if (!NpcTemplateService.instance) {
      NpcTemplateService.instance = new NpcTemplateService();
    }
    return NpcTemplateService.instance;
  }

  async getAllTemplates(filter?: NpcTemplateFilter): Promise<NpcTemplate[]> {
    const { db } = getFirebaseServices();
    const templatesRef = collection(db, COLLECTION_NAME);

    let q = query(templatesRef, orderBy('createdAt', 'desc'));

    if (filter?.type) {
      q = query(templatesRef, where('type', '==', filter.type), orderBy('createdAt', 'desc'));
    }

    if (filter?.isActive !== undefined) {
      q = query(q, where('isActive', '==', filter.isActive));
    }

    const snapshot = await getDocs(q);
    const templates = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
      } as NpcTemplate;
    });

    // Client-side search filter
    if (filter?.search) {
      const searchLower = filter.search.toLowerCase();
      return templates.filter(
        (template) =>
          template.name.toLowerCase().includes(searchLower) ||
          template.modelId?.toLowerCase().includes(searchLower) ||
          template.description?.toLowerCase().includes(searchLower)
      );
    }

    return templates;
  }

  async getTemplateById(id: string): Promise<NpcTemplate | null> {
    const { db } = getFirebaseServices();
    const docRef = doc(db, COLLECTION_NAME, id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    const data = docSnap.data();
    return {
      id: docSnap.id,
      ...data,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
    } as NpcTemplate;
  }

  async createTemplate(data: NpcTemplateFormData): Promise<string> {
    const { db } = getFirebaseServices();
    const templatesRef = collection(db, COLLECTION_NAME);

    const now = Timestamp.now();
    const templateData = removeUndefinedFields({
      ...data,
      createdAt: now,
      updatedAt: now,
      isActive: true,
    });

    const docRef = await addDoc(templatesRef, templateData);
    return docRef.id;
  }

  async updateTemplate(
    id: string,
    data: Partial<NpcTemplateFormData>
  ): Promise<void> {
    const { db } = getFirebaseServices();
    const docRef = doc(db, COLLECTION_NAME, id);

    const updateData = removeUndefinedFields({
      ...data,
      updatedAt: Timestamp.now(),
    });

    await updateDoc(docRef, updateData);
  }

  async deleteTemplate(id: string): Promise<void> {
    const { db } = getFirebaseServices();
    const docRef = doc(db, COLLECTION_NAME, id);
    await deleteDoc(docRef);
  }

  async toggleTemplateStatus(id: string, isActive: boolean): Promise<void> {
    const { db } = getFirebaseServices();
    const docRef = doc(db, COLLECTION_NAME, id);

    await updateDoc(docRef, {
      isActive,
      updatedAt: Timestamp.now(),
    });
  }
}

export const npcTemplateService = NpcTemplateService.getInstance();
