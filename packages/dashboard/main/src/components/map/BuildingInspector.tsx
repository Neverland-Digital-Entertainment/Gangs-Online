'use client';

/**
 * BuildingInspector — 顯示選中地圖物件的詳細資訊（Map Editor P1）
 * P2 起會在此面板加入移動/旋轉/縮放/替換/刪除等編輯操作。
 */

import { Building2, Info } from 'lucide-react';
import { useI18n } from '@/contexts/i18n-context';
import type { MapObjectInfo } from '@/types/map';

function vec(v: { x: number; y: number; z: number }, digits = 2): string {
  return `${v.x.toFixed(digits)}, ${v.y.toFixed(digits)}, ${v.z.toFixed(digits)}`;
}

export default function BuildingInspector({
  object,
}: {
  object: MapObjectInfo | null;
}) {
  const { t } = useI18n();

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

  const rows: [string, string][] = [
    [t('map.inspector.name'), object.meshName],
    [t('map.inspector.type'), t(`map.objectType.${object.type}`)],
    [t('map.inspector.chunk'), object.chunkId],
    [t('map.inspector.key'), object.key],
    [t('map.inspector.position'), vec(object.position)],
    [t('map.inspector.rotation'), vec(object.rotation, 3)],
    [t('map.inspector.scale'), vec(object.scale, 3)],
    [t('map.inspector.size'), vec(object.boundingSize)],
  ];

  return (
    <div className="card h-full">
      <div className="card-body">
        <div className="flex items-center gap-2 mb-4">
          <Building2 className="w-5 h-5 text-blue-500" />
          <h2 className="text-lg font-semibold text-[var(--foreground)]">
            {t('map.inspector.title')}
          </h2>
        </div>
        <dl className="space-y-3">
          {rows.map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs text-[var(--muted-foreground)] mb-0.5">
                {label}
              </dt>
              <dd className="text-sm font-mono break-all text-[var(--foreground)]">
                {value}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
