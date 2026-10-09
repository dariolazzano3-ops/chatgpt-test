import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repo=process.cwd();
const root=path.join(repo,'projects','gelato-donatello-premium-v6');
const pages=['index.html','eisbecher/index.html','eistorten/index.html','eisvitrine/index.html','kontakt/index.html'];
const legacy=['sortiment/index.html','eistorten-eisbomben/index.html'];
for(const rel of [...pages,...legacy]){
  const full=path.join(root,rel);
  assert.ok(fs.existsSync(full),'missing route '+rel);
  const html=fs.readFileSync(full,'utf8');
  assert.match(html,/noindex,nofollow,noarchive/,rel);
  assert.doesNotMatch(html,/data-asset-pending="true"/,rel);
}
const originals=pages.map(rel=>fs.readFileSync(path.join(root,rel),'utf8'));
for(const [i,html] of originals.entries()){
  assert.match(html,/assets\/css\/style\.css/,pages[i]);
  assert.match(html,/assets\/js\/app\.js/,pages[i]);
  assert.doesNotMatch(html,/\d+(?:[.,]\d+)?\s*€|EUR\b|Eisbomb|Kugel Eis[^<]*\d+|preise direkt|Aktuelle Karte|alle 41 sorten/i,'no catalog/prices in '+pages[i]);
  for(const match of html.matchAll(/(?:src|href|data-asset-path)="(\/[^"#?]+)"/g)){
    const ref=match[1];
    assert.ok(fs.existsSync(path.join(root,ref.slice(1)))||fs.existsSync(path.join(root,ref.slice(1),'index.html')),'missing file '+ref+' in '+pages[i]);
  }
}
const [home,cups,cakes,rental,contact]=originals;
for(const marker of ['v6-hero','v6-facts','v6-feature-dark','v6-showcase','v6-cup-story','v6-image-story'])assert.ok(home.includes(marker),marker);
assert.match(home,/1965/);
assert.doesNotMatch(home,/href="\/sortiment\/"/);
assert.match(cups,/v6-photo-strip/);
assert.match(cups,/photo-gallery/);
assert.doesNotMatch(cups,/data-component="cup-menu"|data-component="extras-menu"/);
assert.match(cakes,/Eistorte/i);
assert.match(cakes,/Spaghetti-Eistorte/);
assert.match(cakes,/data-include-flavor-picker="false"/);
assert.doesNotMatch(cakes,/data-component="flavor-grid"|Kugeln|Eisbomb/);
assert.match(rental,/Eisvitrine mieten/);
assert.match(rental,/data-component="request-form"/);
assert.doesNotMatch(rental,/\d+[,.]\d+\s*€/);
assert.match(contact,/06806 9394980/);
assert.match(fs.readFileSync(path.join(root,'sortiment/index.html'),'utf8'),/url=\/eisbecher\//);
assert.match(fs.readFileSync(path.join(root,'eistorten-eisbomben/index.html'),'utf8'),/url=\/eistorten\//);

const project=JSON.parse(fs.readFileSync(path.join(root,'project.json'),'utf8'));
assert.equal(project.schema,'aurentara.gelato-premium-website.v6');
assert.equal(project.preview_policy.mode,'PRIVATE_CLOUDFLARE_ACCESS_ONLY');
assert.equal(project.safety.production_deploy,false);
assert.equal(project.safety.public_deploy,false);
assert.equal(project.safety.dns_changes,false);
assert.equal(project.safety.external_writes,false);
assert.equal(project.content_policy.strategy,'SERVICE_FIRST');
assert.equal(project.content_policy.online_prices_visible,false);
assert.deepEqual(project.expected_page_set.map(x=>x.path),['/','/eisbecher/','/eistorten/','/eisvitrine/','/kontakt/']);

const nav=fs.readFileSync(path.join(root,'assets/js/components/nav.js'),'utf8');
for(const href of ['/','/eisbecher/','/eistorten/','/eisvitrine/','/kontakt/'])assert.ok(nav.includes("href: '"+href+"'"),'navigation '+href);
assert.doesNotMatch(nav,/Eisbomben|\/sortiment\//);
const js=fs.readFileSync(path.join(root,'assets/js/app.js'),'utf8');
assert.doesNotMatch(js,/flavor-grid|cup-menu|extras-menu|pricing\.js/);
const request=fs.readFileSync(path.join(root,'assets/js/components/request-form.js'),'utf8');
assert.doesNotMatch(request,/FLAVORS|Eisbomb|sorten auswählen/i);
for(const obsolete of ['assets/js/data/pricing.js','assets/js/data/flavors.js','assets/js/components/cup-menu.js','assets/js/components/flavor-grid.js','confirmed-project-inputs.json'])assert.ok(!fs.existsSync(path.join(root,obsolete)),'internal list must not be deployed: '+obsolete);


const css=fs.readFileSync(path.join(root,'assets/css/style.css'),'utf8');
for(const marker of ['.v6-hero','.v6-product-card','.v6-request-section','.v6-rental-board','.site-header__logo','@media (max-width:820px)','AURENTARA Web Execution Bridge V1: START'])assert.ok(css.includes(marker),marker);
assert.match(css,/hyphens:none/);
assert.match(css,/drop-shadow/);
console.log('OK: Gelato Donatello SERVICE_FIRST acceptance. 5 main pages, 2 legacy redirects, zero visible prices, no flavor/bomb catalog, baseline absent from published project, logo retained, private-only.');
