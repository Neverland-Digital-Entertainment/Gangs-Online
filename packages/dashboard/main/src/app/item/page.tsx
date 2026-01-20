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
import type { Item, ItemFilter, ItemCategory } from '@/types/item';

const CATEGORY_LABELS: Record<ItemCategory, string> = {
  consumable: '消耗品',
  special: '宗教道具',
  contraband: '非法物資',
  material: '素材',
};

export default function ItemsPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [filteredItems, setFilteredItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

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
          <h1 className="text-3xl font-bold leading-none text-gray-900">
            道具管理
          </h1>
          <div className="flex items-center gap-4 text-sm font-medium text-gray-600">
            <span className="flex items-center gap-1">
              <Package className="w-4 h-4" />
              總數: {totalItems}
            </span>
            <span className="text-success">啟用: {activeItems}</span>
            <span className="text-gray-500">停用: {totalItems - activeItems}</span>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="btn-group">
            <button
              onClick={() => setViewMode('grid')}
              className={`btn btn-sm ${viewMode === 'grid' ? 'btn-primary' : 'btn-light'}`}
              title="網格檢視"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`btn btn-sm ${viewMode === 'list' ? 'btn-primary' : 'btn-light'}`}
              title="列表檢視"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
          <Link href="/item/new" className="btn btn-primary">
            <Plus className="w-4 h-4" />
            新增道具
          </Link>
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

      <div className="card mb-5">
        <div className="card-header flex items-center gap-2">
          <Filter className="w-4 h-4" />
          <h3 className="card-title">篩選條件</h3>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                placeholder="搜尋名稱或 ID..."
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
              <option value="">所有分類</option>
              {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
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
              <option value="">所有狀態</option>
              <option value="active">啟用</option>
              <option value="inactive">停用</option>
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="card">
          <div className="card-body text-center py-20">
            <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 mb-4">尚無道具</p>
            <Link href="/item/new" className="btn btn-primary inline-flex">
              <Plus className="w-4 h-4" />
              新增第一個道具
            </Link>
          </div>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filteredItems.map((item) => (
            <div key={item.id} className="card hover:shadow-md transition-shadow">
              <div className="card-body p-4">
                <div className="flex flex-col gap-3">
                  <div className="relative">
                    <ItemImage
                      src={item.imageUrl}
                      alt={item.name}
                      className="w-full h-40 object-cover rounded-lg bg-gray-100"
                    />
                    <span
                      className={`absolute top-2 right-2 px-2 py-1 text-xs font-medium rounded shadow ${
                        item.isActive
                          ? 'bg-green-500 text-white'
                          : 'bg-gray-500 text-white'
                      }`}
                    >
                      {item.isActive ? '啟用' : '停用'}
                    </span>
                  </div>

                  <div>
                    <h4 className="font-semibold text-gray-900 truncate">
                      {item.name}
                    </h4>
                    <p className="text-xs text-gray-500 truncate">
                      ID: {item.id}
                    </p>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 text-xs">
                      {CATEGORY_LABELS[item.category]}
                    </span>
                    <span className="font-semibold text-primary">
                      ${item.price.toLocaleString()}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t">
                    <Link
                      href={`/item/edit?id=${item.id}`}
                      className="btn btn-sm btn-light flex-1"
                    >
                      <Edit className="w-3 h-3" />
                      編輯
                    </Link>
                    <button
                      onClick={() => handleDuplicate(item.id)}
                      className="btn btn-sm btn-light"
                      title="複製"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                    {deleteConfirm === item.id ? (
                      <>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="btn btn-sm btn-danger"
                          title="確認刪除"
                        >
                          ✓
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(null)}
                          className="btn btn-sm btn-light"
                          title="取消"
                        >
                          ✕
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirm(item.id)}
                        className="btn btn-sm btn-light hover:bg-red-50"
                        title="刪除"
                      >
                        <Trash2 className="w-3 h-3 text-danger" />
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
                <tr className="bg-gray-50 border-b">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    圖片
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    名稱
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    分類
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    價格
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    狀態
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <ItemImage
                        src={item.imageUrl}
                        alt={item.name}
                        className="w-12 h-12 object-cover rounded bg-gray-100"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <div className="font-medium text-gray-900">{item.name}</div>
                        <div className="text-xs text-gray-500">ID: {item.id}</div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {CATEGORY_LABELS[item.category]}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-primary">
                      ${item.price.toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded ${
                          item.isActive
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {item.isActive ? '啟用' : '停用'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/item/edit?id=${item.id}`}
                          className="btn btn-sm btn-light"
                          title="編輯"
                        >
                          <Edit className="w-3 h-3" />
                        </Link>
                        <button
                          onClick={() => handleDuplicate(item.id)}
                          className="btn btn-sm btn-light"
                          title="複製"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                        {deleteConfirm === item.id ? (
                          <>
                            <button
                              onClick={() => handleDelete(item.id)}
                              className="btn btn-sm btn-danger"
                              title="確認刪除"
                            >
                              ✓
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(null)}
                              className="btn btn-sm btn-light"
                              title="取消"
                            >
                              ✕
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirm(item.id)}
                            className="btn btn-sm btn-light hover:bg-red-50"
                            title="刪除"
                          >
                            <Trash2 className="w-3 h-3 text-danger" />
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
