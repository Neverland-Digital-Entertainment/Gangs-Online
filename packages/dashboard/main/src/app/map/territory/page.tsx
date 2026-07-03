'use client';

/**
 * Map Management — 地盤設置模組（Phase 21）
 * 掛在地圖管理（Map Management）之下，與地圖編輯器共用同一份地圖來源
 * （copy-maps 腳本會在 dev/build 前把 client 地圖複製到 public/maps）。
 * Babylon.js 需要瀏覽器環境，關閉 SSR 動態載入。
 */
import dynamic from 'next/dynamic';
import { useAuth } from '@/contexts/auth-context';

const TerritoryEditor = dynamic(
    () => import('@/components/territory/TerritoryEditor'),
    { ssr: false, loading: () => <div className="p-8 text-center">載入地盤編輯器中...</div> }
);

export default function TerritoryPage() {
    const { hasPermission } = useAuth();
    const canEdit = hasPermission('map.edit');
    return (
        <div className="p-4">
            <h1 className="text-xl font-bold mb-3">🚩 地盤設置（Territory）</h1>
            <TerritoryEditor canEdit={canEdit} />
        </div>
    );
}
