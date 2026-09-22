import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { renderJarvisCommandCenterV1 } from '../src/jarvis/command-center-v1.js';
import { createScreenshotComparisonJob, runScreenshotComparison, analyzeVisualReference, fuseVisualReferences } from '../src/web-factory/index.js';

const ROOT=process.cwd();
const MODEL=JSON.parse(fs.readFileSync(path.join(ROOT,'fixtures/jarvis-anatomy-reference-layout-v1.json'),'utf8'));
const OUT=process.env.SCRATCH_DIR || '/tmp/jarvis-anatomy-reference-loop';
fs.mkdirSync(OUT,{recursive:true});

const NC={classification:'UNKNOWN',source_state:'NOT_CONNECTED'};
const truth={
  ok:true,private:true,read_only:true,
  systems:{source:NC,data:{}},runs:{source:NC,data:{items:[]}},activity:{source:NC,data:{items:[]}},
  approvals:{source:NC,data:{items:[],pending_count:0}},evidence:{source:NC,data:{items:[]}},
  command_chain:{schema:'aurentara.jarvis.command-center.worker-chain.v1',nodes:[]},
  anatomy:{
    schema:'aurentara.jarvis.anatomy.v1',generated_at:'2026-09-21T12:00:00.000Z',
    core:{status:'HEALTHY',label:'JARVIS Core',capability:'Central JARVIS runtime core',source:'jarvis-command-center-live-probes-v1',observed_at:'2026-09-21T11:59:30.000Z',last_success:'2026-09-21T11:59:30.000Z',reason:null,evidence_ref:'jarvis-command-center-live-probes-v1',detail:{jarvis:'ONLINE'}},
    brain:{status:'UNKNOWN',label:'Brain — Reasoning / Operator Logic',capability:'Astra reasoning & policy control',source:'jarvis-command-center-live-probes-v1',observed_at:'2026-09-21T11:59:30.000Z',last_success:null,reason:null,evidence_ref:null,detail:{astra:'UNKNOWN'}},
    eyes:{status:'NOT_CONNECTED',label:'Eyes — Perception / Monitoring',capability:'Perception & monitoring signal',source:null,observed_at:null,last_success:null,reason:'NO_GENUINE_SOURCE_BOUND',evidence_ref:null,detail:{}},
    ears:{status:'NOT_CONNECTED',label:'Ears — Voice / Input',capability:'Voice & input channel',source:null,observed_at:null,last_success:null,reason:'NO_GENUINE_SOURCE_BOUND',evidence_ref:null,detail:{}},
    mouth:{status:'NOT_CONNECTED',label:'Mouth — Communication / Output',capability:'Communication & output channel',source:null,observed_at:null,last_success:null,reason:'NO_GENUINE_SOURCE_BOUND',evidence_ref:null,detail:{}},
    left_hand:{status:'NOT_CONNECTED',label:'Left Hand — Browser / Desktop Execution',capability:'Browser / desktop execution',source:null,observed_at:null,last_success:null,reason:'NO_GENUINE_SOURCE_BOUND',evidence_ref:null,detail:{}},
    right_hand:{status:'UNKNOWN',label:'Right Hand — Claude Code / Engineering Execution',capability:'Claude Code engineering execution',source:'jarvis-command-center-live-probes-v1',observed_at:'2026-09-21T11:59:30.000Z',last_success:'2026-09-21T11:00:00.000Z',reason:'LIVE_EXECUTION_STATUS_UNPROVEN',evidence_ref:'claude-code:b5acafe1-d006-42c6-aa05-98ac62c0ae57',detail:{last_run:{id:'b5acafe1-d006-42c6-aa05-98ac62c0ae57',status:'COMPLETE'}}},
    infrastructure:{status:'DEGRADED',label:'Infrastructure — Runtime Foundation',capability:'VPS / service / runtime / git / storage / network foundation',source:'systems:JARVIS',observed_at:'2026-09-21T11:59:30.000Z',last_success:null,reason:'PARTIAL_INFRASTRUCTURE_PROVENANCE',evidence_ref:'jarvis-command-center-live-probes-v1',detail:{git:'UNKNOWN',memory_connected:false,jarvis:'ONLINE'}},
    nervous_system:{status:'UNKNOWN',label:'Nervous System — Bridge',capability:'Bridge integrations & connectors',source:'jarvis-command-center-live-probes-v1',observed_at:'2026-09-21T11:59:30.000Z',last_success:null,reason:null,evidence_ref:'jarvis-command-center-live-probes-v1',detail:{bridge:'UNKNOWN'}}
  },
  autonomy:{schema:'aurentara.jarvis.autonomy-view.v1',generated_at:'2026-09-21T12:00:00.000Z',stage:'COMPLETE',source:'jarvis-run-projection-v1',observed_at:'2026-09-21T11:59:30.000Z',current_run:{id:'b5acafe1-d006-42c6-aa05-98ac62c0ae57',title:'Owner E2E',worker:'Claude Code',status:'COMPLETE',program:'JARVIS_OWNER_CHAT'},last_activity:{event:'IMPLEMENTATION_MISSION',status:'COMPLETED',at:'2026-09-21T11:59:30.000Z'},last_success:'2026-09-21T11:59:30.000Z',evidence_ref:'claude-code:b5acafe1-d006-42c6-aa05-98ac62c0ae57',verification_result:'PROVEN',human_approval_required:true,human_approval_state:'GRANTED',reason:null,operator_acceptance_fabricated:false},
  validation:{ok:true,violations:[]}
};

