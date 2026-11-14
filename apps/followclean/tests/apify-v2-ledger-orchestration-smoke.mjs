// FollowClean Smart Scan V2: durable budget ledger + 10-batch orchestration tests.
// Usage: node apps/followclean/tests/apify-v2-ledger-orchestration-smoke.mjs  (Node >= 22.5)
// The real migration SQL runs against in-memory SQLite behind a minimal D1-shaped shim.
// Strictly synthetic: NO Apify requests, no Instagram access, no costs.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DatabaseSync} from 'node:sqlite';
const worker=await readFile(new URL('../worker.instagram-template.mjs',import.meta.url),'utf8');
const sql=await readFile(new URL('../sql/fc_apify_budget_v2_pilot.sql',import.meta.url),'utf8');
const cut=(a,b)=>{const i=worker.indexOf(a),j=worker.indexOf(b);assert.ok(i>=0&&j>i,a);return worker.slice(i,j+b.length);};
const code=cut('/* FC_APIFY_SMARTSCAN_V2_START */','/* FC_APIFY_SMARTSCAN_V2_END */')+'\n'+
  cut('/* FC_APIFY_V2_LEDGER_START */','/* FC_APIFY_V2_LEDGER_END */');
assert.ok(!/\bfetch\s*\(/.test(code),'V2 blocks contain no network call');
const norm=v=>{if(typeof v!=='string')return null;const u=v.replace(/^@/,'').trim().toLowerCase();
  return /^[a-z0-9._]{1,30}$/.test(u)?u:null;};
const api=new Function('fcNormalizeUsername',code+
  '\nreturn {fcV2ReadFollowing,fcV2ReviewChecks,fcV2RunKey,fcV2Reserve,fcV2Advance,fcV2BudgetStatus,fcV2Classify,fcV2NextStep}')(norm);
function d1(){
  const raw=new DatabaseSync(':memory:');raw.exec(sql);
  const stmt=(q,args=[])=>({
    bind:(...a)=>stmt(q,a),
    run:async()=>{const r=raw.prepare(q.replace(/\?\d+/g,m=>m)).run(...expand(q,args));return {meta:{changes:Number(r.changes)}};},
    first:async()=>raw.prepare(q).get(...expand(q,args))??null
  });
  // SQLite numbered parameters (?1 reused) need one value per distinct index.
  const expand=(q,args)=>{const max=Math.max(0,...[...q.matchAll(/\?(\d+)/g)].map(m=>+m[1]));return args.slice(0,max);};
  return {prepare:q=>stmt(q),raw};
}
const S='pilot-ysrrioo-v1',me='ysrrioo';
const names=Array.from({length:20},(_,i)=>'friend'+i);
const following=api.fcV2ReadFollowing(me,names.map(u=>({sourceUsername:me,listType:'following',username:u})));
let failed=0,count=0;
async function test(label,fn){count++;try{await fn();console.log('PASS',label);}
  catch(e){failed++;console.error('FAIL',label,e);process.exitCode=1;}}

await test('Legacy 0.05 USD reservation is pre-counted; 0.15 USD / 3 runs remain',async()=>{
  const s=await api.fcV2BudgetStatus(d1());
  assert.deepEqual([s.committedUsd,s.remainingUsd,s.startableRuns,s.providerReportedUsd],[0.05,0.15,3,0.032]);});
await test('Run key is deterministic, order-independent and input-validated',async()=>{
  const a=await api.fcV2RunKey(S,'checker',me,['b','a']),b=await api.fcV2RunKey(S,'checker','@YSRRIOO',['a','b']);
  assert.match(a,/^[0-9a-f]{64}$/);assert.equal(a,b);
  assert.notEqual(a,await api.fcV2RunKey(S,'checker',me,['a','c']));
  assert.equal(await api.fcV2RunKey(S,'checker',me,[]),null);
  assert.equal(await api.fcV2RunKey(S,'checker',me,names.slice(0,11)),null);
  assert.equal(await api.fcV2RunKey(S,'checker',me,['Bad Name']),null);
  assert.equal(await api.fcV2RunKey(S,'refund',me,['a']),null);});
await test('Same work reserved twice starts exactly once (idempotency)',async()=>{
  const db=d1(),k=await api.fcV2RunKey(S,'checker',me,names.slice(0,10));
  assert.equal((await api.fcV2Reserve(db,k,'checker')).mayStart,true);
  const again=await api.fcV2Reserve(db,k,'checker');
  assert.deepEqual([again.mayStart,again.reason,again.existingState],[false,'duplicate_run','reserved']);
  assert.equal((await api.fcV2BudgetStatus(db)).committedUsd,0.10);});
await test('Failed run is never retried and keeps its budget',async()=>{
  const db=d1(),k=await api.fcV2RunKey(S,'following',me,[]);
  await api.fcV2Reserve(db,k,'following');assert.equal((await api.fcV2Advance(db,k,'failed')).ok,true);
  const again=await api.fcV2Reserve(db,k,'following');
  assert.deepEqual([again.mayStart,again.existingState],[false,'failed']);
  assert.equal((await api.fcV2BudgetStatus(db)).remainingUsd,0.10);});
await test('Eight parallel jobs: exactly three fit, total never exceeds 0.20 USD',async()=>{
  const db=d1();
  const keys=await Promise.all(Array.from({length:8},(_,i)=>api.fcV2RunKey(S,'checker',me,['p'+i])));
  const out=await Promise.all(keys.map(k=>api.fcV2Reserve(db,k,'checker')));
  assert.equal(out.filter(r=>r.mayStart).length,3);
  assert.ok(out.filter(r=>!r.mayStart).every(r=>r.reason==='total_budget_exceeded'));
  const s=await api.fcV2BudgetStatus(db);assert.deepEqual([s.committedUsd,s.remainingUsd,s.startableRuns],[0.2,0,0]);});
await test('Settling below the cap releases nothing; overrun is counted in full',async()=>{
  const db=d1(),k1=await api.fcV2RunKey(S,'checker',me,['a']),k2=await api.fcV2RunKey(S,'checker',me,['b']);
  await api.fcV2Reserve(db,k1,'checker');await api.fcV2Advance(db,k1,'submitted',{providerRunId:'abcDEF123'});
  await api.fcV2Advance(db,k1,'settled',{actualUsd:0.011});
  assert.equal((await api.fcV2BudgetStatus(db)).committedUsd,0.10);
  await api.fcV2Reserve(db,k2,'checker');await api.fcV2Advance(db,k2,'submitted',{providerRunId:'run2'});
  await api.fcV2Advance(db,k2,'settled',{actualUsd:0.09});
  const s=await api.fcV2BudgetStatus(db);assert.equal(s.committedUsd,0.19);assert.equal(s.startableRuns,0);
  assert.equal((await api.fcV2Reserve(db,await api.fcV2RunKey(S,'checker',me,['c']),'checker')).reason,'total_budget_exceeded');});
await test('Ledger is append-only: no delete, no cap edit, no leaving a terminal state',async()=>{
  const db=d1(),k=await api.fcV2RunKey(S,'checker',me,['a']);
  await api.fcV2Reserve(db,k,'checker');await api.fcV2Advance(db,k,'submitted',{providerRunId:'run1'});
  assert.equal((await api.fcV2Advance(db,k,'settled',{actualUsd:0.01})).ok,true);
  assert.equal((await api.fcV2Advance(db,k,'submitted',{providerRunId:'run1'})).ok,false);
  assert.throws(()=>db.raw.exec("DELETE FROM fc_apify_v2_runs"),/append_only/);
  assert.throws(()=>db.raw.exec("UPDATE fc_apify_v2_runs SET cap_usd_micros=1"),/immutable|terminal/);
  assert.throws(()=>db.raw.exec("INSERT INTO fc_apify_v2_runs VALUES ('"+'f'.repeat(64)+"','x-scope','checker',60000,NULL,'reserved',NULL,1,1)"),/CHECK/);});
await test('Missing database, missing table and bad input all fail closed',async()=>{
  const k=await api.fcV2RunKey(S,'checker',me,['a']);
  assert.equal((await api.fcV2Reserve(undefined,k,'checker')).mayStart,false);
  assert.equal((await api.fcV2Reserve(d1(),'nope','checker')).mayStart,false);
  const broken={prepare(){throw Error('no such table')}};
  assert.deepEqual([(await api.fcV2Reserve(broken,k,'checker')).reason,(await api.fcV2BudgetStatus(broken)).startableRuns],['ledger_unavailable',0]);
  assert.equal((await api.fcV2Advance(d1(),k,'settled',{actualUsd:-1})).ok,false);
  assert.equal((await api.fcV2Advance(d1(),k,'settled',{actualUsd:0.01})).reason,'unknown_run');});

const full=(followers)=>({authorized:true,complete:true,followers:new Set(followers)});
await test('Classification: confirmed only with complete authorized evidence',()=>{
  const c=api.fcV2Classify;
  assert.equal(c('UNVERIFIED_NEGATIVE','x',null),'UNVERIFIED_NEGATIVE');
  assert.equal(c('UNVERIFIED_NEGATIVE','x',{authorized:true,complete:false,followers:new Set()}),'UNVERIFIED_NEGATIVE');
  assert.equal(c('UNVERIFIED_NEGATIVE','x',{authorized:false,complete:true,followers:new Set()}),'UNVERIFIED_NEGATIVE');
  assert.equal(c('UNVERIFIED_NEGATIVE','x',{authorized:true,complete:true,followers:[]}),'UNVERIFIED_NEGATIVE');
  assert.equal(c('UNVERIFIED_NEGATIVE','x',full([])),'CONFIRMED_NONFOLLOWER');
  assert.equal(c('UNVERIFIED_NEGATIVE','x',full(['x'])),'UNKNOWN');
  assert.equal(c('MUTUAL','x',null),'MUTUAL');assert.equal(c('MUTUAL','x',full([])),'UNKNOWN');
  assert.equal(c('UNKNOWN','x',full([])),'UNKNOWN');assert.equal(c(undefined,'x',full([])),'UNKNOWN');});
await test('First step checks the first ten; nothing is executed',()=>{
  const s=api.fcV2NextStep(me,following,{});
  assert.deepEqual([s.action,s.executed,s.batch.requested.length,s.offset],['CHECK_BATCH',false,10,0]);
  assert.deepEqual(s.batch.requested,names.slice(0,10));});
const mark=(list,status)=>Object.fromEntries(list.map(u=>[u,status]));
await test('Provider negatives without evidence never stop as a hit; next ten follow',()=>{
  const s=api.fcV2NextStep(me,following,{checked:mark(names.slice(0,10),'UNVERIFIED_NEGATIVE')});
  assert.equal(s.action,'CHECK_BATCH');assert.deepEqual(s.batch.requested,names.slice(10,20));});
await test('Confirmed hit stops before the second ten and carries the profile link',()=>{
  const checked={...mark(names.slice(0,10),'MUTUAL'),friend3:'UNVERIFIED_NEGATIVE'};
  const s=api.fcV2NextStep(me,following,{checked},full(names.filter(u=>u!=='friend3')));
  assert.equal(s.action,'STOP_CONFIRMED');
  assert.deepEqual(s.hit,{username:'friend3',status:'CONFIRMED_NONFOLLOWER',profileUrl:'https://www.instagram.com/friend3/'});});
await test('Continue resumes after the shown hit without re-billing checked accounts',()=>{
  const checked={...mark(names.slice(0,10),'MUTUAL'),friend3:'UNVERIFIED_NEGATIVE',friend7:'UNVERIFIED_NEGATIVE'};
  const ev=full(names.filter(u=>u!=='friend3'&&u!=='friend7'));
  const s1=api.fcV2NextStep(me,following,{checked,shown:['friend3']},ev);
  assert.equal(s1.hit.username,'friend7');
  const s2=api.fcV2NextStep(me,following,{checked,shown:['friend3','friend7']},ev);
  assert.equal(s2.action,'CHECK_BATCH');
  assert.ok(s2.batch.requested.every(u=>!Object.hasOwn(checked,u)));});
await test('Partly billed group resumes with only the open names',()=>{
  const s=api.fcV2NextStep(me,following,{checked:mark(names.slice(0,6),'MUTUAL')});
  assert.deepEqual(s.batch.requested,names.slice(6,10));});
await test('Sample ends after 20: no re-fetch of the first ten, honest tally',()=>{
  const checked={...mark(names,'MUTUAL'),friend1:'UNVERIFIED_NEGATIVE',friend2:'UNKNOWN'};
  const s=api.fcV2NextStep(me,following,{checked});
  assert.deepEqual([s.action,s.coverage,s.checkedCount],['SAMPLE_EXHAUSTED','BOUNDED_SAMPLE',20]);
  assert.deepEqual(s.tally,{CONFIRMED_NONFOLLOWER:0,MUTUAL:18,UNVERIFIED_NEGATIVE:1,UNKNOWN:1});});
await test('Untrusted or oversized following data stops with an error',()=>{
  assert.equal(api.fcV2NextStep(me,{ok:false},{}).action,'STOP_ERROR');
  assert.equal(api.fcV2NextStep('other',following,{}).action,'STOP_ERROR');
  assert.equal(api.fcV2NextStep(me,{...following,candidates:[...names,'x21']},{}).action,'STOP_ERROR');});
await test('Reviewed checker rows feed the orchestrator end to end',()=>{
  const step=api.fcV2NextStep(me,following,{});
  const rows=step.batch.requested.map((u,i)=>({account:me,username:u,follows:i===4?false:i===5?null:true}));
  const review=api.fcV2ReviewChecks(step.batch,rows);
  assert.deepEqual(review.confirmedNonfollowers,[]);
  const checked=Object.fromEntries(review.results.map(r=>[r.username,r.status]));
  assert.equal(api.fcV2NextStep(me,following,{checked}).action,'CHECK_BATCH');
  assert.equal(api.fcV2NextStep(me,following,{checked},full(names.filter(u=>u!=='friend4'))).hit.username,'friend4');});
await test('Paid execution is still hard-disabled in the worker',()=>{
  assert.ok(worker.includes('const FC_PROVIDER_EXECUTION_ENABLED = false;'));
  assert.ok(worker.includes("error:'paid_provider_not_enabled'"));
  // Only the three pre-existing Instagram OAuth/Graph requests may exist; none targets Apify.
  const calls=worker.split('\n').filter(l=>/await fetch\s*\(/.test(l));
  assert.equal(calls.length,3);assert.ok(calls.every(l=>!/apify/i.test(l)));
  assert.ok(!/fetch\s*\(\s*url\b/.test(worker),'described Apify request URL is never fetched');});
console.log(failed?failed+' FAILED':'FollowClean V2 ledger + orchestration: '+count+' synthetic checks passed');
