import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { verifyApprovedReferenceLock } from './reference-studio-v1.js';
import { compareVisualImages, compareGeometrySnapshots } from '../visual-foundry/visual-comparator.js';
import {
  createVisualDelta,
  deltasFromVisualMeasurement,
  deltasFromGeometryComparison
} from '../visual-foundry/visual-delta.js';
import { scoreVisualDeltaPriority } from '../visual-foundry/visual-priority.js';
import { evaluateVisualAcceptance } from '../visual-foundry/visual-acceptance.js';
import {
  createVisualRepairPlan,
  assertVisualRepairAuthority,
  VISUAL_REPAIR_HARD_MAX_ITERATIONS
} from '../visual-foundry/delta-closer.js';
import {
  createSoftRegionLockSet,
  evaluateSoftLockCandidate,
  finalizeSoftRegionLocks,
  advanceSoftLockBaselines
} from '../visual-foundry/soft-region-locks.js';
import {
  evaluateRegionRegressionGuard,
  freezePassingRegions
} from '../visual-foundry/region-closure.js';
import { evaluateSemanticImplementation } from '../visual-foundry/semantic-gate.js';

export const J7_VISUAL_DELTA_TYPES=Object.freeze([
  'typography','position','spacing','size','color','background','asset','crop',
  'border','radius','shadow','responsive','missing','extra','motion'
]);

export const J7_DEFAULT_MAX_REPAIR_ROUNDS=4;
export const J7_HARD_MAX_REPAIR_ROUNDS=Math.min(8,VISUAL_REPAIR_HARD_MAX_ITERATIONS);

const arr=(v)=>Array.isArray(v)?v:[];
const clone=(v)=>v==null?v:structuredClone(v);
const clean=(v,max=1000)=>String(v??'').replace(/\s+/g,' ').trim().slice(0,max);
const finite=(v,fallback=null)=>Number.isFinite(Number(v))?Number(v):fallback;
const clamp=(v,min=0,max=1)=>Math.max(min,Math.min(max,Number(v)));
const round=(v,d=6)=>{const f=10**d;return Math.round(Number(v||0)*f)/f;};

function resolveRounds(value){
  const n=Math.floor(finite(value,J7_DEFAULT_MAX_REPAIR_ROUNDS));
  return Math.max(1,Math.min(J7_HARD_MAX_REPAIR_ROUNDS,n));
}

async function sha256File(path){
  const data=await readFile(path);
  return createHash('sha256').update(data).digest('hex');
}

export async function verifyApprovedReferenceVisualAsset(input={}){
  const reference=clone(input.reference||{});
  const lock=verifyApprovedReferenceLock(reference);
  const issues=[];
  if(!lock.ok)issues.push({code:'APPROVED_REFERENCE_LOCK_REQUIRED',severity:'BLOCK'});
  const expectedHash=clean(reference?.artifact?.render_asset_hash,128).toLowerCase();
  const expectedRef=clean(reference?.artifact?.render_asset_ref,1000);
  const referencePath=clean(input.reference_path,1000);
  if(!referencePath)issues.push({code:'REFERENCE_PNG_PATH_REQUIRED',severity:'BLOCK'});
  if(!/^[a-f0-9]{64}$/i.test(expectedHash))issues.push({code:'REFERENCE_RENDER_SHA256_REQUIRED',severity:'BLOCK',actual:expectedHash||null});
  if(reference?.artifact?.mime_type&&reference.artifact.mime_type!=='image/png')issues.push({code:'REFERENCE_PNG_REQUIRED',severity:'BLOCK',mime_type:reference.artifact.mime_type});
  if(input.reference_asset_ref&&expectedRef&&clean(input.reference_asset_ref,1000)!==expectedRef)issues.push({code:'REFERENCE_ASSET_REF_MISMATCH',severity:'BLOCK'});
  if(input.viewport_id&&clean(input.viewport_id,80)!==clean(reference.viewport,80))issues.push({code:'REFERENCE_VIEWPORT_ID_MISMATCH',severity:'BLOCK',expected:reference.viewport,actual:input.viewport_id});
  let actualHash=null;
  if(referencePath){
    try{actualHash=await sha256File(referencePath);}
    catch{issues.push({code:'REFERENCE_PNG_UNREADABLE',severity:'BLOCK',reference_path:referencePath});}
  }
  if(actualHash&&expectedHash&&actualHash!==expectedHash)issues.push({code:'REFERENCE_RENDER_SHA256_MISMATCH',severity:'BLOCK',expected:expectedHash,actual:actualHash});
  return{
    schema:'riosystems.approved-reference-visual-asset-verification.v1',
    status:issues.length?'BLOCK':'PASS',
    reference_id:reference.reference_id||null,
    reference_version:reference.version||null,
    reference_hash:reference.hash||null,
    render_asset_ref:expectedRef||null,
    render_asset_hash:expectedHash||null,
    materialized_hash:actualHash,
    approved_reference_lock:lock,
    issues,
    blocking_issues:issues,
    visual_source_of_truth:issues.length===0,
    production_deploy:false
  };
}

