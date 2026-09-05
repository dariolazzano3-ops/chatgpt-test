import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createOperatorRuntime } from '../src/operator-runtime-v1.js';
import { createMemoryOperatorRuntimeStore } from '../src/operator-runtime-store-v1.js';
import { createOperatorRuntimeApiService } from '../src/operator-runtime-api-v1.js';
import { withProjectSourceIntakeRuntimeService } from '../src/operator-project-source-intake-runtime-v1.js';
import { handleOperatorDashboard } from '../src/operator-dashboard-human-input-closure-v1.js';

const operatorId='operator:entity-aware-browser@example.test';
const project={
  customer_id:'gelato-donatello',
  project_id:'gelato-donatello-website-v1',
  scope_key:'gelato-donatello:gelato-donatello-website-v1',
  name:'Gelato Donatello',industry:'gelateria',country:'DE',language:'de',
  state:'ACTIVE',blocked:false,production_deploy:false
};
const created=createOperatorRuntime({operator_id:operatorId,portfolio:{operator_id:operatorId,projects:[project],production_deploy:false}});
assert.equal(created.ok,true);
const store=createMemoryOperatorRuntimeStore([created.runtime]);
const core=createOperatorRuntimeApiService({operator_id:operatorId,store});
const service=withProjectSourceIntakeRuntimeService({service:core,store,operator_id:operatorId});
const authorize=async()=>({ok:true,status:200,operator_id:operatorId,email:'entity-aware-browser@example.test'});
const options={runtime_service:service,authorize};

const shellResponse=await handleOperatorDashboard(new Request('https://operator.example.test/operator'),{}, {},options);
assert.equal(shellResponse.status,200);
const fullHtml=await shellResponse.text();
function extractTag(id,tag){
  const pattern=new RegExp('<'+tag+'[^>]*id="'+id+'"[^>]*>[\\s\\S]*?<\\/'+tag+'>');
  const match=fullHtml.match(pattern);
  assert.ok(match,'missing generated '+tag+'#'+id);
  return match[0];
}
const storageStyle=extractTag('aurentara-project-source-storage-v1-style','style');
const storageScript=extractTag('aurentara-project-source-storage-v1-ui','script');
const closureStyle=extractTag('aurentara-dashboard-human-input-closure-v1-style','style');
const closureScript=extractTag('aurentara-dashboard-human-input-closure-v1-ui','script');

const payloadResponse=await handleOperatorDashboard(new Request('https://operator.example.test/operator/api/project-source-intake?scope_key='+encodeURIComponent(project.scope_key)),{}, {},options);
assert.equal(payloadResponse.status,200);
const payload=await payloadResponse.json();
assert.equal(payload.human_input_closure.open_input_count,7);
assert.ok(payload.human_input_closure.open_inputs.some((q)=>q.multi_source_verification?.research_state));

const pageHtml=`<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>:root{--line:#ddd;--soft:#f4f4f2;--muted:#666}.card{padding:16px;border:1px solid #ddd;border-radius:14px}.btn{min-height:40px}.field{display:grid;gap:6px}.badge{display:inline-flex;padding:4px 8px;border-radius:999px}.attention{background:#fff4d9}.ready{background:#eaf8ee}.main{max-width:1100px;margin:auto;padding:12px}.source-tools{display:flex;gap:8px;flex-wrap:wrap}select,input,textarea{font:inherit;max-width:100%;box-sizing:border-box}</style>
${storageStyle}${closureStyle}</head><body><main class="main"><section id="project-detail"></section></main>
<script>
window.esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
window.setError=e=>{window.__error=String(e?.message||e||'')};
window.renderProjectDetail=function(){};
window.open=()=>null;
</script>
${storageScript}${closureScript}
<script>window.renderProjectDetail({project:{scope_key:${JSON.stringify(project.scope_key)}}});</script></body></html>`;

async function runViewport(name,viewport){
  const browser=await chromium.launch({headless:true,channel:'chrome'});
  const context=await browser.newContext({viewport});
  await context.route('https://entity-aware.test/operator',route=>route.fulfill({status:200,contentType:'text/html; charset=utf-8',body:pageHtml}));
  await context.route('https://entity-aware.test/operator/api/project-source-intake**',route=>route.fulfill({status:200,contentType:'application/json; charset=utf-8',body:JSON.stringify(payload)}));
  const page=await context.newPage();
  const pageErrors=[];
  page.on('pageerror',error=>pageErrors.push(String(error)));
  await page.goto('https://entity-aware.test/operator',{waitUntil:'domcontentloaded'});
  await page.waitForSelector('[data-human-input-closure]');
  const root=page.locator('[data-human-input-closure]');
  assert.match(await root.innerText(),/OPEN INPUTS: 7/);
  assert.match(await root.innerText(),/Multi-Source Evidence:/);
  assert.ok((await root.locator('.human-research-evidence').count())>=1);
  assert.ok((await root.locator('.human-research-source').count())>=1);
  assert.match(await root.locator('[data-human-question="TARGET_CUSTOMERS"]').innerText(),/HUMAN_ONLY/);
  assert.match(await root.locator('[data-human-question="PRIMARY_CONVERSION"]').innerText(),/HUMAN_ONLY/);
  assert.match(await root.locator('[data-human-question="FINAL_ASSET_QUALITY_APPROVAL"]').innerText(),/HUMAN_ONLY/);
  assert.match(await root.locator('[data-human-question="FINAL_HUMAN_QUALITY_APPROVAL"]').innerText(),/HUMAN_ONLY/);
  const dimensions=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,inner:window.innerWidth}));
  assert.ok(dimensions.scroll<=dimensions.inner+1,name+' horizontal overflow '+JSON.stringify(dimensions));
  assert.deepEqual(pageErrors,[]);
  assert.equal(await page.locator('[data-human-save]').count(),7);
  await browser.close();
  return {name,evidence_visible:'PASS',human_only_visible:'PASS',open_inputs_unchanged:7,horizontal_overflow:'PASS'};
}
const desktop=await runViewport('desktop',{width:1440,height:1000});
const mobile=await runViewport('iphone',{width:390,height:844});
console.log(JSON.stringify({
  ok:true,
  suite:'project-ferrari-entity-aware-multi-source-browser-v1',
  browser_human_outcome:'PASS',
  desktop,mobile,
  real_gelato_decisions_mutated:false,
  production_deploy:false,
  public_launch:false,
  variable_cost_eur:0
},null,2));
