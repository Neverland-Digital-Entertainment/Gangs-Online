/**
 * 群組服務 — Firestore CRUD for `dashboard_groups`
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
  orderBy,
  Timestamp,
  type DocumentData,
} from 'firebase/firestore';
import { getFirebaseServices } from '../firebase/config';
import type { DashboardGroup, DashboardGroupInput } from '@/types/admin';

const COLLECTION_NAME = 'dashboard_groups';

function removeUndefinedFields<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const cleaned: Record<string, unknown> = {};
  for (const key in obj) if (obj[key] !== undefined) cleaned[key] = obj[key];
  return cleaned as Partial<T>;
}

function toGroup(id: string, data: DocumentData): DashboardGroup {
  return {
    id,
    name: data.name,
    description: data.description ?? undefined,
    permissions: data.permissions ?? [],
    isActive: data.isActive ?? true,
    createdAt: data.createdAt?.toDate?.() || new Date(),
    updatedAt: data.updatedAt?.toDate?.() || new Date(),
  };
}

export class GroupService {
  private static instance: GroupService;
  private constructor() {
    getFirebaseServices();
  }
  public static getInstance(): GroupService {
    if (!GroupService.instance) GroupService.instance = new GroupService();
    return GroupService.instance;
  }

  async getAll(): Promise<DashboardGroup[]> {
    const { db } = getFirebaseServices();
    const snap = await getDocs(query(collection(db, COLLECTION_NAME), orderBy('name')));
    return snap.docs.map((d) => toGroup(d.id, d.data()));
  }

  async getById(id: string): Promise<DashboardGroup | null> {
    const { db } = getFirebaseServices();
    const s = await getDoc(doc(db, COLLECTION_NAME, id));
    return s.exists() ? toGroup(s.id, s.data()) : null;
  }

  async create(input: DashboardGroupInput): Promise<string> {
    const { db } = getFirebaseServices();
    const now = Timestamp.now();
    const ref = await addDoc(
      collection(db, COLLECTION_NAME),
      removeUndefinedFields({
        ...input,
        isActive: input.isActive ?? true,
        createdAt: now,
        updatedAt: now,
      })
    );
    return ref.id;
  }

  async update(id: string, patch: Partial<DashboardGroupInput>): Promise<void> {
    const { db } = getFirebaseServices();
    await updateDoc(doc(db, COLLECTION_NAME, id), {
      ...removeUndefinedFields(patch),
      updatedAt: Timestamp.now(),
    });
  }

  async delete(id: string): Promise<void> {
    const { db } = getFirebaseServices();
    await deleteDoc(doc(db, COLLECTION_NAME, id));
  }
}

export const groupService = GroupService.getInstance();
