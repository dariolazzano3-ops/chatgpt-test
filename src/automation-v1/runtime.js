import { buildWorkflowPlan } from './planner.js';
import { routeWorkflowPlan, validateFallback } from './router.js';
import { approvalDecision } from './approval.js';
import { buildIdempotencyKey, InMemoryIdempotencyStore } from './idempotency.js';
import { boundedRetryPolicy, recoveryDecision } from './recovery.js';
import { createRunRecord, recordStep, finalizeRunRecord, redactSecrets } from './observability.js';
import { compileProviderPlans } from './adapters.js';
import { buildDeliveryManifest } from './delivery.js';

const clone = (value) => structuredClone(value ?? null);
let runCounter = 0;

function nextRunId(projectId) {
  runCounter += 1;
  return `autov1-${projectId}-${Date.now()}-${runCounter}`;
}

function simulatedFailure(options, nodeId, attempt) {
  const list = options?.simulation?.failures?.[nodeId];
  if (!Array.isArray(list)) return null;
  return list[attempt - 1] || null;
}

function syntheticResult(node, input, idempotencyKey) {
  const value = clone(input ?? {});
  if (node.type === 'condition') {
    const field = node.config?.field;
    const equals = node.config?.equals;
    const matched = field ? value?.[field] === equals : node.config?.matched !== false;
    return { output: value, condition_matched: matched };
  }
  if (node.type === 'transform') {
    if (Array.isArray(value)) return { output: value.map((item) => clone(item)) };
    if (value && typeof value === 'object') {
      const output = { ...value };
      if (typeof output.email === 'string') output.email = output.email.trim().toLowerCase();
      output._synthetic_normalized = true;
      return { output };
    }
    return { output: value };
  }
  if (node.type === 'database_read') return { output: { records: Array.isArray(value?.records) ? clone(value.records) : [], synthetic_read: true } };
  if (node.type === 'database_write') return { output: { ...value, staging_record_id: `synthetic-${idempotencyKey.split(':').pop()}`, persisted: false, persistence_plan: 'supabase-staging-compatible' } };
  if (node.type === 'analytics') return { output: value, analytics_event: { event: node.config?.event || 'automation_step_completed', properties: { synthetic: true, workflow_step: node.id }, sent: false, posthog_compatible: true } };
  if (node.type === 'email') return { output: value, email_plan: { sent: false, synthetic: true, mass_email: false, recipient_count: 1 } };
  if (node.type === 'crm_event') return { output: value, crm_event_plan: { emitted: false, synthetic: true, idempotency_key: idempotencyKey } };
  if (node.type === 'ai_call') return { output: { ...value, ai_simulation: { executed: false, paid_call: false, result: 'synthetic-ai-output' } } };
  if (node.type === 'file_processing') return { output: { ...value, file_processing: { simulated: true, files_processed: Number(value?.files?.length || 0) } } };
  if (node.type === 'webhook' || node.type === 'http') return { output: value, request_plan: { executed: false, synthetic: true, method: node.config?.method || (node.type === 'webhook' ? 'POST' : 'GET') } };
  if (node.type === 'schedule') return { output: value, schedule_tick: { synthetic: true } };
  return { output: value };
}

