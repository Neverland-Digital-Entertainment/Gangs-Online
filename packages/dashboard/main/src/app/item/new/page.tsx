'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Save, ArrowLeft } from 'lucide-react';
import { itemService } from '@/lib/item/service';
import { ItemCategory, type ItemFormData } from '@/types/item';
import { ItemImage } from '@/components/common/ItemImage';
import { BasicInfoSection } from '@/components/item/BasicInfoSection';
import { EconomicSection } from '@/components/item/EconomicSection';
import { AttributesSection } from '@/components/item/AttributesSection';

export default function NewItemPage() {
  const router = useRouter();
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
      console.log('🚀 開始新增道具...', formData);
      await itemService.createItem(formData);
      console.log('✅ 道具新增成功！');
      router.push('/item');
    } catch (err: any) {
      console.error('❌ 新增道具失敗:', err);

      // 提供更詳細的錯誤訊息
      let errorMessage = '新增失敗';

      if (err.message?.includes('Firebase')) {
        errorMessage = 'Firebase 連線失敗。請確認環境變數已正確設定。';
      } else if (err.message?.includes('ERR_BLOCKED_BY_CLIENT')) {
        errorMessage = '請求被瀏覽器阻擋。請檢查是否有廣告攔截器或防火牆擴充功能正在運作。';
      } else if (err.code === 'permission-denied') {
        errorMessage = 'Firebase 權限不足。請檢查 Firestore 安全規則。';
      } else if (err.code === 'unavailable') {
        errorMessage = 'Firebase 服務暫時無法使用。請稍後再試。';
      } else if (err.message) {
        errorMessage = err.message;
      }

      setError(errorMessage);

      // 在控制台輸出完整錯誤供除錯
      console.error('完整錯誤資訊:', {
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
            新增道具
          </h1>
          <div className="text-sm text-[var(--muted-foreground)]">
            建立新的遊戲道具
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => router.push('/item')}
            className="btn btn-light"
          >
            <ArrowLeft className="w-4 h-4" />
            返回
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
                    {saving ? '建立中...' : '建立道具'}
                  </button>
                  <button
                    type="button"
                    onClick={() => router.push('/item')}
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
                  <ItemImage
                    src={formData.imageUrl}
                    alt="Preview"
                    className="w-full aspect-square object-cover rounded-lg bg-gray-100 dark:bg-gray-800"
                  />
                  <div>
                    <h4 className="font-semibold text-[var(--foreground)]">
                      {formData.name || '未命名道具'}
                    </h4>
                    <p className="text-sm text-[var(--muted-foreground)] line-clamp-2">
                      {formData.description || '無說明'}
                    </p>
                  </div>
                  <div className="flex items-center justify-between text-sm pt-2 border-t border-[var(--border)]">
                    <span className="text-[var(--muted-foreground)]">價格</span>
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
