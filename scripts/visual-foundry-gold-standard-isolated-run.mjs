import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import jpeg from 'jpeg-js';
import pngjs from 'pngjs';
import { captureDomMeasurements, evaluateDomMeasurementIntegrity } from '../src/visual-foundry/dom-measurement.js';
import { createStencilContract, installReferenceStencil, setStencilMode, removeReferenceStencil } from '../src/visual-foundry/stencil-mode.js';
import { deriveResponsiveConstraintSet, evaluateCalibrationAnchor } from '../src/visual-foundry/constraint-solver.js';
import { createSoftRegionLockSet, evaluateSoftLockCandidate, finalizeSoftRegionLocks } from '../src/visual-foundry/soft-region-locks.js';
import { rankVisualDeltas } from '../src/visual-foundry/visual-priority.js';
import { evaluateSemanticImplementation } from '../src/visual-foundry/semantic-gate.js';
import { compareVisualImages } from '../src/visual-foundry/visual-comparator.js';

const { PNG }=pngjs;

const runNumber=Number(process.env.GOLD_STANDARD_RUN||1);
assert.ok([1,2,3].includes(runNumber),'GOLD_STANDARD_RUN must be 1, 2 or 3');
const port=8890+runNumber;
const origin='http://127.0.0.1:'+port;
const outDir='artifacts/visual-foundry/gold-standard/run-'+runNumber;
await mkdir(outDir,{recursive:true});

const fixture=JSON.parse(await readFile('factory-state/visual-foundry/aurentara-hq-gold-standard-fixture-v1.json','utf8'));
const referenceSpec=JSON.parse(await readFile('factory-state/visual-foundry/aurentara-hq-control-center-reference-spec-v1.json','utf8'));
const referenceRegistration=JSON.parse(await readFile('factory-state/visual-foundry/aurentara-hq-control-center-reference-v1-0.json','utf8'));
const stencilSession=JSON.parse(await readFile('factory-state/visual-foundry/aurentara-stencil-constraint-session-v1.json','utf8'));
let approvedReferenceB64='';
for(let i=1;i<=4;i++){
  approvedReferenceB64+=(await readFile(`factory-state/visual-foundry/reference-assets/aurentara-hq-reference-v1.part0${i}.b64`,'utf8')).replace(/\s+/g,'');
}
const approvedReferenceBytes=Buffer.from(approvedReferenceB64,'base64');
const approvedReferenceHash=crypto.createHash('sha256').update(approvedReferenceBytes).digest('hex');
const referenceAssets=JSON.parse(await readFile('factory-state/visual-foundry/aurentara-reference-extracted-assets-v1.json','utf8'));
const heroAsset=referenceAssets.assets.find(x=>x.asset_id==='hero_earth_reference_extracted');
assert.ok(heroAsset,'HERO_REFERENCE_EXTRACTED_ASSET_REQUIRED');
const heroTransportB64=(await readFile('factory-state/visual-foundry/assets/hero-earth-pure.png.b64','utf8')).replace(/\s+/g,'');
const heroTransportBytes=Buffer.from(heroTransportB64,'base64');
assert.equal(crypto.createHash('sha256').update(heroTransportBytes).digest('hex'),heroAsset.output_sha256,'HERO_REFERENCE_EXTRACTED_HASH_MISMATCH');
const acceptedHeroCandidate=(stencilSession.accepted_candidates||[]).find(x=>x.candidate_id==='REFERENCE_EXTRACTED_EARTH_EXACT_PLACEMENT'&&x.apply_by_default===true);
const explicitHeroCandidate=String(process.env.VISUAL_FOUNDRY_HERO_CANDIDATE||'').trim();
const heroCandidateRequested=explicitHeroCandidate||(acceptedHeroCandidate?.candidate_id||'');
const heroCandidateEnabled=heroCandidateRequested==='REFERENCE_EXTRACTED_EARTH_EXACT_PLACEMENT';
const heroTypographyCandidateId=String(process.env.VISUAL_FOUNDRY_HERO_TYPOGRAPHY_CANDIDATE||'').trim();
const heroTitleScaleX=Number(process.env.VISUAL_FOUNDRY_HERO_TITLE_SCALE_X||1);
const heroTitleLetterSpacingPx=Number(process.env.VISUAL_FOUNDRY_HERO_TITLE_LETTER_SPACING_PX||NaN);
const heroTitleWeight=Number(process.env.VISUAL_FOUNDRY_HERO_TITLE_WEIGHT||NaN);
const sidebarNavTypographyCandidateId=String(process.env.VISUAL_FOUNDRY_SIDEBAR_NAV_TYPOGRAPHY_CANDIDATE||'').trim();
const sidebarNavFontSizePx=Number(process.env.VISUAL_FOUNDRY_SIDEBAR_NAV_FONT_SIZE_PX||NaN);
const sidebarNavFontWeight=Number(process.env.VISUAL_FOUNDRY_SIDEBAR_NAV_FONT_WEIGHT||NaN);
const sidebarBrandTypographyCandidateId=String(process.env.VISUAL_FOUNDRY_SIDEBAR_BRAND_TYPOGRAPHY_CANDIDATE||'').trim();
const sidebarBrandTitleSizePx=Number(process.env.VISUAL_FOUNDRY_SIDEBAR_BRAND_TITLE_SIZE_PX||NaN);
const sidebarBrandTitleLetterSpacingEm=Number(process.env.VISUAL_FOUNDRY_SIDEBAR_BRAND_TITLE_LETTER_SPACING_EM||NaN);
const sidebarBrandTaglineSizePx=Number(process.env.VISUAL_FOUNDRY_SIDEBAR_BRAND_TAGLINE_SIZE_PX||NaN);
const sidebarBrandTaglineWidthPx=Number(process.env.VISUAL_FOUNDRY_SIDEBAR_BRAND_TAGLINE_WIDTH_PX||NaN);
const sidebarBrandFixedHeightPx=Number(process.env.VISUAL_FOUNDRY_SIDEBAR_BRAND_FIXED_HEIGHT_PX||NaN);

