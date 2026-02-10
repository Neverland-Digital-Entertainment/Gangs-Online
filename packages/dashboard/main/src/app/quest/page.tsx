'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Plus, Search, Trash2, Edit, Power, PowerOff, ScrollText } from 'lucide-react';
import { useI18n } from '@/contexts/i18n-context';
import { QuestBlueprintService } from '@/lib/quest/quest-service';
import type { QuestBlueprint } from '@/types/quest';

export default function QuestListPage() {
  const { t } = useI18n();
  const [blueprints, setBlueprints] = useState<QuestBlueprint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterActive, setFilterActive] = useState<string>('all');

  const loadBlueprints = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const service = QuestBlueprintService.getInstance();
      const data = await service.getAllBlueprints();
      setBlueprints(data);
    } catch (err) {
      console.error('Failed to load quest blueprints:', err);
      setError(t('error.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadBlueprints();
  }, [loadBlueprints]);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`${t('quest.deleteConfirm')}: ${name}?`)) return;

    try {
      const service = QuestBlueprintService.getInstance();
      await service.deleteBlueprint(id);
      setBlueprints((prev) => prev.filter((b) => b.id !== id));
    } catch (err) {
      console.error('Failed to delete quest blueprint:', err);
      alert(t('error.deleteFailed'));
    }
  };

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    try {
      const service = QuestBlueprintService.getInstance();
      await service.toggleActive(id, !currentActive);
      setBlueprints((prev) =>
        prev.map((b) => (b.id === id ? { ...b, isActive: !currentActive } : b))
      );
    } catch (err) {
      console.error('Failed to toggle active:', err);
    }
  };

  const filtered = blueprints.filter((b) => {
    const matchSearch =
      !search ||
      b.name.toLowerCase().includes(search.toLowerCase()) ||
      (b.description || '').toLowerCase().includes(search.toLowerCase());

    const matchActive =
      filterActive === 'all' ||
      (filterActive === 'active' && b.isActive) ||
      (filterActive === 'inactive' && !b.isActive);

    return matchSearch && matchActive;
  });

  return (
    <div className="container-fixed">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-[var(--foreground)]">
            {t('quest.title')}
          </h1>
          <p className="text-[var(--muted-foreground)] mt-1">
            {t('quest.subtitle')}
          </p>
        </div>
        <Link
          href="/quest/edit"
          className="btn btn-primary inline-flex items-center gap-2 whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          {t('quest.create')}
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted)]" />
          <input
            type="text"
            className="input pl-10 w-full"
            placeholder={t('quest.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="input w-auto"
          value={filterActive}
          onChange={(e) => setFilterActive(e.target.value)}
        >
          <option value="all">{t('common.all')}</option>
          <option value="active">{t('common.active')}</option>
          <option value="inactive">{t('common.inactive')}</option>
        </select>
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-center py-12 text-[var(--muted)]">
          {t('common.loading')}
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <p className="text-red-500 mb-4">{error}</p>
          <button onClick={loadBlueprints} className="btn btn-light">
            {t('common.retry')}
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <ScrollText className="w-16 h-16 mx-auto text-[var(--muted)] mb-4" />
          <p className="text-[var(--muted-foreground)] mb-4">
            {blueprints.length === 0
              ? t('quest.noBlueprints')
              : t('quest.noMatchingBlueprints')}
          </p>
          {blueprints.length === 0 && (
            <Link href="/quest/edit" className="btn btn-primary">
              {t('quest.createFirst')}
            </Link>
          )}
        </div>
      ) : (
        <div className="grid gap-4">
          {filtered.map((blueprint) => (
            <div
              key={blueprint.id}
              className="card"
            >
              <div className="card-body flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-lg font-semibold text-[var(--foreground)] truncate">
                      {blueprint.name}
                    </h3>
                    <span
                      className={`text-xs px-2 py-0.5 rounded ${
                        blueprint.isActive
                          ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                          : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                      }`}
                    >
                      {blueprint.isActive ? t('common.active') : t('common.inactive')}
                    </span>
                  </div>
                  {blueprint.description && (
                    <p className="text-sm text-[var(--muted-foreground)] truncate">
                      {blueprint.description}
                    </p>
                  )}
                  <div className="flex items-center gap-4 mt-2 text-xs text-[var(--muted)]">
                    <span>
                      {t('quest.nodeCount')}: {blueprint.nodes.length}
                    </span>
                    <span>
                      {t('quest.edgeCount')}: {blueprint.edges.length}
                    </span>
                    <span>
                      {t('quest.updatedAt')}: {blueprint.updatedAt.toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleToggleActive(blueprint.id, blueprint.isActive)}
                    className="btn btn-light p-2"
                    title={blueprint.isActive ? t('common.disable') : t('common.enable')}
                  >
                    {blueprint.isActive ? (
                      <PowerOff className="w-4 h-4" />
                    ) : (
                      <Power className="w-4 h-4" />
                    )}
                  </button>
                  <Link
                    href={`/quest/edit?id=${blueprint.id}`}
                    className="btn btn-light p-2"
                    title={t('common.edit')}
                  >
                    <Edit className="w-4 h-4" />
                  </Link>
                  <button
                    onClick={() => handleDelete(blueprint.id, blueprint.name)}
                    className="btn btn-light p-2"
                    title={t('common.delete')}
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
