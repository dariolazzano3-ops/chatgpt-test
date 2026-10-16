import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,statSync,existsSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>readFileSync(path.join(root,p),'utf8');
const routes=['index.html','eissorten/index.html','eisbecher/index.html','getraenke/index.html','events/index.html','eistorten/index.html','eisvitrine/index.html','kontakt/index.html'];
test('Eight premium route pages maintain meaningful titles, description, single H1 and private SEO guards',()=>{
 for(const p of routes){
  const s=read(p);
  assert.match(s,/<title>[\s\S]*?<\/title>/,p);
  assert.match(s,/<meta name="description"/,p);
  assert.equal((s.match(/<h1(?:\s|>)/g)||[]).length,1,p);
  assert.match(s,/name="robots" content="noindex,nofollow,noarchive"/,p);
 }
 assert.match(read('robots.txt'),/Disallow: \//);
 assert.match(read('_headers'),/X-Robots-Tag: noindex, nofollow, noarchive/);
});
test('Launch performance: hero visuals prioritized, three below-fold drinks lazy, navigation logo aspect stable',()=>{
 assert.match(read('index.html'),/pistazie\.webp"[^>]+loading="eager" fetchpriority="high"/);
 assert.match(read('eisbecher/index.html'),/tartufo-becher\.webp"[^>]+loading="eager" fetchpriority="high"/);
 assert.match(read('events/index.html'),/gelato-event-eislabor-original-v125\.jpg"[\s\S]{0,280}fetchpriority="high"/);
 assert.match(read('eisvitrine/index.html'),/gelato-vitrine-produkt\.webp"[\s\S]{0,240}fetchpriority="high"/);
 for(const image of ['orange-flip.webp','eiskaffee.webp','eisschokolade.webp'])
  assert.match(read('getraenke/index.html'),new RegExp(image.replace('.','\\.')+'[^>]+loading="lazy"'),image);
 assert.match(read('assets/js/components/nav.js'),/class="site-header__logo" width="772" height="86" decoding="async"/);
});
test('Three private synthetic APIs still share one only-private worker entry point',()=>{
 const s=read('wrangler.private-preview.jsonc');
 assert.match(s,/"name": "gelato-donatello-private-preview-v2"/);
 assert.match(s,/"main": "\.\/scripts\/rental-inquiry-api-v128\.mjs"/);
 assert.match(s,/"run_worker_first": \["\/api\/\*"\]/);
 const worker=read('scripts/rental-inquiry-api-v128.mjs');
 assert.match(worker,/import cakeWorker from '\.\/cake-inquiry-api-v127\.mjs'/);
 assert.match(read('scripts/cake-inquiry-api-v127.mjs'),/import eventWorker from '\.\/event-interest-api-v126\.mjs'/);
 assert.match(worker,/ONLY_SYNTHETIC_EMAIL/);
 assert.doesNotMatch(worker,/\.prepare\(|\.run\(|sendMail|sendEmail|\.put\(/i);
});
test('Evidence contains all reviewed eight main screens on both iPhone and desktop and 3 synthetic receipts',()=>{
 for(const f of ['iphone-pages-v129.webp','desktop-pages-v129.webp','forms-success-v129.webp']){
  const name='docs/launch-readiness-v129/evidence/'+f;
  assert.ok(existsSync(path.join(root,name)),name);
  assert.ok(statSync(path.join(root,name)).size>25000,name);
 }
});
test('Legal publication remains explicitly blocked pending approved publisher text and privacy audit',()=>{
 assert.equal(existsSync(path.join(root,'impressum/index.html')),false);
 assert.equal(existsSync(path.join(root,'datenschutz/index.html')),false);
 assert.match(read('docs/launch-readiness-v129/REPORT.md'),/NO-GO/);
 assert.match(read('docs/launch-readiness-v129/REPORT.md'),/Datenschutzerkl/);
});
