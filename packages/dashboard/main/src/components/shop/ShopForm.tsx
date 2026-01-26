'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/contexts/i18n-context';
import { shopService } from '@/lib/shop/shop-service';
import { OperatingHoursEditor } from './OperatingHoursEditor';
import { ShopItemList } from './ShopItemList';
import { ItemSelector } from './ItemSelector';
import type { Shop, ShopFormData, ShopItemConfig } from '@/types/shop';

interface ShopFormProps {
  shop?: Shop;
  mode: 'create' | 'edit';
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
  const [showItemSelector, setShowItemSelector] = useState(false);

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
        const shopId = await shopService.createShop(formData);
        router.push(`/shop/${shopId}`);
      } else if (shop) {
        await shopService.updateShop(shop.id, formData);
        router.push(`/shop/${shop.id}`);
      }
    } catch (err: any) {
      console.error('Failed to save shop:', err);
      setError(err.message || t('shop.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleAddItem = (itemConfig: ShopItemConfig) => {
    setItemList([...itemList, itemConfig]);
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

  const existingItemIds = itemList.map((item) => item.itemId);

  return (
    <>
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
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">{t('shop.itemList')}</h3>
            <button
              type="button"
              onClick={() => setShowItemSelector(true)}
              className="btn btn-primary"
            >
              + {t('shop.addItem')}
            </button>
          </div>

          <ShopItemList
            items={itemList}
            onRemoveItem={handleRemoveItem}
            onUpdateItem={handleUpdateItem}
          />
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

      {/* Item Selector Modal */}
      {showItemSelector && (
        <ItemSelector
          existingItemIds={existingItemIds}
          onAddItem={handleAddItem}
          onClose={() => setShowItemSelector(false)}
        />
      )}
    </>
  );
}
