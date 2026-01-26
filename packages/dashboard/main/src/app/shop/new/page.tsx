'use client';

import Link from 'next/link';
import { useI18n } from '@/contexts/i18n-context';
import { ShopForm } from '@/components/shop/ShopForm';

export default function NewShopPage() {
  const { t } = useI18n();

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Link href="/shop" className="text-blue-600 hover:underline">
            {t('shop.title')}
          </Link>
          <span className="text-gray-400">/</span>
          <span className="text-gray-600">{t('shop.new')}</span>
        </div>
        <h1 className="text-3xl font-bold mb-2">{t('shop.create')}</h1>
        <p className="text-gray-600">{t('shop.newDescription')}</p>
      </div>

      {/* Form */}
      <ShopForm mode="create" />
    </div>
  );
}
