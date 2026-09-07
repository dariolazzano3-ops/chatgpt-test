import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';
import {
  createReferenceBrief, createSketchGenerationContract, createCandidateReferenceContract,
  approveReference, verifyApprovedReferenceLock, J7_VISUAL_DELTA_TYPES,
  J7_DEFAULT_MAX_REPAIR_ROUNDS, J7_HARD_MAX_REPAIR_ROUNDS,
  verifyApprovedReferenceVisualAsset, classifyJ7VisualDeltaType,
  runApprovedReferenceVisualClosure, visualClosureLoopManifest
} from '../src/web-factory/index.js';
import { createVisualDelta } from '../src/visual-foundry/visual-delta.js';
import { compareVisualImages } from '../src/visual-foundry/visual-comparator.js';
import { evaluateSemanticImplementation } from '../src/visual-foundry/semantic-gate.js';

const viewport={width:390,height:844,device_pixel_ratio:1};
const viewportId='390_MOBILE';
const projectPath='projects/j7-visual-fixture';

function html(stage='exact'){
  let variation='';
  if(stage==='bad')variation='.right{position:relative;left:18px;transform:scale(.76);transform-origin:top left;background:#e15a44!important;border-radius:26px!important}';
  if(stage==='regress')variation='.left{position:relative;left:10px;transform:scale(.84);transform-origin:top left;background:#68717a!important;border-radius:2px!important}';
  const heading=stage==='semantic_bad'
    ? '<h2 data-visual-id="title">J7 Visual Closure</h2>'
    : '<h1 data-visual-id="title">J7 Visual Closure</h1>';
  return '<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+
    '*{box-sizing:border-box}html,body{margin:0;width:390px;height:844px;overflow:hidden;background:#f5f1e8;color:#151515;font-family:Arial,sans-serif}'+
    'main{padding:24px 20px}h1{margin:0;font-size:36px;line-height:1.05;font-weight:700;letter-spacing:-.035em}'+
    '.sub{margin:10px 0 0;font-size:14px;line-height:1.4;color:#5d5a53}.grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:34px}'+
    '.card{height:184px;border-radius:18px;border:2px solid #151515;box-shadow:0 8px 0 rgba(0,0,0,.12)}.left{background:#20252a}.right{background:#d5aa63}'+
    '.caption{margin-top:18px;font-size:13px}'+variation+'</style></head><body><main>'+heading+
    '<p class="sub">Approved Reference → Screenshot → Visual Foundry → Repair.</p>'+
    '<section class="grid" aria-label="Visual comparison fixture"><article class="card left" data-visual-id="left-card" aria-label="Protected region"></article>'+
    '<article class="card right" data-visual-id="right-card" aria-label="Repair target"></article></section>'+
    '<p class="caption">Semantic HTML remains real implementation, never a screenshot overlay.</p></main></body></html>';
}

async function geometrySnapshot(page){
  return page.evaluate(()=>({
    schema:'riosystems.dom-geometry-snapshot.v1',
    components:[...document.querySelectorAll('[data-visual-id]')].map(el=>{
      const r=el.getBoundingClientRect();
      return{component_id:el.getAttribute('data-visual-id'),status:'MEASURED',geometry:{
        x:Math.round(r.x*1000)/1000,y:Math.round(r.y*1000)/1000,
        width:Math.round(r.width*1000)/1000,height:Math.round(r.height*1000)/1000
      }};
    })
  }));
}

async function typographySnapshot(page){
  return page.evaluate(()=>{
    const s=getComputedStyle(document.querySelector('[data-visual-id="title"]'));
    return{font_family:s.fontFamily,font_size:s.fontSize,line_height:s.lineHeight,font_weight:s.fontWeight,letter_spacing:s.letterSpacing};
  });
}
function typographyScore(reference,actual){
  const keys=Object.keys(reference);
  return keys.filter(k=>String(reference[k])===String(actual[k])).length/keys.length;
}
function bounds(snapshot,id){
  const item=snapshot.components.find(c=>c.component_id===id);
  assert.ok(item,'missing geometry '+id);
  return item.geometry;
}
function classificationFor(delta){
  const metric=String(delta?.evidence?.metric||'').toLowerCase();
  let visual_type='background';
  if(delta.category==='GEOMETRY')visual_type=['x','y','left','top','right','bottom'].includes(metric)?'position':['width','height'].includes(metric)?'size':'spacing';
  else if(delta.category==='COLOR')visual_type='color';
  else if(delta.category==='TYPOGRAPHY')visual_type='typography';
  else if(delta.category==='RESPONSIVE')visual_type='responsive';
  else if(delta.category==='ASSET')visual_type='asset';
  return{delta_id:delta.delta_id,visual_type,root_cause:'DETERMINISTIC_FIXTURE_'+visual_type.toUpperCase(),repair_target:projectPath+'/assets/styles.css'};
}

