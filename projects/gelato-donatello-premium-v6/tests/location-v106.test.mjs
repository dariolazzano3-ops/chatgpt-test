import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const read=p=>readFileSync(new URL(p,import.meta.url));
const html=read('../index.html').toString();
const css=read('../assets/css/style.css').toString();
const js=read('../assets/js/app.js').toString();
const loc=html.split('<section class="v102-location"',2)[1]?.split('</main>',1)[0]||'';
test('Exact owner V105 JPEG unchanged, dimensions and all baked-in locations preserved',()=>{
  const jpg=read('../assets/images/editorial/gelato-donatello-original-location-v105.jpg');
  assert.equal(jpg.length,769764);
  assert.equal(createHash('sha256').update(jpg).digest('hex'),'78a5ce0501ac07b27ddc09fef4e7fa0beb637b60f55e2999bcf0eac546517af0');
  assert.match(loc,/gelato-donatello-original-location-v105\.jpg/);
  assert.match(loc,/width="1448" height="1086"/);
  assert.doesNotMatch(loc,/gelato-donatello-public-map-v104\.webp/);
  assert.match(css,/aspect-ratio:4 \/ 3!important/);
});
test('Exactly one navigable map, one route, one phone',()=>{
  assert.equal((loc.match(/class="v103-location__map-static"/g)||[]).length,1);
  assert.equal((loc.match(/Route starten/g)||[]).length,1);
  assert.equal((loc.match(/>\s*Anrufen\s*</g)||[]).length,1);
  assert.doesNotMatch(loc,/Karte vergrößern|Karte öffnen/);
  assert.match(loc,/href="tel:\+4968069394980"/);
  assert.match(loc,/www\.google\.com\/maps\/dir\/\?api=1&amp;destination=49\.299548%2C6\.8977832/);
});
test('Coffee and location share exact color and no section-specific backgrounds',()=>{
  assert.match(css,/V106: same single espresso surface/);
  assert.match(css,/body\[data-page="home"\] \.v99-gifts \+ \.v88-caffe-photo/);
  assert.match(css,/body\[data-page="home"\] \.v102-location,/);
  assert.match(css,/background-color:#211916!important/);
  assert.match(css,/background-image:none!important/);
  assert.match(css,/body\[data-page="home"\] \.v102-location::before \{\s*display:none!important/);
});
test('Progressive one-time 1100ms overlay, no permanent blur and reduced-motion fallback',()=>{
  assert.match(loc,/data-location-reveal/);
  assert.match(css,/transition:opacity 1100ms/);
  assert.match(css,/\.v102-location__map-surface\.is-revealed::after/);
  assert.match(css,/backdrop-filter:blur\(0px\)!important/);
  assert.match(css,/filter:none!important/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
  assert.match(js,/function initLocationReveal\(\)/);
  assert.match(js,/observer\.disconnect\(\)/);
});
