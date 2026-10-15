import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const html=fs.readFileSync(path.join(root,'eisbecher/index.html'),'utf8');
const css=fs.readFileSync(path.join(root,'assets/css/cups-v111.css'),'utf8');
const js=fs.readFileSync(path.join(root,'assets/js/cups-v111.js'),'utf8');
const catalog=JSON.parse(fs.readFileSync(path.join(root,'data/cups-v111.json'),'utf8'));
test('All 31 published products match the entire verified original cup image directory',()=>{
 assert.deepEqual(catalog.map(c=>c.products.length),[13,6,6,6]);
 assert.deepEqual(catalog.map(c=>c.id),['eisbecher','spaghetti-eisbecher','joghurtbecher','kinderbecher']);
 const productFiles=catalog.flatMap(c=>c.products.map(p=>p.image));
 const directory=fs.readdirSync(path.join(root,'assets/images/cups')).filter(x=>x.endsWith('.webp')).sort();
 assert.equal(productFiles.length,31);
 assert.equal(new Set(productFiles).size,31);
 assert.deepEqual([...productFiles].sort(),directory);
 for(const c of catalog)for(const p of c.products){
  assert.ok(p.name.length>2);
  assert.ok(fs.statSync(path.join(root,'assets/images/cups',p.image)).size>10000);
  assert.ok(html.includes('/assets/images/cups/'+p.image),'Missing image on HTML '+p.image);
  assert.ok(html.includes('>'+p.name+'</h3>'),'Missing title '+p.name);
 }
 assert.ok(catalog[0].products.some(p=>p.name==='Tartufo-Becher'));
 assert.ok(catalog[3].products.some(p=>p.name==='Kinder Spaghetti'));
});
test('Four navigable distinct categories and static no-JS panels exist in HTML',()=>{
 assert.equal((html.match(/class="cups111-choice"/g)||[]).length,4);
 assert.equal((html.match(/class="cups111-panel"/g)||[]).length,4);
 assert.equal((html.match(/class="cups111-product"/g)||[]).length,31);
 assert.ok(!/<section[^>]+data-cups-panel[^>]*\shidden/.test(html));
 for(const item of catalog){
  assert.ok(html.includes('id="tab-'+item.id+'"'));
  assert.ok(html.includes('href="#'+item.id+'"'));
  assert.ok(html.includes('data-cups-panel="'+item.id+'"'));
  assert.ok(html.includes('aria-labelledby="tab-'+item.id+'"'));
 }
 assert.match(html,/noindex,nofollow,noarchive/);
 assert.match(html,/data-page="eisbecher"/);
 assert.match(html,/script type="module" src="\/assets\/js\/cups-v111\.js"/);
});
test('Accessible progressive tabs: hash navigation, screen readers and arrow keys',()=>{
 assert.match(js,/setAttribute\('role','tablist'\)/);
 assert.match(js,/setAttribute\('role','tab'\)/);
 assert.match(js,/setAttribute\('role','tabpanel'\)/);
 assert.match(js,/setAttribute\('aria-selected'/);
 assert.match(js,/event\.key==='ArrowRight'/);
 assert.match(js,/event\.key==='ArrowLeft'/);
 assert.match(js,/event\.key==='Home'/);
 assert.match(js,/event\.key==='End'/);
 assert.match(js,/history\.pushState/);
 assert.match(js,/window\.addEventListener\('hashchange'/);
 assert.match(js,/window\.addEventListener\('popstate'/);
 assert.match(html,/aria-live="polite"/);
});
test('Premium responsive layout, motion preference and lazy images, no prices',()=>{
 assert.match(css,/grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
 assert.match(css,/grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
 assert.match(css,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
 assert.match(css,/prefers-reduced-motion:reduce/);
 assert.match(css,/\.cups111-panel\[hidden\]\{display:none!important\}/);
 assert.equal((html.match(/loading="lazy"/g)||[]).length,31-4+4); // All 31 except first four, plus four category covers
 assert.ok(!/(?:\d[\d.,]*\s*€)|(?:\d[\d.,]*\s*EUR)|(?:preise?\s*[:=])/i.test(html));
 assert.match(css,/body\[data-page="eisbecher"\]/);
});
