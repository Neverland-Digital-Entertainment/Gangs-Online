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
  setDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  where,
  writeBatch,
  Timestamp,
} from 'firebase/firestore';
import { getFirebaseServices } from '../firebase/config';
import type { MapOverride, MapOverrideInput, MapOverrideSnapshotItem } from '@/types/map';

const COLLECTION_NAME = 'map_overrides';
const SNAPSHOT_COLLECTION = 'map_snapshots';
const SNAPSHOT_PARTS_SUB = 'parts';
/** 單一 Firestore 文件安全上限的保守值（實際上限 1MiB） */
const SNAPSHOT_SIZE_BUDGET = 900_000;
const BATCH_LIMIT = 400;

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
    groupId: data.groupId || undefined,
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

  /**
   * 取得所有引用某個資產的 override（跨全部 chunk）。
   * 用於阻止刪除仍在地圖上使用的資產 —— 一旦刪除，客戶端載入時
   * 會找不到資產，該位置變成空白且只在 console 留下警告。
   */
  async getByAsset(assetId: string): Promise<MapOverride[]> {
    const { db } = getFirebaseServices();
    const ref = collection(db, COLLECTION_NAME);
    const q = query(ref, where('assetId', '==', assetId));
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

  /** 取得某地圖（跨全部 chunk）的所有 override，供發佈快照使用 */
  async getAllForMap(mapName: string): Promise<MapOverride[]> {
    const { db } = getFirebaseServices();
    const ref = collection(db, COLLECTION_NAME);
    const q = query(ref, where('mapName', '==', mapName));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => toMapOverride(d.id, d.data()));
  }

  /**
   * 發佈快照（Phase 3，方案 4）：把某地圖目前所有 `isActive` 的 override
   * 寫成 `map_snapshots/{mapName}` 一個文件，讓客戶端只需 1 個 read 就攞晒
   * 全部編輯，唔使逐 chunk 查詢 `map_overrides`。
   *
   * 若序列化後超過安全上限（900KB），改為分片寫入
   * `map_snapshots/{mapName}/parts/{n}`，主文件只留 metadata。
   * 每次發佈都會先清走舊分片，避免項目數減少後留低過期資料。
   */
  async publishSnapshot(
    mapName: string,
    publishedBy?: string
  ): Promise<{ itemCount: number; chunked: boolean; sizeBytes: number }> {
    const { db } = getFirebaseServices();
    const overrides = await this.getAllForMap(mapName);

    const items: MapOverrideSnapshotItem[] = overrides
      .filter((o) => o.isActive)
      .map((o) =>
        removeUndefinedFields({
          k: o.targetBuildingKey,
          c: o.chunkId,
          a: o.action,
          id: o.assetId,
          t: o.transform,
          g: o.groupId,
        }) as MapOverrideSnapshotItem
      );

    const encoder = new TextEncoder();
    const sizeBytes = encoder.encode(JSON.stringify(items)).length;
    const chunked = sizeBytes > SNAPSHOT_SIZE_BUDGET;

    // 先清走舊分片，避免項目數變少後殘留過期資料
    const oldParts = await getDocs(
      collection(db, SNAPSHOT_COLLECTION, mapName, SNAPSHOT_PARTS_SUB)
    );
    if (oldParts.size > 0) {
      let batch = writeBatch(db);
      let ops = 0;
      for (const d of oldParts.docs) {
        batch.delete(d.ref);
        ops++;
        if (ops >= BATCH_LIMIT) {
          await batch.commit();
          batch = writeBatch(db);
          ops = 0;
        }
      }
      if (ops > 0) await batch.commit();
    }

    const now = Timestamp.now();
    const docRef = doc(db, SNAPSHOT_COLLECTION, mapName);

    if (!chunked) {
      await setDoc(docRef, {
        version: now.toMillis(),
        publishedAt: now,
        publishedBy: publishedBy ?? null,
        itemCount: items.length,
        chunked: false,
        items,
      });
      return { itemCount: items.length, chunked, sizeBytes };
    }

    // 按大小切分：每份都在安全上限之內
    const parts: MapOverrideSnapshotItem[][] = [];
    let current: MapOverrideSnapshotItem[] = [];
    let currentSize = 0;
    for (const item of items) {
      const itemSize = encoder.encode(JSON.stringify(item)).length;
      if (currentSize + itemSize > SNAPSHOT_SIZE_BUDGET && current.length > 0) {
        parts.push(current);
        current = [];
        currentSize = 0;
      }
      current.push(item);
      currentSize += itemSize;
    }
    if (current.length > 0) parts.push(current);

    let batch = writeBatch(db);
    let ops = 0;
    for (let i = 0; i < parts.length; i++) {
      batch.set(doc(collection(db, SNAPSHOT_COLLECTION, mapName, SNAPSHOT_PARTS_SUB), String(i)), {
        index: i,
        items: parts[i],
      });
      ops++;
      if (ops >= BATCH_LIMIT) {
        await batch.commit();
        batch = writeBatch(db);
        ops = 0;
      }
    }
    if (ops > 0) await batch.commit();

    await setDoc(docRef, {
      version: now.toMillis(),
      publishedAt: now,
      publishedBy: publishedBy ?? null,
      itemCount: items.length,
      chunked: true,
      partCount: parts.length,
    });

    return { itemCount: items.length, chunked, sizeBytes };
  }
}

export const mapOverrideService = MapOverrideService.getInstance();
