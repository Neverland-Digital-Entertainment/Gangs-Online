'use client';

/**
 * Item Editor Content Component
 * Phase 16 - Item Module
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Save, ArrowLeft, Upload } from 'lucide-react';
import { itemService } from '@/services/item-service';
import type { Item, ItemFormData, ItemCategory } from '@/types/items';
import { BasicInfoSection } from './components/basic-info-section';
import { EconomicSection } from './components/economic-section';
import { AttributesSection } from './components/attributes-section';

interface ItemEditorContentProps {
  itemId: string;
}

export function ItemEditorContent({ itemId }: ItemEditorContentProps) {
  const router = useRouter();
  const isNew = itemId === 'new';

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<ItemFormData>({
    name: '',
    description: '',
    category: 'consumable' as ItemCategory,
    imageUrl: '/images/no-image.png',
    price: 0,
    sellPrice: 0,
    isTradeable: true,
    isDroppable: true,
    isActive: false,
    attributes: {},
  });

  useEffect(() => {
    if (!isNew) {
      loadItem();
    }
  }, [itemId, isNew]);

  async function loadItem() {
    try {
      setLoading(true);
      const item = await itemService.getItem(itemId);
      if (item) {
        setFormData({
          name: item.name,
          description: item.description,
          category: item.category,
          imageUrl: item.imageUrl,
          price: item.price,
          sellPrice: item.sellPrice,
          isTradeable: item.isTradeable,
          isDroppable: item.isDroppable,
          isActive: item.isActive,
          attributes: item.attributes,
        });
      } else {
        setError('Item not found');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load item');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Validation
    if (!formData.name.trim()) {
      setError('Item name is required');
      return;
    }

    if (formData.price < 0 || formData.sellPrice < 0) {
      setError('Prices cannot be negative');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      if (isNew) {
        const newId = await itemService.createItem(formData);
        router.push(`/item-admin/items/${newId}`);
      } else {
        await itemService.updateItem(itemId, formData);
      }

      router.push('/item-admin/items');
    } catch (err: any) {
      setError(err.message || 'Failed to save item');
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

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="container-fixed">
      <div className="flex flex-wrap items-center lg:items-end justify-between gap-5 pb-7.5">
        <div className="flex flex-col justify-center gap-2">
          <h1 className="text-xl font-semibold leading-none text-gray-900">
            {isNew ? 'Create New Item' : 'Edit Item'}
          </h1>
          <div className="flex items-center gap-2 text-sm font-medium text-gray-600">
            {!isNew && `ID: ${itemId}`}
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => router.back()}
            className="btn btn-sm btn-light"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-5 flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <p className="text-sm text-red-600">{error}</p>
          <button
            onClick={() => setError(null)}
            className="ml-auto text-red-600 hover:text-red-800"
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
                <h3 className="card-title">Actions</h3>
              </div>
              <div className="card-body">
                <div className="flex flex-col gap-3">
                  <button
                    type="submit"
                    disabled={saving}
                    className="btn btn-primary"
                  >
                    <Save className="w-4 h-4" />
                    {saving ? 'Saving...' : isNew ? 'Create Item' : 'Save Changes'}
                  </button>
                  <button
                    type="button"
                    onClick={() => router.back()}
                    className="btn btn-light"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Item Preview</h3>
              </div>
              <div className="card-body">
                <div className="flex flex-col gap-3">
                  <img
                    src={formData.imageUrl}
                    alt="Preview"
                    className="w-full h-40 object-cover rounded-lg"
                  />
                  <div>
                    <h4 className="font-semibold text-gray-900">
                      {formData.name || 'Untitled Item'}
                    </h4>
                    <p className="text-sm text-gray-600 line-clamp-2">
                      {formData.description || 'No description'}
                    </p>
                  </div>
                  <div className="flex items-center justify-between text-sm pt-2 border-t">
                    <span className="text-gray-600">Price</span>
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
