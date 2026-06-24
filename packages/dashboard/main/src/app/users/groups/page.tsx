'use client';

import { useEffect, useState } from 'react';
import {
  Plus,
  Edit,
  Trash2,
  Loader2,
  AlertCircle,
  X,
  ShieldCheck,
} from 'lucide-react';
import { useI18n } from '@/contexts/i18n-context';
import { useAuth } from '@/contexts/auth-context';
import { groupService } from '@/lib/admin/group-service';
import {
  PERMISSION_MODULES,
  perm,
  type DashboardGroup,
  type DashboardGroupInput,
} from '@/types/admin';

export default function GroupsPage() {
  const { t } = useI18n();
  const { hasPermission } = useAuth();
  const canEdit = hasPermission('users.edit');

  const [groups, setGroups] = useState<DashboardGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<DashboardGroup | 'new' | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      setLoading(true);
      setError(null);
      setGroups(await groupService.getAll());
    } catch (err) {
      console.error('載入群組失敗:', err);
      setError(t('users.groups.loadFailed'));
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await groupService.delete(id);
      setGroups((prev) => prev.filter((g) => g.id !== id));
      setDeleteConfirm(null);
    } catch (err) {
      console.error('刪除群組失敗:', err);
      alert(t('error.deleteFailed'));
    }
  }

  return (
    <div className="container-fixed">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[var(--foreground)] mb-2 flex items-center gap-2">
            <ShieldCheck className="w-7 h-7" />
            {t('users.groups.title')}
          </h1>
          <p className="text-[var(--muted-foreground)]">
            {t('users.groups.subtitle')}
          </p>
        </div>
        {canEdit && (
          <button className="btn btn-primary" onClick={() => setEditing('new')}>
            <Plus className="w-4 h-4 mr-2" />
            {t('users.groups.create')}
          </button>
        )}
      </div>

      {loading ? (
        <div className="card">
          <div className="card-body flex items-center justify-center min-h-[240px]">
            <Loader2 className="w-10 h-10 animate-spin text-[var(--muted-foreground)]" />
          </div>
        </div>
      ) : error ? (
        <div className="card bg-red-50 dark:bg-red-900/20">
          <div className="card-body text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        </div>
      ) : groups.length === 0 ? (
        <div className="card">
          <div className="card-body text-center py-12 text-[var(--muted-foreground)]">
            {t('users.groups.empty')}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map((g) => (
            <div key={g.id} className="card">
              <div className="card-body flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-lg font-semibold text-[var(--foreground)] truncate">
                      {g.name}
                    </h3>
                    {!g.isActive && (
                      <span className="badge badge-gray text-xs">
                        {t('common.inactive')}
                      </span>
                    )}
                  </div>
                  {g.description && (
                    <p className="text-sm text-[var(--muted-foreground)] mb-2">
                      {g.description}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-1">
                    {g.permissions.length === 0 ? (
                      <span className="text-xs text-[var(--muted-foreground)]">
                        {t('users.groups.noPermissions')}
                      </span>
                    ) : (
                      g.permissions.map((p) => (
                        <span key={p} className="badge badge-gray text-xs font-mono">
                          {p}
                        </span>
                      ))
                    )}
                  </div>
                </div>
                {canEdit && (
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      className="btn btn-sm btn-light"
                      onClick={() => setEditing(g)}
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    {deleteConfirm === g.id ? (
                      <>
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => handleDelete(g.id)}
                        >
                          {t('common.delete')}
                        </button>
                        <button
                          className="btn btn-sm btn-light"
                          onClick={() => setDeleteConfirm(null)}
                        >
                          {t('common.cancel')}
                        </button>
                      </>
                    ) : (
                      <button
                        className="btn btn-sm btn-light text-red-500"
                        onClick={() => setDeleteConfirm(g.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && canEdit && (
        <GroupEditModal
          group={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await load();
          }}
        />
      )}
    </div>
  );
}

function GroupEditModal({
  group,
  onClose,
  onSaved,
}: {
  group: DashboardGroup | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const [name, setName] = useState(group?.name ?? '');
  const [description, setDescription] = useState(group?.description ?? '');
  const [isActive, setIsActive] = useState(group?.isActive ?? true);
  const [perms, setPerms] = useState<Set<string>>(new Set(group?.permissions ?? []));
  const [saving, setSaving] = useState(false);

  function toggle(p: string) {
    setPerms((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  }

  async function handleSave() {
    if (!name.trim()) return;
    const input: DashboardGroupInput = {
      name: name.trim(),
      description: description.trim() || undefined,
      permissions: Array.from(perms),
      isActive,
    };
    try {
      setSaving(true);
      if (group) await groupService.update(group.id, input);
      else await groupService.create(input);
      onSaved();
    } catch (err) {
      console.error('儲存群組失敗:', err);
      alert(t('error.saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="card w-full max-w-lg max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="card-body space-y-4 overflow-y-auto">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">
              {group ? t('users.groups.edit') : t('users.groups.create')}
            </h2>
            <button className="btn btn-sm btn-light" onClick={onClose}>
              <X className="w-4 h-4" />
            </button>
          </div>

          <div>
            <label className="label">{t('users.groups.name')}</label>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label className="label">{t('users.groups.description')}</label>
            <input
              className="input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div>
            <label className="label">{t('users.groups.permissions')}</label>
            <div className="border border-[var(--border)] rounded-lg overflow-hidden">
              <div className="grid grid-cols-[1fr_auto_auto] gap-2 px-3 py-2 text-xs text-[var(--muted-foreground)] bg-[var(--sidebar-bg)]">
                <span>{t('users.groups.module')}</span>
                <span className="w-12 text-center">{t('users.perm.view')}</span>
                <span className="w-12 text-center">{t('users.perm.edit')}</span>
              </div>
              {PERMISSION_MODULES.map((m) => (
                <div
                  key={m.key}
                  className="grid grid-cols-[1fr_auto_auto] gap-2 px-3 py-2 border-t border-[var(--border)] items-center"
                >
                  <span className="text-sm text-[var(--foreground)]">
                    {t(m.labelKey)}
                  </span>
                  <input
                    type="checkbox"
                    className="w-12"
                    checked={perms.has(perm(m.key, 'view'))}
                    onChange={() => toggle(perm(m.key, 'view'))}
                  />
                  <input
                    type="checkbox"
                    className="w-12"
                    checked={perms.has(perm(m.key, 'edit'))}
                    onChange={() => toggle(perm(m.key, 'edit'))}
                  />
                </div>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            {t('users.groups.active')}
          </label>

          <div className="flex items-center gap-2 pt-2">
            <button
              className="btn btn-primary flex-1"
              onClick={handleSave}
              disabled={saving || !name.trim()}
            >
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {t('common.save')}
            </button>
            <button className="btn btn-light" onClick={onClose} disabled={saving}>
              {t('common.cancel')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