async function executeNodeSynthetic({ node, plan, input, store, options }) {
  const approval = approvalDecision(node, plan.mission, {
    execute_external: false,
    production: false,
    real_customer_data: false,
    mass_email: false,
    payments: false,
    variable_cost_eur: 0
  });
  if (!approval.ok) return { status: 'BLOCKED', approval, retry_count: 0, error: { code: approval.errors[0] || 'APPROVAL_BLOCKED' } };

  const idempotencyKey = node.idempotency_required ? buildIdempotencyKey({
    project_id: plan.project_id,
    workflow_id: plan.workflow_id,
    node_id: node.id,
    payload: input
  }) : null;

  if (idempotencyKey) {
    const claim = store.claim(idempotencyKey, { node_id: node.id, workflow_id: plan.workflow_id });
    if (!claim.claimed && claim.duplicate) {
      return {
        status: 'DUPLICATE_SKIPPED',
        approval,
        retry_count: 0,
        idempotency_key: idempotencyKey,
        output: clone(claim.existing?.result?.output ?? input),
        side_effect: { type: node.type, simulated: true, duplicate_prevented: true }
      };
    }
  }

  const policy = boundedRetryPolicy(node);
  let attempt = 0;
  let repairAttempted = false;
  let fallbackUsed = null;
  while (attempt <= policy.retry_limit + 1) {
    attempt += 1;
    const failure = simulatedFailure(options, node.id, attempt);
    if (!failure) {
      const result = syntheticResult(node, input, idempotencyKey || `no-idempotency-${node.id}`);
      if (idempotencyKey) store.complete(idempotencyKey, result);
      return {
        status: 'COMPLETED',
        approval,
        retry_count: Math.max(0, attempt - 1),
        idempotency_key: idempotencyKey,
        output: clone(result.output),
        artifacts: redactSecrets(Object.fromEntries(Object.entries(result).filter(([key]) => key !== 'output'))),
        provider_id: fallbackUsed || node.provider_id,
        side_effect: node.side_effect_class === 'READ_ONLY' ? null : { type: node.type, simulated: true, external_performed: false, idempotency_key: idempotencyKey }
      };
    }

    const fallbackCandidate = node.fallback_candidates?.[0] || null;
    const fallbackValidation = fallbackCandidate ? validateFallback({
      from_provider: node.provider_id,
      to_provider: fallbackCandidate,
      action_type: node.type,
      variable_cost_eur: 0,
      approval: options?.fallback_approved === true,
      side_effect_semantics_match: options?.fallback_semantics_match === true
    }) : { ok: false };

    const decision = recoveryDecision({
      error: failure,
      attempt,
      retry_limit: policy.retry_limit,
      repair_attempted: repairAttempted,
      fallback_available: Boolean(fallbackCandidate),
      fallback_allowed: fallbackValidation.ok
    });

    if (decision.action === 'RETRY') continue;
    if (decision.action === 'REPAIR') {
      repairAttempted = true;
      continue;
    }
    if (decision.action === 'FALLBACK') {
      fallbackUsed = fallbackCandidate;
      continue;
    }
    if (idempotencyKey) store.release(idempotencyKey);
    return {
      status: 'FAILED',
      approval,
      retry_count: Math.max(0, attempt - 1),
      idempotency_key: idempotencyKey,
      provider_id: fallbackUsed || node.provider_id,
      error: redactSecrets(failure),
      recovery: decision
    };
  }

  if (idempotencyKey) store.release(idempotencyKey);
  return { status: 'FAILED', approval, retry_count: policy.retry_limit, idempotency_key: idempotencyKey, error: { code: 'RETRY_BOUND_EXHAUSTED' } };
}

export async function runAutomationMission(missionInput = {}, options = {}) {
  const started = Date.now();
  const plan = buildWorkflowPlan(missionInput);
  if (!plan.ok) return { ok: false, stage: plan.stage || 'PLAN', errors: plan.errors || [plan.error], production: false };
  const routed = routeWorkflowPlan(plan);
  if (!routed.ok) return { ok: false, stage: 'ROUTE', errors: routed.errors, production: false };
  const providerPlans = compileProviderPlans(routed);
  if (!providerPlans.ok) return { ok: false, stage: 'PROVIDER_PLAN', errors: [providerPlans.error], production: false };

  if (options.execute_external === true) {
    return { ok: false, stage: 'SAFE_EXECUTION', errors: ['V1_EXTERNAL_PROVIDER_EXECUTION_DISABLED'], production: false, paid_execution: false, variable_cost_eur: 0 };
  }

  const store = options.idempotency_store || new InMemoryIdempotencyStore();
  const run = createRunRecord({ run_id: options.run_id || nextRunId(routed.project_id), project_id: routed.project_id, workflow_id: routed.workflow_id });
  let current = clone(missionInput.inputs || {});
  let failed = false;

  for (const node of routed.nodes) {
    if (failed) {
      recordStep(run, { step_id: node.id, type: node.type, provider_id: node.provider_id, status: 'SKIPPED', reason: 'PREVIOUS_STEP_FAILED' });
      continue;
    }
    const result = await executeNodeSynthetic({ node, plan: routed, input: current, store, options });
    const stepRecord = {
      step_id: node.id,
      type: node.type,
      provider_id: result.provider_id || node.provider_id,
      status: result.status,
      approval_class: result.approval?.approval_class || null,
      retry_count: result.retry_count || 0,
      idempotency_key: result.idempotency_key || null,
      error: result.error || null,
      artifacts: result.artifacts || null,
      side_effect: result.side_effect || null
    };
    recordStep(run, stepRecord);
    if (result.status === 'FAILED' || result.status === 'BLOCKED') failed = true;
    else if (result.output !== undefined) current = clone(result.output);
  }

  const finalRun = finalizeRunRecord(run, { status: failed ? 'FAILED' : 'COMPLETED', duration_ms: Date.now() - started });
  const delivery = buildDeliveryManifest({ plan: routed, providerPlans, run: finalRun });
  return {
    ok: !failed && delivery.qa.passed,
    schema: 'riosystems.automation-factory-v1-result',
    plan: routed,
    provider_plans: providerPlans,
    run: finalRun,
    outputs: { result: current },
    delivery_manifest: delivery,
    idempotency: { entries: typeof store.snapshot === 'function' ? store.snapshot() : [] },
    variable_cost_eur: 0,
    production: false,
    real_customer_data: false
  };
}
