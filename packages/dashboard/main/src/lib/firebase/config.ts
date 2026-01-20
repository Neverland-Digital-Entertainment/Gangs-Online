/**
 * Firebase Configuration
 * Version 0.16.1
 */

import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Validate Firebase configuration
function validateFirebaseConfig() {
  const requiredKeys = [
    'apiKey',
    'authDomain',
    'projectId',
    'storageBucket',
    'messagingSenderId',
    'appId'
  ];

  const missingKeys = requiredKeys.filter(key => !firebaseConfig[key as keyof typeof firebaseConfig]);

  if (missingKeys.length > 0) {
    console.error('❌ Firebase 配置錯誤：缺少以下環境變數：');
    missingKeys.forEach(key => {
      console.error(`   - NEXT_PUBLIC_FIREBASE_${key.replace(/([A-Z])/g, '_$1').toUpperCase()}`);
    });
    console.error('\n請在 Cloudflare Pages 設定環境變數，或在本地創建 .env.local 檔案');
    console.error('參考 .env.example 檔案');
    throw new Error('Firebase 配置不完整，請設定所有必要的環境變數');
  }
}

let app: FirebaseApp;
let db: Firestore;
let storage: FirebaseStorage;

export function getFirebaseServices() {
  try {
    // Validate configuration first
    validateFirebaseConfig();

    if (!getApps().length) {
      app = initializeApp(firebaseConfig);
      db = getFirestore(app);
      storage = getStorage(app);
      console.log('✅ Firebase 已成功初始化');
    } else {
      app = getApps()[0];
      db = getFirestore(app);
      storage = getStorage(app);
    }

    return { app, db, storage };
  } catch (error) {
    console.error('Firebase 初始化失敗:', error);
    throw error;
  }
}