export function visualMeasurementRegionScores(measurement={}){
  const regions=arr(measurement.regions).map(region=>{
    const ssim=clamp(finite(region.perceptual_score,0));
    const pixelSimilarity=1-clamp(finite(region.pixel_difference_ratio,1));
    return{
      region_id:clean(region.region_id,180),
      critical:region.critical===true,
      score:round(Math.min(ssim,pixelSimilarity)),
      perceptual_score:round(ssim),
      pixel_similarity:round(pixelSimilarity),
      pixel_difference_percent:round(finite(region.pixel_difference_percent,finite(region.pixel_difference_ratio,1)*100),4),
      bounds:clone(region.bounds||null)
    };
  }).filter(r=>r.region_id);
  return{
    schema:'riosystems.visual-region-score-report.v1',
    regions,
    measured:true,
    source:'VISUAL_FOUNDRY_COMPARATOR',
    ai_score_used:false
  };
}

function textHaystack(delta={}){
  return [
    delta.category,delta.region,delta.component_id,delta.repair_hint,
    delta?.evidence?.measurement,delta?.evidence?.metric,delta?.evidence?.path,
    JSON.stringify(delta.expected??null),JSON.stringify(delta.actual??null),JSON.stringify(delta.difference??null)
  ].join(' ').toLowerCase();
}

export function classifyJ7VisualDeltaType(delta={},hint=null){
  const hinted=clean(hint?.visual_type||delta?.evidence?.visual_type,80).toLowerCase();
  if(J7_VISUAL_DELTA_TYPES.includes(hinted))return hinted;
  const h=textHaystack(delta);
  const category=String(delta.category||'').toUpperCase();
  const metric=String(delta?.evidence?.metric||'').toLowerCase();

  if(category==='TYPOGRAPHY'||/font|type|line-height|letter-spacing|text raster/.test(h))return 'typography';
  if(category==='RESPONSIVE'||/breakpoint|responsive|viewport overflow/.test(h))return 'responsive';
  if(category==='ASSET'){
    if(/crop|object-position|focal/.test(h))return 'crop';
    return 'asset';
  }
  if(category==='GEOMETRY'){
    if(['x','y','left','top','right','bottom'].includes(metric)||/position|offset|alignment/.test(h))return 'position';
    if(['width','height'].includes(metric)||/\bsize\b|dimensions/.test(h))return 'size';
    if(/gap|margin|padding|spacing/.test(h))return 'spacing';
  }
  if(category==='COLOR'){
    if(/background/.test(h))return 'background';
    if(/border/.test(h))return 'border';
    return 'color';
  }
  if(category==='EFFECT'){
    if(/radius/.test(h))return 'radius';
    if(/shadow/.test(h))return 'shadow';
    if(/border/.test(h))return 'border';
    if(/background/.test(h))return 'background';
    if(/motion|animation|transition|parallax|marquee/.test(h))return 'motion';
  }
  if(/missing|absent|not present/.test(h))return 'missing';
  if(/extra|unexpected|duplicate/.test(h))return 'extra';
  if(/crop|object-position|focal/.test(h))return 'crop';
  if(/asset|image|logo|video/.test(h))return 'asset';
  if(/radius/.test(h))return 'radius';
  if(/shadow/.test(h))return 'shadow';
  if(/border/.test(h))return 'border';
  if(/background/.test(h))return 'background';
  if(/motion|animation|transition|parallax|marquee/.test(h))return 'motion';
  return null;
}

