'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { AlertCircle, Info, Loader2, Map as MapIcon } from 'lucide-react';
import { useI18n } from '@/contexts/i18n-context';
import { loadMapManifest } from '@/lib/map/map-loader';
import type { MapManifest, MapObjectInfo } from '@/types/map';
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

  const chunkFile = useMemo(
    () => manifest?.chunks.find((c) => c.id === chunkId)?.file ?? '',
    [manifest, chunkId]
  );

  const handleSelect = useCallback((obj: MapObjectInfo | null) => {
    setSelected(obj);
  }, []);
  const handleLoading = useCallback((v: boolean) => setViewerLoading(v), []);
  const handleError = useCallback((m: string | null) => setViewerError(m), []);

  function changeChunk(id: string) {
    setChunkId(id);
    setSelected(null);
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
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
            {/* 3D 檢視器 */}
            <div className="card overflow-hidden">
              <div className="relative h-[70vh] min-h-[420px] bg-[#11161d]">
                {chunkFile && (
                  <MapEditor3D
                    chunkId={chunkId}
                    chunkFile={chunkFile}
                    selectedKey={selected?.key ?? null}
                    onSelect={handleSelect}
                    onLoadingChange={handleLoading}
                    onError={handleError}
                  />
                )}

                {/* 載入中遮罩 */}
                {viewerLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                    <div className="text-center text-white">
                      <Loader2 className="w-10 h-10 animate-spin mx-auto mb-3" />
                      <p>{t('map.editor.loadingMap')}</p>
                    </div>
                  </div>
                )}

                {/* 載入失敗 */}
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

                {/* 操作提示 */}
                <div className="absolute bottom-3 left-3 right-3 flex items-center gap-2 text-xs text-gray-300/90 bg-black/40 rounded px-3 py-2 pointer-events-none">
                  <Info className="w-4 h-4 flex-shrink-0" />
                  <span>{t('map.editor.help')}</span>
                </div>
              </div>
            </div>

            {/* Inspector */}
            <BuildingInspector object={selected} />
          </div>
        )
      )}
    </div>
  );
}
