// FollowClean Export + optional Checker V1: dry-run tests with synthetic data only.
// Usage: node apps/followclean/tests/export-checker-v1-smoke.mjs   (Node >= 22.5)
// NO Apify request, no Instagram access, no cost. The endpoint is exercised in-process.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
const dir=fileURLToPath(new URL('..',import.meta.url));
const worker=await readFile(dir+'worker.instagram-template.mjs','utf8');
const sql=await readFile(dir+'sql/fc_apify_budget_v2_pilot.sql','utf8');
const cut=(a,b)=>{const i=worker.indexOf(a),j=worker.indexOf(b);assert.ok(i>=0&&j>i,a);return worker.slice(i,j);};
const code=cut('/* FC_APIFY_SMARTSCAN_V2_START */','/* FC_APIFY_SMARTSCAN_V2_END */')+'\n'+
  cut('/* FC_APIFY_V2_LEDGER_START */','/* FC_APIFY_V2_LEDGER_END */')+'\n'+
  cut('/* FC_EXPORT_CHECKER_V1_START */','/* FC_EXPORT_CHECKER_V1_END */');
assert.ok(!/\bfetch\s*\(/.test(code),'export-checker blocks contain no network call');
const norm=v=>{if(typeof v!=='string')return null;const u=v.replace(/^@/,'').trim().toLowerCase();
  return /^[a-z0-9._]{1,30}$/.test(u)?u:null;};
const api=new Function('fcNormalizeUsername',code+
  '\nreturn {fcV2ReviewChecks,fcV2RunKey,fcV2Reserve,fcEcDeriveCandidates,fcEcNextStep,fcEcReport,fcEcDryRunBatch}')(norm);
let failed=0,count=0;
async function test(label,fn){count++;try{await fn();console.log('PASS',label);}
  catch(e){failed++;console.error('FAIL',label,e);process.exitCode=1;}}
const me='ysrrioo';
const mutuals=Array.from({length:40},(_,i)=>'mutual'+i);
const ghosts=Array.from({length:23},(_,i)=>'ghost'+i);
const exportData=(over={})=>({account:me,authorized:true,complete:true,
  following:[...mutuals.slice(0,5),...ghosts.slice(0,12),...mutuals.slice(5),...ghosts.slice(12)],
  followers:[...mutuals,'fanonly1','fanonly2'],...over});
const mark=(list,status)=>Object.fromEntries(list.map(u=>[u,status]));

await test('Export is the primary source: 23 non-followers at export time, in export order',()=>{
  const p=api.fcEcDeriveCandidates(exportData());
  assert.equal(p.ok,true);assert.deepEqual(p.candidates,ghosts);
  assert.deepEqual([p.source,p.asOf],['EXPORT','EXPORT_TIME']);
  assert.deepEqual(p.counts,{following:63,followers:42,nonFollowersAtExport:23,checkerRunsForAll:3});});
await test('Incomplete, unauthorised or malformed exports yield no candidates at all',()=>{
  const d=api.fcEcDeriveCandidates;
  assert.equal(d(exportData({complete:false})).reason,'export_incomplete');
  assert.equal(d(exportData({complete:'true'})).reason,'export_incomplete');
  assert.equal(d(exportData({authorized:false})).reason,'export_not_owner_authorized');
  assert.equal(d(exportData({account:'not a name'})).reason,'invalid_account');
  assert.equal(d(exportData({followers:'x'})).reason,'invalid_or_oversized_export');
  assert.equal(d(exportData({following:['ok','Bad Name!']})).reason,'invalid_or_oversized_export');
  assert.equal(d(exportData({following:Array.from({length:20001},(_,i)=>'u'+i)})).reason,'invalid_or_oversized_export');
  assert.equal(d(null).ok,false);});
await test('Duplicates, @ prefixes, case and the own account are normalised away',()=>{
  const p=api.fcEcDeriveCandidates({account:'@YSRRIOO',authorized:true,complete:true,
    following:['@Ghost1','ghost1','GHOST2','ysrrioo','friend'],followers:['Friend']});
  assert.deepEqual(p.candidates,['ghost1','ghost2']);});
await test('No non-followers in the export means nothing to check and no run',()=>{
  const p=api.fcEcDeriveCandidates({account:me,authorized:true,complete:true,following:['a','b'],followers:['a','b','c']});
  assert.deepEqual(api.fcEcNextStep(p,{}),{ok:true,action:'NOTHING_TO_CHECK',checkedCount:0});});
const plan=api.fcEcDeriveCandidates(exportData());
await test('First step prepares exactly the first ten export results; nothing is executed',()=>{
  const s=api.fcEcNextStep(plan,{});
  assert.deepEqual([s.action,s.executed,s.offset],['CHECK_BATCH',false,0]);
  assert.deepEqual(s.batch.requested,ghosts.slice(0,10));
  assert.deepEqual(s.batch.runOptions,{maxTotalChargeUsd:0.05,restartOnError:false,timeout:120});});
await test('Agreement of export and live check stops with the first such account',()=>{
  const checked={...mark(ghosts.slice(0,10),'UNKNOWN'),ghost4:'UNVERIFIED_NEGATIVE'};
  const s=api.fcEcNextStep(plan,{checked});
  assert.equal(s.action,'STOP_CONFIRMED');
  assert.deepEqual(s.hit,{username:'ghost4',status:'CONFIRMED_NONFOLLOWER',
    profileUrl:'https://www.instagram.com/ghost4/',meaning:'EXPORT_AND_LIVE_CHECK_AGREE'});});
await test('Continue on request: next ten, never re-sending an already checked account',()=>{
  const checked=mark(ghosts.slice(0,10),'UNVERIFIED_NEGATIVE');
  const s=api.fcEcNextStep(plan,{checked,shown:ghosts.slice(0,10)});
  assert.equal(s.action,'CHECK_BATCH');assert.deepEqual(s.batch.requested,ghosts.slice(10,20));
  const partly={...checked,...mark(ghosts.slice(10,14),'MUTUAL')};
  const r=api.fcEcNextStep(plan,{checked:partly,shown:ghosts.slice(0,10)});
  assert.deepEqual(r.batch.requested,ghosts.slice(14,20));});
await test('The export sample is not capped at 20: third group of three is planned',()=>{
  const checked=mark(ghosts.slice(0,20),'MUTUAL');
  const s=api.fcEcNextStep(plan,{checked});
  assert.deepEqual(s.batch.requested,ghosts.slice(20,23));});
await test('Missing, erroneous and contradictory answers are all labelled unconfirmed',()=>{
  const checked={ghost0:'UNVERIFIED_NEGATIVE',ghost1:'MUTUAL',ghost2:'UNKNOWN',ghost3:undefined,ghost5:'SOMETHING_ELSE'};
  const r=api.fcEcReport(plan,{checked});
  const by=Object.fromEntries(r.rows.map(x=>[x.username,x]));
  assert.deepEqual([by.ghost0.liveCheck,by.ghost0.label],['AGREES','EXPORT_AND_LIVE_CHECK_AGREE']);
  assert.deepEqual([by.ghost1.liveCheck,by.ghost1.label],['CONFLICT_FOLLOW_BACK_REPORTED','UNCONFIRMED']);
  for(const u of ['ghost2','ghost3','ghost5'])assert.deepEqual([by[u].liveCheck,by[u].label],['NO_USABLE_ANSWER','UNCONFIRMED']);
  assert.deepEqual([by.ghost9.liveCheck,by.ghost9.label],['NOT_CHECKED','EXPORT_ONLY']);
  assert.deepEqual(r.summary,{exportOnly:18,agree:1,unconfirmed:4});
  assert.ok(r.rows.every(x=>x.exportStatus==='NONFOLLOWER_AT_EXPORT'));
  assert.equal(r.asOf,'EXPORT_TIME');});
await test('A lone negative checker answer never becomes a hit without the export evidence',()=>{
  const weak={...plan,evidence:{authorized:true,complete:false,followers:plan.evidence.followers}};
  const checked=mark(ghosts,'UNVERIFIED_NEGATIVE');
  const s=api.fcEcNextStep(weak,{checked});
  assert.equal(s.action,'ALL_CHECKED');
  assert.deepEqual(s.report.summary,{exportOnly:0,agree:0,unconfirmed:23});
  const none={...plan,evidence:null};
  assert.equal(api.fcEcNextStep(none,{checked}).report.summary.agree,0);});
await test('No output ever claims certainty about the current state',()=>{
  const text=JSON.stringify([api.fcEcNextStep(plan,{checked:mark(ghosts,'UNVERIFIED_NEGATIVE'),shown:ghosts}),api.fcEcReport(plan,{})]);
  assert.ok(!/CURRENT|LIVE_CONFIRMED|GUARANTEED|DEFINITE/i.test(text.replace(/current state/g,'')),text.slice(0,200));
  assert.match(api.fcEcReport(plan,{}).disclaimer,/not proof of the current state/);});
await test('All checked: full report, every export result accounted for exactly once',()=>{
  const checked={...mark(ghosts,'UNVERIFIED_NEGATIVE'),ghost7:'MUTUAL',ghost22:'UNKNOWN'};
  const s=api.fcEcNextStep(plan,{checked,shown:ghosts});
  assert.deepEqual([s.action,s.checkedCount],['ALL_CHECKED',23]);
  assert.equal(s.report.rows.length,23);
  assert.deepEqual(s.report.summary,{exportOnly:0,agree:21,unconfirmed:2});});
await test('Checker rows reviewed by the existing V2 logic flow into the export report',()=>{
  const step=api.fcEcNextStep(plan,{});
  const rows=step.batch.requested.map((u,i)=>({account:me,username:u,follows:i===0?true:i===1?null:false}));
  rows.push({type:'SUMMARY'});
  const review=api.fcV2ReviewChecks(step.batch,rows);
  const checked=Object.fromEntries(review.results.map(r=>[r.username,r.status]));
  assert.deepEqual(api.fcEcReport(plan,{checked}).summary,{exportOnly:13,agree:8,unconfirmed:2});
  const foreign=api.fcV2ReviewChecks(step.batch,[{account:me,username:'intruder',follows:false}]);
  assert.equal(foreign.ok,false);});
await test('Tampered plans are rejected',()=>{
  assert.equal(api.fcEcNextStep({...plan,source:'APIFY'},{}).action,'STOP_ERROR');
  assert.equal(api.fcEcNextStep({...plan,candidates:[...ghosts,'ghost0']},{}).action,'STOP_ERROR');
  assert.equal(api.fcEcNextStep({...plan,candidates:['Bad Name']},{}).action,'STOP_ERROR');
  assert.equal(api.fcEcNextStep(null,{}).action,'STOP_ERROR');});
await test('Dry-run batch: pilot account only, 1 to 10 clean unique names, stable run key',async()=>{
  const ok=await api.fcEcDryRunBatch('@Ysrrioo',['ghost1','@GHOST2']);
  assert.deepEqual([ok.ok,ok.executed],[true,false]);assert.deepEqual(ok.requested,['ghost1','ghost2']);
  assert.equal(ok.runKey,(await api.fcEcDryRunBatch(me,['ghost2','ghost1'])).runKey);
  assert.match(ok.runKey,/^[0-9a-f]{64}$/);
  assert.equal((await api.fcEcDryRunBatch('someoneelse',['a'])).reason,'pilot_account_not_authorized');
  assert.equal((await api.fcEcDryRunBatch(me,[])).reason,'batch_must_have_1_to_10_names');
  assert.equal((await api.fcEcDryRunBatch(me,ghosts.slice(0,11))).reason,'batch_must_have_1_to_10_names');
  assert.equal((await api.fcEcDryRunBatch(me,['a','A'])).reason,'invalid_or_duplicate_names');
  assert.equal((await api.fcEcDryRunBatch(me,['a',me])).reason,'invalid_or_duplicate_names');
  assert.equal((await api.fcEcDryRunBatch(me,['bad name'])).reason,'invalid_or_duplicate_names');
  assert.equal((await api.fcEcDryRunBatch(me,'ghost1')).reason,'batch_must_have_1_to_10_names');});
await test('Same export batch can be reserved only once in the ledger (no double billing)',async()=>{
  const raw=new DatabaseSync(':memory:');raw.exec(sql);
  const cutArgs=(q,a)=>a.slice(0,Math.max(0,...[...q.matchAll(/\?(\d+)/g)].map(m=>+m[1])));
  const stmt=(q,a=[])=>({bind:(...b)=>stmt(q,b),run:async()=>({meta:{changes:Number(raw.prepare(q).run(...cutArgs(q,a)).changes)}}),
    first:async()=>raw.prepare(q).get(...cutArgs(q,a))??null});
  const db={prepare:q=>stmt(q)};
  const a=await api.fcEcDryRunBatch(me,ghosts.slice(0,10)),b=await api.fcEcDryRunBatch(me,[...ghosts.slice(0,10)].reverse());
  assert.equal((await api.fcV2Reserve(db,a.runKey,'checker')).mayStart,true);
  assert.equal((await api.fcV2Reserve(db,b.runKey,'checker')).reason,'duplicate_run');});

// Endpoint, in-process against the freshly built bundle.
execFileSync(process.execPath,[dir+'build-instagram-worker.mjs'],{stdio:'pipe'});
const built=(await import(pathToFileURL(dir+'dist/worker.mjs').href+'?v='+Date.now())).default;
const origin='https://followclean-mvp-preview.example';
const post=(body,headers={})=>built.fetch(new Request(origin+'/api/analysis/provider/export-check/plan',
  {method:'POST',headers:{origin,'content-type':'application/json',...headers},body:typeof body==='string'?body:JSON.stringify(body)}),{},{waitUntil(){}});
await test('Endpoint: dry run answers with a plan, starts nothing, reports unverified prerequisites',async()=>{
  const res=await post({account:me,usernames:ghosts.slice(0,10)});
  assert.equal(res.status,200);const j=await res.json();
  assert.deepEqual([j.mode,j.executionEnabled,j.actorRunsStarted,j.batch.executed],['DRY_RUN_ONLY',false,0,false]);
  assert.deepEqual([j.permissionStatus,j.pricingStatus],['NOT_VERIFIED','NOT_VERIFIED']);
  assert.deepEqual(j.batch.requested,ghosts.slice(0,10));
  assert.deepEqual([j.ledger.ok,j.ledger.reason,j.ledger.startableRuns],[false,'ledger_unavailable',0]);});
await test('Endpoint: foreign origin, wrong type, oversized, malformed and unauthorised are refused',async()=>{
  assert.equal((await post({account:me,usernames:['a']},{origin:'https://evil.example'})).status,403);
  assert.equal((await post({account:me,usernames:['a']},{'content-type':'text/plain'})).status,415);
  assert.equal((await post(JSON.stringify({account:me,usernames:['a'],pad:'x'.repeat(1100)}))).status,413);
  assert.equal((await post('{not json')).status,400);
  assert.equal((await post({account:'other',usernames:['a']})).status,403);
  assert.equal((await post({account:me,usernames:ghosts.slice(0,11)})).status,403);
  const get=await built.fetch(new Request(origin+'/api/analysis/provider/export-check/plan'),{},{waitUntil(){}});
  assert.notEqual(get.status,200);});
await test('Paid execution remains disabled',async()=>{
  const res=await built.fetch(new Request(origin+'/api/analysis/start',{method:'POST',headers:{origin,'content-type':'application/json'},body:'{"username":"ysrrioo"}'}),{},{waitUntil(){}});
  assert.equal(res.status,503);assert.equal((await res.json()).error,'paid_provider_not_enabled');});
console.log(failed?failed+' FAILED':'FollowClean Export + Checker V1: '+count+' synthetic checks passed');
