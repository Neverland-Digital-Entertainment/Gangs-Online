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
import type {
  NpcInstance,
  NpcInstanceFilter,
  NpcTemplate,
  MovementPattern,
} from '@/types/npc';
import { MOVEMENT_PATTERN_LABELS } from '@/types/npc';

export default function InstancesPage() {
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
      setError('無法載入 NPC 實例列表');
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
      alert('刪除失敗，請稍後再試');
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
      alert('操作失敗，請稍後再試');
    }
  }

  if (loading) {
    return (
      <div className="container-fixed">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-[var(--muted-foreground)]">載入中...</p>
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
                  載入失敗
                </h3>
                <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
                <button
                  onClick={loadData}
                  className="btn btn-sm btn-outline mt-3"
                >
                  重新載入
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
            NPC 實例管理
          </h1>
          <p className="text-[var(--muted-foreground)]">
            共 {filteredInstances.length} 個實例
          </p>
        </div>
        <Link href="/npc/instances/new">
          <button className="btn btn-primary">
            <Plus className="w-4 h-4 mr-2" />
            新增實例
          </button>
        </Link>
      </div>

      {/* Filters */}
      <div className="card mb-6">
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div>
              <label className="label">搜尋</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="搜尋模板名稱、地圖 ID..."
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
              <label className="label">NPC 模板</label>
              <select
                className="input"
                value={filter.templateId || ''}
                onChange={(e) =>
                  setFilter({ ...filter, templateId: e.target.value || undefined })
                }
              >
                <option value="">所有模板</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Movement Pattern Filter */}
            <div>
              <label className="label">移動模式</label>
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
                <option value="">所有模式</option>
                {Object.entries(MOVEMENT_PATTERN_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <label className="label">狀態</label>
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
                <option value="">所有狀態</option>
                <option value="active">啟用</option>
                <option value="inactive">停用</option>
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
                ? '尚未建立任何 NPC 實例'
                : '沒有符合條件的實例'}
            </p>
            {instances.length === 0 && (
              <Link href="/npc/instances/new">
                <button className="btn btn-primary">
                  <Plus className="w-4 h-4 mr-2" />
                  建立第一個實例
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
                        {instance.template?.name || '未知模板'}
                      </h3>
                      <span className="badge badge-primary flex-shrink-0">
                        Lv.{instance.level}
                      </span>
                      <span className="badge badge-gray flex-shrink-0">
                        {MOVEMENT_PATTERN_LABELS[instance.movementPattern]}
                      </span>
                      {!instance.isActive && (
                        <span className="badge badge-gray flex-shrink-0">停用</span>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-4 text-sm text-[var(--muted-foreground)]">
                      <div className="flex items-center gap-1">
                        <MapPin className="w-4 h-4" />
                        座標: ({instance.positionX.toFixed(1)}, {instance.positionZ.toFixed(1)})
                      </div>
                      <div className="flex items-center gap-1">
                        <Target className="w-4 h-4" />
                        旋轉: {instance.rotation}°
                      </div>
                      {instance.mapId && (
                        <div>地圖: {instance.mapId}</div>
                      )}
                      {instance.territoryId && (
                        <div>區域: {instance.territoryId}</div>
                      )}
                      {instance.shopId && (
                        <div>商店: {instance.shopId}</div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() =>
                        handleToggleStatus(instance.id, instance.isActive)
                      }
                      className="btn btn-sm btn-outline"
                      title={instance.isActive ? '停用' : '啟用'}
                    >
                      {instance.isActive ? '停用' : '啟用'}
                    </button>
                    <Link href={`/npc/instances/edit?id=${instance.id}`}>
                      <button className="btn btn-sm btn-outline" title="編輯">
                        <Edit className="w-4 h-4" />
                      </button>
                    </Link>
                    {deleteConfirm === instance.id ? (
                      <>
                        <button
                          onClick={() => handleDelete(instance.id)}
                          className="btn btn-sm btn-danger"
                        >
                          確認刪除
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(null)}
                          className="btn btn-sm btn-outline"
                        >
                          取消
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirm(instance.id)}
                        className="btn btn-sm btn-outline text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                        title="刪除"
                      >
                        <Trash2 className="w-4 h-4" />
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

