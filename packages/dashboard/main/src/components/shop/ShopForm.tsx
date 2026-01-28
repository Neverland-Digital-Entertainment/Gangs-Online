'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/contexts/i18n-context';
import { shopService } from '@/lib/shop/shop-service';
import { getCategoryTranslationKey } from '@/lib/item-helpers';
import { OperatingHoursEditor } from './OperatingHoursEditor';
import { ShopItemList } from './ShopItemList';
import Select from 'react-select';
import type { Shop, ShopFormData, ShopItemConfig, ItemForShop } from '@/types/shop';

interface ShopFormProps {
  shop?: Shop;
  mode: 'create' | 'edit';
}

interface SelectOption {
  value: string;
  label: string;
  item: ItemForShop;
}

export function ShopForm({ shop, mode }: ShopFormProps) {
  const { t } = useI18n();
  const router = useRouter();

  // Form state
  const [name, setName] = useState(shop?.name || '');
  const [description, setDescription] = useState(shop?.description || '');
  const [operatingHours, setOperatingHours] = useState(shop?.operatingHours);
  const [itemList, setItemList] = useState<ShopItemConfig[]>(shop?.itemList || []);
  const [isActive, setIsActive] = useState(shop?.isActive ?? true);

  // UI state
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Item selection state
  const [availableItems, setAvailableItems] = useState<ItemForShop[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [selectedItems, setSelectedItems] = useState<SelectOption[]>([]);

  // Default configuration for new items
  const [globalStock, setGlobalStock] = useState(-1);
  const [personalLimit, setPersonalLimit] = useState(0);
  const [priceMultiplier, setPriceMultiplier] = useState(1.0);

  useEffect(() => {
    loadAvailableItems();
  }, []);

  const loadAvailableItems = async () => {
    try {
      setLoadingItems(true);
      const items = await shopService.getAvailableItems();
      console.log('Loaded items:', items); // Debug log
      setAvailableItems(items);
    } catch (error) {
      console.error('Failed to load items:', error);
    } finally {
      setLoadingItems(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError(t('error.required'));
      return;
    }

    try {
      setSaving(true);

      const formData: ShopFormData = {
        name: name.trim(),
        description: description.trim(),
        operatingHours,
        itemList,
        isActive,
      };

      if (mode === 'create') {
        await shopService.createShop(formData);
        router.push('/shop');
      } else if (shop) {
        await shopService.updateShop(shop.id, formData);
        router.push('/shop');
      }
    } catch (err: any) {
      console.error('Failed to save shop:', err);
      setError(err.message || t('shop.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleAddSelectedItems = () => {
    if (selectedItems.length === 0) return;

    const newItems: ShopItemConfig[] = selectedItems.map((option) => ({
      itemId: option.item.id,
      globalStock,
      personalLimit,
      priceMultiplier: priceMultiplier !== 1.0 ? priceMultiplier : undefined,
    }));

    setItemList([...itemList, ...newItems]);
    setSelectedItems([]); // Clear selection after adding
  };

  const handleRemoveItem = (itemId: string) => {
    setItemList(itemList.filter((item) => item.itemId !== itemId));
  };

  const handleUpdateItem = (itemId: string, updates: Partial<ShopItemConfig>) => {
    setItemList(
      itemList.map((item) =>
        item.itemId === itemId ? { ...item, ...updates } : item
      )
    );
  };

  // Filter out already added items
  const existingItemIds = itemList.map((item) => item.itemId);
  const filteredItems = availableItems.filter(
    (item) => !existingItemIds.includes(item.id)
  );

  // Convert to react-select options
  const options: SelectOption[] = filteredItems.map((item) => ({
    value: item.id,
    label: `${item.name} ($${item.price}) - ${t(getCategoryTranslationKey(item.category))}${!item.isActive ? ' [停用]' : ''}`,
    item,
  }));

  // Custom styles for react-select
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
      zIndex: 100,
    }),
    option: (provided: any, state: any) => ({
      ...provided,
      backgroundColor: state.isSelected
        ? 'var(--primary, #3b82f6)'
        : state.isFocused
        ? 'var(--hover-bg, #f3f4f6)'
        : 'transparent',
      color: state.isSelected
        ? 'white'
        : state.isFocused
        ? 'var(--text, black)'
        : 'white',
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

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Error Message */}
      {error && (
        <div className="alert alert-error">
          <span>{error}</span>
        </div>
      )}

      {/* Basic Information */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">{t('shop.basicInfo')}</h3>
        </div>
        <div className="card-body flex flex-col gap-4">
          {/* Shop Name */}
          <div>
            <label className="form-label">
              {t('shop.name')} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('shop.namePlaceholder')}
              className="input w-full"
              required
            />
          </div>

          {/* Shop Description */}
          <div>
            <label className="form-label">{t('shop.description')}</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('shop.descriptionPlaceholder')}
              className="textarea w-full"
              rows={3}
            />
          </div>

          {/* Active Status */}
          <div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="checkbox"
              />
              <span>{t('shop.isActive')}</span>
            </label>
          </div>
        </div>
      </div>

      {/* Operating Hours */}
      <OperatingHoursEditor value={operatingHours} onChange={setOperatingHours} />

      {/* Item List */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">{t('shop.itemList')}</h3>
        </div>
        <div className="card-body space-y-4">
          {/* Item Selection */}
          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 space-y-4">
            <div>
              <label className="form-label mb-2 block">
                {t('shop.selectItemsToAdd')}
              </label>
              {loadingItems ? (
                <div className="text-center py-4 text-gray-500">
                  {t('common.loading')}
                </div>
              ) : (
                <>
                  <Select
                    isMulti
                    options={options}
                    value={selectedItems}
                    onChange={(selected) => setSelectedItems(selected as SelectOption[])}
                    placeholder={t('item.searchPlaceholder')}
                    noOptionsMessage={() =>
                      filteredItems.length === 0
                        ? t('shop.allItemsAdded')
                        : t('item.noItems')
                    }
                    styles={customStyles}
                    isSearchable
                    className="react-select-container"
                    classNamePrefix="react-select"
                  />
                  <p className="text-sm text-gray-600 mt-2">
                    {t('shop.availableItems')}: {filteredItems.length}
                    {selectedItems.length > 0 && ` | ${t('common.selected')}: ${selectedItems.length}`}
                  </p>
                </>
              )}
            </div>

            {/* Configuration for selected items */}
            {selectedItems.length > 0 && (
              <div className="border-t pt-4 space-y-4">
                <h4 className="font-semibold text-sm">
                  {t('shop.defaultConfiguration')}
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="form-label text-sm">{t('shop.globalStock')}</label>
                    <input
                      type="number"
                      value={globalStock}
                      onChange={(e) => setGlobalStock(Number(e.target.value))}
                      className="input w-full input-sm"
                      min={-1}
                    />
                    <span className="form-hint text-xs">{t('shop.globalStockHint')}</span>
                  </div>

                  <div>
                    <label className="form-label text-sm">{t('shop.personalLimit')}</label>
                    <input
                      type="number"
                      value={personalLimit}
                      onChange={(e) => setPersonalLimit(Number(e.target.value))}
                      className="input w-full input-sm"
                      min={0}
                    />
                    <span className="form-hint text-xs">{t('shop.personalLimitHint')}</span>
                  </div>

                  <div>
                    <label className="form-label text-sm">{t('shop.priceMultiplier')}</label>
                    <input
                      type="number"
                      value={priceMultiplier}
                      onChange={(e) => setPriceMultiplier(Number(e.target.value))}
                      className="input w-full input-sm"
                      min={0.1}
                      step={0.1}
                    />
                    <span className="form-hint text-xs">{t('shop.priceMultiplierHint')}</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleAddSelectedItems}
                  className="btn btn-primary w-full"
                >
                  {t('shop.addSelectedItems')} ({selectedItems.length})
                </button>
              </div>
            )}
          </div>

          {/* Added Items List */}
          {itemList.length > 0 ? (
            <div className="border-t pt-4">
              <h4 className="font-semibold mb-3">
                {t('shop.addedItems')} ({itemList.length})
              </h4>
              <ShopItemList
                items={itemList}
                onRemoveItem={handleRemoveItem}
                onUpdateItem={handleUpdateItem}
              />
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              {t('shop.noItemsAdded')}
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between border-t pt-6">
        <button
          type="button"
          onClick={() => router.back()}
          className="btn btn-secondary"
          disabled={saving}
        >
          {t('common.cancel')}
        </button>

        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving
            ? t(mode === 'create' ? 'shop.creating' : 'shop.saving')
            : t(mode === 'create' ? 'shop.createShop' : 'shop.updateShop')}
        </button>
      </div>
    </form>
  );
}
