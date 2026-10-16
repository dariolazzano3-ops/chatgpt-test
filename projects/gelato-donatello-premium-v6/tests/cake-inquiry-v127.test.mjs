import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync,statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import worker,{validateCakeInquiry} from '../scripts/cake-inquiry-api-v127.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const get=p=>readFileSync(path.join(root,p),'utf8');
const origin='https://gelato-private-preview.example.test';
const later=new Date(Date.now()+30*86400000).toISOString().slice(0,10);
const valid={variante:'Klassische Eistorte',kreation:'Nr. 01 · Donatello Classico',groesse:'20 cm',eissorten:['Erdbeere','Vanille'],dekoration:'TEST: Schokolade und Beeren',wunschdatum:later,bemerkungen:'',name:'Test Gast',email:'test@example.test',phone:'',website:'',test_data_confirmed:true,marketing_opt_in:false,privacy_notice_version:'demo-v1'};
const req=(d=valid,href='/api/cakes-interest',headers={})=>new Request(origin+href,{method:'POST',headers:{'origin':origin,'content-type':'application/json',...headers},body:JSON.stringify(d)});
test('Valid cake demo returns ephemeral confirmation, never stores, notifies, charges or books',async()=>{
 assert.equal(validateCakeInquiry(valid),null);
 const r=await worker.fetch(req(),{});
 assert.equal(r.status,200);const j=await r.json();
 assert.equal(j.mode,'test-only');assert.equal(j.ok,true);assert.equal(j.stored,false);
 assert.equal(j.notified,false);assert.equal(j.booking,false);
 assert.match(j.receipt,/^DEMO-CAKE-[0-9A-F]{8}$/);
 assert.match(r.headers.get('cache-control'),/no-store/);
});
test('Bombs use 40 or 60 scoops, with 1 to 6 flavor selections',async()=>{
 const bomb={...valid,variante:'Eisbombe',kreation:'Nr. 23 · Eisbombe Classica',groesse:'40 Kugeln',eissorten:['Erdbeere','Vanille','Pistazie']};
 assert.equal(validateCakeInquiry(bomb),null);
 assert.equal(validateCakeInquiry({...bomb,groesse:'60 Kugeln'}),null);
 assert.equal(validateCakeInquiry({...bomb,eissorten:['Vanille']}),null);
 assert.equal(validateCakeInquiry({...bomb,eissorten:['Vanille','Vanille']}),'DUPLICATE_FLAVORS');
 assert.equal(validateCakeInquiry({...bomb,eissorten:[]}), 'WRONG_FLAVOR_COUNT');
});
test('Spaghetti and standard cake must have matching creation, size and exactly two distinct flavors',()=>{
 assert.equal(validateCakeInquiry({...valid,variante:'Spaghetti-Eistorte',kreation:'Nr. 20 · Spaghetti Classico'}),null);
 assert.equal(validateCakeInquiry({...valid,groesse:'40 Kugeln'}),'TYPE_SIZE_MISMATCH');
 assert.equal(validateCakeInquiry({...valid,variante:'Eisbombe',groesse:'40 Kugeln'}),'CREATION_TYPE_MISMATCH');
 assert.equal(validateCakeInquiry({...valid,eissorten:['Erdbeere']}),'WRONG_FLAVOR_COUNT');
 assert.equal(validateCakeInquiry({...valid,eissorten:['Erdbeere','Erdbeere']}),'DUPLICATE_FLAVORS');
 assert.equal(validateCakeInquiry({...valid,eissorten:['Erdbeere','Fake Name']}),'INVALID_FLAVORS');
 assert.equal(validateCakeInquiry({...valid,kreation:'Nr. 01 · Nicht echt'}),'INVALID_CREATION');
});
test('Real-looking identity, unapproved free text, missing acknowledgement and honeypot denied',async()=>{
 const examples=[
 [{...valid,name:'Max Mustermann'},'ONLY_SYNTHETIC_NAME'],
 [{...valid,email:'real@gmail.com'},'ONLY_SYNTHETIC_EMAIL'],
 [{...valid,phone:'+491701234567'},'ONLY_SYNTHETIC_PHONE'],
 [{...valid,dekoration:'Geburtstag von Max'},'ONLY_SYNTHETIC_WISHES'],
 [{...valid,bemerkungen:'Bitte echte Kundendaten'},'ONLY_SYNTHETIC_WISHES'],
 [{...valid,website:'botsite'},'HONEYPOT'],
 [{...valid,test_data_confirmed:false},'TEST_CONFIRMATION_REQUIRED'],
 [{...valid,marketing_opt_in:true},'MARKETING_DISABLED'],
 [{...valid,other:'anything'},'INVALID_FIELDS'],
 [{...valid,wunschdatum:'2020-02-29'},'INVALID_DATE'],
 [{...valid,wunschdatum:'2031-02-30'},'INVALID_DATE']
 ];
 for(const [data,expected] of examples){
   const r=await worker.fetch(req(data),{}),j=await r.json();
   assert.equal(r.status,422,expected);assert.equal(j.code,expected);
 }
});
test('Cross-origin, unsupported verb/content-type and large JSON are rejected',async()=>{
 assert.equal((await worker.fetch(req(valid,'/api/cakes-interest',{origin:'https://evil.example'}),{})).status,403);
 assert.equal((await worker.fetch(new Request(origin+'/api/cakes-interest'),{})).status,405);
 assert.equal((await worker.fetch(new Request(origin+'/api/cakes-interest',{method:'POST',headers:{origin,'content-type':'text/plain'},body:'hi'}),{})).status,415);
 assert.equal((await worker.fetch(new Request(origin+'/api/cakes-interest',{method:'POST',headers:{origin,'content-type':'application/json'},body:'x'.repeat(6000)}),{})).status,413);
});
test('Test status reports locked-down mode and existing Events Worker still behaves unchanged',async()=>{
 const r=await worker.fetch(new Request(origin+'/api/cakes-interest/status'),{});
 const d=await r.json();
 assert.equal(d.mode,'test-only');assert.equal(d.real_submissions,false);
 assert.equal(d.storage,'disabled');assert.equal(d.notifications,'not_sent');assert.equal(d.booking,false);
 const event=await worker.fetch(new Request(origin+'/api/events-interest/status'),{});
 assert.equal((await event.json()).mode,'test-only');
});
test('24 original creation cards with images, category links and no changed assets',()=>{
 const html=get('eistorten/index.html');
 assert.equal((html.match(/data-request-cake="\d\d"/g)||[]).length,24);
 assert.equal((html.match(/class="v6-cake-gallery__item"/g)||[]).length,24);
 assert.equal((html.match(/<img src="\/assets\/images\/cakes\//g)||[]).length,24);
 for(let i=1;i<=19;i++)assert.ok(statSync(path.join(root,'assets/images/cakes/eistorte-'+String(i).padStart(2,'0')+'.webp')).size>10000);
 assert.match(html,/data-component="cake-interest-form"/);
 assert.match(html,/\/assets\/css\/cake-inquiry-v127.css/);
});
test('Frontend uses shared 41 flavors, native validation, fail-closed test gating and recap',()=>{
 const client=get('assets/js/components/cake-inquiry-v127.js');
 assert.match(client,/import \{ FLAVORS \} from '.\/hero-flavors.js'/);
 assert.match(client,/fieldset disabled/);
 assert.match(client,/form\.reportValidity\(\)/);
 assert.match(client,/real_submissions!==false/);
 assert.match(client,/data-demo-status="locked"/);
 assert.match(client,/textContent=value/);
 assert.doesNotMatch(client,/localStorage|sessionStorage|mailto:|sendBeacon/);
 const w=get('wrangler.private-preview.jsonc');
 assert.match(w,/(cake-inquiry-api-v127|rental-inquiry-api-v128)\.mjs/);
 assert.match(w,/"run_worker_first": \["\/api\/\*"\]/);
 assert.match(get('docs/cakes-interest-v127-activation.md'),/privacy notice/);
});
