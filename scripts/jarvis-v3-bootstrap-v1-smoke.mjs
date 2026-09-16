import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { getJarvisProgramDefinitionV1, JARVIS_V3_PROGRAM_ID } from '../src/jarvis/program-catalog-v1.js';
import { computeJarvisProgramProgressV1 } from '../src/jarvis/program-progress-v1.js';
import { getJarvisWaveRegistryEntryV1 } from '../src/jarvis/wave-registry-v1.js';
import { computeJarvisWorkingTreeWaveEvidenceV1 } from '../src/jarvis/working-tree-wave-evidence-v1.js';
import { createJarvisAcceptedWorkPublisherV1 } from '../src/jarvis/accepted-work-publisher-v1.js';
import { createJarvisProgramRunnerV1 } from '../src/jarvis/program-runner-v1.js';
import { handleJarvisProgramStateRuntimeV1 } from '../src/jarvis/program-controller-v1.js';
import { createMemoryJarvisStoreV1 } from '../src/jarvis/memory-store-memory-v1.js';
import { createJarvisAuditEventV1 } from '../src/jarvis/audit-v1.js';

const OWNER_ID = '8048e3a6-941f-5ea7-ac74-11f9929d2523';
const OWNER_REF = 'jarvis:operator:local-operator@localhost';
const branch = 'factory/jarvis-capability-expansion-v3';
const git = (repo, args) => execFileSync('git', args, { cwd: repo, stdio: ['ignore','pipe','pipe'] }).toString('utf8').trim();

const definition = getJarvisProgramDefinitionV1(JARVIS_V3_PROGRAM_ID);
assert.equal(definition.wave_weights.length, 26);
assert.equal(definition.wave_weights.reduce((a,b)=>a+b,0), 100);
assert.equal(definition.wave_weights.slice(0,11).reduce((a,b)=>a+b,0), 55);
assert.deepEqual(definition.wave_weights.slice(11), Array(15).fill(3));
assert.equal(definition.autonomous_phase_a_last_wave, 10);
assert.equal(definition.first_human_gate_wave, 11);
assert.equal(computeJarvisProgramProgressV1('UNKNOWN', []).known_program, false);
const progress = computeJarvisProgramProgressV1(JARVIS_V3_PROGRAM_ID, [
  { wave_index:0, wave_state:'COMPLETE', independent_acceptance:true, acceptance_ref:'a0', at:'2026-01-01T00:00:00Z' },
  { wave_index:1, wave_state:'COMPLETE', independent_acceptance:false, acceptance_ref:null, at:'2026-01-02T00:00:00Z' }
]);
assert.equal(progress.verified_progress_percent, 5);
assert.deepEqual(progress.completed_waves, [0]);
assert.equal(progress.current_wave, 1);
for (let i=0;i<=10;i++) assert.ok(getJarvisWaveRegistryEntryV1(JARVIS_V3_PROGRAM_ID, i), `wave ${i} must be registered`);
const w11 = getJarvisWaveRegistryEntryV1(JARVIS_V3_PROGRAM_ID, 11);
assert.ok(w11, 'Wave 11 is registered only so Independent Acceptance can verify its fixed surface');
assert.equal(w11.operator_task_required, true, 'Wave 11 can never be mechanically proposed');
assert.equal(getJarvisWaveRegistryEntryV1(JARVIS_V3_PROGRAM_ID, 12), null, 'post-gate tasks remain unregistered until W11 is accepted');

