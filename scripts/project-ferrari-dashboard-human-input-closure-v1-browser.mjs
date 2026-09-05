import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createOperatorRuntime } from '../src/operator-runtime-v1.js';
import { createMemoryOperatorRuntimeStore } from '../src/operator-runtime-store-v1.js';
import { createOperatorRuntimeApiService } from '../src/operator-runtime-api-v1.js';
import { withProjectSourceIntakeRuntimeService } from '../src/operator-project-source-intake-runtime-v1.js';
import { handleOperatorDashboard } from '../src/operator-dashboard-human-input-closure-v1.js';
import gelatoClosure from '../projects/gelato-donatello-website-v1/auto-customer-input-closure-v1.json' with { type: 'json' };

const operatorId='operator:ferrari-human-browser@example.test';
const project={customer_id:'gelato-donatello',project_id:'gelato-donatello-website-v1',scope_key:'gelato-donatello:gelato-donatello-website-v1',name:'Gelato Donatello',industry:'gelateria',country:'DE',language:'de',state:'ACTIVE',blocked:false,production_deploy:false};
const created=createOperatorRuntime({operator_id:operatorId,portfolio:{operator_id:operatorId,projects:[project],production_deploy:false}});
assert.equal(created.ok,true);
const store=createMemoryOperatorRuntimeStore([created.runtime]);
const core=createOperatorRuntimeApiService({operator_id:operatorId,store});
const service=withProjectSourceIntakeRuntimeService({service:core,store,operator_id:operatorId});
const authorize=async()=>({ok:true,status:200,operator_id:operatorId,email:'ferrari-human-browser@example.test'});
const shell=await handleOperatorDashboard(new Request('https://operator.example.test/operator'),{}, {},{runtime_service:service,authorize});
assert.equal(shell.status,200);
const fullHtml=await shell.text();

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

const pageHtml=`<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>:root{--line:#ddd;--soft:#eee;--muted:#666}.card{padding:16px;border:1px solid #ddd;border-radius:14px}.btn{min-height:40px}.field{display:grid;gap:6px}.badge{display:inline-flex;padding:4px 8px;border-radius:999px}.attention{background:#fff4d9}.ready{background:#eaf8ee}.main{max-width:1100px;margin:auto;padding:12px}.source-tools{display:flex;gap:8px;flex-wrap:wrap}select,input,textarea{font:inherit;max-width:100%;box-sizing:border-box}</style>
${storageStyle}${closureStyle}</head><body><main class="main"><section id="project-detail"></section></main>
<script>
window.esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
window.setError=e=>{window.__humanError=String(e?.message||e||'')};
window.renderProjectDetail=function(){};
window.open=()=>null;
</script>
${storageScript}${closureScript}
<script>window.renderProjectDetail({project:{scope_key:${JSON.stringify(project.scope_key)}}});</script></body></html>`;

function payload(openQuestions,resolved=[]){
  return {
    identity:{operator_id:operatorId,customer_id:project.customer_id,project_id:project.project_id,scope_key:project.scope_key},
    workspace:{sections:{project_sources:[],project_knowledge:[],content_readiness:{status:'READY_WITH_WARNINGS'},open_inputs:openQuestions,resolved_inputs:resolved}},
    human_input_closure:{
      schema:'aurentara.project-human-input-closure-projection.v1',
      scope_key:project.scope_key,
      supported:true,
      open_input_count:openQuestions.length,
      open_inputs:openQuestions,
      resolved_input_count:resolved.length,
      resolved_inputs:resolved,
      readiness:{build_readiness:{ready_for_build:false,blockers:['REQUIRED_CUSTOMER_INPUTS_MISSING']}},
      ai_auto_confirmation:false,
      project_scoped:true,
      production_deploy:false
    }
  };
}

