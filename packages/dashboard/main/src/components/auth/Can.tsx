'use client';

/**
 * Can — 依權限顯示子內容（沒有該權限就不顯示）。
 * 用法：<Can perm="item.edit"><button>...</button></Can>
 */

import { useAuth } from '@/contexts/auth-context';

export function Can({
  perm,
  children,
}: {
  perm: string;
  children: React.ReactNode;
}) {
  const { hasPermission } = useAuth();
  return hasPermission(perm) ? <>{children}</> : null;
}
