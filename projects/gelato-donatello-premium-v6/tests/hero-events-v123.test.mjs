import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>readFileSync(path.join(root,p),'utf8');
const home=read('index.html'),css=read('assets/css/events-v117.css');
const nav=read('assets/js/components/nav.js');
test('Single linked Events envelope with unobtrusive centered lowercase label on home hero',()=>{
 assert.equal((home.match(/class="v119-hero-events" href="\/events\/"/g)||[]).length,1);
 assert.match(home,/<div class="v119-hero-events-row">\s*<p class="eyebrow">Köllerbach · seit 1965<\/p>/);
 assert.match(home,/<span class="v119-hero-events__badge" aria-hidden="true">1<\/span>\s*<span class="v123-hero-events__label" aria-hidden="true">events<\/span>/);
 assert.match(css,/\.v123-hero-events__label\{[\s\S]*text-align:center/);
 assert.match(css,/font:650 9px\/1\.15 var\(--font-body\)/);
 assert.doesNotMatch(nav,/site-header__events-shortcut/);
});
test('More right-side spacing across desktop, iPhone and 320px screens',()=>{
 assert.match(css,/gap:clamp\(36px,3\.6vw,54px\)/);
 assert.match(css,/@media\(max-width:820px\)\{\s*body\[data-page="home"\] \.v119-hero-events-row\{gap:29px\}/);
 assert.match(css,/@media\(max-width:385px\)\{\s*body\[data-page="home"\] \.v119-hero-events-row\{gap:23px\}/);
 assert.match(css,/@media\(max-width:340px\)\{\s*body\[data-page="home"\] \.v119-hero-events-row\{gap:18px\}/);
});
test('Short strong animated tilts, synchronized warm badge glow with pauses and reduced-motion support',()=>{
 assert.match(css,/animation:v119-hero-envelope-tip 8\.4s cubic-bezier\(\.3,\.05,\.3,1\) infinite/);
 assert.match(css,/0%,66%,85%,100%\{transform:rotate\(0\)/);
 assert.match(css,/69%\{transform:rotate\(-19deg\)/);
 assert.match(css,/72%\{transform:rotate\(18deg\)/);
 assert.match(css,/filter:drop-shadow\(0 0 11px rgba\(242,177,101,\.92\)\)/);
 assert.match(css,/72%\{transform:scale\(1\.19\)/);
 assert.match(css,/animation:v122-events-badge-glow 8\.4s ease-in-out infinite/);
 assert.match(css,/\.v119-hero-events__badge\{animation:none!important;transform:none!important\}/);
 assert.match(css,/\.v119-hero-events__envelope\{animation:none!important;transform:none!important;filter:none!important\}/);
});
