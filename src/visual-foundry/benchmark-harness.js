import crypto from 'node:crypto';
import { VISUAL_POC_COST_POLICY } from './cost-architecture.js';

export const BENCHMARK_PROVIDER_FAMILIES=Object.freeze(['OPENAI','ANTHROPIC','GOOGLE']);
const clean=(v,max=2000)=>String(v??'').trim().slice(0,max);
const clone=v=>structuredClone(v);

function stable(value){
  if(Array.isArray(value)) return '['+value.map(stable).join(',')+']';
  if(value&&typeof value==='object'){
    return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+stable(value[k])).join(',')+'}';
  }
  return JSON.stringify(value);
}

export function createProviderBenchmarkCase(input={}){
  const referenceId=clean(input.reference_id,180),referenceHash=clean(input.reference_hash,180),revision=clean(input.codebase_revision,180);
  if(!referenceId||!referenceHash) throw new Error('BENCHMARK_APPROVED_REFERENCE_REQUIRED');
  if(!revision) throw new Error('BENCHMARK_CODEBASE_REVISION_REQUIRED');
  const limit=Number(input.iteration_limit??8);
  if(!Number.isInteger(limit)||limit<1||limit>8) throw new Error('BENCHMARK_ITERATION_LIMIT_INVALID');
  const viewport=clone(input.viewport||{});
  if(!Number.isFinite(Number(viewport.width))||!Number.isFinite(Number(viewport.height))) throw new Error('BENCHMARK_VIEWPORT_INVALID');
  const benchmarkCase={
    schema:'riosystems.visual-provider-benchmark-case.v1',
    benchmark_id:clean(input.benchmark_id||'visual-provider-benchmark',180),
    project_id:clean(input.project_id,180),
    reference_id:referenceId,
    reference_hash:referenceHash,
    reference_spec_version:clean(input.reference_spec_version,80),
    reference_spec_hash:clean(input.reference_spec_hash,180),
    codebase_revision:revision,
    viewport,
    fixture_version:clean(input.fixture_version,120),
    iteration_limit:limit,
    tools:Array.isArray(input.tools)?[...input.tools].map(String).sort():[],
    acceptance:clone(input.acceptance||{}),
    task_sequence:Array.isArray(input.task_sequence)?[...input.task_sequence]:['UI_IMPLEMENTATION','DELTA_REASONING','REPAIR_CODING'],
    production_deploy:false,
    external_writes:false
  };
  const case_hash=crypto.createHash('sha256').update(stable(benchmarkCase)).digest('hex');
  return {...benchmarkCase,case_hash};
}

function normalizeProvider(provider={}){
  const family=clean(provider.family,40).toUpperCase();
  if(!BENCHMARK_PROVIDER_FAMILIES.includes(family)) throw new Error('BENCHMARK_PROVIDER_FAMILY_INVALID:'+family);
  if(!clean(provider.id,180)) throw new Error('BENCHMARK_PROVIDER_ID_REQUIRED');
  if(typeof provider.runner!=='function') throw new Error('BENCHMARK_PROVIDER_RUNNER_REQUIRED:'+provider.id);
  return {id:clean(provider.id,180),family,model:clean(provider.model,180)||null,runner:provider.runner};
}

function metric(value,fallback=0){
  return Number.isFinite(Number(value))?Number(value):fallback;
}

function normalizeRun(provider,raw,elapsed,benchmarkCase){
  if(raw?.case_hash&&raw.case_hash!==benchmarkCase.case_hash) throw new Error('BENCHMARK_CASE_HASH_MISMATCH:'+provider.id);
  const cost=metric(raw?.cost_usd,0);
  const deltaStart=Math.max(0,metric(raw?.delta_start,0));
  const deltaEnd=Math.max(0,metric(raw?.delta_end,deltaStart));
  const reduction=Math.max(0,deltaStart-deltaEnd);
  const iterations=Math.max(0,metric(raw?.iteration_count,0));
  const hardCost=Number(VISUAL_POC_COST_POLICY.hard_review_threshold_usd);
  const status=cost>hardCost?'COST_REVIEW_REQUIRED':raw?.status==='FAILED'||raw?.ok===false?'FAILED':'COMPLETED';
  return {
    schema:'riosystems.visual-provider-benchmark-run.v1',
    provider_id:provider.id,
    provider_family:provider.family,
    model:provider.model,
    case_hash:benchmarkCase.case_hash,
    status,
    visual_fidelity:metric(raw?.visual_fidelity),
    geometry_score:metric(raw?.geometry_score),
    perceptual_score:metric(raw?.perceptual_score),
    human_review:clean(raw?.human_review||'NOT_EVALUATED',80),
    iteration_count:iterations,
    latency_ms:metric(raw?.latency_ms,elapsed),
    measured_wall_latency_ms:elapsed,
    input_tokens:metric(raw?.input_tokens),
    output_tokens:metric(raw?.output_tokens),
    cost_usd:cost,
    regression_rate:metric(raw?.regression_rate),
    hallucination_rate:metric(raw?.hallucination_rate),
    architecture_drift:metric(raw?.architecture_drift),
    files_changed:Array.isArray(raw?.files_changed)?raw.files_changed.map(String):[],
    delta_start:deltaStart,
    delta_end:deltaEnd,
    delta_reduction:reduction,
    delta_reduction_per_iteration:iterations?reduction/iterations:reduction,
    delta_reduction_per_dollar:cost>0?reduction/cost:null,
    production_deploy:false,
    external_writes:false
  };
}

