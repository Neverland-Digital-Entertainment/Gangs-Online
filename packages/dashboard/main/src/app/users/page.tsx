'use client';

import { useEffect, useState } from 'react';
import { Loader2, Users as UsersIcon, X } from 'lucide-react';
import { useI18n } from '@/contexts/i18n-context';
import { useAuth } from '@/contexts/auth-context';
import { userService } from '@/lib/admin/user-service';
import { groupService } from '@/lib/admin/group-service';
import type { DashboardGroup, DashboardUser } from '@/types/admin';

export default function UsersPage() {
  const { t } = useI18n();
  const { hasPermission, user: currentUser } = useAuth();
  const canEdit = hasPermission('users.edit');

  const [users, setUsers] = useState<DashboardUser[]>([]);
  const [groups, setGroups] = useState<DashboardGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<DashboardUser | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      setLoading(true);
      setError(null);
      const [u, g] = await Promise.all([
        userService.getAll(),
        groupService.getAll(),
      ]);
      setUsers(u);
      setGroups(g);
    } catch (err) {
      console.error('載入帳號失敗:', err);
      setError(t('users.accounts.loadFailed'));
    } finally {
      setLoading(false);
    }
  }

  async function toggleActive(u: DashboardUser) {
    try {
      await userService.setActive(u.id, !u.isActive);
      setUsers((prev) =>
        prev.map((x) => (x.id === u.id ? { ...x, isActive: !x.isActive } : x))
      );
    } catch (err) {
      console.error('切換帳號狀態失敗:', err);
      alert(t('error.saveFailed'));
    }
  }

  const groupName = (id: string) => groups.find((g) => g.id === id)?.name ?? id;

  return (
    <div className="container-fixed">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-[var(--foreground)] mb-2 flex items-center gap-2">
          <UsersIcon className="w-7 h-7" />
          {t('users.accounts.title')}
        </h1>
        <p className="text-[var(--muted-foreground)]">
          {t('users.accounts.subtitle')}
        </p>
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
      ) : (
        <div className="space-y-3">
          {users.map((u) => {
            const isSelf = currentUser?.uid === u.id;
            return (
              <div key={u.id} className="card">
                <div className="card-body flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-[var(--foreground)] truncate">
                        {u.displayName || u.email}
                      </h3>
                      <span
                        className={`px-2 py-0.5 text-xs font-medium rounded ${
                          u.isActive
                            ? 'bg-green-500 text-white'
                            : 'bg-amber-500 text-white'
                        }`}
                      >
                        {u.isActive ? t('common.active') : t('users.accounts.pending')}
                      </span>
                    </div>
                    <p className="text-sm text-[var(--muted-foreground)] truncate">
                      {u.email}
                    </p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {u.groupIds.length === 0 ? (
                        <span className="text-xs text-[var(--muted-foreground)]">
                          {t('users.accounts.noGroups')}
                        </span>
                      ) : (
                        u.groupIds.map((gid) => (
                          <span key={gid} className="badge badge-primary text-xs">
                            {groupName(gid)}
                          </span>
                        ))
                      )}
                    </div>
                  </div>

                  {canEdit && (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        className="btn btn-sm btn-light"
                        onClick={() => setEditing(u)}
                      >
                        {t('users.accounts.assignGroups')}
                      </button>
                      <button
                        className="btn btn-sm btn-light"
                        onClick={() => toggleActive(u)}
                        disabled={isSelf}
                        title={isSelf ? t('users.accounts.cannotSelf') : ''}
                      >
                        {u.isActive ? t('common.disable') : t('common.enable')}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editing && canEdit && (
        <AssignGroupsModal
          user={editing}
          groups={groups}
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

function AssignGroupsModal({
  user,
  groups,
  onClose,
  onSaved,
}: {
  user: DashboardUser;
  groups: DashboardGroup[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const [selected, setSelected] = useState<Set<string>>(new Set(user.groupIds));
  const [saving, setSaving] = useState(false);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSave() {
    try {
      setSaving(true);
      await userService.setGroups(user.id, Array.from(selected));
      onSaved();
    } catch (err) {
      console.error('指派群組失敗:', err);
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
        className="card w-full max-w-md max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="card-body space-y-4 overflow-y-auto">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">
              {t('users.accounts.assignGroups')}
            </h2>
            <button className="btn btn-sm btn-light" onClick={onClose}>
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-sm text-[var(--muted-foreground)]">{user.email}</p>

          {groups.length === 0 ? (
            <p className="text-sm text-[var(--muted-foreground)]">
              {t('users.accounts.noGroupsAvailable')}
            </p>
          ) : (
            <div className="space-y-1">
              {groups.map((g) => (
                <label
                  key={g.id}
                  className="flex items-center gap-2 px-2 py-2 rounded hover:bg-[var(--sidebar-hover)] cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(g.id)}
                    onChange={() => toggle(g.id)}
                  />
                  <span className="text-sm text-[var(--foreground)]">{g.name}</span>
                  {!g.isActive && (
                    <span className="badge badge-gray text-xs">
                      {t('common.inactive')}
                    </span>
                  )}
                </label>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2 pt-2">
            <button
              className="btn btn-primary flex-1"
              onClick={handleSave}
              disabled={saving}
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
