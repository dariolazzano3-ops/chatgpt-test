import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const repo=process.cwd();
const root=path.join(repo,'projects','gelato-donatello-premium-v6');
const routes=['index.html','sortiment/index.html','eisbecher/index.html','eistorten-eisbomben/index.html','eisvitrine/index.html','kontakt/index.html'];
for(const rel of routes){
  const file=path.join(root,rel);
  assert.ok(fs.existsSync(file), 'missing route '+rel);
  const html=fs.readFileSync(file,'utf8');
  assert.match(html,/noindex,nofollow,noarchive/);
  assert.match(html,/assets\/css\/style\.css/);
  assert.doesNotMatch(html,/data-asset-pending="true"/,'V6 should not expose pending-image blocks: '+rel);
}

const project=JSON.parse(fs.readFileSync(path.join(root,'project.json'),'utf8'));
assert.equal(project.schema,'aurentara.gelato-premium-website.v6');
assert.equal(project.safety.production_deploy,false);
assert.equal(project.safety.public_deploy,false);
assert.equal(project.safety.dns_changes,false);
assert.equal(project.safety.external_writes,false);
assert.equal(project.preview_policy.mode,'PRIVATE_CLOUDFLARE_ACCESS_ONLY');

const flavors=await import(pathToFileURL(path.join(root,'assets/js/data/flavors.js')).href);
assert.equal(flavors.FLAVORS.length,41);
assert.equal(new Set(flavors.FLAVORS.map(f=>f.label)).size,41);
for(const f of flavors.FLAVORS){
  const img=path.join(root,flavors.flavorImagePath(f.slug).replace(/^\//,''));
  assert.ok(fs.existsSync(img),'missing flavor image '+f.label);
}

const home=fs.readFileSync(path.join(root,'index.html'),'utf8');
for(const marker of ['v6-hero','v6-facts','v6-feature-dark','v6-showcase','v6-cup-story','v6-image-story']) assert.ok(home.includes(marker),marker);
const cakes=fs.readFileSync(path.join(root,'eistorten-eisbomben/index.html'),'utf8');
assert.match(cakes,/Klassische Eistorte/);
assert.match(cakes,/Spaghetti-Eistorte/);
assert.match(cakes,/Eisbombe/);
assert.match(cakes,/data-include-flavor-picker="true"/);
assert.match(cakes,/Auswahl zusammenfassen|request-form/);
const rental=fs.readFileSync(path.join(root,'eisvitrine/index.html'),'utf8');
assert.match(rental,/bewusst keine erfundene Produktabbildung/);
assert.doesNotMatch(rental,/mobil-1\.jpg|mobil-2\.jpg/);

const css=fs.readFileSync(path.join(root,'assets/css/style.css'),'utf8');
for(const marker of ['.v6-hero','.v6-product-card','.flavor-grid__list','.v6-request-section','.v6-rental-board','@media (max-width:820px)']) assert.ok(css.includes(marker),marker);
assert.match(css,/hyphens:none/);

const visiblePages=routes.map(rel=>fs.readFileSync(path.join(root,rel),'utf8')).join('\n');
assert.doesNotMatch(visiblePages,/Koellerbach|Hauptstrasse|fuer jeden besonderen Anlass/);

console.log('OK: Gelato Donatello Premium V6 static acceptance passed: 6 routes, 41 flavor images, designer structure, request UX, private-only safety.');