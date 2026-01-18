'use client';

import { Upload } from 'lucide-react';
import type { ItemFormData, ItemCategory } from '@/types/item';

interface BasicInfoSectionProps {
  formData: ItemFormData;
  updateFormData: (updates: Partial<ItemFormData>) => void;
}

const CATEGORY_LABELS: Record<ItemCategory, string> = {
  consumable: '消耗品 (Consumables)',
  special: '宗教道具 (Special Items)',
  contraband: '非法物資 (Contraband)',
  material: '素材 (Materials)',
};

export function BasicInfoSection({ formData, updateFormData }: BasicInfoSectionProps) {
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
        <h3 className="card-title">基本資訊</h3>
      </div>
      <div className="card-body">
        <div className="flex flex-col gap-5">
          <div>
            <label className="form-label">道具名稱 *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => updateFormData({ name: e.target.value })}
              className="input"
              placeholder="輸入道具名稱"
              required
            />
          </div>

          <div>
            <label className="form-label">道具說明</label>
            <textarea
              value={formData.description}
              onChange={(e) => updateFormData({ description: e.target.value })}
              className="textarea"
              rows={4}
              placeholder="輸入道具說明文字（支援多行）"
            />
          </div>

          <div>
            <label className="form-label">道具分類 *</label>
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
              {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <span className="form-hint">
              不同分類會顯示不同的動態屬性設定
            </span>
          </div>

          <div>
            <label className="form-label">道具圖示</label>
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
                  選擇圖片
                </label>
                <span className="form-hint">
                  建議尺寸: 128x128 或 64x64 像素
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
              啟用此道具（可在遊戲中出現）
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
