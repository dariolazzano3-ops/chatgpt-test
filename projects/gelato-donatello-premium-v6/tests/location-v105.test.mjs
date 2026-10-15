import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const read = path => readFileSync(new URL(path,import.meta.url));
const html=read('../index.html').toString();
const css=read('../assets/css/style.css').toString();
const js=read('../assets/js/app.js').toString();
const loc=html.split('<section class="v102-location"',2)[1]?.split('</main>',1)[0]||'';
test('Original V104 map asset and every original geographic annotation remain untouched',()=>{
  const original=read('../assets/images/editorial/gelato-donatello-public-map-v104.webp');
  assert.ok(original.length>80000);
  assert.match(loc,/gelato-donatello-public-map-v104\.webp/);
  assert.doesNotMatch(loc,/gelato-donatello-original-location-v105\.jpg/);
  for(const label of ['Burg Bucherbach','Stadion an der Burg','Spielplatz','Parkplätzen','Bushaltestellen','GELATO DONATELLO','OpenStreetMap contributors']) assert.ok(loc.includes(label),label);
  assert.equal((loc.match(/class="v103-location__map-static"/g)||[]).length,1);
  assert.ok(createHash('sha256').update(original).digest('hex').length===64);
});
test('Premium continuity, overlay rather than image blur, once-only 1100ms reveal',()=>{
  assert.match(css,/V105 PREMIUM LOCATION/);
  assert.match(css,/body\[data-page="home"\] #site-footer/);
  assert.match(css,/transition:opacity 1100ms/);
  assert.match(css,/body\.location-reveal-ready .*::after/);
  assert.match(css,/object-fit:contain!important/);
  assert.match(css,/filter:none!important/);
  assert.match(js,/function initLocationReveal\(\)/);
  assert.match(js,/observer\.disconnect\(\)/);
  assert.match(js,/prefers-reduced-motion: reduce/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
});
test('Single map click, one route action and one phone action, valid destinations',()=>{
  assert.doesNotMatch(loc,/Karte vergrößern|Karte öffnen/);
  assert.equal((loc.match(/Route starten/g)||[]).length,1);
  assert.equal((loc.match(/>\s*Anrufen\s*</g)||[]).length,1);
  assert.match(loc,/href="https:\/\/www\.google\.com\/maps\/dir\/\?api=1&amp;destination=49\.299548%2C6\.8977832"/);
  assert.match(loc,/href="tel:\+4968069394980"/);
  assert.match(loc,/href="https:\/\/www\.openstreetmap\.org\/\?mlat=49\.299548&amp;mlon=6\.8977832/);
});
