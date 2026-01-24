'use client';

import { Upload } from 'lucide-react';
import { useI18n } from '@/contexts/i18n-context';
import { getCategoryTranslationKey, getAllCategories } from '@/lib/item-helpers';
import type { ItemFormData, ItemCategory } from '@/types/item';

interface BasicInfoSectionProps {
  formData: ItemFormData;
  updateFormData: (updates: Partial<ItemFormData>) => void;
}

export function BasicInfoSection({ formData, updateFormData }: BasicInfoSectionProps) {
  const { t } = useI18n();

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      updateFormData({ imageFile: file });
      const reader = new FileReader();
      reader.onloadend = () => {
        updateFormData({ imageUrl: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  }

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">{t('item.basicInfo')}</h3>
      </div>
      <div className="card-body">
        <div className="flex flex-col gap-5">
          <div>
            <label className="form-label">{t('item.name')} *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => updateFormData({ name: e.target.value })}
              className="input"
              placeholder={t('item.namePlaceholder')}
              required
            />
          </div>

          <div>
            <label className="form-label">{t('item.description')}</label>
            <textarea
              value={formData.description}
              onChange={(e) => updateFormData({ description: e.target.value })}
              className="textarea"
              rows={4}
              placeholder={t('item.descriptionPlaceholder')}
            />
          </div>

          <div>
            <label className="form-label">{t('item.category')} *</label>
            <select
              value={formData.category}
              onChange={(e) => {
                updateFormData({
                  category: e.target.value as ItemCategory,
                  attributes: {}
                });
              }}
              className="select"
              required
            >
              {getAllCategories().map((category) => (
                <option key={category} value={category}>
                  {t(getCategoryTranslationKey(category))}
                </option>
              ))}
            </select>
            <span className="form-hint">
              {t('item.categoryHint')}
            </span>
          </div>

          <div>
            <label className="form-label">{t('item.image')}</label>
            <div className="flex items-start gap-4">
              <div className="flex-1">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                  id="image-upload"
                />
                <label
                  htmlFor="image-upload"
                  className="btn btn-light cursor-pointer w-full"
                >
                  <Upload className="w-4 h-4" />
                  {t('item.selectImage')}
                </label>
                <span className="form-hint">
                  {t('item.imageHint')}
                </span>
              </div>
              {formData.imageUrl && (
                <img
                  src={formData.imageUrl}
                  alt="Preview"
                  className="w-20 h-20 object-cover rounded border"
                />
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isActive"
              checked={formData.isActive}
              onChange={(e) => updateFormData({ isActive: e.target.checked })}
              className="w-4 h-4 text-primary"
            />
            <label htmlFor="isActive" className="text-sm font-medium text-gray-700">
              {t('item.isActive')}
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
