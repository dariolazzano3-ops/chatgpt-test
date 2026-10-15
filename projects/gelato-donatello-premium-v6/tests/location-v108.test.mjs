import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const read=p=>readFileSync(new URL(p,import.meta.url));
const html=read('../index.html').toString();
const css=read('../assets/css/style.css').toString();
const js=read('../assets/js/app.js').toString();
const location=html.split('<section class="v102-location"',2)[1]?.split('</main>',1)[0]||'';
test('V108 retains original owner image byte-for-byte and the V107 text/contact',()=>{
  const jpeg=read('../assets/images/editorial/gelato-donatello-original-location-v105.jpg');
  assert.equal(createHash('sha256').update(jpeg).digest('hex'),'78a5ce0501ac07b27ddc09fef4e7fa0beb637b60f55e2999bcf0eac546517af0');
  assert.match(location,/gelato-donatello-original-location-v105\.jpg/);
  assert.doesNotMatch(location,/gelato-donatello-public-map-v104\.webp/);
  const heading=location.split('<header class="v102-location__heading"',2)[1]?.split('</header>',1)[0];
  assert.match(heading,/BESUCH UNS/);
  assert.match(heading,/Direkt gegenüber der Burg Bucherbach/);
  assert.doesNotMatch(heading,/Das gute Leben|Ein Stück Italien/);
  assert.match(location,/Hauptstraße 4/);
  assert.match(location,/Route starten/);
  assert.match(location,/Anrufen/);
});
test('Gold halo is decoration on top of the image rather than modification to it',()=>{
  assert.equal((location.match(/class="v108-location__pin-glow"/g)||[]).length,1);
  assert.match(location,/aria-hidden="true"/);
  assert.match(css,/left:67\.9%/);
  assert.match(css,/top:51\.4%/);
  assert.match(css,/pointer-events:none/);
});
test('One-time reveal, 3.5% zoom and two finite pulses, without image filtering',()=>{
  assert.match(css,/V108: one-shot cinematic location focus/);
  assert.match(css,/transform:scale\(1\.035\)!important/);
  assert.match(css,/transition:transform 1250ms/);
  assert.match(css,/transition:opacity 1100ms/);
  assert.match(css,/v108-location-warm-pulse 850ms ease-out 550ms 2 both/);
  assert.match(css,/v108-location-warm-pulse 850ms ease-out 690ms 2 both/);
  assert.match(css,/filter:none!important/);
  assert.match(css,/backdrop-filter:none!important/);
  assert.match(js,/observer\.disconnect\(\)/);
  assert.match(js,/if \(!entries\[0\]\?\.isIntersecting\) return/);
});
test('Reduced motion and no-JS fully visible map by progressive enhancement',()=>{
  assert.match(css,/body\[data-page="home"\] \.v108-location__pin-glow\{\s*display:none/);
  assert.match(css,/location-reveal-ready \.v108-location__pin-glow\{display:block/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
  assert.match(css,/transform:none!important;transition:none!important/);
  assert.match(js,/prefers-reduced-motion: reduce/);
  assert.match(js,/if \(noMotion \|\| !\('IntersectionObserver' in window\)\) return/);
});
