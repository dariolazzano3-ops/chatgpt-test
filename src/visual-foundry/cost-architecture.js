import crypto from 'node:crypto';

export const VISUAL_POC_COST_POLICY=Object.freeze({
  soft_target_min_usd:0.50,
  soft_target_max_usd:3.00,
  hard_review_threshold_usd:5.00,
  local_pixel_diff_expected_usd:0,
  local_ssim_expected_usd:0,
  local_geometry_expected_usd:0,
  local_dom_measurement_expected_usd:0
});

const clean=(v,max=4000)=>String(v??'').trim().slice(0,max);
const clone=v=>structuredClone(v);

export function createVisualCostLedger(input={}){
  return {
    schema:'riosystems.visual-cost-ledger.v1',
    run_id:clean(input.run_id||'visual-run',180),
    policy:{...VISUAL_POC_COST_POLICY,...clone(input.policy??{})},
    events:[],
    ai_cost_usd:0,
    runtime_cost_usd:0,
    local_measurement_cost_usd:0,
    total_cost_usd:0
  };
}

export function recordVisualCost(ledger={},event={}){
  if(ledger.schema!=='riosystems.visual-cost-ledger.v1') throw new Error('VISUAL_COST_LEDGER_REQUIRED');
  const type=clean(event.type,80).toUpperCase();
  if(!['LOCAL_MEASUREMENT','AI_CALL','RUNTIME'].includes(type)) throw new Error('VISUAL_COST_EVENT_TYPE_INVALID');
  const cost=Number(event.cost_usd??0);
  if(!Number.isFinite(cost)||cost<0) throw new Error('VISUAL_COST_VALUE_INVALID');
  if(type==='LOCAL_MEASUREMENT'&&cost!==0) throw new Error('LOCAL_MEASUREMENT_NONZERO_COST_REQUIRES_EXPLICIT_RUNTIME_EVENT');
  const next={...clone(ledger),events:[...ledger.events,{type,cost_usd:cost,task:clean(event.task,120)||null,provider:clean(event.provider,180)||null,model:clean(event.model,180)||null,input_tokens:Number(event.input_tokens||0),output_tokens:Number(event.output_tokens||0),cached:event.cached===true}]};
  if(type==='AI_CALL') next.ai_cost_usd+=cost;
  if(type==='RUNTIME') next.runtime_cost_usd+=cost;
  if(type==='LOCAL_MEASUREMENT') next.local_measurement_cost_usd+=cost;
  next.total_cost_usd=next.ai_cost_usd+next.runtime_cost_usd+next.local_measurement_cost_usd;
  return next;
}

export function evaluateVisualCostGuard(ledger={},input={}){
  if(ledger.schema!=='riosystems.visual-cost-ledger.v1') throw new Error('VISUAL_COST_LEDGER_REQUIRED');
  const policy={...VISUAL_POC_COST_POLICY,...ledger.policy};
  const next=Number(input.next_estimated_cost_usd??0);
  if(!Number.isFinite(next)||next<0) throw new Error('VISUAL_NEXT_COST_INVALID');
  const projected=ledger.total_cost_usd+next;
  const hard=Number(policy.hard_review_threshold_usd);
  const soft=Number(policy.soft_target_max_usd);
  const status=projected>hard?'COST_REVIEW_REQUIRED':projected>soft?'SOFT_TARGET_EXCEEDED':'PASS';
  return {
    schema:'riosystems.visual-cost-guard.v1',
    status,
    execution_allowed:status!=='COST_REVIEW_REQUIRED',
    current_total_usd:ledger.total_cost_usd,
    projected_total_usd:projected,
    soft_target_usd:[Number(policy.soft_target_min_usd),soft],
    hard_review_threshold_usd:hard,
    uncontrolled_agent_loop_allowed:false
  };
}

export function buildReferenceAnalysisCacheKey(input={}){
  const referenceHash=clean(input.reference_hash,180);
  const analyzerVersion=clean(input.analyzer_version||'visual-foundry-v1',180);
  const task=clean(input.task||'REFERENCE_SEMANTIC_ANALYSIS',120);
  if(!referenceHash) throw new Error('REFERENCE_ANALYSIS_CACHE_HASH_REQUIRED');
  return crypto.createHash('sha256').update(JSON.stringify({referenceHash,analyzerVersion,task})).digest('hex');
}

export function buildSelectiveRepairContext(input={}){
  if(input.full_codebase===true) throw new Error('FULL_CODEBASE_REPAIR_CONTEXT_FORBIDDEN');
  const deltas=Array.isArray(input.deltas)?input.deltas.slice(0,24).map(clone):[];
  if(!deltas.length) throw new Error('SELECTIVE_REPAIR_DELTAS_REQUIRED');
  return {
    schema:'riosystems.selective-visual-repair-context.v1',
    component_id:clean(input.component_id,180)||null,
    component_code:clean(input.component_code,16000)||null,
    relevant_css:clean(input.relevant_css,16000)||null,
    deltas,
    reference_crop:clean(input.reference_crop,1200)||null,
    full_codebase_included:false,
    max_delta_records:24,
    cost_optimized:true
  };
}
