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
          template.modelId.toLowerCase().includes(searchLower) ||
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
    const templateData = {
      ...data,
      createdAt: now,
      updatedAt: now,
      isActive: true,
    };

    const docRef = await addDoc(templatesRef, templateData);
    return docRef.id;
  }

  async updateTemplate(
    id: string,
    data: Partial<NpcTemplateFormData>
  ): Promise<void> {
    const { db } = getFirebaseServices();
    const docRef = doc(db, COLLECTION_NAME, id);

    const updateData = {
      ...data,
      updatedAt: Timestamp.now(),
    };

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
