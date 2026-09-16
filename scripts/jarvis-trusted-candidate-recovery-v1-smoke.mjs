import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createMemoryJarvisStoreV1 } from '../src/jarvis/memory-store-memory-v1.js';
import { createJarvisAuditEventV1 } from '../src/jarvis/audit-v1.js';
import {
  createJarvisTrustedCandidateRecovererV1,
  evaluateJarvisTrustedCandidateRecoveryV1,
  matchJarvisRecoveryProvenanceV1,
  JARVIS_TRUSTED_CANDIDATE_RECOVERY_STATE
} from '../src/jarvis/trusted-candidate-recovery-v1.js';
import {
  evaluateJarvisEngineeringMissionAcceptanceStateV1,
  handleJarvisEngineeringMissionAcceptanceRuntimeV1
} from '../src/jarvis/engineering-mission-acceptance-v1.js';

const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const OWNER_REF = 'jarvis:operator:op@example.invalid';
const PROGRAM = 'JARVIS_CAPABILITY_EXPANSION_V3';
const BRANCH = 'factory/jarvis-capability-expansion-v3';
const EXPECTED = ['src/jarvis/memory-ingestion-v1.js', 'scripts/jarvis-memory-ingestion-v1-smoke.mjs'];
const ids = ['11111111-1111-4111-8111-111111111101','11111111-1111-4111-8111-111111111102','11111111-1111-4111-8111-111111111103'];
const git = (repo, args) => execFileSync('git', args, { cwd: repo, stdio: ['ignore','pipe','pipe'] }).toString('utf8').trim();
const provenanceExpected = ['src/jarvis/wave-task-planner-v1.js', 'scripts/jarvis-v3-phase-b-gate-v1-smoke.mjs'];
assert.deepEqual(matchJarvisRecoveryProvenanceV1([...provenanceExpected], provenanceExpected), { matched:true, mode:'EXACT' });
assert.deepEqual(matchJarvisRecoveryProvenanceV1(['src/jarvis/wave-ta[REDACTED].js', provenanceExpected[1]], provenanceExpected), { matched:true, mode:'LEGACY_AUDIT_REDACTION' });
assert.deepEqual(matchJarvisRecoveryProvenanceV1(['src/jarvis/wave-[REDACTED].js', provenanceExpected[1]], provenanceExpected), { matched:false, mode:null });
const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-trusted-candidate-'));
git(repo, ['init','-q']);
git(repo, ['config','user.email','fixture@example.invalid']);
git(repo, ['config','user.name','Fixture']);
fs.writeFileSync(path.join(repo,'README.md'),'fixture\n');
git(repo, ['add','.']);
git(repo, ['commit','-q','-m','fixture']);
git(repo, ['branch','-m',BRANCH]);
fs.mkdirSync(path.join(repo,'src/jarvis'), { recursive:true });
fs.mkdirSync(path.join(repo,'scripts'), { recursive:true });
fs.writeFileSync(path.join(repo,EXPECTED[0]), 'export const memoryIngestionFixture = true;\n');
fs.writeFileSync(path.join(repo,EXPECTED[1]), "import assert from 'node:assert/strict'; import { memoryIngestionFixture } from '../src/jarvis/memory-ingestion-v1.js'; assert.equal(memoryIngestionFixture,true); console.log('fixture pass');\n");

