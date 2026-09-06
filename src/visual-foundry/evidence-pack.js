import crypto from 'node:crypto';

const REQUIRED_FIELDS=Object.freeze([
  'reference_id','reference_version','reference_hash','fixture_version','implementation_commit',
  'browser_version','viewport','dpr','font_manifest','runtime_screenshot','reference_screenshot','diff_image',
  'geometry_snapshot','visual_score','geometry_score','perceptual_score','pixel_difference','typography_score',
  'color_score','critical_deltas','iteration','provider','model','input_tokens','output_tokens','ai_cost',
  'runtime_cost','duration','changed_files','functional_result','visual_result','responsive_result','human_result'
]);

const clean=(v,max=2000)=>String(v??'').trim().slice(0,max);
const clone=v=>structuredClone(v);
const num=(v,fallback=null)=>Number.isFinite(Number(v))?Number(v):fallback;

export function buildVisualEvidencePack(input={}){
  const missing=REQUIRED_FIELDS.filter(key=>!Object.prototype.hasOwnProperty.call(input,key));
  if(missing.length) throw new Error('VISUAL_EVIDENCE_REQUIRED_FIELDS_MISSING:'+missing.join(','));
  const pack={
    schema:'riosystems.visual-evidence-pack.v1',
    evidence_id:clean(input.evidence_id||'vep-'+crypto.randomUUID(),180),
    generated_at:clean(input.generated_at||new Date().toISOString(),80),
    reference_id:clean(input.reference_id,180),
    reference_version:clean(input.reference_version,80),
    reference_hash:clean(input.reference_hash,180),
    fixture_version:input.fixture_version==null?null:clean(input.fixture_version,120),
    implementation_commit:clean(input.implementation_commit,180),
    browser_version:clean(input.browser_version,180),
    viewport:clone(input.viewport),
    dpr:num(input.dpr),
    font_manifest:clone(input.font_manifest),
    runtime_screenshot:clean(input.runtime_screenshot,1200),
    reference_screenshot:clean(input.reference_screenshot,1200),
    diff_image:clean(input.diff_image,1200),
    geometry_snapshot:clone(input.geometry_snapshot),
    visual_score:num(input.visual_score),
    geometry_score:num(input.geometry_score),
    perceptual_score:num(input.perceptual_score),
    pixel_difference:num(input.pixel_difference),
    typography_score:num(input.typography_score),
    color_score:num(input.color_score),
    critical_deltas:clone(input.critical_deltas),
    blocking_deltas:clone(input.blocking_deltas??[]),
    iteration:num(input.iteration,0),
    provider:input.provider==null?null:clean(input.provider,180),
    model:input.model==null?null:clean(input.model,180),
    input_tokens:num(input.input_tokens,0),
    output_tokens:num(input.output_tokens,0),
    ai_cost:num(input.ai_cost,0),
    runtime_cost:num(input.runtime_cost,0),
    duration:num(input.duration,0),
    changed_files:clone(input.changed_files),
    functional_result:clean(input.functional_result,80),
    visual_result:clean(input.visual_result,80),
    responsive_result:clean(input.responsive_result,80),
    accessibility_result:clean(input.accessibility_result??'NOT_EVALUATED',80),
    human_result:clean(input.human_result,80),
    asset_result:clean(input.asset_result??'NOT_EVALUATED',80),
    fixture_truth_class:input.fixture_truth_class??null,
    provider_result:clone(input.provider_result??null),
    thresholds:clone(input.thresholds??null),
    production_deploy:false,
    external_writes:false,
    acceptance_recalculated:false
  };
  const validation=validateVisualEvidencePack(pack);
  if(!validation.ok) throw new Error('VISUAL_EVIDENCE_INVALID:'+validation.issues.join(','));
  return pack;
}

