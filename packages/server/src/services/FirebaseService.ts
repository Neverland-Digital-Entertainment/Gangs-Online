/**
 * Firebase Admin Service (Phase 12: Firebase Persistence & Auth)
 * 負責初始化 Firebase Admin SDK 和提供 Firestore 存取
 */
import * as admin from "firebase-admin";
import * as path from "path";
import * as fs from "fs";

// 服務帳號路徑
const serviceAccountPath = path.resolve(__dirname, "../config/service-account.json");

let db: admin.firestore.Firestore | null = null;
let initialized = false;

/**
 * 初始化 Firebase Admin SDK
 * 支援兩種方式：
 * 1. 環境變數 FIREBASE_SERVICE_ACCOUNT (用於 Production/Render)
 * 2. 本地文件 service-account.json (用於本地開發)
 */
export const initializeFirebase = (): boolean => {
    if (initialized) {
        return db !== null;
    }

    try {
        if (process.env.FIREBASE_SERVICE_ACCOUNT) {
            // Production (Render): 從環境變數載入
            const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount)
            });
            console.log("[Firebase] Admin initialized from environment variable.");
        } else if (fs.existsSync(serviceAccountPath)) {
            // Local Dev: 從文件載入
            const serviceAccount = require(serviceAccountPath);
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount)
            });
            console.log("[Firebase] Admin initialized from local file.");
        } else {
            console.warn("[Firebase] No credentials found. Persistence disabled.");
            console.warn(`[Firebase] Expected file at: ${serviceAccountPath}`);
            initialized = true;
            return false;
        }

        if (admin.apps.length > 0) {
            db = admin.firestore();
            console.log("[Firebase] Firestore connected.");
            initialized = true;
            return true;
        }
    } catch (error) {
        console.error("[Firebase] Initialization failed:", error);
    }

    initialized = true;
    return false;
};

/**
 * 取得 Firestore 實例
 */
export const getFirestore = (): admin.firestore.Firestore | null => {
    if (!initialized) {
        initializeFirebase();
    }
    return db;
};

/**
 * 取得 Firebase Admin FieldValue（用於 serverTimestamp 等）
 */
export const getFieldValue = () => admin.firestore.FieldValue;

/**
 * 檢查 Firebase 是否已初始化
 */
export const isFirebaseInitialized = (): boolean => {
    return db !== null;
};
