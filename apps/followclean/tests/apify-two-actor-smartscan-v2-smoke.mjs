// FollowClean Apify Smart Scan V2 dry-run contract tests.
// Usage: node apps/followclean/tests/apify-two-actor-smartscan-v2-smoke.mjs
// Strictly synthetic; NO paid Apify requests, no Instagram login, no cookies.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const worker=await readFile(new URL('../worker.instagram-template.mjs',import.meta.url),'utf8');
const a=worker.indexOf('/* FC_APIFY_SMARTSCAN_V2_START */');
const b=worker.indexOf('/* FC_APIFY_SMARTSCAN_V2_END */');
assert.ok(a>=0&&b>a,'Apify Smart Scan V2 contract present');
const code=worker.slice(a,b+'/* FC_APIFY_SMARTSCAN_V2_END */'.length);
const norm=value=>{
  if(typeof value!=='string')return null;
  const username=value.replace(/^@/,'').trim().toLowerCase();
  return /^[a-z0-9._]{1,30}$/.test(username)?username:null;
};
const {fcV2Plan,fcV2ReadFollowing,fcV2MakeCheckerBatch,fcV2ReviewChecks}=
  new Function('fcNormalizeUsername',code+'\nreturn {fcV2Plan,fcV2ReadFollowing,fcV2MakeCheckerBatch,fcV2ReviewChecks}')(norm);
const source='ysrrioo';
const rows=Array.from({length:20},(_,i)=>({
  sourceUsername:source,listType:'following',username:'friend'+i,
  id:String(3000+i),profileUrl:'https://www.instagram.com/friend'+i+'/'
}));
const checks=[];
function test(label,fn){try{fn();checks.push(label);console.log('PASS',label)}
  catch(e){console.error('FAIL',label,e);process.exitCode=1}}
test('Only owner pilot',()=>{
  assert.equal(fcV2Plan('wrong').ok,false);assert.equal(fcV2Plan(source).ok,true)});
test('New actor IDs',()=>{
  const p=fcV2Plan(source);
  assert.equal(p.following.actor,'LFWuGJErve4ycMo6l');
  assert.equal(p.checker.actor,'5DvofmvZ6Tzdo4b56')});
test('All billing options are capped and API disabled',()=>{
  const p=fcV2Plan(source);
  assert.equal(p.executed,false);
  assert.equal(p.billing.maxTotalUsd,0.20);
  assert.equal(p.billing.globalReservationRequired,true);
  assert.equal(p.following.runOptions.maxTotalChargeUsd,0.05);
  assert.equal(p.checker.runOptions.maxTotalChargeUsd,0.05)});
const following=fcV2ReadFollowing(source,rows);
test('20-entry pilot sample only, not full coverage',()=>{
  assert.equal(following.ok,true);
  assert.equal(following.candidates.length,20);
  assert.equal(following.coverage,'BOUNDED_SAMPLE')});
test('Wrong source is rejected',()=>{
  assert.equal(fcV2ReadFollowing(source,[{...rows[0],sourceUsername:'wrong'}]).ok,false)});
test('Wrong relationship direction is rejected',()=>{
  assert.equal(fcV2ReadFollowing(source,[{...rows[0],listType:'followers'}]).ok,false)});
test('Duplicate accounts rejected',()=>{
  assert.equal(fcV2ReadFollowing(source,[rows[0],rows[0]]).reason,'duplicate')});
test('Oversized list rejected',()=>{
  assert.equal(fcV2ReadFollowing(source,Array.from({length:30},(_,i)=>({...rows[0],username:'a'+i}))).ok,false)});
test('First checker batch is max 10',()=>{
  const b=fcV2MakeCheckerBatch(source,following,0);
  assert.equal(b.requested.length,10);assert.equal(b.executed,false);
  assert.equal(b.input.account,source)});
test('Second batch begins at 11th account',()=>{
  const b=fcV2MakeCheckerBatch(source,following,10);
  assert.equal(b.requested[0],'friend10');assert.equal(b.nextOffset,20)});
test('Unsafe offsets rejected',()=>{
  assert.equal(fcV2MakeCheckerBatch(source,following,1).ok,false);
  assert.equal(fcV2MakeCheckerBatch(source,following,20).ok,false)});
const batch=fcV2MakeCheckerBatch(source,following,0);
test('A single false is NOT a confirmed nonfollower',()=>{
  const d=fcV2ReviewChecks(batch,[{username:'friend0',account:source,follows:false}]);
  assert.equal(d.results[0].status,'UNVERIFIED_NEGATIVE');
  assert.deepEqual(d.confirmedNonfollowers,[])});
test('True mutual, unknown null',()=>{
  const d=fcV2ReviewChecks(batch,[
    {username:'friend0',account:source,follows:true},
    {username:'friend1',account:source,follows:null}]);
  assert.equal(d.results[0].status,'MUTUAL');
  assert.equal(d.results[1].status,'UNKNOWN')});
test('Errors always become unknown',()=>{
  const d=fcV2ReviewChecks(batch,[{username:'friend0',account:source,follows:false,error:'partial'}]);
  assert.equal(d.results[0].status,'UNKNOWN')});
test('Mismatch of target always unknown',()=>{
  const d=fcV2ReviewChecks(batch,[{username:'friend0',account:'other',follows:false}]);
  assert.equal(d.results[0].status,'UNKNOWN')});
test('Foreign rows and duplicate checks fail closed',()=>{
  assert.equal(fcV2ReviewChecks(batch,[{username:'notrequested',account:source,follows:false}]).ok,false);
  assert.equal(fcV2ReviewChecks(batch,[
    {username:'friend0',account:source,follows:false},
    {username:'friend0',account:source,follows:false}]).ok,false)});
test('No production actor start or paid endpoint enabled',()=>{
  assert.match(worker,/const FC_PROVIDER_EXECUTION_ENABLED = false;/);
  assert.match(worker,/error:'paid_provider_not_enabled'/);
  assert.match(worker,/mode:'DRY_RUN_ONLY'/)});
console.log('FollowClean Apify Smart Scan V2:',checks.length,'synthetic checks passed');
if(process.exitCode)process.exit(process.exitCode);
