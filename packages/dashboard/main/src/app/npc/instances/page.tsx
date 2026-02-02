'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Plus,
  Search,
  Edit,
  Trash2,
  AlertCircle,
  MapPin,
  Target,
} from 'lucide-react';
import { npcInstanceService } from '@/lib/npc/instance-service';
import { npcTemplateService } from '@/lib/npc/template-service';
import { useI18n } from '@/contexts/i18n-context';
import type {
  NpcInstance,
  NpcInstanceFilter,
  NpcTemplate,
  MovementPattern,
} from '@/types/npc';

export default function InstancesPage() {
  const { t } = useI18n();
  const [instances, setInstances] = useState<NpcInstance[]>([]);
  const [filteredInstances, setFilteredInstances] = useState<NpcInstance[]>([]);
  const [templates, setTemplates] = useState<NpcTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const [filter, setFilter] = useState<NpcInstanceFilter>({
    search: '',
    templateId: undefined,
    movementPattern: undefined,
    isActive: undefined,
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [instances, filter]);

  async function loadData() {
    try {
      setLoading(true);
      setError(null);
      const [instancesData, templatesData] = await Promise.all([
        npcInstanceService.getAllInstances(undefined, true),
        npcTemplateService.getAllTemplates(),
      ]);
      setInstances(instancesData);
      setTemplates(templatesData);
    } catch (err) {
      console.error('載入 NPC 實例失敗:', err);
      setError(t('error.loadFailed'));
    } finally {
      setLoading(false);
    }
  }

  function applyFilters() {
    let result = [...instances];

    // Search filter
    if (filter.search) {
      const searchLower = filter.search.toLowerCase();
      result = result.filter(
        (instance) =>
          instance.template?.name.toLowerCase().includes(searchLower) ||
          instance.mapId?.toLowerCase().includes(searchLower) ||
          instance.territoryId?.toLowerCase().includes(searchLower)
      );
    }

    // Template filter
    if (filter.templateId) {
      result = result.filter(
        (instance) => instance.templateId === filter.templateId
      );
    }

    // Movement pattern filter
    if (filter.movementPattern) {
      result = result.filter(
        (instance) => instance.movementPattern === filter.movementPattern
      );
    }

    // Status filter
    if (filter.isActive !== undefined) {
      result = result.filter((instance) => instance.isActive === filter.isActive);
    }

    setFilteredInstances(result);
  }

  async function handleDelete(id: string) {
    try {
      await npcInstanceService.deleteInstance(id);
      setInstances(instances.filter((i) => i.id !== id));
      setDeleteConfirm(null);
    } catch (err) {
      console.error('刪除 NPC 實例失敗:', err);
      alert(t('error.deleteFailed'));
    }
  }

  async function handleToggleStatus(id: string, currentStatus: boolean) {
    try {
      await npcInstanceService.toggleInstanceStatus(id, !currentStatus);
      setInstances(
        instances.map((i) =>
          i.id === id ? { ...i, isActive: !currentStatus } : i
        )
      );
    } catch (err) {
      console.error('切換狀態失敗:', err);
      alert(t('error.saveFailed'));
    }
  }

  if (loading) {
    return (
      <div className="container-fixed">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-[var(--muted-foreground)]">{t('common.loading')}</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container-fixed">
        <div className="card bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
          <div className="card-body">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-red-900 dark:text-red-100 mb-1">
                  {t('npc.instance.loadFailed')}
                </h3>
                <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
                <button
                  onClick={loadData}
                  className="btn btn-sm btn-outline mt-3"
                >
                  {t('error.reload')}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container-fixed">
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[var(--foreground)] mb-2">
            {t('npc.instances.title')}
          </h1>
          <p className="text-[var(--muted-foreground)]">
            {t('common.total')} {filteredInstances.length} {t('common.items')}
          </p>
        </div>
        <Link href="/npc/instances/new">
          <button className="btn btn-primary">
            <Plus className="w-4 h-4 mr-2" />
            {t('npc.instances.create')}
          </button>
        </Link>
      </div>

      {/* Filters */}
      <div className="card mb-6">
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div>
              <label className="label">{t('common.search')}</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder={t('npc.instances.searchPlaceholder')}
                  className="input pl-10"
                  value={filter.search}
                  onChange={(e) =>
                    setFilter({ ...filter, search: e.target.value })
                  }
                />
              </div>
            </div>

            {/* Template Filter */}
            <div>
              <label className="label">{t('npc.instance.templateSelection')}</label>
              <select
                className="input"
                value={filter.templateId || ''}
                onChange={(e) =>
                  setFilter({ ...filter, templateId: e.target.value || undefined })
                }
              >
                <option value="">{t('common.all')}</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Movement Pattern Filter */}
            <div>
              <label className="label">{t('npc.instance.movementPattern')}</label>
              <select
                className="input"
                value={filter.movementPattern || ''}
                onChange={(e) =>
                  setFilter({
                    ...filter,
                    movementPattern: e.target.value as MovementPattern || undefined,
                  })
                }
              >
                <option value="">{t('common.all')}</option>
                {(['STATIC', 'WANDERING', 'PATROLLING'] as const).map((pattern) => (
                  <option key={pattern} value={pattern}>
                    {t(`npc.movementPattern.${pattern}`)}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <label className="label">{t('common.status')}</label>
              <select
                className="input"
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
              >
                <option value="">{t('common.all')}</option>
                <option value="active">{t('common.active')}</option>
                <option value="inactive">{t('common.inactive')}</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Instances List */}
      {filteredInstances.length === 0 ? (
        <div className="card">
          <div className="card-body text-center py-12">
            <MapPin className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-[var(--muted-foreground)] mb-4">
              {instances.length === 0
                ? t('npc.instances.noInstances')
                : t('npc.instances.noMatchingInstances')}
            </p>
            {instances.length === 0 && (
              <Link href="/npc/instances/new">
                <button className="btn btn-primary">
                  <Plus className="w-4 h-4 mr-2" />
                  {t('npc.instances.createFirst')}
                </button>
              </Link>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredInstances.map((instance) => (
            <div key={instance.id} className="card hover:shadow-md transition-shadow">
              <div className="card-body">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-semibold text-[var(--foreground)] truncate">
                        {instance.template?.name || t('npc.instance.notFound')}
                      </h3>
                      <span className="badge badge-primary flex-shrink-0">
                        Lv.{instance.level}
                      </span>
                      <span className="badge badge-gray flex-shrink-0">
                        {t(`npc.movementPattern.${instance.movementPattern}`)}
                      </span>
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded shadow flex-shrink-0 ${
                          instance.isActive
                            ? 'bg-green-500 text-white'
                            : 'bg-gray-500 text-white'
                        }`}
                      >
                        {instance.isActive ? t('common.active') : t('common.inactive')}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-4 text-sm text-[var(--muted-foreground)]">
                      <div className="flex items-center gap-1">
                        <MapPin className="w-4 h-4" />
                        {t('npc.instance.position')}: ({instance.positionX.toFixed(1)}, {instance.positionZ.toFixed(1)})
                      </div>
                      <div className="flex items-center gap-1">
                        <Target className="w-4 h-4" />
                        {t('npc.instance.rotation')}: {instance.rotation}°
                      </div>
                      {instance.mapId && (
                        <div>{t('npc.instance.mapId')}: {instance.mapId}</div>
                      )}
                      {instance.territoryId && (
                        <div>{t('npc.instance.territoryId')}: {instance.territoryId}</div>
                      )}
                      {instance.shopId && (
                        <div>{t('npc.instance.shopId')}: {instance.shopId}</div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() =>
                        handleToggleStatus(instance.id, instance.isActive)
                      }
                      className="btn btn-sm btn-light"
                      title={instance.isActive ? t('common.disable') : t('common.enable')}
                    >
                      {instance.isActive ? t('common.disable') : t('common.enable')}
                    </button>
                    <Link href={`/npc/instances/edit?id=${instance.id}`}>
                      <button className="btn btn-sm btn-outline" title={t('common.edit')}>
                        <Edit className="w-4 h-4" />
                      </button>
                    </Link>
                    {deleteConfirm === instance.id ? (
                      <>
                        <button
                          onClick={() => handleDelete(instance.id)}
                          className="btn btn-sm btn-danger"
                        >
                          {t('npc.instances.deleteConfirm')}
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(null)}
                          className="btn btn-sm btn-light"
                        >
                          {t('common.cancel')}
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirm(instance.id)}
                        className="btn btn-sm btn-light hover:bg-red-50 dark:hover:bg-red-900/20"
                        title={t('common.delete')}
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
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

