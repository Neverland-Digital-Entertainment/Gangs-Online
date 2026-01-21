'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Plus,
  Search,
  Edit,
  Trash2,
  AlertCircle,
  Users,
  MessageSquare,
} from 'lucide-react';
import { npcTemplateService } from '@/lib/npc/template-service';
import type {
  NpcTemplate,
  NpcTemplateFilter,
  NpcType,
} from '@/types/npc';
import { NPC_TYPE_LABELS } from '@/types/npc';

export default function NpcTemplatesPage() {
  const [templates, setTemplates] = useState<NpcTemplate[]>([]);
  const [filteredTemplates, setFilteredTemplates] = useState<NpcTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const [filter, setFilter] = useState<NpcTemplateFilter>({
    search: '',
    type: undefined,
    isActive: undefined,
  });

  useEffect(() => {
    loadTemplates();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [templates, filter]);

  async function loadTemplates() {
    try {
      setLoading(true);
      setError(null);
      const data = await npcTemplateService.getAllTemplates();
      setTemplates(data);
    } catch (err) {
      console.error('載入 NPC 模板失敗:', err);
      setError('無法載入 NPC 模板列表');
    } finally {
      setLoading(false);
    }
  }

  function applyFilters() {
    let result = [...templates];

    // Search filter
    if (filter.search) {
      const searchLower = filter.search.toLowerCase();
      result = result.filter(
        (template) =>
          template.name.toLowerCase().includes(searchLower) ||
          template.modelId.toLowerCase().includes(searchLower) ||
          template.description?.toLowerCase().includes(searchLower)
      );
    }

    // Type filter
    if (filter.type) {
      result = result.filter((template) => template.type === filter.type);
    }

    // Status filter
    if (filter.isActive !== undefined) {
      result = result.filter((template) => template.isActive === filter.isActive);
    }

    setFilteredTemplates(result);
  }

  async function handleDelete(id: string) {
    try {
      await npcTemplateService.deleteTemplate(id);
      setTemplates(templates.filter((t) => t.id !== id));
      setDeleteConfirm(null);
    } catch (err) {
      console.error('刪除 NPC 模板失敗:', err);
      alert('刪除失敗，請稍後再試');
    }
  }

  async function handleToggleStatus(id: string, currentStatus: boolean) {
    try {
      await npcTemplateService.toggleTemplateStatus(id, !currentStatus);
      setTemplates(
        templates.map((t) =>
          t.id === id ? { ...t, isActive: !currentStatus } : t
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
                  onClick={loadTemplates}
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
            NPC 模板管理
          </h1>
          <p className="text-[var(--muted-foreground)]">
            共 {filteredTemplates.length} 個模板
          </p>
        </div>
        <Link href="/npc/templates/new">
          <button className="btn btn-primary">
            <Plus className="w-4 h-4 mr-2" />
            新增模板
          </button>
        </Link>
      </div>

      {/* Filters */}
      <div className="card mb-6">
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Search */}
            <div>
              <label className="label">搜尋</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="搜尋模板名稱或模型 ID..."
                  className="input pl-10"
                  value={filter.search}
                  onChange={(e) =>
                    setFilter({ ...filter, search: e.target.value })
                  }
                />
              </div>
            </div>

            {/* Type Filter */}
            <div>
              <label className="label">NPC 類型</label>
              <select
                className="input"
                value={filter.type || ''}
                onChange={(e) =>
                  setFilter({
                    ...filter,
                    type: e.target.value as NpcType || undefined,
                  })
                }
              >
                <option value="">所有類型</option>
                {Object.entries(NPC_TYPE_LABELS).map(([value, label]) => (
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

      {/* Templates List */}
      {filteredTemplates.length === 0 ? (
        <div className="card">
          <div className="card-body text-center py-12">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-[var(--muted-foreground)] mb-4">
              {templates.length === 0
                ? '尚未建立任何 NPC 模板'
                : '沒有符合條件的模板'}
            </p>
            {templates.length === 0 && (
              <Link href="/npc/templates/new">
                <button className="btn btn-primary">
                  <Plus className="w-4 h-4 mr-2" />
                  建立第一個模板
                </button>
              </Link>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredTemplates.map((template) => (
            <div key={template.id} className="card hover:shadow-md transition-shadow">
              <div className="card-body">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-semibold text-[var(--foreground)] truncate">
                        {template.name}
                      </h3>
                      <span className="badge badge-primary flex-shrink-0">
                        {NPC_TYPE_LABELS[template.type]}
                      </span>
                      {!template.isActive && (
                        <span className="badge badge-gray flex-shrink-0">停用</span>
                      )}
                    </div>

                    {template.description && (
                      <p className="text-sm text-[var(--muted-foreground)] mb-3">
                        {template.description}
                      </p>
                    )}

                    <div className="flex flex-wrap gap-4 text-sm text-[var(--muted-foreground)]">
                      <div>
                        模型 ID: <span className="font-mono">{template.modelId}</span>
                      </div>
                      <div>
                        HP: <span className="font-semibold">{template.baseHp}</span>
                      </div>
                      <div>
                        攻擊: <span className="font-semibold">{template.baseAttack}</span>
                      </div>
                      <div>
                        防禦: <span className="font-semibold">{template.baseDefense}</span>
                      </div>
                      {template.dialogueTree && (
                        <div className="flex items-center gap-1">
                          <MessageSquare className="w-4 h-4" />
                          <span>有對話樹</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() =>
                        handleToggleStatus(template.id, template.isActive)
                      }
                      className="btn btn-sm btn-outline"
                      title={template.isActive ? '停用' : '啟用'}
                    >
                      {template.isActive ? '停用' : '啟用'}
                    </button>
                    <Link href={`/npc/templates/edit/${template.id}`}>
                      <button className="btn btn-sm btn-outline" title="編輯">
                        <Edit className="w-4 h-4" />
                      </button>
                    </Link>
                    {deleteConfirm === template.id ? (
                      <>
                        <button
                          onClick={() => handleDelete(template.id)}
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
                        onClick={() => setDeleteConfirm(template.id)}
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
