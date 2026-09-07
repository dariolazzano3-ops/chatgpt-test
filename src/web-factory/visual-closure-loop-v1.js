import { verifyApprovedReferenceLock } from './reference-studio-v1.js';
import { createScreenshotComparisonJob, runScreenshotComparison } from './screenshot-comparison.js';
import { runVisualRepairLoop } from './visual-repair.js';

export const VISUAL_DELTA_TYPES=Object.freeze([
  'typography','position','spacing','size','color','background','asset','crop','border','radius','shadow',
  'responsive','missing','extra','motion'
]);

const deltaTypes=new Set(VISUAL_DELTA_TYPES);
const arr=(v)=>Array.isArray(v)?v:[];
const obj=(v)=>v&&typeof v==='object'&&!Array.isArray(v)?structuredClone(v):{};
const text=(v,max=1000)=>String(v??'').replace(/\s+/g,' ').trim().slice(0,max);
const clone=(v)=>v==null?v:structuredClone(v);

function inferType(delta={}){
  const explicit=text(delta.type||delta.delta_type||delta.category,80).toLowerCase();
  if(deltaTypes.has(explicit))return explicit;
  const corpus=(text(delta.path,500)+' '+text(delta.code,300)+' '+text(delta.message,500)).toLowerCase();
  if(/font|typograph|line-height|letter-spacing|text-size/.test(corpus))return 'typography';
  if(/left|right|top|bottom|position|translate|offset|\bx\b|\by\b/.test(corpus))return 'position';
  if(/margin|padding|gap|spacing|space-/.test(corpus))return 'spacing';
  if(/width|height|size|dimension|max-width|min-height/.test(corpus))return 'size';
  if(/background/.test(corpus))return 'background';
  if(/color|foreground|fill|stroke/.test(corpus))return 'color';
  if(/focal|crop|object-position|object-fit/.test(corpus))return 'crop';
  if(/asset|image|media|source|src/.test(corpus))return 'asset';
  if(/border/.test(corpus))return 'border';
  if(/radius|rounded|corner/.test(corpus))return 'radius';
  if(/shadow|box-shadow/.test(corpus))return 'shadow';
  if(/breakpoint|responsive|media-query|viewport/.test(corpus))return 'responsive';
  if(/missing|not-found|absent/.test(corpus))return 'missing';
  if(/extra|unexpected|duplicate/.test(corpus))return 'extra';
  if(/motion|animation|transition|parallax|marquee/.test(corpus))return 'motion';
  return null;
}

function rootCauseFor(type){
  if(type==='typography')return 'TYPOGRAPHY_TOKENS';
  if(['position','spacing','size'].includes(type))return 'LAYOUT_GEOMETRY';
  if(['color','background','border','radius','shadow'].includes(type))return 'STYLE_TOKENS';
  if(['asset','crop'].includes(type))return 'ASSET_MEDIA';
  if(type==='responsive')return 'RESPONSIVE_RULES';
  if(['missing','extra'].includes(type))return 'COMPOSITION';
  if(type==='motion')return 'MOTION_CONTRACT';
  return 'UNCLASSIFIED';
}

function regionId(delta={}){
  return text(delta.region_id||delta.region||delta.lock_region,180)||null;
}

function lockMatches(delta,lock){
  if(lock.accepted!==true&&lock.locked!==true)return false;
  const id=regionId(delta);
  if(id&&text(lock.region_id||lock.id,180)===id)return true;
  const path=text(delta.path,500);
  return arr(lock.path_prefixes||lock.paths).some(prefix=>path.startsWith(text(prefix,500)));
}

function normalizeDelta(delta,index,locks=[]){
  const type=inferType(delta);
  const lock=arr(locks).find(item=>lockMatches(delta,item));
  return{
    delta_id:text(delta.delta_id||delta.id||('delta-'+(index+1)),180),
    viewport:clone(delta.viewport||null),
    region_id:regionId(delta),
    type,
    classified:Boolean(type),
    root_cause:rootCauseFor(type),
    path:text(delta.path,500)||null,
    code:text(delta.code,180)||null,
    message:text(delta.message,1000)||null,
    expected:clone(delta.expected),
    actual:clone(delta.actual),
    severity:text(delta.severity||'BLOCK',40).toUpperCase(),
    repairable:delta.repairable!==false&&Boolean(type)&&!lock,
    locked_region:Boolean(lock),
    lock_id:lock?text(lock.lock_id||lock.id||lock.region_id,180):null,
    raw:clone(delta)
  };
}

