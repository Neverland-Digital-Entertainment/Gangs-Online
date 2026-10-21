/**
 * 大廈包匯入（tools/buildings 產生嘅 manifest.json + 一堆 GLB）
 *
 * 每棟大廈 = 一個 building_assets 資產 + 一筆 map_overrides `add`。
 * override 的 key 由 manifest 固定（`add:<packId>:<id>`），所以重新匯入同一個包
 * 唔會重複擺放：
 *   - GLB 冇變（以內容 hash 標籤比對）→ 只更新擺放位置
 *   - GLB 有變 → 上載新資產、override 改指向新資產，舊資產冇其他人用就刪走
 */

import { buildingAssetService } from './asset-service';
import { mapOverrideService } from './override-service';
import { generateGlbThumbnail } from './thumbnail';
import type { AssetKind, BuildingAsset, MapOverride, Transform } from '@/types/map';

export const BUILDING_PACK_FORMAT = 'gangs-online/building-pack@1';

/** 資產標籤：GLB 內容 hash，用嚟判斷重新匯入時檔案有冇變 */
const HASH_TAG_PREFIX = 'glb:';

export interface BuildingPackEntry {
  id: string;
  file: string;
  name: string;
  kind: AssetKind;
  category?: string;
  tags?: string[];
  /** 固定的 override key，重新匯入時用嚟搵返同一筆擺放 */
  key: string;
  /** chunk __root__ 本地座標（與地圖編輯器同一座標系） */
  transform: Transform;
  tris?: number;
}

export interface BuildingPackManifest {
  format: string;
  packId: string;
  mapName: string;
  chunkId: string;
  buildings: BuildingPackEntry[];
}

export interface ParsedBuildingPack {
  manifest: BuildingPackManifest;
  files: Map<string, File>;
  /** manifest 有列但冇揀到嘅 GLB */
  missing: string[];
  totalBytes: number;
}

export interface PackImportResult {
  created: number;
  updated: number;
  moved: number;
  unchanged: number;
  failed: { id: string; error: string }[];
}

export type PackProgress = (done: number, total: number, label: string) => void;

/** 由揀選的檔案（manifest.json + *.glb）讀出大廈包；格式唔啱會 throw */
export async function parseBuildingPack(selected: File[]): Promise<ParsedBuildingPack> {
  const manifestFile = selected.find((f) => f.name.toLowerCase() === 'manifest.json');
  if (!manifestFile) throw new Error('manifest.json not selected');
  const manifest = JSON.parse(await manifestFile.text()) as BuildingPackManifest;
  if (manifest.format !== BUILDING_PACK_FORMAT || !Array.isArray(manifest.buildings)) {
    throw new Error(`unsupported pack format: ${manifest.format ?? '(none)'}`);
  }
  const files = new Map<string, File>();
  for (const f of selected) {
    if (f.name.toLowerCase().endsWith('.glb')) files.set(f.name, f);
  }
  const missing = manifest.buildings.filter((b) => !files.has(b.file)).map((b) => b.file);
  const totalBytes = manifest.buildings.reduce((sum, b) => sum + (files.get(b.file)?.size ?? 0), 0);
  return { manifest, files, missing, totalBytes };
}

/** 隨後台一齊發佈嘅大廈包（scripts/copy-maps.mjs 由 tools/buildings/out 複製） */
export interface BuiltinPackInfo {
  dir: string;
  packId: string;
  chunkId: string;
  buildings: number;
}

const BUILTIN_PACK_BASE = '/building-packs';

export async function listBuiltinPacks(): Promise<BuiltinPackInfo[]> {
  const res = await fetch(`${BUILTIN_PACK_BASE}/index.json`, { cache: 'no-store' });
  if (!res.ok) return [];
  return (await res.json()) as BuiltinPackInfo[];
}

