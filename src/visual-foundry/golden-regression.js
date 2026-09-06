import crypto from 'node:crypto';

const clean=(v,max=1000)=>String(v??'').trim().slice(0,max);
const clone=v=>structuredClone(v);

function requirePass(value,code){
  if(String(value)!=='PASS') throw new Error(code);
}

function deepFreeze(value){
  if(!value||typeof value!=='object'||Object.isFrozen(value)) return value;
  Object.freeze(value);
  for(const child of Object.values(value)) deepFreeze(child);
  return value;
}

export function createGoldenBaseline(input={}){
  requirePass(input.visual_acceptance,'GOLDEN_VISUAL_ACCEPTANCE_REQUIRED');
  requirePass(input.functional_acceptance,'GOLDEN_FUNCTIONAL_ACCEPTANCE_REQUIRED');
  requirePass(input.responsive_acceptance,'GOLDEN_RESPONSIVE_ACCEPTANCE_REQUIRED');
  requirePass(input.accessibility_acceptance,'GOLDEN_ACCESSIBILITY_ACCEPTANCE_REQUIRED');
  requirePass(input.human_visual_approval,'GOLDEN_HUMAN_VISUAL_APPROVAL_REQUIRED');

  const referenceId=clean(input.reference_id,180);
  const referenceVersion=clean(input.reference_version,80);
  const screenshotPath=clean(input.approved_runtime_screenshot,1000);
  const screenshotHash=clean(input.approved_runtime_screenshot_hash,180);
  const commit=clean(input.implementation_commit,180);
  if(!referenceId||!referenceVersion) throw new Error('GOLDEN_REFERENCE_REQUIRED');
  if(!screenshotPath||!screenshotHash) throw new Error('GOLDEN_SCREENSHOT_REQUIRED');
  if(!commit) throw new Error('GOLDEN_IMPLEMENTATION_COMMIT_REQUIRED');

  return deepFreeze({
    schema:'riosystems.golden-visual-baseline.v1',
    golden_id:clean(input.golden_id||'golden-'+crypto.randomUUID(),180),
    project_id:clean(input.project_id,180),
    reference_id:referenceId,
    reference_version:referenceVersion,
    reference_hash:clean(input.reference_hash,180)||null,
    source_phase:'INITIAL_REFERENCE_REPLICATION',
    approved_runtime_screenshot:screenshotPath,
    approved_runtime_screenshot_hash:screenshotHash,
    implementation_commit:commit,
    browser_environment:clone(input.browser_environment??{}),
    approved_at:clean(input.approved_at||new Date().toISOString(),80),
    approved_by:clean(input.approved_by,240),
    visual_acceptance:'PASS',
    functional_acceptance:'PASS',
    responsive_acceptance:'PASS',
    accessibility_acceptance:'PASS',
    human_visual_approval:'PASS',
    regression_role:'POST_APPROVAL_VISUAL_REGRESSION',
    reference_understanding_replaced:false,
    immutable:true
  });
}

export function validateGoldenBaseline(golden={}){
  const issues=[];
  if(golden.schema!=='riosystems.golden-visual-baseline.v1') issues.push('GOLDEN_SCHEMA_INVALID');
  if(golden.source_phase!=='INITIAL_REFERENCE_REPLICATION') issues.push('GOLDEN_SOURCE_PHASE_INVALID');
  if(golden.regression_role!=='POST_APPROVAL_VISUAL_REGRESSION') issues.push('GOLDEN_REGRESSION_ROLE_INVALID');
  if(golden.reference_understanding_replaced!==false) issues.push('GOLDEN_MUST_NOT_REPLACE_REFERENCE_UNDERSTANDING');
  for(const key of ['visual_acceptance','functional_acceptance','responsive_acceptance','accessibility_acceptance','human_visual_approval']) if(golden[key]!=='PASS') issues.push('GOLDEN_ACCEPTANCE_INVALID:'+key);
  if(!clean(golden.approved_runtime_screenshot_hash,180)) issues.push('GOLDEN_SCREENSHOT_HASH_REQUIRED');
  return {ok:issues.length===0,issues};
}

export function evaluateGoldenRegression(input={}){
  const golden=input.golden;
  const valid=validateGoldenBaseline(golden||{});
  if(!valid.ok) throw new Error('GOLDEN_BASELINE_INVALID:'+valid.issues.join(','));
  const report=input.measurement_report;
  if(!report||report.schema!=='riosystems.visual-measurement-report.v1'){
    return {schema:'riosystems.visual-regression-report.v1',status:'NOT_EVALUATED',reason:'DETERMINISTIC_MEASUREMENT_REQUIRED',golden_id:golden.golden_id};
  }
  const thresholds={
    perceptual_score_min:Number(input.thresholds?.perceptual_score_min??0.99),
    pixel_difference_percent_max:Number(input.thresholds?.pixel_difference_percent_max??1),
    color_score_min:Number(input.thresholds?.color_score_min??0.99),
    edge_score_min:Number(input.thresholds?.edge_score_min??0.99),
    critical_delta_count_max:Number(input.thresholds?.critical_delta_count_max??0)
  };
  const critical=Number(input.critical_delta_count??0);
  const checks=[
    {id:'dimensions_equal',pass:report.geometry?.dimensions_equal===true,actual:report.geometry?.dimensions_equal,required:true},
    {id:'perceptual_score',pass:Number(report.perceptual?.score)>=thresholds.perceptual_score_min,actual:Number(report.perceptual?.score),required:thresholds.perceptual_score_min},
    {id:'pixel_difference',pass:Number(report.pixel_difference?.percent)<=thresholds.pixel_difference_percent_max,actual:Number(report.pixel_difference?.percent),required:thresholds.pixel_difference_percent_max},
    {id:'color_score',pass:Number(report.color?.score)>=thresholds.color_score_min,actual:Number(report.color?.score),required:thresholds.color_score_min},
    {id:'edge_score',pass:Number(report.edge?.score)>=thresholds.edge_score_min,actual:Number(report.edge?.score),required:thresholds.edge_score_min},
    {id:'critical_delta_count',pass:critical<=thresholds.critical_delta_count_max,actual:critical,required:thresholds.critical_delta_count_max}
  ];
  const failed=checks.filter(x=>!x.pass);
  return {
    schema:'riosystems.visual-regression-report.v1',
    mode:'POST_APPROVAL_VISUAL_REGRESSION',
    status:failed.length?'FAIL':'PASS',
    golden_id:golden.golden_id,
    reference_id:golden.reference_id,
    implementation_commit:clean(input.implementation_commit,180)||null,
    thresholds,
    checks,
    failed_checks:failed.map(x=>x.id),
    initial_reference_replication_reopened:false,
    golden_is_regression_baseline_only:true
  };
}
