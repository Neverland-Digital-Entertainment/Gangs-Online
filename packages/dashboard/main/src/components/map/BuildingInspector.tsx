'use client';

/**
 * BuildingInspector — 選中地圖物件的資訊與編輯面板（Map Editor P1 + P2）
 *
 * P2：操作模式切換（移動/旋轉/縮放）、即時 transform、儲存/移走/還原。
 */

import { useState } from 'react';
import {
  Building2,
  Info,
  Move,
  RotateCw,
  Maximize2,
  Save,
  Trash2,
  Undo2,
  Loader2,
  AlertCircle,
  Replace,
} from 'lucide-react';
import { useI18n } from '@/contexts/i18n-context';
import type {
  GizmoMode,
  MapObjectInfo,
  OverrideAction,
  Transform,
} from '@/types/map';

interface BuildingInspectorProps {
  object: MapObjectInfo | null;
  gizmoMode: GizmoMode;
  onGizmoModeChange: (mode: GizmoMode) => void;
  draftTransform: Transform | null;
  appliedTransform: Transform | null;
  overrideAction: OverrideAction | null;
  dirty: boolean;
  saving: boolean;
  error: string | null;
  onSave: () => void;
  onRemove: () => void;
  onReset: () => void;
  onRequestReplace: () => void;
}

function vec(v: { x: number; y: number; z: number }, digits = 2): string {
  return `${v.x.toFixed(digits)}, ${v.y.toFixed(digits)}, ${v.z.toFixed(digits)}`;
}