function rootCauseForType(type){
  return({
    typography:'TYPOGRAPHY_TOKENS_OR_FONT_METRICS',
    position:'LAYOUT_POSITION_CONSTRAINT',
    spacing:'SPACING_TOKEN_OR_LAYOUT_GAP',
    size:'COMPONENT_OR_CONTAINER_GEOMETRY',
    color:'COLOR_TOKEN',
    background:'BACKGROUND_STYLE_OR_MEDIA',
    asset:'ASSET_SELECTION_OR_RIGHTS_SAFE_MEDIA_BINDING',
    crop:'FOCAL_POINT_OR_OBJECT_POSITION',
    border:'BORDER_TOKEN',
    radius:'RADIUS_TOKEN',
    shadow:'SHADOW_TOKEN',
    responsive:'RESPONSIVE_CONSTRAINT',
    missing:'COMPONENT_STRUCTURE_MISSING',
    extra:'COMPONENT_STRUCTURE_EXTRA',
    motion:'MOTION_CONTRACT_OR_RUNTIME'
  })[type]||null;
}

function priorityForDelta(delta,type){
  const score=finite(delta.score,0);
  const bounds=delta?.evidence?.bounds||{};
  const area=Math.max(1,finite(bounds.width,1)*finite(bounds.height,1));
  const viewport=delta.viewport||{};
  const canvas=Math.max(1,finite(viewport.width,1)*finite(viewport.height,1));
  const priority=scoreVisualDeltaPriority({
    region_id:delta.region||delta.component_id||delta.delta_id,
    ssim:clamp(score),
    pixel_difference_percent:finite(delta?.evidence?.pixel_difference_percent,(1-clamp(score))*100),
    canvas_area_px:canvas,
    area_px:area,
    contrast_index:finite(delta?.evidence?.contrast_index,0.5),
    semantic_type:delta?.evidence?.semantic_type||'NORMAL_UI',
    criticality:delta.severity||'MEDIUM'
  });
  return{...priority,visual_type:type};
}

export function enrichJ7VisualDeltas(deltas=[],classifications=[]){
  const byId=new Map(arr(classifications).map(item=>[String(item.delta_id||''),item]));
  return arr(deltas).map(delta=>{
    const hint=byId.get(String(delta.delta_id))||null;
    const type=classifyJ7VisualDeltaType(delta,hint);
    return{
      ...clone(delta),
      visual_type:type,
      root_cause:clean(hint?.root_cause,500)||rootCauseForType(type),
      repair_target:clean(hint?.repair_target,500)||null,
      priority:type?priorityForDelta(delta,type):null,
      root_cause_resolved:Boolean(type&&(clean(hint?.root_cause,500)||rootCauseForType(type)))
    };
  }).sort((a,b)=>(b.priority?.priority_score||0)-(a.priority?.priority_score||0)||String(a.delta_id).localeCompare(String(b.delta_id)));
}

export function createJ7RootCauseRepairPlan(deltas=[],classifications=[]){
  const enriched=enrichJ7VisualDeltas(deltas,classifications);
  const blocking=enriched.filter(d=>d.blocking===true||['MEDIUM','HIGH','CRITICAL'].includes(d.severity));
  const unresolved=blocking.filter(d=>!d.visual_type||!d.root_cause_resolved);
  if(unresolved.length){
    return{
      schema:'riosystems.j7-root-cause-repair-plan.v1',
      status:'ROOT_CAUSE_REQUIRED',
      unresolved_delta_ids:unresolved.map(d=>d.delta_id),
      deltas:enriched,
      blind_rewrite_allowed:false,
      automatic_repair_allowed:false
    };
  }
  const foundryPlan=createVisualRepairPlan(enriched);
  return{
    schema:'riosystems.j7-root-cause-repair-plan.v1',
    status:foundryPlan.status,
    phase:foundryPlan.phase,
    repair_order:foundryPlan.repair_order||[],
    deltas:foundryPlan.deltas.map(d=>enriched.find(e=>e.delta_id===d.delta_id)||d),
    priority_order:enriched.map(d=>({delta_id:d.delta_id,visual_type:d.visual_type,priority_score:d.priority?.priority_score||0,root_cause:d.root_cause})),
    blind_rewrite_allowed:false,
    automatic_repair_allowed:foundryPlan.status==='REPAIR_REQUIRED',
    visual_foundry_plan:foundryPlan
  };
}