const store = createMemoryJarvisStoreV1();
async function append(event) {
  await store.appendAudit({ owner_id:OWNER_ID, owner_ref:OWNER_REF, event });
}
function eventAt(timestamp, action, result, requestId = null) {
  const e = createJarvisAuditEventV1({ timestamp, owner_ref:OWNER_REF, request:action, intent:{ intent_type:'IMPLEMENTATION_MISSION', domain:'PROGRAM', action:'IMPLEMENTATION_MISSION' }, tools_used:[], permissions:[], action, result, approval:{required:false,explicit:false,actor_type:'SYSTEM',gate_status:'FIXTURE'}, cost:{estimated_eur:0,actual_eur:0}, memory_updates:{accepted:0,proposed:0,rejected:0} });
  if (requestId) e.request_id = requestId;
  return e;
}
await append(eventAt('2026-09-16T00:00:00Z','ACCEPTED_WORK_PUBLICATION', { status:'COMPLETED', program:PROGRAM, wave_index:4, commit:git(repo,['rev-parse','HEAD']) }));
for (let i = 0; i < ids.length; i += 1) {
  const id = ids[i];
  await append(eventAt(`2026-09-16T00:0${i+1}:00Z`,'IMPLEMENTATION_MISSION', {
    status:'PREPARED', verified:true, program:PROGRAM, wave_index:5, wave_state:'NOT_STARTED',
    title:'Memory Ingestion V1', goal:'fixture goal', independent_acceptance:false
  }, id));
  await append(eventAt(`2026-09-16T00:0${i+1}:30Z`,'IMPLEMENTATION_MISSION', {
    status:'FAILED', verified:false, program:PROGRAM, wave_index:5, wave_state:'FAILED',
    title:'Memory Ingestion V1', goal:'fixture goal', independent_acceptance:false,
    claude_execution_state:'FAILED', verification:i === 0 ? null : {
      branch:BRANCH, branch_drift:false, files_changed:[], pre_existing_dirty_files:[...EXPECTED],
      syntax_check:{passed:true,checked:0,results:[]}
    }
  }, id));
}

let audit = await store.readAudit({ owner_id:OWNER_ID, owner_ref:OWNER_REF, limit:500 });
let evaluation = evaluateJarvisTrustedCandidateRecoveryV1({ audit, program:PROGRAM, wave_index:5, repo_dir:repo, target_branch:BRANCH, max_repair_attempts:3 });
assert.equal(evaluation.eligible, true);
assert.equal(evaluation.request_id, ids[2]);
assert.deepEqual(evaluation.evidence.actual_dirty_files.sort(), [...EXPECTED].sort());

fs.writeFileSync(path.join(repo,'unexpected.txt'),'nope\n');
const blocked = evaluateJarvisTrustedCandidateRecoveryV1({ audit, program:PROGRAM, wave_index:5, repo_dir:repo, target_branch:BRANCH, max_repair_attempts:3 });
assert.equal(blocked.eligible, false);
assert.match(blocked.reason, /UNEXPECTED_WORKING_TREE_FILES/);
fs.rmSync(path.join(repo,'unexpected.txt'));
const recoverer = createJarvisTrustedCandidateRecovererV1({}, { memory_store:store, now:()=> '2026-09-16T00:10:00Z' });
const recovered = await recoverer.recover({ owner_id:OWNER_ID, owner_ref:OWNER_REF, program:PROGRAM, wave_index:5, repo_dir:repo, target_branch:BRANCH, max_repair_attempts:3 });
assert.equal(recovered.ok, true);
assert.equal(recovered.independent_acceptance, false);
assert.equal(recovered.acceptance_ref, null);

audit = await store.readAudit({ owner_id:OWNER_ID, owner_ref:OWNER_REF, limit:500 });
const state = evaluateJarvisEngineeringMissionAcceptanceStateV1(audit, ids[2]);
assert.equal(state.dispatched, true);
assert.equal(state.verification_sufficient, true);
assert.equal(state.acceptable, true);
const recoveryRow = audit.find((r) => r.request_id === ids[2] && r?.result?.trusted_candidate_recovery === true);
assert.equal(recoveryRow.result.claude_execution_state, JARVIS_TRUSTED_CANDIDATE_RECOVERY_STATE);
assert.equal(recoveryRow.result.independent_acceptance, false);

const accepted = await handleJarvisEngineeringMissionAcceptanceRuntimeV1({ owner_id:OWNER_ID, owner_ref:OWNER_REF, request_id:ids[2], now:'2026-09-16T00:11:00Z' }, { memory_store:store });
assert.equal(accepted.ok, true);
assert.equal(accepted.accepted, true);
assert.equal(accepted.wave_index, 5);

console.log(JSON.stringify({ schema:'aurentara.jarvis.trusted-candidate-recovery.smoke.v1', passed:true, recovered_wave:5, recovery_grants_acceptance:false, normal_acceptance_after_recovery:true, unexpected_file_blocked:true }, null, 2));
fs.rmSync(repo, {recursive:true,force:true});