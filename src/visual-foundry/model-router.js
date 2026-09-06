import { routeAIProvider } from '../ai-provider-registry.js';

export const VISUAL_TASKS=Object.freeze([
  'REFERENCE_SEMANTIC_ANALYSIS',
  'REFERENCE_REGION_LABELING',
  'UI_IMPLEMENTATION',
  'DELTA_REASONING',
  'REPAIR_CODING',
  'SEMANTIC_VISUAL_REVIEW'
]);

const clean=(v,max=1000)=>String(v??'').trim().slice(0,max);
const clone=v=>structuredClone(v);
const clamp=v=>Math.max(0,Math.min(1,Number(v)||0));

export function createVisualTaskRequest(input={}){
  const task=clean(input.task,80).toUpperCase();
  if(!VISUAL_TASKS.includes(task)) throw new Error('VISUAL_TASK_UNSUPPORTED:'+task);
  const qualityTier=clean(input.quality_tier||'BALANCED',40).toUpperCase();
  if(!['ECONOMY','BALANCED','PREMIUM'].includes(qualityTier)) throw new Error('VISUAL_QUALITY_TIER_INVALID');
  const maxCost=Number(input.max_cost_usd??5);
  if(!Number.isFinite(maxCost)||maxCost<0) throw new Error('VISUAL_TASK_COST_LIMIT_INVALID');
  return {
    schema:'riosystems.visual-task-request.v1',
    task,
    quality_tier:qualityTier,
    input:clone(input.input??{}),
    output:{format:'structured_json'},
    constraints:{
      max_cost_usd:maxCost,
      max_latency_ms:Number.isFinite(Number(input.max_latency_ms))?Number(input.max_latency_ms):120000,
      allow_tools:false,
      allow_external_data:false,
      production_deploy:false,
      external_writes:false
    },
    metadata:clone(input.metadata??{})
  };
}

function normalizedMetrics(metrics={}){
  return {
    quality:clamp(metrics.quality??metrics.benchmark_score??0.5),
    benchmark_score:clamp(metrics.benchmark_score??metrics.quality??0.5),
    availability:clamp(metrics.availability??1),
    cost_usd:Number.isFinite(Number(metrics.cost_usd))?Math.max(0,Number(metrics.cost_usd)):Infinity,
    latency_ms:Number.isFinite(Number(metrics.latency_ms))?Math.max(0,Number(metrics.latency_ms)):Infinity
  };
}

function weights(tier){
  if(tier==='ECONOMY') return {quality:.2,benchmark:.2,cost:.4,latency:.15,availability:.05};
  if(tier==='PREMIUM') return {quality:.4,benchmark:.35,cost:.05,latency:.1,availability:.1};
  return {quality:.3,benchmark:.3,cost:.2,latency:.1,availability:.1};
}

function scoreProvider(metrics,request){
  const w=weights(request.quality_tier);
  const costBudget=Math.max(.000001,request.constraints.max_cost_usd);
  const latencyBudget=Math.max(1,request.constraints.max_latency_ms);
  const costScore=metrics.cost_usd===Infinity?0:clamp(1-metrics.cost_usd/costBudget);
  const latencyScore=metrics.latency_ms===Infinity?0:clamp(1-metrics.latency_ms/latencyBudget);
  return w.quality*metrics.quality+w.benchmark*metrics.benchmark_score+w.cost*costScore+w.latency*latencyScore+w.availability*metrics.availability;
}

