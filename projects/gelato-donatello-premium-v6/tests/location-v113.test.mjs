import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const read=(p)=>readFileSync(new URL(p,import.meta.url));
const html=read('../index.html').toString();
const js=read('../assets/js/app.js').toString();
const css=read('../assets/css/style.css').toString();
const location=html.split('<section class="v102-location"',2)[1]?.split('</main>',1)[0]||'';
const dialog=html.split('<dialog class="v113-navigation"',2)[1]?.split('</dialog>',1)[0]||'';
const apple='https://maps.apple.com/?daddr=49.299548,6.8977832&dirflg=d';
const google='https://www.google.com/maps/dir/?api=1&destination=49.299548%2C6.8977832&travelmode=driving';
test('all cars and vehicle keyframes are removed without altering original marker',()=>{
 assert.doesNotMatch(html,/v110-vehicle/);
 assert.doesNotMatch(css,/v110-vehicle|v110-traffic-main|v110-traffic-side/);
 assert.match(html,/class="v110-marker-whole"/);
 assert.match(css,/v110-whole-pin-heartbeat/);
 assert.match(css,/v109-eyebrow-heartbeat/);
 assert.match(js,/location-heartbeat-active/);
 const bytes=read('../assets/images/editorial/gelato-donatello-original-location-v105.jpg');
 assert.equal(createHash('sha256').update(bytes).digest('hex'),'78a5ce0501ac07b27ddc09fef4e7fa0beb637b60f55e2999bcf0eac546517af0');
});
test('map and route share modal, Google Maps remains usable without Javascript',()=>{
 assert.equal((location.match(/data-location-navigation/g)||[]).length,2);
 assert.equal((location.match(/class="v103-location__map-static"/g)||[]).length,1);
 assert.equal((location.match(/class="v102-location__route"/g)||[]).length,1);
 assert.equal((location.match(/Route starten/g)||[]).length,1);
 for(const fallback of [...location.matchAll(/data-location-navigation[\s\S]*?href="([^"]+)"/g)]){
   assert.ok(fallback[1].replaceAll('&amp;','&').includes('49.299548%2C6.8977832'));
 }
 assert.match(location,/Hauptstraße 4/);
 assert.match(location,/Direkt gegenüber der Burg Bucherbach\./);
 assert.match(location,/Anrufen/);
});
test('exact user supplied Apple and Google directions URLs with accessible choices',()=>{
 assert.match(dialog,/id="v113-navigation-title"/);
 assert.match(dialog,/Navigation auswählen/);
 assert.match(dialog,/Wie möchtest du zu Gelato Donatello navigieren\?/);
 assert.match(dialog,/Route mit Apple Karten/);
 assert.match(dialog,/Route mit Google Maps/);
 const hrefs=[...dialog.matchAll(/href="([^"]+)"/g)].map(match=>match[1].replaceAll('&amp;','&'));
 assert.deepEqual(hrefs,[apple,google]);
 assert.match(dialog,/data-navigation-close aria-label="Navigation schließen"/);
 assert.match(dialog,/data-navigation-destination="apple"/);
 assert.match(dialog,/data-navigation-destination="google"/);
 assert.match(html,/aria-labelledby="v113-navigation-title" aria-describedby="v113-navigation-description"/);
});
test('native dialog focus, Escape, outside-click and no-JS fallback',()=>{
 assert.match(js,/typeof dialog.showModal !== 'function'/);
 assert.match(js,/event.preventDefault\(\)/);
 assert.match(js,/dialog.showModal\(\)/);
 assert.match(js,/apple.focus\(\{preventScroll:true\}\)/);
 assert.match(js,/if \(event.target === dialog\) close\(\)/);
 assert.match(js,/dialog.addEventListener\('close'/);
 assert.match(js,/opener.focus\(\{preventScroll:true\}\)/);
 assert.match(js,/document.body.classList.remove\('v113-navigation-open'\)/);
 assert.match(css,/\.v113-navigation::backdrop/);
 assert.match(css,/@media\(max-width:650px\)/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
 assert.match(css,/body.v113-navigation-open\{overflow:hidden\}/);
});