/** 下載內建大廈包（manifest + 全部 GLB），變成同人手揀檔一樣嘅格式 */
export async function loadBuiltinPack(
  dir: string,
  onProgress?: PackProgress
): Promise<ParsedBuildingPack> {
  const base = `${BUILTIN_PACK_BASE}/${encodeURIComponent(dir)}`;
  const fetchFile = async (name: string, type: string) => {
    const res = await fetch(`${base}/${encodeURIComponent(name)}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
    return new File([await res.blob()], name, { type });
  };
  const manifestFile = await fetchFile('manifest.json', 'application/json');
  const manifest = JSON.parse(await manifestFile.text()) as BuildingPackManifest;
  const files: File[] = [manifestFile];
  for (let i = 0; i < manifest.buildings.length; i++) {
    onProgress?.(i, manifest.buildings.length, manifest.buildings[i].id);
    files.push(await fetchFile(manifest.buildings[i].file, 'model/gltf-binary'));
  }
  return parseBuildingPack(files);
}

async function sha256Short(file: File): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return Array.from(new Uint8Array(digest).slice(0, 8))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function sameTransform(a?: Transform, b?: Transform): boolean {
  if (!a || !b) return false;
  const close = (x: number, y: number) => Math.abs(x - y) < 1e-4;
  return (['position', 'rotation', 'scale'] as const).every((k) =>
    (['x', 'y', 'z'] as const).every((axis) => close(a[k][axis], b[k][axis]))
  );
}

/** 上載一棟大廈嘅 GLB + 縮圖，回傳新資產 id */
async function uploadEntry(
  pack: BuildingPackManifest,
  entry: BuildingPackEntry,
  file: File,
  hash: string
): Promise<string> {
  const id = await buildingAssetService.create(
    {
      name: entry.name,
      kind: entry.kind,
      category: entry.category || pack.chunkId,
      defaultScale: 1,
      tags: [...(entry.tags ?? []), `${HASH_TAG_PREFIX}${hash}`],
    },
    file
  );
  try {
    const thumb = await generateGlbThumbnail(file);
    if (thumb) await buildingAssetService.attachThumbnail(id, thumb);
  } catch (err) {
    console.error('[building-pack] 縮圖失敗（資產已建立）:', entry.id, err);
  }
  return id;
}

/** 舊資產冇其他擺放引用就刪走，避免重新匯入後留低一堆無用資產 */
async function deleteIfUnused(asset: BuildingAsset | undefined): Promise<void> {
  if (!asset) return;
  const refs = await mapOverrideService.getByAsset(asset.id);
  if (refs.length > 0) return;
  await buildingAssetService.delete(asset);
  buildingAssetService.invalidateGlbCache(asset.id);
}

export async function importBuildingPack(
  pack: ParsedBuildingPack,
  onProgress?: PackProgress
): Promise<PackImportResult> {
  const { manifest, files } = pack;
  const result: PackImportResult = { created: 0, updated: 0, moved: 0, unchanged: 0, failed: [] };

  const [overrides, assets] = await Promise.all([
    mapOverrideService.getByChunk(manifest.chunkId),
    buildingAssetService.getAll(),
  ]);
  const overrideByKey = new Map<string, MapOverride>(overrides.map((o) => [o.targetBuildingKey, o]));
  const assetById = new Map(assets.map((a) => [a.id, a]));

  const entries = manifest.buildings.filter((b) => files.has(b.file));
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    onProgress?.(i, entries.length, entry.id);
    try {
      const file = files.get(entry.file)!;
      const hash = await sha256Short(file);
      const existing = overrideByKey.get(entry.key);
      const oldAsset = existing?.assetId ? assetById.get(existing.assetId) : undefined;

      if (existing && oldAsset?.tags?.includes(`${HASH_TAG_PREFIX}${hash}`)) {
        if (sameTransform(existing.transform, entry.transform) && existing.isActive) {
          result.unchanged++;
        } else {
          await mapOverrideService.update(existing.id, { transform: entry.transform, isActive: true });
          result.moved++;
        }
        continue;
      }

      const assetId = await uploadEntry(manifest, entry, file, hash);
      if (existing) {
        await mapOverrideService.update(existing.id, {
          action: 'add',
          assetId,
          transform: entry.transform,
          isActive: true,
        });
        await deleteIfUnused(oldAsset);
        result.updated++;
      } else {
        await mapOverrideService.create({
          mapName: manifest.mapName,
          chunkId: manifest.chunkId,
          targetBuildingKey: entry.key,
          action: 'add',
          assetId,
          transform: entry.transform,
        });
        result.created++;
      }
    } catch (err) {
      console.error('[building-pack] 匯入失敗:', entry.id, err);
      result.failed.push({ id: entry.id, error: err instanceof Error ? err.message : String(err) });
    }
  }
  onProgress?.(entries.length, entries.length, '');
  return result;
}
