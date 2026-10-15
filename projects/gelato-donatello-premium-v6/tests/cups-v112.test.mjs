import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const page=fs.readFileSync(path.join(root,'eisbecher/index.html'),'utf8');
const builder=fs.readFileSync(path.join(root,'scripts/build-cups-v111.py'),'utf8');
const css=fs.readFileSync(path.join(root,'assets/css/cups-v111.css'),'utf8');
const catalog=JSON.parse(fs.readFileSync(path.join(root,'data/cups-v111.json'),'utf8'));
const panels=[...page.matchAll(/<section class="cups111-panel" id="([^"]+)"/g)].map(m=>m[1]);
test('V112 hero contains only short eyebrow, title and one genuine Eisbecher image',()=>{
 const hero=page.split('<section class="cups111-hero"')[1].split('</section>',1)[0];
 assert.match(hero,/UNSERE EISBECHER/);
 assert.match(hero,/Eis zum <em>Verlieben\.<\/em>/);
 assert.match(hero,/tartufo-becher\.webp/);
 assert.equal((hero.match(/<img\b/g)||[]).length,1);
 assert.doesNotMatch(hero,/31 Kreationen|4 Genusswelten|Lieblingsbecher wartet|Entdecke unsere Eiswelt|cups111-hero__meta/);
 assert.equal((hero.match(/<p\b/g)||[]).length,1);
});
test('Four image category tiles have name, optional count, child subtitle, but no indices or arrows',()=>{
 const nav=page.split('<nav class="cups111-choices"')[1].split('</nav>',1)[0];
 assert.equal((nav.match(/class="cups111-choice"/g)||[]).length,4);
 assert.equal((nav.match(/class="cups111-choice__count"/g)||[]).length,4);
 assert.equal((nav.match(/class="cups111-choice__image"/g)||[]).length,4);
 assert.doesNotMatch(nav,/01\s*\/\s*04|02\s*\/\s*04|03\s*\/\s*04|04\s*\/\s*04|cups111-choice__index|↗/);
 assert.equal((nav.match(/Für unsere kleinen Gäste/g)||[]).length,1);
 assert.deepEqual(panels,['eisbecher','spaghetti-eisbecher','joghurtbecher','kinderbecher']);
});
test('Direct product grid after a single category heading, without advertising endblock',()=>{
 for(const id of panels){
   const s=page.split('data-cups-panel="'+id+'"')[1].split('</section>',1)[0];
   assert.equal((s.match(/<h2>/g)||[]).length,1);
   assert.match(s,/<h2>[^<]+<\/h2><\/div>/);
   assert.doesNotMatch(s,/cups111-panel__subtitle|cups111-panel__quantity|UNSERE EISWELT|Kreationen<\/small>/);
 }
 assert.doesNotMatch(page,/cups111-outro|Dein nächster|Genussmoment|AM BESTEN FRISCH VOR ORT/);
 assert.doesNotMatch(page,/cups111-catalog__intro|Vier Welten|Dein Genuss|Wähle eine Kategorie/);
 assert.doesNotMatch(page,/cups111-product__number/);
 const lastProductEnd=page.lastIndexOf('</section>');
 assert.ok(page.indexOf('</main>',lastProductEnd)>lastProductEnd);
 assert.match(page,/<div id="site-footer"><\/div>/);
});
test('All 31 real product images, 13 6 6 6, accessible no JS and no prices',()=>{
 assert.deepEqual(catalog.map(g=>g.products.length),[13,6,6,6]);
 assert.equal((page.match(/class="cups111-product"/g)||[]).length,31);
 assert.equal((page.match(/class="cups111-product__photo"/g)||[]).length,31);
 assert.ok(!/<section[^>]*data-cups-panel[^>]*\shidden/.test(page));
 for(const group of catalog)for(const item of group.products){
   assert.ok(fs.statSync(path.join(root,'assets/images/cups',item.image)).size>10000);
   assert.match(page,new RegExp(item.image.replaceAll('.','\\.')+'\"'));
 }
 assert.match(page,/noindex,nofollow,noarchive/);
 assert.doesNotMatch(page,/€|\bEUR\b/);
 assert.match(css,/V112 product-first simplification/);
 assert.match(css,/prefers-reduced-motion:reduce/);
 assert.match(builder,/def panel\(g,i\)/);
});
