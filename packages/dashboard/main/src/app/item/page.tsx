'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Plus,
  Search,
  Filter,
  Edit,
  Trash2,
  Copy,
  AlertCircle,
  Package,
  LayoutGrid,
  List,
} from 'lucide-react';
import { itemService } from '@/lib/item/service';
import { ItemImage } from '@/components/common/ItemImage';
import { useI18n } from '@/contexts/i18n-context';
import { getCategoryTranslationKey, getAllCategories } from '@/lib/item-helpers';
import type { Item, ItemFilter, ItemCategory } from '@/types/item';

export default function ItemsPage() {
  const { t } = useI18n();

  // Category labels with i18n support
  const getCategoryLabel = (category: ItemCategory): string => {
    return t(getCategoryTranslationKey(category));
  };
  const [items, setItems] = useState<Item[]>([]);
  const [filteredItems, setFilteredItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');

  const [filter, setFilter] = useState<ItemFilter>({
    search: '',
    category: undefined,
    isActive: undefined,
  });

  useEffect(() => {
    loadItems();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [items, filter]);

  async function loadItems() {
    try {
      setLoading(true);
      const fetchedItems = await itemService.getItems();
      setItems(fetchedItems);
    } catch (err: any) {
      setError(err.message || 'Failed to load items');
    } finally {
      setLoading(false);
    }
  }

  function applyFilters() {
    let filtered = [...items];

    if (filter.search) {
      const searchLower = filter.search.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          item.name.toLowerCase().includes(searchLower) ||
          item.id.toLowerCase().includes(searchLower)
      );
    }

    if (filter.category) {
      filtered = filtered.filter((item) => item.category === filter.category);
    }

    if (filter.isActive !== undefined) {
      filtered = filtered.filter((item) => item.isActive === filter.isActive);
    }

    setFilteredItems(filtered);
  }

  async function handleDelete(itemId: string) {
    try {
      await itemService.deleteItem(itemId);
      setItems((prevItems) => prevItems.filter((item) => item.id !== itemId));
      setDeleteConfirm(null);
    } catch (err: any) {
      setError(err.message || 'Failed to delete item');
    }
  }

  async function handleDuplicate(itemId: string) {
    try {
      await itemService.duplicateItem(itemId);
      await loadItems();
    } catch (err: any) {
      setError(err.message || 'Failed to duplicate item');
    }
  }

  const totalItems = items.length;
  const activeItems = items.filter((item) => item.isActive).length;

  return (
    <div className="container-fixed">
      <div className="flex flex-wrap items-center lg:items-end justify-between gap-5 pb-7.5">
        <div className="flex flex-col justify-center gap-2">
          <h1 className="text-3xl font-bold leading-none text-[var(--foreground)]">
            {t('item.title')}
          </h1>
          <div className="flex items-center gap-4 text-sm font-medium text-[var(--muted-foreground)]">
            <span className="flex items-center gap-1">
              <Package className="w-4 h-4" />
              {t('common.total')}: {totalItems}
            </span>
            <span className="text-green-600 dark:text-green-400">{t('common.active')}: {activeItems}</span>
            <span className="text-[var(--muted)]">{t('common.inactive')}: {totalItems - activeItems}</span>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="btn-group">
            <button
              onClick={() => setViewMode('grid')}
              className={`btn btn-sm ${viewMode === 'grid' ? 'btn-primary' : 'btn-light'}`}
              title={t('common.view')}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`btn btn-sm ${viewMode === 'list' ? 'btn-primary' : 'btn-light'}`}
              title={t('common.view')}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
          <Link href="/item/new" className="btn btn-primary">
            <Plus className="w-4 h-4" />
            {t('item.create')}
          </Link>
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

      <div className="card mb-5">
        <div className="card-header flex items-center gap-2">
          <Filter className="w-4 h-4" />
          <h3 className="card-title">{t('common.filter')}</h3>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted)]" />
              <input
                type="text"
                placeholder={t('item.searchPlaceholder')}
                value={filter.search || ''}
                onChange={(e) =>
                  setFilter({ ...filter, search: e.target.value })
                }
                className="input pl-10"
              />
            </div>

            <select
              value={filter.category || ''}
              onChange={(e) =>
                setFilter({
                  ...filter,
                  category: e.target.value
                    ? (e.target.value as ItemCategory)
                    : undefined,
                })
              }
              className="select"
            >
              <option value="">{t('item.filterByCategory')}</option>
              {getAllCategories().map((category) => (
                <option key={category} value={category}>
                  {getCategoryLabel(category)}
                </option>
              ))}
            </select>

            <select
              value={
                filter.isActive === undefined
                  ? ''
                  : filter.isActive
                    ? 'active'
                    : 'inactive'
              }
              onChange={(e) =>
                setFilter({
                  ...filter,
                  isActive:
                    e.target.value === ''
                      ? undefined
                      : e.target.value === 'active',
                })
              }
              className="select"
            >
              <option value="">{t('item.filterByStatus')}</option>
              <option value="active">{t('common.active')}</option>
              <option value="inactive">{t('common.inactive')}</option>
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--primary)]"></div>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="card">
          <div className="card-body text-center py-20">
            <Package className="w-16 h-16 text-[var(--muted)] mx-auto mb-4" />
            <p className="text-[var(--muted-foreground)] mb-4">
              {items.length === 0 ? t('item.noItems') : t('item.noMatchingItems')}
            </p>
            <Link href="/item/new" className="btn btn-primary inline-flex">
              <Plus className="w-4 h-4" />
              {t('item.createFirst')}
            </Link>
          </div>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filteredItems.map((item) => (
            <div key={item.id} className="card hover:shadow-md transition-shadow">
              <div className="card-body p-4">
                <div className="flex flex-col gap-3">
                  <div className="relative aspect-square">
                    <ItemImage
                      src={item.imageUrl}
                      alt={item.name}
                      className="w-full h-full object-cover rounded-lg bg-gray-100 dark:bg-gray-800"
                    />
                    <span
                      className={`absolute top-2 right-2 px-2 py-1 text-xs font-medium rounded shadow ${
                        item.isActive
                          ? 'bg-green-500 text-white'
                          : 'bg-gray-500 text-white'
                      }`}
                    >
                      {item.isActive ? t('common.active') : t('common.inactive')}
                    </span>
                  </div>

                  <div>
                    <h4 className="font-semibold text-[var(--foreground)] truncate">
                      {item.name}
                    </h4>
                    <p className="text-xs text-[var(--muted)] truncate">
                      ID: {item.id}
                    </p>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[var(--muted-foreground)] text-xs">
                      {getCategoryLabel(item.category)}
                    </span>
                    <span className="font-semibold text-[var(--primary)]">
                      ${item.price.toLocaleString()}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-[var(--border)]">
                    <Link
                      href={`/item/edit?id=${item.id}`}
                      className="btn btn-sm btn-light flex-1"
                    >
                      <Edit className="w-3 h-3" />
                      {t('common.edit')}
                    </Link>
                    <button
                      onClick={() => handleDuplicate(item.id)}
                      className="btn btn-sm btn-light"
                      title={t('common.create')}
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                    {deleteConfirm === item.id ? (
                      <>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="btn btn-sm btn-danger"
                          title={t('common.confirm')}
                        >
                          ✓
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(null)}
                          className="btn btn-sm btn-light"
                          title={t('common.cancel')}
                        >
                          ✕
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirm(item.id)}
                        className="btn btn-sm btn-light hover:bg-red-50 dark:hover:bg-red-900/20"
                        title={t('common.delete')}
                      >
                        <Trash2 className="w-3 h-3 text-red-500" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card">
          <div className="overflow-x-auto">
            <table className="table-auto w-full">
              <thead>
                <tr className="bg-[var(--table-header)] border-b border-[var(--border)]">
                  <th className="px-3 py-3 text-left text-xs font-medium text-[var(--muted)] uppercase w-16">
                    {t('item.imageUrl')}
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-[var(--muted)] uppercase">
                    {t('common.name')} / {t('common.description')}
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-[var(--muted)] uppercase w-24">
                    {t('common.type')}
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-[var(--muted)] uppercase w-24">
                    {t('common.price')}
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-[var(--muted)] uppercase w-20">
                    {t('common.status')}
                  </th>
                  <th className="px-3 py-3 text-right text-xs font-medium text-[var(--muted)] uppercase w-32">
                    {t('common.actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {filteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-[var(--table-hover)]">
                    <td className="px-3 py-2 w-16">
                      <ItemImage
                        src={item.imageUrl}
                        alt={item.name}
                        className="w-10 h-10 object-cover rounded bg-gray-100 dark:bg-gray-800"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <div>
                        <div className="font-medium text-[var(--foreground)]">{item.name}</div>
                        <div className="text-xs text-[var(--muted)] truncate max-w-md">
                          {item.description || `ID: ${item.id}`}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-sm text-[var(--muted-foreground)] w-24">
                      {getCategoryLabel(item.category)}
                    </td>
                    <td className="px-3 py-2 text-sm font-medium text-[var(--primary)] w-24">
                      ${item.price.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 w-20">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded ${
                          item.isActive
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
                        }`}
                      >
                        {item.isActive ? t('common.active') : t('common.inactive')}
                      </span>
                    </td>
                    <td className="px-3 py-2 w-32">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/item/edit?id=${item.id}`}
                          className="btn btn-sm btn-light"
                          title={t('common.edit')}
                        >
                          <Edit className="w-3 h-3" />
                        </Link>
                        <button
                          onClick={() => handleDuplicate(item.id)}
                          className="btn btn-sm btn-light"
                          title={t('common.create')}
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                        {deleteConfirm === item.id ? (
                          <>
                            <button
                              onClick={() => handleDelete(item.id)}
                              className="btn btn-sm btn-danger"
                              title={t('common.confirm')}
                            >
                              ✓
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(null)}
                              className="btn btn-sm btn-light"
                              title={t('common.cancel')}
                            >
                              ✕
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirm(item.id)}
                            className="btn btn-sm btn-light hover:bg-red-50 dark:hover:bg-red-900/20"
                            title={t('common.delete')}
                          >
                            <Trash2 className="w-3 h-3 text-red-500" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
