/**
 * Firebase 直接測試腳本
 *
 * 使用方法：
 * 1. 在 Dashboard 頁面打開瀏覽器開發者工具 (F12)
 * 2. 切換到 Console 分頁
 * 3. 複製並貼上整個腳本
 * 4. 按 Enter 執行
 * 5. 執行 testCreateItem() 測試新增道具
 */

(async function setupFirebaseTest() {
    console.log('🔧 設定 Firebase 測試環境...');

    // 這個函數會直接使用已經初始化的 Firebase
    window.testCreateItem = async function() {
        try {
            console.log('🚀 開始測試新增道具...');
            console.log('=====================================');

            // 動態載入 Firebase 模組
            const { collection, addDoc, Timestamp } = await import('https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js');
            const { getFirestore } = await import('https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js');
            const { getApps } = await import('https://www.gstatic.com/firebasejs/11.1.0/firebase-app.js');

            // 獲取已初始化的 Firebase app
            const apps = getApps();
            if (apps.length === 0) {
                console.error('❌ Firebase 尚未初始化');
                console.log('請重新載入頁面');
                return;
            }

            const app = apps[0];
            const db = getFirestore(app);

            console.log('✅ 取得 Firebase 實例');
            console.log('專案:', app.options.projectId);

            // 創建測試道具
            const testItem = {
                name: '直接測試道具_' + new Date().toLocaleTimeString(),
                description: '這是透過 Console 直接新增的測試道具',
                category: 'consumable',
                imageUrl: '/images/no-image.png',
                price: 999,
                sellPrice: 499,
                isTradeable: true,
                isDroppable: true,
                isActive: true,
                attributes: {
                    hpRestore: 50,
                    cooldown: 5
                },
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now()
            };

            console.log('📦 準備新增的道具資料:');
            console.log(testItem);
            console.log('');

            console.log('⏳ 正在寫入 Firestore...');

            const itemsRef = collection(db, 'items');
            const docRef = await addDoc(itemsRef, testItem);

            console.log('');
            console.log('=====================================');
            console.log('✨ 成功新增道具！');
            console.log('道具 ID:', docRef.id);
            console.log('=====================================');
            console.log('');
            console.log('請到以下位置確認:');
            console.log(`1. Firebase Console: https://console.firebase.google.com/project/${app.options.projectId}/firestore`);
            console.log('2. Dashboard 道具列表頁面');

            return docRef.id;

        } catch (error) {
            console.error('');
            console.error('=====================================');
            console.error('❌ 新增失敗！');
            console.error('=====================================');
            console.error('錯誤訊息:', error.message);
            console.error('錯誤代碼:', error.code);
            console.error('完整錯誤:', error);
            console.error('');

            if (error.code === 'permission-denied') {
                console.error('⚠️ 權限不足！');
                console.error('');
                console.error('請到 Firebase Console 設定 Firestore 安全規則:');
                console.error('https://console.firebase.google.com/project/' + (getApps()[0]?.options?.projectId || 'YOUR_PROJECT') + '/firestore/rules');
                console.error('');
                console.error('測試用規則（允許所有讀寫）:');
                console.error('');
                console.error('rules_version = \'2\';');
                console.error('service cloud.firestore {');
                console.error('  match /databases/{database}/documents {');
                console.error('    match /{document=**} {');
                console.error('      allow read, write: if true;');
                console.error('    }');
                console.error('  }');
                console.error('}');
            } else if (error.message.includes('Failed to fetch') || error.message.includes('ERR_BLOCKED_BY_CLIENT')) {
                console.error('⚠️ 請求被阻擋！');
                console.error('');
                console.error('可能原因:');
                console.error('1. 瀏覽器擴充功能（廣告攔截器、隱私保護工具等）');
                console.error('2. 防火牆或網路政策');
                console.error('3. Brave 瀏覽器的 Shields');
                console.error('');
                console.error('建議:');
                console.error('1. 使用無痕模式測試');
                console.error('2. 暫時停用所有瀏覽器擴充功能');
            }

            return null;
        }
    };

    window.testReadItems = async function() {
        try {
            console.log('📖 開始讀取道具列表...');
            console.log('=====================================');

            const { collection, getDocs } = await import('https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js');
            const { getFirestore } = await import('https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js');
            const { getApps } = await import('https://www.gstatic.com/firebasejs/11.1.0/firebase-app.js');

            const apps = getApps();
            if (apps.length === 0) {
                console.error('❌ Firebase 尚未初始化');
                return;
            }

            const app = apps[0];
            const db = getFirestore(app);

            const itemsRef = collection(db, 'items');
            const snapshot = await getDocs(itemsRef);

            console.log('✅ 讀取成功！');
            console.log(`共有 ${snapshot.size} 個道具`);
            console.log('');

            if (snapshot.size === 0) {
                console.log('⚠️ 目前沒有任何道具');
            } else {
                console.log('道具列表:');
                snapshot.forEach((doc, index) => {
                    const data = doc.data();
                    console.log(`${index + 1}. ${data.name} (ID: ${doc.id})`);
                    console.log(`   分類: ${data.category}, 價格: $${data.price}`);
                });
            }

            console.log('=====================================');

        } catch (error) {
            console.error('❌ 讀取失敗:', error.message);
            console.error('錯誤代碼:', error.code);
            console.error('完整錯誤:', error);
        }
    };

    console.log('');
    console.log('✅ Firebase 測試環境設定完成！');
    console.log('');
    console.log('可用的測試函數:');
    console.log('1. testCreateItem()  - 測試新增道具');
    console.log('2. testReadItems()   - 測試讀取道具列表');
    console.log('');
    console.log('執行範例:');
    console.log('  testCreateItem()');
    console.log('');
})();
