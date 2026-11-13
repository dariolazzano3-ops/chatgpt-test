// Echter 3D-Rendertest mit dem echten three.js (kein Stub). Auf einem eigenen Rechner ausführen:
//   npm install && npm install --no-save playwright && npx playwright install chromium && npm run dev   (zweites Terminal:)  npm run check:3d
// Optional gegen die veröffentlichte Seite: URL=https://….workers.dev npm run check:3d
// Ergebnis: Bildschirmfotos in tools/render-out/ und eine Bewertung, ob wirklich etwas gezeichnet wurde.
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
let chromium; try { ({ chromium } = await import('playwright')); } catch (e) { console.error('Playwright fehlt: npm install --no-save playwright && npx playwright install chromium'); process.exit(1); }
const out = path.join(path.dirname(fileURLToPath(import.meta.url)), 'render-out'); fs.mkdirSync(out, { recursive: true });
const URL_ = process.env.URL || 'http://localhost:8787/';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const res = []; const ok = (n, v, i) => { res.push(v); console.log((v ? 'PASS ' : 'FAIL ') + n + (i !== undefined ? '  ' + i : '')); };
for (const [label, ctxOpts] of [['desktop', { viewport: { width: 1280, height: 720 } }], ['phone-landscape', { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }]]) {
  const ctx = await browser.newContext(ctxOpts); const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.goto(URL_, { waitUntil: 'load' }); await page.waitForTimeout(1500);
  const info = await page.evaluate(() => { const c = document.createElement('canvas'); const gl = c.getContext('webgl2') || c.getContext('webgl');
    return { rev: window.THREE && THREE.REVISION, gl: !!gl, renderer: gl ? gl.getParameter(gl.RENDERER) : '', canvases: document.querySelectorAll('canvas').length,
      src: [...document.scripts].map(s => s.src).filter(s => /three/.test(s)) }; });
  ok(label + ': three.js r128 geladen', info.rev === '128', JSON.stringify(info.src));
  ok(label + ': WebGL verfügbar', info.gl, info.renderer);
  const menu = await page.screenshot({ path: path.join(out, label + '-1-menu.jpg'), type: 'jpeg', quality: 80 });
  await page.click('#startBtn'); await page.waitForTimeout(2500);
  const s1 = await page.screenshot({ path: path.join(out, label + '-2-spiel.jpg'), type: 'jpeg', quality: 80 });
  // Umsehen und schießen
  if (label === 'desktop') { await page.mouse.move(640, 360); await page.mouse.move(820, 330, { steps: 8 }); await page.mouse.down(); await page.waitForTimeout(400); await page.mouse.up(); }
  else { await page.touchscreen.tap(780, 300); }
  await page.waitForTimeout(6000);
  const s2 = await page.screenshot({ path: path.join(out, label + '-3-welle.jpg'), type: 'jpeg', quality: 80 });
  // Ein Bild aus nur einer Farbe ist als JPEG winzig; eine gezeichnete Szene deutlich größer.
  ok(label + ': Szene gezeichnet (Bild nicht einfarbig)', s1.length > 40000, Math.round(s1.length / 1024) + ' KB');
  ok(label + ': Bild ändert sich im Spielverlauf', Math.abs(s2.length - s1.length) > 2000, Math.round(s2.length / 1024) + ' KB');
  ok(label + ': keine JS-Fehler', errs.length === 0, errs.slice(0, 3).join(' | '));
  await ctx.close();
}
await browser.close();
console.log(`\n${res.filter(Boolean).length}/${res.length} bestanden. Bitte die Bilder in ${out} ansehen: Kuchen, Ziegen mit Gesicht, Waffe, Fadenkreuz.`);
