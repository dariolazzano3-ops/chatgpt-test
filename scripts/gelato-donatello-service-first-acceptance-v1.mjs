import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const repo=process.cwd();
const root=path.join(repo,'projects','gelato-donatello-premium-v6');
const pages=['index.html','eisbecher/index.html','eissorten/index.html','eistorten/index.html','eisvitrine/index.html','kontakt/index.html'];
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
  // Only specialty cakes/bombs and the rental service may publish rates.
  if(!['eistorten/index.html','eisvitrine/index.html'].includes(pages[i])){
    assert.doesNotMatch(html,/\d+(?:[.,]\d+)?\s*€|EUR\b|Kugel Eis[^<]*\d+|preise direkt|Aktuelle Karte|alle 41 sorten/i,'no ordinary menu prices in '+pages[i]);
  }
  for(const match of html.matchAll(/(?:src|href|data-asset-path)="(\/[^"#?]+)"/g)){
    const ref=match[1];
    assert.ok(fs.existsSync(path.join(root,ref.slice(1)))||fs.existsSync(path.join(root,ref.slice(1),'index.html')),'missing file '+ref+' in '+pages[i]);
  }
}
const [home,cups,flavorsPage,cakes,rental,contact]=originals;
for(const marker of ['v6-hero','v6-facts','v6-feature-dark','v6-showcase','v6-cup-story','v6-image-story'])assert.ok(home.includes(marker),marker);
assert.match(home,/1965/);
assert.match(home,/<a class="v7-flavor-hero-link" href="\/eissorten\/"[^>]*>/,'homepage hero must link to real Eissorten page');
assert.match(home,/Alle Eissorten/);
assert.match(home,/class="v6-hero__badge"/,'1965 stamp must remain');
assert.ok(home.indexOf('v7-flavor-hero-link')>home.indexOf('v6-hero__visual'));
assert.ok(home.indexOf('v7-flavor-hero-link')<home.indexOf('v6-hero__badge'));
assert.match(flavorsPage,/Unsere Eissorten\./);
assert.match(flavorsPage,/Die Auswahl kann saisonal wechseln/);
assert.match(flavorsPage,/Aktuell verfügbare Sorten und Preise erfährst du vor Ort/);
assert.doesNotMatch(flavorsPage,/\d+(?:[.,]\d+)?\s*€|EUR\b|1,60/,'Eissorten page must not show prices');
const flavorImageUrls=[...flavorsPage.matchAll(/<img src="(\/assets\/images\/flavors\/[^"]+)"[^>]+>/g)].map(m=>m[1]);
const flavorDir=path.join(root,'assets','images','flavors');
const availableFlavorUrls=fs.readdirSync(flavorDir).filter(name=>name.endsWith('.webp')).map(name=>'/assets/images/flavors/'+name);
assert.equal(flavorImageUrls.length,41,'exact 41 known flavor images');
assert.deepEqual([...flavorImageUrls].sort(),availableFlavorUrls.sort(),'all owner-provided flavor images must appear exactly once');
for(const url of flavorImageUrls) assert.ok(fs.existsSync(path.join(root,url.slice(1))),url);

