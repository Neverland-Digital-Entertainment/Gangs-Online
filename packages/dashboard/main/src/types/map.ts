/**
 * Map Editor type definitions
 * Phase: Map Editor (see docs/map-editor-plan.md)
 *
 * 命名規範（與遊戲客戶端一致）：
 *   B 開頭 = 大廈 (building)
 *   I 開頭 = 物件 / props (prop)
 *   T 開頭 = 地形 (terrain)
 */

export type MapObjectType = 'building' | 'prop' | 'terrain' | 'other';

/** 3D 編輯器的操作模式 */
export type GizmoMode = 'none' | 'move' | 'rotate' | 'scale';

/** manifest.json 中的 chunk 描述 */
export interface MapChunkInfo {
  id: string;
  file: string;
  description?: string;
}

/** manifest.json 中的獨立場景（如監獄；v1 編輯器暫不支援） */
export interface MapSceneInfo {
  id: string;
  file: string;
  description?: string;
}

/** 地圖 manifest.json 結構 */
export interface MapManifest {
  mapName: string;
  version: string;
  startChunk: string;
  chunks: MapChunkInfo[];
  scenes?: MapSceneInfo[];
}

/**
 * 從已載入 chunk 中發現的可選取物件（執行期資料，不持久化）。
 * key = `${chunkId}:${meshName}`，作為覆蓋層的穩定識別碼。
 */
export interface MapObjectInfo {
  meshName: string;
  chunkId: string;
  type: MapObjectType;
  key: string;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  scale: { x: number; y: number; z: number };
  boundingSize: { x: number; y: number; z: number };
}

// ---- 持久化資料模型（P2 起使用） ----

export type OverrideAction = 'delete' | 'transform' | 'replace' | 'add';

export interface Transform {
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  scale: { x: number; y: number; z: number };
}

/** Firestore：map_overrides 集合 */
export interface MapOverride {
  id: string;
  mapName: string;
  chunkId: string;
  /** 被操作的原始物件識別碼 = `${chunkId}:${meshName}` */
  targetBuildingKey: string;
  action: OverrideAction;
  /** replace / add 時指向 building_assets */
  assetId?: string;
  transform?: Transform;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  updatedBy?: string;
}

/** 建立 / 更新 map_overrides 時的輸入（不含系統欄位） */
export interface MapOverrideInput {
  mapName: string;
  chunkId: string;
  targetBuildingKey: string;
  action: OverrideAction;
  assetId?: string;
  transform?: Transform;
  isActive?: boolean;
}

/** Firestore：building_assets 集合 */
export interface BuildingAsset {
  id: string;
  name: string;
  /** 下載網址（給編輯器 / 客戶端載入） */
  glbUrl: string;
  /** Firebase Storage 路徑（刪除用），如 building-assets/xxx.glb */
  storagePath: string;
  thumbnailUrl?: string;
  thumbnailPath?: string;
  category?: string;
  defaultScale?: number;
  tags?: string[];
  fileSize?: number;
  createdAt: Date;
  updatedAt: Date;
}

/** 建立 / 更新 building_assets 的可編輯欄位 */
export interface BuildingAssetInput {
  name: string;
  category?: string;
  defaultScale?: number;
  tags?: string[];
}

/** 依 mesh 名稱首字母分類（與客戶端 ChunkLoaderSystem 規則一致） */
export function classifyMeshName(name: string): MapObjectType {
  const c = name.charAt(0).toUpperCase();
  if (c === 'B') return 'building';
  if (c === 'I') return 'prop';
  if (c === 'T') return 'terrain';
  return 'other';
}

/** 組出覆蓋層穩定識別碼 */
export function buildObjectKey(chunkId: string, meshName: string): string {
  return `${chunkId}:${meshName}`;
}
