import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createMemoryJarvisStoreV1 } from '../src/jarvis/memory-store-memory-v1.js';
import { evaluateJarvisProgramApprovalActionV1, evaluateJarvisProgramApprovalStateV1, JARVIS_PROGRAM_APPROVAL_NEVER_COVERED } from '../src/jarvis/program-approval-v1.js';
import { evaluateJarvisBranchTruthV1 } from '../src/jarvis/branch-manager-v1.js';
import { evaluateJarvisRepoBoundVerificationV1 } from '../src/jarvis/engineering-mission-acceptance-v1.js';
import { evaluateJarvisEngineeringMissionResumeStateV1 } from '../src/jarvis/engineering-mission-resume-v1.js';
import { computeJarvisV2ProgressV1 } from '../src/jarvis/v2-progress-v1.js';
import { deriveJarvisProgramWaveStateV1, handleJarvisProgramTickRuntimeV1, JARVIS_AUTONOMY_PAUSED_ENV_VAR } from '../src/jarvis/program-controller-v1.js';
import { createJarvisProgramRunnerV1 } from '../src/jarvis/program-runner-v1.js';
import { evaluateJarvisProgramRunnerRecoveryV1 } from '../src/jarvis/program-runner-recovery-v1.js';
import { runJarvisBoundedProgramLoopV1 } from '../src/jarvis/program-loop-v1.js';
import { proposeJarvisWaveTaskV1, jarvisWaveTaskPlannerManifestV1 } from '../src/jarvis/wave-task-planner-v1.js';
import { JARVIS_WAVE_REGISTRY_PROGRAM } from '../src/jarvis/wave-registry-v1.js';

let passed = 0;
const check = async (name, fn) => { await fn(); passed += 1; console.log(`ok - ${name}`); };
const git = (dir, args) => execFileSync('git', args, { cwd: dir, stdio: ['ignore','pipe','pipe'] }).toString('utf8').trim();
function repo(branch = 'main') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-failure-matrix-'));
  git(dir, ['init','-q']); git(dir, ['config','user.email','matrix@example.invalid']); git(dir, ['config','user.name','Matrix']);
  fs.writeFileSync(path.join(dir,'README.md'),'# matrix\n'); git(dir,['add','.']); git(dir,['commit','-q','-m','init']); git(dir,['branch','-m',branch]); return dir;
}
await check('Program Approval denylist is never coverable', () => {
  const grant = { granted: true, program: 'P', repo_dir: '/r', target_branch: 'factory/x', scope: [...JARVIS_PROGRAM_APPROVAL_NEVER_COVERED] };
  for (const capability of JARVIS_PROGRAM_APPROVAL_NEVER_COVERED) {
    assert.deepEqual(evaluateJarvisProgramApprovalActionV1(grant, { capability, program: 'P', repo_dir: '/r', target_branch: 'factory/x' }), { covered: false, reason: 'NEVER_COVERABLE' });
  }
});

await check('missing Program Approval stops runner before tick', async () => {
  let ticks = 0;
  const controller = { state: async () => ({ ok: true, program_approval: { granted: false } }), tick: async () => { ticks++; return { ok: true }; } };
  const runner = createJarvisProgramRunnerV1({ enabled: true, owner_id: 'o', owner_ref: 'r', program: 'P', repo_dir: '/r', target_branch: 'factory/x' }, { controller, set_timeout: () => ({ unref() {} }), clear_timeout: () => {} });
  assert.equal((await runner.start({ confirm_run: true })).ok, true);
  const out = await runner.run_once();
  assert.equal(out.stop_reason, 'PROGRAM_APPROVAL_REQUIRED'); assert.equal(ticks, 0);
});

await check('revoked Program Approval latest-wins', () => {
  const rows = [
    { action:'PROGRAM_APPROVAL', timestamp:'2026-01-01T00:00:00Z', intent:{intent_type:'PROGRAM_APPROVAL_GRANT'}, result:{program:'P',repo_dir:'/r',target_branch:'factory/x',scope:['ACCEPTANCE']} },
    { action:'PROGRAM_APPROVAL', timestamp:'2026-01-01T00:01:00Z', intent:{intent_type:'PROGRAM_APPROVAL_REVOKE'}, result:{program:'P'} }
  ];
  const state = evaluateJarvisProgramApprovalStateV1(rows, 'P'); assert.equal(state.granted, false); assert.equal(state.revoked, true);
});

