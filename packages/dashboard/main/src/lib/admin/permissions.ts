/**
 * 權限反正規化 — 把每個帳號的「有效權限」寫進 dashboard_users.permissions，
 * 讓 Firestore 安全規則可以直接讀取判斷（規則不方便即時聯集多個群組）。
 *
 * 需在「指派群組」與「群組權限變動」時呼叫，保持同步。
 */

import { collection, doc, getDocs, writeBatch, Timestamp } from 'firebase/firestore';
import { getFirebaseServices } from '../firebase/config';
import type { DashboardGroup } from '@/types/admin';

/** 由 groupIds + 群組清單算出有效權限（啟用中群組的聯集） */
export function effectivePermissions(
  groupIds: string[],
  groups: DashboardGroup[]
): string[] {
  const set = new Set<string>();
  for (const g of groups) {
    if (g.isActive && groupIds.includes(g.id)) {
      g.permissions.forEach((p) => set.add(p));
    }
  }
  return Array.from(set);
}

/**
 * 重算所有帳號的 permissions（群組權限變動時呼叫）。
 */
export async function syncAllUsersPermissions(): Promise<void> {
  const { db } = getFirebaseServices();
  const [usersSnap, groupsSnap] = await Promise.all([
    getDocs(collection(db, 'dashboard_users')),
    getDocs(collection(db, 'dashboard_groups')),
  ]);

  const groups: DashboardGroup[] = groupsSnap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      name: data.name,
      permissions: data.permissions ?? [],
      isActive: data.isActive ?? true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  });

  let batch = writeBatch(db);
  let ops = 0;
  for (const u of usersSnap.docs) {
    const groupIds: string[] = u.data().groupIds ?? [];
    batch.update(doc(db, 'dashboard_users', u.id), {
      permissions: effectivePermissions(groupIds, groups),
      updatedAt: Timestamp.now(),
    });
    ops++;
    if (ops >= 400) {
      await batch.commit();
      batch = writeBatch(db);
      ops = 0;
    }
  }
  if (ops > 0) await batch.commit();
}
