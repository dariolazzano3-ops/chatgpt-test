import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const root=new URL('../projects/gelato-donatello-v5-final/',import.meta.url);
const read=async p=>fs.readFile(new URL(p,root),'utf8');
const home=await read('index.html');
const css=await read('assets/css/style.css');
const tokens=await read('assets/css/tokens.css');
assert.match(home,/class="reference-hero"/);
assert.equal((home.match(/class="reference-tile(?:\s|")/g)||[]).length,4);
for(const asset of ['pistazie.webp','dubai-eis.webp','dragon-summer.webp','strawberry-matcha.webp','eistorte-01.webp','fruechte-becher.webp','interior-counter.webp']){
 assert.match(home,new RegExp(asset.replace('.','\\.')));
}
for(const token of ['#472c22','#bac7b6','#f3efde','#c5a989']) assert.match(tokens,new RegExp(token,'i'));
assert.match(css,/BUONISSIMO REFERENCE FIDELITY PASS/);
assert.match(css,/\.reference-showcase\s*\{/);
assert.match(css,/border-radius:\s*0/);
assert.doesNotMatch(home,/buonissimo/i);
console.log('OK: Buonissimo reference-fidelity structure translated to Donatello without copied brand content.');