await check('global autonomy pause makes Program Tick inert', async () => {
  const dir = repo('factory/pause'); const store = createMemoryJarvisStoreV1(); const before = git(dir,['status','--porcelain']);
  const old = process.env[JARVIS_AUTONOMY_PAUSED_ENV_VAR]; process.env[JARVIS_AUTONOMY_PAUSED_ENV_VAR] = 'true';
  try {
    const out = await handleJarvisProgramTickRuntimeV1({ owner_id:'11111111-1111-4111-8111-111111111111', owner_ref:'jarvis:operator:m@example.invalid', program:JARVIS_WAVE_REGISTRY_PROGRAM, repo_dir:dir, target_branch:'factory/pause' }, { memory_store:store });
    assert.equal(out.paused, true); assert.equal(out.performed.action, 'NONE'); assert.equal(git(dir,['status','--porcelain']), before);
  } finally { if (old === undefined) delete process.env[JARVIS_AUTONOMY_PAUSED_ENV_VAR]; else process.env[JARVIS_AUTONOMY_PAUSED_ENV_VAR] = old; }
});
await check('protected main branch is blocked', () => {
  const dir = repo('main'); const truth = evaluateJarvisBranchTruthV1({ repo_dir:dir, target_branch:'main', base_ref:'HEAD' });
  assert.equal(truth.target_branch_protected, true);
});

await check('dirty tracked worktree is blocked', () => {
  const dir = repo('factory/dirty'); fs.writeFileSync(path.join(dir,'README.md'),'dirty\n');
  const truth = evaluateJarvisBranchTruthV1({ repo_dir:dir, target_branch:'factory/dirty', base_ref:'HEAD' });
  assert.equal(truth.working_tree_clean, false);
  const state = deriveJarvisProgramWaveStateV1({ waveRuns:[], branchTruth:truth, dispatchCovered:true, acceptCovered:true });
  assert.equal(state.state, 'BLOCKED_OPERATOR'); assert.equal(state.reason, 'WORKING_TREE_DIRTY');
});

await check('branch drift verification is insufficient', () => {
  const v = evaluateJarvisRepoBoundVerificationV1({ branch:'factory/x', branch_drift:true, files_changed:['x.js'], syntax_check:{passed:true} });
  assert.equal(v.sufficient, false); assert.equal(v.reason, 'BRANCH_DRIFT_DETECTED');
});

await check('worker COMPLETE with no changed files never accepts', () => {
  const v = evaluateJarvisRepoBoundVerificationV1({ branch:'factory/x', branch_drift:false, files_changed:[], syntax_check:{passed:true} });
  assert.equal(v.sufficient, false); assert.equal(v.reason, 'NO_REAL_FILES_CHANGED');
});

await check('syntax verification failure never accepts', () => {
  const v = evaluateJarvisRepoBoundVerificationV1({ branch:'factory/x', branch_drift:false, files_changed:['x.js'], syntax_check:{passed:false} });
  assert.equal(v.sufficient, false); assert.equal(v.reason, 'SYNTAX_CHECK_FAILED_OR_MISSING');
});

await check('worker COMPLETE without independent acceptance contributes zero progress', () => {
  const p = computeJarvisV2ProgressV1([{ wave_index:0, wave_state:'COMPLETE', independent_acceptance:false, acceptance_ref:null, at:'2026-01-01T00:00:00Z' }]);
  assert.equal(p.verified_progress_percent, 0); assert.deepEqual(p.completed_waves, []);
});
await check('timeout without sufficient verification is not dispatched for acceptance', () => {
  const id = '22222222-2222-4222-8222-222222222222';
  const rows = [
    { request_id:id, action:'IMPLEMENTATION_MISSION', timestamp:'2026-01-01T00:00:00Z', intent:{intent_type:'IMPLEMENTATION_MISSION_REQUEST'}, result:{title:'x',goal:'x',program:'P',wave_index:1} },
    { request_id:id, action:'FILE_WRITE', timestamp:'2026-01-01T00:01:00Z', result:{claude_execution_state:'TIMEOUT', verification:null} }
  ];
  const resume = evaluateJarvisEngineeringMissionResumeStateV1(rows, id);
  assert.equal(resume.already_executed, true); assert.equal(resume.resumable, false);
});

await check('duplicate dispatch state is never resumable', () => {
  const id = '33333333-3333-4333-8333-333333333333';
  const rows = [
    { request_id:id, action:'IMPLEMENTATION_MISSION', timestamp:'2026-01-01T00:00:00Z', intent:{intent_type:'IMPLEMENTATION_MISSION_REQUEST'}, result:{title:'x',goal:'x',program:'P',wave_index:1}, approval:{decision:'approve',decided_run_id:id} },
    { request_id:id, action:'FILE_WRITE', timestamp:'2026-01-01T00:01:00Z', result:{claude_execution_state:'COMPLETE', wave_state:'COMPLETE'} }
  ];
  const state = evaluateJarvisEngineeringMissionResumeStateV1(rows, id);
  assert.equal(state.already_executed, true); assert.equal(state.resumable, false);
});