export function validateVisualEvidencePack(pack={}){
  const issues=[];
  if(pack.schema!=='riosystems.visual-evidence-pack.v1') issues.push('VISUAL_EVIDENCE_SCHEMA_INVALID');
  for(const key of ['evidence_id','reference_id','reference_version','reference_hash','implementation_commit','browser_version','runtime_screenshot','reference_screenshot','diff_image']){
    if(!clean(pack[key],2000)) issues.push('VISUAL_EVIDENCE_FIELD_EMPTY:'+key);
  }
  if(!pack.viewport||!Number.isFinite(Number(pack.viewport.width))||!Number.isFinite(Number(pack.viewport.height))) issues.push('VISUAL_EVIDENCE_VIEWPORT_INVALID');
  if(!Number.isFinite(Number(pack.dpr))) issues.push('VISUAL_EVIDENCE_DPR_INVALID');
  if(!Array.isArray(pack.font_manifest)) issues.push('VISUAL_EVIDENCE_FONT_MANIFEST_INVALID');
  if(!Array.isArray(pack.critical_deltas)) issues.push('VISUAL_EVIDENCE_CRITICAL_DELTAS_INVALID');
  if(!Array.isArray(pack.changed_files)) issues.push('VISUAL_EVIDENCE_CHANGED_FILES_INVALID');
  for(const key of ['visual_score','geometry_score','perceptual_score','pixel_difference','typography_score','color_score','iteration','input_tokens','output_tokens','ai_cost','runtime_cost','duration']){
    if(!Number.isFinite(Number(pack[key]))) issues.push('VISUAL_EVIDENCE_NUMBER_INVALID:'+key);
  }
  if(pack.production_deploy!==false) issues.push('VISUAL_EVIDENCE_PRODUCTION_MUST_BE_FALSE');
  if(pack.acceptance_recalculated!==false) issues.push('VISUAL_EVIDENCE_MUST_NOT_RECALCULATE_ACCEPTANCE');
  return {ok:issues.length===0,issues};
}

function avg(values=[]){
  const nums=values.map(Number).filter(Number.isFinite);
  return nums.length?nums.reduce((a,b)=>a+b,0)/nums.length:0;
}

export function buildVisualObservabilitySnapshot(packs=[]){
  const items=(Array.isArray(packs)?packs:[]).filter(p=>validateVisualEvidencePack(p).ok);
  const statusCounts={};
  const providers={};
  for(const pack of items){
    const key=pack.visual_result||'UNKNOWN';
    statusCounts[key]=(statusCounts[key]||0)+1;
    const provider=pack.provider||'LOCAL_DETERMINISTIC';
    const p=providers[provider]||{runs:0,ai_cost:0,input_tokens:0,output_tokens:0,duration:0};
    p.runs+=1;p.ai_cost+=pack.ai_cost;p.input_tokens+=pack.input_tokens;p.output_tokens+=pack.output_tokens;p.duration+=pack.duration;
    providers[provider]=p;
  }
  return {
    schema:'riosystems.visual-foundry-observability.v1',
    generated_at:new Date().toISOString(),
    runs_total:items.length,
    visual_results:statusCounts,
    average_visual_score:avg(items.map(x=>x.visual_score)),
    average_geometry_score:avg(items.map(x=>x.geometry_score)),
    average_perceptual_score:avg(items.map(x=>x.perceptual_score)),
    average_pixel_difference:avg(items.map(x=>x.pixel_difference)),
    total_ai_cost:items.reduce((s,x)=>s+x.ai_cost,0),
    total_runtime_cost:items.reduce((s,x)=>s+x.runtime_cost,0),
    average_duration:avg(items.map(x=>x.duration)),
    provider_usage:providers,
    critical_delta_total:items.reduce((s,x)=>s+x.critical_deltas.length,0),
    acceptance_source:'RECORDED_RESULTS_ONLY',
    fake_success_inference:false
  };
}

export function visualEvidenceManifest(){
  return {schema:'riosystems.visual-evidence-manifest.v1',required_fields:[...REQUIRED_FIELDS],acceptance_recalculated:false};
}
