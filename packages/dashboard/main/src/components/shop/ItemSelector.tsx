'use client';

import { useState, useEffect } from 'react';
import { useI18n } from '@/contexts/i18n-context';
import { shopService } from '@/lib/shop/shop-service';
import { getCategoryTranslationKey } from '@/lib/item-helpers';
import type { ItemForShop, ShopItemConfig } from '@/types/shop';

interface ItemSelectorProps {
  existingItemIds: string[];
  onAddItem: (itemConfig: ShopItemConfig) => void;
  onClose: () => void;
}

export function ItemSelector({ existingItemIds, onAddItem, onClose }: ItemSelectorProps) {
  const { t } = useI18n();
  const [items, setItems] = useState<ItemForShop[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<ItemForShop | null>(null);
  const [search, setSearch] = useState('');

  // Item configuration
  const [globalStock, setGlobalStock] = useState(-1);
  const [personalLimit, setPersonalLimit] = useState(0);
  const [priceMultiplier, setPriceMultiplier] = useState(1.0);

  useEffect(() => {
    loadItems();
  }, []);

  const loadItems = async () => {
    try {
      setLoading(true);
      const availableItems = await shopService.getAvailableItems();
      // Filter out items already in shop
      const filteredItems = availableItems.filter(
        (item) => !existingItemIds.includes(item.id)
      );
      setItems(filteredItems);
    } catch (error) {
      console.error('Failed to load items:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    if (!selectedItem) return;

    const itemConfig: ShopItemConfig = {
      itemId: selectedItem.id,
      globalStock,
      personalLimit,
      priceMultiplier: priceMultiplier !== 1.0 ? priceMultiplier : undefined,
    };

    onAddItem(itemConfig);
    onClose();
  };

  const filteredItems = items.filter((item) =>
    item.name.toLowerCase().includes(search.toLowerCase()) ||
    item.description.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="modal-overlay">
        <div className="modal-content">
          <div className="text-center py-8">{t('common.loading')}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content max-w-4xl" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{t('shop.addItem')}</h2>
          <button onClick={onClose} className="btn-close">
            ✕
          </button>
        </div>

        <div className="modal-body">
          {/* Search */}
          <div className="mb-4">
            <input
              type="text"
              placeholder={t('item.searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input w-full"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Item List */}
            <div className="border rounded-lg p-4 max-h-96 overflow-y-auto">
              <h3 className="font-semibold mb-2">{t('shop.selectItem')}</h3>
              {filteredItems.length === 0 ? (
                <p className="text-gray-500">{t('item.noItems')}</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {filteredItems.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => setSelectedItem(item)}
                      className={`
                        p-3 border rounded cursor-pointer transition-colors
                        ${selectedItem?.id === item.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-300 hover:border-blue-300'
                        }
                      `}
                    >
                      <div className="flex items-start gap-3">
                        {item.imageUrl && (
                          <img
                            src={item.imageUrl}
                            alt={item.name}
                            className="w-12 h-12 object-cover rounded"
                          />
                        )}
                        <div className="flex-1">
                          <h4 className="font-medium">{item.name}</h4>
                          <p className="text-sm text-gray-600 line-clamp-1">
                            {item.description}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-sm text-gray-500">
                              {t(getCategoryTranslationKey(item.category))}
                            </span>
                            <span className="text-sm font-semibold">
                              ${item.price}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Configuration */}
            <div className="border rounded-lg p-4">
              <h3 className="font-semibold mb-4">
                {selectedItem ? selectedItem.name : t('shop.selectItem')}
              </h3>

              {selectedItem ? (
                <div className="flex flex-col gap-4">
                  {/* Global Stock */}
                  <div>
                    <label className="form-label">{t('shop.globalStock')}</label>
                    <input
                      type="number"
                      value={globalStock}
                      onChange={(e) => setGlobalStock(Number(e.target.value))}
                      className="input w-full"
                      min={-1}
                    />
                    <span className="form-hint">{t('shop.globalStockHint')}</span>
                  </div>

                  {/* Personal Limit */}
                  <div>
                    <label className="form-label">{t('shop.personalLimit')}</label>
                    <input
                      type="number"
                      value={personalLimit}
                      onChange={(e) => setPersonalLimit(Number(e.target.value))}
                      className="input w-full"
                      min={0}
                    />
                    <span className="form-hint">{t('shop.personalLimitHint')}</span>
                  </div>

                  {/* Price Multiplier */}
                  <div>
                    <label className="form-label">{t('shop.priceMultiplier')}</label>
                    <input
                      type="number"
                      value={priceMultiplier}
                      onChange={(e) => setPriceMultiplier(Number(e.target.value))}
                      className="input w-full"
                      min={0.1}
                      step={0.1}
                    />
                    <span className="form-hint">{t('shop.priceMultiplierHint')}</span>
                  </div>

                  {/* Preview Price */}
                  <div className="bg-gray-100 p-3 rounded">
                    <div className="text-sm text-gray-600">{t('common.price')}</div>
                    <div className="flex items-baseline gap-2">
                      {priceMultiplier !== 1.0 && (
                        <span className="text-sm line-through text-gray-500">
                          ${selectedItem.price}
                        </span>
                      )}
                      <span className="text-lg font-bold">
                        ${Math.floor(selectedItem.price * priceMultiplier)}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">
                  {t('shop.selectItem')}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-secondary">
            {t('common.cancel')}
          </button>
          <button
            onClick={handleAdd}
            disabled={!selectedItem}
            className="btn btn-primary"
          >
            {t('common.add')}
          </button>
        </div>
      </div>
    </div>
  );
}
