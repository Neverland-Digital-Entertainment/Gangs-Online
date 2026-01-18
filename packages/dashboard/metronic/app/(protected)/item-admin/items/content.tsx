'use client';

/**
 * Item List Content Component
 * Phase 16 - Item Module
 */

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
} from 'lucide-react';
import { itemService } from '@/services/item-service';
import type { Item, ItemFilter, ItemCategory } from '@/types/items';

const CATEGORY_LABELS: Record<ItemCategory, string> = {
  consumable: '消耗品',
  special: '宗教道具',
  contraband: '非法物資',
  material: '素材',
};

export function ItemListContent() {
  const [items, setItems] = useState<Item[]>([]);
  const [filteredItems, setFilteredItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

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
      setItems(items.filter((item) => item.id !== itemId));
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

  return (
    <div className="container-fixed">
      <div className="flex flex-wrap items-center lg:items-end justify-between gap-5 pb-7.5">
        <div className="flex flex-col justify-center gap-2">
          <h1 className="text-xl font-semibold leading-none text-gray-900">
            All Items
          </h1>
          <div className="flex items-center gap-2 text-sm font-medium text-gray-600">
            {filteredItems.length} items found
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <Link
            href="/item-admin/items/new"
            className="btn btn-sm btn-primary"
          >
            <Plus className="w-4 h-4" />
            Add New Item
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

      <div className="card">
        <div className="card-header gap-2">
          <h3 className="card-title">
            <Filter className="w-4 h-4" />
            Filters
          </h3>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                placeholder="Search by name or ID..."
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
              <option value="">All Categories</option>
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
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="card mt-5">
          <div className="card-body text-center py-20">
            <p className="text-gray-600">No items found</p>
            <Link
              href="/item-admin/items/new"
              className="btn btn-primary mt-4 inline-flex"
            >
              <Plus className="w-4 h-4" />
              Create First Item
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 mt-5">
          {filteredItems.map((item) => (
            <div key={item.id} className="card">
              <div className="card-body p-4">
                <div className="flex flex-col gap-3">
                  <div className="relative">
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="w-full h-40 object-cover rounded-lg"
                    />
                    <span
                      className={`absolute top-2 right-2 px-2 py-1 text-xs font-medium rounded ${
                        item.isActive
                          ? 'bg-success text-white'
                          : 'bg-gray-500 text-white'
                      }`}
                    >
                      {item.isActive ? 'Active' : 'Inactive'}
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
                    <span className="text-gray-600">
                      {CATEGORY_LABELS[item.category]}
                    </span>
                    <span className="font-semibold text-primary">
                      ${item.price.toLocaleString()}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t">
                    <Link
                      href={`/item-admin/items/${item.id}`}
                      className="btn btn-sm btn-light flex-1"
                    >
                      <Edit className="w-3 h-3" />
                      Edit
                    </Link>
                    <button
                      onClick={() => handleDuplicate(item.id)}
                      className="btn btn-sm btn-light"
                      title="Duplicate"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                    {deleteConfirm === item.id ? (
                      <>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="btn btn-sm btn-danger"
                          title="Confirm Delete"
                        >
                          ✓
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(null)}
                          className="btn btn-sm btn-light"
                          title="Cancel"
                        >
                          ✕
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirm(item.id)}
                        className="btn btn-sm btn-light"
                        title="Delete"
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
      )}
    </div>
  );
}
