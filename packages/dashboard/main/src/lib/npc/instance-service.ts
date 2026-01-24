/**
 * NPC Instance Service for Firebase Operations
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
import { npcTemplateService } from './template-service';
import type {
  NpcInstance,
  NpcInstanceFormData,
  NpcInstanceFilter,
} from '@/types/npc';

const COLLECTION_NAME = 'npc_instances';

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

export class NpcInstanceService {
  private static instance: NpcInstanceService;

  private constructor() {
    getFirebaseServices();
  }

  public static getInstance(): NpcInstanceService {
    if (!NpcInstanceService.instance) {
      NpcInstanceService.instance = new NpcInstanceService();
    }
    return NpcInstanceService.instance;
  }

  async getAllInstances(
    filter?: NpcInstanceFilter,
    includeTemplate = true
  ): Promise<NpcInstance[]> {
    const { db } = getFirebaseServices();
    const instancesRef = collection(db, COLLECTION_NAME);

    let q = query(instancesRef, orderBy('createdAt', 'desc'));

    if (filter?.templateId) {
      q = query(instancesRef, where('templateId', '==', filter.templateId), orderBy('createdAt', 'desc'));
    }

    if (filter?.mapId) {
      q = query(q, where('mapId', '==', filter.mapId));
    }

    if (filter?.movementPattern) {
      q = query(q, where('movementPattern', '==', filter.movementPattern));
    }

    if (filter?.isActive !== undefined) {
      q = query(q, where('isActive', '==', filter.isActive));
    }

    const snapshot = await getDocs(q);
    const instances = await Promise.all(
      snapshot.docs.map(async (doc) => {
        const data = doc.data();
        const instance: NpcInstance = {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        } as NpcInstance;

        // Populate template if requested
        if (includeTemplate && instance.templateId) {
          const template = await npcTemplateService
            .getTemplateById(instance.templateId)
            .catch(() => null);
          instance.template = template || undefined;
        }

        return instance;
      })
    );

    // Client-side search filter
    if (filter?.search) {
      const searchLower = filter.search.toLowerCase();
      return instances.filter(
        (instance) =>
          instance.template?.name.toLowerCase().includes(searchLower) ||
          instance.mapId?.toLowerCase().includes(searchLower) ||
          instance.territoryId?.toLowerCase().includes(searchLower)
      );
    }

    return instances;
  }

  async getInstanceById(
    id: string,
    includeTemplate = true
  ): Promise<NpcInstance | null> {
    const { db } = getFirebaseServices();
    const docRef = doc(db, COLLECTION_NAME, id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    const data = docSnap.data();
    const instance: NpcInstance = {
      id: docSnap.id,
      ...data,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
    } as NpcInstance;

    // Populate template if requested
    if (includeTemplate && instance.templateId) {
      const template = await npcTemplateService
        .getTemplateById(instance.templateId)
        .catch(() => null);
      instance.template = template || undefined;
    }

    return instance;
  }

  async createInstance(data: NpcInstanceFormData): Promise<string> {
    const { db } = getFirebaseServices();
    const instancesRef = collection(db, COLLECTION_NAME);

    const now = Timestamp.now();
    const instanceData = removeUndefinedFields({
      ...data,
      createdAt: now,
      updatedAt: now,
      isActive: true,
    });

    const docRef = await addDoc(instancesRef, instanceData);
    return docRef.id;
  }

  async updateInstance(
    id: string,
    data: Partial<NpcInstanceFormData>
  ): Promise<void> {
    const { db } = getFirebaseServices();
    const docRef = doc(db, COLLECTION_NAME, id);

    const updateData = removeUndefinedFields({
      ...data,
      updatedAt: Timestamp.now(),
    });

    await updateDoc(docRef, updateData);
  }

  async deleteInstance(id: string): Promise<void> {
    const { db } = getFirebaseServices();
    const docRef = doc(db, COLLECTION_NAME, id);
    await deleteDoc(docRef);
  }

  async toggleInstanceStatus(id: string, isActive: boolean): Promise<void> {
    const { db } = getFirebaseServices();
    const docRef = doc(db, COLLECTION_NAME, id);

    await updateDoc(docRef, {
      isActive,
      updatedAt: Timestamp.now(),
    });
  }

  async getInstancesByMapId(mapId: string): Promise<NpcInstance[]> {
    return this.getAllInstances({ mapId }, true);
  }

  async getInstancesByTemplateId(templateId: string): Promise<NpcInstance[]> {
    return this.getAllInstances({ templateId }, false);
  }
}

export const npcInstanceService = NpcInstanceService.getInstance();
