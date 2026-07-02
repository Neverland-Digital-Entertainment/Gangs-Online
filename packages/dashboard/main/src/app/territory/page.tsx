'use client';

/**
 * Map Management — 地盤設置模組（Phase 21）
 * Babylon.js 需要瀏覽器環境，關閉 SSR 動態載入
 */
import dynamic from 'next/dynamic';

const TerritoryEditor = dynamic(
    () => import('@/components/territory/TerritoryEditor'),
    { ssr: false, loading: () => <div className="p-8 text-center">載入地盤編輯器中...</div> }
);

export default function TerritoryPage() {
    return (
        <div className="p-4">
            <h1 className="text-xl font-bold mb-3">🚩 地盤設置（Map Management）</h1>
            <TerritoryEditor />
        </div>
    );
}