const server=http.createServer((req,res)=>{
  const u=new URL(req.url,'http://localhost');
  if(u.pathname==='/api/runtime-truth'){res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify(truth));return;}
  if(u.pathname==='/'||u.pathname==='/jarvis'){res.writeHead(200,{'content-type':'text/html;charset=utf-8'});res.end(renderJarvisCommandCenterV1({base_path:''}));return;}
  res.writeHead(404);res.end('not found');
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base='http://127.0.0.1:'+server.address().port+'/';
const browser=await chromium.launch();

function refFor(viewport){
  return viewport.width<=560 ? MODEL.mobile_target : MODEL.desktop_target;
}
function intervalScore(v,[lo,hi]){
  if(v>=lo&&v<=hi)return 1;
  const span=Math.max(1,hi-lo);
  const dist=v<lo?lo-v:v-hi;
  return Math.max(0,1-dist/(span*1.5));
}
function centerScore(v,[lo,hi]){return intervalScore(v,[lo,hi]);}

async function generatedCapture(viewport){
  const ctx=await browser.newContext({viewport:{width:viewport.width,height:viewport.height},deviceScaleFactor:1});
  const page=await ctx.newPage();
  await page.route(/fonts\.googleapis\.com|fonts\.gstatic\.com/,(r)=>r.fulfill({status:200,body:'',contentType:'text/css'}));
  await page.goto(base,{waitUntil:'load'});
  await page.waitForSelector('.jcc');
  if(viewport.width>=980){
    const n=page.locator('.nav .nav-i').filter({hasText:'Anatomie'}).first(); await n.click();
  }else{
    const q=page.locator('.q-i').filter({hasText:'Anatomie'}).first();
    if(await q.count()) await q.click(); else await page.locator('.mnav button').filter({hasText:'Anatomie'}).first().click();
  }
  await page.waitForSelector('.an-stage-v2'); await page.waitForTimeout(300);
  const metrics=await page.evaluate(()=>{
    const rect=(s)=>{const e=document.querySelector(s);if(!e)return null;const r=e.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height,b:r.bottom};};
    const rs=(s)=>[...document.querySelectorAll(s)].map(e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height,b:r.bottom};});
    const stage=rect('.an-stage-v2'), fig=rect('.an-figure'), summary=rect('.an-summarybar');
    return {
      viewport:{width:innerWidth,height:innerHeight},
      stage,figure:fig,summary,cards:rs('.an-card'),
      left_cards:rs('.an-col-l .an-card'),right_cards:rs('.an-col-r .an-card'),
      hero_center_x_ratio:fig?(fig.x+fig.w/2)/innerWidth:null,
      detail_counts:{
        body_paths:document.querySelectorAll('.an-body-outline path,.an-body-outline circle,.an-musculature path').length,
        neural_paths:document.querySelectorAll('.an-neural path,.an-neural-secondary path,.an-neural-secondary circle').length,
        skeleton_paths:document.querySelectorAll('.an-skeleton path,.an-skeleton line,.an-joints circle').length,
        core_shapes:document.querySelectorAll('.an-core-art path,.an-core-art circle').length,
        head_shapes:document.querySelectorAll('.an-head-detail path,.an-head-detail circle,.an-head-detail ellipse').length,
        interactive_nodes:document.querySelectorAll('.an-node').length
      },
      body_share:fig?{w:fig.w/innerWidth,h:fig.h/innerHeight}:null,
      page_height:document.documentElement.scrollHeight,
      overflow:Math.max(0,document.documentElement.scrollWidth-innerWidth)
    };
  });
  const name=viewport.width<=560?'mobile':'desktop';
  const shot=path.join(OUT,'candidate-'+name+'.png');
  await page.screenshot({path:shot,fullPage:false});
  await ctx.close();
  return {kind:'generated',metrics,screenshot:shot};
}
function compareOne(reference,generated,viewport){
  const t=reference.target,m=generated.metrics;
  const checks=[];
  const add=(name,val,range,weight)=>checks.push({name,value:Math.round(val*100)/100,target:range,weight,score:intervalScore(val,range)});
  add('stage_height',m.stage.h,t.anatomy_stage_height_px,4);
  add('body_width',m.figure.w,t.body_visual_width_px,6);
  add('body_height',m.figure.h,t.body_visual_height_px,6);
  add('hero_center_x_ratio',m.hero_center_x_ratio,t.hero_center_x_ratio,4);
  const cardWidths=m.cards.map(x=>x.w); add('card_width',cardWidths.reduce((a,b)=>a+b,0)/Math.max(1,cardWidths.length),t.card_width_px,3);
  const min=MODEL.visual_contract.anatomy_detail_minimums;
  for(const [k,v] of Object.entries(min)){
    const actual=m.detail_counts[k]||0;checks.push({name:k,value:actual,target:['>=',v],weight:k==='interactive_nodes'?4:3,score:Math.min(1,actual/v)});
  }
  checks.push({name:'left_count',value:m.left_cards.length,target:4,weight:2,score:m.left_cards.length===4?1:0});
  checks.push({name:'right_count',value:m.right_cards.length,target:5,weight:2,score:m.right_cards.length===5?1:0});
  checks.push({name:'overflow',value:m.overflow,target:0,weight:4,score:m.overflow<=1?1:0});
  const weighted=checks.reduce((s,c)=>s+c.score*c.weight,0), weights=checks.reduce((s,c)=>s+c.weight,0);
  const score=Math.round(weighted/weights*10000)/100;
  return {score,checks,differences:checks.filter(c=>c.score<0.999).map(c=>({code:'REFERENCE_GEOMETRY_GAP',metric:c.name,actual:c.value,target:c.target})),screenshot:generated.screenshot};
}

