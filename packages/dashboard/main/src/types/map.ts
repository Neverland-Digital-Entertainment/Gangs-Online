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

/**
 * 資產實例的載入狀況（執行期資料）。
 * 用於區分「仍在載入」與「真正載入失敗」——兩者都會令物件暫時不在場景中，
 * 但只有後者才值得向使用者示警。
 */
export interface InstanceStatus {
  /** 正在載入中的 override key */
  loading: string[];
  /** override key → 失敗原因 */
  failed: Record<string, string>;
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
  /**
   * 遮擋群組。填同一個值的實例，會被客戶端當成同一棟大廈一齊淡出
   * （例如地舖層與上層樓層分開擺放）。
   * 留空 = 自成一組，與其他實例互不影響。
   */
  groupId?: string;
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
  groupId?: string;
}

/**
 * Firestore：building_assets 集合
 *
 * 因免費方案無 Firebase Storage，GLB 以 base64 分塊存在子集合
 * building_assets/{id}/chunks/{index}；縮圖以 data URL 存在本文件。
 */
/**
 * 資產用途。決定客戶端載入後的碰撞、可選取性與遮擋登記方式。
 *   building（預設）：實心建築，有碰撞體、參與遮擋淡出
 *   prop：街道物件，有碰撞體但不參與遮擋
 *   decal：貼地平面（路面箭嘴、斑馬線、渠蓋等），無碰撞、不可選取、
 *          不參與遮擋，並自動套用深度偏移避免與路面 z-fighting
 */
export type AssetKind = 'building' | 'prop' | 'decal';

export const ASSET_KINDS: AssetKind[] = ['building', 'prop', 'decal'];

export interface BuildingAsset {
  id: string;
  name: string;
  /** 縮圖 data URL（base64，直接存文件） */
  thumbnailUrl?: string;
  /** 用途；舊資料留空時客戶端一律當成 building */
  kind?: AssetKind;
  category?: string;
  defaultScale?: number;
  tags?: string[];
  /** 原始 GLB 位元組大小 */
  fileSize?: number;
  /** GLB MIME，預設 model/gltf-binary */
  mimeType?: string;
  /** base64 分塊數量（存於 chunks 子集合） */
  chunkCount?: number;
  createdAt: Date;
  updatedAt: Date;
}

/** 建立 / 更新 building_assets 的可編輯欄位 */
export interface BuildingAssetInput {
  name: string;
  kind?: AssetKind;
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