export async function runProviderBenchmark(benchmarkCase={},providers=[],options={}){
  if(benchmarkCase.schema!=='riosystems.visual-provider-benchmark-case.v1') throw new Error('BENCHMARK_CASE_REQUIRED');
  const normalized=providers.map(normalizeProvider);
  const runs=[];
  for(const provider of normalized){
    const started=Date.now();
    let raw;
    try{
      raw=await provider.runner({benchmark_case:clone(benchmarkCase),case_hash:benchmarkCase.case_hash,production_deploy:false,external_writes:false});
    }catch(error){
      raw={status:'FAILED',error:clean(error?.message,300),case_hash:benchmarkCase.case_hash};
    }
    runs.push(normalizeRun(provider,raw,Date.now()-started,benchmarkCase));
  }
  const families=new Set(runs.filter(r=>r.status==='COMPLETED').map(r=>r.provider_family));
  const missing=BENCHMARK_PROVIDER_FAMILIES.filter(f=>!families.has(f));
  const allSameCase=runs.every(r=>r.case_hash===benchmarkCase.case_hash);
  const realCalls=options.real_provider_calls===true;
  const complete=missing.length===0&&allSameCase&&runs.every(r=>r.status==='COMPLETED');
  const ranked=[...runs].filter(r=>r.status==='COMPLETED').sort((a,b)=>
    b.visual_fidelity-a.visual_fidelity||
    b.geometry_score-a.geometry_score||
    b.perceptual_score-a.perceptual_score||
    a.regression_rate-b.regression_rate||
    a.hallucination_rate-b.hallucination_rate||
    a.architecture_drift-b.architecture_drift||
    a.cost_usd-b.cost_usd
  ).map((r,index)=>({rank:index+1,provider_id:r.provider_id,provider_family:r.provider_family,model:r.model,visual_fidelity:r.visual_fidelity,geometry_score:r.geometry_score,perceptual_score:r.perceptual_score,cost_usd:r.cost_usd,delta_reduction_per_dollar:r.delta_reduction_per_dollar}));

  return {
    schema:'riosystems.visual-provider-benchmark-report.v1',
    status:complete?(realCalls?'REAL_BENCHMARK_COMPLETE':'SYNTHETIC_HARNESS_VALIDATED'):'INCOMPLETE',
    benchmark_id:benchmarkCase.benchmark_id,
    case_hash:benchmarkCase.case_hash,
    identical_case_for_all_providers:allSameCase,
    required_provider_families:[...BENCHMARK_PROVIDER_FAMILIES],
    missing_provider_families:missing,
    real_provider_calls:realCalls,
    runs,
    ranking_preview:ranked,
    winner_declared:false,
    eligible_for_winner_selection:complete&&realCalls&&runs.every(r=>r.human_review==='PASS'),
    benchmark_not_marketing_based:true
  };
}

export function authorizeBenchmarkWinner(report={},input={}){
  if(report.schema!=='riosystems.visual-provider-benchmark-report.v1') throw new Error('BENCHMARK_REPORT_REQUIRED');
  if(report.real_provider_calls!==true||report.status!=='REAL_BENCHMARK_COMPLETE') throw new Error('REAL_COMPLETE_BENCHMARK_REQUIRED');
  if(report.eligible_for_winner_selection!==true) throw new Error('BENCHMARK_HUMAN_REVIEW_REQUIRED');
  if(input.human_approved!==true) throw new Error('BENCHMARK_WINNER_HUMAN_APPROVAL_REQUIRED');
  const providerId=clean(input.provider_id,180);
  const run=report.runs.find(r=>r.provider_id===providerId&&r.status==='COMPLETED');
  if(!run) throw new Error('BENCHMARK_WINNER_PROVIDER_INVALID');
  return {schema:'riosystems.visual-provider-benchmark-selection.v1',winner_declared:true,provider_id:providerId,provider_family:run.provider_family,model:run.model,human_approved:true,case_hash:report.case_hash};
}

export function goldStandardBenchmarkStatus(input={}){
  if(input.approved_reference_available!==true){
    return {schema:'riosystems.gold-standard-benchmark-status.v1',status:'BLOCKED_APPROVED_REFERENCE_REQUIRED',winner_declared:false,three_isolated_runs_started:false,fake_reference_allowed:false};
  }
  return {schema:'riosystems.gold-standard-benchmark-status.v1',status:'READY_FOR_REAL_BENCHMARK',winner_declared:false,three_isolated_runs_started:false,fake_reference_allowed:false};
}