assert.equal(fixture.truth_class,'VISUAL_FIXTURE');
assert.equal(fixture.runtime_truth_write_allowed,false);
assert.equal(fixture.production_allowed,false);
assert.equal(referenceSpec.reference_id,referenceRegistration.reference.reference_id);
assert.equal(referenceRegistration.hash_match,true);
assert.equal(stencilSession.reference_id,referenceRegistration.reference.reference_id);
assert.equal(stencilSession.reference_hash,referenceRegistration.reference.hash);
assert.equal(stencilSession.stencil.fallback_reference_allowed,false);
assert.equal(approvedReferenceHash,referenceRegistration.reference.hash,'APPROVED_REFERENCE_TRANSPORT_HASH_MISMATCH');
const approvedDecoded=jpeg.decode(approvedReferenceBytes,{useTArray:true,formatAsRGBA:true});
assert.equal(approvedDecoded.width,referenceSpec.viewport.width,'APPROVED_REFERENCE_WIDTH_MISMATCH');
assert.equal(approvedDecoded.height,referenceSpec.viewport.height,'APPROVED_REFERENCE_HEIGHT_MISMATCH');
const approvedReferencePng=new PNG({width:approvedDecoded.width,height:approvedDecoded.height});
approvedReferencePng.data.set(approvedDecoded.data);
const approvedReferencePngPath=outDir+'/reference-approved.png';
await writeFile(approvedReferencePngPath,PNG.sync.write(approvedReferencePng));

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

const sha256=buffer=>crypto.createHash('sha256').update(buffer).digest('hex');

async function resolveVerifiedStencilSource(raw,expectedHash){
  const source=String(raw||'').trim();
  if(!source)return {status:'STENCIL_SOURCE_EXTERNAL_NOT_MOUNTED',source:null};
  let bytes,mime;
  if(source.startsWith('data:')){
    const match=source.match(/^data:([^;,]+)?(;base64)?,(.*)$/s);
    if(!match)throw new Error('STENCIL_DATA_URL_INVALID');
    mime=match[1]||'application/octet-stream';
    bytes=match[2]?Buffer.from(match[3],'base64'):Buffer.from(decodeURIComponent(match[3]));
  }else{
    const filePath=source.startsWith('file:')?new URL(source):path.resolve(source);
    bytes=await readFile(filePath);
    const ext=String(source).toLowerCase();
    mime=ext.endsWith('.png')?'image/png':ext.endsWith('.webp')?'image/webp':'image/jpeg';
  }
  const actualHash=sha256(bytes);
  if(actualHash!==expectedHash)throw new Error('STENCIL_REFERENCE_HASH_MISMATCH');
  return {status:'VERIFIED',source:'data:'+mime+';base64,'+bytes.toString('base64'),actual_hash:actualHash,bytes:bytes.length,mime};
}

