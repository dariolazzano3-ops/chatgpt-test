// FollowClean V13. Only synthetic fixtures. Does not contact Instagram or Apify.
// Run: node apps/followclean/tests/apify-adapter-smoke.mjs
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import '../build-instagram-worker.mjs';
const workerCode=await readFile(new URL('../dist/worker.mjs',import.meta.url),'utf8');
const template=await readFile(new URL('../worker.instagram-template.mjs',import.meta.url),'utf8');
// Expose pure validation helpers for test only; public Worker exports only fetch.
const isolated=template.replace('const FOLLOWCLEAN_HTML = __FOLLOWCLEAN_HTML__;',"const FOLLOWCLEAN_HTML='';")+
  '\nexport {buildApifyDryRun,buildApifyRequestDescription,validateApifyEvidence,estimateFollowCleanBudget};';
const {buildApifyDryRun,buildApifyRequestDescription,validateApifyEvidence,estimateFollowCleanBudget}=await import(
  'data:text/javascript;base64,'+Buffer.from(isolated).toString('base64')
);
const {default:worker}=await import('data:text/javascript;base64,'+Buffer.from(workerCode).toString('base64'));
const origin='https://followclean.example';
const request=(path,init={})=>worker.fetch(new Request(origin+path,init),{});
const plan=(username,originHeader=origin)=>request('/api/analysis/provider/plan',{
  method:'POST',headers:{Origin:originHeader,'Content-Type':'application/json'},
  body:JSON.stringify({username})
});
let passed=0;
async function test(label,fn){
  try{await fn();passed++;console.log('PASS',label)}
  catch(e){console.error('FAIL',label,e);process.exitCode=1}
}
await test('read-only provider status is safe and paid runs are always disabled',async()=>{
  const res=await request('/api/analysis/provider/status');
  const body=await res.json();
  assert.equal(res.status,200);
  assert.equal(body.provider,'Apify');
  assert.equal(body.executionEnabled,false);
  assert.equal(body.analysisAvailable,false);
  assert.equal(body.configured,false);
});
await test('username-first plan is a real same-origin Worker readiness request',async()=>{
  const res=await plan('@mathilda');
  const body=await res.json();
  assert.equal(res.status,200);
  assert.equal(body.username,'mathilda');
  assert.equal(body.executionEnabled,false);
  assert.equal(body.available,false);
});
await test('cross-origin and invalid usernames do not initiate work',async()=>{
  assert.equal((await plan('mathilda','https://other.example')).status,403);
  assert.equal((await plan('../bad')).status,400);
  assert.equal((await plan('a'.repeat(70))).status,400);
});
await test('large public payload rejected before deserialization',async()=>{
  const res=await request('/api/analysis/provider/plan',{method:'POST',
    headers:{Origin:origin,'Content-Type':'application/json'},
    body:JSON.stringify({username:'mathilda',padding:'x'.repeat(1024)})});
  assert.equal(res.status,413);
});
await test('price estimate protects the 0.20 USD provisional cap',async()=>{
  assert.equal(estimateFollowCleanBudget(35,35).status,'CANDIDATE');
  assert.equal(estimateFollowCleanBudget(300,200).status,'OVER_BUDGET');
  assert.equal(estimateFollowCleanBudget(1000000,1).status,'LARGE_PROFILE');
});
await test('publicly submitted counts never produce a payable plan',async()=>{
  assert.equal(buildApifyDryRun('mathilda',{followers:10,following:10}).ok,false);
});
await test('trusted synthetic plan bounded by maxTotalChargeUsd and no retries',async()=>{
  const p=buildApifyDryRun('mathilda',{followers:35,following:35,verifiedByServer:true});
  assert.equal(p.ok,true);
  assert.equal(p.executed,false);
  assert.equal(p.input.dataToScrape,'both');
  assert.equal(p.input.resultsLimit,35);
  assert.equal(p.runOptions.maxTotalChargeUsd,0.20);
  assert.equal(p.runOptions.maxItems,70);
  const request=buildApifyRequestDescription(p);
  assert.equal(request.ok,true);
  const u=new URL(request.url);
  assert.equal(u.searchParams.get('maxItems'),'70');
  assert.equal(u.searchParams.get('restartOnError'),'false');
  assert.equal(u.searchParams.get('maxTotalChargeUsd'),'0.2');
  assert.ok(!u.searchParams.has('token'));
  assert.equal(p.runOptions.restartOnError,false);
});
const rows=[
 {sourceUsername:'mathilda',relationshipType:'follower',userId:'1',username:'anya'},
 {sourceUsername:'mathilda',relationshipType:'follower',userId:'2',username:'bela'},
 {sourceUsername:'mathilda',relationshipType:'following',userId:'1',username:'anya'},
 {sourceUsername:'mathilda',relationshipType:'following',userId:'3',username:'cora'}
];
const coverage={
 status:'SUCCEEDED',billing:{confirmed:true},
 results:[
 {sourceUsername:'mathilda',relationshipType:'follower',coverageStatus:'COMPLETE',billingConfirmed:true,deliveredCount:2,hasNextPage:false},
 {sourceUsername:'mathilda',relationshipType:'following',coverageStatus:'COMPLETE',billingConfirmed:true,deliveredCount:2,hasNextPage:false}
]};
const counts={verifiedByServer:true,followers:2,following:2};
await test('free-tier 100-per-list limit forbids false complete results',async()=>{
  const p=buildApifyDryRun('mathilda',{followers:101,following:25,verifiedByServer:true});
  assert.equal(p.ok,false);
  assert.equal(p.error,'FREE_TIER_LIMIT');
});
await test('synthetic complete-coverage ID join produces one test-only candidate',async()=>{
  const r=validateApifyEvidence('mathilda',counts,rows,coverage);
  assert.equal(r.ok,true);
  assert.equal(r.nonfollower.username,'cora');
});
await test('partial coverage does NOT invent a nonfollower',async()=>{
  const summary={...coverage,results:[coverage.results[0],{...coverage.results[1],coverageStatus:'PARTIAL'}]};
  const r=validateApifyEvidence('mathilda',counts,rows,summary);
  assert.equal(r.ok,false);
});
await test('missing ID and mismatched source also fail closed',async()=>{
  assert.equal(validateApifyEvidence('mathilda',counts,[{...rows[0],userId:null},...rows.slice(1)],coverage).ok,false);
  assert.equal(validateApifyEvidence('mathilda',counts,[{...rows[0],sourceUsername:'other'},...rows.slice(1)],coverage).ok,false);
});
await test('private/missing results and client claimed totals cannot be trusted',async()=>{
  assert.equal(validateApifyEvidence('mathilda',{...counts,verifiedByServer:false},rows,coverage).ok,false);
  assert.equal(validateApifyEvidence('mathilda',counts,rows,{...coverage,status:'FAILED'}).ok,false);
});
await test('provider start remains disabled even when a username is supplied',async()=>{
  const res=await request('/api/analysis/start',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({username:'mathilda'})});
  assert.equal(res.status,503);
  assert.equal((await res.json()).error,'paid_provider_not_enabled');
});
await test('HTML preserves local ZIP, noindex, and Stripe sandbox',async()=>{
  const html=await (await request('/')).text();
  for(const phrase of ['function analyzeFiles(', 'id="fc-username-form"',
    'id="fc-cost-guard"','buy.stripe.com/test_','noindex']){
    assert.ok(html.includes(phrase),phrase);
  }
});
console.log('FollowClean Apify adapter:',passed,'synthetic checks passed');
if(process.exitCode)process.exit(process.exitCode);
