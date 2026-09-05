import crypto from "node:crypto";
import { buildOrchestrationPlan } from "./orchestration-planner.js";
import { buildSourceOfTruth, validateSourceOfTruth } from "./source-of-truth.js";
import { assertExpectedRevision, missionRecoveryKey } from "./state-concurrency.js";

const TERMINAL = new Set(["COMPLETED", "BLOCKED", "FAILED", "CANCELLED"]);
const clean = (value, max = 4000) => String(value || "").trim().slice(0, max);
const now = () => new Date().toISOString();

function digest(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function taskState(task) {
  if (task.execution_state !== "READY_FOR_ENGINE") return "BLOCKED";
  if (task.depends_on?.length) return "WAITING_DEPENDENCIES";
  return "READY";
}

export function createMission(input = {}) {
  const plan = input.plan?.ok ? input.plan : buildOrchestrationPlan(input);
  if (!plan?.ok) return { ok: false, error: plan?.error || "MISSION_PLAN_REQUIRED", plan };
  const sourceOfTruthResult = buildSourceOfTruth(input.source_of_truth || input);
  if (!sourceOfTruthResult.ok) return sourceOfTruthResult;
  const sourceOfTruth = sourceOfTruthResult.context;

  const createdAt = now();
  const tasks = plan.tasks.map((task) => ({
    task_id: task.task_id,
    capability: task.capability,
    domain: task.domain,
    engine: task.engine,
    goal: task.goal,
    depends_on: [...(task.depends_on || [])],
    state: taskState(task),
    attempt: 0,
    max_attempts: 3,
    inputs: {},
    outputs: {},
    external_job_id: null,
    started_at: null,
    completed_at: null,
    last_error: null,
    production_deploy: false
  }));

  const missionCore = {
    orchestration_id: plan.orchestration_id,
    prompt: plan.prompt,
    project: plan.project,
    source_of_truth: sourceOfTruth,
    tasks: tasks.map(({ started_at, completed_at, last_error, ...task }) => task),
    ...(input.project_context_binding ? { project_context_binding: cloneMission(input.project_context_binding) } : {})
  };
  return {
    ok: true,
    schema_version: 3,
    orchestration_version: "3.8",
    mission_id: `mission-${digest(missionCore).slice(0, 24)}`,
    orchestration_id: plan.orchestration_id,
    prompt: plan.prompt,
    project: plan.project,
    source_of_truth: sourceOfTruth,
    ...(input.project_context_binding ? { project_context_binding: cloneMission(input.project_context_binding) } : {}),
    mission_revision: sourceOfTruth.mission_revision,
    status: tasks.every((task) => task.state === "BLOCKED") ? "BLOCKED" : "READY",
    revision: 1,
    execution_lease: null,
    tasks,
    events: [{ type: "MISSION_CREATED", at: createdAt, orchestration_id: plan.orchestration_id, mission_revision: sourceOfTruth.mission_revision, revision: 1 }],
    created_at: createdAt,
    updated_at: createdAt,
    safeguards: {
      automatic_multi_factory_execution: false,
      production_deploy: false,
      manual_production_approval_required: true,
      unavailable_capabilities_never_executed: true,
      task_attempts_bounded: true,
      stale_revision_execution_blocked: true,
      optimistic_concurrency_control: true,
      bounded_execution_leases: true
    }
  };
}

function cloneMission(mission) { return JSON.parse(JSON.stringify(mission)); }
function findTask(mission, taskId) { return mission.tasks.find((task) => task.task_id === taskId); }
function depsCompleted(mission, task) { return (task.depends_on || []).every((id) => findTask(mission, id)?.state === "COMPLETED"); }
function refreshReadyStates(mission) { for (const task of mission.tasks) if (task.state === "WAITING_DEPENDENCIES" && depsCompleted(mission, task)) task.state = "READY"; }
function refreshMissionStatus(mission) {
  const states = mission.tasks.map((task) => task.state);
  if (states.every((state) => state === "COMPLETED" || state === "BLOCKED")) mission.status = states.includes("BLOCKED") ? "PARTIALLY_BLOCKED" : "COMPLETED";
  else if (states.some((state) => state === "FAILED")) mission.status = "FAILED";
  else if (states.some((state) => state === "RUNNING")) mission.status = "RUNNING";
  else mission.status = "READY";
}

export function transitionMissionTask(missionInput, taskId, action, payload = {}) {
  const revisionCheck = assertExpectedRevision(missionInput || {}, payload.expected_revision);
  if (!revisionCheck.ok) return { ok: false, error: revisionCheck.code, ...revisionCheck };
  const mission = cloneMission(missionInput || {});
  if (!Array.isArray(mission.tasks)) return { ok: false, error: "INVALID_MISSION" };
  const task = findTask(mission, taskId);
  if (!task) return { ok: false, error: "MISSION_TASK_NOT_FOUND" };
  const at = now();
  if (action === "start") {
    if (task.state !== "READY") return { ok: false, error: "TASK_NOT_READY", state: task.state };
    if (!depsCompleted(mission, task)) return { ok: false, error: "TASK_DEPENDENCIES_INCOMPLETE" };
    if (task.attempt >= task.max_attempts) return { ok: false, error: "TASK_ATTEMPT_LIMIT_REACHED" };
    task.state = "RUNNING"; task.attempt += 1; task.started_at = at; task.last_error = null; task.inputs = { ...(payload.inputs || {}) }; task.external_job_id = clean(payload.external_job_id, 200) || null; task.recovery_key = missionRecoveryKey(mission, task);
  } else if (action === "complete") {
    if (task.state !== "RUNNING") return { ok: false, error: "TASK_NOT_RUNNING", state: task.state };
    task.state = "COMPLETED"; task.outputs = { ...(payload.outputs || {}) }; task.completed_at = at; task.last_error = null;
  } else if (action === "fail") {
    if (task.state !== "RUNNING") return { ok: false, error: "TASK_NOT_RUNNING", state: task.state };
    task.state = task.attempt < task.max_attempts && payload.retryable === true ? "READY" : "FAILED";
    task.last_error = { code: clean(payload.code, 120) || "TASK_FAILED", message: clean(payload.message, 500) || null, retryable: payload.retryable === true };
  } else if (action === "cancel") {
    if (TERMINAL.has(task.state)) return { ok: false, error: "TASK_ALREADY_TERMINAL" };
    task.state = "CANCELLED";
  } else return { ok: false, error: "UNKNOWN_MISSION_ACTION" };
  refreshReadyStates(mission); refreshMissionStatus(mission); mission.revision = Number(mission.revision || 0) + 1; mission.updated_at = at;
  mission.events = [...(mission.events || []), { type: `TASK_${action.toUpperCase()}`, at, task_id: taskId, state: task.state, revision: mission.revision }].slice(-200);
  mission.safeguards = { ...(mission.safeguards || {}), automatic_multi_factory_execution: false, production_deploy: false, manual_production_approval_required: true, stale_revision_execution_blocked: true, optimistic_concurrency_control: true, bounded_execution_leases: true };
  return { ok: true, mission, previous_revision: revisionCheck.actual_revision };
}

function projectKnowledgeSnapshotForMission(mission = {}) {
  const context = mission.project_context || null;
  const binding = mission.project_context_binding || null;
  if (!context && !binding) return { ok: true, required: false, snapshot: null, ref: null };
  if (!context || context.schema !== 'aurentara.project-mission-context.v1') return { ok: false, error: 'PROJECT_MISSION_CONTEXT_REQUIRED' };
  if (!binding || binding.schema !== 'aurentara.project-knowledge-snapshot-ref.v1') return { ok: false, error: 'PROJECT_KNOWLEDGE_SNAPSHOT_REF_REQUIRED' };
  const project = context.project || {};
  const revision = Number(context.knowledge_revision);
  if (!project.scope_key || !project.customer_id || !project.project_id || !Number.isInteger(revision) || revision < 1) return { ok: false, error: 'PROJECT_KNOWLEDGE_SNAPSHOT_INVALID' };
  if (mission.scope_key && mission.scope_key !== project.scope_key) return { ok: false, error: 'PROJECT_KNOWLEDGE_SCOPE_MISMATCH' };
  if (mission.customer_id && mission.customer_id !== project.customer_id) return { ok: false, error: 'PROJECT_KNOWLEDGE_CUSTOMER_MISMATCH' };
  if (mission.project_id && mission.project_id !== project.project_id) return { ok: false, error: 'PROJECT_KNOWLEDGE_PROJECT_MISMATCH' };
  if (mission.project && mission.project !== project.project_id) return { ok: false, error: 'PROJECT_KNOWLEDGE_PROJECT_MISMATCH' };
  if (binding.scope_key !== project.scope_key || Number(binding.knowledge_revision) !== revision) return { ok: false, error: 'PROJECT_KNOWLEDGE_BINDING_STALE' };
  if ([context.content_pack_ref?.knowledge_revision, context.visual_pack_ref?.knowledge_revision, context.readiness_ref?.knowledge_revision].some((value) => Number(value) !== revision)) return { ok: false, error: 'PROJECT_KNOWLEDGE_PACK_STALE' };
  if (binding.content_pack_ref?.pack_id !== context.content_pack_ref?.pack_id || Number(binding.content_pack_ref?.version) !== Number(context.content_pack_ref?.version)) return { ok: false, error: 'PROJECT_CONTENT_PACK_BINDING_STALE' };
  if (binding.visual_pack_ref?.pack_id !== context.visual_pack_ref?.pack_id || Number(binding.visual_pack_ref?.version) !== Number(context.visual_pack_ref?.version)) return { ok: false, error: 'PROJECT_VISUAL_PACK_BINDING_STALE' };
  if (binding.readiness_ref?.readiness_id !== context.readiness_ref?.readiness_id || Number(binding.readiness_ref?.knowledge_revision) !== revision) return { ok: false, error: 'PROJECT_READINESS_BINDING_STALE' };
  if (context.readiness_ref?.status === 'BLOCKED') return { ok: false, error: 'PROJECT_CONTENT_READINESS_BLOCKED' };
  if ((context.open_critical_conflicts || []).length) return { ok: false, error: 'PROJECT_CRITICAL_CONFLICT_UNRESOLVED' };
  const publishableRights = new Set(['OWNED_CONFIRMED','CUSTOMER_LICENSED','CUSTOMER_ASSERTED']);
  const invalidAsset = (context.approved_assets || context.assets || []).find((asset) => asset.publishable !== true || !publishableRights.has(asset.rights_status));
  if (invalidAsset) return { ok: false, error: 'PROJECT_APPROVED_ASSET_RIGHTS_INVALID', asset_id: invalidAsset.asset_id || null };
  return {
    ok: true,
    required: true,
    ref: cloneMission(binding),
    snapshot: {
      schema: 'aurentara.project-knowledge-task-snapshot.v1',
      project_scope_key: project.scope_key,
      customer_id: project.customer_id,
      project_id: project.project_id,
      knowledge_revision: revision,
      content_pack_ref: cloneMission(context.content_pack_ref),
      visual_pack_ref: cloneMission(context.visual_pack_ref),
      readiness_ref: cloneMission(context.readiness_ref),
      fact_version_refs: cloneMission(context.fact_version_refs || []),
      source_refs: cloneMission(context.source_refs || []),
      rights_constraints: cloneMission(context.rights_constraints || {}),
      human_decision_refs: cloneMission(context.human_decision_refs || []),
      approved_assets: cloneMission(context.approved_assets || context.assets || []),
      open_critical_conflicts: cloneMission(context.open_critical_conflicts || []),
      website_sources: cloneMission(context.website_sources || []),
      quality_contract: cloneMission(context.quality_contract || {}),
      deployment_policy: cloneMission(context.deployment_policy || { staging_only: true, production_deploy: false })
    }
  };
}

const EXECUTION_FACTORIES = new Set(['web','automation','ai','business']);

function canonicalExecutionBindingForTask(mission = {}, task = {}) {
  const binding = task.execution_contract_binding && typeof task.execution_contract_binding === 'object' ? task.execution_contract_binding : {};
  const factory = EXECUTION_FACTORIES.has(task.domain) ? task.domain : (EXECUTION_FACTORIES.has(task.engine) ? task.engine : null);
  if (!factory) return { ok: false, error: 'CANONICAL_EXECUTION_FACTORY_UNSUPPORTED', factory: task.domain || task.engine || null };
  const scopeKey = mission.scope_key || mission.project_context?.project?.scope_key || null;
  if (binding.mission_id && binding.mission_id !== mission.mission_id) return { ok: false, error: 'EXECUTION_BINDING_MISSION_MISMATCH' };
  if (binding.task_id && binding.task_id !== task.task_id) return { ok: false, error: 'EXECUTION_BINDING_TASK_MISMATCH' };
  if (binding.factory && binding.factory !== factory) return { ok: false, error: 'EXECUTION_BINDING_FACTORY_MISMATCH' };
  if (binding.capability && binding.capability !== task.capability) return { ok: false, error: 'EXECUTION_BINDING_CAPABILITY_MISMATCH' };
  if (binding.project_scope_key && scopeKey && binding.project_scope_key !== scopeKey) return { ok: false, error: 'EXECUTION_BINDING_SCOPE_MISMATCH' };
  if (binding.environment && binding.environment !== 'staging') return { ok: false, error: 'EXECUTION_ENVIRONMENT_NOT_ALLOWED' };
  if (binding.write_policy && binding.write_policy !== 'NO_EXTERNAL_WRITES') return { ok: false, error: 'EXECUTION_WRITE_POLICY_NOT_ALLOWED' };
  if (binding.production_policy && binding.production_policy !== 'PRODUCTION_DISABLED') return { ok: false, error: 'EXECUTION_PRODUCTION_POLICY_NOT_ALLOWED' };
  const executionAttempt = task.state === 'READY' ? Number(task.attempt || 0) + 1 : Math.max(1, Number(task.attempt || 0));
  const executionId = clean(binding.execution_id, 200) || `execution-${digest({ mission_id: mission.mission_id, task_id: task.task_id, attempt: executionAttempt }).slice(0, 24)}`;
  return {
    ok: true,
    binding: {
      provider_execution_version: 'riosystems.provider-execution.v1',
      execution_id: executionId,
      factory,
      provider_route: cloneMission(binding.provider_route || null),
      executor_id: clean(binding.executor_id, 160) || null,
      budget_reservation_ref: cloneMission(binding.budget_reservation_ref || null),
      approval_ref: cloneMission(binding.approval_ref || null),
      environment: 'staging',
      write_policy: 'NO_EXTERNAL_WRITES',
      production_policy: 'PRODUCTION_DISABLED',
      evidence_policy: cloneMission(binding.evidence_policy || {
        actual_provider_from_executor_required: true,
        executor_identity_required: true,
        provider_execution_truth_validation_required: true
      })
    }
  };
}

export function buildTaskExecutionContract(mission, taskId) {
  const task = findTask(mission || {}, taskId);
  if (!task) return { ok: false, error: "MISSION_TASK_NOT_FOUND" };
  const knowledge = projectKnowledgeSnapshotForMission(mission || {});
  if (!knowledge.ok) return { ...knowledge, task_id: taskId, production_deploy: false };
  const execution = canonicalExecutionBindingForTask(mission || {}, task);
  if (!execution.ok) return { ...execution, task_id: taskId, production_deploy: false };
  const dependencyOutputs = {};
  for (const dependencyId of task.depends_on || []) dependencyOutputs[dependencyId] = findTask(mission, dependencyId)?.outputs || {};
  return {
    ok: true,
    contract_version: 3,
    mission_id: mission.mission_id,
    state_revision: Number(mission.revision || 0),
    mission_revision: mission.mission_revision || mission.source_of_truth?.mission_revision || null,
    expected_parent_sha: mission.source_of_truth?.expected_parent_sha || null,
    source_of_truth: cloneMission(mission.source_of_truth || null),
    task_id: task.task_id,
    capability: task.capability,
    domain: task.domain,
    engine: task.engine,
    goal: task.goal,
    state: task.state,
    attempt: task.attempt,
    recovery_key: task.recovery_key || missionRecoveryKey(mission, task),
    max_attempts: task.max_attempts,
    project: mission.project || null,
    customer_id: knowledge.snapshot?.customer_id || mission.customer_id || null,
    project_id: knowledge.snapshot?.project_id || mission.project_id || mission.project || null,
    project_scope_key: knowledge.snapshot?.project_scope_key || mission.scope_key || null,
    knowledge_snapshot_ref: cloneMission(knowledge.ref),
    project_knowledge: cloneMission(knowledge.snapshot),
    knowledge_revision: knowledge.snapshot?.knowledge_revision || null,
    content_pack_ref: cloneMission(knowledge.snapshot?.content_pack_ref || null),
    visual_pack_ref: cloneMission(knowledge.snapshot?.visual_pack_ref || null),
    readiness_ref: cloneMission(knowledge.snapshot?.readiness_ref || null),
    fact_version_refs: cloneMission(knowledge.snapshot?.fact_version_refs || []),
    source_refs: cloneMission(knowledge.snapshot?.source_refs || []),
    rights_constraints: cloneMission(knowledge.snapshot?.rights_constraints || {}),
    human_decision_refs: cloneMission(knowledge.snapshot?.human_decision_refs || []),
    approved_assets: cloneMission(knowledge.snapshot?.approved_assets || []),
    open_critical_conflicts: cloneMission(knowledge.snapshot?.open_critical_conflicts || []),
    provider_route: cloneMission(execution.binding.provider_route),
    executor_id: execution.binding.executor_id,
    budget_reservation_ref: cloneMission(execution.binding.budget_reservation_ref),
    approval_ref: cloneMission(execution.binding.approval_ref),
    environment: execution.binding.environment,
    write_policy: execution.binding.write_policy,
    production_policy: execution.binding.production_policy,
    evidence_policy: cloneMission(execution.binding.evidence_policy),
    prompt: mission.prompt,
    dependency_outputs: dependencyOutputs,
    required_result: { status: ["COMPLETED", "FAILED"], outputs_object_required_on_success: true, error_object_required_on_failure: true },
    safeguards: { production_deploy: false, manual_production_approval_required: true, cross_factory_side_effects_require_explicit_contract: true, stale_revision_execution_blocked: true, project_knowledge_fail_closed: knowledge.required === true, canonical_execution_contract: true, production_deploy: false, external_writes: false, optimistic_concurrency_control: true }
  };
}

export function resumeMission(missionInput, options = {}) {
  const revisionCheck = assertExpectedRevision(missionInput || {}, options.expected_revision);
  if (!revisionCheck.ok) return { ok: false, error: revisionCheck.code, ...revisionCheck };
  if (missionInput?.source_of_truth?.bound && !options.observed_project_head) {
    return { ok: false, error: 'CURRENT_PROJECT_HEAD_REQUIRED', retryable: true, source_of_truth: cloneMission(missionInput.source_of_truth) };
  }
  if (missionInput?.source_of_truth?.bound) {
    const sourceCheck = validateSourceOfTruth(missionInput.source_of_truth, { project_head: options.observed_project_head });
    if (!sourceCheck.ok) return { ok: false, error: sourceCheck.code || "STALE_PROJECT_HEAD", source_of_truth: sourceCheck };
  }
  const mission = cloneMission(missionInput || {});
  if (!Array.isArray(mission.tasks)) return { ok: false, error: "INVALID_MISSION" };
  const activeLease = mission.execution_lease && Number(mission.execution_lease.expires_at_ms || 0) > Date.now();
  if (activeLease && options.lease_id !== mission.execution_lease.lease_id) return { ok: false, error: "MISSION_LEASE_HELD", retryable: true, lease: cloneMission(mission.execution_lease) };
  for (const task of mission.tasks) if (task.state === "RUNNING") { task.state = task.attempt < task.max_attempts ? "READY" : "FAILED"; task.last_error = { code: "INTERRUPTED_EXECUTION", message: "Recovered from interrupted orchestration state", retryable: task.attempt < task.max_attempts }; task.recovery_key = missionRecoveryKey(mission, task); }
  refreshReadyStates(mission); refreshMissionStatus(mission); const at = now(); mission.revision = Number(mission.revision || 0) + 1; mission.updated_at = at; mission.events = [...(mission.events || []), { type: "MISSION_RESUMED", at, mission_revision: mission.mission_revision || null, revision: mission.revision }].slice(-200); mission.safeguards = { ...(mission.safeguards || {}), stale_revision_execution_blocked: true, production_deploy: false, automatic_multi_factory_execution: false, optimistic_concurrency_control: true, bounded_execution_leases: true }; return { ok: true, mission, previous_revision: revisionCheck.actual_revision };
}
