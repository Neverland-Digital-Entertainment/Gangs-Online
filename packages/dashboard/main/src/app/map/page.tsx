'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import {
  AlertCircle,
  Eye,
  EyeOff,
  Info,
  ListTree,
  Loader2,
  Map as MapIcon,
  Plus,
} from 'lucide-react';
import { useI18n } from '@/contexts/i18n-context';
import { loadMapManifest } from '@/lib/map/map-loader';
import { mapOverrideService } from '@/lib/map/override-service';
import { buildingAssetService } from '@/lib/map/asset-service';
import type {
  BuildingAsset,
  GizmoMode,
  MapManifest,
  MapObjectInfo,
  MapOverride,
  Transform,
} from '@/types/map';
import BuildingInspector from '@/components/map/BuildingInspector';
import AssetPicker from '@/components/map/AssetPicker';

// Babylon 只能在瀏覽器執行
const MapEditor3D = dynamic(() => import('@/components/map/MapEditor3D'), {
  ssr: false,
});

export default function MapEditorPage() {
  const { t } = useI18n();
  const [manifest, setManifest] = useState<MapManifest | null>(null);
  const [manifestLoading, setManifestLoading] = useState(true);
  const [manifestError, setManifestError] = useState<string | null>(null);
  const [chunkId, setChunkId] = useState('');

  const [selected, setSelected] = useState<MapObjectInfo | null>(null);
  const [gizmoMode, setGizmoMode] = useState<GizmoMode>('move');
  const [draftTransform, setDraftTransform] = useState<Transform | null>(null);
  const [objects, setObjects] = useState<MapObjectInfo[]>([]);
  const [focusNonce, setFocusNonce] = useState(0);
  const [rightTab, setRightTab] = useState<'inspector' | 'list'>('list');
  const [showRemoved, setShowRemoved] = useState(false);

  const [overrides, setOverrides] = useState<MapOverride[]>([]);
  const [assets, setAssets] = useState<BuildingAsset[]>([]);
  const [picker, setPicker] = useState<'replace' | 'add' | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [viewerLoading, setViewerLoading] = useState(false);
  const [viewerError, setViewerError] = useState<string | null>(null);

  useEffect(() => {
    loadManifest();
    buildingAssetService
      .getAll()
      .then(setAssets)
      .catch((err) => console.error('載入建築資產失敗:', err));
  }, []);

  async function loadManifest() {
    try {
      setManifestLoading(true);
      setManifestError(null);
      const data = await loadMapManifest();
      setManifest(data);
      setChunkId(data.startChunk || data.chunks[0]?.id || '');
    } catch (err) {
      console.error('載入地圖清單失敗:', err);
      setManifestError(t('map.editor.manifestError'));
    } finally {
      setManifestLoading(false);
    }
  }

  const loadOverrides = useCallback(async (cid: string) => {
    try {
      const data = await mapOverrideService.getByChunk(cid);
      setOverrides(data);
    } catch (err) {
      console.error('載入地圖編輯資料失敗:', err);
    }
  }, []);

  // 切換 chunk 時載入該 chunk 的 overrides
  useEffect(() => {
    if (chunkId) loadOverrides(chunkId);
  }, [chunkId, loadOverrides]);

  const chunkFile = useMemo(
    () => manifest?.chunks.find((c) => c.id === chunkId)?.file ?? '',
    [manifest, chunkId]
  );
  const mapName = manifest?.mapName ?? '';

  const selectedOverride = useMemo(
    () =>
      selected
        ? overrides.find(
            (o) => o.targetBuildingKey === selected.key && o.isActive
          ) ?? null
        : null,
    [overrides, selected]
  );

  const assetsById = useMemo(() => {
    const map: Record<string, BuildingAsset> = {};
    for (const a of assets) map[a.id] = a;
    return map;
  }, [assets]);

  // 有 add/replace override 但場景裡找不到對應實例 → 載入失敗（診斷用）
  const missingInstances = useMemo(() => {
    const keys = new Set(objects.map((o) => o.key));
    return overrides.filter(
      (o) =>
        o.isActive &&
        (o.action === 'add' || o.action === 'replace') &&
        !keys.has(o.targetBuildingKey)
    );
  }, [overrides, objects]);

  // 是否有未儲存變更
  const dirty = useMemo(() => {
    if (!selected || !draftTransform) return false;
    const base = selectedOverride?.transform ?? {
      position: selected.position,
      rotation: selected.rotation,
      scale: selected.scale,
    };
    const eps = 1e-4;
    const close = (a: number, b: number) => Math.abs(a - b) < eps;
    return !(
      close(draftTransform.position.x, base.position.x) &&
      close(draftTransform.position.y, base.position.y) &&
      close(draftTransform.position.z, base.position.z) &&
      close(draftTransform.rotation.x, base.rotation.x) &&
      close(draftTransform.rotation.y, base.rotation.y) &&
      close(draftTransform.rotation.z, base.rotation.z) &&
      close(draftTransform.scale.x, base.scale.x) &&
      close(draftTransform.scale.y, base.scale.y) &&
      close(draftTransform.scale.z, base.scale.z)
    );
  }, [selected, draftTransform, selectedOverride]);

  // 供 gizmo 拖曳回呼比對目前選取（避免在 setState updater 內做副作用）
  const selectedKeyRef = useRef<string | null>(null);
  selectedKeyRef.current = selected?.key ?? null;

  const handleSelect = useCallback((obj: MapObjectInfo | null) => {
    setSelected(obj);
    setDraftTransform(null);
    setSaveError(null);
    if (obj) setRightTab('inspector');
  }, []);

  // 狀態判斷小工具
  const overrideByKey = useMemo(() => {
    const map: Record<string, MapOverride> = {};
    for (const o of overrides) if (o.isActive) map[o.targetBuildingKey] = o;
    return map;
  }, [overrides]);

  const visibleObjects = useMemo(
    () =>
      showRemoved
        ? objects
        : objects.filter((o) => overrideByKey[o.key]?.action !== 'delete'),
    [objects, overrideByKey, showRemoved]
  );

  const handleTransformChange = useCallback((key: string, tr: Transform) => {
    if (selectedKeyRef.current === key) setDraftTransform(tr);
  }, []);

  const handleObjectsChange = useCallback((objs: MapObjectInfo[]) => {
    setObjects(objs);
  }, []);

  // 新增/替換的實例首次自動擺放後，把 transform 寫回 override（持久化位置/縮放）
  async function handleInstancePlaced(key: string, transform: Transform) {
    const ov = overrides.find(
      (o) => o.targetBuildingKey === key && o.isActive
    );
    if (!ov || ov.transform) return;
    try {
      await mapOverrideService.update(ov.id, { transform });
      await loadOverrides(chunkId);
    } catch (err) {
      console.error('儲存自動擺放失敗:', err);
    }
  }

  function selectFromList(obj: MapObjectInfo) {
    setSelected(obj);
    setDraftTransform(null);
    setSaveError(null);
  }

  function focusFromList(obj: MapObjectInfo) {
    setSelected(obj);
    setDraftTransform(null);
    setSaveError(null);
    setFocusNonce((n) => n + 1);
    setRightTab('inspector');
  }

  function changeChunk(id: string) {
    setChunkId(id);
    setSelected(null);
    setDraftTransform(null);
    setSaveError(null);
    setObjects([]);
  }

  async function handleSave() {
    if (!selected) return;
    const transform =
      draftTransform ?? {
        position: selected.position,
        rotation: selected.rotation,
        scale: selected.scale,
      };
    // 替換/新增的物件保留其 action，僅更新 transform
    const action =
      selectedOverride?.action === 'replace' ||
      selectedOverride?.action === 'add'
        ? selectedOverride.action
        : 'transform';
    try {
      setSaving(true);
      setSaveError(null);
      if (selectedOverride) {
        await mapOverrideService.update(selectedOverride.id, {
          action,
          transform,
          isActive: true,
        });
      } else {
        await mapOverrideService.create({
          mapName,
          chunkId,
          targetBuildingKey: selected.key,
          action: 'transform',
          transform,
        });
      }
      await loadOverrides(chunkId);
      setDraftTransform(null);
    } catch (err) {
      console.error('儲存地圖編輯失敗:', err);
      setSaveError(t('map.editor.saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  // 替換選中物件 / 更換資產
  async function handlePickAsset(assetId: string) {
    setPicker(null);
    if (picker === 'add') {
      await handleAdd(assetId);
      return;
    }
    if (!selected) return;
    const transform = draftTransform ??
      selectedOverride?.transform ?? {
        position: selected.position,
        rotation: selected.rotation,
        scale: selected.scale,
      };
    // 既有 add 物件換資產時保留 add；否則為 replace
    const action = selectedOverride?.action === 'add' ? 'add' : 'replace';
    try {
      setSaving(true);
      setSaveError(null);
      if (selectedOverride) {
        await mapOverrideService.update(selectedOverride.id, {
          action,
          assetId,
          transform,
          isActive: true,
        });
      } else {
        await mapOverrideService.create({
          mapName,
          chunkId,
          targetBuildingKey: selected.key,
          action: 'replace',
          assetId,
          transform,
        });
      }
      await loadOverrides(chunkId);
      setDraftTransform(null);
    } catch (err) {
      console.error('替換建築失敗:', err);
      setSaveError(t('map.editor.saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  // 從資產庫新增一棟建築到地圖
  async function handleAdd(assetId: string) {
    try {
      setSaving(true);
      setSaveError(null);
      const key = `add:${crypto.randomUUID()}`;
      await mapOverrideService.create({
        mapName,
        chunkId,
        targetBuildingKey: key,
        action: 'add',
        assetId,
      });
      await loadOverrides(chunkId);
    } catch (err) {
      console.error('新增建築失敗:', err);
      setSaveError(t('map.editor.saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove() {
    if (!selected) return;
    try {
      setSaving(true);
      setSaveError(null);
      if (selectedOverride) {
        await mapOverrideService.update(selectedOverride.id, {
          action: 'delete',
          transform: undefined,
          isActive: true,
        });
      } else {
        await mapOverrideService.create({
          mapName,
          chunkId,
          targetBuildingKey: selected.key,
          action: 'delete',
        });
      }
      await loadOverrides(chunkId);
      setDraftTransform(null);
    } catch (err) {
      console.error('移走建築失敗:', err);
      setSaveError(t('map.editor.saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    if (!selected || !selectedOverride) return;
    try {
      setSaving(true);
      setSaveError(null);
      await mapOverrideService.delete(selectedOverride.id);
      await loadOverrides(chunkId);
      setDraftTransform(null);
    } catch (err) {
      console.error('還原建築失敗:', err);
      setSaveError(t('map.editor.saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="container-fixed">
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[var(--foreground)] mb-2 flex items-center gap-2">
            <MapIcon className="w-7 h-7" />
            {t('map.editor.title')}
          </h1>
          <p className="text-[var(--muted-foreground)]">
            {t('map.editor.subtitle')}
          </p>
        </div>

        {manifest && (
          <div className="flex items-end gap-3">
            <div>
              <label className="label">{t('map.editor.selectChunk')}</label>
              <select
                className="input min-w-[200px]"
                value={chunkId}
                onChange={(e) => changeChunk(e.target.value)}
              >
                {manifest.chunks.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.id}
                    {c.description ? ` — ${c.description}` : ''}
                  </option>
                ))}
              </select>
            </div>
            <button
              className="btn btn-primary"
              onClick={() => setPicker('add')}
              disabled={saving}
            >
              <Plus className="w-4 h-4 mr-2" />
              {t('map.editor.addBuilding')}
            </button>
          </div>
        )}
      </div>

      {/* Manifest 載入失敗 */}
      {manifestError && (
        <div className="card bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 mb-6">
          <div className="card-body">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-red-900 dark:text-red-100 mb-1">
                  {manifestError}
                </h3>
                <p className="text-sm text-red-700 dark:text-red-300 mb-3">
                  {t('map.editor.checkSource')}
                </p>
                <button onClick={loadManifest} className="btn btn-sm btn-outline">
                  {t('error.reload')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {manifestLoading ? (
        <div className="card">
          <div className="card-body flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <Loader2 className="w-10 h-10 animate-spin mx-auto mb-4 text-[var(--muted-foreground)]" />
              <p className="text-[var(--muted-foreground)]">
                {t('map.editor.loadingManifest')}
              </p>
            </div>
          </div>
        </div>
      ) : (
        manifest && (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
            {/* 3D 檢視器 */}
            <div className="card overflow-hidden">
              <div className="relative h-[70vh] min-h-[420px] bg-[#11161d]">
                {chunkFile && (
                  <MapEditor3D
                    chunkId={chunkId}
                    chunkFile={chunkFile}
                    selectedKey={selected?.key ?? null}
                    gizmoMode={gizmoMode}
                    overrides={overrides}
                    assets={assets}
                    focusNonce={focusNonce}
                    onSelect={handleSelect}
                    onTransformChange={handleTransformChange}
                    onInstancePlaced={handleInstancePlaced}
                    onObjectsChange={handleObjectsChange}
                    onLoadingChange={setViewerLoading}
                    onError={setViewerError}
                  />
                )}

                {viewerLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                    <div className="text-center text-white">
                      <Loader2 className="w-10 h-10 animate-spin mx-auto mb-3" />
                      <p>{t('map.editor.loadingMap')}</p>
                    </div>
                  </div>
                )}

                {viewerError && !viewerLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/60 p-6">
                    <div className="text-center text-white max-w-md">
                      <AlertCircle className="w-10 h-10 mx-auto mb-3 text-red-400" />
                      <p className="font-semibold mb-1">
                        {t('map.editor.mapError')}
                      </p>
                      <p className="text-sm text-gray-300">
                        {t('map.editor.checkSource')}
                      </p>
                    </div>
                  </div>
                )}

                <div className="absolute bottom-3 left-3 right-3 flex items-center gap-2 text-xs text-gray-300/90 bg-black/40 rounded px-3 py-2 pointer-events-none">
                  <Info className="w-4 h-4 flex-shrink-0" />
                  <span>{t('map.editor.help')}</span>
                </div>
              </div>
            </div>

            {/* 右側面板：Tab（選取 / 物件列表） */}
            <div className="flex flex-col h-[70vh] min-h-[420px]">
              <div className="flex gap-2 mb-3 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setRightTab('inspector')}
                  className={`flex-1 px-3 py-2 text-sm font-medium rounded-t border-b-2 ${
                    rightTab === 'inspector'
                      ? 'border-blue-500 text-[var(--foreground)]'
                      : 'border-transparent text-[var(--muted-foreground)]'
                  }`}
                >
                  {t('map.tab.inspector')}
                </button>
                <button
                  type="button"
                  onClick={() => setRightTab('list')}
                  className={`flex-1 px-3 py-2 text-sm font-medium rounded-t border-b-2 ${
                    rightTab === 'list'
                      ? 'border-blue-500 text-[var(--foreground)]'
                      : 'border-transparent text-[var(--muted-foreground)]'
                  }`}
                >
                  {t('map.tab.list')} ({visibleObjects.length})
                </button>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto">
                {rightTab === 'inspector' ? (
                  <BuildingInspector
                    object={selected}
                    gizmoMode={gizmoMode}
                    onGizmoModeChange={setGizmoMode}
                    draftTransform={draftTransform}
                    appliedTransform={selectedOverride?.transform ?? null}
                    overrideAction={selectedOverride?.action ?? null}
                    dirty={dirty}
                    saving={saving}
                    error={saveError}
                    onSave={handleSave}
                    onRemove={handleRemove}
                    onReset={handleReset}
                    onRequestReplace={() => setPicker('replace')}
                  />
                ) : (
                  <div className="card">
                    <div className="card-body">
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2">
                          <ListTree className="w-5 h-5 text-[var(--muted-foreground)]" />
                          <h2 className="text-base font-semibold text-[var(--foreground)]">
                            {t('map.list.title')}
                          </h2>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowRemoved((v) => !v)}
                          className="btn btn-sm btn-light"
                          title={showRemoved ? t('map.list.hideRemoved') : t('map.list.showRemoved')}
                        >
                          {showRemoved ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>

                      {missingInstances.length > 0 && (
                        <div className="card bg-amber-50 dark:bg-amber-900/20 mb-3">
                          <div className="card-body py-2 text-sm text-amber-700 dark:text-amber-300">
                            <div className="flex items-start gap-2">
                              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                              <div>
                                <p className="font-medium">{t('map.list.loadFailed')}</p>
                                <ul className="list-disc list-inside">
                                  {missingInstances.map((o) => (
                                    <li key={o.id}>
                                      {(o.assetId && assetsById[o.assetId]?.name) ||
                                        o.targetBuildingKey}{' '}
                                      ({t(`map.status.${o.action === 'add' ? 'added' : 'replaced'}`)})
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {visibleObjects.length === 0 ? (
                        <p className="text-sm text-[var(--muted-foreground)] py-4 text-center">
                          {t('map.list.empty')}
                        </p>
                      ) : (
                        <div className="divide-y divide-[var(--border)]">
                          {visibleObjects.map((o) => {
                            const ov = overrideByKey[o.key];
                            const status = ov
                              ? ov.action === 'delete'
                                ? 'removed'
                                : ov.action === 'add'
                                ? 'added'
                                : ov.action === 'replace'
                                ? 'replaced'
                                : 'modified'
                              : 'original';
                            const displayName =
                              ov && (ov.action === 'add' || ov.action === 'replace') && ov.assetId
                                ? assetsById[ov.assetId]?.name ?? o.meshName
                                : o.meshName;
                            return (
                              <button
                                key={o.key}
                                type="button"
                                onClick={() => selectFromList(o)}
                                onDoubleClick={() => focusFromList(o)}
                                title={t('map.list.dblClickHint')}
                                className={`w-full flex items-center justify-between gap-3 px-2 py-2 text-left hover:bg-[var(--sidebar-hover)] ${
                                  selected?.key === o.key
                                    ? 'bg-[var(--sidebar-hover)] ring-1 ring-blue-500'
                                    : ''
                                }`}
                              >
                                <span className="flex items-center gap-2 min-w-0">
                                  <span className="text-sm text-[var(--foreground)] truncate">
                                    {displayName}
                                  </span>
                                  <span className="badge badge-gray text-xs flex-shrink-0">
                                    {t(`map.objectType.${o.type}`)}
                                  </span>
                                </span>
                                <span className="text-xs text-[var(--muted-foreground)] flex-shrink-0">
                                  {t(`map.status.${status}`)}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      )}

      {picker && (
        <AssetPicker
          assets={assets}
          title={
            picker === 'add'
              ? t('map.editor.addBuilding')
              : t('map.editor.replace')
          }
          onPick={handlePickAsset}
          onClose={() => setPicker(null)}
        />
      )}
    </div>
  );
}
