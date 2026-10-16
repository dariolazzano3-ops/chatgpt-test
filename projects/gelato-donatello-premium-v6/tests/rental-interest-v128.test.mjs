import {test} from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {readFileSync,statSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import worker,{validateRentalInterest} from '../scripts/rental-inquiry-api-v128.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>readFileSync(path.join(root,p),'utf8');
const origin='https://private-gelato.example.test';
const inThirtyDays=new Date(Date.now()+30*86400000).toISOString().slice(0,10);
const good={anlass:'Hochzeit',datum:inThirtyDays,ort:'TEST: Musterort',gaeste:90,eissorten:['Pistazie','Erdbeere'],name:'Test Gast',email:'test@example.test',telefon:'',website:'',test_data_confirmed:true,marketing_opt_in:false,privacy_notice_version:'demo-v1'};
const req=(d=good,base='/api/rental-interest',headers={})=>new Request(origin+base,{method:'POST',headers:{origin,'content-type':'application/json',...headers},body:JSON.stringify(d)});
test('Complete digital test-only rental interest returns a non-persistent demo confirmation',async()=>{
 assert.equal(validateRentalInterest(good),null);
 const res=await worker.fetch(req(),{});
 assert.equal(res.status,200);
 const body=await res.json();
 assert.equal(body.ok,true);assert.equal(body.mode,'test-only');
 assert.equal(body.stored,false);assert.equal(body.notified,false);assert.equal(body.booking,false);
 assert.match(body.receipt,/^DEMO-RENT-[0-9A-F]{8}$/);
 assert.match(res.headers.get('cache-control'),/no-store/);
});
test('Future date, supported events, locations, guest estimates, and existing flavor names validated',()=>{
 assert.equal(validateRentalInterest({...good,anlass:'Firmenevent',gaeste:1000,eissorten:['Açaí','Vanille','Cookies','Erdbeere']}),null);
 assert.equal(validateRentalInterest({...good,anlass:'Geburtstag'}),null);
 assert.equal(validateRentalInterest({...good,anlass:'other real venue'}),'INVALID_OCCASION');
 assert.equal(validateRentalInterest({...good,ort:'Hauptstrasse 4'}),'ONLY_SYNTHETIC_VENUE');
 assert.equal(validateRentalInterest({...good,gaeste:0}),'INVALID_GUEST_COUNT');
 assert.equal(validateRentalInterest({...good,gaeste:1.5}),'INVALID_GUEST_COUNT');
 assert.equal(validateRentalInterest({...good,eissorten:[]}), 'INVALID_FLAVORS');
 assert.equal(validateRentalInterest({...good,eissorten:['Vanille','Vanille']}),'DUPLICATE_FLAVORS');
 assert.equal(validateRentalInterest({...good,eissorten:['Invented']}),'INVALID_FLAVORS');
 assert.equal(validateRentalInterest({...good,eissorten:['Vanille','Cookies','Erdbeere','Açaí','Pistazie']}),'INVALID_FLAVORS');
 assert.equal(validateRentalInterest({...good,datum:'2020-01-01'}),'INVALID_DATE');
 assert.equal(validateRentalInterest({...good,datum:'2028-02-30'}),'INVALID_DATE');
});
test('No actual identity, unreviewed free text, automation, or marketing data accepted',async()=>{
 const cases=[
 [{...good,name:'Max Mustermann'},'ONLY_SYNTHETIC_NAME'],
 [{...good,email:'real@gmail.com'},'ONLY_SYNTHETIC_EMAIL'],
 [{...good,telefon:'+491701234567'},'ONLY_SYNTHETIC_PHONE'],
 [{...good,website:'spam.invalid'},'HONEYPOT'],
 [{...good,marketing_opt_in:true},'MARKETING_DISABLED'],
 [{...good,test_data_confirmed:false},'TEST_CONFIRMATION_REQUIRED'],
 [{...good,privacy_notice_version:'unapproved'},'TEST_CONFIRMATION_REQUIRED'],
 [{...good,notes:'my private details'},'INVALID_FIELDS'],
 ];
 for(const [data,code] of cases){
  const r=await worker.fetch(req(data),{}),body=await r.json();
  assert.equal(r.status,422,code);assert.equal(body.code,code);
 }
});
test('Strict origin, JSON, length and method checks',async()=>{
 assert.equal((await worker.fetch(req(good,'/api/rental-interest',{origin:'https://evil.example'}),{})).status,403);
 assert.equal((await worker.fetch(new Request(origin+'/api/rental-interest'),{})).status,405);
 assert.equal((await worker.fetch(new Request(origin+'/api/rental-interest',{method:'POST',headers:{origin,'content-type':'text/plain'},body:'hi'}),{})).status,415);
 assert.equal((await worker.fetch(new Request(origin+'/api/rental-interest',{method:'POST',headers:{origin,'content-type':'application/json'},body:'x'.repeat(5000)}),{})).status,413);
});
test('Demo status fail-closed and both older demo endpoints still routed',async()=>{
 const result=await worker.fetch(new Request(origin+'/api/rental-interest/status'),{});
 const d=await result.json();
 assert.equal(d.real_submissions,false);assert.equal(d.storage,'disabled');
 assert.equal(d.notifications,'not_sent');assert.equal(d.booking,false);
 for(const api of ['/api/cakes-interest/status','/api/events-interest/status']){
  const r=await worker.fetch(new Request(origin+api),{});
  assert.equal((await r.json()).mode,'test-only');
 }
});
test('Original brand photography remains identical and is the prominent hero',()=>{
 const html=read('eisvitrine/index.html');
 assert.match(html,/\/assets\/images\/events\/gelato-vitrine-produkt-hd\.avif/);
 assert.match(html,/\/assets\/images\/events\/gelato-vitrine-produkt\.webp/);
 assert.match(html,/fetchpriority="high"/);
 assert.match(html,/class="r128-visual"/);
 assert.ok(statSync(path.join(root,'assets/images/events/gelato-vitrine-produkt-hd.avif')).size>40000);
 assert.ok(statSync(path.join(root,'assets/images/events/gelato-vitrine-produkt.webp')).size>5000);
 assert.equal((html.match(/data-rental-occasion=/g)||[]).length,3);
 assert.doesNotMatch(html,/250\s*€|100\s*€|20\s*Liter|Lieferung inklusive|garantiert/i);
});
test('Accessible UX, safety copy, native mobile controls and no new pricing/booking',()=>{
 const html=read('eisvitrine/index.html'),js=read('assets/js/components/rental-inquiry-v128.js'),css=read('assets/css/rental-v128.css');
 assert.match(html,/data-component="rental-inquiry-form"/);
 assert.match(html,/class="request-form__nojs"/);
 assert.match(html,/href="tel:\+4968069394980"/);
 assert.match(js,/fieldset disabled/);
 assert.match(js,/real_submissions!==false/);
 assert.match(js,/form\.reportValidity\(\)/);
 assert.match(js,/test@example\.test/);
 assert.match(js,/Interesse vormerken/);
 assert.match(js,/nichts gespeichert, verschickt oder reserviert/i);
 assert.doesNotMatch(js,/localStorage|sessionStorage|sendBeacon|mailto:/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
 assert.match(read('wrangler.private-preview.jsonc'),/rental-inquiry-api-v128.mjs/);
});
