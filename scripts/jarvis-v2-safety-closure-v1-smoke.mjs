import assert from 'node:assert/strict';
import { jarvisBranchManagerManifestV1 } from '../src/jarvis/branch-manager-v1.js';
import { jarvisProgramApprovalManifestV1, JARVIS_PROGRAM_APPROVAL_NEVER_COVERED } from '../src/jarvis/program-approval-v1.js';
import { jarvisEngineeringMissionAcceptanceManifestV1 } from '../src/jarvis/engineering-mission-acceptance-v1.js';
import { jarvisEngineeringMissionResumeManifestV1 } from '../src/jarvis/engineering-mission-resume-v1.js';
import { jarvisProgramControllerManifestV1 } from '../src/jarvis/program-controller-v1.js';
import { jarvisProgramLoopManifestV1 } from '../src/jarvis/program-loop-v1.js';
import { jarvisProgramRunnerManifestV1 } from '../src/jarvis/program-runner-v1.js';
import { jarvisProgramRunnerRecoveryManifestV1 } from '../src/jarvis/program-runner-recovery-v1.js';
import { jarvisV2ProgressManifestV1 } from '../src/jarvis/v2-progress-v1.js';

const branch = jarvisBranchManagerManifestV1();
assert.equal(branch.can_touch_main_master, false);
assert.equal(branch.can_force_push, false);
assert.equal(branch.can_push, false);
assert.equal(branch.can_destroy_unique_work, false);
assert.equal(branch.fail_closed_on_dirty_tree, true);
assert.equal(branch.fail_closed_on_protected_target, true);

const approval = jarvisProgramApprovalManifestV1();
assert.deepEqual(new Set(approval.never_covered), new Set(JARVIS_PROGRAM_APPROVAL_NEVER_COVERED));
for (const cap of ['MAIN_MASTER_MUTATION','MERGE','DEPLOY','PRODUCTION_ACTIVATION','DNS_MUTATION','CLOUDFLARE_MUTATION','BILLING','SECRET_ACCESS','PUBLIC_RELEASE','DESTRUCTIVE_DB','HAMY' + 'REN_DATA_FLOW','FORCE_PUSH']) assert.ok(approval.never_covered.includes(cap));
const acceptance = jarvisEngineeringMissionAcceptanceManifestV1();
assert.equal(acceptance.self_acceptance_by_worker, false);
assert.equal(acceptance.distinct_operator_action_required, true);
assert.equal(acceptance.requires_repo_bound_verification, true);
assert.equal(acceptance.requires_real_files_changed, true);
assert.equal(acceptance.requires_no_branch_drift, true);
assert.equal(acceptance.fails_closed, true);

const resume = jarvisEngineeringMissionResumeManifestV1();
assert.equal(resume.duplicate_execution_guard, 'AUDIT_DERIVED_CLAUDE_EXECUTION_STATE');
assert.equal(resume.approval_bypassed, false);
assert.equal(resume.worker_self_acceptance_counts_as_independent, false);
assert.equal(resume.fails_closed, true);

const controller = jarvisProgramControllerManifestV1();
assert.equal(controller.one_mutating_action_per_tick, true);
assert.equal(controller.max_repair_attempts, 3);
assert.equal(controller.state_is_audit_derived, true);
assert.equal(controller.state_has_its_own_mutable_table, false);
assert.equal(controller.autonomy_pause_blocks_all_mutating_actions, true);

const loop = jarvisProgramLoopManifestV1();
assert.equal(loop.concurrent_ticks_ever, false);
assert.equal(loop.task_fabricated, false);
assert.equal(loop.grants_program_approval_ever, false);
assert.equal(loop.dirty_accepted_work_carried_into_next_wave_ever, false);
const runner = jarvisProgramRunnerManifestV1();
assert.equal(runner.capability_enabled_by_default, false);
assert.equal(runner.explicit_start_confirmation_required, true);
assert.equal(runner.overlapping_cycles_ever, false);
assert.equal(runner.grants_program_approval_ever, false);
assert.equal(runner.invents_wave_task_ever, false);
assert.equal(runner.public_access, false);
assert.equal(runner.production_deploy, false);
assert.equal(runner.hamyren_data_flow, false);

const recovery = jarvisProgramRunnerRecoveryManifestV1();
assert.equal(recovery.mutable_recovery_table, false);
assert.equal(recovery.interrupted_cycle_replayed_blindly, false);
assert.equal(recovery.controller_state_rederived_after_restart, true);
assert.equal(recovery.duplicate_guard_delegated_to_existing_controller_paths, true);

const progress = jarvisV2ProgressManifestV1();
assert.equal(progress.requires_independent_acceptance, true);
assert.equal(progress.worker_self_report_counts, false);
assert.equal(progress.infers_from_elapsed_time, false);
assert.equal(progress.total_weight, 100);
assert.equal(progress.wave_count, 13);
assert.equal(progress.production_deploy, false);
assert.equal(progress.hamyren_data_flow, false);

console.log('JARVIS V2 Safety Closure V1: PASS');
