'use client';

/**
 * Item Admin Dashboard Content
 * Phase 16 - Item Module
 */

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Package, Plus, AlertCircle, TrendingUp, Archive } from 'lucide-react';
import { itemService } from '@/services/item-service';
import type { Item } from '@/types/items';

export function DashboardContent() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadItems();
  }, []);

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

  const totalItems = items.length;
  const activeItems = items.filter((item) => item.isActive).length;
  const inactiveItems = items.filter((item) => !item.isActive).length;
  const totalValue = items.reduce((sum, item) => sum + item.price, 0);

  return (
    <div className="container-fixed">
      <div className="flex flex-wrap items-center lg:items-end justify-between gap-5 pb-7.5">
        <div className="flex flex-col justify-center gap-2">
          <h1 className="text-xl font-semibold leading-none text-gray-900">
            Item Management Dashboard
          </h1>
          <div className="flex items-center gap-2 text-sm font-medium text-gray-600">
            Manage game items for Gangs Online
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <Link
            href="/item-admin/items"
            className="btn btn-sm btn-light"
          >
            View All Items
          </Link>
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
        </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-5 lg:gap-7.5">
          <div className="card">
            <div className="card-body">
              <div className="flex items-center gap-3.5">
                <div className="flex items-center justify-center size-12 rounded-lg bg-primary-light">
                  <Package className="w-6 h-6 text-primary" />
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-2xl font-semibold text-gray-900">
                    {totalItems}
                  </span>
                  <span className="text-sm text-gray-700">Total Items</span>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-body">
              <div className="flex items-center gap-3.5">
                <div className="flex items-center justify-center size-12 rounded-lg bg-success-light">
                  <TrendingUp className="w-6 h-6 text-success" />
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-2xl font-semibold text-gray-900">
                    {activeItems}
                  </span>
                  <span className="text-sm text-gray-700">Active Items</span>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-body">
              <div className="flex items-center gap-3.5">
                <div className="flex items-center justify-center size-12 rounded-lg bg-gray-100">
                  <Archive className="w-6 h-6 text-gray-600" />
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-2xl font-semibold text-gray-900">
                    {inactiveItems}
                  </span>
                  <span className="text-sm text-gray-700">Inactive Items</span>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-body">
              <div className="flex items-center gap-3.5">
                <div className="flex items-center justify-center size-12 rounded-lg bg-warning-light">
                  <span className="text-xl font-bold text-warning">$</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-2xl font-semibold text-gray-900">
                    {totalValue.toLocaleString()}
                  </span>
                  <span className="text-sm text-gray-700">Total Value</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 lg:gap-7.5 mt-5 lg:mt-7.5">
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Quick Actions</h3>
          </div>
          <div className="card-body">
            <div className="flex flex-col gap-4">
              <Link
                href="/item-admin/items/new"
                className="flex items-center gap-3 p-4 hover:bg-gray-50 rounded-lg transition"
              >
                <Plus className="w-5 h-5 text-primary" />
                <div>
                  <p className="font-medium text-gray-900">Create New Item</p>
                  <p className="text-sm text-gray-600">
                    Add a new item to the game database
                  </p>
                </div>
              </Link>
              <Link
                href="/item-admin/items"
                className="flex items-center gap-3 p-4 hover:bg-gray-50 rounded-lg transition"
              >
                <Package className="w-5 h-5 text-primary" />
                <div>
                  <p className="font-medium text-gray-900">Browse Items</p>
                  <p className="text-sm text-gray-600">
                    View and manage all game items
                  </p>
                </div>
              </Link>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Recent Items</h3>
          </div>
          <div className="card-body">
            {items.slice(0, 5).length > 0 ? (
              <div className="flex flex-col gap-3">
                {items.slice(0, 5).map((item) => (
                  <Link
                    key={item.id}
                    href={`/item-admin/items/${item.id}`}
                    className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg transition"
                  >
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="w-10 h-10 rounded object-cover"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">
                        {item.name}
                      </p>
                      <p className="text-sm text-gray-600">
                        ${item.price.toLocaleString()}
                      </p>
                    </div>
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded ${
                        item.isActive
                          ? 'bg-success-light text-success'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {item.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-600">No items yet</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
