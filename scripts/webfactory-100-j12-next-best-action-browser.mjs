import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const port=8801;
const origin='http://127.0.0.1:'+port;
const outDir='artifacts/webfactory-100-j12-next-best-action';
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
    mission_context:'PROJECT JAGUAR J12 deterministic Next Best Action browser acceptance.'
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
  const actionCode=await workspace.getAttribute('data-j12-action');
  assert.ok(actionCode,'J12 action code must be attached to workspace');

  const top=page.locator('.pm-next');
  assert.equal(await top.locator('button').count(),1,'J12 must keep exactly one workspace primary button');
  assert.equal(await top.locator('button').isVisible(),true);
  assert.match(await top.innerText(),/NÄCHSTER SCHRITT/i);
  assert.ok((await top.locator('strong').innerText()).trim().length>0,'J12 primary label must be visible');

  await page.locator('.pm-tabs [data-pm-tab="webfactory"]').click();
  await page.waitForSelector('[data-pm-panel="webfactory"] [data-j12-next-best-action]',{timeout:15000});
  await page.waitForTimeout(250);

  const panel=page.locator('[data-pm-panel="webfactory"]');
  assert.equal(await panel.isVisible(),true);
  assert.match(await panel.innerText(),/NEXT BEST ACTION/i);
  assert.equal(await panel.locator('[data-j12-primary]').count(),0,'J12 must not duplicate the primary button inside WebFactory');
  assert.equal(await panel.locator('.j12-secondary-details').count(),1,'J11 secondary action wall must be collapsed');
  assert.equal(await panel.locator('.j12-secondary-details').getAttribute('open'),null,'secondary actions must default collapsed');
  assert.equal(await panel.locator('.j11-actions').isVisible(),false,'secondary WebFactory actions must not form a default button wall');
  assert.equal(await panel.locator('[data-j11-action]').count(),11,'all J11 bounded actions remain available behind disclosure');

  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth),true,'desktop J12 horizontal overflow');
  await page.screenshot({path:outDir+'/j12-next-best-action-desktop.png',fullPage:true});

  const writes=[];
  const onRequest=req=>{
    if(!['GET','HEAD','OPTIONS'].includes(req.method()))writes.push({method:req.method(),url:req.url()});
  };
  page.on('request',onRequest);

  const webfactoryTab=page.locator('.pm-tabs [data-pm-tab="webfactory"]');
  await webfactoryTab.click();
  await page.waitForTimeout(80);

  const primary=page.locator('.pm-next button');
  await primary.click();
  await page.waitForTimeout(120);
  assert.deepEqual(writes,[],'J12 primary action must not perform a network write');

  const activeTab=await page.locator('.pm-tabs .pm-tab.active').first().getAttribute('data-pm-tab');
  assert.ok(['knowledge','approvals','webfactory','preview'].includes(activeTab),'J12 primary action must navigate to an existing bounded workspace target');
  page.off('request',onRequest);

  await page.setViewportSize({width:390,height:844});
  await page.locator('.pm-tabs [data-pm-tab="webfactory"]').click();
  await page.waitForTimeout(160);
  assert.equal(await page.locator('[data-pm-panel="webfactory"]').isVisible(),true);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth),true,'iPhone J12 horizontal overflow');
  assert.equal(await page.locator('.pm-next button').count(),1);
  assert.equal(await page.locator('.pm-next button').isVisible(),true);
  await page.screenshot({path:outDir+'/j12-next-best-action-iphone.png',fullPage:true});

  assert.deepEqual(errors,[]);

  console.log(JSON.stringify({
    ok:true,
    suite:'webfactory-100-j12-next-best-action-browser',
    project_scope:'gelato-donatello:gelato-donatello-website-v1',
    action_code:actionCode,
    exactly_one_primary_workspace_button:'PASS',
    duplicate_primary_in_webfactory:false,
    j11_action_wall_collapsed:'PASS',
    retained_secondary_action_count:11,
    desktop_overflow:false,
    iphone_overflow:false,
    network_writes_on_primary_action:0,
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