function comparisonDifferences(report={}){
  const direct=arr(report.differences);
  if(direct.length)return direct;
  return arr(report.metrics).flatMap(item=>{
    const viewport=item.viewport||null;
    return arr(item.comparison?.differences).map(delta=>({...delta,viewport:delta.viewport||viewport}));
  });
}

function comparisonPass(report={}){
  if(report.executed!==true)return false;
  if(report.status==='PASS'||report.pass===true)return true;
  const metrics=arr(report.metrics);
  if(metrics.length){
    return metrics.every(item=>{
      const c=item.comparison||{};
      if(c.pass===true||c.status==='PASS')return true;
      if(Number.isFinite(Number(c.pixel_diff_ratio)))return Number(c.pixel_diff_ratio)<=0;
      if(Number.isFinite(Number(c.pixel_diff_percent)))return Number(c.pixel_diff_percent)<=0;
      if(Number.isFinite(Number(c.pixel_difference)))return Number(c.pixel_difference)<=0;
      return false;
    });
  }
  return false;
}

export function segmentVisualDeltas(report={},options={}){
  const locks=arr(options.region_locks||options.locks);
  const deltas=comparisonDifferences(report).map((delta,index)=>normalizeDelta(delta,index,locks));
  const unclassified=deltas.filter(d=>!d.classified);
  const locked=deltas.filter(d=>d.locked_region);
  const repairable=deltas.filter(d=>d.repairable);
  const byType=Object.fromEntries(VISUAL_DELTA_TYPES.map(type=>[type,deltas.filter(d=>d.type===type)]));
  return{
    schema:'riosystems.visual-delta-segmentation.v1',
    executed:report.executed===true,
    comparison_pass:comparisonPass(report),
    deltas,
    by_type:byType,
    repairable_delta_ids:repairable.map(d=>d.delta_id),
    locked_region_delta_ids:locked.map(d=>d.delta_id),
    unclassified_delta_ids:unclassified.map(d=>d.delta_id),
    blocking_delta_count:deltas.length,
    production_deploy:false
  };
}

export function createVisualRootCauseReport(segmentation={}){
  const groups={};
  for(const delta of arr(segmentation.deltas)){
    const cause=delta.root_cause||'UNCLASSIFIED';
    if(!groups[cause])groups[cause]=[];
    groups[cause].push(delta.delta_id);
  }
  return{
    schema:'riosystems.visual-root-cause-report.v1',
    root_causes:Object.entries(groups).map(([root_cause,delta_ids])=>({
      root_cause,
      delta_ids,
      repairable:root_cause!=='UNCLASSIFIED'
    })),
    unclassified_delta_ids:arr(segmentation.unclassified_delta_ids),
    locked_region_delta_ids:arr(segmentation.locked_region_delta_ids),
    production_deploy:false
  };
}

export function createBoundedVisualRepairPlan(segmentation={},rootCause={},options={}){
  const maxRounds=Math.max(0,Math.min(5,Number(options.max_auto_repair_rounds??3)));
  const locked=new Set(arr(segmentation.locked_region_delta_ids));
  const unclassified=new Set(arr(segmentation.unclassified_delta_ids));
  const repairs=arr(segmentation.deltas).filter(delta=>delta.repairable&&!locked.has(delta.delta_id)&&!unclassified.has(delta.delta_id)).map(delta=>({
    delta_id:delta.delta_id,
    type:delta.type,
    root_cause:delta.root_cause,
    path:delta.path,
    expected:clone(delta.expected),
    actual:clone(delta.actual),
    region_id:delta.region_id,
    bounded:true
  }));
  const blockers=[];
  if(locked.size)blockers.push({code:'LOCKED_REGION_REGRESSION',delta_ids:[...locked]});
  if(unclassified.size)blockers.push({code:'UNCLASSIFIED_VISUAL_DELTA',delta_ids:[...unclassified]});
  if(!repairs.length&&arr(segmentation.deltas).length)blockers.push({code:'NO_SAFE_AUTO_REPAIR_AVAILABLE'});
  return{
    schema:'riosystems.bounded-visual-repair-plan.v1',
    repairs,
    root_causes:clone(rootCause.root_causes||[]),
    blockers,
    max_auto_repair_rounds:maxRounds,
    automatic_reference_mutation_allowed:false,
    locked_region_regression_allowed:false,
    human_review_required:blockers.length>0,
    production_deploy:false
  };
}

