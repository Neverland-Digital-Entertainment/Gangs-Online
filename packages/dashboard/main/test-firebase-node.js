/**
 * Firebase Node.js 測試腳本
 * 用於在伺服器端測試 Firebase 連接（繞過瀏覽器擴充功能干擾）
 *
 * 使用方法：
 * 1. 確保已安裝 Node.js
 * 2. 在終端執行：node test-firebase-node.js
 */

// 從環境變數讀取 Firebase 配置
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

console.log('🔧 Firebase 配置檢查...');
console.log('=====================================');

// 檢查環境變數
const requiredKeys = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'];
const missingKeys = requiredKeys.filter(key => !firebaseConfig[key]);

if (missingKeys.length > 0) {
  console.error('❌ 缺少以下環境變數：');
  missingKeys.forEach(key => {
    const envKey = `NEXT_PUBLIC_FIREBASE_${key.replace(/([A-Z])/g, '_$1').toUpperCase()}`;
    console.error(`   - ${envKey}`);
  });
  console.error('\n請設定環境變數後再執行此腳本');
  console.error('可以創建 .env.local 檔案或在終端執行：');
  console.error('export NEXT_PUBLIC_FIREBASE_API_KEY="your-api-key"');
  process.exit(1);
}

console.log('✅ 所有環境變數已設定');
console.log('專案 ID:', firebaseConfig.projectId);
console.log('=====================================\n');

async function testFirebase() {
  try {
    console.log('📦 載入 Firebase 模組...');

    // 動態載入 Firebase（需要先安裝：npm install firebase）
    const { initializeApp } = await import('firebase/app');
    const { getFirestore, collection, addDoc, getDocs, Timestamp } = await import('firebase/firestore');

    console.log('✅ Firebase 模組載入成功\n');

    console.log('🔌 初始化 Firebase...');
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    console.log('✅ Firebase 初始化成功\n');

    // 測試讀取
    console.log('📖 測試讀取道具列表...');
    console.log('=====================================');
    const itemsRef = collection(db, 'items');
    const snapshot = await getDocs(itemsRef);
    console.log(`✅ 讀取成功！共有 ${snapshot.size} 個道具`);

    if (snapshot.size > 0) {
      console.log('\n前 3 個道具：');
      snapshot.docs.slice(0, 3).forEach((doc, index) => {
        const data = doc.data();
        console.log(`${index + 1}. ${data.name} (ID: ${doc.id})`);
      });
    }
    console.log('=====================================\n');

    // 測試寫入
    console.log('🚀 測試新增道具...');
    console.log('=====================================');

    const testItem = {
      name: 'Node.js測試道具_' + new Date().toLocaleTimeString('zh-TW'),
      description: '這是透過 Node.js 伺服器端新增的測試道具',
      category: 'consumable',
      imageUrl: '/images/no-image.png',
      price: 888,
      sellPrice: 444,
      isTradeable: true,
      isDroppable: true,
      isActive: true,
      attributes: {
        hpRestore: 30,
        cooldown: 3
      },
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    };

    console.log('📦 準備新增的道具：');
    console.log(JSON.stringify(testItem, null, 2));
    console.log('');

    console.log('⏳ 正在寫入 Firestore...');
    const docRef = await addDoc(itemsRef, testItem);

    console.log('');
    console.log('=====================================');
    console.log('✨ 成功新增道具！');
    console.log('道具 ID:', docRef.id);
    console.log('=====================================');
    console.log('');

    console.log('🎉 所有測試通過！');
    console.log('');
    console.log('結論：');
    console.log('✅ Firebase 連接正常');
    console.log('✅ 環境變數配置正確');
    console.log('✅ Firestore 讀寫權限正常');
    console.log('');
    console.log('⚠️ 如果瀏覽器仍然無法新增道具，問題出在：');
    console.log('   1. 瀏覽器擴充功能（e-commerce.js 等）');
    console.log('   2. 廣告攔截器或隱私保護工具');
    console.log('   3. 防火牆或網路政策');
    console.log('');
    console.log('建議解決方案：');
    console.log('   1. 使用無痕模式（Incognito/Private）瀏覽器');
    console.log('   2. 完全停用所有瀏覽器擴充功能');
    console.log('   3. 將您的網站加入信任清單');

  } catch (error) {
    console.error('');
    console.error('=====================================');
    console.error('❌ 測試失敗！');
    console.error('=====================================');
    console.error('錯誤訊息:', error.message);
    console.error('錯誤代碼:', error.code);
    console.error('');

    if (error.code === 'permission-denied') {
      console.error('⚠️ 權限不足！');
      console.error('');
      console.error('請到 Firebase Console 檢查 Firestore 安全規則：');
      console.error(`https://console.firebase.google.com/project/${firebaseConfig.projectId}/firestore/rules`);
      console.error('');
      console.error('測試用規則（允許所有讀寫）：');
      console.error('');
      console.error("rules_version = '2';");
      console.error('service cloud.firestore {');
      console.error('  match /databases/{database}/documents {');
      console.error('    match /{document=**} {');
      console.error('      allow read, write: if true;');
      console.error('    }');
      console.error('  }');
      console.error('}');
    } else if (error.message.includes('Cannot find package')) {
      console.error('⚠️ Firebase 模組未安裝！');
      console.error('');
      console.error('請執行以下命令安裝：');
      console.error('npm install firebase');
    } else {
      console.error('完整錯誤:', error);
    }

    process.exit(1);
  }
}

// 執行測試
testFirebase();