function blockingSignature(deltas=[]){
  return arr(deltas).filter(d=>d.blocking===true).map(d=>JSON.stringify({
    category:d.category,
    visual_type:d.visual_type||null,
    region:d.region||null,
    component_id:d.component_id||null,
    measurement:d?.evidence?.measurement||null,
    metric:d?.evidence?.metric||null,
    expected:d.expected??null,
    actual:d.actual??null,
    difference:d.difference??null
  })).sort().join('|');
}

function closureScore(visual={}){
  const values=[
    finite(visual.structural_score,null),
    finite(visual.geometry_score,null),
    finite(visual.perceptual_score,null),
    visual.pixel_difference==null?null:1-clamp(Number(visual.pixel_difference)/100),
    finite(visual.typography_score,null),
    finite(visual.color_score,null)
  ].filter(v=>v!==null);
  return values.length?round(values.reduce((a,b)=>a+b,0)/values.length):0;
}

function ensureSoftLocks(lockSet={},regionScores={},input={}){
  const next=advanceSoftLockBaselines(lockSet,regionScores,{minimum_improvement:0});
  const existing=new Set(arr(next.regions).map(r=>r.region_id));
  const threshold=finite(input.pass_threshold,0.96);
  const tolerance=finite(input.tolerance,0.002);
  for(const region of arr(regionScores.regions)){
    if(region.score>=threshold&&!existing.has(region.region_id)){
      next.regions.push({region_id:region.region_id,baseline_score:region.score,tolerance,state:'SOFT_LOCKED',advanced:true});
      existing.add(region.region_id);
    }
  }
  next.regions.sort((a,b)=>String(a.region_id).localeCompare(String(b.region_id)));
  return next;
}

function candidatePass(candidate,locks){
  return candidate.visual_acceptance.status==='PASS'
    && candidate.semantic.status==='PASS'
    && candidate.functional.status==='PASS'
    && candidate.functional.responsive_status!=='FAIL'
    && candidate.functional.accessibility_status!=='FAIL'
    && finalizeSoftRegionLocks(locks,candidate.region_scores).status==='PASS';
}

async function semanticForCapture(capture={},adapters={},context={}){
  if(capture.page&&typeof capture.page.evaluate==='function')return evaluateSemanticImplementation(capture.page,context.semantic_options||{});
  if(typeof adapters.semantic_gate==='function'){
    const result=await adapters.semantic_gate({...context,capture});
    if(result?.schema!=='riosystems.semantic-implementation-gate.v1')throw new Error('J7_SEMANTIC_GATE_REPORT_REQUIRED');
    return result;
  }
  throw new Error('J7_SEMANTIC_GATE_ADAPTER_REQUIRED');
}

