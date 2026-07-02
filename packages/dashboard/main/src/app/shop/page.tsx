'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useI18n } from '@/contexts/i18n-context';
import { Can } from '@/components/auth/Can';
import { shopService } from '@/lib/shop/shop-service';
import type { Shop } from '@/types/shop';

export default function ShopListPage() {
  const { t } = useI18n();
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterActive, setFilterActive] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    loadShops();
  }, []);

  const loadShops = async () => {
    try {
      setLoading(true);
      const data = await shopService.getAllShops();
      setShops(data);
    } catch (error) {
      console.error('Failed to load shops:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    // Search is now handled by filteredShops
  };

  const handleDelete = async (shopId: string) => {
    if (!confirm(t('shop.deleteConfirm'))) {
      return;
    }

    try {
      await shopService.deleteShop(shopId);
      loadShops();
    } catch (error) {
      console.error('Failed to delete shop:', error);
      alert(t('error.deleteFailed'));
    }
  };

  const filteredShops = shops.filter((shop) => {
    // Apply search filter
    const matchesSearch =
      !searchQuery ||
      shop.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      shop.description?.toLowerCase().includes(searchQuery.toLowerCase());

    // Apply active status filter
    const matchesStatus =
      filterActive === undefined || shop.isActive === filterActive;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">{t('shop.title')}</h1>
        <p className="text-gray-600">{t('shop.subtitle')}</p>
      </div>

      {/* Actions Bar */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        {/* Search */}
        <div className="flex-1">
          <input
            type="text"
            placeholder={t('shop.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            className="input w-full"
          />
        </div>

        {/* Filter */}
        <select
          value={filterActive === undefined ? 'all' : filterActive ? 'active' : 'inactive'}
          onChange={(e) => {
            const value = e.target.value;
            setFilterActive(value === 'all' ? undefined : value === 'active');
          }}
          className="select w-auto"
        >
          <option value="all">{t('common.all')}</option>
          <option value="active">{t('common.active')}</option>
          <option value="inactive">{t('common.inactive')}</option>
        </select>

        {/* Create Button */}
        <Can perm="shop.edit">
          <Link href="/shop/new" className="btn btn-primary whitespace-nowrap">
            + {t('shop.create')}
          </Link>
        </Can>
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-center py-12">
          <div className="loading loading-lg"></div>
          <p className="mt-4 text-gray-600">{t('common.loading')}</p>
        </div>
      ) : filteredShops.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">🏪</div>
          <h3 className="text-xl font-semibold mb-2">
            {searchQuery ? t('shop.noMatchingShops') : t('shop.noShops')}
          </h3>
          {!searchQuery && (
            <Can perm="shop.edit">
              <Link href="/shop/new" className="btn btn-primary mt-4">
                {t('shop.createFirst')}
              </Link>
            </Can>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredShops.map((shop) => (
            <div key={shop.id} className="card hover:shadow-lg transition-shadow">
              <div className="card-body">
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="card-title mb-1">{shop.name}</h3>
                    {shop.description && (
                      <p className="text-sm text-gray-600 line-clamp-2">
                        {shop.description}
                      </p>
                    )}
                  </div>
                  <span
                    className={`badge ${
                      shop.isActive ? 'badge-success' : 'badge-secondary'
                    }`}
                  >
                    {t(shop.isActive ? 'common.active' : 'common.inactive')}
                  </span>
                </div>

                {/* Stats */}
                <div className="border-t pt-3 mb-3">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-gray-600">{t('shop.itemList')}:</span>
                      <span className="ml-1 font-semibold">{shop.itemList.length}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">{t('shop.operatingHours')}:</span>
                      <span className="ml-1 font-semibold">
                        {shop.operatingHours
                          ? `${shop.operatingHours.start}:00 - ${shop.operatingHours.end}:00`
                          : '24h'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <Can perm="shop.edit">
                  <div className="flex gap-2">
                    <Link
                      href={`/shop/edit?id=${shop.id}`}
                      className="btn btn-sm btn-primary flex-1"
                    >
                      {t('common.edit')}
                    </Link>
                    <button
                      onClick={() => handleDelete(shop.id)}
                      className="btn btn-sm btn-danger"
                    >
                      {t('common.delete')}
                    </button>
                  </div>
                </Can>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
