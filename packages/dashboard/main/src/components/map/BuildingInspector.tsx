'use client';

/**
 * BuildingInspector — 選中地圖物件的資訊與編輯面板（Map Editor P1/P2/P4/P6）
 *
 * P6：transform 數值可手動輸入；override 可啟用/停用。
 */

import { useEffect, useRef, useState } from 'react';
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
  Power,
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
  readOnly?: boolean;
  gizmoMode: GizmoMode;
  onGizmoModeChange: (mode: GizmoMode) => void;
  draftTransform: Transform | null;
  appliedTransform: Transform | null;
  overrideAction: OverrideAction | null;
  overrideActive: boolean;
  hasOverride: boolean;
  canToggleActive: boolean;
  dirty: boolean;
  saving: boolean;
  error: string | null;
  onSave: () => void;
  onRemove: () => void;
  onReset: () => void;
  onRequestReplace: () => void;
  onTransformInput: (t: Transform) => void;
  onToggleActive: () => void;
}

const RAD2DEG = 180 / Math.PI;
const DEG2RAD = Math.PI / 180;

function fmt(n: number): string {
  return (Math.round(n * 1000) / 1000).toString();
}

/** 單一數值輸入：保留輸入字串，外部值變動且未聚焦時才同步 */
function NumField({
  value,
  step,
  onCommit,
  disabled,
}: {
  value: number;
  step: number;
  onCommit: (n: number) => void;
  disabled?: boolean;
}) {
  const [str, setStr] = useState(fmt(value));
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setStr(fmt(value));
  }, [value]);
  return (
    <input
      type="number"
      step={step}
      value={str}
      disabled={disabled}
      onFocus={() => (focused.current = true)}
      onBlur={() => {
        focused.current = false;
        setStr(fmt(value));
      }}
      onChange={(e) => {
        setStr(e.target.value);
        const n = parseFloat(e.target.value);
        if (Number.isFinite(n)) onCommit(n);
      }}
      className="input input-sm font-mono text-sm w-full"
    />
  );
}

function Vec3Field({
  label,
  v,
  step,
  onChange,
  disabled,
}: {
  label: string;
  v: { x: number; y: number; z: number };
  step: number;
  onChange: (axis: 'x' | 'y' | 'z', n: number) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <p className="text-xs text-[var(--muted-foreground)] mb-1">{label}</p>
      <div className="grid grid-cols-3 gap-2">
        <NumField value={v.x} step={step} disabled={disabled} onCommit={(n) => onChange('x', n)} />
        <NumField value={v.y} step={step} disabled={disabled} onCommit={(n) => onChange('y', n)} />
        <NumField value={v.z} step={step} disabled={disabled} onCommit={(n) => onChange('z', n)} />
      </div>
    </div>
  );
}

export default function BuildingInspector({
  object,
  readOnly = false,
  gizmoMode,
  onGizmoModeChange,
  draftTransform,
  appliedTransform,
  overrideAction,
  overrideActive,
  hasOverride,
  canToggleActive,
  dirty,
  saving,
  error,
  onSave,
  onRemove,
  onReset,
  onRequestReplace,
  onTransformInput,
  onToggleActive,
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

  const disabled = hasOverride && !overrideActive;
  const isReplace = overrideAction === 'replace';
  const isAdd = overrideAction === 'add';
  const isInstance = isReplace || isAdd;
  const removed = overrideAction === 'delete' && overrideActive;

  const status: 'original' | 'modified' | 'removed' | 'replaced' | 'added' | 'disabled' =
    disabled
      ? 'disabled'
      : removed
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
      : status === 'disabled'
      ? 'bg-slate-500 text-white'
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

  function commit(next: Transform) {
    onTransformInput(next);
  }

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
            {readOnly && (
              <p className="text-xs text-[var(--muted-foreground)]">
                {t('map.editor.readOnly')}
              </p>
            )}
            {/* 操作模式 */}
            {!readOnly && (
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
            )}

            {/* 可編輯 transform */}
            <div className="space-y-3">
              <Vec3Field
                label={t('map.inspector.position')}
                v={current.position}
                step={1}
                disabled={readOnly}
                onChange={(axis, n) =>
                  commit({ ...current, position: { ...current.position, [axis]: n } })
                }
              />
              <Vec3Field
                label={t('map.inspector.rotationDeg')}
                v={{
                  x: current.rotation.x * RAD2DEG,
                  y: current.rotation.y * RAD2DEG,
                  z: current.rotation.z * RAD2DEG,
                }}
                step={5}
                disabled={readOnly}
                onChange={(axis, deg) =>
                  commit({
                    ...current,
                    rotation: { ...current.rotation, [axis]: deg * DEG2RAD },
                  })
                }
              />
              <Vec3Field
                label={t('map.inspector.scale')}
                v={current.scale}
                step={0.1}
                disabled={readOnly}
                onChange={(axis, n) =>
                  commit({ ...current, scale: { ...current.scale, [axis]: n } })
                }
              />
              <div>
                <p className="text-xs text-[var(--muted-foreground)] mb-0.5">
                  {t('map.inspector.size')}
                </p>
                <p className="text-sm font-mono text-[var(--foreground)]">
                  {fmt(object.boundingSize.x)}, {fmt(object.boundingSize.y)},{' '}
                  {fmt(object.boundingSize.z)}
                </p>
              </div>
            </div>
          </>
        )}

        {dirty && !removed && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            {t('map.editor.unsaved')}
          </p>
        )}
        {disabled && (
          <p className="text-xs text-slate-500">{t('map.editor.disabledHint')}</p>
        )}

        {error && (
          <div className="flex items-start gap-2 text-sm text-red-600 dark:text-red-400">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* 動作 */}
        {!readOnly && (
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

          {!removed && (
            <button
              type="button"
              onClick={onRequestReplace}
              disabled={saving}
              className="btn btn-outline w-full"
            >
              <Replace className="w-4 h-4 mr-2" />
              {isInstance ? t('map.editor.changeAsset') : t('map.editor.replace')}
            </button>
          )}

          {/* 啟用/停用 */}
          {hasOverride && canToggleActive && (
            <button
              type="button"
              onClick={onToggleActive}
              disabled={saving}
              className="btn btn-outline w-full"
            >
              <Power className="w-4 h-4 mr-2" />
              {overrideActive ? t('map.editor.disable') : t('map.editor.enable')}
            </button>
          )}

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
        )}
      </div>
    </div>
  );
}
