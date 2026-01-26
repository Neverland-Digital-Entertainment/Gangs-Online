'use client';

import { useState, useEffect } from 'react';
import { useI18n } from '@/contexts/i18n-context';
import { getCategoryTranslationKey } from '@/lib/item-helpers';
import { collection, doc, getDoc } from 'firebase/firestore';
import { getFirebaseServices } from '@/lib/firebase/config';
import type { ShopItemConfig } from '@/types/shop';

interface ShopItemListProps {
  items: ShopItemConfig[];
  onRemoveItem: (itemId: string) => void;
  onUpdateItem: (itemId: string, updates: Partial<ShopItemConfig>) => void;
}

interface ItemDetails {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  imageUrl: string;
}

export function ShopItemList({ items, onRemoveItem, onUpdateItem }: ShopItemListProps) {
  const { t } = useI18n();
  const [itemDetails, setItemDetails] = useState<Record<string, ItemDetails>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadItemDetails();
  }, [items]);

  const loadItemDetails = async () => {
    try {
      setLoading(true);
      const { db } = getFirebaseServices();
      const details: Record<string, ItemDetails> = {};

      await Promise.all(
        items.map(async (shopItem) => {
          const itemRef = doc(db, 'items', shopItem.itemId);
          const itemDoc = await getDoc(itemRef);

          if (itemDoc.exists()) {
            const data = itemDoc.data();
            details[shopItem.itemId] = {
              id: itemDoc.id,
              name: data.name || 'Unknown Item',
              description: data.description || '',
              price: data.price || 0,
              category: data.category || 'consumable',
              imageUrl: data.imageUrl || '',
            };
          }
        })
      );

      setItemDetails(details);
    } catch (error) {
      console.error('Failed to load item details:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="card">
        <div className="card-body">
          <div className="text-center py-4">{t('common.loading')}</div>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="card">
        <div className="card-body">
          <p className="text-center text-gray-500 py-8">{t('shop.noItems')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">{t('shop.itemList')}</h3>
        <span className="text-sm text-gray-500">
          {t('common.total')}: {items.length} {t('common.items')}
        </span>
      </div>
      <div className="card-body">
        <div className="space-y-4">
          {items.map((shopItem) => {
            const detail = itemDetails[shopItem.itemId];
            if (!detail) return null;

            const finalPrice = Math.floor(
              detail.price * (shopItem.priceMultiplier ?? 1.0)
            );

            return (
              <div
                key={shopItem.itemId}
                className="border rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start gap-4">
                  {/* Item Image */}
                  {detail.imageUrl && (
                    <img
                      src={detail.imageUrl}
                      alt={detail.name}
                      className="w-16 h-16 object-cover rounded"
                    />
                  )}

                  {/* Item Info */}
                  <div className="flex-1">
                    <h4 className="font-semibold text-lg">{detail.name}</h4>
                    <p className="text-sm text-gray-600 mb-2">{detail.description}</p>
                    <div className="flex items-center gap-3 text-sm">
                      <span className="badge badge-secondary">
                        {t(getCategoryTranslationKey(detail.category))}
                      </span>
                      <span className="text-gray-600">
                        {t('common.price')}: ${finalPrice}
                        {shopItem.priceMultiplier && shopItem.priceMultiplier !== 1.0 && (
                          <span className="text-xs text-gray-500 ml-1">
                            (×{shopItem.priceMultiplier})
                          </span>
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Remove Button */}
                  <button
                    onClick={() => onRemoveItem(shopItem.itemId)}
                    className="btn btn-sm btn-danger"
                    title={t('shop.removeItem')}
                  >
                    ✕
                  </button>
                </div>

                {/* Configuration */}
                <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 border-t pt-4">
                  {/* Global Stock */}
                  <div>
                    <label className="form-label text-sm">{t('shop.globalStock')}</label>
                    <input
                      type="number"
                      value={shopItem.globalStock}
                      onChange={(e) =>
                        onUpdateItem(shopItem.itemId, {
                          globalStock: Number(e.target.value),
                        })
                      }
                      className="input input-sm w-full"
                      min={-1}
                    />
                    <span className="form-hint text-xs">{t('shop.globalStockHint')}</span>
                  </div>

                  {/* Personal Limit */}
                  <div>
                    <label className="form-label text-sm">{t('shop.personalLimit')}</label>
                    <input
                      type="number"
                      value={shopItem.personalLimit}
                      onChange={(e) =>
                        onUpdateItem(shopItem.itemId, {
                          personalLimit: Number(e.target.value),
                        })
                      }
                      className="input input-sm w-full"
                      min={0}
                    />
                    <span className="form-hint text-xs">
                      {t('shop.personalLimitHint')}
                    </span>
                  </div>

                  {/* Price Multiplier */}
                  <div>
                    <label className="form-label text-sm">{t('shop.priceMultiplier')}</label>
                    <input
                      type="number"
                      value={shopItem.priceMultiplier ?? 1.0}
                      onChange={(e) =>
                        onUpdateItem(shopItem.itemId, {
                          priceMultiplier: Number(e.target.value),
                        })
                      }
                      className="input input-sm w-full"
                      min={0.1}
                      step={0.1}
                    />
                    <span className="form-hint text-xs">
                      {t('shop.priceMultiplierHint')}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
