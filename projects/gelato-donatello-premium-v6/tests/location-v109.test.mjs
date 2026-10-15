import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const read=p=>readFileSync(new URL(p,import.meta.url));
const html=read('../index.html').toString();
const css=read('../assets/css/style.css').toString();
const js=read('../assets/js/app.js').toString();
const loc=html.split('<section class="v102-location"',2)[1]?.split('</main>',1)[0]||'';
test('Brand map, navigation and visit text unchanged',()=>{
 assert.match(loc,/gelato-donatello-original-location-v105\.jpg/);
 const jpg=read('../assets/images/editorial/gelato-donatello-original-location-v105.jpg');
 assert.equal(createHash('sha256').update(jpg).digest('hex'),'78a5ce0501ac07b27ddc09fef4e7fa0beb637b60f55e2999bcf0eac546517af0');
 assert.match(loc,/BESUCH UNS/);assert.match(loc,/Direkt gegenüber der Burg Bucherbach\./);
 assert.match(loc,/Route starten/);assert.match(loc,/Anrufen/);
 assert.match(loc,/class="v108-location__pin-glow"/);
});
test('One shared class starts heartbeat AFTER initial V108 reveal and is only scheduled once',()=>{
 assert.match(js,/surface\.classList\.add\('is-revealed'\);\s*observer\.disconnect\(\)/);
 assert.match(js,/window\.setTimeout\(\(\) => \{/);
 assert.match(js,/document\.body\.classList\.add\('location-heartbeat-active'\)/);
 assert.match(js,/}, 2470\)/);
 assert.match(js,/prefers-reduced-motion: reduce/);
});
test('Dot and pin have synchronized double beat and a long pause in one 2200ms cycle',()=>{
 assert.match(css,/--gelato-heartbeat-duration:2200ms/);
 assert.match(css,/@keyframes v109-eyebrow-heartbeat/);
 assert.match(css,/@keyframes v109-pin-heartbeat/);
 assert.match(css,/@keyframes v109-pin-heartbeat-inner/);
 for(const name of ['v109-eyebrow-heartbeat','v109-pin-heartbeat','v109-pin-heartbeat-inner']){
   const key=css.split('@keyframes '+name+' {')[1]?.split('\n}',1)[0];
   assert.ok(key,name+' keyframes');
   assert.match(key,/8%\s*\{/);assert.match(key,/23%\s*\{/);
   assert.match(key,/31%,100%/);
 }
 assert.match(css,/animation:v109-eyebrow-heartbeat var\(--gelato-heartbeat-duration\) ease-in-out 0s infinite both/);
 assert.match(css,/animation:v109-pin-heartbeat var\(--gelato-heartbeat-duration\) ease-in-out 0s infinite both/);
 assert.match(css,/animation:v109-pin-heartbeat-inner var\(--gelato-heartbeat-duration\) ease-in-out 0s infinite both/);
});
test('Progressively enhanced, no changes to original bitmap or disabled motion behavior',()=>{
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
 assert.match(css,/\.v108-location__pin-glow::before,\s*body\[data-page="home"\] \.v108-location__pin-glow::after \{/);
 assert.match(css,/animation:none!important/);
 assert.match(js,/if \(noMotion \|\| !\('IntersectionObserver' in window\)\) return/);
 assert.match(css,/pointer-events:none/);
});
