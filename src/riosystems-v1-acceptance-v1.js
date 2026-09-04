import { sealHumanFacingAcceptance } from './human-outcome-acceptance-v1.js';

const clone = (value) => structuredClone(value ?? null);

const DOD = Object.freeze([
  ['dashboard_browser_local', 'Dashboard can be opened locally in a browser'],
  ['private_operator_access_server_side', 'Private single-operator access is enforced server-side'],
  ['all_in_one_navigation', 'One consistent all-in-one navigation exists'],
  ['projects_missions_visible', 'Existing projects and missions are visible'],
  ['mission_input', 'A new mission can be entered'],
  ['mission_compilation_plan_review', 'Mission compilation and Plan Review work visibly'],
  ['capability_factory_provider_projection', 'Capabilities, factories and providers are traceable'],
  ['provider_reasoning_evidence', 'Provider reasons and evidence are visible'],
  ['costs_budgets', 'Costs and budgets are represented correctly'],
  ['approval_requests_controlled', 'Approval requests are controlled server-side'],
  ['synthetic_staging_mission', 'A synthetic staging mission can be demonstrated'],
  ['timeline_status', 'Mission timeline and status are updated'],
  ['quality_results', 'Quality results are visible'],
  ['unified_delivery', 'Unified Delivery is the authoritative result source'],
  ['factory_provider_health', 'Factory and provider health are evidence-backed'],
  ['audit_timeline', 'Searchable project-scoped audit timeline exists'],
  ['project_isolation', 'Project and customer isolation is enforced'],
  ['production_lockout', 'Production actions are technically locked'],
  ['responsive_accessibility', 'Responsive and accessibility foundations exist'],
  ['ci_green_exact_head', 'Central and specialized CI are green on exact canonical head'],
  ['reality_labels', 'Planned, simulated, staging and production reality are distinguished'],
  ['no_core_duplication', 'Existing core planning/routing/governance logic is not duplicated'],
  ['single_dashboard_system', 'No competing dashboard control system was introduced']
]);

const ACTIVATION = Object.freeze([
  ['durable_runtime_schema_applied', 'Durable Operator Runtime schema exists in staging storage'],
  ['durable_runtime_secrets_configured', 'Server-only durable runtime credentials are configured'],
  ['access_application_configured', 'Private Cloudflare Access application/policy is configured'],
  ['latest_factory_control_deployed_to_staging', 'Latest accepted factory-control is deployed to staging'],
  ['authenticated_staging_smoke_passed', 'Authenticated staging vertical-slice smoke passed']
]);

function state(value) {
  if (value === true) return 'VERIFIED';
  if (value === false) return 'BLOCKED';
  return 'NOT_VERIFIED';
}

function evaluate(items, evidence = {}) {
  return items.map(([id, label]) => ({ id, label, status: state(evidence[id]), evidence: clone(evidence[`${id}_evidence`] || null) }));
}

function summarize(items) {
  const counts = { VERIFIED: 0, BLOCKED: 0, NOT_VERIFIED: 0 };
  for (const item of items) counts[item.status] = (counts[item.status] || 0) + 1;
  return { total: items.length, ...counts, complete: counts.VERIFIED === items.length };
}

function safetyStatus(safety = {}) {
  const checks = [
    ['production_active', false],
    ['real_customer_data_active', false],
    ['automatic_paid_overflow', false],
    ['unapproved_external_writes', false]
  ].map(([id, expected]) => ({ id, expected, actual: safety[id] ?? null, ok: safety[id] === expected }));
  return { ok: checks.every((item) => item.ok), checks };
}

function nextActions(dod, activation, safety) {
  if (!safety.ok) return [{ type: 'SAFETY_BLOCKER', action: 'Restore hard safety invariants before any staging activation.' }];
  const missingDod = dod.filter((item) => item.status !== 'VERIFIED');
  if (missingDod.length) return missingDod.map((item) => ({ type: 'V1_DOD', id: item.id, action: item.label }));
  return activation.filter((item) => item.status !== 'VERIFIED').map((item) => ({ type: 'STAGING_ACTIVATION', id: item.id, action: item.label }));
}

export function buildRiosystemsV1Acceptance({ definition_of_done = {}, staging_activation = {}, safety = {}, human_outcome = {} } = {}) {
  const dod = evaluate(DOD, definition_of_done);
  const activation = evaluate(ACTIVATION, staging_activation);
  const dodSummary = summarize(dod);
  const activationSummary = summarize(activation);
  const hardSafety = safetyStatus(safety);

  const humanSeal = sealHumanFacingAcceptance({
    human_facing: true,
    technical_accepted: dodSummary.complete && activationSummary.complete,
    safety_accepted: hardSafety.ok,
    human_outcome
  });

  let status = 'INCOMPLETE';
  if (!hardSafety.ok) status = 'BLOCKED';
  else if (dodSummary.complete && activationSummary.complete && humanSeal.ok) status = 'V1_ACCEPTED';
  else if (dodSummary.complete && activationSummary.complete && humanSeal.verdict === 'TECHNICALLY_ACCEPTED_HUMAN_ACCEPTANCE_PENDING') status = 'TECHNICALLY_ACCEPTED_HUMAN_ACCEPTANCE_PENDING';
  else if (dodSummary.complete && activationSummary.complete && humanSeal.verdict === 'HUMAN_OUTCOME_FAILED') status = 'HUMAN_OUTCOME_FAILED';
  else if (dodSummary.complete) status = 'CODE_ACCEPTED_EXTERNAL_ACTIVATION_REQUIRED';

  return {
    schema: 'riosystems.v1-acceptance.v1',
    status,
    definition_of_done: { summary: dodSummary, items: dod },
    staging_activation: { summary: activationSummary, items: activation },
    safety: hardSafety,
    human_outcome: humanSeal.human_outcome,
    human_outcome_required: true,
    next_actions: status === 'TECHNICALLY_ACCEPTED_HUMAN_ACCEPTANCE_PENDING'
      ? [{ type: 'HUMAN_OUTCOME_ACCEPTANCE', action: 'Run final composed browser human-outcome acceptance before full acceptance.' }]
      : nextActions(dod, activation, hardSafety),
    rules: {
      no_inferred_success: true,
      unknown_is_not_verified: true,
      exact_head_ci_required: true,
      private_access_required: true,
      authenticated_staging_smoke_required_for_operational_acceptance: true,
      production_must_remain_locked_for_v1_acceptance: true,
      full_acceptance_requires_human_outcome: true,
      final_composed_browser_is_authoritative: true
    },
    production_deploy: false
  };
}

export function riosystemsV1AcceptanceManifest() {
  return {
    schema: 'riosystems.v1-acceptance.v1',
    definition_of_done_ids: DOD.map(([id]) => id),
    staging_activation_ids: ACTIVATION.map(([id]) => id),
    statuses: ['INCOMPLETE', 'CODE_ACCEPTED_EXTERNAL_ACTIVATION_REQUIRED', 'TECHNICALLY_ACCEPTED_HUMAN_ACCEPTANCE_PENDING', 'HUMAN_OUTCOME_FAILED', 'V1_ACCEPTED', 'BLOCKED'],
    production_deploy: false
  };
}
