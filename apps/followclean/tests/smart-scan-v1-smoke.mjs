// FollowClean Smart Scan V1: standalone synthetic regression test.
// Usage: node apps/followclean/tests/smart-scan-v1-smoke.mjs
// No network requests, account passwords or payable Apify Actor runs.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const start=html.indexOf('/* FC_SMARTSCAN_CORE_V1_START */');
const end=html.indexOf('/* FC_SMARTSCAN_CORE_V1_END */');
assert.ok(start>=0&&end>start,'core markers exist');
const core=html.slice(start,end+'/* FC_SMARTSCAN_CORE_V1_END */'.length);
const normalizeUsername=value=>{
  if(typeof value!=='string')return null;
  const username=value.trim().replace(/^@/,'').toLowerCase();
  return /^[a-z0-9._]{1,30}$/.test(username)?username:null;
};
const {fcCreateSmartScan,fcScanNextTen}=new Function('normalizeUsername',core+
  '\nreturn {fcCreateSmartScan,fcScanNextTen};')(normalizeUsername);
const fixture=(followers,following)=>({followerNames:followers,followingNames:following,followers:followers.length,following:following.length});
const ten=Array.from({length:10},(_,i)=>'mutual'+i);
let passed=0;
function test(title,fn){
  try{fn();passed++;console.log('PASS',title)}
  catch(error){console.error('FAIL',title,error);process.exitCode=1}
}
test('API sample cannot masquerade as a full verified source',()=>{
  assert.equal(fcCreateSmartScan(fixture(ten,ten),'api_partial').ok,false);
});
test('a missing follower list cannot produce a false positive',()=>{
  const input={...fixture(ten,['mutual0','candidate']),followers:20};
  assert.equal(fcCreateSmartScan(input,'local_export').ok,false);
});
test('ten mutuals proceed to the next group',()=>{
  const scan=fcCreateSmartScan(fixture(ten,[...ten,'newcandidate']),'local_export');
  const first=fcScanNextTen(scan);
  assert.equal(first.found,null);
  assert.equal(first.checked,10);
  assert.equal(first.finished,false);
  const next=fcScanNextTen(scan);
  assert.equal(next.found,'newcandidate');
  assert.equal(next.checked,11);
  assert.equal(next.batch,2);
});
test('first nonfollower stops the scan early',()=>{
  const scan=fcCreateSmartScan(fixture(ten,['mutual0','first','mutual1','second']),'local_export');
  const first=fcScanNextTen(scan);
  assert.equal(first.found,'first');
  assert.equal(first.checked,2);
  assert.equal(scan.cursor,2);
});
test('next search resumes after the previous match',()=>{
  const scan=fcCreateSmartScan(fixture(ten,['mutual0','first','mutual1','second']),'local_export');
  fcScanNextTen(scan);
  const second=fcScanNextTen(scan);
  assert.equal(second.found,'second');
  assert.equal(second.checked,4);
});
test('already processed accounts are skipped',()=>{
  const scan=fcCreateSmartScan(fixture(ten,['mutual0','alreadydone','kept','candidate']),'local_export');
  const next=fcScanNextTen(scan,n=>['alreadydone','kept'].includes(n));
  assert.equal(next.found,'candidate');
  assert.equal(next.checked,4);
});
test('duplicate users are rejected',()=>{
  assert.equal(fcCreateSmartScan(fixture([],['user','user']),'local_export').ok,false);
});
test('invalid Instagram handles are rejected',()=>{
  assert.equal(fcCreateSmartScan(fixture(['mutual0'],['not a handle']),'local_export').ok,false);
});
test('no candidates returns finished without fabricated results',()=>{
  const scan=fcCreateSmartScan(fixture(ten,ten),'local_export');
  const step=fcScanNextTen(scan);
  assert.equal(step.finished,true);
  assert.equal(step.found,null);
  assert.equal(step.checked,10);
});
test('zero following returns no findings',()=>{
  const scan=fcCreateSmartScan(fixture([],[]),'local_export');
  assert.equal(fcScanNextTen(scan).finished,true);
});
test('ZIP-first and actor-paused declarations are present',()=>{
  assert.match(html,/id="fc-smartscan-v1"/);
  assert.match(html,/ausschließlich die bereits im Browser geprüften Exportlisten/);
  assert.match(html,/function analyzeFiles/);
  assert.match(html,/id="fc-username-first"/);
  assert.match(html,/buy\.stripe\.com\/test_/);
  assert.match(html,/noindex/);
});
console.log('FollowClean Smart Scan V1:',passed,'synthetic tests passed');
if(process.exitCode)process.exit(process.exitCode);