const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-v3-bootstrap-'));
git(repo, ['init','-q']);
git(repo, ['symbolic-ref','HEAD',`refs/heads/${branch}`]);
git(repo, ['config','user.email','smoke@example.invalid']);
git(repo, ['config','user.name','JARVIS Smoke']);
fs.writeFileSync(path.join(repo,'README.md'),'fixture\n');
git(repo, ['add','.']);
git(repo, ['commit','-q','-m','fixture']);
const controllerStore = createMemoryJarvisStoreV1();
const v3State = await handleJarvisProgramStateRuntimeV1({ owner_id:OWNER_ID, owner_ref:OWNER_REF, program:JARVIS_V3_PROGRAM_ID, repo_dir:repo, target_branch:branch }, { memory_store:controllerStore });
assert.equal(v3State.ok, true);
assert.equal(v3State.current_wave, 0);
assert.equal(v3State.verified_progress_percent, 0);
const unknownState = await handleJarvisProgramStateRuntimeV1({ owner_id:OWNER_ID, owner_ref:OWNER_REF, program:'JARVIS_UNKNOWN_V99', repo_dir:repo, target_branch:branch }, { memory_store:controllerStore });
assert.equal(unknownState.ok, false);
assert.equal(unknownState.error, 'JARVIS_PROGRAM_UNKNOWN');
fs.mkdirSync(path.join(repo,'src/jarvis'), { recursive:true });
fs.mkdirSync(path.join(repo,'scripts'), { recursive:true });
fs.writeFileSync(path.join(repo,'src/jarvis/skill-registry-v1.js'), 'export const skills = Object.freeze([]);\n');
fs.writeFileSync(path.join(repo,'scripts/jarvis-skill-registry-v1-smoke.mjs'), "import assert from 'node:assert/strict'; assert.ok(true);\n");
const verification = { branch, branch_drift:false, files_changed:['src/jarvis/skill-registry-v1.js','scripts/jarvis-skill-registry-v1-smoke.mjs'], pre_existing_dirty_files:[], syntax_check:{passed:true,checked:2,results:[]} };
const evidence = computeJarvisWorkingTreeWaveEvidenceV1({ repo_dir:repo, target_branch:branch, program:JARVIS_V3_PROGRAM_ID, wave_index:1, verification });
assert.equal(evidence.sufficient, true);
fs.writeFileSync(path.join(repo,'src/jarvis/skill-registry-v1.js'), "export const denied = 'HAMYREN_DATA_FLOW';\n");
const hamyrenDenyToken = computeJarvisWorkingTreeWaveEvidenceV1({ repo_dir:repo, target_branch:branch, program:JARVIS_V3_PROGRAM_ID, wave_index:1, verification });
assert.equal(hamyrenDenyToken.sufficient, true, 'denylist token must not be mistaken for a HAMYREN data flow');
fs.writeFileSync(path.join(repo,'src/jarvis/skill-registry-v1.js'), "export const unsafe = 'enable hamyren data flow';\n");
const hamyrenUnsafe = computeJarvisWorkingTreeWaveEvidenceV1({ repo_dir:repo, target_branch:branch, program:JARVIS_V3_PROGRAM_ID, wave_index:1, verification });
assert.equal(hamyrenUnsafe.sufficient, false);
assert.equal(hamyrenUnsafe.reason, 'FORBIDDEN_PATTERN_IN_WORKING_TREE');
fs.writeFileSync(path.join(repo,'src/jarvis/skill-registry-v1.js'), 'export const skills = Object.freeze([]);\n');
fs.writeFileSync(path.join(repo,'unexpected.txt'),'nope\n');
const bad = computeJarvisWorkingTreeWaveEvidenceV1({ repo_dir:repo, target_branch:branch, program:JARVIS_V3_PROGRAM_ID, wave_index:1, verification });
assert.equal(bad.sufficient, false);
assert.equal(bad.reason, 'UNEXPECTED_WORKING_TREE_FILES');
fs.rmSync(path.join(repo,'unexpected.txt'));

const store = createMemoryJarvisStoreV1();
const acceptedEvent = createJarvisAuditEventV1({
  timestamp:'2026-09-15T12:00:00.000Z', owner_ref:OWNER_REF,
  request:'accepted fixture', intent:{intent_type:'IMPLEMENTATION_MISSION',domain:'PROGRAM',action:'IMPLEMENTATION_MISSION'},
  tools_used:[], permissions:[], action:'IMPLEMENTATION_MISSION',
  result:{status:'COMPLETE',program:JARVIS_V3_PROGRAM_ID,wave_index:1,independent_acceptance:true,acceptance_ref:'fixture:accepted',verification},
  approval:{required:false,explicit:false,actor_type:'SYSTEM',gate_status:'INDEPENDENTLY_ACCEPTED'},
  cost:{estimated_eur:0,actual_eur:0}, memory_updates:{accepted:0,proposed:0,rejected:0}
});
await store.appendAudit({ owner_id:OWNER_ID, owner_ref:OWNER_REF, event:acceptedEvent });
const publisher = createJarvisAcceptedWorkPublisherV1({}, { memory_store:store, now:()=> '2026-09-15T12:01:00.000Z' });
const published = await publisher.publish({ owner_id:OWNER_ID, owner_ref:OWNER_REF, program:JARVIS_V3_PROGRAM_ID, repo_dir:repo, target_branch:branch });
assert.equal(published.ok, true);
assert.equal(published.local_commit_only, true);
assert.equal(published.push, false);
assert.equal(git(repo,['status','--porcelain']), '');
assert.match(git(repo,['log','-1','--pretty=%s']), /publish JARVIS_CAPABILITY_EXPANSION_V3 wave 1/);
let publicationCalls = 0;
const fakeController = { state: async()=>({ok:true,program_approval:{granted:true}}), tick: async()=>({ok:true}) };
const runner = createJarvisProgramRunnerV1({ owner_id:OWNER_ID, owner_ref:OWNER_REF, program:JARVIS_V3_PROGRAM_ID, repo_dir:repo, target_branch:branch, enabled:true, require_recovery:false }, {
  controller:fakeController,
  memory_store:store,
  run_loop:async()=>({ok:true,status:200,stop_reason:'BLOCKED_OPERATOR',final_state:{wave_reason:'WORKING_TREE_DIRTY',current_wave:2,verified_progress_percent:10}}),
  publisher:{ publish:async()=>{ publicationCalls++; return {ok:true,commit:'fixture-commit'}; } },
  set_timeout:()=>({unref(){}}), clear_timeout:()=>{}
});
const started = await runner.start({confirm_run:true});
assert.equal(started.ok, true);
const cycle = await runner.run_once();
assert.equal(cycle.ok, true);
assert.equal(cycle.stop_reason, 'ACCEPTED_WORK_PUBLISHED');
assert.equal(publicationCalls, 1);
runner.stop({confirm_stop:true});
fs.rmSync(repo, {recursive:true,force:true});

console.log(JSON.stringify({ schema:'aurentara.jarvis.v3.bootstrap.smoke.v1.1', passed:true, phase_a_waves:'0-10', phase_a_verified_weight:55, human_gate_wave:11, total_waves:26, trusted_local_publication:true, push:false, merge:false, deploy:false }, null, 2));