async function evaluateCandidate(input,adapters,context={}){
  const capture=await adapters.capture(context);
  const actualPath=clean(capture?.actual_path,1000);
  if(!actualPath)throw new Error('J7_CAPTURE_ACTUAL_PNG_REQUIRED');

  const measurement=await compareVisualImages({
    reference_path:input.reference_path,
    actual_path:actualPath,
    regions:input.regions||[],
    diff_path:capture.diff_path||null,
    pixel_threshold:input.pixel_threshold??0.1,
    include_antialiasing:input.include_antialiasing===true
  });
  const referenceDimensions=measurement.geometry?.reference||{};
  const metaWidth=finite(input.reference?.artifact?.width,null);
  const metaHeight=finite(input.reference?.artifact?.height,null);
  if(metaWidth!==null&&metaHeight!==null&&(referenceDimensions.width!==metaWidth||referenceDimensions.height!==metaHeight))throw new Error('J7_REFERENCE_PNG_METADATA_DIMENSION_MISMATCH');
  if(referenceDimensions.width!==Number(input.viewport?.width)||referenceDimensions.height!==Number(input.viewport?.height))throw new Error('J7_REFERENCE_VIEWPORT_DIMENSION_MISMATCH');

  const actualGeometry=await adapters.geometry_snapshot({...context,capture,measurement});
  const geometry=compareGeometrySnapshots(input.reference_geometry||{},actualGeometry||{},input.geometry_options||{});
  const typographyRaw=await adapters.typography_score({...context,capture,measurement,geometry});
  const typographyScore=finite(typeof typographyRaw==='object'?typographyRaw.score:typographyRaw,null);
  if(typographyScore===null||typographyScore<0||typographyScore>1)throw new Error('J7_TYPOGRAPHY_SCORE_REQUIRED');

  const semantic=await semanticForCapture(capture,adapters,{...context,measurement,geometry,semantic_options:input.semantic_options});
  const functional=await adapters.functional_regression({...context,capture,measurement,geometry,semantic});
  if(!functional||!['PASS','FAIL'].includes(String(functional.status)))throw new Error('J7_FUNCTIONAL_REGRESSION_STATUS_REQUIRED');

  const viewport=input.viewport;
  const common={reference_id:input.reference.reference_id,implementation_commit:context.commit_sha||input.initial_commit,viewport};
  const rawDeltas=[
    ...deltasFromVisualMeasurement({...common,measurement_report:measurement,severity_thresholds:input.severity_thresholds,ignore_score_above:input.ignore_score_above}),
    ...deltasFromGeometryComparison({...common,geometry_report:geometry})
  ];
  const regionScores=visualMeasurementRegionScores(measurement);
  const visual=evaluateVisualAcceptance({
    measurement_report:measurement,
    geometry_report:geometry,
    deltas:rawDeltas,
    typography_score:typographyScore,
    thresholds:input.thresholds
  });

  return{
    schema:'riosystems.j7-visual-closure-candidate.v1',
    iteration:context.iteration||0,
    commit_sha:context.commit_sha||input.initial_commit,
    capture:{actual_path:actualPath,diff_path:capture.diff_path||null},
    measurement,
    geometry,
    typography_score:typographyScore,
    semantic,
    functional:{
      status:functional.status,
      responsive_status:functional.responsive_status||'PASS',
      accessibility_status:functional.accessibility_status||'PASS',
      evidence:clone(functional.evidence||{})
    },
    raw_deltas:rawDeltas,
    region_scores:regionScores,
    visual_acceptance:visual,
    closure_score:closureScore(visual)
  };
}

