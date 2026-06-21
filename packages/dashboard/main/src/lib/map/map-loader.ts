/**
 * Map loading helpers (Map Editor — P1)
 *
 * 底圖 GLB 維持靜態檔（由遊戲客戶端 / Cloudflare Pages 免費供應），
 * 後台用網址 fetch 載入，不佔 Firebase Storage 額度。
 *
 * 來源網址以環境變數 NEXT_PUBLIC_MAP_BASE_URL 設定；
 * 本地開發預設指向 Vite 客戶端 dev server（port 5173）的 /maps 目錄。
 */

import type { MapManifest } from '@/types/map';

export const MAP_BASE_URL = (
  process.env.NEXT_PUBLIC_MAP_BASE_URL || 'http://localhost:5173/maps'
).replace(/\/$/, '');

export function getManifestUrl(): string {
  return `${MAP_BASE_URL}/manifest.json`;
}

export function getChunkUrl(file: string): string {
  return `${MAP_BASE_URL}/${file}`;
}

export async function loadMapManifest(): Promise<MapManifest> {
  const res = await fetch(getManifestUrl());
  if (!res.ok) {
    throw new Error(`Failed to load manifest: ${res.status} ${res.statusText}`);
  }
  return res.json();
}
