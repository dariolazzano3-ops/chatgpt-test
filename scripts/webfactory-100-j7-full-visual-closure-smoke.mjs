import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import sharp from 'sharp';
import {
  VISUAL_DELTA_TYPES,
  createReferenceBrief,
  createSketchGenerationContract,
  createCandidateReferenceContract,
  approveReference,
  createVisualClosureContract,
  runFullVisualClosureLoop,
  segmentVisualDeltas,
  createVisualRootCauseReport,
  createBoundedVisualRepairPlan,
  visualClosureLoopManifest,
  executeWebFactoryTask
} from '../src/web-factory/index.js';

const knowledge={
  knowledge_id:'j7-visual-knowledge-v1',
  scope_key:'customer:jaguar-visual:test-v1',
  revision:'1',
  business_name:'Jaguar Visual Test',
  industry:'local-business',
  primary_goal:'Prove bounded visual closure',
  required_sections:['hero','cards']
};

const brief=createReferenceBrief({
  project_knowledge:knowledge,
  project_scope:knowledge.scope_key,
  viewport:'1440_DESKTOP',
  reference_id:'j7-approved-reference'
},{now:'2026-09-07T03:00:00.000Z'});
assert.equal(brief.ok,true);
const sketch=createSketchGenerationContract(brief.reference,{}, {now:'2026-09-07T03:01:00.000Z'});
const candidate=createCandidateReferenceContract(sketch.reference,{
  render_asset_ref:'reference://j7/approved-reference.png',
  render_asset_hash:'j7-render-hash',
  width:1440,
  height:900,
  unresolved_items:[]
},{now:'2026-09-07T03:02:00.000Z'});
const approved=approveReference(candidate.reference,{
  approved_by:'operator-j7-human',
  approval_kind:'HUMAN'
},{now:'2026-09-07T03:03:00.000Z'});
assert.equal(approved.ok,true);

const contract=createVisualClosureContract({
  approved_reference:approved.reference,
  max_auto_repair_rounds:3,
  viewports:[{id:'desktop',width:1000,height:700}]
});
assert.equal(contract.ok,true);
assert.equal(contract.contract.visual_comparison_engine,'riosystems.screenshot-comparison-job.v1');
assert.equal(contract.contract.duplicate_visual_comparator_created,false);
assert.equal(contract.contract.max_auto_repair_rounds,3);
assert.equal(contract.contract.infinite_loop_allowed,false);
assert.equal(contract.contract.automatic_reference_mutation_allowed,false);

const unapprovedContract=createVisualClosureContract({approved_reference:candidate.reference});
assert.equal(unapprovedContract.ok,false);
assert.equal(unapprovedContract.status,'VALID_APPROVED_REFERENCE_REQUIRED');

const allTypesReport={
  executed:true,
  status:'EXECUTED',
  differences:VISUAL_DELTA_TYPES.map((type,index)=>({
    id:'taxonomy-'+type,
    type,
    path:type+'.test',
    expected:'a',
    actual:'b',
    severity:'BLOCK',
    region_id:'region-'+index
  }))
};
const segmented=segmentVisualDeltas(allTypesReport);
assert.deepEqual(Object.keys(segmented.by_type),VISUAL_DELTA_TYPES);
for(const type of VISUAL_DELTA_TYPES)assert.equal(segmented.by_type[type].length,1);
const roots=createVisualRootCauseReport(segmented);
for(const cause of ['TYPOGRAPHY_TOKENS','LAYOUT_GEOMETRY','STYLE_TOKENS','ASSET_MEDIA','RESPONSIVE_RULES','COMPOSITION','MOTION_CONTRACT']){
  assert.ok(roots.root_causes.some(r=>r.root_cause===cause));
}

const lockedSegmentation=segmentVisualDeltas({
  executed:true,
  status:'EXECUTED',
  differences:[{
    id:'locked-header-color',
    type:'color',
    path:'header.color',
    region_id:'header',
    expected:'#111111',
    actual:'#222222'
  }]
},{region_locks:[{lock_id:'header-lock',region_id:'header',accepted:true}]});
const lockedPlan=createBoundedVisualRepairPlan(
  lockedSegmentation,
  createVisualRootCauseReport(lockedSegmentation),
  {max_auto_repair_rounds:3}
);
assert.equal(lockedPlan.human_review_required,true);
assert.ok(lockedPlan.blockers.some(b=>b.code==='LOCKED_REGION_REGRESSION'));
assert.equal(lockedPlan.repairs.length,0);

const referenceStyle={
  background:'#f6efe5',
  foreground:'#201915',
  heroPadding:80,
  cardRadius:24,
  cardBackground:'#ffffff',
  headerBackground:'#201915',
  headerForeground:'#ffffff'
};
const candidateStyle={
  ...referenceStyle,
  background:'#fffdf9',
  heroPadding:38,
  cardRadius:6
};

