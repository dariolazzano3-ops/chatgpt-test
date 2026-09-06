import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createVisualCostLedger, recordVisualCost, evaluateVisualCostGuard, buildReferenceAnalysisCacheKey, buildSelectiveRepairContext, VISUAL_POC_COST_POLICY } from '../src/visual-foundry/cost-architecture.js';
import { createVisualDelta } from '../src/visual-foundry/visual-delta.js';
import { runBoundedVisualDeltaClosure } from '../src/visual-foundry/delta-closer.js';

let ledger=createVisualCostLedger({run_id:'poc'});
for(const task of ['PIXEL_DIFF','SSIM','DOM_MEASUREMENT','GEOMETRY']) ledger=recordVisualCost(ledger,{type:'LOCAL_MEASUREMENT',task,cost_usd:0});
ledger=recordVisualCost(ledger,{type:'AI_CALL',task:'DELTA_REASONING',provider:'model-a',model:'x',cost_usd:1.2,input_tokens:2000,output_tokens:400});
assert.equal(ledger.total_cost_usd,1.2);
assert.equal(evaluateVisualCostGuard(ledger).status,'PASS');

ledger=recordVisualCost(ledger,{type:'AI_CALL',task:'REPAIR_CODING',provider:'model-a',model:'x',cost_usd:2.1});
const soft=evaluateVisualCostGuard(ledger);
assert.equal(soft.status,'SOFT_TARGET_EXCEEDED');
assert.equal(soft.execution_allowed,true);

const hard=evaluateVisualCostGuard(ledger,{next_estimated_cost_usd:2});
assert.equal(hard.status,'COST_REVIEW_REQUIRED');
assert.equal(hard.execution_allowed,false);
assert.equal(VISUAL_POC_COST_POLICY.hard_review_threshold_usd,5);

const cache1=buildReferenceAnalysisCacheKey({reference_hash:'sha256:abc',analyzer_version:'v1'});
const cache2=buildReferenceAnalysisCacheKey({reference_hash:'sha256:abc',analyzer_version:'v1'});
assert.equal(cache1,cache2);

const delta=createVisualDelta({reference_id:'ref',implementation_commit:'c',viewport:{width:1440,height:1100,device_pixel_ratio:1},category:'GEOMETRY',severity:'HIGH',difference:20,blocking:true});
const context=buildSelectiveRepairContext({component_id:'hero',component_code:'<section>...</section>',relevant_css:'.hero{}',deltas:[delta],reference_crop:'hero.png'});
assert.equal(context.full_codebase_included,false);
assert.throws(()=>buildSelectiveRepairContext({full_codebase:true,deltas:[delta]}),/FULL_CODEBASE_REPAIR_CONTEXT_FORBIDDEN/);

const costStopped=await runBoundedVisualDeltaClosure({project_path:'projects/demo',initial_deltas:[delta]},{
  cost_guard:async()=>({status:'COST_REVIEW_REQUIRED',execution_allowed:false,projected_total_usd:5.4}),
  repair:async()=>({changed_files:['projects/demo/styles.css']}),commit:async()=>({commit_sha:'x'}),render:async()=>({}),measure:async()=>({}),compare:async()=>({deltas:[]}),functional_regression:async()=>({status:'PASS'})
});
assert.equal(costStopped.status,'COST_REVIEW_REQUIRED');
assert.equal(costStopped.human_decision_required,true);

const evidence={ok:true,suite:'visual-foundry-wave18-smoke',local_measurement_zero_cost:'PASS',soft_target_guard:'PASS',hard_cost_review:'PASS',repair_loop_cost_stop:'PASS',reference_analysis_cache:'PASS',selective_repair_context:'PASS',uncontrolled_agent_loop_allowed:false,production_deploy:false,external_writes:false};
await mkdir('artifacts/visual-foundry/wave18',{recursive:true});
await writeFile('artifacts/visual-foundry/wave18/evidence.json',JSON.stringify({evidence,ledger,soft,hard,context,costStopped},null,2));
console.log(JSON.stringify(evidence,null,2));
