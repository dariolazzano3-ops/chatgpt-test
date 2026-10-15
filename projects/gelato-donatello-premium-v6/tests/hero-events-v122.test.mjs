import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const css=readFileSync(path.join(root,'assets/css/events-v117.css'),'utf8');
const html=readFileSync(path.join(root,'index.html'),'utf8');
const nav=readFileSync(path.join(root,'assets/js/components/nav.js'),'utf8');

test('V122 increases eyebrow-to-envelope spacing without moving button from hero',()=>{
  assert.match(css,/flex-wrap:nowrap;gap:clamp\(21px,2\.1vw,31px\)/);
  assert.match(css,/@media\(max-width:385px\)\{\s*body\[data-page="home"\] \.v119-hero-events-row\{gap:16px\}/);
  assert.match(html,/<div class="v119-hero-events-row">\s*<p class="eyebrow">Köllerbach · seit 1965<\/p>/);
  assert.match(html,/class="v119-hero-events" href="\/events\/"/);
  assert.doesNotMatch(nav,/site-header__events-shortcut/);
});
test('V122 short tilt is stronger, warmly glowing and quiet most of the time',()=>{
  assert.match(css,/animation:v119-hero-envelope-tip 8\.4s cubic-bezier\(\.3,\.05,\.3,1\) infinite/);
  assert.match(css,/@keyframes v119-hero-envelope-tip/);
  assert.match(css,/0%,68%,85%,100%\{transform:rotate\(0\)/);
  assert.match(css,/70%\{transform:rotate\(-13deg\)/);
  assert.match(css,/73%\{transform:rotate\(13deg\)/);
  assert.match(css,/filter:drop-shadow\(0 0 8px rgba\(242,177,101,\.8\)\)/);
  assert.match(css,/@keyframes v122-events-badge-glow/);
  assert.match(css,/animation:v122-events-badge-glow 8\.4s ease-in-out infinite/);
});
test('Badge and reduced motion stay accessible and stable',()=>{
  assert.match(html,/class="v119-hero-events__badge" aria-hidden="true">1<\/span>/);
  assert.match(html,/aria-label="Events: 1 Event-Idee ansehen, noch nicht buchbar"/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
  assert.match(css,/\.v119-hero-events__envelope\{animation:none!important;transform:none!important;filter:none!important\}/);
  assert.match(css,/\.v119-hero-events__badge\{animation:none!important;transform:none!important\}/);
});
