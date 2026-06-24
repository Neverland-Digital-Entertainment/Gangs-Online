'use client';

/**
 * Auth Context (Map Editor P6 — 管理員權限驗證)
 *
 * 用 Firebase Auth（Google 登入）驗證後台使用者，管理員判定來源有二：
 *   1. Firestore `admins` 集合：文件 ID = 管理員 email（小寫），或文件含 email 欄位。
 *      （推薦：在 Firebase Console 直接加文件即可，免重新部署、即時生效）
 *   2. 環境變數 NEXT_PUBLIC_ADMIN_EMAILS（逗號分隔，建置時寫入，需重新部署）
 *
 * 若兩者皆未設定，暫時允許任何已登入帳號（方便初次設定），請盡快設定。
 * 注意：前端閘門只是第一層；真正安全需在 Firestore/Storage 規則強制管理員權限。
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

const ADMIN_EMAILS = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || '')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

const ADMINS_COLLECTION = 'admins';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  allowlistConfigured: boolean;
  error: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/** 檢查使用者是否為管理員（env 白名單 + Firestore admins 集合） */
async function resolveAdmin(
  user: User
): Promise<{ isAdmin: boolean; configured: boolean }> {
  const email = (user.email || '').toLowerCase();
  let isAdmin = ADMIN_EMAILS.includes(email);
  let configured = ADMIN_EMAILS.length > 0;

  try {
    const { db } = getFirebaseServices();
    const snap = await getDocs(query(collection(db, ADMINS_COLLECTION), limit(100)));
    if (!snap.empty) configured = true;
    snap.forEach((d) => {
      const id = d.id.toLowerCase();
      const fieldEmail = ((d.data().email as string) || '').toLowerCase();
      if (id === email || fieldEmail === email) isAdmin = true;
    });
  } catch (err) {
    console.error('讀取 admins 集合失敗:', err);
  }

  // 完全未設定任何白名單 → 暫時允許所有登入者
  if (!configured) isAdmin = true;
  return { isAdmin, configured };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [allowlistConfigured, setAllowlistConfigured] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    try {
      const { app } = getFirebaseServices();
      const auth = getAuth(app);
      const unsub = onAuthStateChanged(auth, async (u) => {
        if (cancelled) return;
        setUser(u);
        if (u) {
          const { isAdmin: admin, configured } = await resolveAdmin(u);
          if (cancelled) return;
          setIsAdmin(admin);
          setAllowlistConfigured(configured);
        } else {
          setIsAdmin(false);
        }
        setLoading(false);
      });
      return () => {
        cancelled = true;
        unsub();
      };
    } catch (err) {
      console.error('Auth 初始化失敗:', err);
      setLoading(false);
    }
  }, []);

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
        loading,
        isAdmin,
        allowlistConfigured,
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

