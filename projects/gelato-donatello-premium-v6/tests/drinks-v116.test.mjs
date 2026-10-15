import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const page=readFileSync(path.join(root,'getraenke/index.html'),'utf8');
const js=readFileSync(path.join(root,'assets/js/drinks-v116.js'),'utf8');
const css=readFileSync(path.join(root,'assets/css/drinks-v116.css'),'utf8');
const shake=page.split('<section class="dr116-shakes"')[1]?.split('</section>',1)[0]||'';
const drinks=page.split('<section class="dr116-drinks"')[1]?.split('</section>',1)[0]||'';
test('Exact independently verified six original images are split 3+3 without outside photos',()=>{
 const shakeNames=['Erdbeer-Shake','Schoko-Shake','Vanille-Shake'];
 const staticNames=['Orange Flip','Eiscaffè','Eisschokolade'];
 const shakeFiles=['erdbeer-shake.webp','schoko-shake.webp','vanille-shake.webp'];
 const drinkFiles=['orange-flip.webp','eiskaffee.webp','eisschokolade.webp'];
 for(const name of shakeNames)assert.ok(shake.includes(name));
 for(const name of staticNames)assert.ok(drinks.includes(name));
 for(const file of shakeFiles){assert.ok(shake.includes('/assets/images/drinks/'+file));assert.ok(!drinks.includes(file));}
 for(const file of drinkFiles){assert.ok(drinks.includes('/assets/images/drinks/'+file));assert.ok(!shake.includes(file));}
 for(const file of [...shakeFiles,...drinkFiles])assert.ok(statSync(path.join(root,'assets/images/drinks',file)).size>30000);
 assert.equal((shake.match(/class="dr116-wheel__image/g)||[]).length,3);
 assert.equal((drinks.match(/class="dr116-drink"/g)||[]).length,3);
 assert.doesNotMatch(page,/images\.unsplash|images\.pexels|cloudinary|https:\/\/.*\.(jpg|jpeg|png|webp)/i);
});
test('Responsive circular selector has accessible manual controls and a single active shake',()=>{
 assert.equal((shake.match(/data-shake-index=/g)||[]).length,3);
 assert.equal((shake.match(/data-shake-frame=/g)||[]).length,3);
 assert.equal((shake.match(/aria-pressed="true"/g)||[]).length,1);
 assert.match(shake,/aria-label="Milchshake-Sorte wählen"/);
 assert.match(shake,/Mit allen Eissorten möglich\./);
 assert.match(js,/setAttribute\('aria-pressed',String\(i===to\)\)/);
 assert.match(js,/frame\.classList\.toggle\('is-active',i===to\)/);
 assert.match(js,/manuallyChosen=true;pause\(\)/);
 assert.match(css,/@keyframes dr116-orbit/);
 assert.match(css,/animation:dr116-orbit 46s linear infinite/);
 assert.match(css,/data-page="getraenke"/);
 assert.match(css,/@media\(max-width:700px\)/);
 assert.match(css,/\.dr116-wheel__choice:focus-visible/);
});
test('Autoplay pauses off screen, on manual selection, in reduced motion and hidden tabs',()=>{
 assert.match(js,/IntersectionObserver/);
 assert.match(js,/threshold:\.18/);
 assert.match(js,/document\.hidden/);
 assert.match(js,/prefers-reduced-motion: reduce/);
 assert.match(js,/5600/);
 assert.match(js,/window\.clearTimeout/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
 assert.match(css,/animation:none!important/);
 assert.match(page,/noindex,nofollow,noarchive/);
});
test('Three fixed Drinks have short descriptions and accessible original images',()=>{
 assert.equal((drinks.match(/<h3>/g)||[]).length,3);
 assert.equal((drinks.match(/dr116-drink__copy/g)||[]).length,3);
 assert.equal((drinks.match(/dr116-drink__image/g)||[]).length,3);
 assert.match(drinks,/Fruchtig, frisch, unverwechselbar\./);
 assert.match(drinks,/Kaffee trifft cremigen Eisgenuss\./);
 assert.match(drinks,/Schokoladig\. Eisgekühlt\. Köstlich\./);
 assert.doesNotMatch(page,/\d[\d,.]*\s*€|\b\d[\d,.]*\s*EUR\b/);
});
test('Only drinks route newly structured and existing common shell retained',()=>{
 assert.match(page,/data-page="getraenke"/);
 assert.match(page,/id="site-header"/);
 assert.match(page,/id="site-footer"/);
 assert.match(page,/src="\/assets\/js\/app.js"/);
 assert.match(page,/src="\/assets\/js\/drinks-v116.js"/);
 assert.match(page,/href="\/assets\/css\/drinks-v116.css"/);
});
