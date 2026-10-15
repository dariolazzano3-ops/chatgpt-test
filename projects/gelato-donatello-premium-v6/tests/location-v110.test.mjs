import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
import {createHash} from 'node:crypto';
const read=p=>readFileSync(new URL(p,import.meta.url));
const html=read('../index.html').toString();
const css=read('../assets/css/style.css').toString();
const js=read('../assets/js/app.js').toString();
const loc=html.split('<section class="v102-location"',2)[1]?.split('</main>',1)[0]||'';
test('Original V105 map unchanged; attached transparent crop is an additive asset',()=>{
 const source=read('../assets/images/editorial/gelato-donatello-original-location-v105.jpg');
 const clone=read('../assets/images/editorial/gelato-donatello-marker-overlay-v110.webp');
 assert.equal(createHash('sha256').update(source).digest('hex'),'78a5ce0501ac07b27ddc09fef4e7fa0beb637b60f55e2999bcf0eac546517af0');
 assert.ok(clone.length>25000 && clone.length<250000);
 assert.equal((loc.match(/class="v110-marker-whole"/g)||[]).length,1);
 assert.match(css,/marker-overlay-v110\.webp/);
 assert.match(loc,/gelato-donatello-original-location-v105\.jpg/);
 assert.match(loc,/BESUCH UNS/);
 assert.match(loc,/Direkt gegenüber der Burg Bucherbach\./);
 assert.match(loc,/Route starten/);
 assert.match(loc,/Anrufen/);
});
test('Full pin including image label scales together, softly and precisely',()=>{
 assert.match(css,/@keyframes v110-whole-pin-heartbeat/);
 assert.match(css,/transform:scale\(1\.045\)/);
 assert.match(css,/transform:scale\(1\.030\)/);
 assert.match(css,/animation:v110-whole-pin-heartbeat var\(--gelato-heartbeat-duration,2200ms\)/);
 assert.match(css,/left:59\.047%/);
 assert.match(css,/top:31\.307%/);
 assert.match(css,/width:32\.804%/);
 assert.match(css,/height:23\.481%/);
 assert.match(css,/transform:scale\(1\.035\)/);
 assert.match(css,/\.location-heartbeat-active \.v108-location__pin-glow\{\s*display:none/);
});
test('V113 removes the former decorative vehicles while preserving the whole pin',()=>{
 assert.doesNotMatch(loc,/v110-vehicle/);
 assert.doesNotMatch(css,/v110-vehicle|v110-traffic-main|v110-traffic-side/);
 assert.match(css,/pointer-events:none/);
});
test('No-JS progressive enhancement; reduced motion has no animated marker sprite',()=>{
 assert.match(js,/window\.setTimeout\(\(\) => \{/);
 assert.match(js,/location-heartbeat-active/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)[\s\S]*\.v110-map-stage\{display:none!important/);
 assert.match(css,/\.v110-marker-whole\{animation:none!important;display:none!important/);
 assert.match(js,/observer\.disconnect\(\)/);
});