export function createVisualClosureContract(input={}){
  const reference=input.approved_reference||input.reference;
  const verification=verifyApprovedReferenceLock(reference||{});
  const maxRounds=Math.max(0,Math.min(5,Number(input.max_auto_repair_rounds??3)));
  const viewports=arr(input.viewports).length?clone(input.viewports):[
    {id:'desktop',width:1440,height:1200}
  ];
  return{
    ok:verification.ok,
    status:verification.ok?'VISUAL_CLOSURE_CONTRACT_READY':'VALID_APPROVED_REFERENCE_REQUIRED',
    contract:{
      schema:'riosystems.full-visual-closure-contract.v1',
      project_scope:reference?.project_scope||input.project_scope||null,
      approved_reference:verification.ok?{
        reference_id:reference.reference_id,
        version:reference.version,
        hash:reference.hash,
        viewport:reference.viewport
      }:null,
      pipeline:[
        'APPROVED_REFERENCE','BUILD','SCREENSHOT','EXISTING_SCREENSHOT_COMPARE','DELTA_SEGMENTATION',
        'ROOT_CAUSE','BOUNDED_REPAIR','REBUILD','RECOMPARE','HUMAN_REVIEW_IF_REQUIRED'
      ],
      visual_comparison_engine:'riosystems.screenshot-comparison-job.v1',
      duplicate_visual_comparator_created:false,
      region_locks:clone(input.region_locks||[]),
      viewports,
      max_auto_repair_rounds:maxRounds,
      infinite_loop_allowed:false,
      automatic_reference_mutation_allowed:false,
      human_review_after_exhaustion:true,
      production_deploy:false
    },
    reference_verification:verification,
    production_deploy:false,
    variable_cost_eur:0
  };
}

function defaultRepair(current,plan,reference,options){
  if(!current?.artifact||!current?.implementation)return null;
  const paths=new Set(plan.repairs.map(r=>r.path).filter(Boolean));
  if(!paths.size)return null;
  const structured=runVisualRepairLoop(current,reference,{
    max_attempts:1,
    level:options.fidelity_level||'PREMIUM',
    screenshot_report:options.screenshot_report
  });
  return{
    artifact:structured.artifact,
    implementation:structured.implementation,
    structured_repair:structured,
    source:current.source||current.generated_source||null
  };
}

