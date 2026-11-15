// FollowClean Smart Scan V2: UPDATE protection, cost monotonicity, state graph and
// real multi-connection concurrency for the budget ledger.
// Usage: node apps/followclean/tests/apify-v2-ledger-hardening-smoke.mjs  (Node >= 22.5)
// Strictly synthetic: NO Apify requests, no costs. Runs the real migration SQL on SQLite.
// LIMIT: this is SQLite with separate OS processes, not Cloudflare D1. It proves the
// trigger logic under real write contention; it does not prove D1 platform behaviour.
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {DatabaseSync} from 'node:sqlite';
import {spawn} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const worker=await readFile(new URL('../worker.instagram-template.mjs',import.meta.url),'utf8');
const sql=await readFile(new URL('../sql/fc_apify_budget_v2_pilot.sql',import.meta.url),'utf8');
const i=worker.indexOf('/* FC_APIFY_V2_LEDGER_START */'),j=worker.indexOf('/* FC_APIFY_V2_LEDGER_END */');
assert.ok(i>=0&&j>i);
const norm=v=>{if(typeof v!=='string')return null;const u=v.replace(/^@/,'').trim().toLowerCase();
  return /^[a-z0-9._]{1,30}$/.test(u)?u:null;};
const api=new Function('fcNormalizeUsername','FC_V2_BATCH','FC_V2_FREE_FOLLOWING_CAP','FC_V2_ACTORS','fcV2MakeCheckerBatch',
  worker.slice(i,j)+'\nreturn {fcV2RunKey,fcV2Reserve,fcV2Advance,fcV2BudgetStatus,fcV2RecordLateCost}')(norm,10,20,{},()=>({}));
function d1(){
  const raw=new DatabaseSync(':memory:');raw.exec(sql);
  const cut=(q,a)=>a.slice(0,Math.max(0,...[...q.matchAll(/\?(\d+)/g)].map(m=>+m[1])));
  const stmt=(q,a=[])=>({bind:(...b)=>stmt(q,b),
    run:async()=>({meta:{changes:Number(raw.prepare(q).run(...cut(q,a)).changes)}}),
    first:async()=>raw.prepare(q).get(...cut(q,a))??null});
  return {prepare:q=>stmt(q),raw};
}
const S='pilot-ysrrioo-v1',me='ysrrioo';
const key=n=>api.fcV2RunKey(S,'checker',me,[n]);
const row=(db,k)=>db.raw.prepare('SELECT state,actual_usd_micros AS a,provider_run_id AS r FROM fc_apify_v2_runs WHERE run_key=?').get(k);
let failed=0,count=0;
async function test(label,fn){count++;try{await fn();console.log('PASS',label);}
  catch(e){failed++;console.error('FAIL',label,e);process.exitCode=1;}}
async function submitted(db,name,run='runA'){const k=await key(name);
  await api.fcV2Reserve(db,k,'checker');await api.fcV2Advance(db,k,'submitted',{providerRunId:run});return k;}

await test('State graph: reserved cannot jump to settled; settle needs a reported cost',async()=>{
  const db=d1(),k=await key('a');await api.fcV2Reserve(db,k,'checker');
  assert.equal((await api.fcV2Advance(db,k,'settled',{actualUsd:0.01})).ok,false);
  assert.equal(row(db,k).state,'reserved');
  assert.equal((await api.fcV2Advance(db,k,'submitted')).reason,'submit_requires_run_id');
  assert.equal((await api.fcV2Advance(db,k,'submitted',{providerRunId:'runA'})).ok,true);
  assert.equal((await api.fcV2Advance(db,k,'settled')).reason,'settle_requires_cost');
  assert.equal((await api.fcV2Advance(db,k,'settled',{actualUsd:0.012})).ok,true);
  assert.deepEqual({...row(db,k)},{state:'settled',a:12000,r:'runA'});});
await test('Terminal states are final in both directions',async()=>{
  const db=d1(),k=await submitted(db,'a');await api.fcV2Advance(db,k,'failed');
  for(const s of ['submitted','settled','failed'])
    assert.equal((await api.fcV2Advance(db,k,s,{actualUsd:0.01,providerRunId:'runA'})).ok,false);
  assert.equal(row(db,k).state,'failed');});
