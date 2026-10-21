// Copy the game's static map files (manifest.json + *.glb) into the
// dashboard's public/maps so the Map Editor can load them same-origin
// (no second dev server, no CORS). Runs automatically via predev/prebuild.
//
// Also copies the generated building packs (tools/buildings/out/<pack>/) into
// public/building-packs and writes an index.json, so the asset library can
// import a pack with one click instead of selecting every GLB by hand.
//
// The copied files are gitignored; the source of truth stays in
// packages/client/public/maps and tools/buildings/out. Override the map
// source with MAP_SOURCE_DIR.

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src =
  process.env.MAP_SOURCE_DIR ||
  resolve(here, '../../../client/public/maps');
const dest = resolve(here, '../public/maps');

if (!existsSync(src)) {
  console.warn(`[copy-maps] source not found, skipping: ${src}`);
} else {
  mkdirSync(dirname(dest), { recursive: true });
  cpSync(src, dest, { recursive: true });
  console.log(`[copy-maps] copied ${src} -> ${dest}`);
}

const packSrc = resolve(here, '../../../../tools/buildings/out');
const packDest = resolve(here, '../public/building-packs');
if (!existsSync(packSrc)) {
  console.warn(`[copy-maps] building packs not found, skipping: ${packSrc}`);
} else {
  rmSync(packDest, { recursive: true, force: true });
  const index = [];
  for (const dir of readdirSync(packSrc, { withFileTypes: true })) {
    const manifestPath = join(packSrc, dir.name, 'manifest.json');
    if (!dir.isDirectory() || !existsSync(manifestPath)) continue;
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    cpSync(join(packSrc, dir.name), join(packDest, dir.name), {
      recursive: true,
      filter: (p) => !p.endsWith('.png'), // 平面預覽圖唔需要
    });
    index.push({
      dir: dir.name,
      packId: manifest.packId,
      chunkId: manifest.chunkId,
      buildings: manifest.buildings?.length ?? 0,
    });
  }
  mkdirSync(packDest, { recursive: true });
  writeFileSync(join(packDest, 'index.json'), JSON.stringify(index, null, 2));
  console.log(`[copy-maps] copied ${index.length} building pack(s) -> ${packDest}`);
}
