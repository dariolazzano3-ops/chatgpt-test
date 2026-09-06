import assert from 'node:assert/strict';
import { createAIProviderRegistry } from '../src/ai-provider-registry.js';
import { mkdir, writeFile } from 'node:fs/promises';
import { createVisualTaskRequest, executeVisualTask, routeVisualTask, visualTaskUsesCanonicalAIRegistry } from '../src/visual-foundry/model-router.js';

const runner=id=>async task=>({status:'COMPLETED',output:{provider_marker:id,task_type:task.task_type}});
const registry=createAIProviderRegistry([
  {id:'model-a',model:'vision-a',task_types:['SEMANTIC_VISUAL_REVIEW','DELTA_REASONING'],output_formats:['structured_json'],priority:20,enabled:true,runner:runner('a'),requires_credentials:false,paid_external_call:false},
  {id:'model-b',model:'vision-b',task_types:['*'],output_formats:['structured_json'],priority:10,enabled:true,runner:runner('b'),requires_credentials:false,paid_external_call:false},
  {id:'model-c',model:'vision-c',task_types:['SEMANTIC_VISUAL_REVIEW'],output_formats:['structured_json'],priority:30,enabled:true,runner:runner('c'),requires_credentials:false,paid_external_call:false}
]);
assert.equal(visualTaskUsesCanonicalAIRegistry(registry),true);

const request=createVisualTaskRequest({task:'SEMANTIC_VISUAL_REVIEW',quality_tier:'BALANCED',max_cost_usd:2,max_latency_ms:10000,input:{reference:'ref.png',runtime:'run.png'}});
const metrics={
  'model-a':{quality:.9,benchmark_score:.88,cost_usd:.4,latency_ms:4500,availability:1},
  'model-b':{quality:.82,benchmark_score:.8,cost_usd:.1,latency_ms:1500,availability:1},
  'model-c':{quality:.95,benchmark_score:.93,cost_usd:3,latency_ms:2000,availability:1}
};
const route=routeVisualTask(registry,request,{provider_metrics:metrics});
assert.equal(route.ok,true);
assert.notEqual(route.provider,'model-c','provider above cost guard must not route');
assert.equal(route.selection_reason,'quality_cost_latency_availability_benchmark');

const result=await executeVisualTask(registry,request,{provider_metrics:metrics});
assert.equal(result.status,'COMPLETED');
assert.equal(result.reference_spec_provider_coupling,false);
assert.equal(result.production_deploy,false);
assert.equal(result.external_writes,false);

const premium=createVisualTaskRequest({task:'SEMANTIC_VISUAL_REVIEW',quality_tier:'PREMIUM',max_cost_usd:5,max_latency_ms:10000,input:{}});
const premiumRoute=routeVisualTask(registry,premium,{provider_metrics:metrics});
assert.equal(premiumRoute.ok,true);

const noRoute=createVisualTaskRequest({task:'UI_IMPLEMENTATION',quality_tier:'BALANCED',max_cost_usd:0,max_latency_ms:100,input:{}});
assert.equal(routeVisualTask(registry,noRoute,{provider_metrics:metrics}).ok,false);

assert.throws(()=>createVisualTaskRequest({task:'UNKNOWN_TASK'}),/VISUAL_TASK_UNSUPPORTED/);

const evidence={ok:true,suite:'visual-foundry-wave11-smoke',canonical_ai_registry_reused:'PASS',provider_neutral_visual_task_contract:'PASS',quality_cost_latency_availability_benchmark_routing:'PASS',cost_guard:'PASS',side_effects_disabled:'PASS',reference_spec_provider_coupling:false,production_deploy:false,external_writes:false};
await mkdir('artifacts/visual-foundry/wave11',{recursive:true});
await writeFile('artifacts/visual-foundry/wave11/evidence.json',JSON.stringify({evidence,route,premium_route:premiumRoute,result},null,2));
console.log(JSON.stringify(evidence,null,2));
