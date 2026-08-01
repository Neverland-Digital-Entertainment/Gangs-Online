'use client';

/**
 * MapOutliner — Blender 風格的地圖物件樹狀列表
 *
 * 取代原本的平面列表 + 勾選框：
 *   - 點擊 = 單選並設為 active（下方 Inspector 顯示該物件）
 *   - Ctrl / Cmd + 點擊 = 加入或移出選取
 *   - Shift + 點擊 = 由 active 到該行的範圍選取
 *   - 雙擊 = 鏡頭聚焦
 *   - 眼睛 = 顯示 / 隱藏（對應 delete override 或實例的啟用狀態）
 *
 * 樹狀結構：遮擋群組排前（可摺疊，等同 Blender 的 Collection），
 * 其餘物件按類型分桶。
 */

import { useMemo, useState } from 'react';
import {
  Box,
  Building2,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  Folder,
  FolderOpen,
  Layers,
  Mountain,
  Shapes,
} from 'lucide-react';
import { useI18n } from '@/contexts/i18n-context';
import type {
  BuildingAsset,
  MapObjectInfo,
  MapObjectType,
  MapOverride,
} from '@/types/map';

export type SelectMode = 'single' | 'toggle' | 'range';

interface MapOutlinerProps {
  chunkId: string;
  objects: MapObjectInfo[];
  overrideByKey: Record<string, MapOverride>;
  assetsById: Record<string, BuildingAsset>;
  /** 主選取：Inspector 顯示的那一個 */
  activeKey: string | null;
  selectedKeys: Set<string>;
  canEdit: boolean;
  /** 由 outliner 計算好新的選取（它掌握顯示順序，範圍選取要靠它） */
  onSelectionChange: (keys: string[], activeKey: string) => void;
  onFocus: (key: string) => void;
  onToggleVisible: (key: string) => void;
}

type Row =
  | {
      kind: 'branch';
      id: string;
      label: string;
      count: number;
      depth: number;
      icon: 'group' | MapObjectType;
    }
  | {
      kind: 'object';
      id: string;
      obj: MapObjectInfo;
      depth: number;
      /** 可選取物件在扁平序列中的位置，供 Shift 範圍選取 */
      index: number;
    };

const TYPE_ORDER: MapObjectType[] = ['building', 'prop', 'terrain', 'other'];

function TypeIcon({
  icon,
  className,
}: {
  icon: 'group' | MapObjectType;
  className?: string;
}) {
  switch (icon) {
    case 'group':
      return <Folder className={className} />;
    case 'building':
      return <Building2 className={className} />;
    case 'prop':
      return <Box className={className} />;
    case 'terrain':
      return <Mountain className={className} />;
    default:
      return <Shapes className={className} />;
  }
}

