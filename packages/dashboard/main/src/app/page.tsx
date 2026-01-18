import Link from 'next/link';
import { Package, Users, ScrollText, ArrowRight } from 'lucide-react';

export default function DashboardHome() {
  return (
    <div className="container-fixed">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          歡迎使用 Gangs Online 管理後台
        </h1>
        <p className="text-gray-600">
          版本 0.16.1 - 選擇一個模組開始管理遊戲內容
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Item Management */}
        <Link href="/dashboard/item" className="group">
          <div className="card hover:shadow-lg transition-all duration-200 h-full">
            <div className="card-body">
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-primary-light rounded-lg">
                  <Package className="w-8 h-8 text-primary" />
                </div>
                <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-primary transition-colors" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                道具管理
              </h3>
              <p className="text-gray-600 text-sm mb-4">
                管理遊戲中的所有道具，包含消耗品、宗教道具、非法物資和素材
              </p>
              <div className="flex items-center gap-2 text-sm text-primary font-medium">
                <span>進入管理</span>
                <ArrowRight className="w-4 h-4" />
              </div>
            </div>
          </div>
        </Link>

        {/* NPC Management - Coming Soon */}
        <div className="group cursor-not-allowed">
          <div className="card opacity-60 h-full">
            <div className="card-body">
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-gray-100 rounded-lg">
                  <Users className="w-8 h-8 text-gray-400" />
                </div>
                <span className="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded">
                  即將推出
                </span>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                NPC 管理
              </h3>
              <p className="text-gray-600 text-sm mb-4">
                管理遊戲中的 NPC 角色、對話和互動系統
              </p>
              <div className="flex items-center gap-2 text-sm text-gray-400 font-medium">
                <span>開發中</span>
              </div>
            </div>
          </div>
        </div>

        {/* Quest Management - Coming Soon */}
        <div className="group cursor-not-allowed">
          <div className="card opacity-60 h-full">
            <div className="card-body">
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-gray-100 rounded-lg">
                  <ScrollText className="w-8 h-8 text-gray-400" />
                </div>
                <span className="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded">
                  即將推出
                </span>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                任務管理
              </h3>
              <p className="text-gray-600 text-sm mb-4">
                管理遊戲任務、獎勵和任務鏈系統
              </p>
              <div className="flex items-center gap-2 text-sm text-gray-400 font-medium">
                <span>開發中</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-12 card">
        <div className="card-header">
          <h2 className="card-title">快速開始</h2>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">
                📦 道具管理系統
              </h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>✓ 創建和編輯道具</li>
                <li>✓ 四種道具分類支援</li>
                <li>✓ 圖片上傳管理</li>
                <li>✓ 搜尋和過濾功能</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">
                🔜 即將推出
              </h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>• NPC 管理系統</li>
                <li>• 任務管理系統</li>
                <li>• 商店管理系統</li>
                <li>• 數據統計儀表板</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