export function routeVisualTask(registry={},request={},options={}){
  if(request.schema!=='riosystems.visual-task-request.v1') throw new Error('VISUAL_TASK_REQUEST_REQUIRED');
  const providerMetrics=options.provider_metrics||{};
  const candidates=(registry.providers||[])
    .filter(p=>p.enabled===true&&typeof p.runner==='function')
    .filter(p=>Array.isArray(p.task_types)&&(p.task_types.includes('*')||p.task_types.includes(request.task)))
    .filter(p=>Array.isArray(p.output_formats)&&p.output_formats.includes('structured_json'))
    .map(provider=>{
      const metrics=normalizedMetrics(providerMetrics[provider.id]||{});
      const withinCost=metrics.cost_usd<=request.constraints.max_cost_usd;
      const withinLatency=metrics.latency_ms<=request.constraints.max_latency_ms;
      return {provider,metrics,within_cost:withinCost,within_latency:withinLatency,score:scoreProvider(metrics,request)};
    })
    .filter(x=>x.metrics.availability>0&&x.within_cost&&x.within_latency)
    .sort((a,b)=>b.score-a.score||a.provider.priority-b.provider.priority||a.provider.id.localeCompare(b.provider.id));

  if(options.preferred_provider){
    const preferred=candidates.find(x=>x.provider.id===options.preferred_provider);
    if(!preferred) return {ok:false,error:'VISUAL_PREFERRED_PROVIDER_UNAVAILABLE'};
    return {
      ok:true,provider:preferred.provider.id,model:preferred.provider.model,runner:preferred.provider.runner,
      metrics:preferred.metrics,route_score:preferred.score,quality_tier:request.quality_tier,selection_reason:'preferred_provider_within_guards'
    };
  }
  if(!candidates.length) return {ok:false,error:'VISUAL_PROVIDER_ROUTE_NOT_FOUND'};
  const selected=candidates[0];
  return {
    ok:true,provider:selected.provider.id,model:selected.provider.model,runner:selected.provider.runner,
    metrics:selected.metrics,route_score:selected.score,quality_tier:request.quality_tier,selection_reason:'quality_cost_latency_availability_benchmark'
  };
}

export async function executeVisualTask(registry={},request={},options={}){
  const route=routeVisualTask(registry,request,options);
  if(!route.ok) return {schema:'riosystems.visual-task-result.v1',status:'FAILED',error:route.error,task:request.task,production_deploy:false,external_writes:false};
  if(route.metrics.cost_usd>request.constraints.max_cost_usd) return {schema:'riosystems.visual-task-result.v1',status:'FAILED',error:'VISUAL_COST_GUARD_EXCEEDED',task:request.task,production_deploy:false,external_writes:false};

  let raw;
  try{
    raw=await route.runner({
      contract_version:'ai.task.v1',
      task_type:request.task,
      goal:'Execute bounded Visual Foundry task.',
      input:clone(request.input),
      context:[],
      output:{format:'structured_json'},
      execution:{max_attempts:1,allow_tools:false,allow_external_data:false,production_deploy:false}
    });
  }catch(error){
    return {schema:'riosystems.visual-task-result.v1',status:'FAILED',error:'VISUAL_PROVIDER_EXECUTION_THROWN',message:clean(error?.message,300),task:request.task,provider:route.provider,model:route.model,production_deploy:false,external_writes:false};
  }
  if(raw?.production_deploy===true||raw?.external_writes===true) return {schema:'riosystems.visual-task-result.v1',status:'FAILED',error:'VISUAL_PROVIDER_SIDE_EFFECT_REJECTED',task:request.task,provider:route.provider,model:route.model,production_deploy:false,external_writes:false};

  return {
    schema:'riosystems.visual-task-result.v1',
    status:raw?.status==='FAILED'||raw?.ok===false?'FAILED':'COMPLETED',
    task:request.task,
    provider:route.provider,
    model:route.model,
    route_score:route.route_score,
    estimated_cost_usd:route.metrics.cost_usd,
    estimated_latency_ms:route.metrics.latency_ms,
    output:clone(raw?.output??raw?.outputs??raw??null),
    production_deploy:false,
    external_writes:false,
    reference_spec_provider_coupling:false
  };
}

export function visualTaskUsesCanonicalAIRegistry(registry={}){
  return registry?.registry_version==='ai.providers.v1';
}
