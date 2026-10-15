import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
import path from 'node:path';import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>readFileSync(path.join(root,p),'utf8');
const home=read('index.html'),cups=read('eisbecher/index.html');
const cake=read('eistorten/index.html'),vitrine=read('eisvitrine/index.html');
const form=read('assets/js/components/request-form.js'),css=read('assets/css/style.css');
test('V124: original home hero image remains eager while original location map/cake thumbnail are lazy',()=>{
 assert.match(home,/src="\/assets\/images\/flavors\/pistazie\.webp"[^>]+loading="eager" fetchpriority="high"/);
 assert.match(home,/gelato-donatello-original-location-v105\.jpg"[\s\S]*?width="1448" height="1086" loading="lazy" decoding="async" fetchpriority="low"/);
 assert.match(home,/eistorte-01\.webp"[^>]+loading="lazy"/);
 assert.ok(statSync(path.join(root,'assets/images/editorial/gelato-donatello-original-location-v105.jpg')).size>750000);
});
test('V124: original cup hero retained and first four products lazy-load, all category data untouched',()=>{
 assert.match(cups,/cups111-hero__single-image" src="\/assets\/images\/cups\/tartufo-becher\.webp"[^>]+loading="eager"/);
 for(const item of ['amarena-becher.webp','erdbeer-becher.webp','fruechte-becher.webp','ananas-becher.webp']){
  assert.match(cups,new RegExp(item.replace('.','\\.')+'" width="1254" height="1254" loading="lazy"'));
 }
 for(const cat of ['eisbecher','spaghetti-eisbecher','joghurtbecher','kinderbecher'])assert.match(cups,new RegExp('data-cups-panel="'+cat+'"'));
 assert.equal((cups.match(/class="cups111-product"/g)||[]).length,31);
});
test('V124: cake/vitrine contact makes a real phone link visible before submission without collecting data',()=>{
 assert.match(form,/class="request-form__call-direct"/);
 assert.match(form,/href="\$\{BUSINESS\.phoneHref\}"/);
 assert.match(form,/Lieber direkt anrufen/);
 assert.match(form,/Es wird nichts automatisch versendet/);
 assert.match(form,/event\.preventDefault\(\)/);
 assert.doesNotMatch(form,/fetch\(|sendBeacon\(|XMLHttpRequest|type="button" onclick/);
 for(const page of [cake,vitrine]){
  assert.match(page,/<noscript><p class="request-form__nojs"/);
  assert.match(page,/href="tel:\+4968069394980"/);
 }
 assert.match(css,/\.request-form__call-direct\{/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)\{\.request-form__call-direct\{transition:none\}\}/);
});
test('V124: Event interest form remains disabled and no payment or production APIs are introduced',()=>{
 const e=read('events/index.html');
 assert.match(e,/data-event-form-status="disabled"/);
 assert.match(e,/<fieldset disabled>/);
 assert.match(e,/class="ev121-form__submit" disabled/);
 assert.doesNotMatch(e,/type="submit"|action="\/api/);
});