const expectedTypes=['typography','position','spacing','size','color','background','asset','crop','border','radius','shadow','responsive','missing','extra','motion'];
assert.deepEqual(J7_VISUAL_DELTA_TYPES,expectedTypes);
assert.equal(J7_DEFAULT_MAX_REPAIR_ROUNDS,4);
assert.ok(J7_HARD_MAX_REPAIR_ROUNDS<=8);

const classifierCases=[
  [{category:'TYPOGRAPHY',evidence:{}},'typography'],
  [{category:'GEOMETRY',evidence:{metric:'x'}},'position'],
  [{category:'GEOMETRY',evidence:{metric:'gap'}},'spacing'],
  [{category:'GEOMETRY',evidence:{metric:'width'}},'size'],
  [{category:'COLOR',evidence:{metric:'foreground'}},'color'],
  [{category:'COLOR',evidence:{path:'background-color'}},'background'],
  [{category:'ASSET',evidence:{measurement:'image'}},'asset'],
  [{category:'ASSET',repair_hint:'adjust focal crop'},'crop'],
  [{category:'EFFECT',repair_hint:'border width'},'border'],
  [{category:'EFFECT',repair_hint:'radius token'},'radius'],
  [{category:'EFFECT',repair_hint:'shadow token'},'shadow'],
  [{category:'RESPONSIVE',evidence:{}},'responsive'],
  [{category:'STRUCTURE',difference:'MISSING_COMPONENT',evidence:{}},'missing'],
  [{category:'STRUCTURE',difference:'unexpected extra element',evidence:{}},'extra'],
  [{category:'EFFECT',repair_hint:'motion transition'},'motion']
];
for(const [delta,expected] of classifierCases)assert.equal(classifyJ7VisualDeltaType(delta),expected);

const d1=createVisualDelta({reference_id:'ref',implementation_commit:'a',viewport,region:'hero',category:'COLOR',severity:'HIGH',expected:1,actual:.7,evidence:{measurement:'color_similarity'}});
const d2=createVisualDelta({reference_id:'ref',implementation_commit:'b',viewport,region:'hero',category:'COLOR',severity:'HIGH',expected:1,actual:.7,evidence:{measurement:'color_similarity'}});
assert.equal(d1.delta_id,d2.delta_id);
assert.equal(d1.deterministic_id,true);