export default function BuildingInspector({
  object,
  gizmoMode,
  onGizmoModeChange,
  draftTransform,
  appliedTransform,
  overrideAction,
  dirty,
  saving,
  error,
  onSave,
  onRemove,
  onReset,
  onRequestReplace,
}: BuildingInspectorProps) {
  const { t } = useI18n();
  const [confirmRemove, setConfirmRemove] = useState(false);

  if (!object) {
    return (
      <div className="card h-full">
        <div className="card-body flex flex-col items-center justify-center text-center h-full py-12">
          <Info className="w-10 h-10 text-gray-400 mb-3" />
          <p className="font-medium text-[var(--foreground)] mb-1">
            {t('map.editor.noObjectSelected')}
          </p>
          <p className="text-sm text-[var(--muted-foreground)]">
            {t('map.editor.noObjectHint')}
          </p>
        </div>
      </div>
    );
  }

  const removed = overrideAction === 'delete';
  const isReplace = overrideAction === 'replace';
  const isAdd = overrideAction === 'add';
  const isInstance = isReplace || isAdd;

  const status: 'original' | 'modified' | 'removed' | 'replaced' | 'added' =
    removed
      ? 'removed'
      : isAdd
      ? 'added'
      : isReplace
      ? 'replaced'
      : overrideAction === 'transform'
      ? 'modified'
      : 'original';

  const statusClass =
    status === 'removed'
      ? 'bg-red-500 text-white'
      : status === 'added'
      ? 'bg-blue-500 text-white'
      : status === 'replaced'
      ? 'bg-purple-500 text-white'
      : status === 'modified'
      ? 'bg-amber-500 text-white'
      : 'bg-gray-500 text-white';

  const current = draftTransform ??
    appliedTransform ?? {
      position: object.position,
      rotation: object.rotation,
      scale: object.scale,
    };

  const modes: { mode: GizmoMode; icon: typeof Move; label: string }[] = [
    { mode: 'move', icon: Move, label: t('map.editor.gizmo.move') },
    { mode: 'rotate', icon: RotateCw, label: t('map.editor.gizmo.rotate') },
    { mode: 'scale', icon: Maximize2, label: t('map.editor.gizmo.scale') },
  ];

  return (
    <div className="card h-full">
      <div className="card-body space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Building2 className="w-5 h-5 text-blue-500 flex-shrink-0" />
            <h2 className="text-lg font-semibold text-[var(--foreground)] truncate">
              {object.meshName}
            </h2>
          </div>
          <span
            className={`px-2 py-1 text-xs font-medium rounded flex-shrink-0 ${statusClass}`}
          >
            {t(`map.status.${status}`)}
          </span>
        </div>

        {/* 基本資訊 */}
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <div>
            <dt className="text-xs text-[var(--muted-foreground)]">
              {t('map.inspector.type')}
            </dt>
            <dd className="text-[var(--foreground)]">
              {t(`map.objectType.${object.type}`)}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-xs text-[var(--muted-foreground)]">
              {t('map.inspector.chunk')}
            </dt>
            <dd className="text-[var(--foreground)] truncate">{object.chunkId}</dd>
          </div>
        </dl>

        {removed ? (
          <div className="card bg-red-50 dark:bg-red-900/20">
            <div className="card-body text-sm text-red-700 dark:text-red-300">
              {t('map.editor.removedHint')}
            </div>
          </div>
        ) : (
          <>
            {/* 操作模式 */}
            <div>
              <p className="label">{t('map.editor.gizmoMode')}</p>
              <div className="grid grid-cols-3 gap-2">
                {modes.map(({ mode, icon: Icon, label }) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => onGizmoModeChange(mode)}
                    className={`btn btn-sm ${
                      gizmoMode === mode ? 'btn-primary' : 'btn-outline'
                    }`}
                  >
                    <Icon className="w-4 h-4 mr-1" />
                    {label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-[var(--muted-foreground)] mt-2">
                {t('map.editor.dragHint')}
              </p>
            </div>

            {/* 即時 transform */}
            <dl className="space-y-3">
              <div>
                <dt className="text-xs text-[var(--muted-foreground)] mb-0.5">
                  {t('map.inspector.position')}
                </dt>
                <dd className="text-sm font-mono break-all text-[var(--foreground)]">
                  {vec(current.position)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--muted-foreground)] mb-0.5">
                  {t('map.inspector.rotation')}
                </dt>
                <dd className="text-sm font-mono break-all text-[var(--foreground)]">
                  {vec(current.rotation, 3)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--muted-foreground)] mb-0.5">
                  {t('map.inspector.scale')}
                </dt>
                <dd className="text-sm font-mono break-all text-[var(--foreground)]">
                  {vec(current.scale, 3)}
                </dd>
              </div>
            </dl>
          </>
        )}

        {dirty && !removed && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            {t('map.editor.unsaved')}
          </p>
        )}

        {error && (
          <div className="flex items-start gap-2 text-sm text-red-600 dark:text-red-400">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* 動作 */}
        <div className="flex flex-col gap-2 pt-1">
          {!removed && (
            <button
              type="button"
              onClick={onSave}
              disabled={saving || !dirty}
              className="btn btn-primary w-full"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              {saving ? t('map.editor.saving') : t('map.editor.save')}
            </button>
          )}

          {/* 替換 / 更換資產 */}
          {!removed && (
            <button
              type="button"
              onClick={onRequestReplace}
              disabled={saving}
              className="btn btn-outline w-full"
            >
              <Replace className="w-4 h-4 mr-2" />
              {isInstance
                ? t('map.editor.changeAsset')
                : t('map.editor.replace')}
            </button>
          )}

          {/* 還原 / 復原 */}
          {(overrideAction === 'transform' || isReplace || removed) && (
            <button
              type="button"
              onClick={onReset}
              disabled={saving}
              className="btn btn-outline w-full"
            >
              <Undo2 className="w-4 h-4 mr-2" />
              {removed ? t('map.editor.restore') : t('map.editor.reset')}
            </button>
          )}

          {/* 新增的建築：直接刪除 */}
          {isAdd && (
            <button
              type="button"
              onClick={onReset}
              disabled={saving}
              className="btn btn-light w-full text-red-500"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              {t('map.editor.deleteBuilding')}
            </button>
          )}

          {/* 既有建築：移走 */}
          {!removed &&
            !isInstance &&
            (confirmRemove ? (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setConfirmRemove(false);
                    onRemove();
                  }}
                  disabled={saving}
                  className="btn btn-danger flex-1"
                >
                  {t('map.editor.removeConfirm')}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmRemove(false)}
                  className="btn btn-light flex-1"
                >
                  {t('common.cancel')}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmRemove(true)}
                disabled={saving}
                className="btn btn-light w-full text-red-500"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                {t('map.editor.remove')}
              </button>
            ))}
        </div>
      </div>
    </div>
  );
}