function pageHtml(style){
  return '<!doctype html><html><head><meta charset="utf-8"><style>'+
    '*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;font-family:Arial,sans-serif}'+
    'body{background:'+style.background+';color:'+style.foreground+'}'+
    'header{height:72px;background:'+style.headerBackground+';color:'+style.headerForeground+';display:flex;align-items:center;padding:0 40px;font-size:22px;font-weight:700}'+
    'main{padding:'+style.heroPadding+'px 60px}'+
    'h1{font-size:64px;line-height:1;margin:0 0 28px;letter-spacing:-2px}'+
    'p{font-size:20px;max-width:620px;line-height:1.5;margin:0 0 42px}'+
    '.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:22px}'+
    '.card{height:180px;background:'+style.cardBackground+';border:1px solid #ded6cd;border-radius:'+style.cardRadius+'px;padding:28px}'+
    '.card strong{font-size:24px}'+
    '</style></head><body><header>JAGUAR VISUAL TEST</header><main>'+
    '<h1>Reference-first website</h1>'+
    '<p>Real browser screenshots are compared before a visual closure pass is allowed.</p>'+
    '<div class="grid"><div class="card"><strong>Reference</strong></div>'+
    '<div class="card"><strong>Build</strong></div>'+
    '<div class="card"><strong>Closure</strong></div></div>'+
    '</main></body></html>';
}

const referenceSource={id:'reference',html:pageHtml(referenceStyle),style:referenceStyle};
const initialBuild={
  build_id:'j7-candidate-build-1',
  source:{id:'candidate',html:pageHtml(candidateStyle),style:candidateStyle}
};

