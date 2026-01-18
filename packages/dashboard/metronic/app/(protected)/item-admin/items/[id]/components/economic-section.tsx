'use client';

/**
 * Economic Section Component
 * Phase 16 - Item Module
 */

import type { ItemFormData } from '@/types/items';

interface EconomicSectionProps {
  formData: ItemFormData;
  updateFormData: (updates: Partial<ItemFormData>) => void;
}

export function EconomicSection({
  formData,
  updateFormData,
}: EconomicSectionProps) {
  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">經濟屬性 (Economic Properties)</h3>
      </div>
      <div className="card-body">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Buy Price */}
          <div>
            <label className="form-label required">買入價格 (Buy Price)</label>
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
            <span className="form-hint">玩家購買此道具的價格</span>
          </div>

          {/* Sell Price */}
          <div>
            <label className="form-label required">賣出價格 (Sell Price)</label>
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
            <span className="form-hint">玩家賣出此道具的價格</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
          {/* Tradeable */}
          <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
            <input
              type="checkbox"
              id="isTradeable"
              checked={formData.isTradeable}
              onChange={(e) =>
                updateFormData({ isTradeable: e.target.checked })
              }
              className="checkbox"
            />
            <div className="flex-1">
              <label
                htmlFor="isTradeable"
                className="form-label mb-0 cursor-pointer"
              >
                可交易 (Tradeable)
              </label>
              <p className="text-sm text-gray-600">允許玩家交易此道具</p>
            </div>
          </div>

          {/* Droppable */}
          <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
            <input
              type="checkbox"
              id="isDroppable"
              checked={formData.isDroppable}
              onChange={(e) =>
                updateFormData({ isDroppable: e.target.checked })
              }
              className="checkbox"
            />
            <div className="flex-1">
              <label
                htmlFor="isDroppable"
                className="form-label mb-0 cursor-pointer"
              >
                可丟棄 (Droppable)
              </label>
              <p className="text-sm text-gray-600">允許玩家丟棄此道具</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