await test('Reported cost never decreases, even when polls arrive out of order',async()=>{
  const db=d1(),k=await submitted(db,'a');
  await api.fcV2Advance(db,k,'submitted',{actualUsd:0.03,providerRunId:'runA'});
  await api.fcV2Advance(db,k,'submitted',{actualUsd:0.01,providerRunId:'runA'});
  assert.equal(row(db,k).a,30000);
  await api.fcV2Advance(db,k,'settled',{actualUsd:0.02});
  assert.equal(row(db,k).a,30000);});
await test('Raw SQL cannot lower cost, clear cost, rewind state or swap the run id',async()=>{
  const db=d1(),k=await submitted(db,'a');
  await api.fcV2Advance(db,k,'submitted',{actualUsd:0.03,providerRunId:'runA'});
  const bad=(q,re)=>assert.throws(()=>db.raw.exec(q),re,q);
  bad("UPDATE fc_apify_v2_runs SET actual_usd_micros=1 WHERE kind='checker'",/cost_regression/);
  bad("UPDATE fc_apify_v2_runs SET actual_usd_micros=NULL WHERE kind='checker'",/cost_regression/);
  bad("UPDATE fc_apify_v2_runs SET state='reserved' WHERE kind='checker'",/invalid_transition/);
  bad("UPDATE fc_apify_v2_runs SET provider_run_id='other' WHERE kind='checker'",/run_id_immutable/);
  bad("UPDATE fc_apify_v2_runs SET scope='elsewhere' WHERE kind='checker'",/immutable_field/);
  bad("UPDATE fc_apify_v2_runs SET cap_usd_micros=1 WHERE kind='checker'",/immutable_field/);
  bad("UPDATE fc_apify_v2_runs SET kind='legacy' WHERE kind='checker'",/immutable_field/);
  bad("UPDATE fc_apify_v2_runs SET updated_ts=0 WHERE kind='checker'",/clock_regression/);
  bad("UPDATE fc_apify_v2_runs SET actual_usd_micros=0 WHERE kind='legacy'",/cost_regression/);
  bad("UPDATE fc_apify_v2_runs SET actual_usd_micros=-5 WHERE kind='checker'",/CHECK|cost_regression/);});
await test('Rows can only be inserted as plain reservations',async()=>{
  const db=d1(),ins=(state,actual,run)=>()=>db.raw.exec("INSERT INTO fc_apify_v2_runs VALUES ('"+'e'.repeat(64)+"','"+S+"','checker',50000,"+actual+",'"+state+"',"+run+",1,1)");
  assert.throws(ins('settled','1','NULL'),/insert_must_be_reservation/);
  assert.throws(ins('reserved','1','NULL'),/insert_must_be_reservation/);
  assert.throws(ins('reserved','NULL',"'runX'"),/insert_must_be_reservation/);
  assert.throws(ins('failed','NULL','NULL'),/insert_must_be_reservation/);});
await test('Provider overrun is recorded truthfully and blocks every further run',async()=>{
  const db=d1(),k=await submitted(db,'a');
  assert.equal((await api.fcV2Advance(db,k,'settled',{actualUsd:0.31})).ok,true);
  const s=await api.fcV2BudgetStatus(db);
  assert.deepEqual([s.committedUsd,s.remainingUsd,s.startableRuns,s.overBudget],[0.36,0,0,true]);
  assert.equal((await api.fcV2Reserve(db,await key('b'),'checker')).reason,'total_budget_exceeded');});
await test('Within budget the status reports overBudget=false',async()=>{
  assert.equal((await api.fcV2BudgetStatus(d1())).overBudget,false);});
await test('A run from another scope cannot be advanced through the worker',async()=>{
  const db=d1();
  db.raw.exec("INSERT INTO fc_apify_v2_runs VALUES ('"+'d'.repeat(64)+"','other-scope','checker',50000,NULL,'reserved',NULL,1,1)");
  assert.equal((await api.fcV2Advance(db,'d'.repeat(64),'failed')).reason,'no_advanceable_run');
  assert.equal((await api.fcV2BudgetStatus(db)).committedUsd,0.05);});

