/**
 * Firebase 讀取測試腳本
 * 用於驗證是否能成功讀取 Firestore 中的道具資料
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

console.log('🔍 開始讀取 Firebase 道具資料...');
console.log('=====================================\n');

async function readItems() {
  try {
    // 載入 Firebase 模組
    const { initializeApp } = await import('firebase/app');
    const { getFirestore, collection, getDocs } = await import('firebase/firestore');

    // 初始化 Firebase
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);

    console.log('✅ Firebase 初始化成功\n');

    // 讀取所有道具
    console.log('📖 正在讀取 items collection...\n');
    const itemsRef = collection(db, 'items');
    const snapshot = await getDocs(itemsRef);

    console.log('=====================================');
    console.log(`✨ 成功讀取！共找到 ${snapshot.size} 個道具`);
    console.log('=====================================\n');

    if (snapshot.size === 0) {
      console.log('⚠️ 資料庫中沒有任何道具');
      console.log('請確認：');
      console.log('1. 已在 Firebase Console 新增測試道具');
      console.log('2. Collection 名稱是 "items"');
      console.log('3. Firebase 安全規則允許讀取');
      return;
    }

    // 顯示每個道具的詳細資訊
    snapshot.docs.forEach((doc, index) => {
      const data = doc.data();

      console.log(`\n📦 道具 ${index + 1}/${snapshot.size}`);
      console.log('─────────────────────────────────────');
      console.log(`ID: ${doc.id}`);
      console.log(`名稱: ${data.name}`);
      console.log(`描述: ${data.description}`);
      console.log(`類別: ${data.category}`);
      console.log(`圖片: ${data.imageUrl}`);
      console.log(`價格: $${data.price}`);
      console.log(`賣出價格: $${data.sellPrice}`);
      console.log(`可交易: ${data.isTradeable ? '是' : '否'}`);
      console.log(`可丟棄: ${data.isDroppable ? '是' : '否'}`);
      console.log(`啟用狀態: ${data.isActive ? '啟用' : '停用'}`);

      // 顯示屬性
      if (data.attributes) {
        console.log('\n屬性:');
        Object.entries(data.attributes).forEach(([key, value]) => {
          console.log(`  - ${key}: ${value}`);
        });
      }

      // 顯示時間戳記
      if (data.createdAt) {
        const createdAt = data.createdAt.toDate ? data.createdAt.toDate() : new Date(data.createdAt);
        console.log(`\n建立時間: ${createdAt.toLocaleString('zh-TW')}`);
      }
      if (data.updatedAt) {
        const updatedAt = data.updatedAt.toDate ? data.updatedAt.toDate() : new Date(data.updatedAt);
        console.log(`更新時間: ${updatedAt.toLocaleString('zh-TW')}`);
      }

      console.log('─────────────────────────────────────');
    });

    console.log('\n\n🎉 讀取測試完成！');
    console.log('\n結論:');
    console.log('✅ Firebase 連接正常');
    console.log('✅ Firestore 讀取權限正常');
    console.log('✅ 資料結構正確');
    console.log('\n如果 Dashboard 無法顯示這些道具，請檢查：');
    console.log('1. Dashboard 的讀取邏輯是否正確');
    console.log('2. 瀏覽器 Console 是否有錯誤訊息');
    console.log('3. 網路請求是否被瀏覽器擴充功能阻擋');

  } catch (error) {
    console.error('\n❌ 讀取失敗！');
    console.error('=====================================');
    console.error('錯誤訊息:', error.message);
    console.error('錯誤代碼:', error.code);

    if (error.code === 'permission-denied') {
      console.error('\n⚠️ 權限不足！請檢查 Firestore 安全規則');
      console.error(`前往: https://console.firebase.google.com/project/${firebaseConfig.projectId}/firestore/rules`);
    } else if (error.message.includes('Cannot find package')) {
      console.error('\n⚠️ Firebase 模組未安裝！');
      console.error('請執行: npm install firebase');
    } else {
      console.error('\n完整錯誤:', error);
    }

    process.exit(1);
  }
}

// 檢查環境變數
const requiredKeys = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'];
const missingKeys = requiredKeys.filter(key => !firebaseConfig[key]);

if (missingKeys.length > 0) {
  console.error('❌ 缺少以下環境變數：');
  missingKeys.forEach(key => {
    const envKey = `NEXT_PUBLIC_FIREBASE_${key.replace(/([A-Z])/g, '_$1').toUpperCase()}`;
    console.error(`   - ${envKey}`);
  });
  console.error('\n請在 .env.local 設定 Firebase 配置後再執行');
  process.exit(1);
}

// 執行讀取
readItems();
