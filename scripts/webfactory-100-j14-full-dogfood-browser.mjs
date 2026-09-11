import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const port=8805;
const origin='http://127.0.0.1:'+port;
const outDir='artifacts/webfactory-100-j14-full-dogfood-closure';
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
    try{const r=await fetch(origin+'/operator',{signal:AbortSignal.timeout(1500)});if(r.status===200)return;}catch{}
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
    mission_context:'PROJECT JAGUAR J14 composed closure browser acceptance.'
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
  assert.equal(await page.locator('.pm-next button').count(),1,'exactly one primary action must remain');
  const action=await workspace.getAttribute('data-j12-action');
  assert.ok(action);
  assert.notEqual(action,'READY_FOR_DELIVERY_LIFECYCLE','fresh/incomplete project must not jump to delivery');

  await page.locator('.pm-tabs [data-pm-tab="webfactory"]').click();
  await page.waitForSelector('[data-j11-control-plane]',{timeout:15000});
  await page.waitForSelector('[data-j12-next-best-action]',{timeout:15000});
  await page.waitForSelector('[data-j13-delivery-lifecycle]',{timeout:15000});
  await page.waitForTimeout(200);

  const panel=page.locator('[data-pm-panel="webfactory"]');
  assert.equal(await panel.isVisible(),true);
  assert.match(await panel.innerText(),/WEBFACTORY CONTROL PLANE/i);
  assert.match(await panel.innerText(),/NEXT BEST ACTION/i);
  assert.match(await panel.innerText(),/DELIVERY LIFECYCLE/i);
  assert.equal(await workspace.getAttribute('data-j13-state'),'PRE_DELIVERY_BLOCKED');
  assert.equal(await panel.locator('[data-j12-primary]').count(),0,'no duplicate primary action in WebFactory');
  assert.equal(await panel.locator('[data-j13-delivery-lifecycle] button').count(),0,'J13 must not auto-execute');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth),true);
  await page.screenshot({path:outDir+'/j14-composed-desktop.png',fullPage:true});

  await page.setViewportSize({width:390,height:844});
  await page.waitForTimeout(150);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth),true);
  assert.equal(await page.locator('.pm-next button').count(),1);
  assert.equal(await panel.locator('[data-j13-delivery-lifecycle] .j13-step').count(),6);
  await page.screenshot({path:outDir+'/j14-composed-iphone.png',fullPage:true});

  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({
    ok:true,
    suite:'webfactory-100-j14-full-dogfood-browser',
    project_scope:'gelato-donatello:gelato-donatello-website-v1',
    j12_action:action,
    j13_state:'PRE_DELIVERY_BLOCKED',
    j11_control_plane:'PASS',
    exactly_one_primary_action:'PASS',
    duplicate_primary:false,
    automatic_j13_execution:false,
    desktop_overflow:false,
    iphone_overflow:false,
    page_errors:0,
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
