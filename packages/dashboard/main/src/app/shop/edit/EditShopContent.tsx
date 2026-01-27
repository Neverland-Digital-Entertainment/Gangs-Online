'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useI18n } from '@/contexts/i18n-context';
import { shopService } from '@/lib/shop/shop-service';
import { ShopForm } from '@/components/shop/ShopForm';
import type { Shop } from '@/types/shop';

export default function EditShopContent() {
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get('id');

  const [shop, setShop] = useState<Shop | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      loadShop();
    } else {
      setError(t('shop.missingId'));
      setLoading(false);
    }
  }, [id]);

  const loadShop = async () => {
    if (!id) return;

    try {
      setLoading(true);
      setError(null);
      const data = await shopService.getShopById(id);

      if (!data) {
        setError(t('shop.notFound'));
        return;
      }

      setShop(data);
    } catch (err: any) {
      console.error('Failed to load shop:', err);
      setError(err.message || t('shop.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <div className="loading loading-lg"></div>
          <p className="mt-4 text-gray-600">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  if (error || !shop) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="alert alert-error">
          <span>{error || t('shop.notFound')}</span>
        </div>
        <Link href="/shop" className="btn btn-secondary mt-4">
          {t('shop.backToList')}
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Link href="/shop" className="text-blue-600 hover:underline">
            {t('shop.title')}
          </Link>
          <span className="text-gray-400">/</span>
          <span className="text-gray-600">{shop.name}</span>
        </div>
        <h1 className="text-3xl font-bold mb-2">{t('shop.edit')}</h1>
        <p className="text-gray-600">
          {t('common.name')}: {shop.name}
        </p>
      </div>

      {/* Form */}
      <ShopForm shop={shop} mode="edit" />
    </div>
  );
}
