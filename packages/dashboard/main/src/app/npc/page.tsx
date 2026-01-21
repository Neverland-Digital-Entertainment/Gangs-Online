import Link from 'next/link';
import { FileText, MapPin, Plus, ArrowRight } from 'lucide-react';

export default function NpcManagementPage() {
  return (
    <div className="container-fixed">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[var(--foreground)] mb-2">
          NPC 管理系統
        </h1>
        <p className="text-[var(--muted-foreground)]">
          管理遊戲中的 NPC 角色、對話和互動系統
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* NPC Templates */}
        <Link href="/npc/templates" className="group">
          <div className="card hover:shadow-lg transition-all duration-200 h-full">
            <div className="card-body">
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <FileText className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                </div>
                <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-primary transition-colors" />
              </div>
              <h3 className="text-xl font-semibold text-[var(--foreground)] mb-2">
                NPC 模板
              </h3>
              <p className="text-[var(--muted-foreground)] text-sm mb-4">
                管理 NPC 定義、基礎屬性、對話樹和行為設定
              </p>
              <div className="flex items-center gap-2 text-sm text-primary font-medium">
                <span>管理模板</span>
                <ArrowRight className="w-4 h-4" />
              </div>
            </div>
          </div>
        </Link>

        {/* NPC Instances */}
        <Link href="/npc/instances" className="group">
          <div className="card hover:shadow-lg transition-all duration-200 h-full">
            <div className="card-body">
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
                  <MapPin className="w-8 h-8 text-green-600 dark:text-green-400" />
                </div>
                <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-primary transition-colors" />
              </div>
              <h3 className="text-xl font-semibold text-[var(--foreground)] mb-2">
                NPC 實例
              </h3>
              <p className="text-[var(--muted-foreground)] text-sm mb-4">
                在地圖上放置 NPC、設定位置和移動模式
              </p>
              <div className="flex items-center gap-2 text-sm text-primary font-medium">
                <span>管理實例</span>
                <ArrowRight className="w-4 h-4" />
              </div>
            </div>
          </div>
        </Link>
      </div>

      {/* Quick Actions */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">快速操作</h2>
        </div>
        <div className="card-body">
          <div className="flex flex-wrap gap-4">
            <Link href="/npc/templates/new">
              <button className="btn btn-primary">
                <Plus className="w-4 h-4 mr-2" />
                新增 NPC 模板
              </button>
            </Link>
            <Link href="/npc/instances/new">
              <button className="btn btn-outline">
                <Plus className="w-4 h-4 mr-2" />
                新增 NPC 實例
              </button>
            </Link>
          </div>
        </div>
      </div>

      {/* Features Overview */}
      <div className="mt-8 card">
        <div className="card-header">
          <h2 className="card-title">系統功能</h2>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold text-[var(--foreground)] mb-2">
                📋 NPC 模板管理
              </h3>
              <ul className="space-y-2 text-sm text-[var(--muted-foreground)]">
                <li>✓ 定義 NPC 基礎屬性（HP、攻擊、防禦）</li>
                <li>✓ 設定 NPC 類型（市民、警察、幫派、商店、任務）</li>
                <li>✓ 視覺化對話樹編輯器</li>
                <li>✓ 戰鬥設定（近戰/遠程、攻擊範圍）</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-[var(--foreground)] mb-2">
                🗺️ NPC 實例管理
              </h3>
              <ul className="space-y-2 text-sm text-[var(--muted-foreground)]">
                <li>✓ 互動式地圖座標選擇器</li>
                <li>✓ 設定移動模式（靜止/徘徊/巡邏）</li>
                <li>✓ 配置等級和動態屬性</li>
                <li>✓ 戰鬥行為設定（仇恨範圍、追擊距離）</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
