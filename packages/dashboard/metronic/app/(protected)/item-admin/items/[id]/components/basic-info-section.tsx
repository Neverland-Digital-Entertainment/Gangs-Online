'use client';

/**
 * Basic Info Section Component
 * Phase 16 - Item Module
 */

import { useState } from 'react';
import { Upload } from 'lucide-react';
import type { ItemFormData, ItemCategory } from '@/types/items';

const CATEGORY_OPTIONS: { value: ItemCategory; label: string; description: string }[] = [
  {
    value: 'consumable',
    label: '消耗品 (Consumables)',
    description: '恢復角色狀態的道具',
  },
  {
    value: 'special',
    label: '宗教道具 (Special Items)',
    description: '用於神打系統或特殊任務',
  },
  {
    value: 'contraband',
    label: '非法物資 (Contraband)',
    description: '走私與黑市貿易物品',
  },
  {
    value: 'material',
    label: '素材 (Materials)',
    description: '烹飪、製藥或縫紉系統材料',
  },
];

interface BasicInfoSectionProps {
  formData: ItemFormData;
  updateFormData: (updates: Partial<ItemFormData>) => void;
}

export function BasicInfoSection({
  formData,
  updateFormData,
}: BasicInfoSectionProps) {
  const [imagePreview, setImagePreview] = useState<string>(formData.imageUrl);

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file size (max 2MB)
      if (file.size > 2 * 1024 * 1024) {
        alert('Image size should be less than 2MB');
        return;
      }

      // Validate file type
      if (!file.type.startsWith('image/')) {
        alert('Please upload an image file');
        return;
      }

      updateFormData({ imageFile: file });

      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  }

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">基本資訊 (Basic Information)</h3>
      </div>
      <div className="card-body">
        <div className="flex flex-col gap-5">
          {/* Item Name */}
          <div>
            <label className="form-label required">道具名稱 (Item Name)</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => updateFormData({ name: e.target.value })}
              className="input"
              placeholder="輸入道具名稱"
              required
            />
          </div>

          {/* Item Description */}
          <div>
            <label className="form-label required">說明 (Description)</label>
            <textarea
              value={formData.description}
              onChange={(e) => updateFormData({ description: e.target.value })}
              className="textarea"
              rows={4}
              placeholder="輸入道具說明..."
              required
            />
            <span className="form-hint">支援多行文字</span>
          </div>

          {/* Category */}
          <div>
            <label className="form-label required">類別 (Category)</label>
            <select
              value={formData.category}
              onChange={(e) =>
                updateFormData({ category: e.target.value as ItemCategory })
              }
              className="select"
              required
            >
              {CATEGORY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <span className="form-hint">
              {
                CATEGORY_OPTIONS.find((opt) => opt.value === formData.category)
                  ?.description
              }
            </span>
          </div>

          {/* Image Upload */}
          <div>
            <label className="form-label">圖示 (Item Icon)</label>
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-4">
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="w-24 h-24 object-cover rounded-lg border"
                />
                <div className="flex-1">
                  <label
                    htmlFor="image-upload"
                    className="btn btn-light cursor-pointer"
                  >
                    <Upload className="w-4 h-4" />
                    上傳圖片
                  </label>
                  <input
                    id="image-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                  />
                  <p className="text-sm text-gray-600 mt-2">
                    建議尺寸: 128x128 像素 (最大 2MB)
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Active Status */}
          <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
            <input
              type="checkbox"
              id="isActive"
              checked={formData.isActive}
              onChange={(e) => updateFormData({ isActive: e.target.checked })}
              className="checkbox"
            />
            <div className="flex-1">
              <label htmlFor="isActive" className="form-label mb-0 cursor-pointer">
                啟用道具 (Active)
              </label>
              <p className="text-sm text-gray-600">
                設定道具是否可以在遊戲中出現
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
