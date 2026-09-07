import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const port=8799;
const origin='http://127.0.0.1:'+port;
const outDir='artifacts/webfactory-100-j11-dashboard-control-plane';
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
    try{
      const r=await fetch(origin+'/operator',{signal:AbortSignal.timeout(1500)});
      if(r.status===200)return;
    }catch{}
    await new Promise(r=>setTimeout(r,350));
  }
  throw new Error('Worker not ready\n'+output);
}

let browser;
const errors=[];
try{
  await waitForWorker();
  browser=await chromium.launch({headless:true,channel:'chrome'});
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  page.on('pageerror',e=>errors.push(e?.stack||String(e)));

  const snapshotProbe=await page.request.get(origin+'/operator/api/snapshot');
  assert.equal(snapshotProbe.status(),200);
  const snapshot=await snapshotProbe.json();
  const revision=Number(snapshot?.runtime?.revision);
  assert.equal(Number.isInteger(revision),true);

  const create=await page.request.post(origin+'/operator/api/projects/create',{data:{
    expected_revision:revision,
    customer_id:'gelato-donatello',
    project_id:'gelato-donatello-website-v1',
    scope_key:'gelato-donatello:gelato-donatello-website-v1',
    business_name:'Gelato Donatello',
    industry:'gelateria',
    country:'DE',
    language:'de',
    mission_context:'PROJECT JAGUAR J11 deterministic dashboard-control-plane browser acceptance.'
  }});
  assert.ok([200,201].includes(create.status()),'Gelato runtime project create failed');

  await page.goto(origin+'/operator',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>!document.body.classList.contains('loading'));
  await page.locator('[data-goto="projects"]').first().click();
  await page.waitForSelector('.pm-summary');

  const gelato=page.locator('.pm-list .pm-open[data-scope="gelato-donatello:gelato-donatello-website-v1"]').first();
  assert.equal(await gelato.count(),1,'Gelato project must be openable in Premium dashboard');
  await gelato.click();
  await page.waitForSelector('.pm-workspace');
  await page.waitForSelector('.pm-tabs [data-pm-tab="webfactory"]');

  const wfTab=page.locator('.pm-tabs [data-pm-tab="webfactory"]');
  assert.equal(await wfTab.count(),1,'J11 must add exactly one WebFactory workspace tab');
  assert.equal(await wfTab.innerText(),'WebFactory');

  await wfTab.click();
  await page.waitForSelector('[data-j11-control-plane]');
  await page.waitForTimeout(250);

  const panel=page.locator('[data-pm-panel="webfactory"]');
  assert.equal(await panel.isVisible(),true,'J11 WebFactory panel must be active');
  const panelText=await panel.innerText();
  assert.match(panelText,/PROJECT JAGUAR/i);
  assert.match(panelText,/WEBFACTORY CONTROL PLANE/i);
  assert.match(panelText,/Keine automatische Ausführung/i);

  const expectedFields=[
    'Build Profile','Jaguar Version','Knowledge Revision','Reference','Visual Score',
    'Build / QA','Performance','Accessibility','Preview','Cost','Delivery State'
  ];
  for(const label of expectedFields){
    assert.ok(panelText.toLowerCase().includes(label.toLowerCase()),'missing J11 field '+label);
  }

  const expectedActions=[
    'SKETCH','REFERENCE','VARIANT','APPROVAL','BUILD','VISUAL_QA','DELTA_CLOSURE',
    'REBUILD','PREVIEW','CHANGES','DELIVERY'
  ];
  for(const id of expectedActions){
    assert.equal(await panel.locator('[data-j11-action="'+id+'"]').count(),1,'missing J11 action '+id);
  }

  assert.equal(await panel.locator('.j11-tech').count(),1,'technical detail drawer missing');
  assert.match(await panel.locator('.j11-tech').innerText(),/Technische Details/i);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth),true,'desktop J11 horizontal overflow');
  await page.screenshot({path:outDir+'/j11-webfactory-desktop.png',fullPage:true});

  const writeRequests=[];
  const onRequest=req=>{
    if(!['GET','HEAD','OPTIONS'].includes(req.method()))writeRequests.push({method:req.method(),url:req.url()});
  };
  page.on('request',onRequest);

  const sketch=panel.locator('[data-j11-action="SKETCH"]');
  assert.equal(await sketch.isEnabled(),true,'Sketch must be available when project scope exists');
  await sketch.click();
  await page.waitForTimeout(120);
  assert.equal(await page.locator('[data-pm-panel="implementation"]').isVisible(),true,'Sketch prepares existing Implementation workspace');
  assert.deepEqual(writeRequests,[],'J11 Sketch UI action must not perform network writes');

  await page.locator('.pm-tabs [data-pm-tab="webfactory"]').click();
  await page.waitForTimeout(80);
  const changes=page.locator('[data-pm-panel="webfactory"] [data-j11-action="CHANGES"]');
  assert.equal(await changes.isEnabled(),true,'Changes must remain operator-available');
  await changes.click();
  await page.waitForTimeout(80);
  assert.equal(await page.locator('[data-pm-panel="activity"]').isVisible(),true,'Changes prepares existing Activity workspace');
  assert.deepEqual(writeRequests,[],'J11 Changes UI action must not perform network writes');
  page.off('request',onRequest);

  await page.setViewportSize({width:390,height:844});
  await page.locator('.pm-tabs [data-pm-tab="webfactory"]').click();
  await page.waitForTimeout(120);
  assert.equal(await page.locator('[data-pm-panel="webfactory"]').isVisible(),true);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth),true,'iPhone J11 horizontal overflow');
  await page.screenshot({path:outDir+'/j11-webfactory-iphone.png',fullPage:true});

  const mobileGridColumns=await page.locator('.j11-grid').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').filter(Boolean).length);
  assert.ok(mobileGridColumns<=2,'J11 mobile field grid must collapse to at most two columns');

  assert.deepEqual(errors,[]);

  console.log(JSON.stringify({
    ok:true,
    suite:'webfactory-100-j11-dashboard-control-plane-browser',
    premium_workspace_reused:'PASS',
    webfactory_tab:'PASS',
    field_count:expectedFields.length,
    action_count:expectedActions.length,
    technical_drawer:'PASS',
    desktop_overflow:false,
    iphone_overflow:false,
    operator_actions_network_writes:0,
    automatic_execution:false,
    production_deploy:false,
    public_launch:false,
    dns_change:false,
    billing_activation:false,
    external_writes:false
  },null,2));
}finally{
  if(browser)await browser.close().catch(()=>{});
  if(!exited)child.kill('SIGTERM');
}
