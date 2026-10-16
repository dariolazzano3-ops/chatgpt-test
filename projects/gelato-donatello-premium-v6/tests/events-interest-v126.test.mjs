import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import worker,{validateSyntheticInterest} from '../scripts/event-interest-api-v126.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>readFileSync(path.join(root,p),'utf8');
const html=read('events/index.html'), js=read('assets/js/event-interest-v126.js'),css=read('assets/css/events-v126.css');
const origin='https://private-gelato-preview.example.test';
const synthetic={name:'Test Gast',email:'test@example.test',phone:'',requested_seats:2,note:'',
  test_data_confirmed:true,marketing_opt_in:false,privacy_notice_version:'demo-v1'};
const make=(data=synthetic, originHeader=origin, path='/api/events-interest')=>new Request(origin+path,{
 method:'POST',headers:{'origin':originHeader,'content-type':'application/json'},body:JSON.stringify(data)});
test('Original V125 hero and other Event content remain intact',()=>{
 assert.match(html,/gelato-event-eislabor-original-v125\.jpg/);
 assert.ok(statSync(path.join(root,'assets/images/events/gelato-event-eislabor-original-v125.jpg')).size>100000);
 assert.match(html,/Ein Blick hinter <em>die Kulissen\.<\/em>/);
 assert.match(html,/id="ev121-highlights-title"/);
 assert.match(html,/id="ev121-program-title"/);
 assert.match(html,/id="ev121-details-title"/);
});
test('Private test-only API returns a receipt without storing, mailing or booking',async()=>{
 assert.equal(validateSyntheticInterest(synthetic),null);
 const res=await worker.fetch(make(),{});
 assert.equal(res.status,200);const j=await res.json();
 assert.equal(j.mode,'test-only');assert.equal(j.ok,true);assert.equal(j.stored,false);
 assert.equal(j.notified,false);assert.equal(j.booking,false);
 assert.match(j.receipt,/^DEMO-[0-9A-F]{8}$/);
 assert.match(res.headers.get('cache-control'),/no-store/);
});
test('Test-only status is reported to browser before enabling controls',async()=>{
 const r=await worker.fetch(new Request(origin+'/api/events-interest/status'),{});
 const j=await r.json();
 assert.equal(j.storage,'disabled');assert.equal(j.notifications,'not_sent');
 assert.equal(j.real_submissions,false);assert.equal(j.booking,false);
 assert.match(html,/data-event-form-status="synthetic-only"/);
 assert.match(html,/<fieldset disabled>/);
 assert.match(html,/class="ev121-form__submit ev126-submit" disabled/);
 assert.match(js,/mode\.storage!=='disabled'/);
 assert.match(js,/fields\.disabled=false;submit\.disabled=false/);
 assert.match(html,/name="test_data_confirmed"[^>]+required/);
});
test('Strict synthetic gate rejects real-looking addresses, names, phones, prose',async()=>{
 const cases=[
  [{...synthetic,name:'Max Mustermann'},'ONLY_SYNTHETIC_NAME'],
  [{...synthetic,email:'max@gmail.com'},'ONLY_SYNTHETIC_EMAIL'],
  [{...synthetic,phone:'+491701234567'},'ONLY_SYNTHETIC_PHONE'],
  [{...synthetic,note:'Mein Geburtstag ist morgen'},'ONLY_SYNTHETIC_NOTE'],
  [{...synthetic,requested_seats:500},'INVALID_SEAT_COUNT'],
  [{...synthetic,test_data_confirmed:false},'TEST_CONFIRMATION_REQUIRED'],
  [{...synthetic,marketing_opt_in:true},'MARKETING_DISABLED'],
  [{...synthetic,unknown:'unexpected'},'INVALID_FIELDS'],
 ];
 for(const [body,expected] of cases){
  const r=await worker.fetch(make(body),{});const j=await r.json();
  assert.equal(r.status,422,expected);assert.equal(j.code,expected);assert.equal(j.ok,false);
 }
});
test('Rejects cross-site, missing JSON, large payload, and unsupported HTTP methods',async()=>{
 assert.equal((await worker.fetch(make(synthetic,'https://evil.example'),{})).status,403);
 assert.equal((await worker.fetch(new Request(origin+'/api/events-interest',{method:'GET'}),{})).status,405);
 assert.equal((await worker.fetch(new Request(origin+'/api/events-interest',{method:'POST',headers:{origin,'content-type':'text/plain'},body:'foo'}),{})).status,415);
 assert.equal((await worker.fetch(new Request(origin+'/api/events-interest',{method:'POST',headers:{origin,'content-type':'application/json'},body:'A'.repeat(2800)}),{})).status,413);
});
test('Demo UX confirmation is honest, accessible, and no third-party request made',()=>{
 assert.match(html,/role="status" aria-live="polite" tabindex="-1" hidden/);
 assert.match(html,/keine echte Anmeldung/i);
 assert.match(html,/nichts gespeichert, verschickt oder gebucht/);
 assert.match(html,/Interesse vormerken/);
 assert.match(html,/Optionale Event-Updates[\s\S]*deaktiviert/);
 assert.match(js,/fetch\(endpoint/);
 assert.doesNotMatch(js,/localStorage|sessionStorage|sendBeacon|location\.href|mailto:/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
 assert.match(read('_headers'),/connect-src 'self'/);
 assert.match(read('_headers'),/form-action 'none'/);
});
test('Wrangler has single private Worker with static assets and API-only routing',()=>{
 const w=JSON.parse(read('wrangler.private-preview.jsonc').replace(/^\s*\/\/.*$/gm,''));
 assert.equal(w.name,'gelato-donatello-private-preview-v2');
 assert.deepEqual(w.assets.run_worker_first,['/api/*']);
 assert.equal(w.assets.binding,'ASSETS');
 assert.ok(read('.assetsignore').includes('scripts/'));
 assert.ok(read('.assetsignore').includes('tests/'));
});
