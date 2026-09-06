import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createVisualDelta } from '../src/visual-foundry/visual-delta.js';
import { assertVisualRepairAuthority, createVisualRepairPlan, resolveVisualRepairIterationLimit, runBoundedVisualDeltaClosure, visualDeltaClosureHostDescriptor } from '../src/visual-foundry/delta-closer.js';

const base={reference_id:'ref',implementation_commit:'c0',viewport:{width:1440,height:1100,device_pixel_ratio:1}};
const structure=createVisualDelta({...base,delta_id:'structure',category:'STRUCTURE',severity:'HIGH',difference:'missing layout',blocking:true});
const geometry=createVisualDelta({...base,delta_id:'geometry',category:'GEOMETRY',severity:'HIGH',component_id:'hero',difference:40,unit:'px',blocking:true,evidence:{metric:'height'}});
const typography=createVisualDelta({...base,delta_id:'type',category:'TYPOGRAPHY',severity:'MEDIUM',difference:4,unit:'px',blocking:false});
assert.equal(createVisualRepairPlan([typography,geometry,structure]).phase,'STRUCTURE');
assert.equal(resolveVisualRepairIterationLimit(99),8);
assert.equal(visualDeltaClosureHostDescriptor({max_iterations:8}).same_factory_qa_loop,true);

assert.equal(assertVisualRepairAuthority(['projects/demo/index.html','projects/demo/styles.css'],{project_path:'projects/demo'}).ok,true);
assert.throws(()=>assertVisualRepairAuthority(['src/index.js'],{project_path:'projects/demo'}),/VISUAL_REPAIR_OUT_OF_SCOPE/);
assert.throws(()=>assertVisualRepairAuthority(['projects/demo/_worker.js'],{project_path:'projects/demo'}),/VISUAL_REPAIR_FORBIDDEN_FILE/);

const calls=[];
let compareCount=0;
const result=await runBoundedVisualDeltaClosure({project_path:'projects/demo',max_iterations:8,initial_deltas:[structure,geometry]},{
  repair:async ({iteration,plan})=>{calls.push('repair'+iteration+':'+plan.phase);return{changed_files:['projects/demo/styles.css']};},
  commit:async ({iteration})=>{calls.push('commit'+iteration);return{commit_sha:'commit-'+iteration};},
  render:async ({iteration})=>{calls.push('render'+iteration);return{screenshot:'run-'+iteration+'.png'};},
  measure:async ({iteration})=>{calls.push('measure'+iteration);return{score:iteration};},
  compare:async ({iteration})=>{calls.push('compare'+iteration);compareCount++;return{deltas:compareCount===1?[geometry]:[]};},
  functional_regression:async ({iteration})=>{calls.push('functional'+iteration);return{status:'PASS'};}
});
assert.equal(result.status,'PASS');
assert.equal(result.iterations,2);
assert.deepEqual(result.history[0].order,['repair','commit','render','measure','compare','functional_regression']);
assert.deepEqual(calls,['repair1:STRUCTURE','commit1','render1','measure1','compare1','functional1','repair2:COMPONENT_GEOMETRY','commit2','render2','measure2','compare2','functional2']);

const stagnant=await runBoundedVisualDeltaClosure({project_path:'projects/demo',initial_deltas:[geometry],max_iterations:8},{
  repair:async()=>({changed_files:['projects/demo/styles.css']}),commit:async()=>({commit_sha:'same'}),render:async()=>({}),measure:async()=>({}),compare:async()=>({deltas:[geometry]}),functional_regression:async()=>({status:'PASS'})
});
assert.equal(stagnant.status,'HUMAN_DECISION_REQUIRED');
assert.equal(stagnant.reason,'NO_DETERMINISTIC_DELTA_PROGRESS');

const regression=await runBoundedVisualDeltaClosure({project_path:'projects/demo',initial_deltas:[geometry]},{
  repair:async()=>({changed_files:['projects/demo/styles.css']}),commit:async()=>({commit_sha:'bad'}),render:async()=>({}),measure:async()=>({}),compare:async()=>({deltas:[]}),functional_regression:async()=>({status:'FAIL'})
});
assert.equal(regression.status,'FUNCTIONAL_REGRESSION_FAILED');

const hostSource=await readFile('scripts/qa-repair-loop.mjs','utf8');
assert.match(hostSource,/visualDeltaClosureHostDescriptor/);
assert.match(hostSource,/max_visual_qa_attempts/);

const evidence={ok:true,suite:'visual-foundry-wave12-smoke',existing_qa_loop_extended:'PASS',repair_order:'PASS',frontend_authority:'PASS',commit_render_measure_compare_order:'PASS',functional_regression_gate:'PASS',no_progress_human_gate:'PASS',hard_max_iterations:8,production_deploy:false,external_writes:false};
await mkdir('artifacts/visual-foundry/wave12',{recursive:true});
await writeFile('artifacts/visual-foundry/wave12/evidence.json',JSON.stringify({evidence,result,stagnant,regression,host:visualDeltaClosureHostDescriptor({max_iterations:8})},null,2));
console.log(JSON.stringify(evidence,null,2));
