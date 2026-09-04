import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const port=8807;
const origin=`http://127.0.0.1:${port}`;
const child=spawn(process.execPath,[
  'node_modules/wrangler/bin/wrangler.js','dev','--env','staging','--port',String(port),
  '--var','RIOSYSTEMS_ENVIRONMENT:local',
  '--var','RIOSYSTEMS_OPERATOR_RUNTIME_STORE:memory',
  '--var','RIOSYSTEMS_OPERATOR_EMAIL:operator@riosystems.local',
  '--var','RIOSYSTEMS_ACCESS_AUD:riosystems-operator-local',
  '--var','AURENTARA_OPERATOR_AI_REAL_INFERENCE_ENABLED:false'
],{cwd:process.cwd(),env:{...process.env,NO_COLOR:'1'},stdio:['ignore','pipe','pipe']});

let output='',exit=null;
child.stdout.on('data',x=>{output+=x.toString()});
child.stderr.on('data',x=>{output+=x.toString()});
child.once('exit',(code,signal)=>{exit={code,signal}});

async function waitWorker(timeout=30000){
  const start=Date.now();
  while(Date.now()-start<timeout){
    if(exit)throw new Error('local Worker exited '+JSON.stringify(exit)+'\n'+output);
    try{const r=await fetch(origin+'/operator',{signal:AbortSignal.timeout(1500)});if(r.status===200)return}catch{}
    await new Promise(r=>setTimeout(r,300));
  }
  throw new Error('local Worker not ready\n'+output);
}
async function ready(page){
  await page.waitForFunction(()=>window.__aurentaraGlobalOperatorAiAccessV1===true&&!document.body.classList.contains('loading'));
  await page.waitForTimeout(250);
}
const sections=['hq','projects','missions','approvals','deliveries','executions','factories','capabilities','providers','costs','quality','health','audit','settings'];
let browser;
const errors=[];
try{
  await waitWorker();
  browser=await chromium.launch({headless:true,channel:'chrome'});
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(origin+'/operator',{waitUntil:'domcontentloaded'});
  await ready(page);

  const trigger=page.locator('#global-operator-ai-trigger');
  assert.equal(await trigger.isVisible(),true);
  assert.match(await trigger.innerText(),/ASK OPERATOR AI/i);
  assert.equal(await page.locator('.nav .operator-ai-nav').count(),0,'no fragile nav injection remains');

  const checked=[];
  for(const id of sections){
    const nav=page.locator(`.nav button[data-goto="${id}"]`);
    assert.ok(await nav.count()>0,`nav section ${id} exists`);
    await nav.first().click();
    await page.waitForFunction(expected=>typeof state!=='undefined'&&state.section===expected,id);
    assert.equal(await trigger.isVisible(),true,`global trigger visible on ${id}`);
    checked.push(id);
  }

  await page.locator('.nav button[data-goto="quality"]').click();
  await page.waitForFunction(()=>state.section==='quality');
  const before=await page.evaluate(()=>state.section);
  await trigger.click();
  await page.locator('#global-operator-ai-panel').waitFor({state:'visible'});
  assert.equal(await page.evaluate(()=>state.section),before,'opening sidepanel keeps current view');
  assert.equal(await page.locator('#global-operator-ai-section').innerText(),'Quality');
  await page.locator('#global-operator-ai-close').click();
  await page.locator('#global-operator-ai-panel').waitFor({state:'hidden'});
  assert.equal(await page.evaluate(()=>state.section),before,'closing sidepanel keeps current view');

  const gelatoScope='gelato-donatello:website-v1';
  await page.evaluate(scope=>{
    state.section='projects';
    state.selectedScope=scope;
    state.detail={project:{scope_key:scope,project_id:'gelato-donatello',name:'Gelato Donatello',state:'READY',environment:'staging'}};
  },gelatoScope);

  let mockCalls=0,posted=null;
  await page.route('**/operator/api/operator-ai/message',async route=>{
    mockCalls+=1;
    posted=JSON.parse(route.request().postData()||'{}');
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
      ok:true,
      schema:'aurentara.operator-ai.response.v1',
      summary:'Gelato ist im synthetischen Testkontext ausgewählt. Es wurde nichts gestartet.',
      next_action:{code:'REVIEW_QUALITY',message:'Den größten Qualitätshebel im aktuellen Projekt prüfen.'},
      blockers:[{code:'NO_LIVE_BLOCKER',message:'Keine Live-Execution im UI-Test.'}],
      execution:{started:false,actual_autonomy:1,safe_internal_execution_status:'NOT_ACTIVATED'},
      inference:{status:'VERIFIED',model:'gpt-5.6-luna',usage:{input_tokens:12,output_tokens:8,total_tokens:20},estimated_cost_usd:0.00001,tool_calls:0},
      production_deploy:false,external_writes:false
    })});
  });

  await trigger.click();
  assert.equal(await page.locator('#global-operator-ai-project').innerText(),'Gelato Donatello');
  assert.equal(await page.locator('#global-operator-ai-section').innerText(),'Projects');
  await page.locator('#global-operator-ai-input').fill('Was blockiert dieses Projekt?');
  await page.locator('#global-operator-ai-send').click();
  await page.waitForFunction(()=>document.getElementById('global-operator-ai-output')?.textContent?.includes('Gelato'));
  assert.equal(mockCalls,1);
  assert.equal(posted.project_scope,gelatoScope);
  assert.equal(posted.conversation_project_scope,gelatoScope);
  assert.equal(posted.ui_context.selected_project_scope,gelatoScope);
  assert.equal(posted.ui_context.selected_project_name,'Gelato Donatello');
  assert.equal(posted.ui_context.section,'projects');
  assert.equal(posted.ui_context.view_identity,'masterdashboard:projects');
  const answer=await page.locator('#global-operator-ai-output').innerText();
  assert.match(answer,/Next Action/i);
  assert.match(answer,/Blocker/i);
  assert.match(answer,/REAL AI CONNECTED/i);
  assert.match(answer,/20 Tokens/i);
  assert.match(answer,/gpt-5\.6-luna/i);

  await page.locator('#global-operator-ai-full').click();
  await page.waitForFunction(()=>document.getElementById('operator-ai')?.classList.contains('active'));
  assert.equal(await page.locator('#title').innerText(),'Operator AI');
  for(const tab of ['CHAT','BRIEF','MASTERPROMPT','RUN','RESULT'])assert.ok(await page.locator(`[data-ai-tab="${tab}"]`).count()>0);

  await page.evaluate(()=>{
    const nav=document.querySelector('.nav');
    if(nav)nav.innerHTML='<button data-goto="hq">HQ rebuilt</button>';
  });
  assert.equal(await trigger.isVisible(),true,'global trigger survives navigation rebuild');
  assert.equal(await page.locator('#global-operator-ai-panel').count(),1);
  await page.unroute('**/operator/api/operator-ai/message');

  const mobile=await browser.newPage({viewport:{width:390,height:844}});
  mobile.on('pageerror',e=>errors.push(String(e)));
  await mobile.goto(origin+'/operator',{waitUntil:'domcontentloaded'});
  await ready(mobile);
  assert.equal(await mobile.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth),true,'mobile has no horizontal overflow');
  const mobileTrigger=mobile.locator('#global-operator-ai-trigger');
  assert.equal(await mobileTrigger.isVisible(),true);
  await mobileTrigger.click();
  assert.equal(await mobile.locator('#global-operator-ai-panel').isVisible(),true);
  assert.equal(await mobile.locator('#global-operator-ai-input').isVisible(),true);
  assert.equal(await mobile.locator('#global-operator-ai-send').isVisible(),true);
  const box=await mobile.locator('#global-operator-ai-panel').boundingBox();
  assert.ok(box&&box.width<=390.5,'mobile drawer fits viewport');
  assert.equal(await mobile.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth),true,'open mobile drawer has no horizontal overflow');
  await mobile.locator('#global-operator-ai-close').click();
  assert.equal(await mobile.locator('#global-operator-ai-panel').isVisible(),false);
  await mobile.close();

  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({
    ok:true,
    suite:'operator-ai-global-access-v1-browser',
    checked_views:checked,
    global_trigger_everywhere:true,
    gelato_project_context:true,
    sidepanel_open_close:true,
    view_retained:true,
    navigation_rebuild_survived:true,
    full_workspace_preserved:true,
    desktop:true,
    iphone_390x844:true,
    mocked_operator_ai_messages:mockCalls,
    paid_provider_calls:0,
    production_deploy:false,
    external_writes:false,
    level_4:'NOT_ACTIVATED'
  },null,2));
}finally{
  if(browser)await browser.close().catch(()=>{});
  if(!exit)child.kill('SIGTERM');
  await new Promise(resolve=>{if(exit)return resolve();const timer=setTimeout(resolve,3000);child.once('exit',()=>{clearTimeout(timer);resolve()})});
}
