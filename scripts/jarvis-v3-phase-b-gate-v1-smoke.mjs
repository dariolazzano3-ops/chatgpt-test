import assert from 'node:assert/strict';
import { computeJarvisProgramProgressV1 } from '../src/jarvis/program-progress-v1.js';
import { getJarvisProgramDefinitionV1, JARVIS_V3_PROGRAM_ID } from '../src/jarvis/program-catalog-v1.js';
import { getJarvisWaveRegistryEntryV1, JARVIS_V3_WAVE_REGISTRY_PROGRAM } from '../src/jarvis/wave-registry-v1.js';
import { proposeJarvisWaveTaskV1 } from '../src/jarvis/wave-task-planner-v1.js';
import {
  JARVIS_V3_WAVE_WEIGHTS, JARVIS_V3_POST_GATE_CAPABILITIES,
  isJarvisV3HumanGateClearedV1, isJarvisV3PostGateReachableV1,
  evaluateJarvisV3PermissionGrantV1, jarvisV3ConstitutionManifestV1
} from '../src/jarvis/v3-constitution-v1.js';

const accepted = (wave_index) => ({
  wave_index, wave_state:'COMPLETE', independent_acceptance:true,
  acceptance_ref:`accept:w${wave_index}`, evidence_ref:`evidence:w${wave_index}`,
  at:`2026-09-${String(wave_index+1).padStart(2,'0')}T00:00:00.000Z`
});

const definition = getJarvisProgramDefinitionV1(JARVIS_V3_PROGRAM_ID);
assert.equal(definition.wave_weights.length,26);
assert.deepEqual(definition.wave_weights,[...JARVIS_V3_WAVE_WEIGHTS]);
assert.equal(definition.wave_weights.reduce((a,b)=>a+b,0),100);

const phaseA = Array.from({length:11},(_,i)=>accepted(i));
const atGate = computeJarvisProgramProgressV1(JARVIS_V3_PROGRAM_ID,phaseA);
assert.equal(atGate.verified_progress_percent,55);
assert.deepEqual(atGate.completed_waves,[0,1,2,3,4,5,6,7,8,9,10]);
assert.equal(atGate.current_wave,11);
assert.equal(atGate.wave_count,26);
assert.equal(isJarvisV3HumanGateClearedV1(atGate.completed_waves),false);

const w11 = getJarvisWaveRegistryEntryV1(JARVIS_V3_WAVE_REGISTRY_PROGRAM,11);
assert.ok(w11);
assert.equal(w11.operator_task_required,true);
assert.equal(proposeJarvisWaveTaskV1({
  program:JARVIS_V3_PROGRAM_ID,waveIndex:11,completedWaves:atGate.completed_waves
}),null,'the human gate can only come from the operator-supplied task path');

const afterGate = computeJarvisProgramProgressV1(JARVIS_V3_PROGRAM_ID,[...phaseA,accepted(11)]);
assert.equal(afterGate.verified_progress_percent,58);
assert.equal(afterGate.current_wave,12);
assert.equal(isJarvisV3HumanGateClearedV1(afterGate.completed_waves),true);
assert.equal(isJarvisV3PostGateReachableV1(12,{human_gate_cleared:true}),true);
assert.equal(isJarvisV3PostGateReachableV1(25,{human_gate_cleared:true}),true);
assert.equal(isJarvisV3PostGateReachableV1(12,{human_gate_cleared:false}),false);

for (let i=12;i<=25;i++) {
  assert.equal(getJarvisWaveRegistryEntryV1(JARVIS_V3_PROGRAM_ID,i),null,'W12-W25 task definitions must not exist before gate acceptance');
}

for (const capability of JARVIS_V3_POST_GATE_CAPABILITIES) {
  assert.deepEqual(evaluateJarvisV3PermissionGrantV1({actor_type:'OPERATOR',capability}),{granted:false,reason:'HUMAN_GATE_NOT_CLEARED'});
  assert.deepEqual(evaluateJarvisV3PermissionGrantV1({actor_type:'OPERATOR',capability,human_gate_cleared:true}),{granted:true,reason:'OPERATOR_ELIGIBLE'});
}
for (const permanent of ['MERGE','PUSH','DEPLOY','PRODUCTION_ACTIVATION','DNS_MUTATION','CLOUDFLARE_MUTATION','BILLING','HAMYREN_DATA_FLOW','SECRET_OUTPUT']) {
  assert.deepEqual(evaluateJarvisV3PermissionGrantV1({actor_type:'OPERATOR',capability:permanent,human_gate_cleared:true}),{granted:false,reason:'CONSTITUTIONALLY_FORBIDDEN'});
}

const allAccepted = Array.from({length:26},(_,i)=>accepted(i));
const complete = computeJarvisProgramProgressV1(JARVIS_V3_PROGRAM_ID,allAccepted);
assert.equal(complete.verified_progress_percent,100);
assert.equal(complete.wave_count,26);

const manifest = jarvisV3ConstitutionManifestV1();
assert.equal(manifest.w11_external_effects_allowed,false);
assert.equal(manifest.total_weight_percent,100);
assert.equal(manifest.hamyren_data_flow,false);
assert.equal(manifest.production_actions_allowed,false);
assert.equal(manifest.public_actions_allowed,false);
assert.equal(manifest.dns_actions_allowed,false);
assert.equal(manifest.cloudflare_actions_allowed,false);
assert.equal(manifest.billing_actions_allowed,false);
assert.equal(manifest.secret_output_allowed,false);
assert.equal(manifest.merge_allowed,false);
assert.equal(manifest.push_allowed,false);
assert.equal(manifest.deploy_allowed,false);

console.log(JSON.stringify({
  schema:'aurentara.jarvis.v3.phase-b-gate.smoke.v1',passed:true,
  before_gate_percent:55,after_gate_percent:58,final_percent:100,
  operator_task_required:true,post_gate_tasks_registered:false,
  w11_external_effects:false
},null,2));
