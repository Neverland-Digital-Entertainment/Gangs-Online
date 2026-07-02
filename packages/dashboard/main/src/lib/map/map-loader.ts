/**
 * Map loading helpers (Map Editor — P1)
 *
 * 底圖 GLB 維持靜態檔（由遊戲客戶端 / Cloudflare Pages 免費供應），
 * 後台用網址 fetch 載入，不佔 Firebase Storage 額度。
 *
 * 預設由後台自己以同源 /maps 供應（dev/build 前的 copy-maps 腳本會把
 * client/public/maps 複製到本套件的 public/maps，免第二個 server、無 CORS）。
 * 若要改從外部來源載入，設定環境變數 NEXT_PUBLIC_MAP_BASE_URL 即可。
 */

import type { MapManifest } from '@/types/map';

export const MAP_BASE_URL = (
  process.env.NEXT_PUBLIC_MAP_BASE_URL || '/maps'
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
