import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const port=8811;
const origin='http://127.0.0.1:'+port;
const outDir='artifacts/aurentara-web-project-control-v2';
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

let browserInstance;
const errors=[];
try{
  await waitForWorker();
  browserInstance=await chromium.launch({headless:true});
  const page=await browserInstance.newPage({viewport:{width:1440,height:1000}});
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
    mission_context:'AURENTARA Web Project Control V2 browser acceptance.'
  }});
  assert.ok([200,201].includes(create.status()));

  await page.goto(origin+'/operator',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.body.classList.contains('awc-v2-ready'));
  await page.waitForFunction(()=>!document.body.classList.contains('loading'));

  assert.equal(await page.locator('.side .brand strong').innerText(),'AURENTARA SYSTEMS');
  assert.equal(await page.locator('.side .brand span').innerText(),'Web Project Control');
  assert.equal(await page.locator('.nav [data-goto="projects"]').innerText(),'Webseiten');
  assert.equal(await page.locator('.nav [data-goto="approvals"]').innerText(),'Freigaben');
  assert.equal(await page.locator('.nav [data-goto="health"]').innerText(),'System');
  assert.equal(await page.locator('[data-awc-hero]').isVisible(),true);
  assert.match(await page.locator('[data-awc-hero]').innerText(),/Auftrag/);
  assert.match(await page.locator('[data-awc-hero]').innerText(),/Autonomous Delivery Loop/);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth),true);
  await page.screenshot({path:outDir+'/hq-desktop.png',fullPage:true});

  await page.locator('.nav [data-goto="projects"]').click();
  await page.waitForSelector('.pm-list');
  assert.match(await page.locator('#projects').innerText(),/WebFactory verbunden/i);
  assert.match(await page.locator('#projects .pm-head').innerText(),/Webseiten/i);

  const gelato=page.locator('.pm-list .pm-open[data-scope="gelato-donatello:gelato-donatello-website-v1"]').first();
  assert.equal(await gelato.count(),1);
  await gelato.click();
  await page.waitForSelector('.pm-workspace');
  await page.waitForSelector('[data-awc-work-order]',{timeout:15000});

  const workspace=page.locator('.pm-workspace');
  assert.equal(await workspace.getAttribute('data-scope'),'gelato-donatello:gelato-donatello-website-v1');
  const expectedTabs=[
    ['sources','Material'],
    ['implementation','Auftrag & Bau'],
    ['webfactory','Website bauen'],
    ['preview','Preview'],
    ['approvals','Freigabe'],
    ['activity','Technik']
  ];
  for(const [id,label] of expectedTabs){
    const tab=workspace.locator('[data-pm-tab="'+id+'"]');
    assert.equal(await tab.count(),1,'missing '+id);
    assert.equal((await tab.innerText()).trim(),label,'unexpected label for '+id);
  }

  await workspace.locator('[data-pm-tab="implementation"]').click();
  await page.waitForTimeout(120);
  assert.equal(await page.locator('[data-awc-work-order]').isVisible(),true);
  assert.match(await page.locator('[data-awc-work-order]').innerText(),/Was soll sich ändern/i);
  assert.match(await page.locator('[data-awc-work-order]').innerText(),/Public Launch, Production, DNS und Billing bleiben gesperrt/i);

  await page.locator('[data-awc-work-order] textarea').fill('Logo im Header hochwertiger und dreidimensionaler wirken lassen, ohne das Logo selbst zu verändern.');
  const posts=[];
  page.on('request',r=>{if(r.method()==='POST')posts.push(new URL(r.url()).pathname)});
  await page.locator('[data-awc-prepare]').click();
  await page.waitForFunction(()=>document.querySelector('[data-awc-status]')?.classList.contains('good'),{timeout:15000});
  assert.match(await page.locator('[data-awc-status]').innerText(),/Auftrag vorbereitet/i);
  assert.equal(posts.filter(x=>x==='/operator/api/mission-preflight').length,1,'exactly one preflight write');
  assert.equal(posts.some(x=>/production|deploy|dns|billing/i.test(x)),false,'no production-style endpoint is called');

  const approvalsProbe=await page.request.get(origin+'/operator/api/approvals');
  assert.equal(approvalsProbe.status(),200);
  const approvals=await approvalsProbe.json();
  const plans=approvals.mission_plans||[];
  assert.ok(plans.some(x=>x.scope_key==='gelato-donatello:gelato-donatello-website-v1'),'work order must become a project-scoped approval plan');
  assert.ok(plans.every(x=>x.production_deploy===false),'prepared plans must keep production disabled');

  await page.locator('[data-awc-open-approvals]').click();
  await page.waitForTimeout(300);
  assert.equal(await page.locator('#approvals').isVisible(),true,'approval center opens from prepared work order');

  await page.locator('.nav [data-goto="projects"]').click();
  await page.waitForSelector('.pm-list');
  await page.locator('.pm-list .pm-open[data-scope="gelato-donatello:gelato-donatello-website-v1"]').first().click();
  await page.waitForSelector('.pm-workspace');
  await page.setViewportSize({width:390,height:844});
  await page.waitForTimeout(200);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth),true,'iPhone workspace must not overflow');
  assert.equal(await page.locator('[data-awc-work-order]').isVisible(),true);
  await page.screenshot({path:outDir+'/workspace-iphone.png',fullPage:true});

  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({
    ok:true,
    suite:'aurentara-web-project-control-v2-browser',
    desktop_hq:'PASS',
    project_workspace:'PASS',
    work_order_preflight:'PASS',
    project_scoped_approval_plan:'PASS',
    iphone_390x844:'PASS',
    horizontal_overflow:false,
    production_deploy:false,
    public_launch:false,
    dns_change:false,
    billing_activation:false,
    automatic_merge:false
  },null,2));
}finally{
  if(browserInstance)await browserInstance.close().catch(()=>{});
  if(!exited)child.kill('SIGTERM');
}
