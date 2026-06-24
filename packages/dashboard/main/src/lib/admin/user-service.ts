/**
 * 帳號服務 — Firestore CRUD for `dashboard_users`
 * 文件 ID = Firebase uid。
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  orderBy,
  Timestamp,
  type DocumentData,
} from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { getFirebaseServices } from '../firebase/config';
import type { DashboardUser } from '@/types/admin';

const COLLECTION_NAME = 'dashboard_users';

function toUser(id: string, data: DocumentData): DashboardUser {
  return {
    id,
    email: data.email ?? '',
    displayName: data.displayName ?? undefined,
    groupIds: data.groupIds ?? [],
    isActive: data.isActive ?? false,
    createdAt: data.createdAt?.toDate?.() || new Date(),
    updatedAt: data.updatedAt?.toDate?.() || new Date(),
    lastLoginAt: data.lastLoginAt?.toDate?.() || undefined,
  };
}

export class UserService {
  private static instance: UserService;
  private constructor() {
    getFirebaseServices();
  }
  public static getInstance(): UserService {
    if (!UserService.instance) UserService.instance = new UserService();
    return UserService.instance;
  }

  async getAll(): Promise<DashboardUser[]> {
    const { db } = getFirebaseServices();
    const snap = await getDocs(query(collection(db, COLLECTION_NAME), orderBy('createdAt', 'desc')));
    return snap.docs.map((d) => toUser(d.id, d.data()));
  }

  /** 登入時呼叫：不存在則建立「待審」帳號（isActive=false），存在則更新登入資訊 */
  async ensureUser(u: User): Promise<DashboardUser> {
    const { db } = getFirebaseServices();
    const ref = doc(db, COLLECTION_NAME, u.uid);
    const snap = await getDoc(ref);
    const now = Timestamp.now();

    if (!snap.exists()) {
      const data = {
        email: u.email || '',
        displayName: u.displayName || '',
        groupIds: [],
        isActive: false,
        createdAt: now,
        updatedAt: now,
        lastLoginAt: now,
      };
      await setDoc(ref, data);
      return toUser(u.uid, data);
    }

    const prev = snap.data();
    await updateDoc(ref, {
      email: u.email || prev.email || '',
      displayName: u.displayName || prev.displayName || '',
      lastLoginAt: now,
    });
    return toUser(u.uid, { ...prev, lastLoginAt: now, email: u.email || prev.email });
  }

  async setGroups(id: string, groupIds: string[]): Promise<void> {
    const { db } = getFirebaseServices();
    await updateDoc(doc(db, COLLECTION_NAME, id), {
      groupIds,
      updatedAt: Timestamp.now(),
    });
  }

  async setActive(id: string, isActive: boolean): Promise<void> {
    const { db } = getFirebaseServices();
    await updateDoc(doc(db, COLLECTION_NAME, id), {
      isActive,
      updatedAt: Timestamp.now(),
    });
  }
}

export const userService = UserService.getInstance();
