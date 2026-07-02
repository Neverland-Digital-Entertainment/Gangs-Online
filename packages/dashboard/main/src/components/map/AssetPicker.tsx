'use client';

/**
 * AssetPicker — 從建築資產庫挑選一個資產（Map Editor P4）
 * 用於「替換成資產」與「新增建築」。
 */

import { Building2, ImageOff, X } from 'lucide-react';
import { useI18n } from '@/contexts/i18n-context';
import type { BuildingAsset } from '@/types/map';

interface AssetPickerProps {
  assets: BuildingAsset[];
  title: string;
  onPick: (assetId: string) => void;
  onClose: () => void;
}

export default function AssetPicker({
  assets,
  title,
  onPick,
  onClose,
}: AssetPickerProps) {
  const { t } = useI18n();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="card w-full max-w-2xl max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="card-body flex flex-col min-h-0">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">
              {title}
            </h2>
            <button className="btn btn-sm btn-light" onClick={onClose}>
              <X className="w-4 h-4" />
            </button>
          </div>

          {assets.length === 0 ? (
            <div className="text-center py-12">
              <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-[var(--muted-foreground)]">
                {t('map.assets.empty')}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 overflow-y-auto">
              {assets.map((asset) => (
                <button
                  key={asset.id}
                  type="button"
                  onClick={() => onPick(asset.id)}
                  className="card overflow-hidden text-left hover:ring-2 hover:ring-blue-500 transition"
                >
                  <div className="aspect-square bg-[#11161d] flex items-center justify-center">
                    {asset.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={asset.thumbnailUrl}
                        alt={asset.name}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <ImageOff className="w-8 h-8 text-gray-600" />
                    )}
                  </div>
                  <div className="p-2">
                    <p className="text-sm font-medium text-[var(--foreground)] truncate">
                      {asset.name}
                    </p>
                    {asset.category && (
                      <span className="badge badge-gray text-xs">
                        {asset.category}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
