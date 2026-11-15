// FollowClean preview release gate. Builds the worker bundle, runs static and in-process
// checks and prints a manifest with SHA-256 hashes that a reviewer can reproduce.
// Usage: node apps/followclean/tests/release-verify.mjs      (no network, no deployment)
// Exit code 0 = all gates passed. This script never deploys anything.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
const dir=fileURLToPath(new URL('..',import.meta.url));
execFileSync(process.execPath,[dir+'build-instagram-worker.mjs'],{stdio:'pipe'});
const html=await readFile(dir+'index.html','utf8');
const template=await readFile(dir+'worker.instagram-template.mjs','utf8');
const bundlePath=dir+'dist/worker.mjs';
const bundle=await readFile(bundlePath,'utf8');
const sha=t=>createHash('sha256').update(t).digest('hex');
let failed=0;const gates=[];
async function gate(label,fn){try{await fn();gates.push({gate:label,ok:true});console.log('PASS',label);}
  catch(e){failed++;gates.push({gate:label,ok:false,error:e.message});console.error('FAIL',label,e.message);process.exitCode=1;}}

await gate('Bundle is syntactically valid and fully embeds the page',()=>{
  execFileSync(process.execPath,['--check',bundlePath],{stdio:'pipe'});
  assert.ok(!bundle.includes('= __FOLLOWCLEAN_HTML__;'),'placeholder left in bundle');
  assert.ok(bundle.includes('fc-why-live')&&bundle.includes('visit-confirm'),'current UI missing from bundle');});
await gate('Paid provider execution is hard-disabled',()=>{
  assert.ok(bundle.includes('const FC_PROVIDER_EXECUTION_ENABLED = false;'));
  assert.ok(bundle.includes("error:'paid_provider_not_enabled'"));});
await gate('Worker performs no Apify network request',()=>{
  const calls=template.split('\n').filter(l=>/await fetch\s*\(/.test(l));
  assert.equal(calls.length,3,'unexpected number of fetch calls: '+calls.length);
  assert.ok(calls.every(l=>!/apify/i.test(l)));});
await gate('No secrets or live payment identifiers in page or bundle',()=>{
  for(const [name,re] of [['Apify token',/apify_api_[A-Za-z0-9]{20,}/],['Stripe live key',/\b[sp]k_live_[A-Za-z0-9]+/],
    ['Stripe secret test key',/\bsk_test_[A-Za-z0-9]+/],['private key',/-----BEGIN [A-Z ]*PRIVATE KEY-----/]])
    assert.ok(!re.test(bundle),name+' found');
  const stripe=[...html.matchAll(/https:\/\/buy\.stripe\.com\/[^"'\s]+/g)].map(m=>m[0]);
  assert.ok(stripe.length>=1&&stripe.every(u=>u.startsWith('https://buy.stripe.com/test_')),'non-sandbox Stripe link: '+stripe.join(','));});
await gate('No embedded photos, no <img>, no third-party script, style, font or image',()=>{
  assert.ok(!html.includes('data:image/'),'embedded raster image');
  assert.ok(!/<img\b/i.test(html),'<img> element');
  assert.ok(!/<script[^>]+src=/i.test(html),'external script');
  assert.ok(!/<link[^>]+rel=["']?stylesheet/i.test(html),'external stylesheet');
  assert.ok(!/url\(\s*["']?(https?:)?\/\//i.test(html),'remote CSS url()');
  assert.ok(!/@import\s/i.test(html),'CSS @import');});
await gate('Export-check endpoint is a dry run that starts nothing',async()=>{
  const worker=(await import(pathToFileURL(bundlePath).href+'?e='+Date.now())).default;
  const origin='https://followclean-mvp-preview.example';
  const res=await worker.fetch(new Request(origin+'/api/analysis/provider/export-check/plan',{method:'POST',
    headers:{origin,'content-type':'application/json'},body:JSON.stringify({account:'ysrrioo',usernames:['synthetic.one']})}),{},{waitUntil(){}});
  assert.equal(res.status,200);const j=await res.json();
  assert.deepEqual([j.mode,j.executionEnabled,j.actorRunsStarted,j.batch.executed],['DRY_RUN_ONLY',false,0,false]);});
await gate('Preview stays out of search indexes',()=>{
  assert.match(html,/<meta name="robots" content="[^"]*noindex/i);});
await gate('A profile visit can never set the done state on its own',()=>{
  const a=html.indexOf('function completeVisitOnReturn');const b=html.indexOf('function showReturnPrompt');
  assert.ok(a>0&&b>a);const body=html.slice(a,b);
  assert.ok(!/setStatus\s*\(/.test(body),'completeVisitOnReturn calls setStatus');
  assert.ok(!/automatisch (als )?(erledigt|abgehakt)/i.test(html),'stale auto-done wording');});
await gate('Built worker answers in-process: page 200, paid start 503, dry-run executes nothing',async()=>{
  const worker=(await import(pathToFileURL(bundlePath).href+'?v='+Date.now())).default;
  const env={},ctx={waitUntil(){},passThroughOnException(){}};
  const origin='https://followclean-mvp-preview.example';
  const page=await worker.fetch(new Request(origin+'/'),env,ctx);
  assert.equal(page.status,200);assert.match(page.headers.get('content-type')||'',/text\/html/);
  assert.equal(sha(await page.text()),sha(html),'served page differs from index.html');
  const start=await worker.fetch(new Request(origin+'/api/analysis/start',{method:'POST',headers:{origin,'content-type':'application/json'},body:'{"username":"ysrrioo"}'}),env,ctx);
  assert.equal(start.status,503);
  assert.equal((await start.json()).error,'paid_provider_not_enabled');
  const status=await worker.fetch(new Request(origin+'/api/analysis/provider/status'),env,ctx);
  assert.equal(status.status,200);
  const s=await status.json();assert.equal(s.executionEnabled??s.execution?.enabled??false,false);});

const manifest={product:'FollowClean',target:'Cloudflare Worker followclean-mvp-preview (existing preview only)',
  deployed:false,node:process.version,
  sha256:{'index.html':sha(html),'worker.instagram-template.mjs':sha(template),'dist/worker.mjs':sha(bundle)},
  bytes:{'index.html':Buffer.byteLength(html),'dist/worker.mjs':Buffer.byteLength(bundle)},
  gates,result:failed?'BLOCKED':'GATES_PASSED'};
console.log('\nRELEASE MANIFEST\n'+JSON.stringify(manifest,null,2));
