'use client';

import { useState, useEffect } from 'react';
import { useI18n } from '@/contexts/i18n-context';
import { shopService } from '@/lib/shop/shop-service';
import { getCategoryTranslationKey } from '@/lib/item-helpers';
import Select from 'react-select';
import type { ItemForShop, ShopItemConfig } from '@/types/shop';

interface ItemSelectorProps {
  existingItemIds: string[];
  onAddItems: (itemConfigs: ShopItemConfig[]) => void;
  onClose: () => void;
}

interface SelectOption {
  value: string;
  label: string;
  item: ItemForShop;
}

export function ItemSelector({ existingItemIds, onAddItems, onClose }: ItemSelectorProps) {
  const { t } = useI18n();
  const [items, setItems] = useState<ItemForShop[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItems, setSelectedItems] = useState<SelectOption[]>([]);

  // Default configuration for all selected items
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
    if (selectedItems.length === 0) return;

    const itemConfigs: ShopItemConfig[] = selectedItems.map((option) => ({
      itemId: option.item.id,
      globalStock,
      personalLimit,
      priceMultiplier: priceMultiplier !== 1.0 ? priceMultiplier : undefined,
    }));

    onAddItems(itemConfigs);
    onClose();
  };

  // Convert items to react-select options
  const options: SelectOption[] = items.map((item) => ({
    value: item.id,
    label: `${item.name} ($${item.price}) - ${t(getCategoryTranslationKey(item.category))}`,
    item,
  }));

  // Custom styles for react-select to match dashboard theme
  const customStyles = {
    control: (provided: any) => ({
      ...provided,
      minHeight: '42px',
      borderRadius: '0.375rem',
      borderColor: 'var(--border, #d1d5db)',
      backgroundColor: 'var(--input-bg, white)',
    }),
    menu: (provided: any) => ({
      ...provided,
      backgroundColor: 'var(--card, white)',
      borderRadius: '0.375rem',
      border: '1px solid var(--border, #d1d5db)',
    }),
    option: (provided: any, state: any) => ({
      ...provided,
      backgroundColor: state.isSelected
        ? 'var(--primary, #3b82f6)'
        : state.isFocused
        ? 'var(--hover-bg, #f3f4f6)'
        : 'transparent',
      color: state.isSelected ? 'white' : 'var(--text, black)',
    }),
    multiValue: (provided: any) => ({
      ...provided,
      backgroundColor: 'var(--primary-light, #dbeafe)',
      borderRadius: '0.25rem',
    }),
    multiValueLabel: (provided: any) => ({
      ...provided,
      color: 'var(--primary, #3b82f6)',
      fontWeight: '500',
    }),
    multiValueRemove: (provided: any) => ({
      ...provided,
      color: 'var(--primary, #3b82f6)',
      ':hover': {
        backgroundColor: 'var(--primary, #3b82f6)',
        color: 'white',
      },
    }),
  };

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
      <div className="modal-content max-w-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{t('shop.addItem')}</h2>
          <button onClick={onClose} className="btn-close">
            ✕
          </button>
        </div>

        <div className="modal-body space-y-6">
          {/* Item Selection with Search */}
          <div>
            <label className="form-label mb-2 block">
              {t('shop.selectItem')} *
            </label>
            <Select
              isMulti
              options={options}
              value={selectedItems}
              onChange={(selected) => setSelectedItems(selected as SelectOption[])}
              placeholder={t('item.searchPlaceholder')}
              noOptionsMessage={() => t('item.noItems')}
              styles={customStyles}
              isSearchable
              className="react-select-container"
              classNamePrefix="react-select"
            />
            <p className="text-sm text-gray-600 mt-2">
              {t('common.total')}: {items.length} {t('common.items')}
              {selectedItems.length > 0 && ` | ${t('common.selected')}: ${selectedItems.length}`}
            </p>
          </div>

          {/* Default Configuration for All Selected Items */}
          {selectedItems.length > 0 && (
            <div className="border rounded-lg p-4 bg-gray-50 dark:bg-gray-800/50">
              <h3 className="font-semibold mb-4">
                {t('shop.defaultConfiguration')}
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                {t('shop.configurationHint')}
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                  <span className="form-hint text-xs">{t('shop.globalStockHint')}</span>
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
                  <span className="form-hint text-xs">{t('shop.personalLimitHint')}</span>
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
                  <span className="form-hint text-xs">{t('shop.priceMultiplierHint')}</span>
                </div>
              </div>
            </div>
          )}

          {/* Selected Items Preview */}
          {selectedItems.length > 0 && (
            <div className="border rounded-lg p-4">
              <h3 className="font-semibold mb-3">
                {t('shop.selectedItems')} ({selectedItems.length})
              </h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {selectedItems.map((option) => {
                  const finalPrice = Math.floor(option.item.price * priceMultiplier);
                  return (
                    <div
                      key={option.item.id}
                      className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800/50 rounded"
                    >
                      <div className="flex items-center gap-3 flex-1">
                        {option.item.imageUrl && (
                          <img
                            src={option.item.imageUrl}
                            alt={option.item.name}
                            className="w-10 h-10 object-cover rounded"
                          />
                        )}
                        <div>
                          <h4 className="font-medium text-sm">{option.item.name}</h4>
                          <p className="text-xs text-gray-600">
                            {t(getCategoryTranslationKey(option.item.category))}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">${finalPrice}</div>
                        <div className="text-xs text-gray-600">
                          {globalStock === -1 ? t('shop.unlimited') : `${t('shop.stock')}: ${globalStock}`}
                          {personalLimit > 0 && ` | ${t('shop.limit')}: ${personalLimit}`}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-secondary">
            {t('common.cancel')}
          </button>
          <button
            onClick={handleAdd}
            disabled={selectedItems.length === 0}
            className="btn btn-primary"
          >
            {t('common.add')} ({selectedItems.length})
          </button>
        </div>
      </div>
    </div>
  );
}
