import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const port=8797;
const origin='http://127.0.0.1:'+port;
const outDir='artifacts/project-ferrari-premium-masterdashboard-v1';
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
try{
  await waitForWorker();
  browser=await chromium.launch({headless:true,channel:'chrome'});
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(origin+'/operator',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>!document.body.classList.contains('loading'));
  await page.locator('[data-goto="projects"]').first().click();
  await page.waitForSelector('.pm-summary');

  assert.match(await page.locator('#projects').innerText(),/AURENTARA SYSTEMS/i);
  assert.match(await page.locator('#projects').innerText(),/Benötigen Aufmerksamkeit/i);
  assert.ok(await page.locator('.pm-project').count()>0,'Command Center must render projects');
  assert.equal(await page.locator('#project-detail').count(),0,'Portfolio must not render a full project workspace below the list');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth),true,'desktop portfolio horizontal overflow');
  await page.screenshot({path:outDir+'/portfolio-desktop.png',fullPage:true});

  const gelato=page.locator('.pm-list .pm-open[data-scope*="gelato-donatello"]').first();
  const scoped=page.locator('.pm-list .pm-open').filter({has:page.locator('xpath=self::*[@data-scope and string-length(@data-scope)>0]')}).first();
  const opener=await gelato.count()?gelato:scoped;
  const chosenScope=await opener.getAttribute('data-scope');
  assert.ok(chosenScope,'browser acceptance requires an openable project scope');
  const detailProbe=await page.request.get(origin+'/operator/api/project-detail/'+encodeURIComponent(chosenScope));
  assert.equal(detailProbe.status(),200,'selected project detail API must be available');
  await opener.click();
  await page.waitForTimeout(800);
  if(await page.locator('.pm-workspace').count()===0){
    throw new Error('Premium workspace did not open. scope='+chosenScope+' pageErrors='+JSON.stringify(errors)+' errorSurface='+JSON.stringify(await page.locator('#error').innerText().catch(()=>''))+' projects='+JSON.stringify((await page.locator('#projects').innerText()).slice(0,1800)));
  }
  assert.equal(await page.locator('.pm-next').isVisible(),true);
  for(const label of ['Übersicht','Quellen','Projektwissen','Umsetzung','Preview','Prüfungen','Aktivität']){
    assert.equal(await page.getByRole('button',{name:label,exact:true}).count()>0,true,'missing project tab '+label);
  }
  assert.match(await page.locator('.pm-workspace-head').innerText(),/NÄCHSTER SCHRITT/i);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth),true,'desktop workspace horizontal overflow');
  await page.screenshot({path:outDir+'/project-overview-desktop.png',fullPage:true});

  const shots=[['Quellen','sources-desktop.png'],['Projektwissen','knowledge-desktop.png'],['Preview','preview-desktop.png'],['Prüfungen','approvals-desktop.png']];
  for(const [label,file] of shots){
    await page.getByRole('button',{name:label,exact:true}).click();
    await page.waitForTimeout(120);
    assert.equal(await page.locator('.pm-panel.active').count(),1,'exactly one workspace panel must be active');
    await page.screenshot({path:outDir+'/'+file,fullPage:true});
  }

  await page.setViewportSize({width:390,height:844});
  await page.getByRole('button',{name:'← Projekte',exact:true}).click();
  await page.waitForSelector('.pm-summary');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth),true,'iPhone portfolio horizontal overflow');
  await page.screenshot({path:outDir+'/portfolio-iphone.png',fullPage:true});

  const mobileGelato=page.locator('.pm-list .pm-open[data-scope*="gelato-donatello"]').first();
  const mobileScoped=page.locator('.pm-list .pm-open').filter({has:page.locator('xpath=self::*[@data-scope and string-length(@data-scope)>0]')}).first();
  const mobileOpener=await mobileGelato.count()?mobileGelato:mobileScoped;
  await mobileOpener.click();
  await page.waitForTimeout(500);
  assert.equal(await page.locator('.pm-workspace').count(),1,'mobile premium workspace must open');
  assert.equal(await page.locator('.pm-next').isVisible(),true,'mobile next action must remain visible');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth),true,'iPhone workspace horizontal overflow');
  await page.screenshot({path:outDir+'/project-overview-iphone.png',fullPage:true});

  for(const [label,file] of [['Quellen','sources-iphone.png'],['Projektwissen','knowledge-iphone.png']]){
    await page.getByRole('button',{name:label,exact:true}).click();
    await page.waitForTimeout(120);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth),true,'iPhone '+label+' horizontal overflow');
    await page.screenshot({path:outDir+'/'+file,fullPage:true});
  }

  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({
    ok:true,
    suite:'project-ferrari-premium-masterdashboard-v1-browser',
    portfolio_desktop:'PASS',
    project_workspace_desktop:'PASS',
    sources_desktop:'PASS',
    knowledge_desktop:'PASS',
    preview_desktop:'PASS',
    approvals_desktop:'PASS',
    portfolio_iphone:'PASS',
    project_workspace_iphone:'PASS',
    sources_iphone:'PASS',
    knowledge_iphone:'PASS',
    horizontal_overflow:false,
    production_deploy:false,
    external_writes:false
  },null,2));
}finally{
  if(browser)await browser.close().catch(()=>{});
  if(!exited)child.kill('SIGTERM');
}
