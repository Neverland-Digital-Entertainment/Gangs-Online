/**
 * Building Asset Service — Firestore + Storage CRUD for `building_assets`
 * (Map Editor P3)
 *
 * 上載的建築 GLB 存 Firebase Storage（building-assets/），縮圖存
 * building-thumbnails/，metadata 存 Firestore building_assets 集合。
 */

import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  orderBy,
  Timestamp,
  type DocumentData,
} from 'firebase/firestore';
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';
import { getFirebaseServices } from '../firebase/config';
import type { BuildingAsset, BuildingAssetInput } from '@/types/map';

const COLLECTION_NAME = 'building_assets';
const GLB_PATH = 'building-assets';
const THUMB_PATH = 'building-thumbnails';

/** 讓 Storage 操作不要無限重試/卡死，逾時即丟錯讓上層處理 */
function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(
        () => reject(new Error(`${label} timed out after ${ms / 1000}s`)),
        ms
      )
    ),
  ]);
}

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
    glbUrl: data.glbUrl ?? '',
    storagePath: data.storagePath ?? '',
    thumbnailUrl: data.thumbnailUrl ?? undefined,
    thumbnailPath: data.thumbnailPath ?? undefined,
    category: data.category ?? undefined,
    defaultScale: data.defaultScale ?? undefined,
    tags: data.tags ?? undefined,
    fileSize: data.fileSize ?? undefined,
    createdAt: data.createdAt?.toDate?.() || new Date(),
    updatedAt: data.updatedAt?.toDate?.() || new Date(),
  };
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
   * 上載一個建築資產：先把 GLB 上傳到 Storage（成功後）才寫入完整 Firestore doc，
   * 避免 Storage 失敗時留下半成品。縮圖另外由 attachThumbnail 處理（非必要）。
   */
  async create(input: BuildingAssetInput, glbFile: File): Promise<string> {
    const { db, storage } = getFirebaseServices();
    // 縮短重試時間，避免上傳失敗時卡好幾分鐘
    storage.maxUploadRetryTime = 20000;
    storage.maxOperationRetryTime = 20000;

    const docRef = doc(collection(db, COLLECTION_NAME)); // 先取得 id（不寫入）
    const id = docRef.id;
    const storagePath = `${GLB_PATH}/${id}.glb`;
    const glbRef = ref(storage, storagePath);

    await withTimeout(
      uploadBytes(glbRef, glbFile, { contentType: 'model/gltf-binary' }),
      60000,
      'GLB upload'
    );
    const glbUrl = await withTimeout(
      getDownloadURL(glbRef),
      20000,
      'Get GLB URL'
    );

    const now = Timestamp.now();
    await setDoc(
      docRef,
      removeUndefinedFields({
        ...input,
        glbUrl,
        storagePath,
        fileSize: glbFile.size,
        createdAt: now,
        updatedAt: now,
      })
    );
    return id;
  }

  /** 為既有資產上傳並掛上縮圖（失敗不影響資產本身） */
  async attachThumbnail(id: string, thumbnail: Blob): Promise<void> {
    const { db, storage } = getFirebaseServices();
    storage.maxUploadRetryTime = 20000;
    storage.maxOperationRetryTime = 20000;

    const thumbnailPath = `${THUMB_PATH}/${id}.png`;
    const thumbRef = ref(storage, thumbnailPath);
    await withTimeout(
      uploadBytes(thumbRef, thumbnail, { contentType: 'image/png' }),
      30000,
      'Thumbnail upload'
    );
    const thumbnailUrl = await withTimeout(
      getDownloadURL(thumbRef),
      20000,
      'Get thumbnail URL'
    );
    await updateDoc(doc(db, COLLECTION_NAME, id), {
      thumbnailUrl,
      thumbnailPath,
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
    const { db, storage } = getFirebaseServices();
    // 先刪 Storage 檔（失敗不阻斷刪除 metadata）
    if (asset.storagePath) {
      try {
        await deleteObject(ref(storage, asset.storagePath));
      } catch (err) {
        console.error('刪除 GLB 失敗:', err);
      }
    }
    if (asset.thumbnailPath) {
      try {
        await deleteObject(ref(storage, asset.thumbnailPath));
      } catch (err) {
        console.error('刪除縮圖失敗:', err);
      }
    }
    await deleteDoc(doc(db, COLLECTION_NAME, asset.id));
  }
}

export const buildingAssetService = BuildingAssetService.getInstance();
