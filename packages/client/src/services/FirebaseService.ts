/**
 * Firebase Client Service (Phase 12: Firebase Persistence & Auth)
 * 負責客戶端的 Firebase 認證
 */
import { initializeApp, FirebaseApp } from "firebase/app";
import {
    getAuth,
    signInAnonymously,
    onAuthStateChanged,
    User,
    Auth
} from "firebase/auth";

// Firebase 配置 - 從 Firebase Console 取得
// 注意：這些是公開的客戶端配置，不是機密資訊
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
     * 匿名登入
     * @returns Firebase User 或 null
     */
    async loginAnonymous(): Promise<User | null> {
        if (!this.initialized) {
            this.initialize();
        }

        if (!auth) {
            console.error("[Firebase] Auth not initialized.");
            return null;
        }

        try {
            const result = await signInAnonymously(auth);
            console.log("[Firebase] Anonymous login successful:", result.user.uid);
            return result.user;
        } catch (error) {
            console.error("[Firebase] Anonymous login failed:", error);
            return null;
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
     * @param callback 回調函數
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
}

// 單例導出
export const firebaseService = new FirebaseService();
