'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { AlertCircle, Info, Loader2, Map as MapIcon } from 'lucide-react';
import { useI18n } from '@/contexts/i18n-context';
import { loadMapManifest } from '@/lib/map/map-loader';
import { mapOverrideService } from '@/lib/map/override-service';
import type {
  GizmoMode,
  MapManifest,
  MapObjectInfo,
  MapOverride,
  Transform,
} from '@/types/map';
import BuildingInspector from '@/components/map/BuildingInspector';

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

  const [overrides, setOverrides] = useState<MapOverride[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [viewerLoading, setViewerLoading] = useState(false);
  const [viewerError, setViewerError] = useState<string | null>(null);

  useEffect(() => {
    loadManifest();
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
  }, []);

  const handleTransformChange = useCallback((key: string, tr: Transform) => {
    if (selectedKeyRef.current === key) setDraftTransform(tr);
  }, []);

  function changeChunk(id: string) {
    setChunkId(id);
    setSelected(null);
    setDraftTransform(null);
    setSaveError(null);
  }

  async function handleSave() {
    if (!selected) return;
    const transform =
      draftTransform ?? {
        position: selected.position,
        rotation: selected.rotation,
        scale: selected.scale,
      };
    try {
      setSaving(true);
      setSaveError(null);
      if (selectedOverride) {
        await mapOverrideService.update(selectedOverride.id, {
          action: 'transform',
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
          <div>
            <label className="label">{t('map.editor.selectChunk')}</label>
            <select
              className="input min-w-[220px]"
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
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
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
                    onSelect={handleSelect}
                    onTransformChange={handleTransformChange}
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

            {/* Inspector */}
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
            />
          </div>
        )
      )}
    </div>
  );
}