await check('overlapping runner cycle is duplicate-guarded', async () => {
  let release; const gate = new Promise((r) => { release = r; });
  const controller = { state: async () => ({ ok:true, program_approval:{granted:true}, current_wave:1, verified_progress_percent:5, next_action:{action:'WAIT'}, branch_truth:{working_tree_clean:true} }), tick: async () => ({ok:true}) };
  const runner = createJarvisProgramRunnerV1({ enabled:true, owner_id:'o', owner_ref:'r', program:'P', repo_dir:'/r', target_branch:'factory/x' }, { controller, run_loop:async () => { await gate; return {ok:true,status:200,stop_reason:'WAIT',final_state:{current_wave:1,verified_progress_percent:5}}; }, set_timeout:()=>({unref(){}}), clear_timeout:()=>{} });
  await runner.start({confirm_run:true}); const first = runner.run_once(); await new Promise((r)=>setTimeout(r,0));
  const second = await runner.run_once(); assert.equal(second.duplicate_guard, true); release(); await first;
});

await check('interrupted runner cycle is rederived, never replayed blindly', () => {
  const recovery = evaluateJarvisProgramRunnerRecoveryV1({ audit:[{action:'PROGRAM_RUNNER_CYCLE',timestamp:'2026-01-01T00:00:00Z',result:{program:'P',repo_dir:'/r',target_branch:'factory/x',cycle_id:'c1',status:'STARTED'}}], program:'P',repo_dir:'/r',target_branch:'factory/x', controller_state:{ok:true,program_approval:{granted:true},verified_progress_percent:50,current_wave:5,wave_state:'PENDING',next_action:{action:'PROPOSE_WAVE_TASK'},branch_truth:{working_tree_clean:true}} });
  assert.equal(recovery.status,'RECOVERABLE_INTERRUPTION'); assert.equal(recovery.resume_allowed,true); assert.equal(recovery.reason,'INTERRUPTED_CYCLE_REDERIVED_FROM_CONTROLLER');
});
await check('max repair attempts blocks operator', () => {
  const branchTruth = { current_branch:'factory/x', target_branch:'factory/x', working_tree_clean:true };
  const waveRuns = [1,2,3].map((n) => ({ id:`r${n}`, status:'FAILED', approval_state:'GRANTED' }));
  const state = deriveJarvisProgramWaveStateV1({ waveRuns, branchTruth, dispatchCovered:true, acceptCovered:true });
  assert.equal(state.state,'BLOCKED_OPERATOR'); assert.equal(state.reason,'MAX_REPAIR_ATTEMPTS_EXCEEDED');
});

await check('unknown run status blocks operator', () => {
  const state = deriveJarvisProgramWaveStateV1({ waveRuns:[{id:'r',status:'MYSTERY',approval_state:'GRANTED'}], branchTruth:{current_branch:'factory/x',target_branch:'factory/x',working_tree_clean:true}, dispatchCovered:true, acceptCovered:true });
  assert.equal(state.state,'BLOCKED_OPERATOR'); assert.match(state.reason,/UNRECOGNIZED_RUN_STATUS/);
});

await check('undefined wave task is never fabricated', () => {
  assert.equal(proposeJarvisWaveTaskV1({ program:JARVIS_WAVE_REGISTRY_PROGRAM, waveIndex:99, completedWaves:[0,1,2,3,4,5,6,7,8,9,10] }), null);
  assert.equal(jarvisWaveTaskPlannerManifestV1().fabricates_task_text, false);
});

await check('recovery blocks missing next action', () => {
  const out = evaluateJarvisProgramRunnerRecoveryV1({ audit:[], program:'P',repo_dir:'/r',target_branch:'factory/x',controller_state:{ok:true,program_approval:{granted:true},verified_progress_percent:50,current_wave:5,wave_state:'PENDING',next_action:null,branch_truth:{working_tree_clean:true}} });
  assert.equal(out.resume_allowed,false); assert.equal(out.reason,'NO_NEXT_ACTION');
});

await check('Program Complete stops loop before any tick', async () => {
  let ticks=0;
  const out = await runJarvisBoundedProgramLoopV1({}, { controller:{ state:async()=>({ok:true,verified_progress_percent:100,wave_state:'ACCEPTED',next_action:null,branch_truth:{working_tree_clean:true}}), tick:async()=>{ticks++;return {ok:true};} } });
  assert.equal(out.stop_reason,'PROGRAM_COMPLETE'); assert.equal(out.ticks_used,0); assert.equal(ticks,0);
});

console.log(JSON.stringify({ schema:'aurentara.jarvis.v2.failure-matrix.v1', passed, fail_closed:true, production_deploy:false, hamyren_data_flow:false }, null, 2));