const analysis=analyzeVisualReference({
  reference_id:'jarvis-anatomy-owner-reference-v1',source:'owner-supplied-image',role:'global_style',priority:100,match_strength:1,
  analysis:{visual_style:'premium technical holographic anatomy',color_palette:'near-black + warm amber/gold + green only for proven healthy',contrast:'high',typography_character:'thin technical uppercase with restrained tracking',spacing_rhythm:'dense controlled vertical rhythm',grid:'body-centered with four left cards and five right cards',section_density:'high without clutter',card_geometry:'thin amber border, restrained radius, translucent near-black surfaces',borders:'fine warm amber',shadows:'restrained amber glow',background_style:'near-black with subtle energy field',visual_hierarchy:'anatomy first, cards supporting',alignment:'symmetrical body-centered',decorative_patterns:'neural paths, node halos, fine connector routing',responsive_assumptions:'mobile preserves central body with progressive detail'}
});
const fusion=fuseVisualReferences([{reference_id:'jarvis-anatomy-owner-reference-v1',source:'owner-supplied-image',role:'global_style',priority:100,match_strength:1,analysis:analysis.attributes}]);
const job=createScreenshotComparisonJob({design_id:'jarvis-anatomy-reference-closure-v1',project_id:'jarvis',reference_source:{type:'structured-reference-model'},generated_source:{type:'local-candidate'},viewports:[{id:'mobile',width:390,height:844},{id:'desktop',width:1440,height:900}]});
const report=await runScreenshotComparison(job,{
  capture:async({viewport,kind})=>kind==='reference'?{kind:'reference',target:refFor(viewport),model:MODEL}:generatedCapture(viewport),
  compare:async({reference,generated,viewport})=>compareOne(reference,generated,viewport)
});
await browser.close();server.close();
const scores=report.metrics.map(x=>({viewport:x.viewport.id,score:x.comparison.score}));
const overall=Math.round(scores.reduce((s,x)=>s+x.score,0)/scores.length*100)/100;
const output={schema:'jarvis.anatomy.factory-reference-loop.v1',factory_path:'src/web-factory/screenshot-comparison.js',visual_foundry_path:'src/web-factory/reference-intelligence.js + visual-fidelity.js',reference_analysis:analysis,reference_fusion_status:fusion.status,comparison:report,scores,overall_score:overall,production_deploy:false};
fs.writeFileSync(path.join(OUT,'report.json'),JSON.stringify(output,null,2));
console.log(JSON.stringify({ok:true,overall_score:overall,scores,differences:report.differences.length,out:OUT,factory_executed:report.executed,reference_analysis:analysis.status},null,2));