export default function MapOutliner({
  chunkId,
  objects,
  overrideByKey,
  assetsById,
  activeKey,
  selectedKeys,
  canEdit,
  onSelectionChange,
  onFocus,
  onToggleVisible,
}: MapOutlinerProps) {
  const { t } = useI18n();
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  function toggleBranch(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    let index = 0;

    const byGroup = new Map<string, MapObjectInfo[]>();
    const byType = new Map<MapObjectType, MapObjectInfo[]>();

    for (const o of objects) {
      const groupId = overrideByKey[o.key]?.groupId;
      if (groupId) {
        if (!byGroup.has(groupId)) byGroup.set(groupId, []);
        byGroup.get(groupId)!.push(o);
      } else {
        if (!byType.has(o.type)) byType.set(o.type, []);
        byType.get(o.type)!.push(o);
      }
    }

    const pushObjects = (list: MapObjectInfo[], depth: number) => {
      for (const obj of list) {
        out.push({ kind: 'object', id: obj.key, obj, depth, index });
        index += 1;
      }
    };

    // 群組排前，等同 Blender 的 Collection
    for (const name of Array.from(byGroup.keys()).sort()) {
      const members = byGroup.get(name)!;
      const id = `group:${name}`;
      out.push({
        kind: 'branch',
        id,
        label: name,
        count: members.length,
        depth: 1,
        icon: 'group',
      });
      if (!collapsed.has(id)) pushObjects(members, 2);
    }

    for (const type of TYPE_ORDER) {
      const list = byType.get(type);
      if (!list || list.length === 0) continue;
      const id = `type:${type}`;
      out.push({
        kind: 'branch',
        id,
        label: t(`map.objectType.${type}`),
        count: list.length,
        depth: 1,
        icon: type,
      });
      if (!collapsed.has(id)) pushObjects(list, 2);
    }

    return out;
  }, [objects, overrideByKey, collapsed, t]);

  const selectableKeys = useMemo(
    () => rows.filter((r): r is Extract<Row, { kind: 'object' }> => r.kind === 'object'),
    [rows]
  );

  function handleRowClick(key: string, e: React.MouseEvent) {
    const mode: SelectMode = e.shiftKey
      ? 'range'
      : e.ctrlKey || e.metaKey
      ? 'toggle'
      : 'single';

    if (mode === 'toggle') {
      const next = new Set(selectedKeys);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      onSelectionChange(Array.from(next), key);
      return;
    }

    if (mode === 'range' && activeKey) {
      const order = selectableKeys.map((r) => r.id);
      const from = order.indexOf(activeKey);
      const to = order.indexOf(key);
      if (from !== -1 && to !== -1) {
        const [lo, hi] = from <= to ? [from, to] : [to, from];
        onSelectionChange(order.slice(lo, hi + 1), key);
        return;
      }
    }

    onSelectionChange([key], key);
  }

  if (objects.length === 0) {
    return (
      <p className="text-sm text-[var(--muted-foreground)] py-6 text-center">
        {t('map.list.empty')}
      </p>
    );
  }

  return (
    <div className="select-none text-sm">
      {/* 根節點：等同 Blender 的 Scene Collection */}
      <div className="flex items-center gap-1.5 px-2 py-1 text-[var(--muted-foreground)]">
        <Layers className="w-4 h-4 flex-shrink-0" />
        <span className="truncate font-medium">{chunkId}</span>
        <span className="text-xs ml-auto flex-shrink-0">
          {selectableKeys.length}
        </span>
      </div>

      {rows.map((row) => {
        if (row.kind === 'branch') {
          const isCollapsed = collapsed.has(row.id);
          return (
            <button
              key={row.id}
              type="button"
              onClick={() => toggleBranch(row.id)}
              style={{ paddingLeft: `${row.depth * 12}px` }}
              className="w-full flex items-center gap-1.5 py-1 pr-2 text-left hover:bg-[var(--sidebar-hover)]"
            >
              {isCollapsed ? (
                <ChevronRight className="w-3.5 h-3.5 flex-shrink-0 text-[var(--muted-foreground)]" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 flex-shrink-0 text-[var(--muted-foreground)]" />
              )}
              {row.icon === 'group' && !isCollapsed ? (
                <FolderOpen className="w-4 h-4 flex-shrink-0 text-amber-500" />
              ) : (
                <TypeIcon
                  icon={row.icon}
                  className={`w-4 h-4 flex-shrink-0 ${
                    row.icon === 'group' ? 'text-amber-500' : 'text-[var(--muted-foreground)]'
                  }`}
                />
              )}
              <span className="truncate text-[var(--foreground)]">{row.label}</span>
              <span className="text-xs text-[var(--muted-foreground)] ml-auto flex-shrink-0">
                {row.count}
              </span>
            </button>
          );
        }

        const { obj } = row;
        const ov = overrideByKey[obj.key];
        const isActive = activeKey === obj.key;
        const isSelected = selectedKeys.has(obj.key);
        const hidden = ov?.action === 'delete' && ov.isActive;
        const disabled = !!ov && !ov.isActive;
        const isInstance = ov?.action === 'add' || ov?.action === 'replace';
        const displayName =
          isInstance && ov?.assetId
            ? assetsById[ov.assetId]?.name ?? obj.meshName
            : obj.meshName;

        return (
          <div
            key={obj.key}
            style={{ paddingLeft: `${row.depth * 12}px` }}
            className={`w-full flex items-center gap-1.5 pr-1 group ${
              isActive
                ? 'bg-blue-600/40'
                : isSelected
                ? 'bg-blue-600/20'
                : 'hover:bg-[var(--sidebar-hover)]'
            }`}
          >
            <button
              type="button"
              onClick={(e) => handleRowClick(obj.key, e)}
              onDoubleClick={() => onFocus(obj.key)}
              title={t('map.list.dblClickHint')}
              className="flex-1 min-w-0 flex items-center gap-1.5 py-1 text-left"
            >
              <TypeIcon
                icon={obj.type}
                className={`w-4 h-4 flex-shrink-0 ${
                  isInstance ? 'text-blue-400' : 'text-[var(--muted-foreground)]'
                }`}
              />
              <span
                className={`truncate ${
                  isActive
                    ? 'text-white font-medium'
                    : hidden || disabled
                    ? 'text-[var(--muted-foreground)] line-through'
                    : 'text-[var(--foreground)]'
                }`}
              >
                {displayName}
              </span>
              {ov?.action === 'transform' && ov.isActive && (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
              )}
            </button>

            <button
              type="button"
              onClick={() => onToggleVisible(obj.key)}
              disabled={!canEdit}
              title={t(hidden ? 'map.editor.restore' : 'map.editor.remove')}
              className={`p-1 flex-shrink-0 rounded hover:bg-black/20 disabled:opacity-40 ${
                hidden ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
              }`}
            >
              {hidden ? (
                <EyeOff className="w-3.5 h-3.5 text-[var(--muted-foreground)]" />
              ) : (
                <Eye className="w-3.5 h-3.5 text-[var(--muted-foreground)]" />
              )}
            </button>
          </div>
        );
      })}
    </div>
  );
}