await test('Failed run billed later: cost is recorded, state stays failed',async()=>{
  const db=d1(),k=await submitted(db,'a');await api.fcV2Advance(db,k,'failed');
  const r=await api.fcV2RecordLateCost(db,k,0.021);
  assert.deepEqual([r.ok,r.overBudget,r.startableRuns],[true,false,2]);
  assert.deepEqual({...row(db,k)},{state:'failed',a:21000,r:'runA'});
  assert.equal((await api.fcV2BudgetStatus(db)).committedUsd,0.10);});
await test('Late bill above the reserve shrinks the budget immediately and blocks new runs',async()=>{
  const db=d1(),k=await submitted(db,'a');await api.fcV2Advance(db,k,'failed');
  const r=await api.fcV2RecordLateCost(db,k,0.12);
  assert.deepEqual([r.ok,r.overBudget,r.remainingUsd,r.startableRuns],[true,false,0.03,0]);
  assert.equal((await api.fcV2Reserve(db,await key('b'),'checker')).reason,'total_budget_exceeded');
  const over=await api.fcV2RecordLateCost(db,k,0.4);
  assert.deepEqual([over.ok,over.overBudget,over.remainingUsd],[true,true,0]);});
await test('Late bill never lowers cost, never frees budget, never reopens the run',async()=>{
  const db=d1(),k=await submitted(db,'a');
  await api.fcV2Advance(db,k,'submitted',{actualUsd:0.04,providerRunId:'runA'});await api.fcV2Advance(db,k,'failed');
  assert.equal((await api.fcV2RecordLateCost(db,k,0.01)).ok,true);
  assert.equal(row(db,k).a,40000);
  assert.equal((await api.fcV2BudgetStatus(db)).committedUsd,0.10);
  for(const s of ['submitted','settled','failed'])
    assert.equal((await api.fcV2Advance(db,k,s,{actualUsd:0.01,providerRunId:'runA'})).ok,false);
  assert.equal((await api.fcV2Reserve(db,k,'checker')).reason,'duplicate_run');
  const bad=(q,re)=>assert.throws(()=>db.raw.exec(q),re,q);
  bad("UPDATE fc_apify_v2_runs SET state='submitted' WHERE kind='checker'",/terminal_state/);
  bad("UPDATE fc_apify_v2_runs SET state='settled' WHERE kind='checker'",/terminal_state/);
  bad("UPDATE fc_apify_v2_runs SET actual_usd_micros=NULL WHERE kind='checker'",/cost_regression|late_update_requires_cost/);
  bad("UPDATE fc_apify_v2_runs SET actual_usd_micros=39999 WHERE kind='checker'",/cost_regression/);
  bad("UPDATE fc_apify_v2_runs SET provider_run_id='other' WHERE kind='checker'",/run_id_immutable/);});
await test('Start timed out, run failed without id: late bill may add the run id once',async()=>{
  const db=d1(),k=await key('a');await api.fcV2Reserve(db,k,'checker');await api.fcV2Advance(db,k,'failed');
  assert.throws(()=>db.raw.exec("UPDATE fc_apify_v2_runs SET provider_run_id='runZ' WHERE kind='checker'"),/late_update_requires_cost/);
  assert.equal((await api.fcV2RecordLateCost(db,k,0.03,{providerRunId:'runZ'})).ok,true);
  assert.deepEqual({...row(db,k)},{state:'failed',a:30000,r:'runZ'});
  await api.fcV2RecordLateCost(db,k,0.035,{providerRunId:'other'});
  assert.deepEqual({...row(db,k)},{state:'failed',a:35000,r:'runZ'});});
