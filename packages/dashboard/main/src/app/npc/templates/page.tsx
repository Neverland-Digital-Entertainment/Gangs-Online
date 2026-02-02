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
import { useI18n } from '@/contexts/i18n-context';
import type {
  NpcTemplate,
  NpcTemplateFilter,
  NpcType,
} from '@/types/npc';

export default function NpcTemplatesPage() {
  const { t } = useI18n();
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
      setError(t('error.loadFailed'));
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
          template.modelId?.toLowerCase().includes(searchLower) ||
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
      alert(t('error.deleteFailed'));
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
                  {t('npc.template.loadFailed')}
                </h3>
                <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
                <button
                  onClick={loadTemplates}
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
            {t('npc.templates.title')}
          </h1>
          <p className="text-[var(--muted-foreground)]">
            {t('common.total')} {filteredTemplates.length} {t('common.items')}
          </p>
        </div>
        <Link href="/npc/templates/new">
          <button className="btn btn-primary">
            <Plus className="w-4 h-4 mr-2" />
            {t('npc.templates.create')}
          </button>
        </Link>
      </div>

      {/* Filters */}
      <div className="card mb-6">
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Search */}
            <div>
              <label className="label">{t('common.search')}</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder={t('npc.templates.searchPlaceholder')}
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
              <label className="label">{t('npc.template.type')}</label>
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
                <option value="">{t('common.all')}</option>
                {(['CITIZEN', 'POLICE', 'GANGS', 'SHOP', 'QUEST'] as const).map((type) => (
                  <option key={type} value={type}>
                    {t(`npc.type.${type}`)}
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

      {/* Templates List */}
      {filteredTemplates.length === 0 ? (
        <div className="card">
          <div className="card-body text-center py-12">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-[var(--muted-foreground)] mb-4">
              {templates.length === 0
                ? t('npc.templates.noTemplates')
                : t('npc.templates.noMatchingTemplates')}
            </p>
            {templates.length === 0 && (
              <Link href="/npc/templates/new">
                <button className="btn btn-primary">
                  <Plus className="w-4 h-4 mr-2" />
                  {t('npc.templates.createFirst')}
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
                        {t(`npc.type.${template.type}`)}
                      </span>
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded shadow flex-shrink-0 ${
                          template.isActive
                            ? 'bg-green-500 text-white'
                            : 'bg-gray-500 text-white'
                        }`}
                      >
                        {template.isActive ? t('common.active') : t('common.inactive')}
                      </span>
                    </div>

                    {template.description && (
                      <p className="text-sm text-[var(--muted-foreground)] mb-3">
                        {template.description}
                      </p>
                    )}

                    <div className="flex flex-wrap gap-4 text-sm text-[var(--muted-foreground)]">
                      <div>
                        {t('npc.template.modelId')}: <span className="font-mono">{template.modelId || t('common.default')}</span>
                      </div>
                      <div>
                        {t('npc.template.hp')}: <span className="font-semibold">{template.baseHp}</span>
                      </div>
                      <div>
                        {t('npc.template.attack')}: <span className="font-semibold">{template.baseAttack}</span>
                      </div>
                      <div>
                        {t('npc.template.defense')}: <span className="font-semibold">{template.baseDefense}</span>
                      </div>
                      {template.dialogueTree && (
                        <div className="flex items-center gap-1">
                          <MessageSquare className="w-4 h-4" />
                          <span>{t('npc.template.hasDialogue')} {template.dialogueTree.nodes.length} {t('npc.template.nodes')}</span>
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
                      className="btn btn-sm btn-light"
                      title={template.isActive ? t('common.disable') : t('common.enable')}
                    >
                      {template.isActive ? t('common.disable') : t('common.enable')}
                    </button>
                    <Link href={`/npc/templates/edit?id=${template.id}`}>
                      <button className="btn btn-sm btn-light" title={t('common.edit')}>
                        <Edit className="w-4 h-4" />
                      </button>
                    </Link>
                    {deleteConfirm === template.id ? (
                      <>
                        <button
                          onClick={() => handleDelete(template.id)}
                          className="btn btn-sm btn-danger"
                        >
                          {t('npc.templates.deleteConfirm')}
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
                        onClick={() => setDeleteConfirm(template.id)}
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
