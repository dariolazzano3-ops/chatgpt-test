import { createVisualDelta, validateVisualDelta } from './visual-delta.js';

export const SEMANTIC_VISUAL_FINDING_TYPES = Object.freeze([
  'VISUAL_HIERARCHY',
  'DENSITY',
  'FOCUS',
  'MISSING_VISUAL_ELEMENT',
  'UNEXPECTED_REINTERPRETATION',
  'STYLISTIC_DRIFT'
]);

const FINDING_CATEGORY = Object.freeze({
  VISUAL_HIERARCHY:'STRUCTURE',
  DENSITY:'STRUCTURE',
  FOCUS:'STRUCTURE',
  MISSING_VISUAL_ELEMENT:'CONTENT',
  UNEXPECTED_REINTERPRETATION:'STRUCTURE',
  STYLISTIC_DRIFT:'EFFECT'
});

const clean=(v,max=1200)=>String(v??'').trim().slice(0,max);
const clone=v=>structuredClone(v);

export function createSemanticVisualReviewRequest(input={}){
  if(!clean(input.reference_id,180)) throw new Error('SEMANTIC_REVIEW_REFERENCE_ID_REQUIRED');
  if(!clean(input.implementation_commit,180)) throw new Error('SEMANTIC_REVIEW_IMPLEMENTATION_COMMIT_REQUIRED');
  const referenceImage=clean(input.reference_image,1000);
  const runtimeImage=clean(input.runtime_image,1000);
  if(!referenceImage||!runtimeImage) throw new Error('SEMANTIC_REVIEW_IMAGES_REQUIRED');
  return {
    schema:'riosystems.semantic-visual-review-request.v1',
    task:'SEMANTIC_VISUAL_REVIEW',
    reference_id:clean(input.reference_id,180),
    implementation_commit:clean(input.implementation_commit,180),
    viewport:clone(input.viewport||{}),
    reference_image:referenceImage,
    runtime_image:runtimeImage,
    regions:Array.isArray(input.regions)?clone(input.regions):[],
    deterministic_delta_ids:Array.isArray(input.deterministic_deltas)?input.deterministic_deltas.map(x=>x.delta_id).filter(Boolean):[],
    allowed_findings:[...SEMANTIC_VISUAL_FINDING_TYPES],
    deterministic_fail_override_allowed:false,
    deterministic_delta_deletion_allowed:false
  };
}

function normalizeFinding(finding={}){
  const type=clean(finding.type,80).toUpperCase();
  if(!SEMANTIC_VISUAL_FINDING_TYPES.includes(type)) throw new Error('SEMANTIC_FINDING_TYPE_INVALID:'+type);
  const severity=clean(finding.severity||'MEDIUM',40).toUpperCase();
  if(!['INFO','LOW','MEDIUM','HIGH','CRITICAL'].includes(severity)) throw new Error('SEMANTIC_FINDING_SEVERITY_INVALID');
  return {
    type,
    severity,
    region:finding.region?clean(finding.region,180):null,
    component_id:finding.component_id?clean(finding.component_id,180):null,
    summary:clean(finding.summary,1200),
    expected:clone(finding.expected??null),
    actual:clone(finding.actual??null),
    repair_hint:finding.repair_hint?clean(finding.repair_hint,1200):null,
    confidence:Number.isFinite(Number(finding.confidence))?Math.max(0,Math.min(1,Number(finding.confidence))):null
  };
}

export function applySemanticVisualReview(input={}){
  const deterministic=Array.isArray(input.deterministic_deltas)?input.deterministic_deltas.map(clone):[];
  for(const delta of deterministic){
    const valid=validateVisualDelta(delta);
    if(!valid.ok) throw new Error('DETERMINISTIC_DELTA_INVALID:'+valid.issues.join(','));
  }

  const response=input.semantic_result||{};
  if(response.override_deterministic_fail===true) throw new Error('SEMANTIC_OVERRIDE_FORBIDDEN');
  if(Array.isArray(response.delete_delta_ids)&&response.delete_delta_ids.length) throw new Error('SEMANTIC_DELTA_DELETION_FORBIDDEN');

  const findings=Array.isArray(response.findings)?response.findings.map(normalizeFinding):[];
  const semanticDeltas=findings.map((finding,index)=>createVisualDelta({
    delta_id:clean(finding.delta_id||`semantic-${index+1}`,180),
    reference_id:input.reference_id,
    implementation_commit:input.implementation_commit,
    viewport:input.viewport,
    region:finding.region,
    component_id:finding.component_id,
    category:FINDING_CATEGORY[finding.type],
    severity:finding.severity,
    expected:finding.expected,
    actual:finding.actual,
    difference:finding.summary||finding.type,
    unit:'semantic',
    score:finding.confidence,
    blocking:finding.severity==='HIGH'||finding.severity==='CRITICAL',
    evidence:{source:'SEMANTIC_VISUAL_REVIEW',finding_type:finding.type,confidence:finding.confidence},
    repair_hint:finding.repair_hint
  }));

  const deterministicIds=deterministic.map(x=>x.delta_id);
  const combined=[...deterministic,...semanticDeltas];
  const preserved=deterministicIds.every(id=>combined.some(x=>x.delta_id===id));
  if(!preserved) throw new Error('DETERMINISTIC_DELTA_PRESERVATION_FAILED');

  return {
    schema:'riosystems.semantic-visual-review.v1',
    status:'REVIEWED',
    deterministic_deltas:deterministic,
    semantic_deltas:semanticDeltas,
    combined_deltas:combined,
    deterministic_delta_count:deterministic.length,
    semantic_delta_count:semanticDeltas.length,
    deterministic_deltas_preserved:true,
    deterministic_fail_override_allowed:false,
    acceptance_authority:'DETERMINISTIC_MEASUREMENT_ONLY'
  };
}

export function semanticReviewWithoutProvider(input={}){
  return {
    schema:'riosystems.semantic-visual-review.v1',
    status:'NOT_EXECUTED_PROVIDER_UNAVAILABLE',
    deterministic_deltas:Array.isArray(input.deterministic_deltas)?input.deterministic_deltas.map(clone):[],
    semantic_deltas:[],
    combined_deltas:Array.isArray(input.deterministic_deltas)?input.deterministic_deltas.map(clone):[],
    deterministic_deltas_preserved:true,
    deterministic_fail_override_allowed:false,
    acceptance_authority:'DETERMINISTIC_MEASUREMENT_ONLY'
  };
}
