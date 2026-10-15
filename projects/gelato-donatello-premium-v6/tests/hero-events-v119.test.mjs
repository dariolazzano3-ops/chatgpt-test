import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=f=>readFileSync(path.join(root,f),'utf8');
const home=read('index.html'),nav=read('assets/js/components/nav.js'),css=read('assets/css/events-v117.css');
const manifest=JSON.parse(read('data/events-v117.json'));
test('Envelope moved from header into the existing homepage eyebrow',()=>{
 assert.doesNotMatch(nav,/site-header__events-shortcut|site-header__events-envelope/);
 assert.equal((home.match(/class="v119-hero-events"/g)||[]).length,1);
 assert.match(home,/<div class="v119-hero-events-row">\s*<p class="eyebrow">Köllerbach · seit 1965<\/p>/);
 assert.match(home,/class="v119-hero-events" href="\/events\/"/);
 assert.match(home,/class="v119-hero-events__envelope"/);
 assert.match(home,/class="v119-hero-events__badge" aria-hidden="true">1<\/span>/);
 assert.match(nav,/page: 'events', href: '\/events\/', label: 'Events'/);
 assert.match(nav,/logo-donatello-header.webp/);
});
test('Badge denotes a preview event idea, not invented booking availability',()=>{
 assert.match(home,/aria-label="Events: 1 Event-Idee ansehen, noch nicht buchbar"/);
 assert.equal(manifest.is_bookable,false);
 assert.equal(manifest.header_badge_count,0);
 assert.equal(manifest.status,'draft');
});
test('Hero has a clear target, subtle periodic motion, reduced-motion fallback and mobile fit',()=>{
 assert.match(css,/v119-hero-events-row\{[\s\S]*display:flex/);
 assert.match(css,/\.v119-hero-events__badge\{/);
 assert.match(css,/@keyframes v119-hero-envelope-tip/);
 assert.match(css,/animation:v119-hero-envelope-tip 16s ease-in-out infinite/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
 assert.match(css,/\.v119-hero-events__envelope\{animation:none!important/);
 assert.match(css,/grid-template-columns:minmax\(0,1fr\) auto;gap:7px/);
 assert.doesNotMatch(css,/\.site-header__events-shortcut/);
 assert.match(home,/Täglich frisch aus unserem eigenen Eislabor/);
});
