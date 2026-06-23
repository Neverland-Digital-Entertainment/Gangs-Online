'use client';

/**
 * AuthGate — 後台登入閘門（Map Editor P6）
 * 未登入或非管理員時擋下整個後台。
 */

import { AlertCircle, Loader2, LogIn, ShieldAlert } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { useI18n } from '@/contexts/i18n-context';
import { ThemeToggle } from '@/components/common/ThemeToggle';
import LanguageSwitcher from '@/components/common/LanguageSwitcher';

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading, isAdmin, allowlistConfigured, error, signIn, signOut } =
    useAuth();
  const { t } = useI18n();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-[var(--muted-foreground)]" />
      </div>
    );
  }

  // 未登入
  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="card w-full max-w-sm">
          <div className="card-body text-center space-y-5 py-10">
            <img
              src="/images/logo-small.png"
              alt="Gangs Online"
              className="h-10 w-auto mx-auto"
            />
            <div>
              <h1 className="text-xl font-bold text-[var(--foreground)]">
                {t('auth.title')}
              </h1>
              <p className="text-sm text-[var(--muted-foreground)] mt-1">
                {t('auth.subtitle')}
              </p>
            </div>
            <button onClick={signIn} className="btn btn-primary w-full">
              <LogIn className="w-4 h-4 mr-2" />
              {t('auth.signInGoogle')}
            </button>
            {error && (
              <div className="flex items-start gap-2 text-sm text-red-600 dark:text-red-400 text-left">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}
            <div className="flex items-center justify-center gap-2 pt-2">
              <LanguageSwitcher />
              <ThemeToggle />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 已登入但非管理員
  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="card w-full max-w-sm">
          <div className="card-body text-center space-y-4 py-10">
            <ShieldAlert className="w-12 h-12 text-amber-500 mx-auto" />
            <h1 className="text-xl font-bold text-[var(--foreground)]">
              {t('auth.noPermission')}
            </h1>
            <p className="text-sm text-[var(--muted-foreground)]">
              {user.email}
            </p>
            <p className="text-sm text-[var(--muted-foreground)]">
              {t('auth.noPermissionHint')}
            </p>
            <button onClick={signOut} className="btn btn-outline w-full">
              {t('auth.switchAccount')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 管理員：放行；白名單未設定時提示
  return (
    <>
      {!allowlistConfigured && (
        <div className="bg-amber-500/90 text-white text-xs text-center py-1 px-3">
          {t('auth.allowlistWarning')}
        </div>
      )}
      {children}
    </>
  );
}
