import assert from 'node:assert/strict';
import {
  JARVIS_V3_PROGRAM, JARVIS_V3_TOTAL_WAVES, JARVIS_V3_WAVE_WEIGHTS,
  JARVIS_V3_PHASE_A_WAVE_WEIGHT_PERCENT, JARVIS_V3_POST_GATE_WAVE_WEIGHT_PERCENT,
  JARVIS_V3_AUTONOMOUS_PHASE_A_LAST_WAVE, JARVIS_V3_FIRST_HUMAN_GATE_WAVE,
  JARVIS_V3_SAFETY_DENYLIST, JARVIS_V3_POST_GATE_CAPABILITIES,
  getJarvisV3RoadmapEntryV1, computeJarvisV3PhaseV1,
  isJarvisV3HumanGateClearedV1, isJarvisV3PostGateReachableV1,
  evaluateJarvisV3PermissionGrantV1, jarvisV3ConstitutionManifestV1
} from '../src/jarvis/v3-constitution-v1.js';
import { getJarvisProgramDefinitionV1, JARVIS_V3_PROGRAM_ID } from '../src/jarvis/program-catalog-v1.js';
import { getJarvisWaveRegistryEntryV1, JARVIS_V3_WAVE_REGISTRY_PROGRAM } from '../src/jarvis/wave-registry-v1.js';

assert.equal(JARVIS_V3_PROGRAM, JARVIS_V3_PROGRAM_ID);
assert.equal(JARVIS_V3_TOTAL_WAVES, 26);
assert.equal(JARVIS_V3_PHASE_A_WAVE_WEIGHT_PERCENT, 5);
assert.equal(JARVIS_V3_POST_GATE_WAVE_WEIGHT_PERCENT, 3);
assert.equal(JARVIS_V3_WAVE_WEIGHTS.length, 26);
assert.deepEqual(JARVIS_V3_WAVE_WEIGHTS.slice(0, 11), Array(11).fill(5));
assert.deepEqual(JARVIS_V3_WAVE_WEIGHTS.slice(11), Array(15).fill(3));
assert.equal(JARVIS_V3_WAVE_WEIGHTS.reduce((a,b)=>a+b,0), 100);
assert.equal(JARVIS_V3_AUTONOMOUS_PHASE_A_LAST_WAVE, 10);
assert.equal(JARVIS_V3_FIRST_HUMAN_GATE_WAVE, 11);

const definition = getJarvisProgramDefinitionV1(JARVIS_V3_PROGRAM_ID);
assert.deepEqual(definition.wave_weights, [...JARVIS_V3_WAVE_WEIGHTS]);
assert.equal(definition.wave_weights.slice(0,11).reduce((a,b)=>a+b,0), 55);

for (let i=0;i<=10;i++) assert.equal(computeJarvisV3PhaseV1(i), 'PHASE_A');
assert.equal(computeJarvisV3PhaseV1(11), 'HUMAN_GATE');
for (let i=12;i<=19;i++) assert.equal(computeJarvisV3PhaseV1(i), 'PHASE_B');
for (let i=20;i<=25;i++) assert.equal(computeJarvisV3PhaseV1(i), 'PHASE_C');
assert.equal(getJarvisV3RoadmapEntryV1(25).title, 'Autonomous E2E + Final Completion Seal');
assert.equal(getJarvisV3RoadmapEntryV1(26), null);

assert.equal(isJarvisV3HumanGateClearedV1([0,1,10]), false);
assert.equal(isJarvisV3HumanGateClearedV1([0,1,11]), true);
assert.equal(isJarvisV3PostGateReachableV1(11), true);
assert.equal(isJarvisV3PostGateReachableV1(12), false);
assert.equal(isJarvisV3PostGateReachableV1(25, {human_gate_cleared:true}), true);

for (const cap of [
  'MAIN_MASTER_MUTATION','MERGE','PUSH','FORCE_PUSH','DEPLOY','PRODUCTION_ACTIVATION','PUBLIC_RELEASE',
  'DNS_MUTATION','CLOUDFLARE_MUTATION','BILLING','DESTRUCTIVE_DB','HAMYREN_DATA_FLOW',
  'UNAPPROVED_EXTERNAL_NETWORK_CALL','UNAPPROVED_ACCOUNT_CONNECTION','UNAPPROVED_EXTERNAL_WRITE',
  'WORKER_SECRET_ACCESS','SECRET_OUTPUT','CREDENTIAL_EXFILTRATION','SELF_GRANTED_PERMISSION'
]) assert.ok(JARVIS_V3_SAFETY_DENYLIST.includes(cap), `${cap} stays forbidden`);

for (const cap of JARVIS_V3_POST_GATE_CAPABILITIES) {
  assert.deepEqual(evaluateJarvisV3PermissionGrantV1({actor_type:'OPERATOR',capability:cap}), {granted:false,reason:'HUMAN_GATE_NOT_CLEARED'});
  assert.deepEqual(evaluateJarvisV3PermissionGrantV1({actor_type:'SYSTEM',capability:cap,human_gate_cleared:true}), {granted:false,reason:'ONLY_OPERATOR_MAY_GRANT_NEVER_SELF'});
  assert.deepEqual(evaluateJarvisV3PermissionGrantV1({actor_type:'OPERATOR',capability:cap,human_gate_cleared:true}), {granted:true,reason:'OPERATOR_ELIGIBLE'});
}
assert.deepEqual(evaluateJarvisV3PermissionGrantV1({actor_type:'OPERATOR',capability:'HAMYREN_DATA_FLOW',human_gate_cleared:true}), {granted:false,reason:'CONSTITUTIONALLY_FORBIDDEN'});

const w11 = getJarvisWaveRegistryEntryV1(JARVIS_V3_WAVE_REGISTRY_PROGRAM, 11);
assert.ok(w11);
assert.equal(w11.operator_task_required, true);
for (let i=12;i<=25;i++) assert.equal(getJarvisWaveRegistryEntryV1(JARVIS_V3_WAVE_REGISTRY_PROGRAM,i), null);

const manifest = jarvisV3ConstitutionManifestV1();
assert.equal(manifest.total_waves,26);
assert.equal(manifest.total_weight_percent,100);
assert.equal(manifest.roadmap.length,26);
assert.equal(manifest.w11_external_effects_allowed,false);
assert.equal(manifest.unapproved_external_calls_allowed,false);
assert.equal(manifest.unapproved_account_connections_allowed,false);
assert.equal(manifest.unapproved_external_writes_allowed,false);
assert.equal(manifest.operator_authorized_post_gate_reads_possible,true);
assert.equal(manifest.approval_gated_external_writes_possible,true);
assert.equal(manifest.hamyren_data_flow,false);

console.log(JSON.stringify({schema:'aurentara.jarvis.v3.constitution.smoke.v1.1',passed:true,total_waves:26,phase_a_verified_weight:55,post_gate_weight:45,human_gate_wave:11},null,2));
