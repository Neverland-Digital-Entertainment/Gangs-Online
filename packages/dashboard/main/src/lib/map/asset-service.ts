/**
 * Building Asset Service — Firestore-only CRUD for `building_assets`
 * (Map Editor P3, revised for free plan / no Firebase Storage)
 *
 * 免費方案沒有 Firebase Storage，所以：
 *  - GLB 以 base64 分塊存在子集合 building_assets/{id}/chunks/{index}
 *    （每塊 < 1MB，避開 Firestore 單文件上限）
 *  - 縮圖以 data URL（base64）直接存在 building_assets 文件
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  writeBatch,
  Timestamp,
  type DocumentData,
} from 'firebase/firestore';
import { getFirebaseServices } from '../firebase/config';
import type { BuildingAsset, BuildingAssetInput } from '@/types/map';

const COLLECTION_NAME = 'building_assets';
const CHUNKS_SUB = 'chunks';
const CHUNK_SIZE = 700_000; // base64 字元/塊（單文件 < 1MB）
const BATCH_LIMIT = 400; // Firestore 批次上限 500，保守用 400

/** 上載大小上限（原始位元組）。base64 會膨脹 ~33%，並吃 Firestore 容量。 */
export const MAX_ASSET_BYTES = 10 * 1024 * 1024;

function removeUndefinedFields<T extends Record<string, unknown>>(
  obj: T
): Partial<T> {
  const cleaned: Record<string, unknown> = {};
  for (const key in obj) {
    if (obj[key] !== undefined) cleaned[key] = obj[key];
  }
  return cleaned as Partial<T>;
}

function toAsset(id: string, data: DocumentData): BuildingAsset {
  return {
    id,
    name: data.name,
    thumbnailUrl: data.thumbnailUrl ?? undefined,
    category: data.category ?? undefined,
    defaultScale: data.defaultScale ?? undefined,
    tags: data.tags ?? undefined,
    fileSize: data.fileSize ?? undefined,
    mimeType: data.mimeType ?? undefined,
    chunkCount: data.chunkCount ?? undefined,
    createdAt: data.createdAt?.toDate?.() || new Date(),
    updatedAt: data.updatedAt?.toDate?.() || new Date(),
  };
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const block = 0x8000;
  for (let i = 0; i < bytes.length; i += block) {
    binary += String.fromCharCode(...bytes.subarray(i, i + block));
  }
  return btoa(binary);
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export class BuildingAssetService {
  private static instance: BuildingAssetService;

  private constructor() {
    getFirebaseServices();
  }

  public static getInstance(): BuildingAssetService {
    if (!BuildingAssetService.instance) {
      BuildingAssetService.instance = new BuildingAssetService();
    }
    return BuildingAssetService.instance;
  }

  async getAll(): Promise<BuildingAsset[]> {
    const { db } = getFirebaseServices();
    const q = query(
      collection(db, COLLECTION_NAME),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => toAsset(d.id, d.data()));
  }

  /**
   * 上載建築資產：把 GLB 轉 base64 分塊，連同 metadata 一起批次寫入 Firestore。
   */
  async create(input: BuildingAssetInput, glbFile: File): Promise<string> {
    const { db } = getFirebaseServices();

    const buffer = await glbFile.arrayBuffer();
    const base64 = arrayBufferToBase64(buffer);
    const chunks: string[] = [];
    for (let i = 0; i < base64.length; i += CHUNK_SIZE) {
      chunks.push(base64.slice(i, i + CHUNK_SIZE));
    }

    const docRef = doc(collection(db, COLLECTION_NAME));
    const id = docRef.id;
    const now = Timestamp.now();
    const chunksCol = collection(db, COLLECTION_NAME, id, CHUNKS_SUB);

    let batch = writeBatch(db);
    let ops = 0;

    batch.set(
      docRef,
      removeUndefinedFields({
        ...input,
        mimeType: glbFile.type || 'model/gltf-binary',
        fileSize: glbFile.size,
        chunkCount: chunks.length,
        createdAt: now,
        updatedAt: now,
      })
    );
    ops++;

    for (let i = 0; i < chunks.length; i++) {
      batch.set(doc(chunksCol, String(i)), { index: i, data: chunks[i] });
      ops++;
      if (ops >= BATCH_LIMIT) {
        await batch.commit();
        batch = writeBatch(db);
        ops = 0;
      }
    }
    if (ops > 0) await batch.commit();

    return id;
  }

  /** 為既有資產掛上縮圖（data URL 存文件，失敗不影響資產本身） */
  async attachThumbnail(id: string, thumbnail: Blob): Promise<void> {
    const { db } = getFirebaseServices();
    const dataUrl = await blobToDataUrl(thumbnail);
    await updateDoc(doc(db, COLLECTION_NAME, id), {
      thumbnailUrl: dataUrl,
      updatedAt: Timestamp.now(),
    });
  }

  async update(id: string, patch: Partial<BuildingAssetInput>): Promise<void> {
    const { db } = getFirebaseServices();
    await updateDoc(doc(db, COLLECTION_NAME, id), {
      ...removeUndefinedFields(patch),
      updatedAt: Timestamp.now(),
    });
  }

  async delete(asset: BuildingAsset): Promise<void> {
    const { db } = getFirebaseServices();
    const chunksSnap = await getDocs(
      collection(db, COLLECTION_NAME, asset.id, CHUNKS_SUB)
    );

    let batch = writeBatch(db);
    let ops = 0;
    for (const d of chunksSnap.docs) {
      batch.delete(d.ref);
      ops++;
      if (ops >= BATCH_LIMIT) {
        await batch.commit();
        batch = writeBatch(db);
        ops = 0;
      }
    }
    batch.delete(doc(db, COLLECTION_NAME, asset.id));
    await batch.commit();
  }

  /**
   * 載入資產 GLB，重組成可餵給 Babylon 的 object URL。
   * 供地圖編輯器（P4）與遊戲客戶端（P5）使用。呼叫端用完應 URL.revokeObjectURL。
   */
  async loadGlbObjectUrl(id: string): Promise<string> {
    const { db } = getFirebaseServices();
    const assetSnap = await getDoc(doc(db, COLLECTION_NAME, id));
    const mimeType =
      (assetSnap.data()?.mimeType as string) || 'model/gltf-binary';

    const chunksSnap = await getDocs(
      query(
        collection(db, COLLECTION_NAME, id, CHUNKS_SUB),
        orderBy('index')
      )
    );
    let base64 = '';
    for (const d of chunksSnap.docs) base64 += d.data().data as string;

    const bytes = base64ToUint8Array(base64);
    const blob = new Blob([bytes as unknown as BlobPart], { type: mimeType });
    return URL.createObjectURL(blob);
  }
}

export const buildingAssetService = BuildingAssetService.getInstance();
