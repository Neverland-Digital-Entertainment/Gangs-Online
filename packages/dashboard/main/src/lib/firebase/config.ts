/**
 * Firebase Configuration
 * Version 0.16.1
 */

import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';

// 與遊戲客戶端相同、已驗證可用的設定（Firebase web API key 為公開金鑰，
// 客戶端 FirebaseService 也是寫死同一組）。直接寫死可避免部署環境變數設錯／
// 含空白導致 auth/api-key-not-valid。如需切換專案，改下方數值即可。
const firebaseConfig = {
  apiKey: 'AIzaSyBs03duOjrZLZ74NgFPxMYOD6vaYAmwrOg',
  authDomain: 'gangs-online.firebaseapp.com',
  projectId: 'gangs-online',
  storageBucket: 'gangs-online.firebasestorage.app',
  messagingSenderId: '564210253310',
  appId: '1:564210253310:web:f070f3f5da448ee2c194af',
};

// 驗證 Firebase 配置（保留供日後改回環境變數時使用）
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
    console.error('❌ Firebase 配置錯誤：缺少以下設定：', missingKeys.join(', '));
    throw new Error('Firebase 配置不完整');
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
