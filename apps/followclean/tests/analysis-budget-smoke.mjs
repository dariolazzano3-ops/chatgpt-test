// FollowClean budget and release regression smoke: node apps/followclean/tests/analysis-budget-smoke.mjs
// Synthetic counts only. Never calls Apify or Instagram, starts no paid run.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import '../build-instagram-worker.mjs';
const code=await readFile(new URL('../dist/worker.mjs',import.meta.url),'utf8');
const {default: worker}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const base='https://followclean.example';
async function get(path){return worker.fetch(new Request(base+path),{})}
async function post(path,payload,origin=base){
  return worker.fetch(new Request(base+path,{method:'POST',
    headers:{Origin:origin,'Content-Type':'application/json'},
    body:JSON.stringify(payload)}),{});
}
let passed=0;
async function check(label,fn){
  try{await fn();passed++;console.log('PASS',label)}
  catch(err){console.error('FAIL',label,err);process.exitCode=1}
}
await check('policy exists without API credentials or payment activation',async()=>{
  const r=await get('/api/analysis/policy'),s=await r.json();
  assert.equal(r.status,200);
  assert.equal(s.policy.maxApiEurCents,25);
  assert.equal(s.policy.conservativeUsdCap,0.20);
  assert.equal(s.policy.executionEnabled,false);
  assert.equal(s.policy.manualReviewFollowersMax,5000);
});
await check('small account can be cost candidate only',async()=>{
  const r=await post('/api/analysis/quote',{followers:300,following:200}),d=await r.json();
  assert.equal(d.quote.status,'CANDIDATE');
  assert.equal(d.quote.eligible,true);
  assert.equal(d.estimateOnly,true);
  assert.equal(d.trustedCounts,false);
  assert.equal(d.executionEnabled,false);
});
await check('guard counts both lists, buffers prices and blocks over budget',async()=>{
  const d=await (await post('/api/analysis/quote',{followers:636,following:476})).json();
  assert.equal(d.quote.status,'OVER_BUDGET');
  assert.equal(d.quote.eligible,false);
  assert.equal(d.quote.estimatedUsd>0.20,true);
});
await check('large profile blocks before any paid request',async()=>{
  const d=await (await post('/api/analysis/quote',{followers:1000000,following:100})).json();
  assert.equal(d.quote.status,'LARGE_PROFILE');
  assert.equal(d.quote.estimatedUsd,null);
});
await check('too many following also blocks',async()=>{
  const d=await (await post('/api/analysis/quote',{followers:100,following:5001})).json();
  assert.equal(d.quote.status,'LARGE_PROFILE');
});
await check('negative, fractional and missing counts fail closed',async()=>{
  for(const data of [{followers:-1,following:100},{followers:1.5,following:100},{following:20}]){
    const d=await (await post('/api/analysis/quote',data)).json();
    assert.equal(d.quote.status,'COUNTS_REQUIRED');
    assert.equal(d.quote.eligible,false);
  }
});
await check('origin protection on public quote endpoint',async()=>{
  assert.equal((await post('/api/analysis/quote',{followers:100,following:100},'https://other.example')).status,403);
});
await check('paid execution never starts regardless of counts or credentials',async()=>{
  const r=await post('/api/analysis/start',{followers:1,following:1,force:true});
  const d=await r.json();
  assert.equal(r.status,503);
  assert.equal(d.error,'paid_provider_not_enabled');
});
await check('existing ZIP parser, sample result UI, sandbox and noindex remain',async()=>{
  const r=await get('/'),html=await r.text();
  assert.equal(r.status,200);
  assert.match(html,/function analyzeFiles/);
  assert.match(html,/id="fc-cost-guard"/);
  assert.match(html,/id="fc-insights-return-rate"/);
  assert.match(html,/buy\.stripe\.com\/test_/);
  assert.match(html,/noindex/);
  assert.equal(r.headers.get('x-followclean-release'),'followclean-v12-budget-protection');
});
console.log(passed+' budget regression checks passed');
if(process.exitCode)process.exit(process.exitCode);
