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
  addDoc,
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
   * 上載一個建築資產：先建 metadata 取得 id，再上傳 GLB（與縮圖），最後回填網址。
   */
  async create(
    input: BuildingAssetInput,
    glbFile: File,
    thumbnail: Blob | null
  ): Promise<string> {
    const { db, storage } = getFirebaseServices();
    const now = Timestamp.now();

    const docRef = await addDoc(
      collection(db, COLLECTION_NAME),
      removeUndefinedFields({ ...input, createdAt: now, updatedAt: now })
    );
    const id = docRef.id;

    const storagePath = `${GLB_PATH}/${id}.glb`;
    const glbRef = ref(storage, storagePath);
    await uploadBytes(glbRef, glbFile, {
      contentType: 'model/gltf-binary',
    });
    const glbUrl = await getDownloadURL(glbRef);

    const patch: Record<string, unknown> = {
      glbUrl,
      storagePath,
      fileSize: glbFile.size,
      updatedAt: Timestamp.now(),
    };

    if (thumbnail) {
      const thumbnailPath = `${THUMB_PATH}/${id}.png`;
      const thumbRef = ref(storage, thumbnailPath);
      await uploadBytes(thumbRef, thumbnail, { contentType: 'image/png' });
      patch.thumbnailUrl = await getDownloadURL(thumbRef);
      patch.thumbnailPath = thumbnailPath;
    }

    await updateDoc(doc(db, COLLECTION_NAME, id), patch);
    return id;
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