async function runViewport(name,viewport){
  const browser=await chromium.launch({headless:true,channel:'chrome'});
  const context=await browser.newContext({viewport});
  let current=payload(structuredClone(gelatoClosure.human_questions||[]),[]);
  let lastDecision=null;
  await context.route('https://human-input.test/operator',route=>route.fulfill({status:200,contentType:'text/html; charset=utf-8',body:pageHtml}));
  await context.route('https://human-input.test/operator/api/project-source-intake**',async route=>{
    const request=route.request();
    if(request.method()==='POST'&&request.url().includes('/human-decision')){
      lastDecision=request.postDataJSON();
      const resolvedQuestion=(gelatoClosure.human_questions||[]).find(q=>q.id===lastDecision.question_id);
      const remaining=current.human_input_closure.open_inputs.filter(q=>q.id!==lastDecision.question_id);
      current=payload(remaining,[...(current.human_input_closure.resolved_inputs||[]),{id:lastDecision.question_id,question:resolvedQuestion?.question||'',status:'RESOLVED'}]);
      return route.fulfill({status:200,contentType:'application/json; charset=utf-8',body:JSON.stringify({ok:true,human_input_closure:current.human_input_closure})});
    }
    if(request.method()==='GET') return route.fulfill({status:200,contentType:'application/json; charset=utf-8',body:JSON.stringify(current)});
    return route.fulfill({status:200,contentType:'application/json; charset=utf-8',body:JSON.stringify({ok:true})});
  });

  const page=await context.newPage();
  const pageErrors=[];
  page.on('pageerror',error=>pageErrors.push(String(error)));
  await page.goto('https://human-input.test/operator',{waitUntil:'domcontentloaded'});
  await page.waitForSelector('[data-human-input-closure]');
  const root=page.locator('[data-human-input-closure]');
  assert.equal(await root.isVisible(),true,name);
  assert.match(await root.innerText(),/OPEN INPUTS \/ DECISIONS/);
  assert.match(await root.innerText(),/OPEN INPUTS: 7/);
  assert.equal(await root.locator('[data-human-question]').count(),7,name);
  assert.equal(await root.locator('[data-human-question="BUSINESS_MODEL"]').count(),0,name);

  const contact=root.locator('[data-human-question="CONTACT_DETAILS"]');
  assert.equal(await contact.getByText('06806 9394980',{exact:false}).isVisible(),true);
  assert.equal(await contact.getByText('+49 176 200 150 65',{exact:false}).isVisible(),true);
  assert.equal(await contact.getByText('Hauptstraße 4, 66346 Köllerbach',{exact:false}).isVisible(),true);
  assert.equal(await contact.getByText('Hauptstraße 4, 66346 Püttlingen',{exact:false}).isVisible(),true);
  assert.equal(await contact.getByText('fabrizio.lazzano@freenet.de',{exact:false}).isVisible(),true);

  await contact.locator('[data-control-id="phone"] input[type=checkbox]').first().check();
  await contact.locator('[data-control-id="address"] select').selectOption('0');
  await contact.locator('[data-control-id="email"] input[type=radio][value=yes]').check();
  const save=contact.getByRole('button',{name:'Confirm / Save'});
  if(viewport.width<=760){
    const box=await save.boundingBox();
    assert.ok(box&&box.height>=45,name+' mobile save touch target');
  }
  await save.click();
  await page.waitForFunction(()=>document.querySelector('[data-human-input-closure]')?.textContent?.includes('OPEN INPUTS: 6'));
  assert.ok(lastDecision,name+' decision request missing');
  assert.equal(lastDecision.question_id,'CONTACT_DETAILS');
  assert.deepEqual(lastDecision.controls.phone.values,['06806 9394980']);
  assert.equal(lastDecision.controls.address.value,'Hauptstraße 4, 66346 Köllerbach');
  assert.equal(lastDecision.controls.email.confirmed,true);
  assert.match(await root.innerText(),/RESOLVED: 1/);
  assert.equal(await root.locator('[data-human-question="CONTACT_DETAILS"]').count(),0);

  const finalApproval=root.locator('[data-human-question="FINAL_HUMAN_QUALITY_APPROVAL"]');
  assert.equal(await finalApproval.locator('input[data-human-preview]').count(),1);
  assert.match(await finalApproval.innerText(),/tatsächliche Vorschau gesehen/i);

  const width=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,inner:window.innerWidth}));
  assert.ok(width.scroll<=width.inner+1,name+' horizontal overflow: '+JSON.stringify(width));
  assert.equal((await page.locator('body').innerText()).includes('[object Object]'),false);
  assert.deepEqual(pageErrors,[]);
  await browser.close();
  return {name,open_inputs_rendered:7,candidate_choice:'PASS',save_and_resolved:'PASS',human_preview_guard_visible:'PASS',horizontal_overflow:'PASS'};
}

const desktop=await runViewport('desktop',{width:1440,height:1000});
const mobile=await runViewport('iphone',{width:390,height:844});
console.log(JSON.stringify({
  ok:true,
  suite:'project-ferrari-dashboard-human-input-closure-v1-browser',
  browser_human_outcome:'PASS',
  desktop,
  mobile,
  real_gelato_decisions_mutated:false,
  production_deploy:false,
  public_launch:false,
  paid_provider_calls:0,
  variable_cost_eur:0
},null,2));