await test('Late bill is refused for running, unknown, foreign-scope and invalid input',async()=>{
  const db=d1(),k=await submitted(db,'a');
  assert.equal((await api.fcV2RecordLateCost(db,k,0.01)).reason,'no_finished_run');
  assert.equal(row(db,k).a,null);
  assert.equal((await api.fcV2RecordLateCost(db,'f'.repeat(64),0.01)).reason,'no_finished_run');
  db.raw.exec("INSERT INTO fc_apify_v2_runs VALUES ('"+'c'.repeat(64)+"','other-scope','checker',50000,NULL,'reserved',NULL,1,1)");
  db.raw.exec("UPDATE fc_apify_v2_runs SET state='failed' WHERE scope='other-scope'");
  assert.equal((await api.fcV2RecordLateCost(db,'c'.repeat(64),0.01)).reason,'no_finished_run');
  for(const v of [-0.01,NaN,Infinity,'0.01',null,undefined])
    assert.equal((await api.fcV2RecordLateCost(db,k,v)).reason,'invalid_cost');
  assert.equal((await api.fcV2RecordLateCost(undefined,k,0.01)).ok,false);
  assert.equal((await api.fcV2RecordLateCost({prepare(){throw Error('down')}},k,0.01)).reason,'late_cost_rejected');});
await test('Settled run: finalised usage may rise after settlement',async()=>{
  const db=d1(),k=await submitted(db,'a');await api.fcV2Advance(db,k,'settled',{actualUsd:0.02});
  assert.equal((await api.fcV2RecordLateCost(db,k,0.026)).ok,true);
  assert.deepEqual({...row(db,k)},{state:'settled',a:26000,r:'runA'});});

// Real contention: separate OS processes, each with its own connection to one database file.
const child=`
const {DatabaseSync}=require('node:sqlite');
const [file,key,startAt]=process.argv.slice(1);
const db=new DatabaseSync(file);db.exec('PRAGMA busy_timeout=8000');
while(Date.now()<+startAt){}
try{const r=db.prepare("INSERT INTO fc_apify_v2_runs (run_key,scope,kind,cap_usd_micros,state,created_ts,updated_ts) VALUES (?,'pilot-ysrrioo-v1','checker',50000,'reserved',?,?) ON CONFLICT(run_key) DO NOTHING").run(key,Date.now(),Date.now());
  process.stdout.write(Number(r.changes)===1?'WON':'DUP');}
catch(e){process.stdout.write(/total_budget_exceeded/.test(e.message)?'BUDGET':'ERR:'+e.message);}`;
async function race(keys){
  const dir=await mkdtemp(join(tmpdir(),'fc-ledger-'));const file=join(dir,'ledger.db');
  try{
    const init=new DatabaseSync(file);init.exec('PRAGMA journal_mode=WAL');init.exec(sql);init.close();
    const startAt=Date.now()+700;
    const out=await Promise.all(keys.map(k=>new Promise((res,rej)=>{
      const p=spawn(process.execPath,['--no-warnings','-e',child,file,k,String(startAt)]);
      let o='';p.stdout.on('data',d=>o+=d);p.on('error',rej);p.on('close',()=>res(o));})));
    const check=new DatabaseSync(file);
    const total=check.prepare("SELECT SUM(MAX(cap_usd_micros,COALESCE(actual_usd_micros,0))) AS t, COUNT(*) AS n FROM fc_apify_v2_runs").get();
    check.close();return {out,total:Number(total.t),rows:Number(total.n)};
  }finally{await rm(dir,{recursive:true,force:true});}
}
for(let round=1;round<=3;round++)
  await test('Round '+round+': 12 processes race for 3 slots, total stays at 0.20 USD',async()=>{
    const r=await race(await Promise.all(Array.from({length:12},(_,n)=>key('p'+n))));
    assert.equal(r.out.filter(x=>x==='WON').length,3,r.out.join(','));
    assert.equal(r.out.filter(x=>x==='BUDGET').length,9,r.out.join(','));
    assert.deepEqual([r.total,r.rows],[200000,4]);});
await test('10 processes race on the SAME run key: exactly one reservation',async()=>{
  const k=await key('same');const r=await race(Array(10).fill(k));
  assert.equal(r.out.filter(x=>x==='WON').length,1,r.out.join(','));
  assert.equal(r.out.filter(x=>x==='DUP').length,9,r.out.join(','));
  assert.deepEqual([r.total,r.rows],[100000,2]);});
console.log(failed?failed+' FAILED':'FollowClean V2 ledger hardening: '+count+' checks passed');
