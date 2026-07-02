'use client';

/**
 * Auth Context — 認證 + 授權（RBAC）
 *
 * 認證：Firebase Auth（Google）。授權：dashboard_users（帳號）+ dashboard_groups（群組）。
 *
 * 超級管理員（bootstrap）：email 在 NEXT_PUBLIC_ADMIN_EMAILS 或 Firestore `admins`
 * 集合者，永遠擁有全部權限（用來建立第一批群組/帳號）。
 *
 * 一般帳號：首次登入自動建立「待審」帳號（isActive=false）；管理員指派群組並啟用後，
 * 有效權限 = 所屬啟用中群組權限的聯集。
 *
 * 注意：前端閘門為第一層；正式安全需另在 Firestore 規則強制。
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  type User,
} from 'firebase/auth';
import { collection, getDocs, query, limit } from 'firebase/firestore';
import { getFirebaseServices } from '@/lib/firebase/config';
import { groupService } from '@/lib/admin/group-service';
import { userService } from '@/lib/admin/user-service';
import { ALL_PERMISSIONS, type DashboardUser } from '@/types/admin';

const ADMIN_EMAILS = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || '')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

export type AuthStatus = 'loading' | 'signedOut' | 'pending' | 'ok';

interface AuthContextType {
  user: User | null;
  status: AuthStatus;
  isSuperAdmin: boolean;
  account: DashboardUser | null;
  permissions: Set<string>;
  hasPermission: (p: string) => boolean;
  error: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function isSuperAdminEmail(email: string): Promise<boolean> {
  const e = email.toLowerCase();
  if (ADMIN_EMAILS.includes(e)) return true;
  try {
    const { db } = getFirebaseServices();
    const snap = await getDocs(query(collection(db, 'admins'), limit(100)));
    for (const d of snap.docs) {
      const id = d.id.toLowerCase();
      const fEmail = ((d.data().email as string) || '').toLowerCase();
      if (id === e || fEmail === e) return true;
    }
  } catch (err) {
    console.error('讀取 admins 失敗:', err);
  }
  return false;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [account, setAccount] = useState<DashboardUser | null>(null);
  const [permissions, setPermissions] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    try {
      const { app } = getFirebaseServices();
      const auth = getAuth(app);
      const unsub = onAuthStateChanged(auth, async (u) => {
        if (cancelled) return;
        setUser(u);
        if (!u) {
          setStatus('signedOut');
          setIsSuperAdmin(false);
          setAccount(null);
          setPermissions(new Set());
          return;
        }

        try {
          const acc = await userService.ensureUser(u);
          if (cancelled) return;
          setAccount(acc);

          const superAdmin = await isSuperAdminEmail(u.email || '');
          if (cancelled) return;
          setIsSuperAdmin(superAdmin);

          if (superAdmin) {
            // 超管自己的帳號自動啟用，避免在帳號列表顯示為待審核
            if (!acc.isActive) {
              try {
                await userService.setActive(acc.id, true);
                setAccount({ ...acc, isActive: true });
              } catch (err) {
                console.error('自動啟用超管帳號失敗:', err);
              }
            }
            setPermissions(new Set(ALL_PERMISSIONS));
            setStatus('ok');
            return;
          }

          if (!acc.isActive) {
            setPermissions(new Set());
            setStatus('pending');
            return;
          }

          const groups = await groupService.getAll();
          if (cancelled) return;
          const perms = new Set<string>();
          for (const g of groups) {
            if (g.isActive && acc.groupIds.includes(g.id)) {
              g.permissions.forEach((p) => perms.add(p));
            }
          }
          setPermissions(perms);
          setStatus('ok');
        } catch (err) {
          console.error('載入帳號權限失敗:', err);
          if (!cancelled) setStatus('pending');
        }
      });
      return () => {
        cancelled = true;
        unsub();
      };
    } catch (err) {
      console.error('Auth 初始化失敗:', err);
      setStatus('signedOut');
    }
  }, []);

  function hasPermission(p: string): boolean {
    return isSuperAdmin || permissions.has(p);
  }

  async function signIn() {
    try {
      setError(null);
      const { app } = getFirebaseServices();
      const auth = getAuth(app);
      await setPersistence(auth, browserLocalPersistence);
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (err) {
      console.error('登入失敗:', err);
      setError(err instanceof Error ? err.message : '登入失敗');
    }
  }

  async function signOut() {
    try {
      const { app } = getFirebaseServices();
      await firebaseSignOut(getAuth(app));
    } catch (err) {
      console.error('登出失敗:', err);
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        status,
        isSuperAdmin,
        account,
        permissions,
        hasPermission,
        error,
        signIn,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