const temp=await mkdtemp(path.join(os.tmpdir(),'jaguar-j7-'));
let browser;
try{
  browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:viewport.width,height:viewport.height},deviceScaleFactor:1});

  const referencePath=path.join(temp,'reference.png');
  await page.setContent(html('exact'),{waitUntil:'load'});
  const referenceGeometry=await geometrySnapshot(page);
  const referenceTypography=await typographySnapshot(page);
  await page.screenshot({path:referencePath,fullPage:false,animations:'disabled'});
  const referenceHash=createHash('sha256').update(await readFile(referencePath)).digest('hex');
  const regions=[
    {region_id:'left-card',critical:true,...bounds(referenceGeometry,'left-card')},
    {region_id:'right-card',critical:true,...bounds(referenceGeometry,'right-card')}
  ];

  const knowledge={
    knowledge_id:'j7-knowledge-v1',scope_key:'customer:j7:visual-fixture',revision:'1',
    business_name:'J7 Fixture',industry:'local services',primary_goal:'Visual closure',target_audience:'Operator',
    required_sections:['hero'],facts:[{key:'business_name',value:'J7 Fixture',status:'CONFIRMED',source:'operator'}]
  };
  const brief=createReferenceBrief({project_knowledge:knowledge,project_scope:knowledge.scope_key,knowledge_revision:'1',viewport:viewportId,design_intent:{purpose:'J7 deterministic visual closure fixture'}},{now:'2026-09-07T03:20:00.000Z'});
  const sketch=createSketchGenerationContract(brief.reference,{layout_hypotheses:['Two-card deterministic closure fixture']},{now:'2026-09-07T03:21:00.000Z'});
  const candidate=createCandidateReferenceContract(sketch.reference,{render_asset_ref:'reference://j7/mobile/reference-v1.png',render_asset_hash:referenceHash,mime_type:'image/png',width:viewport.width,height:viewport.height,unresolved_items:[]},{now:'2026-09-07T03:22:00.000Z'});
  const approved=approveReference(candidate.reference,{approved_by:'operator-dario',approval_kind:'HUMAN'},{now:'2026-09-07T03:23:00.000Z'});
  assert.equal(approved.ok,true);
  assert.equal(verifyApprovedReferenceLock(approved.reference).ok,true);

  const verified=await verifyApprovedReferenceVisualAsset({reference:approved.reference,reference_path:referencePath,reference_asset_ref:'reference://j7/mobile/reference-v1.png',viewport_id:viewportId});
  assert.equal(verified.status,'PASS');
  assert.equal(verified.materialized_hash,referenceHash);

  await page.setContent(html('bad'),{waitUntil:'load'});
  const tamperedPath=path.join(temp,'tampered.png');
  await page.screenshot({path:tamperedPath,fullPage:false,animations:'disabled'});
  const wrongAsset=await verifyApprovedReferenceVisualAsset({reference:approved.reference,reference_path:tamperedPath,reference_asset_ref:'reference://j7/mobile/reference-v1.png',viewport_id:viewportId});
  assert.equal(wrongAsset.status,'BLOCK');
  assert.ok(wrongAsset.blocking_issues.some(i=>i.code==='REFERENCE_RENDER_SHA256_MISMATCH'));

  const initialPath=path.join(temp,'initial.png');
  await page.screenshot({path:initialPath,fullPage:false,animations:'disabled'});
  const initialMeasurement=await compareVisualImages({reference_path:referencePath,actual_path:initialPath,regions,diff_path:path.join(temp,'initial-diff.png')});
  assert.equal(initialMeasurement.status,'MEASURED');
  assert.ok(initialMeasurement.pixel_difference.percent>3);
  assert.ok(initialMeasurement.perceptual.score<1);
  assert.equal(initialMeasurement.regions.find(r=>r.region_id==='left-card').pixel_difference_percent,0);
  assert.ok(initialMeasurement.regions.find(r=>r.region_id==='right-card').pixel_difference_percent>0);

  assert.equal((await evaluateSemanticImplementation(page)).status,'PASS');
  await page.setContent(html('semantic_bad'),{waitUntil:'load'});
  const semanticFail=await evaluateSemanticImplementation(page);
  assert.equal(semanticFail.status,'FAIL');
  assert.ok(semanticFail.issues.some(i=>i.code==='SEMANTIC_H1_COUNT'));

  const reverted=[];
  const captures=[];
  const mainAdapters={
    async capture({iteration,commit_sha}){
      let stage='bad';
      if(commit_sha==='j7-commit-1')stage='regress';
      if(commit_sha==='j7-commit-2')stage='exact';
      await page.setContent(html(stage),{waitUntil:'load'});
      const actualPath=path.join(temp,'main-'+iteration+'-'+stage+'.png');
      await page.screenshot({path:actualPath,fullPage:false,animations:'disabled'});
      captures.push({iteration,commit_sha,stage});
      return{actual_path:actualPath,diff_path:path.join(temp,'main-'+iteration+'-'+stage+'-diff.png'),page};
    },
    async geometry_snapshot(){return geometrySnapshot(page);},
    async typography_score(){return typographyScore(referenceTypography,await typographySnapshot(page));},
    async functional_regression(){
      const ok=await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth);
      return{status:ok?'PASS':'FAIL',responsive_status:ok?'PASS':'FAIL',accessibility_status:'PASS',evidence:{horizontal_overflow:!ok}};
    },
    async root_cause({deltas}){return{classifications:deltas.map(classificationFor)};},
    async repair({iteration,plan}){return{changed_files:[projectPath+'/assets/styles.css'],proposal_id:'repair-'+iteration,phase:plan.phase};},
    async commit({iteration}){return{commit_sha:'j7-commit-'+iteration};},
    async revert(input){reverted.push(input);return{status:'REVERTED'};}
  };

  const input={
    reference:approved.reference,reference_path:referencePath,reference_asset_ref:'reference://j7/mobile/reference-v1.png',
    viewport_id:viewportId,viewport,reference_geometry:referenceGeometry,regions,initial_commit:'j7-initial',
    project_path:projectPath,max_repair_rounds:2,region_pass_threshold:.96,region_regression_tolerance:.002
  };
  const result=await runApprovedReferenceVisualClosure(input,mainAdapters);
  assert.equal(result.status,'PASS');
  assert.equal(result.iterations,2);
  assert.equal(result.human_decision_required,false);
  assert.equal(result.comparator,'VISUAL_FOUNDRY_ONLY');
  assert.equal(result.reference_verification.status,'PASS');
  assert.equal(result.final_candidate.visual_acceptance.status,'PASS');
  assert.equal(result.final_candidate.semantic.status,'PASS');
  assert.equal(result.final_candidate.functional.status,'PASS');
  assert.equal(result.final_candidate.measurement.pixel_difference.percent,0);
  assert.equal(result.final_candidate.measurement.perceptual.score,1);
  assert.equal(result.history[0].status,'REJECTED');
  assert.equal(result.history[0].reason,'REGION_LOCK_REGRESSION');
  assert.equal(result.history[1].status,'ACCEPTED');
  assert.ok(reverted.some(r=>r.reason==='REGION_LOCK_REGRESSION'));
  assert.ok(result.region_locks.regions.some(r=>r.region_id==='left-card'));
  assert.ok(result.region_locks.regions.some(r=>r.region_id==='right-card'));
  assert.equal(captures.some(c=>c.stage==='regress'),true);
  assert.equal(captures.some(c=>c.stage==='exact'),true);

  const exhaustionReverts=[];
  const exhaustedAdapters={
    ...mainAdapters,
    async capture({iteration}){
      const stage=iteration===0?'bad':'regress';
      await page.setContent(html(stage),{waitUntil:'load'});
      const actualPath=path.join(temp,'exhaust-'+iteration+'-'+stage+'.png');
      await page.screenshot({path:actualPath,fullPage:false,animations:'disabled'});
      return{actual_path:actualPath,diff_path:path.join(temp,'exhaust-'+iteration+'-diff.png'),page};
    },
    async commit({iteration}){return{commit_sha:'j7-exhaust-'+iteration};},
    async revert(input){exhaustionReverts.push(input);return{status:'REVERTED'};}
  };
  const exhausted=await runApprovedReferenceVisualClosure({...input,initial_commit:'j7-exhaust-initial',max_repair_rounds:1},exhaustedAdapters);
  assert.equal(exhausted.status,'HUMAN_DECISION_REQUIRED');
  assert.equal(exhausted.reason,'BOUNDED_REPAIR_ROUNDS_EXHAUSTED');
  assert.equal(exhausted.iterations,1);
  assert.equal(exhausted.human_decision_required,true);
  assert.equal(exhaustionReverts.length,1);

  const manifest=visualClosureLoopManifest();
  assert.equal(manifest.comparator,'VISUAL_FOUNDRY_ONLY');
  assert.deepEqual(manifest.delta_types,expectedTypes);
  assert.equal(manifest.approved_reference_required,true);
  assert.equal(manifest.reference_asset_sha256_required,true);
  assert.equal(manifest.infinite_loop_allowed,false);
  assert.equal(manifest.global_score_may_override_critical_region,false);
  assert.equal(manifest.production_deploy,false);
  assert.equal(manifest.public_launch,false);
  assert.equal(manifest.dns_change,false);
  assert.equal(manifest.billing_activation,false);
  assert.equal(manifest.automatic_paid_activation,false);
  assert.equal(manifest.external_writes,false);

  console.log(JSON.stringify({
    ok:true,suite:'webfactory-100-j7-visual-closure',
    approved_reference_sha256:'PASS',real_browser_screenshot:'PASS',
    visual_foundry_ssim:'PASS',visual_foundry_pixelmatch:'PASS',
    delta_types:expectedTypes,deterministic_delta_identity:'PASS',
    root_cause_plan:'PASS',protected_region_regression_rejected:'PASS',
    bounded_repair_rounds:'PASS',exhausted_rounds_require_human:'PASS',
    semantic_gate:'PASS',
    final_pixel_difference_percent:result.final_candidate.measurement.pixel_difference.percent,
    final_ssim:result.final_candidate.measurement.perceptual.score,
    production_deploy:false,public_launch:false,external_writes:false
  },null,2));
}finally{
  if(browser)await browser.close().catch(()=>{});
  await rm(temp,{recursive:true,force:true});
}