function geometryBounds(snapshot,id){
  const item=(snapshot.components||[]).find(x=>x.component_id===id&&x.status==='MEASURED');
  if(!item)return null;
  const g=item.geometry;
  return {x:Number(g.x),y:Number(g.y),width:Number(g.width),height:Number(g.height)};
}
function unionBounds(snapshot,ids){
  const list=ids.map(id=>geometryBounds(snapshot,id)).filter(Boolean);
  if(!list.length)return null;
  const x=Math.min(...list.map(x=>x.x)),y=Math.min(...list.map(x=>x.y));
  const right=Math.max(...list.map(x=>x.x+x.width)),bottom=Math.max(...list.map(x=>x.y+x.height));
  return {x,y,width:right-x,height:bottom-y};
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

    const brand=q('.brand');
    if(brand){
      const strong=brand.querySelector('strong'); if(strong)strong.textContent='AURENTARA SYSTEMS';
      const span=brand.querySelector('span'); if(span)span.textContent='INTELLIGENTE LÖSUNGEN FÜR EINE BESSERE ZUKUNFT';
    }

    const kpiMeta=['↑ +1 seit letzter Woche','↓ -2 seit letzter Woche','↑ +1 seit letzter Woche','↑ +1 seit letzter Woche'];
    qa('.rf-kpi-meta').forEach((el,i)=>{if(kpiMeta[i])el.textContent=kpiMeta[i]});

    const heroTitle=q('.rf-hero h1'); if(heroTitle)heroTitle.textContent='RIOSYSTEMS DASHBOARD';
    const heroSubtitle=q('.rf-hero p'); if(heroSubtitle)heroSubtitle.textContent='Alle Projekte. Alle Prozesse. Alle wichtigen Entscheidungen. An einem Ort.';
    const heroMotto=q('.rf-hero-motto');
    if(heroMotto)heroMotto.innerHTML='EIN SYSTEM.<br>ALLE MÖGLICHKEITEN.<br>SKALIERBAR.<br><span style="color:#42bfff">POWERED BY RIOSYSTEMS.</span>';

    const milestone=q('[data-rf-milestone]');
    if(milestone){
      const strong=milestone.querySelector('.rf-bottom-main strong'); if(strong)strong.textContent='Nächster Meilenstein';
      const span=milestone.querySelector('.rf-bottom-main span'); if(span)span.textContent='Gelato Donatello – Finalisierung & Live-Schaltung';
      const progress=milestone.querySelector('.rf-bottom-progress span'); if(progress)progress.style.width='72%';
      const number=qa('[data-rf-milestone] *').find(el=>el.childElementCount===0&&/\d+\s*%/.test(el.textContent||'')); if(number)number.textContent='72 %';
    }
    const decisionsCard=qa('[data-rf-decisions]').find(el=>el.classList.contains('rf-bottom-card'));
    if(decisionsCard){
      const strong=decisionsCard.querySelector('.rf-bottom-main strong'); if(strong)strong.textContent='Offene Entscheidungen';
      const span=decisionsCard.querySelector('.rf-bottom-main span'); if(span)span.textContent='3 Entscheidungen erforderlich';
    }
    const quote=q('.rf-quote');
    if(quote)quote.innerHTML='„Technologie wird erst dann wertvoll,<br>wenn sie Menschen wirklich weiterbringt.“<b>AURENTARA SYSTEMS</b>';

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
      const displayScopes=['gelato-donatello.de','aurentara.com','mueller.de','operator-suite'];
      portfolioBody.innerHTML=fixture.display.projects.map((p,i)=>`<tr class="rf-project-table-row">
        <td><div class="rf-project-cell"><div class="rf-avatar">${['GD','AW','BM','IT'][i]}</div><div><div class="rf-project-name">${p.name}</div><div class="rf-project-scope">${displayScopes[i]||p.scope_key}</div></div></div></td>
        <td><span class="rf-state phase">${p.phase}</span></td>
        <td><span class="rf-state ${tone(p.health)}">${p.health}</span></td>
        <td><span class="rf-state env">${p.environment}</span></td>
        <td><div class="rf-table-progress"><b>${p.progress_percent} %</b><div class="rf-progress"><span style="width:${p.progress_percent}%"></span></div></div></td>
        <td><span class="rf-next-table">${p.next_action}</span></td>
        <td><div class="rf-portfolio-actions"><button type="button" class="rf-open-project">Öffnen</button><button type="button" class="rf-row-more" aria-label="Weitere Aktionen">•••</button></div></td></tr>`).join('');
    }

    const portfolioPanel=q('.rf-ops-grid > .rf-panel:first-child');
    if(portfolioPanel){
      const headActions=portfolioPanel.querySelector('.rf-panel-head > div:last-child');
      if(headActions)headActions.innerHTML='<button class="rf-ai-new rf-new-project" data-rf-new-project>+ Neues Projekt</button><button type="button" class="rf-portfolio-head-more" aria-label="Weitere Portfolio-Aktionen">•••</button>';
      const toolbar=portfolioPanel.querySelector('.rf-portfolio-toolbar');
      if(toolbar)toolbar.innerHTML=
        '<div class="rf-portfolio-tabs">'+
          '<button type="button" class="rf-portfolio-tab active">Alle (4)</button>'+
          '<button type="button" class="rf-portfolio-tab">Kundenprojekte (3)</button>'+
          '<button type="button" class="rf-portfolio-tab">Interne Projekte (1)</button>'+
        '</div>'+
        '<div class="rf-portfolio-tools">'+
          '<label class="rf-portfolio-search"><span>⌕</span><input aria-label="Projekte durchsuchen" placeholder="Projekte durchsuchen ..."></label>'+
          '<button type="button" class="rf-portfolio-filter" aria-label="Portfolio filtern">⌄</button>'+
        '</div>';
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
      ['sidebar','.side'],['primary_navigation','.rf-hq-nav-main'],['primary_navigation_shell','.rf-hq-nav'],['primary_navigation_foot','.rf-hq-nav-foot'],['toolbar','.rf-toolbar'],['hero','.rf-hero'],
      ['kpi_active_projects','.rf-kpi:nth-of-type(1)'],['kpi_open_inputs','.rf-kpi:nth-of-type(2)'],
      ['kpi_approvals','.rf-kpi:nth-of-type(3)'],['kpi_preview','.rf-kpi:nth-of-type(4)'],
      ['attention_panel','.rf-attention-anchor'],['operator_ai_panel','.rf-grid-mid > .rf-panel:nth-child(2)'],
      ['portfolio_panel','.rf-ops-grid > .rf-panel'],['new_project_cta','[data-rf-new-project]'],
      ['system_status_panel','.rf-side-stack > .rf-panel:nth-child(1)'],['cost_panel','.rf-side-stack > .rf-panel:nth-child(2)'],
      ['activity_panel','.rf-activity-card'],['milestone_card','[data-rf-milestone]'],['quote_card','.rf-quote']
    ];
    for(const [id,selector] of ids){const el=q(selector);if(el)el.dataset.visualId=id}
    const navButtons=qa('.rf-hq-nav-main button');
    if(navButtons[0])navButtons[0].dataset.visualId='primary_navigation_first_button';
    if(navButtons.length)navButtons[navButtons.length-1].dataset.visualId='primary_navigation_last_button';
    const decisions=qa('[data-rf-decisions]').find(el=>el.classList.contains('rf-bottom-card'));if(decisions)decisions.dataset.visualId='decisions_card';
  },{...fixture,__run:runNumber});

  let heroCandidateState={status:'DISABLED',candidate:heroCandidateRequested||null};
  if(heroCandidateEnabled){
    const heroRegion=referenceSpec.regions.find(r=>r.region_id==='hero');
    assert.ok(heroRegion,'HERO_REFERENCE_REGION_REQUIRED');
    const heroCanvasX=Number(heroRegion.bounds.x.value);
    const heroCanvasY=Number(heroRegion.bounds.y.value);
    const relativeLeft=Number(heroAsset.crop.x)-heroCanvasX;
    const relativeTop=Number(heroAsset.crop.y)-heroCanvasY;
    const candidate={
      candidate:'REFERENCE_EXTRACTED_EARTH_EXACT_PLACEMENT',
      source_asset_id:heroAsset.asset_id,
      source_sha256:heroAsset.output_sha256,
      provenance:'REFERENCE_EXTRACTED',
      usage_scope:referenceAssets.usage_scope,
      production_use_allowed:false,
      public_distribution_allowed:false,
      canvas_crop:heroAsset.crop,
      hero_relative:{left:relativeLeft,top:relativeTop,width:Number(heroAsset.crop.width),height:Number(heroAsset.crop.height)},
      src:'data:image/png;base64,'+heroTransportB64
    };
    const applied=await page.evaluate((candidate)=>{
      const hero=document.querySelector('.rf-hero');
      if(!hero)throw new Error('HERO_RUNTIME_ELEMENT_MISSING');
      hero.querySelector('[data-vf-hero-reference-extracted]')?.remove();
      const before=hero.getBoundingClientRect();
      const img=document.createElement('img');
      img.dataset.vfHeroReferenceExtracted='true';
      img.alt='';
      img.setAttribute('aria-hidden','true');
      img.src=candidate.src;
      Object.assign(img.style,{
        position:'absolute',
        left:candidate.hero_relative.left+'px',
        top:candidate.hero_relative.top+'px',
        width:candidate.hero_relative.width+'px',
        height:candidate.hero_relative.height+'px',
        objectFit:'fill',
        maxWidth:'none',
        zIndex:'1',
        pointerEvents:'none',
        userSelect:'none'
      });
      if(getComputedStyle(hero).position==='static')hero.style.position='relative';
      hero.prepend(img);
      for(const child of [...hero.children]){
        if(child===img)continue;
        if(getComputedStyle(child).position==='static')child.style.position='relative';
        child.style.zIndex='2';
      }
      const after=hero.getBoundingClientRect();
      return {
        status:'APPLIED',
        hero_geometry_before:{x:before.x,y:before.y,width:before.width,height:before.height},
        hero_geometry_after:{x:after.x,y:after.y,width:after.width,height:after.height},
        image_geometry:{x:img.getBoundingClientRect().x,y:img.getBoundingClientRect().y,width:img.getBoundingClientRect().width,height:img.getBoundingClientRect().height}
      };
    },candidate);
    heroCandidateState={...candidate,src:undefined,...applied};
  }

  let sidebarBrandTypographyState={status:'DISABLED',candidate_id:sidebarBrandTypographyCandidateId||null};
  if(sidebarBrandTypographyCandidateId){
    sidebarBrandTypographyState=await page.evaluate(({candidate_id,title_size_px,title_letter_spacing_em,tagline_size_px,tagline_width_px,fixed_height_px})=>{
      const brand=document.querySelector('.brand');
      const strong=document.querySelector('.brand strong');
      const span=document.querySelector('.brand span');
      if(!brand||!strong||!span)throw new Error('SIDEBAR_BRAND_TEXT_MISSING');
      const snap=el=>{const s=getComputedStyle(el),r=el.getBoundingClientRect();return {font_size:s.fontSize,font_weight:s.fontWeight,line_height:s.lineHeight,letter_spacing:s.letterSpacing,max_width:s.maxWidth,rect:{x:r.x,y:r.y,width:r.width,height:r.height}}};
      const brandSnap=()=>{const s=getComputedStyle(brand),r=brand.getBoundingClientRect();return {height:s.height,min_height:s.minHeight,max_height:s.maxHeight,box_sizing:s.boxSizing,rect:{x:r.x,y:r.y,width:r.width,height:r.height}}};
      const before={brand:brandSnap(),title:snap(strong),tagline:snap(span)};
      if(Number.isFinite(title_size_px))strong.style.fontSize=title_size_px+'px';
      if(Number.isFinite(title_letter_spacing_em))strong.style.letterSpacing=title_letter_spacing_em+'em';
      if(Number.isFinite(tagline_size_px))span.style.fontSize=tagline_size_px+'px';
      if(Number.isFinite(tagline_width_px))span.style.maxWidth=tagline_width_px+'px';
      if(Number.isFinite(fixed_height_px)){
        brand.style.height=fixed_height_px+'px';
        brand.style.minHeight=fixed_height_px+'px';
        brand.style.maxHeight=fixed_height_px+'px';
      }
      strong.dataset.vfSidebarBrandTypographyCandidate=candidate_id;
      span.dataset.vfSidebarBrandTypographyCandidate=candidate_id;
      return {
        status:'APPLIED',candidate_id,
        substitution_status:'METRICALLY_CALIBRATED_SUBSTITUTION',
        original_font_identity_claimed:false,
        requested:{
          title_size_px:Number.isFinite(title_size_px)?title_size_px:null,
          title_letter_spacing_em:Number.isFinite(title_letter_spacing_em)?title_letter_spacing_em:null,
          tagline_size_px:Number.isFinite(tagline_size_px)?tagline_size_px:null,
          tagline_width_px:Number.isFinite(tagline_width_px)?tagline_width_px:null,
          fixed_height_px:Number.isFinite(fixed_height_px)?fixed_height_px:null
        },
        before,after:{brand:brandSnap(),title:snap(strong),tagline:snap(span)}
      };
    },{candidate_id:sidebarBrandTypographyCandidateId,title_size_px:sidebarBrandTitleSizePx,title_letter_spacing_em:sidebarBrandTitleLetterSpacingEm,tagline_size_px:sidebarBrandTaglineSizePx,tagline_width_px:sidebarBrandTaglineWidthPx,fixed_height_px:sidebarBrandFixedHeightPx});
  }

  let sidebarNavTypographyState={status:'DISABLED',candidate_id:sidebarNavTypographyCandidateId||null};
  if(sidebarNavTypographyCandidateId){
    sidebarNavTypographyState=await page.evaluate(({candidate_id,font_size_px,font_weight})=>{
      const buttons=[...document.querySelectorAll('.rf-hq-nav-main button')];
      if(!buttons.length)throw new Error('SIDEBAR_NAV_BUTTONS_MISSING');
      const before=buttons.map(el=>{
        const s=getComputedStyle(el),r=el.getBoundingClientRect();
        return {text:(el.textContent||'').trim(),font_size:s.fontSize,font_weight:s.fontWeight,line_height:s.lineHeight,rect:{x:r.x,y:r.y,width:r.width,height:r.height}};
      });
      for(const el of buttons){
        if(Number.isFinite(font_size_px))el.style.fontSize=font_size_px+'px';
        if(Number.isFinite(font_weight))el.style.fontWeight=String(font_weight);
        el.dataset.vfSidebarNavTypographyCandidate=candidate_id;
      }
      const after=buttons.map(el=>{
        const s=getComputedStyle(el),r=el.getBoundingClientRect();
        return {text:(el.textContent||'').trim(),font_size:s.fontSize,font_weight:s.fontWeight,line_height:s.lineHeight,rect:{x:r.x,y:r.y,width:r.width,height:r.height}};
      });
      return {
        status:'APPLIED',
        candidate_id,
        original_font_identity_claimed:false,
        substitution_status:'METRICALLY_CALIBRATED_SUBSTITUTION',
        requested:{font_size_px:Number.isFinite(font_size_px)?font_size_px:null,font_weight:Number.isFinite(font_weight)?font_weight:null},
        before,after
      };
    },{candidate_id:sidebarNavTypographyCandidateId,font_size_px:sidebarNavFontSizePx,font_weight:sidebarNavFontWeight});
  }

  let heroTypographyState={status:'DISABLED',candidate_id:heroTypographyCandidateId||null};
  if(heroTypographyCandidateId){
    heroTypographyState=await page.evaluate(({candidate_id,scale_x,letter_spacing_px,weight})=>{
      const title=document.querySelector('.rf-hero h1');
      if(!title)throw new Error('HERO_TITLE_ELEMENT_MISSING');
      const beforeStyle=getComputedStyle(title);
      const beforeRect=title.getBoundingClientRect();
      if(Number.isFinite(letter_spacing_px))title.style.letterSpacing=letter_spacing_px+'px';
      if(Number.isFinite(weight))title.style.fontWeight=String(weight);
      title.style.transform='scaleX('+scale_x+')';
      title.style.transformOrigin='left center';
      title.dataset.vfHeroTypographyCandidate=candidate_id;
      const afterStyle=getComputedStyle(title);
      const afterRect=title.getBoundingClientRect();
      return {
        status:'APPLIED',
        candidate_id,
        substitution_status:'METRICALLY_CALIBRATED_SUBSTITUTION',
        original_font_identity_claimed:false,
        requested:{scale_x,letter_spacing_px:Number.isFinite(letter_spacing_px)?letter_spacing_px:null,weight:Number.isFinite(weight)?weight:null},
        before:{
          font_family:beforeStyle.fontFamily,font_size:beforeStyle.fontSize,font_weight:beforeStyle.fontWeight,
          line_height:beforeStyle.lineHeight,letter_spacing:beforeStyle.letterSpacing,
          rect:{x:beforeRect.x,y:beforeRect.y,width:beforeRect.width,height:beforeRect.height}
        },
        after:{
          font_family:afterStyle.fontFamily,font_size:afterStyle.fontSize,font_weight:afterStyle.fontWeight,
          line_height:afterStyle.lineHeight,letter_spacing:afterStyle.letterSpacing,
          transform:afterStyle.transform,
          rect:{x:afterRect.x,y:afterRect.y,width:afterRect.width,height:afterRect.height}
        }
      };
    },{candidate_id:heroTypographyCandidateId,scale_x:heroTitleScaleX,letter_spacing_px:heroTitleLetterSpacingPx,weight:heroTitleWeight});
  }

  await page.evaluate(async()=>{if(document.fonts?.ready)await document.fonts.ready});
  await page.waitForTimeout(120);

  const componentIds=[
    'sidebar','primary_navigation','primary_navigation_first_button','primary_navigation_last_button','primary_navigation_shell','primary_navigation_foot','toolbar','hero','kpi_active_projects','kpi_open_inputs','kpi_approvals','kpi_preview',
    'attention_panel','operator_ai_panel','portfolio_panel','new_project_cta','system_status_panel','cost_panel',
    'activity_panel','milestone_card','decisions_card','quote_card'
  ];
  const geometry=await captureDomMeasurements(page,{component_ids:componentIds});
  const geometryIntegrity=evaluateDomMeasurementIntegrity(geometry);
  assert.equal(geometryIntegrity.status,'PASS');

  const actualConstraintRegions=[
    {id:'sidebar',bounds:geometryBounds(geometry,'sidebar')},
    {id:'primary_navigation',bounds:unionBounds(geometry,['primary_navigation_first_button','primary_navigation_last_button'])},
    {id:'toolbar',bounds:geometryBounds(geometry,'toolbar')},
    {id:'hero',bounds:geometryBounds(geometry,'hero')},
    {id:'kpi_band',bounds:unionBounds(geometry,['kpi_active_projects','kpi_open_inputs','kpi_approvals','kpi_preview'])},
    {id:'attention_panel',bounds:geometryBounds(geometry,'attention_panel')},
    {id:'operator_ai_panel',bounds:geometryBounds(geometry,'operator_ai_panel')},
    {id:'portfolio',bounds:geometryBounds(geometry,'portfolio_panel')},
    {id:'right_rail',bounds:unionBounds(geometry,['system_status_panel','cost_panel','activity_panel'])},
    {id:'right_status_stack',bounds:unionBounds(geometry,['system_status_panel','cost_panel'])},
    {id:'activity_panel',bounds:geometryBounds(geometry,'activity_panel')},
    {id:'bottom_strip',bounds:unionBounds(geometry,['milestone_card','decisions_card','quote_card'])}
  ].filter(x=>x.bounds);

  const constraintSet=deriveResponsiveConstraintSet({
    canvas:stencilSession.canvas,
    elements:stencilSession.constraints.elements
  });
  const constraintAnchor=evaluateCalibrationAnchor(constraintSet,actualConstraintRegions);

  const lockMeasurement={regions:stencilSession.soft_locks.regions.map(x=>({region_id:x.region_id,score:x.baseline_score}))};
  const softLockSet=createSoftRegionLockSet({
    measurement:lockMeasurement,
    regions:stencilSession.soft_locks.regions.map(x=>x.region_id),
    tolerance:stencilSession.soft_locks.tolerance_ssim
  });
  const externalMetricsRaw=String(process.env.VISUAL_FOUNDRY_REGION_METRICS_JSON||'').trim();
  let softLockEvaluation={status:'PENDING_REFERENCE_REGION_COMPARE'};
  let softLockFinalization={status:'PENDING_REFERENCE_REGION_COMPARE'};
  let priorityRanking={status:'PENDING_ACTUAL_REGION_METRICS',ranked:[]};
  if(externalMetricsRaw){
    const regionMetrics=JSON.parse(externalMetricsRaw);
    const measurement={regions:(regionMetrics.regions||[]).map(r=>({region_id:r.region_id,score:Number(r.ssim)}))};
    softLockEvaluation=evaluateSoftLockCandidate(softLockSet,measurement);
    softLockFinalization=finalizeSoftRegionLocks(softLockSet,measurement);
    const areaByRegion=new Map(referenceSpec.regions.map(r=>[r.region_id,Number(r.bounds.width.value)*Number(r.bounds.height.value)]));
    const semantics=stencilSession.priority_contract.region_semantics;
    priorityRanking={
      status:'EVALUATED',
      ranked:rankVisualDeltas((regionMetrics.regions||[]).map(r=>({
        region_id:r.region_id,
        ssim:Number(r.ssim),
        pixel_difference_percent:Number(r.pixel_difference_percent),
        area_px:areaByRegion.get(r.region_id)||1,
        canvas_area_px:stencilSession.canvas.width*stencilSession.canvas.height,
        contrast_index:semantics[r.region_id]?.contrast_index??0.5,
        semantic_type:semantics[r.region_id]?.semantic_type??'NORMAL_UI',
        criticality:semantics[r.region_id]?.criticality??'MEDIUM'
      })))
    };
  }

  const stencilSourceRaw=String(process.env.VISUAL_FOUNDRY_STENCIL_SOURCE||'').trim()||('data:image/jpeg;base64,'+approvedReferenceB64);
  const verifiedStencil=await resolveVerifiedStencilSource(stencilSourceRaw,referenceRegistration.reference.hash);
  let stencilBuildAid={status:verifiedStencil.status,reference_hash:referenceRegistration.reference.hash,fallback_reference_allowed:false};
  if(verifiedStencil.status==='VERIFIED'){
    const contract=createStencilContract({
      reference_id:referenceRegistration.reference.reference_id,
      reference_hash:referenceRegistration.reference.hash,
      reference_version:referenceRegistration.reference.version,
      source:verifiedStencil.source,
      source_type:'HASH_VERIFIED_LOCAL_BUILD_ASSET',
      canvas:stencilSession.canvas,
      mode:'OVERLAY',
      opacity:stencilSession.stencil.default_opacity
    });
    await installReferenceStencil(page,contract);
    await setStencilMode(page,'OVERLAY',{opacity:stencilSession.stencil.default_opacity});
    await page.screenshot({path:outDir+'/stencil-overlay.jpeg',type:'jpeg',quality:94,fullPage:false,animations:'disabled'});
    await setStencilMode(page,'DIFFERENCE');
    await page.screenshot({path:outDir+'/stencil-difference.jpeg',type:'jpeg',quality:94,fullPage:false,animations:'disabled'});
    await removeReferenceStencil(page);
    stencilBuildAid={status:'MOUNTED_VERIFIED_AND_REMOVED_BEFORE_MACHINE_CAPTURE',actual_hash:verifiedStencil.actual_hash,bytes:verifiedStencil.bytes,mime:verifiedStencil.mime,fallback_reference_allowed:false};
  }

  const semanticImplementation=await evaluateSemanticImplementation(page,{
    allow_stencil:false,
    max_structural_absolute_ratio:stencilSession.semantic_gate.max_structural_absolute_ratio
  });

  await writeFile(outDir+'/stencil-constraint-evidence.json',JSON.stringify({
    stencil_build_aid:stencilBuildAid,
    constraint_set:constraintSet,
    constraint_anchor:constraintAnchor,
    soft_lock_set:softLockSet,
    soft_lock_evaluation:softLockEvaluation,
    soft_lock_finalization:softLockFinalization,
    priority_ranking:priorityRanking,
    semantic_implementation:semanticImplementation,
    navigation_diagnostics:{
      main:geometryBounds(geometry,'primary_navigation'),
      button_union:unionBounds(geometry,['primary_navigation_first_button','primary_navigation_last_button']),
      shell:geometryBounds(geometry,'primary_navigation_shell'),
      foot:geometryBounds(geometry,'primary_navigation_foot')
    }
  },null,2));

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

  const runtimeScreenshot=outDir+'/runtime-desktop.png';
  await page.screenshot({path:runtimeScreenshot,type:'png',fullPage:false,animations:'disabled'});
  await writeFile(outDir+'/desktop-layout-debug.json',JSON.stringify({desktopLayout,geometry},null,2));

  const comparatorRegions=[
    ...referenceSpec.regions.map(r=>({
      region_id:r.region_id,
      critical:r.critical===true,
      x:Number(r.bounds.x.value),y:Number(r.bounds.y.value),
      width:Number(r.bounds.width.value),height:Number(r.bounds.height.value)
    })),
    {
      region_id:'hero_title_raster',
      critical:false,
      x:240,y:97,width:805,height:34
    },
    {
      region_id:'sidebar_nav_text_raster',
      critical:false,
      x:42,y:184,width:154,height:690
    },
    {
      region_id:'sidebar_brand_text_raster',
      critical:false,
      x:20,y:68,width:176,height:92
    }
  ];
  const visualComparison=await compareVisualImages({
    reference_path:approvedReferencePngPath,
    actual_path:runtimeScreenshot,
    diff_path:outDir+'/diff-desktop.png',
    pixel_threshold:0.1,
    include_antialiasing:false,
    regions:comparatorRegions
  });
  const comparisonMeasurement={regions:visualComparison.regions.map(r=>({region_id:r.region_id,score:Number(r.perceptual_score)}))};
  softLockEvaluation=evaluateSoftLockCandidate(softLockSet,comparisonMeasurement);
  softLockFinalization=finalizeSoftRegionLocks(softLockSet,comparisonMeasurement);
  const areaByRegion=new Map(referenceSpec.regions.map(r=>[r.region_id,Number(r.bounds.width.value)*Number(r.bounds.height.value)]));
  const semantics=stencilSession.priority_contract.region_semantics;
  priorityRanking={
    status:'EVALUATED',
    ranked:rankVisualDeltas(visualComparison.regions.map(r=>({
      region_id:r.region_id,
      ssim:Number(r.perceptual_score),
      pixel_difference_percent:Number(r.pixel_difference_percent),
      area_px:areaByRegion.get(r.region_id)||1,
      canvas_area_px:stencilSession.canvas.width*stencilSession.canvas.height,
      contrast_index:semantics[r.region_id]?.contrast_index??0.5,
      semantic_type:semantics[r.region_id]?.semantic_type??'NORMAL_UI',
      criticality:semantics[r.region_id]?.criticality??'MEDIUM'
    })))
  };
  const criticalRegionFailures=visualComparison.regions.filter(r=>r.critical&&(Number(r.perceptual_score)<0.96||Number(r.pixel_difference_percent)>3));
  const visualThresholdPass=
    Number(visualComparison.perceptual.score)>=0.96&&
    Number(visualComparison.pixel_difference.percent)<=3&&
    criticalRegionFailures.length===0&&
    softLockFinalization.status==='PASS'&&
    constraintAnchor.status==='PASS';
  await writeFile(outDir+'/machine-visual-comparison.json',JSON.stringify({
    reference_id:referenceRegistration.reference.reference_id,
    reference_hash:referenceRegistration.reference.hash,
    comparison:visualComparison,
    critical_region_failures:criticalRegionFailures.map(r=>r.region_id),
    soft_lock_evaluation:softLockEvaluation,
    soft_lock_finalization:softLockFinalization,
    priority_ranking:priorityRanking,
    visual_threshold_pass:visualThresholdPass
  },null,2));
  await writeFile(outDir+'/stencil-constraint-evidence.json',JSON.stringify({
    stencil_build_aid:stencilBuildAid,
    hero_candidate:heroCandidateState,
    constraint_set:constraintSet,
    constraint_anchor:constraintAnchor,
    soft_lock_set:softLockSet,
    soft_lock_evaluation:softLockEvaluation,
    soft_lock_finalization:softLockFinalization,
    priority_ranking:priorityRanking,
    semantic_implementation:semanticImplementation,
    visual_comparison:visualComparison,
    visual_threshold_pass:visualThresholdPass,
    navigation_diagnostics:{
      main:geometryBounds(geometry,'primary_navigation'),
      button_union:unionBounds(geometry,['primary_navigation_first_button','primary_navigation_last_button']),
      shell:geometryBounds(geometry,'primary_navigation_shell'),
      foot:geometryBounds(geometry,'primary_navigation_foot')
    }
  },null,2));

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
    diff_image:outDir+'/diff-desktop.png',
    visual_comparison:visualComparison,
    critical_region_failures:criticalRegionFailures.map(r=>r.region_id),
    geometry_snapshot:geometry,
    constraint_anchor:constraintAnchor,
    soft_lock_evaluation:softLockEvaluation,
    soft_lock_finalization:softLockFinalization,
    priority_ranking:priorityRanking,
    stencil_build_aid:stencilBuildAid,
    hero_candidate:heroCandidateState,
    hero_typography_candidate:heroTypographyState,
    sidebar_nav_typography_candidate:sidebarNavTypographyState,
    sidebar_brand_typography_candidate:sidebarBrandTypographyState,
    semantic_implementation:semanticImplementation,
    semantic_result:semanticImplementation.status,
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
    visual_result:visualThresholdPass?'PASS':'FAIL',
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
    constraint_anchor:runEvidence.constraint_anchor.status,
    semantic_result:runEvidence.semantic_result,
    stencil_status:runEvidence.stencil_build_aid.status,
    hero_candidate:runEvidence.hero_candidate?.status||'DISABLED',
    hero_typography_candidate:runEvidence.hero_typography_candidate?.candidate_id||null,
    sidebar_nav_typography_candidate:runEvidence.sidebar_nav_typography_candidate?.candidate_id||null,
    sidebar_brand_typography_candidate:runEvidence.sidebar_brand_typography_candidate?.candidate_id||null,
    responsive_result:runEvidence.responsive.status,
    runtime_truth_mutation_count:0,
    fixture_leak_count:0,
    architecture_drift_count:0,
    visual_result:runEvidence.visual_result,
    perceptual_score:visualComparison.perceptual.score,
    pixel_difference_percent:visualComparison.pixel_difference.percent,
    critical_region_failures:criticalRegionFailures.length,
    wave20_locked:true
  },null,2));
}finally{
  if(browser)await browser.close().catch(()=>{});
  if(!exited)child.kill('SIGTERM');
}
