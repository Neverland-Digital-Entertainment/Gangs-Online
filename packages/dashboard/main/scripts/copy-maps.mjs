// Copy the game's static map files (manifest.json + *.glb) into the
// dashboard's public/maps so the Map Editor can load them same-origin
// (no second dev server, no CORS). Runs automatically via predev/prebuild.
//
// The copied files are gitignored; the source of truth stays in
// packages/client/public/maps. Override the source with MAP_SOURCE_DIR.

import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src =
  process.env.MAP_SOURCE_DIR ||
  resolve(here, '../../../client/public/maps');
const dest = resolve(here, '../public/maps');

if (!existsSync(src)) {
  console.warn(`[copy-maps] source not found, skipping: ${src}`);
  process.exit(0);
}

mkdirSync(dirname(dest), { recursive: true });
cpSync(src, dest, { recursive: true });
console.log(`[copy-maps] copied ${src} -> ${dest}`);
