/**
 * Firebase Client Service (Phase 12.1: Full Auth System)
 * 支援 Google、Apple、Email 登入和註冊
 */
import { initializeApp, FirebaseApp } from "firebase/app";
import {
    getAuth,
    signInAnonymously,
    signInWithPopup,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    GoogleAuthProvider,
    OAuthProvider,
    onAuthStateChanged,
    signOut,
    setPersistence,
    browserLocalPersistence,
    browserSessionPersistence,
    User,
    Auth
} from "firebase/auth";

// Firebase 配置 - 從 Firebase Console 取得
const firebaseConfig = {
    apiKey: "AIzaSyBs03duOjrZLZ74NgFPxMYOD6vaYAmwrOg",
    authDomain: "gangs-online.firebaseapp.com",
    projectId: "gangs-online",
    storageBucket: "gangs-online.firebasestorage.app",
    messagingSenderId: "564210253310",
    appId: "1:564210253310:web:f070f3f5da448ee2c194af"
};

let app: FirebaseApp | null = null;
let auth: Auth | null = null;

// Auth Providers
const googleProvider = new GoogleAuthProvider();
const appleProvider = new OAuthProvider('apple.com');

// 登入結果類型
export interface AuthResult {
    success: boolean;
    user: User | null;
    error?: string;
    isNewUser?: boolean;
}

/**
 * Firebase 客戶端服務類
 */
export class FirebaseService {
    private initialized: boolean = false;

    /**
     * 初始化 Firebase
     */
    initialize(): void {
        if (this.initialized) return;

        try {
            app = initializeApp(firebaseConfig);
            auth = getAuth(app);
            this.initialized = true;
            console.log("[Firebase] Client SDK initialized.");
        } catch (error) {
            console.error("[Firebase] Client initialization failed:", error);
        }
    }

    /**
     * 檢查是否已登入
     */
    isLoggedIn(): boolean {
        return auth?.currentUser !== null;
    }

    /**
     * 等待認證狀態初始化
     */
    waitForAuthReady(): Promise<User | null> {
        return new Promise((resolve) => {
            if (!this.initialized) {
                this.initialize();
            }
            if (!auth) {
                resolve(null);
                return;
            }
            const unsubscribe = onAuthStateChanged(auth, (user) => {
                unsubscribe();
                resolve(user);
            });
        });
    }

    /**
     * Google 登入
     */
    async loginWithGoogle(): Promise<AuthResult> {
        if (!this.initialized) this.initialize();
        if (!auth) return { success: false, user: null, error: "Auth not initialized" };

        try {
            // 設定為持久化登入（記住登入狀態）
            await setPersistence(auth, browserLocalPersistence);

            const result = await signInWithPopup(auth, googleProvider);
            const isNewUser = result.user.metadata.creationTime === result.user.metadata.lastSignInTime;
            console.log("[Firebase] Google login successful:", result.user.uid);
            return { success: true, user: result.user, isNewUser };
        } catch (error: any) {
            console.error("[Firebase] Google login failed:", error);
            return { success: false, user: null, error: error.message };
        }
    }

    /**
     * Apple 登入
     */
    async loginWithApple(): Promise<AuthResult> {
        if (!this.initialized) this.initialize();
        if (!auth) return { success: false, user: null, error: "Auth not initialized" };

        try {
            // 設定為持久化登入（記住登入狀態）
            await setPersistence(auth, browserLocalPersistence);

            appleProvider.addScope('email');
            appleProvider.addScope('name');
            const result = await signInWithPopup(auth, appleProvider);
            const isNewUser = result.user.metadata.creationTime === result.user.metadata.lastSignInTime;
            console.log("[Firebase] Apple login successful:", result.user.uid);
            return { success: true, user: result.user, isNewUser };
        } catch (error: any) {
            console.error("[Firebase] Apple login failed:", error);
            return { success: false, user: null, error: error.message };
        }
    }

    /**
     * Email 登入
     * @param rememberMe 是否記住登入狀態（true = 持久化, false = 只在當前分頁有效）
     */
    async loginWithEmail(email: string, password: string, rememberMe: boolean = false): Promise<AuthResult> {
        if (!this.initialized) this.initialize();
        if (!auth) return { success: false, user: null, error: "Auth not initialized" };

        try {
            // 根據「記住我」設定持久化方式
            const persistence = rememberMe ? browserLocalPersistence : browserSessionPersistence;
            await setPersistence(auth, persistence);
            console.log(`[Firebase] Persistence set to: ${rememberMe ? 'LOCAL' : 'SESSION'}`);

            const result = await signInWithEmailAndPassword(auth, email, password);
            console.log("[Firebase] Email login successful:", result.user.uid);
            return { success: true, user: result.user, isNewUser: false };
        } catch (error: any) {
            console.error("[Firebase] Email login failed:", error);
            let errorMsg = "登入失敗";
            if (error.code === "auth/user-not-found") errorMsg = "找不到此帳號";
            if (error.code === "auth/wrong-password") errorMsg = "密碼錯誤";
            if (error.code === "auth/invalid-email") errorMsg = "Email 格式錯誤";
            if (error.code === "auth/invalid-credential") errorMsg = "帳號或密碼錯誤";
            return { success: false, user: null, error: errorMsg };
        }
    }

    /**
     * Email 註冊
     */
    async registerWithEmail(email: string, password: string): Promise<AuthResult> {
        if (!this.initialized) this.initialize();
        if (!auth) return { success: false, user: null, error: "Auth not initialized" };

        try {
            const result = await createUserWithEmailAndPassword(auth, email, password);
            console.log("[Firebase] Email registration successful:", result.user.uid);
            return { success: true, user: result.user, isNewUser: true };
        } catch (error: any) {
            console.error("[Firebase] Email registration failed:", error);
            let errorMsg = "註冊失敗";
            if (error.code === "auth/email-already-in-use") errorMsg = "此 Email 已被使用";
            if (error.code === "auth/weak-password") errorMsg = "密碼太弱（至少 6 個字元）";
            if (error.code === "auth/invalid-email") errorMsg = "Email 格式錯誤";
            return { success: false, user: null, error: errorMsg };
        }
    }

    /**
     * 匿名登入（訪客模式）
     */
    async loginAnonymous(): Promise<AuthResult> {
        if (!this.initialized) this.initialize();
        if (!auth) return { success: false, user: null, error: "Auth not initialized" };

        try {
            const result = await signInAnonymously(auth);
            console.log("[Firebase] Anonymous login successful:", result.user.uid);
            return { success: true, user: result.user, isNewUser: true };
        } catch (error: any) {
            console.error("[Firebase] Anonymous login failed:", error);
            return { success: false, user: null, error: error.message };
        }
    }

    /**
     * 登出
     */
    async logout(): Promise<void> {
        if (auth) {
            await signOut(auth);
            console.log("[Firebase] Logged out.");
        }
    }

    /**
     * 取得目前登入的用戶
     */
    getCurrentUser(): User | null {
        return auth?.currentUser || null;
    }

    /**
     * 監聽認證狀態變化
     */
    onAuthChange(callback: (user: User | null) => void): void {
        if (!auth) {
            console.warn("[Firebase] Auth not initialized for auth state listener.");
            return;
        }
        onAuthStateChanged(auth, callback);
    }

    /**
     * 取得目前用戶的 UID
     */
    getUid(): string | null {
        return auth?.currentUser?.uid || null;
    }

    /**
     * 取得 Firebase App（供其他服務取用 Firestore 等）
     */
    getApp(): FirebaseApp | null {
        return app;
    }
}

// 單例導出
export const firebaseService = new FirebaseService();
