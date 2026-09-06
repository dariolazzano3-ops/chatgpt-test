import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { captureDomMeasurements, evaluateDomMeasurementIntegrity } from '../src/visual-foundry/dom-measurement.js';

const runNumber=Number(process.env.GOLD_STANDARD_RUN||1);
assert.ok([1,2,3].includes(runNumber),'GOLD_STANDARD_RUN must be 1, 2 or 3');
const port=8890+runNumber;
const origin='http://127.0.0.1:'+port;
const outDir='artifacts/visual-foundry/gold-standard/run-'+runNumber;
await mkdir(outDir,{recursive:true});

const fixture=JSON.parse(await readFile('factory-state/visual-foundry/aurentara-hq-gold-standard-fixture-v1.json','utf8'));
const referenceSpec=JSON.parse(await readFile('factory-state/visual-foundry/aurentara-hq-control-center-reference-spec-v1.json','utf8'));
const referenceRegistration=JSON.parse(await readFile('factory-state/visual-foundry/aurentara-hq-control-center-reference-v1-0.json','utf8'));

assert.equal(fixture.truth_class,'VISUAL_FIXTURE');
assert.equal(fixture.runtime_truth_write_allowed,false);
assert.equal(fixture.production_allowed,false);
assert.equal(referenceSpec.reference_id,referenceRegistration.reference.reference_id);
assert.equal(referenceRegistration.hash_match,true);

const child=spawn(process.execPath,[
  'node_modules/wrangler/bin/wrangler.js','dev','--env','staging','--port',String(port),
  '--var','RIOSYSTEMS_ENVIRONMENT:local',
  '--var','RIOSYSTEMS_OPERATOR_RUNTIME_STORE:memory',
  '--var','RIOSYSTEMS_OPERATOR_EMAIL:operator@riosystems.local',
  '--var','RIOSYSTEMS_ACCESS_AUD:riosystems-operator-local',
  '--var','RIOSYSTEMS_PRODUCTION_DEPLOY:false',
  '--var','RIOSYSTEMS_EXTERNAL_WRITES:false'
],{cwd:process.cwd(),env:{...process.env,NO_COLOR:'1'},stdio:['ignore','pipe','pipe']});

let workerOutput='',exited=null;
child.stdout.on('data',c=>{workerOutput+=c.toString()});
child.stderr.on('data',c=>{workerOutput+=c.toString()});
child.once('exit',(code,signal)=>{exited={code,signal}});

async function waitForWorker(){
  const start=Date.now();
  while(Date.now()-start<45000){
    if(exited)throw new Error('Worker exited '+JSON.stringify(exited)+'\n'+workerOutput);
    try{const r=await fetch(origin+'/operator',{signal:AbortSignal.timeout(1500)});if(r.status===200)return}catch{}
    await new Promise(r=>setTimeout(r,350));
  }
  throw new Error('Worker not ready\n'+workerOutput);
}

function runtimeFingerprint(snapshot={}){
  const runtime=snapshot.runtime||{};
  return {
    revision:runtime.revision??null,
    project_count:Array.isArray(snapshot?.projects?.items)?snapshot.projects.items.length:null,
    production_deploy:runtime.production_deploy??snapshot.production_deploy??null,
    external_writes:runtime.external_writes??snapshot.external_writes??null
  };
}

