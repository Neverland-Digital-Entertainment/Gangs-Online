'use client';

import { useI18n } from '@/contexts/i18n-context';
import type { ItemFormData } from '@/types/item';

interface EconomicSectionProps {
  formData: ItemFormData;
  updateFormData: (updates: Partial<ItemFormData>) => void;
}

export function EconomicSection({ formData, updateFormData }: EconomicSectionProps) {
  const { t } = useI18n();

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">{t('item.economicAttributes')}</h3>
      </div>
      <div className="card-body">
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="form-label">{t('item.buyPrice')} *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                  $
                </span>
                <input
                  type="number"
                  min="0"
                  value={formData.price}
                  onChange={(e) =>
                    updateFormData({ price: parseInt(e.target.value) || 0 })
                  }
                  className="input pl-8"
                  placeholder="0"
                  required
                />
              </div>
              <span className="form-hint">{t('item.buyPriceHint')}</span>
            </div>

            <div>
              <label className="form-label">{t('item.sellPrice')} *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                  $
                </span>
                <input
                  type="number"
                  min="0"
                  value={formData.sellPrice}
                  onChange={(e) =>
                    updateFormData({ sellPrice: parseInt(e.target.value) || 0 })
                  }
                  className="input pl-8"
                  placeholder="0"
                  required
                />
              </div>
              <span className="form-hint">{t('item.sellPriceHint')}</span>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isTradeable"
                checked={formData.isTradeable}
                onChange={(e) =>
                  updateFormData({ isTradeable: e.target.checked })
                }
                className="w-4 h-4 text-primary"
              />
              <label htmlFor="isTradeable" className="text-sm font-medium text-gray-700">
                {t('item.isTradeable')}
              </label>
            </div>
            <span className="form-hint ml-6">
              {t('item.isTradeableHint')}
            </span>
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isDroppable"
                checked={formData.isDroppable}
                onChange={(e) =>
                  updateFormData({ isDroppable: e.target.checked })
                }
                className="w-4 h-4 text-primary"
              />
              <label htmlFor="isDroppable" className="text-sm font-medium text-gray-700">
                {t('item.isDroppable')}
              </label>
            </div>
            <span className="form-hint ml-6">
              {t('item.isDroppableHint')}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
