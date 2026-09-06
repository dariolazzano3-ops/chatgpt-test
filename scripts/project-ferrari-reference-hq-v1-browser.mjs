import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const port=8799;
const origin='http://127.0.0.1:'+port;
const outDir='artifacts/project-ferrari-reference-hq-v1';
await mkdir(outDir,{recursive:true});

const child=spawn(process.execPath,[
  'node_modules/wrangler/bin/wrangler.js','dev','--env','staging','--port',String(port),
  '--var','RIOSYSTEMS_ENVIRONMENT:local',
  '--var','RIOSYSTEMS_OPERATOR_RUNTIME_STORE:memory',
  '--var','RIOSYSTEMS_OPERATOR_EMAIL:operator@riosystems.local',
  '--var','RIOSYSTEMS_ACCESS_AUD:riosystems-operator-local',
  '--var','RIOSYSTEMS_PRODUCTION_DEPLOY:false',
  '--var','RIOSYSTEMS_EXTERNAL_WRITES:false'
],{cwd:process.cwd(),env:{...process.env,NO_COLOR:'1'},stdio:['ignore','pipe','pipe']});

let output='',exited=null;
child.stdout.on('data',c=>{output+=c.toString()});
child.stderr.on('data',c=>{output+=c.toString()});
child.once('exit',(code,signal)=>{exited={code,signal}});

async function waitForWorker(){
  const start=Date.now();
  while(Date.now()-start<30000){
    if(exited)throw new Error('Worker exited '+JSON.stringify(exited)+'\n'+output);
    try{const r=await fetch(origin+'/operator',{signal:AbortSignal.timeout(1500)});if(r.status===200)return}catch{}
    await new Promise(r=>setTimeout(r,350));
  }
  throw new Error('Worker not ready\n'+output);
}

let browser;
const errors=[];
const api404=[];
try{
  await waitForWorker();
  browser=await chromium.launch({headless:true,channel:'chrome'});
  const page=await browser.newPage({viewport:{width:1586,height:992}});
  page.on('pageerror',e=>errors.push(e?.stack||String(e)));
  page.on('response',response=>{if(response.status()===404&&response.url().includes('/operator/api/'))api404.push(response.url())});

  const snapshot=await page.request.get(origin+'/operator/api/snapshot');
  assert.equal(snapshot.status(),200,'runtime snapshot must be available');
  const revision=Number((await snapshot.json())?.runtime?.revision);
  assert.equal(Number.isInteger(revision),true,'runtime revision must be available');
  const gelato=await page.request.post(origin+'/operator/api/projects/create',{data:{
    expected_revision:revision,
    customer_id:'gelato-donatello',
    project_id:'gelato-donatello-website-v1',
    scope_key:'gelato-donatello:gelato-donatello-website-v1',
    business_name:'Gelato Donatello',
    industry:'gelateria',country:'DE',language:'de',
    mission_context:'PROJECT FERRARI Reference 01 deterministic browser dogfood through canonical CREATE_PROJECT.'
  }});
  assert.ok([200,201].includes(gelato.status()),'Gelato canonical project must be available');

  await page.goto(origin+'/operator',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>!document.body.classList.contains('loading'));
  await page.waitForSelector('.rf-hq-shell');
  await page.waitForFunction(()=>document.querySelector('.rf-hq-shell')?.dataset?.hydrated==='true',{timeout:15000});

  assert.equal(await page.locator('body').evaluate(el=>el.classList.contains('reference-hq-v1')),true,'Reference 01 dark HQ mode must be active');
  assert.equal(await page.locator('.rf-hero h1').innerText(),'Masterdashboard');
  assert.match(await page.locator('.rf-kicker').innerText(),/REFERENCE-DRIVEN PREMIUM UI V1/i);
  assert.equal(await page.locator('.rf-kpi').count(),4,'Reference 01 requires four HQ KPI cards');
  for(const label of ['Aktive Projekte','Offene Inputs','Ausstehende Freigaben','Preview bereit']){
    assert.equal(await page.locator('.rf-kpi-label').filter({hasText:label}).count(),1,'missing KPI '+label);
  }
  assert.equal(await page.getByRole('heading',{name:'Attention Center',exact:true}).count(),1);
  assert.equal(await page.getByRole('heading',{name:'Operator AI',exact:true}).count(),1);
  assert.equal(await page.getByRole('heading',{name:'Projekt Portfolio',exact:true}).count(),1);
  assert.equal(await page.locator('.rf-selected').count(),1,'selected project context must be present');
  assert.match(await page.locator('.rf-selected').innerText(),/Gelato Donatello/i,'Gelato should be deterministic selected dogfood context');
  assert.match(await page.locator('.rf-env').innerText(),/STAGING/i,'HQ must show truthful staging environment');
  assert.match(await page.locator('.rf-selected').innerText(),/Production locked/i,'safety truth must remain visible');

  for(const label of ['HQ','Portfolio','Project Overview','Sources','Knowledge','Preview','Approvals','Activity','Operator AI','Settings']){
    assert.equal(await page.locator('.rf-hq-nav-main button').filter({hasText:label}).count(),1,'Reference sidebar missing '+label);
  }

  const projectsPayload=await (await page.request.get(origin+'/operator/api/projects')).json();
  const openable=(projectsPayload.items||[]).filter(p=>p.project_detail_openable===true);
  for(const p of openable){
    assert.ok(p.scope_key,'openable project must preserve canonical scope');
    const detail=await page.request.get(origin+'/operator/api/project-detail/'+encodeURIComponent(p.scope_key));
    assert.equal(detail.status(),200,'openable HQ project detail must return 200: '+p.scope_key);
  }

  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth),true,'desktop Reference 01 must not overflow horizontally');
  assert.deepEqual(api404,[],'Reference 01 must not cause operator API 404s');

  await page.locator('[data-rf-ai-open]').first().click();
  await page.waitForFunction(()=>document.getElementById('global-operator-ai-backdrop')?.classList.contains('open'));
  assert.equal(await page.locator('#global-operator-ai-panel').isVisible(),true,'Reference Operator AI entry must reuse existing global AI panel');
  await page.locator('#global-operator-ai-close').click();

  const projectTabs=['Übersicht','Quellen','Projektwissen','Umsetzung','Preview','Prüfungen','Aktivität'];
  for(const label of projectTabs) assert.equal(await page.locator('.rf-selected-tabs button').filter({hasText:label}).count(),1,'selected context missing '+label);

  await page.screenshot({path:outDir+'/reference-01-hq-desktop.png',fullPage:true});

  await page.setViewportSize({width:390,height:844});
  await page.waitForTimeout(150);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth),true,'Reference 01 must not break iPhone horizontal layout');
  assert.equal(await page.locator('.rf-hero h1').isVisible(),true,'HQ hero remains visible on iPhone');
  await page.screenshot({path:outDir+'/reference-01-hq-iphone-regression.png',fullPage:true});

  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({
    ok:true,
    suite:'project-ferrari-reference-hq-v1-browser',
    reference:'REFERENCE_01_MASTERDASHBOARD_HQ',
    desktop_structure:'PASS',
    operator_ai_reuse:'PASS',
    canonical_project_detail_contract:'PASS',
    desktop_overflow:false,
    iphone_regression_overflow:false,
    production_deploy:false,
    external_writes:false
  },null,2));
}finally{
  if(browser)await browser.close().catch(()=>{});
  if(!exited)child.kill('SIGTERM');
}
