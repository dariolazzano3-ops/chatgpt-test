import { buildSourceOfTruth, validateSourceOfTruth } from '../source-of-truth.js';
import { OPERATOR_AI_EXECUTION_BRIEF_SCHEMA, normalizeExecutionPolicy } from './contracts-v1.js';

const clean = (value, max = 4000) => String(value ?? '').trim().slice(0, max);
const clone = (value) => structuredClone(value ?? null);
const arr = (value) => Array.isArray(value) ? value : [];

function initialStatus(input, sourceBound) {
  if (!input.project_ref || !sourceBound || arr(input.conflicts).length) return 'BLOCKED';
  if (input.requested_autonomy >= 5) return 'READY_FOR_APPROVAL';
  if (input.requested_autonomy >= 4 && input.safe_internal_execution_active !== true) return 'READY_FOR_OPERATOR_REVIEW';
  if (input.requested_autonomy >= 3) return 'READY_FOR_EXECUTION';
  return 'READY_FOR_OPERATOR_REVIEW';
}

export function createOperatorAiExecutionBrief(input = {}) {
  const head = clean(input.canonical_head, 80) || null;
  const sot = buildSourceOfTruth({
    canonical_branch: clean(input.canonical_branch, 160) || 'factory-control',
    active_revision: head,
    project_head: head,
    mission_revision: head,
    expected_parent_sha: head
  });
  const sourceBound = sot.ok === true && sot.context?.bound === true;
  const executionPolicy = normalizeExecutionPolicy({
    autonomy_level: input.actual_autonomy,
    execution_mode: input.actual_autonomy >= 4 ? 'SAFE_INTERNAL' : input.actual_autonomy >= 3 ? 'PREPARE_ONLY' : 'NO_EXECUTION',
    repair_loop: true,
    max_repair_rounds: input.max_repair_rounds ?? 2,
    max_execution_attempts: input.max_execution_attempts ?? 3,
    max_provider_calls: input.max_provider_calls ?? 0,
    max_cost: input.max_cost ?? 0,
    max_scope: input.in_scope || [],
    merge_authorized: input.merge_authorized === true
  });
  const status = initialStatus({ ...input, requested_autonomy: Number(input.requested_autonomy || 0) }, sourceBound);
  const stopConditions = [
    'TRUE_EXTERNAL_BLOCKER','SCOPE_EXPANSION','SECURITY_FAILURE','REVISION_STALE','COST_LIMIT_EXCEEDED','APPROVAL_REQUIRED'
  ];
  if (input.safe_internal_execution_active !== true && Number(input.requested_autonomy) >= 4) stopConditions.push('SAFE_INTERNAL_EXECUTION_NOT_ACTIVATED');

  return {
    schema: OPERATOR_AI_EXECUTION_BRIEF_SCHEMA,
    brief_id: clean(input.brief_id, 220) || `operator-ai-brief:${Date.now()}`,
    created_at: clean(input.created_at, 100) || new Date().toISOString(),
    status,
    intent: clean(input.intent, 120),
    project_ref: clean(input.project_ref, 500) || null,
    source_of_truth: {
      canonical_branch: sot.context?.canonical_branch || clean(input.canonical_branch,160) || 'factory-control',
      canonical_head: sot.context?.project_head || null,
      expected_parent_sha: sot.context?.expected_parent_sha || null,
      verified_at: clean(input.verified_at, 100) || null
    },
    context_ref: clean(input.context_ref, 300) || null,
    objective: clean(input.objective, 4000),
    scope: { in_scope: arr(input.in_scope).map((v) => clean(v,500)).filter(Boolean), out_of_scope: arr(input.out_of_scope).map((v) => clean(v,500)).filter(Boolean) },
    required_capabilities: clone(arr(input.required_capabilities)),
    mission_input: clone(input.mission_input || {}),
    constraints: {
      safety: clone(arr(input.safety_constraints)),
      cost_preflight_ref: input.cost_preflight_ref || null,
      provider_preflight_ref: input.provider_preflight_ref || null,
      approval_requirements: clone(arr(input.approval_requirements)),
      quality_target: input.quality_target ?? null,
      explicit_no_execution: input.explicit_no_execution === true
    },
    acceptance: clone(arr(input.acceptance)),
    execution_policy: executionPolicy,
    requested_autonomy: Number(input.requested_autonomy || 0),
    truth: {
      verified_facts: clone(arr(input.verified_facts)),
      supported_facts: clone(arr(input.supported_facts)),
      unknowns: clone(arr(input.unknowns)),
      conflicts: clone(arr(input.conflicts))
    },
    stop_conditions: stopConditions,
    production_deploy: false,
    external_writes: false
  };
}

export function validateOperatorAiExecutionBriefRevision(brief = {}, observed = {}) {
  const expected = brief.source_of_truth?.expected_parent_sha;
  const checked = validateSourceOfTruth({
    canonical_branch: brief.source_of_truth?.canonical_branch,
    project_head: expected,
    expected_parent_sha: expected
  }, { project_head: observed.canonical_head || observed.project_head || observed.active_revision });
  if (!checked.ok || checked.status !== 'CURRENT') return { ok: false, status: 'BRIEF_STALE', error: checked.code || 'BRIEF_STALE', source_of_truth: checked, production_deploy: false };
  return { ok: true, status: 'CURRENT', source_of_truth: checked, production_deploy: false };
}

export function operatorAiExecutionBriefManifest() {
  return { schema: OPERATOR_AI_EXECUTION_BRIEF_SCHEMA, structured_brief_is_machine_truth: true, source_revision_bound: true, stale_brief_blocks_execution: true, production_authorized_default: false, external_writes_authorized_default: false, production_deploy: false };
}
