'use client';

/**
 * Auth Context (Map Editor P6 — 管理員權限驗證)
 *
 * 用 Firebase Auth（Google 登入）驗證後台使用者，並用 email 白名單判斷是否管理員。
 * 白名單由環境變數 NEXT_PUBLIC_ADMIN_EMAILS（逗號分隔）設定；
 * 若未設定，則暫時允許任何已登入帳號（方便初次設定），請務必盡快設定白名單。
 *
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
import { getFirebaseServices } from '@/lib/firebase/config';

const ADMIN_EMAILS = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || '')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const { app } = getFirebaseServices();
      const auth = getAuth(app);
      const unsub = onAuthStateChanged(auth, (u) => {
        setUser(u);
        setLoading(false);
      });
      return () => unsub();
    } catch (err) {
      console.error('Auth 初始化失敗:', err);
      setLoading(false);
    }
  }, []);

  const isAdmin =
    !!user &&
    (ADMIN_EMAILS.length === 0 ||
      ADMIN_EMAILS.includes((user.email || '').toLowerCase()));

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
        allowlistConfigured: ADMIN_EMAILS.length > 0,
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
