'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Save, ArrowLeft } from 'lucide-react';
import { useI18n } from '@/contexts/i18n-context';
import { itemService } from '@/lib/item/service';
import { ItemCategory, type ItemFormData } from '@/types/item';
import { ItemImage } from '@/components/common/ItemImage';
import { BasicInfoSection } from '@/components/item/BasicInfoSection';
import { EconomicSection } from '@/components/item/EconomicSection';
import { AttributesSection } from '@/components/item/AttributesSection';

export default function NewItemPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<ItemFormData>({
    name: '',
    description: '',
    category: ItemCategory.CONSUMABLE,
    imageUrl: '/images/no-image.png',
    price: 0,
    sellPrice: 0,
    isTradeable: true,
    isDroppable: true,
    isActive: false,
    attributes: {},
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!formData.name.trim()) {
      setError(t('validation.required').replace('{field}', t('common.name')));
      return;
    }

    if (formData.price < 0 || formData.sellPrice < 0) {
      setError(t('error.mustBeNonNegative'));
      return;
    }

    try {
      setSaving(true);
      setError(null);
      console.log('Creating new item...', formData);
      await itemService.createItem(formData);
      console.log('Item created successfully!');
      router.push('/item');
    } catch (err: any) {
      console.error('Failed to create item:', err);

      // Provide detailed error messages
      let errorMessage = t('error.saveFailed');

      if (err.message?.includes('Firebase')) {
        errorMessage = t('error.firebaseConnection');
      } else if (err.message?.includes('ERR_BLOCKED_BY_CLIENT')) {
        errorMessage = t('error.blockedByClient');
      } else if (err.code === 'permission-denied') {
        errorMessage = t('error.permissionDenied');
      } else if (err.code === 'unavailable') {
        errorMessage = t('error.serviceUnavailable');
      } else if (err.message) {
        errorMessage = err.message;
      }

      setError(errorMessage);

      // Log full error for debugging
      console.error('Full error info:', {
        code: err.code,
        message: err.message,
        name: err.name,
        stack: err.stack
      });
    } finally {
      setSaving(false);
    }
  }

  function updateFormData(updates: Partial<ItemFormData>) {
    setFormData({ ...formData, ...updates });
  }

  function updateAttributes(attributes: Partial<ItemFormData['attributes']>) {
    setFormData({
      ...formData,
      attributes: { ...formData.attributes, ...attributes },
    });
  }

  return (
    <div className="container-fixed">
      <div className="flex flex-wrap items-center lg:items-end justify-between gap-5 pb-7.5">
        <div className="flex flex-col justify-center gap-2">
          <h1 className="text-3xl font-bold leading-none text-[var(--foreground)]">
            {t('item.new')}
          </h1>
          <div className="text-sm text-[var(--muted-foreground)]">
            {t('item.newDescription')}
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => router.push('/item')}
            className="btn btn-light"
          >
            <ArrowLeft className="w-4 h-4" />
            {t('common.back')}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-5 flex items-center gap-2 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          <button
            onClick={() => setError(null)}
            className="ml-auto text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
          >
            ✕
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 lg:gap-7.5">
          <div className="xl:col-span-2 flex flex-col gap-5 lg:gap-7.5">
            <BasicInfoSection
              formData={formData}
              updateFormData={updateFormData}
            />

            <EconomicSection
              formData={formData}
              updateFormData={updateFormData}
            />

            <AttributesSection
              category={formData.category}
              attributes={formData.attributes}
              updateAttributes={updateAttributes}
            />
          </div>

          <div className="flex flex-col gap-5 lg:gap-7.5">
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">{t('common.actions')}</h3>
              </div>
              <div className="card-body">
                <div className="flex flex-col gap-3">
                  <button
                    type="submit"
                    disabled={saving}
                    className="btn btn-primary"
                  >
                    <Save className="w-4 h-4" />
                    {saving ? t('item.creating') : t('item.createItem')}
                  </button>
                  <button
                    type="button"
                    onClick={() => router.push('/item')}
                    className="btn btn-light"
                  >
                    {t('common.cancel')}
                  </button>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <h3 className="card-title">{t('item.preview')}</h3>
              </div>
              <div className="card-body">
                <div className="flex flex-col gap-3">
                  <ItemImage
                    src={formData.imageUrl}
                    alt="Preview"
                    className="w-full aspect-square object-cover rounded-lg bg-gray-100 dark:bg-gray-800"
                  />
                  <div>
                    <h4 className="font-semibold text-[var(--foreground)]">
                      {formData.name || t('item.untitled')}
                    </h4>
                    <p className="text-sm text-[var(--muted-foreground)] line-clamp-2">
                      {formData.description || t('item.noDescription')}
                    </p>
                  </div>
                  <div className="flex items-center justify-between text-sm pt-2 border-t border-[var(--border)]">
                    <span className="text-[var(--muted-foreground)]">{t('common.price')}</span>
                    <span className="font-semibold text-primary">
                      ${formData.price.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
