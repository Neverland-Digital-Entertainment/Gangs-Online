'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Building2,
  Upload,
  Plus,
  Trash2,
  Edit,
  Loader2,
  AlertCircle,
  X,
  ImageOff,
} from 'lucide-react';
import { useI18n } from '@/contexts/i18n-context';
import { buildingAssetService } from '@/lib/map/asset-service';
import { generateGlbThumbnail } from '@/lib/map/thumbnail';
import type { BuildingAsset, BuildingAssetInput } from '@/types/map';

function formatSize(bytes?: number): string {
  if (!bytes) return '-';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function parseTags(raw: string): string[] {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export default function BuildingAssetsPage() {
  const { t } = useI18n();
  const [assets, setAssets] = useState<BuildingAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 上載表單
  const [showUpload, setShowUpload] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [defaultScale, setDefaultScale] = useState('1');
  const [tags, setTags] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 編輯 / 刪除
  const [editing, setEditing] = useState<BuildingAsset | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    loadAssets();
  }, []);

  async function loadAssets() {
    try {
      setLoading(true);
      setError(null);
      setAssets(await buildingAssetService.getAll());
    } catch (err) {
      console.error('載入建築資產失敗:', err);
      setError(t('map.assets.loadFailed'));
    } finally {
      setLoading(false);
    }
  }

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setUploadError(null);
    if (f && !f.name.toLowerCase().endsWith('.glb')) {
      setUploadError(t('map.assets.invalidFile'));
      setFile(null);
      return;
    }
    setFile(f);
    if (f && !name) setName(f.name.replace(/\.glb$/i, ''));
  }

  function resetUploadForm() {
    setFile(null);
    setName('');
    setCategory('');
    setDefaultScale('1');
    setTags('');
    setUploadError(null);
    setUploadStatus('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleUpload() {
    if (!file) {
      setUploadError(t('map.assets.invalidFile'));
      return;
    }
    try {
      setUploading(true);
      setUploadError(null);

      // 1) 先上傳 GLB 並建立資產（成功後資產即可用）
      setUploadStatus(t('map.assets.uploading'));
      const input: BuildingAssetInput = {
        name: name.trim() || file.name.replace(/\.glb$/i, ''),
        category: category.trim() || undefined,
        defaultScale: Number(defaultScale) || 1,
        tags: parseTags(tags),
      };
      const id = await buildingAssetService.create(input, file);

      // 2) 產生並掛上縮圖（非必要，失敗不影響資產）
      try {
        setUploadStatus(t('map.assets.generatingThumb'));
        const thumb = await generateGlbThumbnail(file);
        if (thumb) await buildingAssetService.attachThumbnail(id, thumb);
      } catch (thumbErr) {
        console.error('產生/上傳縮圖失敗（資產已建立）:', thumbErr);
      }

      resetUploadForm();
      setShowUpload(false);
      await loadAssets();
    } catch (err) {
      console.error('上載建築資產失敗:', err);
      const detail = err instanceof Error ? `（${err.message}）` : '';
      setUploadError(`${t('map.assets.uploadFailed')}${detail}`);
    } finally {
      setUploading(false);
      setUploadStatus('');
    }
  }

  async function handleDelete(asset: BuildingAsset) {
    try {
      await buildingAssetService.delete(asset);
      setAssets((prev) => prev.filter((a) => a.id !== asset.id));
      setDeleteConfirm(null);
    } catch (err) {
      console.error('刪除建築資產失敗:', err);
      alert(t('error.deleteFailed'));
    }
  }

  return (
    <div className="container-fixed">
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[var(--foreground)] mb-2 flex items-center gap-2">
            <Building2 className="w-7 h-7" />
            {t('map.assets.title')}
          </h1>
          <p className="text-[var(--muted-foreground)]">
            {t('map.assets.subtitle')}
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => setShowUpload((v) => !v)}
        >
          <Plus className="w-4 h-4 mr-2" />
          {t('map.assets.upload')}
        </button>
      </div>

      {/* Upload panel */}
      {showUpload && (
        <div className="card mb-6">
          <div className="card-body space-y-4">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">
              {t('map.assets.uploadTitle')}
            </h2>

            <div>
              <label className="label">{t('map.assets.file')}</label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".glb"
                onChange={onPickFile}
                className="input"
              />
              {file && (
                <p className="text-xs text-[var(--muted-foreground)] mt-1">
                  {file.name} · {formatSize(file.size)}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">{t('map.assets.name')}</label>
                <input
                  type="text"
                  className="input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div>
                <label className="label">{t('map.assets.category')}</label>
                <input
                  type="text"
                  className="input"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                />
              </div>
              <div>
                <label className="label">{t('map.assets.defaultScale')}</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  className="input"
                  value={defaultScale}
                  onChange={(e) => setDefaultScale(e.target.value)}
                />
              </div>
              <div>
                <label className="label">{t('map.assets.tags')}</label>
                <input
                  type="text"
                  className="input"
                  placeholder={t('map.assets.tagsHint')}
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                />
              </div>
            </div>

            {uploadError && (
              <div className="flex items-start gap-2 text-sm text-red-600 dark:text-red-400">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{uploadError}</span>
              </div>
            )}

            <div className="flex items-center gap-2">
              <button
                className="btn btn-primary"
                onClick={handleUpload}
                disabled={uploading || !file}
              >
                {uploading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4 mr-2" />
                )}
                {uploading ? uploadStatus || t('map.assets.uploading') : t('map.assets.submit')}
              </button>
              <button
                className="btn btn-light"
                onClick={() => {
                  resetUploadForm();
                  setShowUpload(false);
                }}
                disabled={uploading}
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Body */}
      {loading ? (
        <div className="card">
          <div className="card-body flex items-center justify-center min-h-[300px]">
            <Loader2 className="w-10 h-10 animate-spin text-[var(--muted-foreground)]" />
          </div>
        </div>
      ) : error ? (
        <div className="card bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
          <div className="card-body">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-red-700 dark:text-red-300 mb-3">
                  {error}
                </p>
                <button onClick={loadAssets} className="btn btn-sm btn-outline">
                  {t('error.reload')}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : assets.length === 0 ? (
        <div className="card">
          <div className="card-body text-center py-12">
            <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-[var(--muted-foreground)] mb-4">
              {t('map.assets.empty')}
            </p>
            <button className="btn btn-primary" onClick={() => setShowUpload(true)}>
              <Plus className="w-4 h-4 mr-2" />
              {t('map.assets.uploadFirst')}
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {assets.map((asset) => (
            <div key={asset.id} className="card overflow-hidden">
              <div className="aspect-square bg-[#11161d] flex items-center justify-center">
                {asset.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={asset.thumbnailUrl}
                    alt={asset.name}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <ImageOff className="w-10 h-10 text-gray-600" />
                )}
              </div>
              <div className="card-body p-3">
                <h3 className="font-semibold text-[var(--foreground)] truncate">
                  {asset.name}
                </h3>
                <div className="flex flex-wrap gap-2 mt-1 text-xs text-[var(--muted-foreground)]">
                  {asset.category && (
                    <span className="badge badge-gray">{asset.category}</span>
                  )}
                  <span>{formatSize(asset.fileSize)}</span>
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <button
                    className="btn btn-sm btn-light flex-1"
                    onClick={() => setEditing(asset)}
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  {deleteConfirm === asset.id ? (
                    <>
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={() => handleDelete(asset)}
                      >
                        {t('map.assets.deleteConfirm')}
                      </button>
                      <button
                        className="btn btn-sm btn-light"
                        onClick={() => setDeleteConfirm(null)}
                      >
                        {t('common.cancel')}
                      </button>
                    </>
                  ) : (
                    <button
                      className="btn btn-sm btn-light text-red-500"
                      onClick={() => setDeleteConfirm(asset.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit modal */}
      {editing && (
        <EditAssetModal
          asset={editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await loadAssets();
          }}
        />
      )}
    </div>
  );
}

function EditAssetModal({
  asset,
  onClose,
  onSaved,
}: {
  asset: BuildingAsset;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const [name, setName] = useState(asset.name);
  const [category, setCategory] = useState(asset.category ?? '');
  const [defaultScale, setDefaultScale] = useState(
    String(asset.defaultScale ?? 1)
  );
  const [tags, setTags] = useState((asset.tags ?? []).join(', '));
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    try {
      setSaving(true);
      await buildingAssetService.update(asset.id, {
        name: name.trim() || asset.name,
        category: category.trim() || undefined,
        defaultScale: Number(defaultScale) || 1,
        tags: parseTags(tags),
      });
      onSaved();
    } catch (err) {
      console.error('更新建築資產失敗:', err);
      alert(t('error.saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="card w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="card-body space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">
              {t('map.assets.edit')}
            </h2>
            <button className="btn btn-sm btn-light" onClick={onClose}>
              <X className="w-4 h-4" />
            </button>
          </div>

          <div>
            <label className="label">{t('map.assets.name')}</label>
            <input
              type="text"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label className="label">{t('map.assets.category')}</label>
            <input
              type="text"
              className="input"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />
          </div>
          <div>
            <label className="label">{t('map.assets.defaultScale')}</label>
            <input
              type="number"
              step="0.1"
              min="0"
              className="input"
              value={defaultScale}
              onChange={(e) => setDefaultScale(e.target.value)}
            />
          </div>
          <div>
            <label className="label">{t('map.assets.tags')}</label>
            <input
              type="text"
              className="input"
              placeholder={t('map.assets.tagsHint')}
              value={tags}
              onChange={(e) => setTags(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2 pt-2">
            <button
              className="btn btn-primary flex-1"
              onClick={handleSave}
              disabled={saving}
            >
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {t('map.assets.save')}
            </button>
            <button className="btn btn-light" onClick={onClose} disabled={saving}>
              {t('common.cancel')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