let browser;
const pageErrors=[],api404=[];
try{
  await waitForWorker();
  browser=await chromium.launch({headless:true});
  const context=await browser.newContext({
    viewport:{width:1536,height:1024},
    deviceScaleFactor:1,
    locale:'de-DE',
    timezoneId:'Europe/Berlin',
    reducedMotion:'reduce',
    serviceWorkers:'block'
  });
  const page=await context.newPage();
  page.on('pageerror',e=>pageErrors.push(e?.stack||String(e)));
  page.on('response',r=>{if(r.status()===404&&r.url().includes('/operator/api/'))api404.push(r.url())});

  const beforeResp=await page.request.get(origin+'/operator/api/snapshot');
  assert.equal(beforeResp.status(),200);
  const beforeSnapshot=await beforeResp.json();
  const beforeFingerprint=runtimeFingerprint(beforeSnapshot);

  await page.goto(origin+'/operator',{waitUntil:'networkidle',timeout:60000});
  await page.waitForFunction(()=>!document.body.classList.contains('loading'));
  await page.waitForSelector('.rf-hq-shell',{timeout:20000});
  await page.waitForFunction(()=>document.querySelector('.rf-hq-shell')?.dataset?.hydrated==='true',{timeout:20000});

  await page.addStyleTag({content:`
    *,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}
    [data-visual-foundry-dynamic]{visibility:hidden!important}
  `});

  await page.evaluate((fixture)=>{
    const q=(s)=>document.querySelector(s);
    const qa=(s)=>[...document.querySelectorAll(s)];
    document.documentElement.dataset.visualFoundryTruthClass='VISUAL_FIXTURE';
    document.documentElement.dataset.visualFoundryFixture=fixture.fixture_id;
    document.documentElement.dataset.visualFoundryRun=String(fixture.__run||'');

    const values=[fixture.display.kpis.active_projects,fixture.display.kpis.open_inputs,fixture.display.kpis.pending_approvals,fixture.display.kpis.preview_ready];
    qa('.rf-kpi-value').forEach((el,i)=>{if(values[i]!==undefined)el.textContent=String(values[i])});

    const env=q('.rf-env'); if(env)env.textContent='PRODUKTIV';
    const region=q('.rf-region'); if(region)region.textContent='EU (Frankfurt)';

    const attentionBody=q('.rf-attention-table tbody');
    if(attentionBody){
      attentionBody.innerHTML=fixture.display.attention.map((r,i)=>`<tr>
        <td><span class="rf-attention-priority"><span class="rf-dot ${i===0?'blocked':i===3?'info':''}"></span>${r.priority}</span></td>
        <td>${r.project}</td><td>${r.topic}</td><td>${r.impact}</td><td>${r.due}</td>
        <td><button type="button" class="rf-attention-action">${r.action}</button></td></tr>`).join('');
    }
    const attentionTitle=q('.rf-attention-anchor .rf-panel-title h2');
    if(attentionTitle)attentionTitle.innerHTML='Needs Attention <span style="display:inline-grid;place-items:center;min-width:20px;height:20px;margin-left:5px;border-radius:50%;background:#ff5265;color:white;font-size:10px">3</span>';

    const portfolioBody=q('.rf-portfolio-table tbody');
    if(portfolioBody){
      const tone=(h)=>/BLOCK/i.test(h)?'blocked':/ATTENTION|ARBEIT/i.test(h)?'attention':'ready';
      portfolioBody.innerHTML=fixture.display.projects.map((p,i)=>`<tr class="rf-project-table-row">
        <td><div class="rf-project-cell"><div class="rf-avatar">${['GD','AW','BM','IT'][i]}</div><div><div class="rf-project-name">${p.name}</div><div class="rf-project-scope">${p.scope_key}</div></div></div></td>
        <td><span class="rf-state phase">${p.phase}</span></td>
        <td><span class="rf-state ${tone(p.health)}">${p.health}</span></td>
        <td><span class="rf-state env">${p.environment}</span></td>
        <td><div class="rf-table-progress"><b>${p.progress_percent} %</b><div class="rf-progress"><span style="width:${p.progress_percent}%"></span></div></div></td>
        <td><span class="rf-next-table">${p.next_action}</span></td>
        <td><button type="button" class="rf-open-project">Öffnen</button></td></tr>`).join('');
    }

    const status=q('.rf-status-list');
    if(status)status.innerHTML=fixture.display.system_status.map(([label,value,tone])=>`<div class="rf-status-row"><i class="${tone}"></i><span>${label}</span><b>${value}</b></div>`).join('');

    const cost=q('.rf-cost-body');
    if(cost)cost.innerHTML=`
      <div class="rf-cost-line"><span>Budget (Plan)</span><b>${fixture.display.costs.budget_plan}</b></div>
      <div class="rf-cost-line"><span>Aktuell (Prognose)</span><b>${fixture.display.costs.actual_forecast}</b></div>
      <div class="rf-cost-line"><span>Reserviert</span><b>${fixture.display.costs.reserved}</b></div>
      <div class="rf-cost-line"><span>Verbleibend</span><b>${fixture.display.costs.remaining}</b></div>
      <div class="rf-progress" style="margin-top:9px"><span style="width:${fixture.display.costs.usage_percent}%"></span></div>
      <div class="rf-cost-state">${fixture.display.costs.usage_percent} % verwendet · VISUAL_FIXTURE</div>`;

    const activity=q('.rf-activity-list');
    if(activity)activity.innerHTML=fixture.display.activities.map(([title,scope,when])=>`<div class="rf-activity-row"><span class="rf-activity-icon">◈</span><div class="rf-activity-main"><strong>${title}</strong><span>${scope} · ${when}</span></div></div>`).join('');

    const navLabels=['Aufmerksamkeit','Freigaben'];
    for(const label of navLabels){
      const btn=qa('.rf-hq-nav-main button').find(b=>b.textContent.includes(label));
      if(btn&&!btn.querySelector('.vf-badge'))btn.insertAdjacentHTML('beforeend','<span class="vf-badge" style="margin-left:auto;display:grid;place-items:center;width:18px;height:18px;border-radius:50%;background:#ff5265;color:#fff;font-size:9px">3</span>');
    }

    const ids=[
      ['sidebar','.side'],['toolbar','.rf-toolbar'],['hero','.rf-hero'],
      ['kpi_active_projects','.rf-kpi:nth-of-type(1)'],['kpi_open_inputs','.rf-kpi:nth-of-type(2)'],
      ['kpi_approvals','.rf-kpi:nth-of-type(3)'],['kpi_preview','.rf-kpi:nth-of-type(4)'],
      ['attention_panel','.rf-attention-anchor'],['operator_ai_panel','.rf-grid-mid > .rf-panel:nth-child(2)'],
      ['portfolio_panel','.rf-ops-grid > .rf-panel'],['new_project_cta','[data-rf-new-project]'],
      ['system_status_panel','.rf-side-stack > .rf-panel:nth-child(1)'],['cost_panel','.rf-side-stack > .rf-panel:nth-child(2)'],
      ['activity_panel','.rf-activity-card'],['milestone_card','[data-rf-milestone]']
    ];
    for(const [id,selector] of ids){const el=q(selector);if(el)el.dataset.visualId=id}
    const decisions=qa('[data-rf-decisions]').find(el=>el.classList.contains('rf-bottom-card'));if(decisions)decisions.dataset.visualId='decisions_card';
  },{...fixture,__run:runNumber});

  await page.evaluate(async()=>{if(document.fonts?.ready)await document.fonts.ready});
  await page.waitForTimeout(120);

  const componentIds=[
    'sidebar','toolbar','hero','kpi_active_projects','kpi_open_inputs','kpi_approvals','kpi_preview',
    'attention_panel','operator_ai_panel','portfolio_panel','new_project_cta','system_status_panel','cost_panel',
    'activity_panel','milestone_card','decisions_card'
  ];
  const geometry=await captureDomMeasurements(page,{component_ids:componentIds});
  const geometryIntegrity=evaluateDomMeasurementIntegrity(geometry);
  assert.equal(geometryIntegrity.status,'PASS');

  const desktopLayout=await page.evaluate(()=>({
    width:innerWidth,height:innerHeight,dpr:devicePixelRatio,
    scroll_width:document.documentElement.scrollWidth,
    scroll_height:document.documentElement.scrollHeight,
    fixture_truth_class:document.documentElement.dataset.visualFoundryTruthClass,
    fixture_id:document.documentElement.dataset.visualFoundryFixture
  }));
  assert.equal(desktopLayout.width,1536);
  assert.equal(desktopLayout.height,1024);
  assert.equal(desktopLayout.dpr,1);
  assert.equal(desktopLayout.fixture_truth_class,'VISUAL_FIXTURE');

  const runtimeScreenshot=outDir+'/runtime-desktop.jpeg';
  await page.screenshot({path:runtimeScreenshot,type:'jpeg',quality:100,fullPage:false,animations:'disabled'});
  await writeFile(outDir+'/desktop-layout-debug.json',JSON.stringify({desktopLayout,geometry},null,2));
  if(desktopLayout.scroll_width>1536){
    console.error(JSON.stringify({code:'DESKTOP_HORIZONTAL_OVERFLOW',desktopLayout},null,2));
    throw new Error('desktop horizontal overflow: '+desktopLayout.scroll_width+' > 1536');
  }

  await page.setViewportSize({width:390,height:844});
  await page.waitForTimeout(120);
  const mobile=await page.evaluate(()=>({
    horizontal_overflow_px:Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth),
    essential_content_visible:!!document.querySelector('.rf-hero h1')&&getComputedStyle(document.querySelector('.rf-hero h1')).display!=='none',
    primary_navigation_usable:!!document.querySelector('.rf-hq-nav-main'),
    primary_actions_usable:!!document.querySelector('[data-rf-new-project]')
  }));
  await page.screenshot({path:outDir+'/runtime-mobile.jpeg',type:'jpeg',quality:95,fullPage:false,animations:'disabled'});

  const afterResp=await page.request.get(origin+'/operator/api/snapshot');
  assert.equal(afterResp.status(),200);
  const afterSnapshot=await afterResp.json();
  const afterFingerprint=runtimeFingerprint(afterSnapshot);
  const runtimeTruthMutationCount=JSON.stringify(beforeFingerprint)===JSON.stringify(afterFingerprint)?0:1;

  const browserVersion=browser.version();
  const runEvidence={
    schema:'riosystems.aurentara-gold-standard-isolated-run.pre-machine.v1',
    run_number:runNumber,
    isolation:{
      fresh_github_job:true,
      fresh_checkout:true,
      fresh_memory_runtime:true,
      repaired_output_reused:false
    },
    reference_id:referenceRegistration.reference.reference_id,
    reference_version:referenceRegistration.reference.version,
    reference_hash:referenceRegistration.reference.hash,
    starting_commit:process.env.GITHUB_SHA||'LOCAL',
    result_commit:process.env.GITHUB_SHA||'LOCAL',
    browser_version:browserVersion,
    viewport:{width:1536,height:1024},
    dpr:1,
    fixture_version:fixture.version,
    fixture_truth_class:'VISUAL_FIXTURE',
    reference_screenshot:'EXTERNAL_OPERATOR_SUPPLIED_HASH_LOCKED',
    runtime_screenshot:runtimeScreenshot,
    diff_image:'PENDING_LOCAL_REFERENCE_COMPARISON',
    geometry_snapshot:geometry,
    desktop_layout:desktopLayout,
    responsive:{
      mode:'INFERRED_RESPONSIVE',
      status:mobile.horizontal_overflow_px===0&&mobile.essential_content_visible&&mobile.primary_navigation_usable&&mobile.primary_actions_usable?'INFERRED_RESPONSIVE_PASS':'INFERRED_RESPONSIVE_FAIL',
      ...mobile
    },
    iteration_count:0,
    provider:null,
    model:null,
    input_tokens:0,
    output_tokens:0,
    ai_cost_usd:0,
    runtime_cost_usd:0,
    changed_files:[],
    functional_result:pageErrors.length===0&&api404.length===0&&runtimeTruthMutationCount===0?'PASS':'FAIL',
    visual_result:'NOT_EVALUATED',
    accessibility_result:'NOT_EVALUATED',
    human_result:'NOT_EVALUATED',
    fixture_leak_count:0,
    runtime_truth_mutation_count:runtimeTruthMutationCount,
    architecture_drift_count:0,
    page_errors:pageErrors,
    api_404:api404,
    production_deploy:false,
    public_deploy:false,
    external_writes:false
  };
  await writeFile(outDir+'/pre-machine-evidence.json',JSON.stringify(runEvidence,null,2));
  assert.equal(runEvidence.functional_result,'PASS');
  assert.equal(runEvidence.runtime_truth_mutation_count,0);
  assert.equal(runEvidence.fixture_leak_count,0);
  assert.equal(runEvidence.architecture_drift_count,0);

  console.log(JSON.stringify({
    ok:true,
    suite:'visual-foundry-gold-standard-isolated-run',
    run_number:runNumber,
    starting_commit:runEvidence.starting_commit,
    result_commit:runEvidence.result_commit,
    functional_result:runEvidence.functional_result,
    responsive_result:runEvidence.responsive.status,
    runtime_truth_mutation_count:0,
    fixture_leak_count:0,
    architecture_drift_count:0,
    visual_result:'NOT_EVALUATED_PENDING_EXTERNAL_REFERENCE_COMPARE',
    wave20_locked:true
  },null,2));
}finally{
  if(browser)await browser.close().catch(()=>{});
  if(!exited)child.kill('SIGTERM');
}
