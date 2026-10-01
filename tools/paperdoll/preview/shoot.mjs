// Screenshot fitted garments on a body, using the same loading/A-pose/rebind
// logic as the dashboard's CharacterViewer.
//
//   cd tools/paperdoll/preview && npm install
//   node shoot.mjs <outPrefix> <gender> <items> [pose] [views] [xray] [zoom]
//   node shoot.mjs shots/outfit male top/male/shirt01.glb,bottom/male/pants01.glb
//
// items: comma-separated paths under packages/shared/characters
// pose : apose (viewer default) | tpose | arms:<radians>
// views: comma-separated, see V below      zoom: "<radiusMul>:<targetY>"
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOTS = {
  '/characters/': join(HERE, '../../../packages/shared/characters/'),
  '/node_modules/': join(HERE, 'node_modules/'),
  '/': HERE + '/',
};
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.glb': 'model/gltf-binary', '.webp': 'image/webp' };

const server = createServer(async (req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  const prefix = Object.keys(ROOTS).find((p) => url.startsWith(p));
  const file = normalize(join(ROOTS[prefix], url.slice(prefix.length)));
  try {
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
    res.end(await readFile(file));
  } catch {
    res.writeHead(404).end();
  }
}).listen(0);
const port = server.address().port;

const [outPrefix, gender, items = '', pose = 'apose', views = 'front,side,back', xray = '0', zoom = ''] = process.argv.slice(2);
const V = {
  front: [-Math.PI / 2], side: [Math.PI], back: [Math.PI / 2], q34: [-Math.PI / 4],
  backr: [Math.PI / 4, 1.4], sidelow: [Math.PI, 1.9], frontlow: [-Math.PI / 2 - 0.5, 1.85], topdown: [-Math.PI / 2, 0.25],
};
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
try {
  const page = await browser.newPage({ viewport: { width: 640, height: 800 } });
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('[page]', m.text()); });
  await page.goto(`http://localhost:${port}/index.html?gender=${gender}&items=${encodeURIComponent(items)}&pose=${pose}&xray=${xray}`);
  await page.waitForFunction(() => window.ready === true, null, { timeout: 120000 });
  const errs = await page.evaluate(() => window.errors);
  if (errs.length) console.log('ERRORS', errs);
  const [rm, ty] = zoom ? zoom.split(':').map(Number) : [undefined, undefined];
  for (const v of views.split(',')) {
    const [a, b] = V[v];
    await page.evaluate(([a, b, rm, ty]) => window.setView(a, b, rm, ty), [a, b, rm, ty]);
    await page.waitForTimeout(400);
    await page.locator('canvas').screenshot({ path: `${outPrefix}_${v}.png` });
  }
  console.log('ok', outPrefix);
} finally {
  await browser.close();
  server.close();
}
