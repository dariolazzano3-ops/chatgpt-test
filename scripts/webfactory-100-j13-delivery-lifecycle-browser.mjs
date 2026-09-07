import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const port=8803;
const origin='http://127.0.0.1:'+port;
const outDir='artifacts/webfactory-100-j13-delivery-lifecycle';
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
    mission_context:'PROJECT JAGUAR J13 deterministic delivery lifecycle browser acceptance.'
  }});
  assert.ok([200,201].includes(create.status()));

  await page.goto(origin+'/operator',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>!document.body.classList.contains('loading'));
  await page.locator('[data-goto="projects"]').first().click();
  await page.waitForSelector('.pm-summary');

  const gelato=page.locator('.pm-list .pm-open[data-scope="gelato-donatello:gelato-donatello-website-v1"]').first();
  assert.equal(await gelato.count(),1);
  await gelato.click();
  await page.waitForSelector('.pm-workspace');
  await page.waitForSelector('.pm-next[data-j12-ready="1"]',{timeout:15000});

  const workspace=page.locator('.pm-workspace');
  const j12Code=await workspace.getAttribute('data-j12-action');
  assert.ok(j12Code,'J12 pre-delivery action required');

  await page.locator('.pm-tabs [data-pm-tab="webfactory"]').click();
  await page.waitForSelector('[data-j13-delivery-lifecycle]',{timeout:15000});
  await page.waitForTimeout(250);

  const panel=page.locator('[data-pm-panel="webfactory"]');
  assert.equal(await panel.isVisible(),true);

  const j13=panel.locator('[data-j13-delivery-lifecycle]');
  const text=await j13.innerText();
  assert.match(text,/DELIVERY LIFECYCLE/i);
  assert.match(text,/Private Preview/i);
  assert.match(text,/Customer Review/i);
  assert.match(text,/Revision/i);
  assert.match(text,/Approval/i);
  assert.match(text,/Handoff/i);
  assert.match(text,/Delivery Package/i);
  assert.match(text,/External Activation bleibt getrennt/i);

  const j13State=await workspace.getAttribute('data-j13-state');
  assert.equal(j13State,'PRE_DELIVERY_BLOCKED','fresh local project must not fake J13 readiness');
  assert.match(text,/PRE_DELIVERY_BLOCKED/i);
  assert.notEqual(j12Code,'READY_FOR_DELIVERY_LIFECYCLE','fresh fixture must stay before delivery lifecycle entry');

  assert.equal(await j13.locator('button').count(),0,'J13 projection must not add an automatic lifecycle execution button');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth),true,'desktop J13 horizontal overflow');
  await page.screenshot({path:outDir+'/j13-delivery-lifecycle-desktop.png',fullPage:true});

  await page.setViewportSize({width:390,height:844});
  await page.waitForTimeout(160);
  assert.equal(await panel.isVisible(),true);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth),true,'iPhone J13 horizontal overflow');

  const visibleSteps=await j13.locator('.j13-step').count();
  assert.equal(visibleSteps,6);
  await page.screenshot({path:outDir+'/j13-delivery-lifecycle-iphone.png',fullPage:true});

  assert.deepEqual(errors,[]);

  console.log(JSON.stringify({
    ok:true,
    suite:'webfactory-100-j13-delivery-lifecycle-browser',
    project_scope:'gelato-donatello:gelato-donatello-website-v1',
    j12_action:j12Code,
    j13_state:j13State,
    lifecycle_steps:6,
    fake_delivery_readiness:false,
    automatic_lifecycle_button:false,
    desktop_overflow:false,
    iphone_overflow:false,
    automatic_customer_communication:false,
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