assert.doesNotMatch(home,/href="\/sortiment\/"/);
assert.match(cups,/v6-photo-strip/);
assert.match(cups,/photo-gallery/);
assert.doesNotMatch(cups,/data-component="cup-menu"|data-component="extras-menu"/);
assert.match(cakes,/Eistorte/i);
assert.match(cakes,/Spaghetti-Eistorte/);
assert.match(cakes,/data-include-flavor-picker="false"/);
assert.doesNotMatch(cakes,/data-component="flavor-grid"/);
for(const label of ['Eisbomben','40 Kugeln','60 Kugeln','18 cm','20 cm','24 cm','26 cm']){
  assert.ok(cakes.includes(label),'missing specialty offering: '+label);
}
for(const price of ['65 €','75 €','95 €','109 €','5 €']){
  assert.ok(cakes.includes(price),'missing specialty price: '+price);
}
assert.doesNotMatch(cakes,/1,60\s*€|Kugel Eis[^<]*1,60/i,'no ordinary scoop price in cakes');
const cakeMoney=[...cakes.matchAll(/(?:\+)?\d+(?:[,.]\d+)?\s*€/g)].map(m=>m[0].trim().replace(/^\+/, ''));
for(const price of cakeMoney) assert.ok(['5 €','65 €','75 €','95 €','109 €'].includes(price),'unexpected specialty price: '+price);
assert.match(rental,/Eisvitrine mieten/);
assert.match(rental,/data-component="request-form"/);
for(const price of ['250 €','100 €']) assert.ok(rental.includes(price),'missing rental price: '+price);
for(const label of ['5 L','Miete','Kaution','ca. 90 cm']) assert.ok(rental.includes(label),'missing rental specification: '+label);
const rentalMoney=[...rental.matchAll(/\d+(?:[,.]\d+)?\s*€/g)].map(m=>m[0].trim());
for(const price of rentalMoney) assert.ok(['250 €','100 €'].includes(price),'unexpected rental price: '+price);
assert.match(contact,/06806 9394980/);
assert.match(fs.readFileSync(path.join(root,'sortiment/index.html'),'utf8'),/url=\/eisbecher\//);
assert.match(fs.readFileSync(path.join(root,'eistorten-eisbomben/index.html'),'utf8'),/url=\/eistorten\//);

// Full cake portfolio: all 19 Eistorten, 3 Spaghetti-Eistorten and 2 Eisbomben.
const galleryImages=[...cakes.matchAll(/data-cake-image="(\/assets\/images\/cakes\/[^"]+)"/g)].map(m=>m[1]);
const expectedGallery=[
  ...Array.from({length:19},(_,i)=>'/assets/images/cakes/eistorte-'+String(i+1).padStart(2,'0')+'.webp'),
  ...Array.from({length:3},(_,i)=>'/assets/images/cakes/spaghetti-eistorte-'+String(i+1).padStart(2,'0')+'.webp'),
  ...Array.from({length:2},(_,i)=>'/assets/images/cakes/eisbombe-'+String(i+1).padStart(2,'0')+'.webp')
];
assert.equal(galleryImages.length,24,'24 gallery cards required');
assert.deepEqual([...galleryImages].sort(),[...expectedGallery].sort(),'every unique cake photo must appear');
for(const img of galleryImages) assert.ok(fs.existsSync(path.join(root,img.slice(1))),'missing gallery photo: '+img);
const categories=[...cakes.matchAll(/data-cake-category="([a-z]+)"/g)].map(m=>m[1]);
assert.equal(categories.filter(c=>c==='eistorte').length,19);
assert.equal(categories.filter(c=>c==='spaghetti').length,3);
assert.equal(categories.filter(c=>c==='eisbombe').length,2);
assert.match(cakes,/data-cake-filter="alle"/);
assert.match(cakes,/data-cake-filter="spaghetti"/);
assert.match(cakes,/v6-cake-lightbox/);
// Cakes remain in the full gallery and the 24-photo homepage iPad.
const ipadPhotos=[...home.matchAll(/<a class="v6-ipad__slide"[\s\S]*?<img src="(\/assets\/images\/cakes\/[^"]+)"/g)].map(m=>m[1]);
assert.equal(ipadPhotos.length,24,'homepage iPad retains all 24 cake photos');
assert.deepEqual([...ipadPhotos].sort(),[...expectedGallery].sort(),'iPad retains each cake photo exactly once');
assert.match(home,/\/eistorten\/#kreationen/);
assert.doesNotMatch(home,/v6-cake-teaser|24 Ideen\. Dein ganz besonderer Anlass/,'redundant cake teaser must be removed');
assert.match(home,/class="v7-event-teaser"/,'new event teaser required');
assert.match(home,/Gelato für dein Event\./);
assert.match(home,/Unsere Eisvitrine bringt Gelato Donatello direkt zu Hochzeiten, Geburtstagen und besonderen Feiern\./);
assert.match(home,/href="\/eisvitrine\/"[^>]*>[\s\S]*?Eisvitrine entdecken/);
assert.match(home,/class="v6-showcase"/,'Eisbecher showcase must remain after event teaser');
assert.ok(home.indexOf('v7-event-teaser')>home.indexOf('v6-feature-dark'));
assert.ok(home.indexOf('v7-event-teaser')<home.indexOf('v6-showcase'));
// Owner-approved colorful and accessible hero: all 41 existing flavor photos.
assert.match(home,/data-hero-flavors/,'Homepage hero must run authentic flavor slideshow');
assert.match(home,/data-flavor-name>Pistazie/);
assert.equal((home.match(/data-flavor-photo/g)||[]).length,2,'crossfade must retain two photos');
assert.doesNotMatch(home,/Unsere Eiswelt|data-flavor-count|v8-flavor-controls|data-flavor-prev|data-flavor-next|data-flavor-toggle/,'owner requested only the sort name, no counter or controls');
assert.match(home,/Alle Eissorten/,'full catalog CTA remains visible');
const flavorHeroJS=fs.readFileSync(path.join(root,'assets/js/components/hero-flavors.js'),'utf8');
assert.match(flavorHeroJS,/const INTERVAL = 2000;/);
assert.doesNotMatch(flavorHeroJS,/data-flavor-count|data-flavor-prev|data-flavor-next|data-flavor-toggle/,'removed controls must not be required by runtime');
assert.match(flavorHeroJS,/prefers-reduced-motion: reduce/);
assert.match(flavorHeroJS,/touchstart/);
assert.match(flavorHeroJS,/touchend/);
assert.match(flavorHeroJS,/visibilitychange/);
assert.match(flavorHeroJS,/IntersectionObserver/);
const flavorHeroSources=[...flavorHeroJS.matchAll(/"src":"(\/assets\/images\/flavors\/[^"]+)"/g)].map(m=>m[1]);
assert.equal(flavorHeroSources.length,41,'hero slideshow requires all 41 documented flavor photos');
assert.deepEqual([...flavorHeroSources].sort(),[...flavorImageUrls].sort(),'hero uses exactly the gallery flavor images');
execFileSync(process.execPath,['--test',path.join(root,'tests/hero-flavors.test.mjs')],{cwd:repo,stdio:'pipe',timeout:20000});
const appJs=fs.readFileSync(path.join(root,'assets/js/app.js'),'utf8');
assert.match(appJs,/initHeroFlavors\(\)/,'homepage slideshow must be initialized');
for(const token of ['initCakeGallery','dialog.showModal','ArrowLeft','ArrowRight']) assert.ok(appJs.includes(token),'missing gallery interaction '+token);

const project=JSON.parse(fs.readFileSync(path.join(root,'project.json'),'utf8'));
assert.equal(project.schema,'aurentara.gelato-premium-website.v6');
assert.equal(project.preview_policy.mode,'PRIVATE_CLOUDFLARE_ACCESS_ONLY');
assert.equal(project.safety.production_deploy,false);
assert.equal(project.safety.public_deploy,false);
assert.equal(project.safety.dns_changes,false);
assert.equal(project.safety.external_writes,false);
assert.equal(project.content_policy.strategy,'SERVICE_FIRST_WITH_SPECIALTY_PRICING');
assert.equal(project.content_policy.online_prices_visible,true);
assert.deepEqual(project.content_policy.online_price_exceptions,['/eistorten/','/eisvitrine/']);
assert.equal(project.content_policy.dedicated_flavor_catalog,true);
assert.equal(project.content_policy.eisbomben_promotion,true);
assert.deepEqual(project.expected_page_set.map(x=>x.path),['/','/eisbecher/','/eissorten/','/eistorten/','/eisvitrine/','/kontakt/']);

const nav=fs.readFileSync(path.join(root,'assets/js/components/nav.js'),'utf8');
for(const href of ['/','/eisbecher/','/eistorten/','/eisvitrine/','/kontakt/'])assert.ok(nav.includes("href: '"+href+"'"),'navigation '+href);
assert.match(nav,/Eistorten & Eisbomben/);
assert.doesNotMatch(nav,/\/sortiment\//);
const js=fs.readFileSync(path.join(root,'assets/js/app.js'),'utf8');
assert.doesNotMatch(js,/flavor-grid|cup-menu|extras-menu|pricing\.js/);
const request=fs.readFileSync(path.join(root,'assets/js/components/request-form.js'),'utf8');
assert.doesNotMatch(request,/FLAVORS|sorten auswählen/i);
for(const obsolete of ['assets/js/data/pricing.js','assets/js/data/flavors.js','assets/js/components/cup-menu.js','assets/js/components/flavor-grid.js','confirmed-project-inputs.json'])assert.ok(!fs.existsSync(path.join(root,obsolete)),'internal list must not be deployed: '+obsolete);


const css=fs.readFileSync(path.join(root,'assets/css/style.css'),'utf8');
assert.match(css,/v6-hero\[data-hero-flavors\]/);
assert.match(css,/--hero-tone/);
for(const marker of ['.v6-hero','.v6-product-card','.v6-request-section','.v6-rental-board','.site-header__logo','@media (max-width:820px)','AURENTARA Web Execution Bridge V1: START'])assert.ok(css.includes(marker),marker);
assert.match(css,/hyphens:none/);
assert.match(css,/drop-shadow/);
console.log('OK: Gelato Donatello SERVICE_FIRST acceptance. 6 main pages, 2 legacy redirects, 41 price-free Eissorten photo tiles, 24 cake gallery images, 24-photo iPad, dedicated Eisvitrine event teaser, no scoop/cup prices, specialty prices restored, baseline absent from published project, logo retained, private-only.');