export async function runFullVisualClosureLoop(input={},adapters={},options={}){
  const setup=createVisualClosureContract({...input,...options});
  if(!setup.ok)return{
    ok:false,
    status:'VALID_APPROVED_REFERENCE_REQUIRED',
    contract:setup.contract,
    reference_verification:setup.reference_verification,
    rounds:[],
    production_deploy:false
  };
  if(typeof adapters.capture!=='function'||typeof adapters.compare!=='function'){
    return{
      ok:false,
      status:'VISUAL_RUNTIME_REQUIRED',
      contract:setup.contract,
      rounds:[],
      blocker:{code:'BROWSER_SCREENSHOT_RUNTIME_REQUIRED'},
      pixel_comparison_claimed:false,
      production_deploy:false
    };
  }

  const reference=input.approved_reference||input.reference;
  const maxRounds=setup.contract.max_auto_repair_rounds;
  let current=clone(input.build||input.generated||{});
  const rounds=[];
  let lastSegmentation=null;
  let lastComparison=null;

  for(let round=0;round<=maxRounds;round++){
    const generatedSource=current.source||current.generated_source||input.generated_source||current;
    const job=createScreenshotComparisonJob({
      design_id:input.design_id||reference.reference_id,
      project_id:input.project_id||reference.project_scope,
      reference_source:input.reference_source||reference.artifact?.render_asset_ref||reference,
      generated_source:generatedSource,
      viewports:setup.contract.viewports
    });
    const comparison=await runScreenshotComparison(job,{
      capture:adapters.capture,
      compare:adapters.compare
    });
    lastComparison=comparison;
    const segmentation=segmentVisualDeltas(comparison,{region_locks:setup.contract.region_locks});
    lastSegmentation=segmentation;
    const rootCause=createVisualRootCauseReport(segmentation);

    if(comparisonPass(comparison)&&segmentation.deltas.length===0){
      rounds.push({
        round,
        comparison,
        segmentation,
        root_cause:rootCause,
        repair_plan:null,
        outcome:'PASS'
      });
      return{
        ok:true,
        status:'VISUAL_CLOSURE_PASS',
        contract:setup.contract,
        rounds,
        final_comparison:comparison,
        final_segmentation:segmentation,
        auto_repair_rounds:round,
        human_review_required:false,
        pixel_comparison_claimed:true,
        production_deploy:false
      };
    }

    const plan=createBoundedVisualRepairPlan(segmentation,rootCause,{max_auto_repair_rounds:maxRounds});
    if(plan.human_review_required){
      rounds.push({
        round,
        comparison,
        segmentation,
        root_cause:rootCause,
        repair_plan:plan,
        outcome:'HUMAN_REVIEW_REQUIRED'
      });
      return{
        ok:false,
        status:'HUMAN_REVIEW_REQUIRED',
        contract:setup.contract,
        rounds,
        final_comparison:comparison,
        final_segmentation:segmentation,
        blockers:plan.blockers,
        auto_repair_rounds:round,
        human_review_required:true,
        pixel_comparison_claimed:comparison.executed===true,
        production_deploy:false
      };
    }

    if(round>=maxRounds){
      rounds.push({
        round,
        comparison,
        segmentation,
        root_cause:rootCause,
        repair_plan:plan,
        outcome:'AUTO_REPAIR_EXHAUSTED'
      });
      break;
    }

    let repaired;
    if(typeof adapters.repair==='function'){
      repaired=await adapters.repair({
        build:clone(current),
        repair_plan:clone(plan),
        segmentation:clone(segmentation),
        root_cause:clone(rootCause),
        reference:clone(reference),
        round
      });
    }else{
      repaired=defaultRepair(current,plan,input.structured_reference||input.design_reference||{},options);
    }
    if(!repaired){
      rounds.push({
        round,
        comparison,
        segmentation,
        root_cause:rootCause,
        repair_plan:plan,
        outcome:'REPAIR_RUNTIME_REQUIRED'
      });
      return{
        ok:false,
        status:'HUMAN_REVIEW_REQUIRED',
        contract:setup.contract,
        rounds,
        blockers:[{code:'REPAIR_RUNTIME_REQUIRED'}],
        final_comparison:comparison,
        final_segmentation:segmentation,
        auto_repair_rounds:round,
        human_review_required:true,
        pixel_comparison_claimed:comparison.executed===true,
        production_deploy:false
      };
    }

    const rebuilt=typeof adapters.rebuild==='function'
      ? await adapters.rebuild({build:clone(repaired),repair_plan:clone(plan),round})
      : repaired;
    rounds.push({
      round,
      comparison,
      segmentation,
      root_cause:rootCause,
      repair_plan:plan,
      outcome:'REPAIRED_AND_REBUILT'
    });
    current=clone(rebuilt);
  }

  return{
    ok:false,
    status:'HUMAN_REVIEW_REQUIRED',
    contract:setup.contract,
    rounds,
    final_comparison:lastComparison,
    final_segmentation:lastSegmentation,
    blockers:[{code:'AUTO_REPAIR_ROUNDS_EXHAUSTED',max_auto_repair_rounds:maxRounds}],
    auto_repair_rounds:maxRounds,
    human_review_required:true,
    pixel_comparison_claimed:lastComparison?.executed===true,
    production_deploy:false
  };
}

export function visualClosureLoopManifest(){
  return{
    schema:'riosystems.full-visual-closure-manifest.v1',
    extends:[
      'riosystems.screenshot-comparison-job.v1',
      'riosystems.visual-repair-result.v1'
    ],
    delta_types:[...VISUAL_DELTA_TYPES],
    root_causes:[
      'TYPOGRAPHY_TOKENS','LAYOUT_GEOMETRY','STYLE_TOKENS','ASSET_MEDIA','RESPONSIVE_RULES',
      'COMPOSITION','MOTION_CONTRACT','UNCLASSIFIED'
    ],
    duplicate_visual_comparator_created:false,
    existing_visual_comparison_engine_reused:true,
    region_locks_supported:true,
    locked_region_regression_allowed:false,
    bounded_auto_repair:true,
    max_supported_auto_repair_rounds:5,
    infinite_loop_allowed:false,
    automatic_reference_mutation_allowed:false,
    human_review_after_exhaustion:true,
    production_deploy:false
  };
}