const browser=await chromium.launch({headless:true});
try{
  const capture=async({source,viewport})=>{
    const page=await browser.newPage({viewport:{width:viewport.width,height:viewport.height}});
    await page.setContent(source.html,{waitUntil:'load'});
    const buffer=await page.screenshot({fullPage:false,animations:'disabled'});
    await page.close();
    return{buffer,source,viewport};
  };

  const compare=async({reference,generated,viewport})=>{
    const ref=await sharp(reference.buffer).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    const gen=await sharp(generated.buffer).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    assert.equal(ref.info.width,gen.info.width);
    assert.equal(ref.info.height,gen.info.height);
    assert.equal(ref.info.channels,gen.info.channels);
    let changedPixels=0;
    const channels=ref.info.channels;
    for(let offset=0;offset<ref.data.length;offset+=channels){
      let changed=false;
      for(let c=0;c<channels;c++){
        if(ref.data[offset+c]!==gen.data[offset+c]){changed=true;break;}
      }
      if(changed)changedPixels++;
    }
    const totalPixels=ref.info.width*ref.info.height;
    const pixelDiffRatio=changedPixels/totalPixels;
    const rs=reference.source.style;
    const gs=generated.source.style;
    const differences=[];
    if(rs.background!==gs.background)differences.push({
      id:'background-color',type:'background',path:'background.color',region_id:'page',
      expected:rs.background,actual:gs.background
    });
    if(rs.heroPadding!==gs.heroPadding)differences.push({
      id:'hero-spacing',type:'spacing',path:'hero.padding',region_id:'hero',
      expected:rs.heroPadding,actual:gs.heroPadding
    });
    if(rs.cardRadius!==gs.cardRadius)differences.push({
      id:'card-radius',type:'radius',path:'cards.radius',region_id:'cards',
      expected:rs.cardRadius,actual:gs.cardRadius
    });
    if(rs.headerBackground!==gs.headerBackground)differences.push({
      id:'header-background',type:'background',path:'header.background',region_id:'header',
      expected:rs.headerBackground,actual:gs.headerBackground
    });
    const pass=pixelDiffRatio===0&&differences.length===0;
    return{
      status:pass?'PASS':'FAIL',
      pass,
      pixel_diff_ratio:pixelDiffRatio,
      pixel_diff_percent:Math.round(pixelDiffRatio*1000000)/10000,
      changed_pixels:changedPixels,
      total_pixels:totalPixels,
      viewport,
      differences
    };
  };

  let repairCalls=0;
  const repair=async({build,repair_plan})=>{
    repairCalls++;
    const next=structuredClone(build);
    const style={...next.source.style};
    for(const item of repair_plan.repairs){
      if(item.delta_id==='background-color')style.background=referenceStyle.background;
      if(item.delta_id==='hero-spacing')style.heroPadding=referenceStyle.heroPadding;
      if(item.delta_id==='card-radius')style.cardRadius=referenceStyle.cardRadius;
      if(item.delta_id==='header-background')style.headerBackground=referenceStyle.headerBackground;
    }
    next.source={...next.source,style,html:pageHtml(style)};
    return next;
  };

  const closure=await runFullVisualClosureLoop({
    approved_reference:approved.reference,
    reference_source:referenceSource,
    build:initialBuild,
    viewports:[{id:'desktop',width:1000,height:700}],
    max_auto_repair_rounds:3,
    region_locks:[]
  },{capture,compare,repair},{});
  assert.equal(closure.ok,true);
  assert.equal(closure.status,'VISUAL_CLOSURE_PASS');
  assert.equal(closure.pixel_comparison_claimed,true);
  assert.equal(closure.human_review_required,false);
  assert.equal(repairCalls,1);
  assert.equal(closure.auto_repair_rounds,1);
  assert.equal(closure.rounds[0].outcome,'REPAIRED_AND_REBUILT');
  assert.equal(closure.rounds[1].outcome,'PASS');
  assert.ok(closure.rounds[0].comparison.metrics[0].comparison.pixel_diff_ratio>0);
  assert.equal(closure.final_comparison.metrics[0].comparison.pixel_diff_ratio,0);
  assert.equal(closure.final_segmentation.deltas.length,0);

  const lockedCandidateStyle={...referenceStyle,headerBackground:'#6b1b1b'};
  let lockedRepairCalls=0;
  const lockedClosure=await runFullVisualClosureLoop({
    approved_reference:approved.reference,
    reference_source:referenceSource,
    build:{
      build_id:'j7-locked-build',
      source:{id:'locked',html:pageHtml(lockedCandidateStyle),style:lockedCandidateStyle}
    },
    viewports:[{id:'desktop',width:1000,height:700}],
    max_auto_repair_rounds:3,
    region_locks:[{lock_id:'approved-header',region_id:'header',accepted:true}]
  },{
    capture,
    compare,
    repair:async(payload)=>{lockedRepairCalls++;return payload.build;}
  },{});
  assert.equal(lockedClosure.ok,false);
  assert.equal(lockedClosure.status,'HUMAN_REVIEW_REQUIRED');
  assert.equal(lockedRepairCalls,0);
  assert.ok(lockedClosure.blockers.some(b=>b.code==='LOCKED_REGION_REGRESSION'));

  let exhaustionRepairs=0;
  const exhausted=await runFullVisualClosureLoop({
    approved_reference:approved.reference,
    reference_source:referenceSource,
    build:initialBuild,
    viewports:[{id:'desktop',width:1000,height:700}],
    max_auto_repair_rounds:2
  },{
    capture,
    compare,
    repair:async({build})=>{exhaustionRepairs++;return build;}
  },{});
  assert.equal(exhausted.ok,false);
  assert.equal(exhausted.status,'HUMAN_REVIEW_REQUIRED');
  assert.equal(exhaustionRepairs,2);
  assert.ok(exhausted.blockers.some(b=>b.code==='AUTO_REPAIR_ROUNDS_EXHAUSTED'));
  assert.equal(exhausted.auto_repair_rounds,2);

  const runtimeMissing=await runFullVisualClosureLoop({
    approved_reference:approved.reference,
    reference_source:referenceSource,
    build:initialBuild
  },{},{});
  assert.equal(runtimeMissing.ok,false);
  assert.equal(runtimeMissing.status,'VISUAL_RUNTIME_REQUIRED');
  assert.equal(runtimeMissing.pixel_comparison_claimed,false);

  const adapterContract=executeWebFactoryTask({
    capability:'web.visual.closure.v1',
    operation:'contract',
    approved_reference:approved.reference,
    max_auto_repair_rounds:3
  });
  assert.equal(adapterContract.ok,true);
  assert.equal(adapterContract.contract.duplicate_visual_comparator_created,false);

  const adapterManifest=executeWebFactoryTask({
    capability:'web.visual.closure.v1',
    operation:'manifest'
  });
  assert.equal(adapterManifest.ok,true);
  assert.equal(adapterManifest.manifest.existing_visual_comparison_engine_reused,true);

  const manifest=visualClosureLoopManifest();
  assert.equal(manifest.duplicate_visual_comparator_created,false);
  assert.equal(manifest.existing_visual_comparison_engine_reused,true);
  assert.equal(manifest.region_locks_supported,true);
  assert.equal(manifest.bounded_auto_repair,true);
  assert.equal(manifest.infinite_loop_allowed,false);
  assert.equal(manifest.automatic_reference_mutation_allowed,false);
  assert.equal(manifest.human_review_after_exhaustion,true);

  console.log(JSON.stringify({
    ok:true,
    suite:'webfactory-100-j7-full-visual-closure',
    real_playwright_screenshots:'PASS',
    real_sharp_pixel_compare:'PASS',
    initial_pixel_diff_positive:true,
    final_pixel_diff_ratio:closure.final_comparison.metrics[0].comparison.pixel_diff_ratio,
    delta_segmentation:'PASS',
    root_cause_mapping:'PASS',
    bounded_repair_rounds:'PASS',
    region_lock_regression_guard:'PASS',
    exhaustion_human_review:'PASS',
    runtime_missing_fail_closed:'PASS',
    existing_visual_comparator_reused:true,
    duplicate_visual_comparator_created:false,
    production_deploy:false
  },null,2));
}finally{
  await browser.close();
}
