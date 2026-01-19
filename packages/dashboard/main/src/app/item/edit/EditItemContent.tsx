'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertCircle, Save, ArrowLeft } from 'lucide-react';
import { itemService } from '@/lib/item/service';
import { ItemCategory, type ItemFormData } from '@/types/item';
import { BasicInfoSection } from '@/components/item/BasicInfoSection';
import { EconomicSection } from '@/components/item/EconomicSection';
import { AttributesSection } from '@/components/item/AttributesSection';

export default function EditItemContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const itemId = searchParams.get('id');

  const [loading, setLoading] = useState(true);
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

  useEffect(() => {
    if (!itemId) {
      setError('缺少道具 ID');
      setLoading(false);
      return;
    }
    loadItem();
  }, [itemId]);

  async function loadItem() {
    if (!itemId) return;

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
        setError('找不到此道具');
      }
    } catch (err: any) {
      setError(err.message || '載入失敗');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!itemId) {
      setError('缺少道具 ID');
      return;
    }

    if (!formData.name.trim()) {
      setError('請輸入道具名稱');
      return;
    }

    if (formData.price < 0 || formData.sellPrice < 0) {
      setError('價格不能為負數');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      await itemService.updateItem(itemId, formData);
      router.push('/dashboard/item');
    } catch (err: any) {
      setError(err.message || '儲存失敗');
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
      <div className="container-fixed">
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  if (!itemId) {
    return (
      <div className="container-fixed">
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <p className="text-sm text-red-600">缺少道具 ID</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container-fixed">
      <div className="flex flex-wrap items-center lg:items-end justify-between gap-5 pb-7.5">
        <div className="flex flex-col justify-center gap-2">
          <h1 className="text-3xl font-bold leading-none text-gray-900">
            編輯道具
          </h1>
          <div className="text-sm text-gray-600">
            ID: {itemId}
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => router.push('/dashboard/item')}
            className="btn btn-light"
          >
            <ArrowLeft className="w-4 h-4" />
            返回
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
                <h3 className="card-title">操作</h3>
              </div>
              <div className="card-body">
                <div className="flex flex-col gap-3">
                  <button
                    type="submit"
                    disabled={saving}
                    className="btn btn-primary"
                  >
                    <Save className="w-4 h-4" />
                    {saving ? '儲存中...' : '儲存變更'}
                  </button>
                  <button
                    type="button"
                    onClick={() => router.push('/dashboard/item')}
                    className="btn btn-light"
                  >
                    取消
                  </button>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <h3 className="card-title">預覽</h3>
              </div>
              <div className="card-body">
                <div className="flex flex-col gap-3">
                  <img
                    src={formData.imageUrl}
                    alt="Preview"
                    className="w-full h-40 object-cover rounded-lg bg-gray-100"
                  />
                  <div>
                    <h4 className="font-semibold text-gray-900">
                      {formData.name || '未命名道具'}
                    </h4>
                    <p className="text-sm text-gray-600 line-clamp-2">
                      {formData.description || '無說明'}
                    </p>
                  </div>
                  <div className="flex items-center justify-between text-sm pt-2 border-t">
                    <span className="text-gray-600">價格</span>
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
