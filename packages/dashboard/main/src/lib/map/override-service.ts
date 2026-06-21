/**
 * Map Override Service — Firestore CRUD for `map_overrides`
 * (Map Editor P2)
 *
 * 每筆 override 記錄一個對既有地圖物件的編輯動作（delete / transform /
 * replace / add）。客戶端載入底圖後讀取並套用（P5）。
 */

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  where,
  Timestamp,
} from 'firebase/firestore';
import { getFirebaseServices } from '../firebase/config';
import type { MapOverride, MapOverrideInput } from '@/types/map';

const COLLECTION_NAME = 'map_overrides';

/** Firebase 不接受 undefined，移除掉 */
function removeUndefinedFields<T extends Record<string, unknown>>(
  obj: T
): Partial<T> {
  const cleaned: Record<string, unknown> = {};
  for (const key in obj) {
    if (obj[key] !== undefined) cleaned[key] = obj[key];
  }
  return cleaned as Partial<T>;
}

function toMapOverride(id: string, data: Record<string, any>): MapOverride {
  return {
    id,
    mapName: data.mapName,
    chunkId: data.chunkId,
    targetBuildingKey: data.targetBuildingKey,
    action: data.action,
    assetId: data.assetId ?? undefined,
    transform: data.transform ?? undefined,
    isActive: data.isActive ?? true,
    createdAt: data.createdAt?.toDate?.() || new Date(),
    updatedAt: data.updatedAt?.toDate?.() || new Date(),
    updatedBy: data.updatedBy ?? undefined,
  };
}

export class MapOverrideService {
  private static instance: MapOverrideService;

  private constructor() {
    getFirebaseServices();
  }

  public static getInstance(): MapOverrideService {
    if (!MapOverrideService.instance) {
      MapOverrideService.instance = new MapOverrideService();
    }
    return MapOverrideService.instance;
  }

  /**
   * 取得某個 chunk 的所有 override。
   * 只用單一 where（避免需要 Firestore 複合索引），其餘在前端處理。
   */
  async getByChunk(chunkId: string): Promise<MapOverride[]> {
    const { db } = getFirebaseServices();
    const ref = collection(db, COLLECTION_NAME);
    const q = query(ref, where('chunkId', '==', chunkId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => toMapOverride(d.id, d.data()));
  }

  async create(input: MapOverrideInput): Promise<string> {
    const { db } = getFirebaseServices();
    const now = Timestamp.now();
    const data = removeUndefinedFields({
      ...input,
      isActive: input.isActive ?? true,
      createdAt: now,
      updatedAt: now,
    });
    const ref = await addDoc(collection(db, COLLECTION_NAME), data);
    return ref.id;
  }

  async update(id: string, patch: Partial<MapOverrideInput>): Promise<void> {
    const { db } = getFirebaseServices();
    const data = removeUndefinedFields({
      ...patch,
      updatedAt: Timestamp.now(),
    });
    await updateDoc(doc(db, COLLECTION_NAME, id), data);
  }

  async delete(id: string): Promise<void> {
    const { db } = getFirebaseServices();
    await deleteDoc(doc(db, COLLECTION_NAME, id));
  }

  async setActive(id: string, isActive: boolean): Promise<void> {
    const { db } = getFirebaseServices();
    await updateDoc(doc(db, COLLECTION_NAME, id), {
      isActive,
      updatedAt: Timestamp.now(),
    });
  }
}

export const mapOverrideService = MapOverrideService.getInstance();
