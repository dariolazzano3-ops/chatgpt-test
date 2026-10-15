import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const read=p=>readFileSync(new URL(p,import.meta.url));
const html=read('../index.html').toString();
const orig=read('../assets/images/editorial/gelato-donatello-original-location-v105.jpg');
const apple='https://maps.apple/p/rvRX9tEjSk-Vnh';
const google='https://www.google.com/maps/place/Gelato+Donatello+GmbH,+Hauptstra%C3%9Fe+4,+66346+P%C3%BCttlingen-K%C3%B6llerbach/@49.2995579,6.8977629,17z/data=!4m6!3m5!1s0x4795afdf9d4934af:0x8af198c42c4a4a50!8m2!3d49.2995579!4d6.8977629!16s%2Fg%2F11fxvydwrw?g_ep=Eg1tbF8yMDI2MTAxMV8wIOC7DCoASAJQAg%3D%3D';
const location=html.split('<section class="v102-location"',2)[1]?.split('</main>',1)[0]||'';
const dialog=html.split('<dialog class="v113-navigation"',2)[1]?.split('</dialog>',1)[0]||'';
test('Only Google business listing fallback for both location entry points',()=>{
 const links=[...location.matchAll(/<a\b[^>]*data-location-navigation[^>]*>/g)].map(m=>m[0]);
 assert.equal(links.length,2);
 for(const link of links) assert.equal(link.match(/\bhref="([^"]+)"/)?.[1],google);
 assert.match(links[0],/v103-location__map-static/);
 assert.match(links[1],/v102-location__route/);
 assert.doesNotMatch(location,/\/maps\/dir|destination=49\.299548|openstreetmap\.org/);
});
test('Map chooser includes exactly both user-provided business entries, not routes',()=>{
 const links=[...dialog.matchAll(/<a\b[^>]*class="v113-navigation__choice"[^>]*>/g)].map(m=>m[0]);
 assert.equal(links.length,2);
 assert.deepEqual(links.map(x=>x.match(/\bhref="([^"]+)"/)?.[1]),[apple,google]);
 assert.deepEqual(links.map(x=>x.match(/data-navigation-destination="([^"]+)"/)?.[1]),['apple','google']);
 assert.doesNotMatch(dialog,/maps\.apple\.com\/\?daddr|maps\/dir\/\?api=1/);
});
test('Original V105 asset, heartbeats, labels and contact panel are still present',()=>{
 assert.equal(createHash('sha256').update(orig).digest('hex'),'78a5ce0501ac07b27ddc09fef4e7fa0beb637b60f55e2999bcf0eac546517af0');
 assert.match(location,/gelato-donatello-original-location-v105\.jpg/);
 assert.match(location,/v110-marker-whole/);
 assert.match(location,/v108-location__pin-glow/);
 assert.match(location,/BESUCH UNS/);
 assert.match(location,/Direkt gegenüber der Burg Bucherbach\./);
 assert.match(location,/Route starten/);
 assert.match(location,/Anrufen/);
 assert.doesNotMatch(location,/v110-vehicle/);
});
