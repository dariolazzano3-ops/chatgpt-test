import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createRuntimeBindingContract, evaluateBindingStateCoverage, materializeBindingScenario, validateRuntimeBindingContract } from '../src/visual-foundry/runtime-binding.js';

const contract=createRuntimeBindingContract({
  component_id:'ProjectPortfolio',
  endpoint:'/operator/api/projects',
  method:'GET',
  response_path:'items',
  min_width:280,
  max_width:1800,
  min_height:120,
  max_height:1600,
  overflow_strategy:'EXPAND_WITH_MAX',
  text_truncation:true,
  text_wrapping:true,
  max_text_chars:80,
  max_items:100,
  skeleton_count:4
});
assert.equal(validateRuntimeBindingContract(contract).ok,true);
assert.equal(contract.endpoint,'/operator/api/projects');
assert.deepEqual(contract.states,['EMPTY','LOADING','REFERENCE','NORMAL','LONG_CONTENT','STRESS']);

const normalItems=[{project_id:'p1',name:'AURENTARA Website',phase:'BUILD'}];
const scenarios=[
  materializeBindingScenario(contract,{state:'EMPTY'}),
  materializeBindingScenario(contract,{state:'LOADING'}),
  materializeBindingScenario(contract,{state:'REFERENCE',truth_class:'VISUAL_FIXTURE',items:[{project_id:'fixture',name:'Reference Project'}]}),
  materializeBindingScenario(contract,{state:'NORMAL',items:normalItems}),
  materializeBindingScenario(contract,{state:'LONG_CONTENT',items:[{project_id:'long',name:'X'.repeat(300)}]}),
  materializeBindingScenario(contract,{state:'STRESS',items:Array.from({length:150},(_,i)=>({project_id:'p'+i,name:'Project '+i}))})
];

assert.equal(scenarios[0].empty,true);
assert.equal(scenarios[1].loading,true);
assert.equal(scenarios[2].truth_class,'VISUAL_FIXTURE');
assert.equal(scenarios[3].truth_class,'RUNTIME_TRUTH');
assert.ok(scenarios[4].items[0].name.length<=80);
assert.equal(scenarios[5].item_count,100);
assert.equal(scenarios[5].items_clipped_to_contract,true);
assert.equal(evaluateBindingStateCoverage(contract,scenarios).status,'PASS');

assert.throws(()=>materializeBindingScenario(contract,{state:'REFERENCE',items:[]}),/REFERENCE_STATE_REQUIRES_VISUAL_FIXTURE/);
assert.throws(()=>materializeBindingScenario(contract,{state:'NORMAL',truth_class:'VISUAL_FIXTURE',items:[]}),/VISUAL_FIXTURE_LEAK_IN_RUNTIME_STATE/);

const incomplete=evaluateBindingStateCoverage(contract,scenarios.slice(0,3));
assert.equal(incomplete.status,'FAIL');
assert.ok(incomplete.missing_states.includes('NORMAL'));

const evidence={ok:true,suite:'visual-foundry-wave9-smoke',real_projects_api_contract:'PASS',six_runtime_states:'PASS',long_content_guard:'PASS',stress_guard:'PASS',fixture_runtime_separation:'PASS',state_coverage_fail_closed:'PASS',production_deploy:false,external_writes:false};
await mkdir('artifacts/visual-foundry/wave9',{recursive:true});
await writeFile('artifacts/visual-foundry/wave9/evidence.json',JSON.stringify({evidence,contract,scenarios,coverage:evaluateBindingStateCoverage(contract,scenarios)},null,2));
console.log(JSON.stringify(evidence,null,2));
