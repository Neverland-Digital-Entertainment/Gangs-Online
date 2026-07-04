/**
 * 後台用戶管理 / 權限（RBAC）型別與權限目錄
 *
 * 認證(Firebase Auth) 與 授權(這裡的資料) 分離：
 *   - 登入方式不限（Google…），最後得到穩定 uid + email
 *   - 權限由 dashboard_users（帳號）+ dashboard_groups（群組）決定
 */

export type PermissionAction = 'view' | 'edit';

/** 可授權的模組（每個模組各有 view / edit 兩級） */
export interface PermissionModule {
  key: string;
  labelKey: string; // i18n key
}

export const PERMISSION_MODULES: PermissionModule[] = [
  { key: 'map', labelKey: 'nav.map' },
  { key: 'item', labelKey: 'nav.item' },
  { key: 'shop', labelKey: 'nav.shop' },
  { key: 'npc', labelKey: 'nav.npc' },
  { key: 'quest', labelKey: 'nav.quest' },
  { key: 'users', labelKey: 'nav.users' },
  // Phase 21 安全修復：系統資料診斷頁改為權限控管（原本任何登入者皆可讀取玩家/幫會原始資料）
  { key: 'systems', labelKey: 'nav.systemsData' },
];

export function perm(moduleKey: string, action: PermissionAction): string {
  return `${moduleKey}.${action}`;
}

/** 全部權限（超級管理員 / 全選用） */
export const ALL_PERMISSIONS: string[] = PERMISSION_MODULES.flatMap((m) => [
  perm(m.key, 'view'),
  perm(m.key, 'edit'),
]);

// ---- 群組 ----
export interface DashboardGroup {
  id: string;
  name: string;
  description?: string;
  permissions: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface DashboardGroupInput {
  name: string;
  description?: string;
  permissions: string[];
  isActive?: boolean;
}

// ---- 帳號 ----
export interface DashboardUser {
  id: string; // Firebase uid
  email: string;
  displayName?: string;
  groupIds: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
}
