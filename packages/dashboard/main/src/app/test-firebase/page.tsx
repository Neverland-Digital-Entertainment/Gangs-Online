'use client';

import { useState } from 'react';
import { itemService } from '@/lib/item/service';
import { ItemCategory, type ItemFormData } from '@/types/item';

export default function TestFirebasePage() {
  const [logs, setLogs] = useState<string[]>([]);
  const [testing, setTesting] = useState(false);

  function addLog(message: string, type: 'info' | 'success' | 'error' = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const prefix = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
    setLogs(prev => [...prev, `[${timestamp}] ${prefix} ${message}`]);
    console.log(`${prefix} ${message}`);
  }

  async function testReadItems() {
    setTesting(true);
    addLog('開始測試讀取道具列表...', 'info');

    try {
      const items = await itemService.getItems();
      addLog(`成功讀取！共 ${items.length} 個道具`, 'success');

      items.forEach((item, i) => {
        addLog(`  ${i + 1}. ${item.name} (ID: ${item.id})`, 'info');
      });
    } catch (error: any) {
      addLog(`讀取失敗: ${error.message}`, 'error');
      if (error.code) {
        addLog(`錯誤代碼: ${error.code}`, 'error');
      }
    } finally {
      setTesting(false);
    }
  }

  async function testCreateItem() {
    setTesting(true);
    addLog('開始測試新增道具...', 'info');

    const testItem: ItemFormData = {
      name: `測試道具_${Date.now()}`,
      description: '這是一個自動測試建立的道具',
      category: ItemCategory.CONSUMABLE,
      imageUrl: '/images/no-image.png',
      price: 100,
      sellPrice: 50,
      isTradeable: true,
      isDroppable: true,
      isActive: true,
      attributes: {
        hpRestore: 10,
        vpRestore: 5,
        cooldown: 30,
      },
    };

    addLog(`道具名稱: ${testItem.name}`, 'info');

    try {
      const itemId = await itemService.createItem(testItem);
      addLog(`新增成功！道具 ID: ${itemId}`, 'success');
      addLog('請到 Firebase Console 確認資料已寫入', 'info');
    } catch (error: any) {
      addLog(`新增失敗: ${error.message}`, 'error');
      if (error.code) {
        addLog(`錯誤代碼: ${error.code}`, 'error');
      }

      if (error.code === 'permission-denied') {
        addLog('', 'error');
        addLog('⚠️ 權限不足！請檢查 Firestore 安全規則', 'error');
        addLog('建議的測試規則:', 'info');
        addLog('rules_version = \'2\';', 'info');
        addLog('service cloud.firestore {', 'info');
        addLog('  match /databases/{database}/documents {', 'info');
        addLog('    match /{document=**} {', 'info');
        addLog('      allow read, write: if true;', 'info');
        addLog('    }', 'info');
        addLog('  }', 'info');
        addLog('}', 'info');
      }
    } finally {
      setTesting(false);
    }
  }

  async function testFullCycle() {
    setTesting(true);
    addLog('=== 開始完整測試流程 ===', 'info');

    // Step 1: Read existing items
    addLog('Step 1: 讀取現有道具...', 'info');
    try {
      const items = await itemService.getItems();
      addLog(`現有道具數量: ${items.length}`, 'success');
    } catch (error: any) {
      addLog(`讀取失敗: ${error.message}`, 'error');
      setTesting(false);
      return;
    }

    // Step 2: Create new item
    addLog('Step 2: 建立新道具...', 'info');
    const testItem: ItemFormData = {
      name: `完整測試道具_${Date.now()}`,
      description: '完整測試流程建立的道具',
      category: ItemCategory.MATERIAL,
      imageUrl: '/images/no-image.png',
      price: 999,
      sellPrice: 500,
      isTradeable: true,
      isDroppable: false,
      isActive: true,
      attributes: {
        stackLimit: 50,
      },
    };

    let newItemId: string;
    try {
      newItemId = await itemService.createItem(testItem);
      addLog(`新道具建立成功！ID: ${newItemId}`, 'success');
    } catch (error: any) {
      addLog(`建立失敗: ${error.message}`, 'error');
      setTesting(false);
      return;
    }

    // Step 3: Read the new item
    addLog('Step 3: 讀取剛建立的道具...', 'info');
    try {
      const item = await itemService.getItem(newItemId);
      if (item) {
        addLog(`讀取成功！`, 'success');
        addLog(`  - 名稱: ${item.name}`, 'info');
        addLog(`  - 價格: $${item.price}`, 'info');
        addLog(`  - 分類: ${item.category}`, 'info');
      } else {
        addLog('找不到剛建立的道具！', 'error');
      }
    } catch (error: any) {
      addLog(`讀取失敗: ${error.message}`, 'error');
    }

    // Step 4: Verify in list
    addLog('Step 4: 確認道具出現在列表中...', 'info');
    try {
      const items = await itemService.getItems();
      const found = items.find(item => item.id === newItemId);
      if (found) {
        addLog(`確認成功！道具已出現在列表中`, 'success');
        addLog(`現在總共有 ${items.length} 個道具`, 'info');
      } else {
        addLog('道具未出現在列表中！', 'error');
      }
    } catch (error: any) {
      addLog(`確認失敗: ${error.message}`, 'error');
    }

    addLog('=== 完整測試流程結束 ===', 'info');
    setTesting(false);
  }

  return (
    <div className="container-fixed py-10">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">🔥 Firebase 測試頁面</h1>
        <p className="text-gray-600 mb-6">
          這個頁面用於測試 Firebase 連線和道具 CRUD 操作。
        </p>

        <div className="flex gap-4 mb-6">
          <button
            onClick={testReadItems}
            disabled={testing}
            className="btn btn-primary"
          >
            1️⃣ 測試讀取
          </button>
          <button
            onClick={testCreateItem}
            disabled={testing}
            className="btn btn-success"
          >
            2️⃣ 測試新增
          </button>
          <button
            onClick={testFullCycle}
            disabled={testing}
            className="btn btn-info"
          >
            3️⃣ 完整測試
          </button>
          <button
            onClick={() => setLogs([])}
            className="btn btn-light"
          >
            🗑️ 清除日誌
          </button>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">測試日誌</h3>
          </div>
          <div className="card-body">
            <div className="bg-black text-green-400 p-4 rounded-lg font-mono text-sm min-h-[300px] max-h-[500px] overflow-y-auto">
              {logs.length === 0 ? (
                <div className="text-gray-500">點擊上方按鈕開始測試...</div>
              ) : (
                logs.map((log, i) => (
                  <div key={i} className={
                    log.includes('❌') ? 'text-red-400' :
                    log.includes('✅') ? 'text-green-400' :
                    'text-blue-300'
                  }>
                    {log}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <h4 className="font-semibold text-yellow-800 mb-2">💡 提示</h4>
          <ul className="text-sm text-yellow-700 space-y-1">
            <li>• 開啟瀏覽器開發者工具 (F12) 查看詳細的 Console 日誌</li>
            <li>• 如果看到權限錯誤，請檢查 Firestore 安全規則</li>
            <li>• 如果環境變數未設定，請在 Cloudflare Pages 設定</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
