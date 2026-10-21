'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, PackageOpen } from 'lucide-react';
import { useI18n } from '@/contexts/i18n-context';
import { useAuth } from '@/contexts/auth-context';
import {
  importBuildingPack,
  listBuiltinPacks,
  loadBuiltinPack,
  parseBuildingPack,
  type BuiltinPackInfo,
  type PackImportResult,
  type ParsedBuildingPack,
} from '@/lib/map/building-pack';
import { mapOverrideService } from '@/lib/map/override-service';

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * 匯入大廈包：一撳載入隨後台發佈嘅內建大廈包（tools/buildings/out），
 * 或者自己揀 manifest.json 同全部 GLB，一次過建立資產並擺放到地圖（map_overrides `add`）。
 */
export default function BuildingPackImport({
  onClose,
  onImported,
}: {
  onClose: () => void;
  onImported: () => void;
}) {
  const { t } = useI18n();
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pack, setPack] = useState<ParsedBuildingPack | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [publish, setPublish] = useState(true);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number; label: string } | null>(null);
  const [result, setResult] = useState<PackImportResult | null>(null);
  const [publishNote, setPublishNote] = useState<string | null>(null);
  const [builtin, setBuiltin] = useState<BuiltinPackInfo[]>([]);
  const [loadingDir, setLoadingDir] = useState<string | null>(null);

  useEffect(() => {
    listBuiltinPacks().then(setBuiltin).catch(() => setBuiltin([]));
  }, []);

  async function pickBuiltin(dir: string) {
    setPack(null);
    setResult(null);
    setParseError(null);
    setPublishNote(null);
    try {
      setLoadingDir(dir);
      setPack(await loadBuiltinPack(dir, (done, total, label) => setProgress({ done, total, label })));
    } catch (err) {
      setParseError(`${t('map.pack.invalid')}（${err instanceof Error ? err.message : String(err)}）`);
    } finally {
      setLoadingDir(null);
      setProgress(null);
    }
  }

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    setPack(null);
    setResult(null);
    setParseError(null);
    setPublishNote(null);
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    try {
      setPack(await parseBuildingPack(files));
    } catch (err) {
      setParseError(`${t('map.pack.invalid')}（${err instanceof Error ? err.message : String(err)}）`);
    }
  }

  async function run() {
    if (!pack) return;
    try {
      setRunning(true);
      setResult(null);
      setPublishNote(null);
      const res = await importBuildingPack(pack, (done, total, label) =>
        setProgress({ done, total, label })
      );
      setResult(res);
      if (publish && res.failed.length === 0) {
        const snap = await mapOverrideService.publishSnapshot(pack.manifest.mapName, user?.email ?? undefined);
        setPublishNote(t('map.pack.published').replace('{count}', String(snap.itemCount)));
      }
      onImported();
    } catch (err) {
      console.error('匯入大廈包失敗:', err);
      setParseError(`${t('map.pack.failed')}（${err instanceof Error ? err.message : String(err)}）`);
    } finally {
      setRunning(false);
      setProgress(null);
    }
  }

  return (
    <div className="card mb-6">
      <div className="card-body space-y-4">
        <h2 className="text-lg font-semibold text-[var(--foreground)] flex items-center gap-2">
          <PackageOpen className="w-5 h-5" />
          {t('map.pack.title')}
        </h2>
        <p className="text-sm text-[var(--muted-foreground)]">{t('map.pack.hint')}</p>

        {builtin.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-medium text-[var(--foreground)]">{t('map.pack.builtin')}</div>
            {builtin.map((b) => (
              <div key={b.dir} className="flex items-center gap-3 text-sm">
                <button
                  className="btn btn-sm btn-primary"
                  onClick={() => pickBuiltin(b.dir)}
                  disabled={running || loadingDir !== null}
                >
                  {loadingDir === b.dir ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
                  {loadingDir === b.dir && progress
                    ? `${progress.done}/${progress.total}`
                    : t('map.pack.load')}
                </button>
                <span className="text-[var(--foreground)]">
                  {b.packId} · {b.chunkId} · {t('map.pack.count').replace('{count}', String(b.buildings))}
                </span>
              </div>
            ))}
            <div className="text-xs text-[var(--muted-foreground)]">{t('map.pack.orPick')}</div>
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".glb,.json"
          onChange={onPick}
          className="input"
          disabled={running}
        />

        {pack && (
          <div className="text-sm space-y-1">
            <p className="text-[var(--foreground)]">
              <span className="font-medium">{pack.manifest.packId}</span> · {pack.manifest.chunkId} ·{' '}
              {t('map.pack.count').replace('{count}', String(pack.manifest.buildings.length))} ·{' '}
              {formatSize(pack.totalBytes)}
            </p>
            {pack.missing.length > 0 && (
              <p className="text-amber-600 dark:text-amber-400">
                {t('map.pack.missing')}: {pack.missing.join(', ')}
              </p>
            )}
          </div>
        )}

        <label className="flex items-center gap-2 text-sm text-[var(--foreground)]">
          <input
            type="checkbox"
            checked={publish}
            onChange={(e) => setPublish(e.target.checked)}
            disabled={running}
          />
          {t('map.pack.publishAfter')}
        </label>

        {parseError && (
          <div className="flex items-start gap-2 text-sm text-red-600 dark:text-red-400">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{parseError}</span>
          </div>
        )}

        {result && (
          <div className="text-sm space-y-1">
            <p className="flex items-center gap-2 text-[var(--foreground)]">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
              {t('map.pack.result')
                .replace('{created}', String(result.created))
                .replace('{updated}', String(result.updated))
                .replace('{moved}', String(result.moved))
                .replace('{unchanged}', String(result.unchanged))}
            </p>
            {result.failed.map((f) => (
              <p key={f.id} className="text-red-600 dark:text-red-400">
                {f.id}: {f.error}
              </p>
            ))}
            {publishNote && <p className="text-[var(--muted-foreground)]">{publishNote}</p>}
          </div>
        )}

        <div className="flex items-center gap-2">
          <button
            className="btn btn-primary"
            onClick={run}
            disabled={running || !pack || pack.missing.length === pack.manifest.buildings.length}
          >
            {running ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <PackageOpen className="w-4 h-4 mr-2" />}
            {running && progress
              ? `${t('map.pack.importing')} ${progress.done}/${progress.total} ${progress.label}`
              : t('map.pack.import')}
          </button>
          <button className="btn btn-light" onClick={onClose} disabled={running}>
            {t('common.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}
