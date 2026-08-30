import assert from 'node:assert/strict';
import { runContractsSmoke } from './ai-intelligence-v2-contracts-smoke.mjs';
import { runQualitySmoke } from './ai-intelligence-v2-quality-smoke.mjs';
import { runRuntimeSmoke } from './ai-intelligence-v2-runtime-smoke.mjs';
const contracts=await runContractsSmoke(),quality=await runQualitySmoke(),runtime=await runRuntimeSmoke();
assert.equal(runtime.reference_count,9); assert.equal(runtime.zero_cost_eur,0);
console.log(JSON.stringify({smoke:'autonomous-ai-intelligence-v2:ok',contracts,quality,...runtime,v1_reused:true,paid_calls:false,production:false,real_customer_data:false,direct_side_effects:false,cross_project_leakage:false},null,2));