export async function runApprovedReferenceVisualClosure(input={},adapters={}){
  const required=['capture','geometry_snapshot','typography_score','functional_regression','root_cause','repair','commit','revert'];
  for(const name of required)if(typeof adapters[name]!=='function')throw new Error('J7_VISUAL_CLOSURE_ADAPTER_REQUIRED:'+name);

  const referenceVerification=await verifyApprovedReferenceVisualAsset(input);
  if(referenceVerification.status!=='PASS'){
    return{
      schema:'riosystems.j7-visual-closure-result.v1',
      status:'BLOCKED_APPROVED_REFERENCE',
      reference_verification:referenceVerification,
      iterations:0,
      human_decision_required:true,
      production_deploy:false
    };
  }

  const initialCommit=clean(input.initial_commit,180);
  const projectPath=clean(input.project_path,500);
  if(!initialCommit)throw new Error('J7_INITIAL_COMMIT_REQUIRED');
  if(!projectPath.startsWith('projects/'))throw new Error('J7_PROJECT_PATH_REQUIRED');
  if(!input.viewport?.width||!input.viewport?.height)throw new Error('J7_VIEWPORT_REQUIRED');
  if(!clean(input.viewport_id,80))throw new Error('J7_VIEWPORT_ID_REQUIRED');
  if(clean(input.viewport_id,80)!==clean(input.reference?.viewport,80))throw new Error('J7_REFERENCE_VIEWPORT_ID_MISMATCH');
  if(!input.reference_geometry?.components)throw new Error('J7_REFERENCE_GEOMETRY_REQUIRED');

  const maxRounds=resolveRounds(input.max_repair_rounds);
  const history=[];
  let current=await evaluateCandidate({...input,initial_commit:initialCommit},adapters,{iteration:0,commit_sha:initialCommit});
  const passing=freezePassingRegions(current.region_scores,{pass_threshold:input.region_pass_threshold??0.96});
  let locks=createSoftRegionLockSet({
    measurement:current.region_scores,
    regions:[...new Set([...(input.locked_regions||[]),...passing])],
    tolerance:input.region_regression_tolerance??0.002
  });

  if(candidatePass(current,locks)){
    return{
      schema:'riosystems.j7-visual-closure-result.v1',
      status:'PASS',
      reference_verification:referenceVerification,
      iterations:0,
      max_repair_rounds:maxRounds,
      final_candidate:current,
      region_locks:locks,
      history,
      human_decision_required:false,
      comparator:'VISUAL_FOUNDRY_ONLY',
      production_deploy:false
    };
  }

  let previousSignature=blockingSignature(current.raw_deltas);

  for(let iteration=1;iteration<=maxRounds;iteration++){
    const classification=await adapters.root_cause({
      iteration,
      deltas:clone(current.raw_deltas),
      measurement:clone(current.measurement),
      geometry:clone(current.geometry),
      semantic:clone(current.semantic),
      history:clone(history)
    });
    const classifications=arr(classification?.classifications||classification);
    const plan=createJ7RootCauseRepairPlan(current.raw_deltas,classifications);
    if(plan.status==='ROOT_CAUSE_REQUIRED'||plan.status==='NO_REPAIR_REQUIRED'){
      return{
        schema:'riosystems.j7-visual-closure-result.v1',
        status:'HUMAN_DECISION_REQUIRED',
        reason:plan.status==='ROOT_CAUSE_REQUIRED'?'UNRESOLVED_VISUAL_ROOT_CAUSE':'NO_SAFE_REPAIR_PLAN',
        reference_verification:referenceVerification,
        iterations:iteration-1,max_repair_rounds:maxRounds,
        final_candidate:current,region_locks:locks,history,repair_plan:plan,
        human_decision_required:true,comparator:'VISUAL_FOUNDRY_ONLY',production_deploy:false
      };
    }

    const repaired=await adapters.repair({iteration,plan,current:clone(current),history:clone(history)});
    const authority=assertVisualRepairAuthority(repaired?.changed_files||[],{
      project_path:projectPath,
      max_files:input.max_files_per_round??12
    });
    const commit=await adapters.commit({iteration,plan,repair:repaired,changed_files:authority.changed_files});
    const commitSha=clean(commit?.commit_sha,180);
    if(!commitSha)throw new Error('J7_REPAIR_COMMIT_REQUIRED');

    const candidate=await evaluateCandidate(input,adapters,{iteration,commit_sha:commitSha,repair:repaired,plan});
    const softCandidate=evaluateSoftLockCandidate(locks,candidate.region_scores);
    const regionGuard=evaluateRegionRegressionGuard({
      before:current.region_scores,
      after:candidate.region_scores,
      protected_regions:arr(locks.regions).map(r=>r.region_id),
      pass_threshold:input.region_pass_threshold??0.96,
      regression_tolerance:input.region_regression_tolerance??0.002
    });

    const globalRegression=candidate.closure_score+finite(input.global_regression_tolerance,0.001)<current.closure_score;
    const semanticFail=candidate.semantic.status!=='PASS';
    const functionalFail=candidate.functional.status!=='PASS'||candidate.functional.responsive_status==='FAIL'||candidate.functional.accessibility_status==='FAIL';
    const lockRegression=regionGuard.status==='REJECT'||softCandidate.warnings.length>0;

    if(semanticFail||functionalFail||lockRegression||globalRegression){
      await adapters.revert({
        iteration,commit_sha:commitSha,reason:semanticFail?'SEMANTIC_GATE_FAILED':functionalFail?'FUNCTIONAL_REGRESSION_FAILED':lockRegression?'REGION_LOCK_REGRESSION':'GLOBAL_VISUAL_REGRESSION',
        candidate:clone(candidate),region_guard:clone(regionGuard),soft_lock:clone(softCandidate)
      });
      history.push({
        iteration,status:'REJECTED',commit_sha:commitSha,phase:plan.phase,changed_files:authority.changed_files,
        reason:semanticFail?'SEMANTIC_GATE_FAILED':functionalFail?'FUNCTIONAL_REGRESSION_FAILED':lockRegression?'REGION_LOCK_REGRESSION':'GLOBAL_VISUAL_REGRESSION',
        closure_score_before:current.closure_score,closure_score_after:candidate.closure_score,
        region_guard:regionGuard,soft_lock:softCandidate
      });
      continue;
    }

    const enriched=enrichJ7VisualDeltas(candidate.raw_deltas,classifications);
    const signature=blockingSignature(enriched);
    const noProgress=signature===previousSignature&&candidate.closure_score<=current.closure_score+finite(input.minimum_global_improvement,0.0001);

    if(noProgress){
      await adapters.revert({iteration,commit_sha:commitSha,reason:'NO_DETERMINISTIC_DELTA_PROGRESS',candidate:clone(candidate)});
      history.push({iteration,status:'REJECTED',commit_sha:commitSha,phase:plan.phase,changed_files:authority.changed_files,reason:'NO_DETERMINISTIC_DELTA_PROGRESS'});
      return{
        schema:'riosystems.j7-visual-closure-result.v1',
        status:'HUMAN_DECISION_REQUIRED',
        reason:'NO_DETERMINISTIC_DELTA_PROGRESS',
        reference_verification:referenceVerification,
        iterations:iteration,max_repair_rounds:maxRounds,
        final_candidate:current,region_locks:locks,history,
        human_decision_required:true,comparator:'VISUAL_FOUNDRY_ONLY',production_deploy:false
      };
    }

    locks=ensureSoftLocks(locks,candidate.region_scores,{
      pass_threshold:input.region_pass_threshold??0.96,
      tolerance:input.region_regression_tolerance??0.002
    });
    history.push({
      iteration,status:'ACCEPTED',commit_sha:commitSha,phase:plan.phase,changed_files:authority.changed_files,
      closure_score_before:current.closure_score,closure_score_after:candidate.closure_score,
      blocking_before:current.raw_deltas.filter(d=>d.blocking).length,
      blocking_after:candidate.raw_deltas.filter(d=>d.blocking).length,
      region_guard:regionGuard,soft_lock:softCandidate,
      order:['root_cause','repair','commit','capture','visual_foundry_compare','delta_resegment','semantic_gate','functional_regression','lock_finalization']
    });
    current=candidate;
    previousSignature=signature;

    if(candidatePass(current,locks)){
      return{
        schema:'riosystems.j7-visual-closure-result.v1',
        status:'PASS',
        reference_verification:referenceVerification,
        iterations:iteration,max_repair_rounds:maxRounds,
        final_candidate:current,region_locks:locks,history,
        human_decision_required:false,comparator:'VISUAL_FOUNDRY_ONLY',production_deploy:false
      };
    }
  }

  return{
    schema:'riosystems.j7-visual-closure-result.v1',
    status:'HUMAN_DECISION_REQUIRED',
    reason:'BOUNDED_REPAIR_ROUNDS_EXHAUSTED',
    reference_verification:referenceVerification,
    iterations:maxRounds,max_repair_rounds:maxRounds,
    final_candidate:current,region_locks:locks,history,
    human_decision_required:true,comparator:'VISUAL_FOUNDRY_ONLY',production_deploy:false
  };
}

export function visualClosureLoopManifest(){
  return{
    schema:'riosystems.j7-visual-closure-loop-manifest.v1',
    pipeline:['APPROVED_REFERENCE','BUILD','SCREENSHOT','VISUAL_FOUNDRY_COMPARE','DELTA_SEGMENT','ROOT_CAUSE','REPAIR_PLAN','BOUNDED_REPAIR','REBUILD','RESCREENSHOT','RECOMPARE'],
    comparator:'VISUAL_FOUNDRY_ONLY',
    delta_types:[...J7_VISUAL_DELTA_TYPES],
    default_max_repair_rounds:J7_DEFAULT_MAX_REPAIR_ROUNDS,
    hard_max_repair_rounds:J7_HARD_MAX_REPAIR_ROUNDS,
    region_locks:true,
    semantic_gate:true,
    functional_regression:true,
    approved_reference_required:true,
    reference_asset_sha256_required:true,
    infinite_loop_allowed:false,
    visual_pass_without_approved_reference:false,
    global_score_may_override_critical_region:false,
    production_deploy:false,
    public_launch:false,
    dns_change:false,
    billing_activation:false,
    automatic_paid_activation:false,
    external_writes:false
  };
}
