import { buildRiosystemsV1Acceptance } from './riosystems-v1-acceptance-v1.js';
import { operatorRuntimeManifest } from './operator-runtime-v1.js';
import { operatorDashboardManifest } from './operator-dashboard-v1.js';
import { operatorDashboardCompletenessManifest } from './operator-dashboard-completeness-v1.js';
import { operatorProjectCreateDashboardManifest } from './operator-project-create-dashboard-v1.js';
import { operatorSystemHealthManifest } from './operator-system-health-v1.js';
import { renderOperatorDashboardShell } from './operator-dashboard-shell-v1.js';
import { OPERATOR_STATUS_MAP } from './operator-dashboard-http-v1.js';

const clone = (value) => structuredClone(value ?? null);
const healthy = (signal) => signal?.status === 'HEALTHY';

function evidence(value, source, detail = {}) {
  return { value: value === true ? true : value === false ? false : undefined, evidence: { source, ...clone(detail) } };
}

function setFact(target, id, fact) {
  target[id] = fact.value;
  target[`${id}_evidence`] = fact.evidence;
}

function exactHeadCi(systemHealth = {}) {
  const signals = systemHealth.signals || {};
  const required = ['core_ci', 'integrated_regression_gate', 'dashboard_ci', 'universal_mission_ci'];
  const head = systemHealth.branch_truth?.head_sha || null;
  const allHealthy = healthy(systemHealth.branch_truth) && required.every((id) => healthy(signals[id]));
  const allSameHead = Boolean(head) && required.every((id) => signals[id]?.head_sha === head);
  return {
    ok: allHealthy && allSameHead,
    head_sha: head,
    required: Object.fromEntries(required.map((id) => [id, clone(signals[id] || null)]))
  };
}

function buildCodeEvidence({ system_health = {}, request_context = {} } = {}) {
  const runtime = operatorRuntimeManifest();
  const dashboard = operatorDashboardManifest();
  const completeness = operatorDashboardCompletenessManifest();
  const projectCreate = operatorProjectCreateDashboardManifest();
  const healthManifest = operatorSystemHealthManifest();
  const shell = renderOperatorDashboardShell({});
  const ci = exactHeadCi(system_health);
  const dashboardCi = healthy(system_health.signals?.dashboard_ci) && system_health.signals?.dashboard_ci?.head_sha === ci.head_sha;
  const umrCi = healthy(system_health.signals?.universal_mission_ci) && system_health.signals?.universal_mission_ci?.head_sha === ci.head_sha;
  const integratedCi = healthy(system_health.signals?.integrated_regression_gate) && system_health.signals?.integrated_regression_gate?.head_sha === ci.head_sha;
  const facts = {};

  setFact(facts, 'dashboard_browser_local', evidence(ci.ok && shell.includes('<!doctype html>') && shell.includes('name="viewport"'), 'operator-dashboard-shell-v1 + exact-head CI', { head_sha: ci.head_sha }));
  setFact(facts, 'private_operator_access_server_side', evidence(dashboardCi && request_context.server_side_operator_authorized === true, 'current server-authorized operator request + dashboard CI', { head_sha: ci.head_sha }));
  setFact(facts, 'all_in_one_navigation', evidence(dashboardCi && ['Projects','Mission Studio','Approvals','Factories','Providers','Costs','Deliveries','System Health','Audit Log','Settings'].every((label) => shell.includes(label)), 'operator-dashboard-shell-v1 + dashboard CI', { head_sha: ci.head_sha }));
  setFact(facts, 'projects_missions_visible', evidence(dashboardCi && shell.includes("api('/projects')") && shell.includes("api('/missions')"), 'operator dashboard API surface + dashboard CI', { head_sha: ci.head_sha }));
  setFact(facts, 'mission_input', evidence(dashboardCi && shell.includes('Mission Studio') && completeness.durable_mission_plan_store === true, 'mission studio + durable plan store + dashboard CI', { head_sha: ci.head_sha }));
  setFact(facts, 'mission_compilation_plan_review', evidence(umrCi && completeness.durable_mission_plan_store === true && completeness.typed_plan_confirmation === 'CONFIRM_SYNTHETIC_STAGING', 'universal mission acceptance + plan review/approval contract', { head_sha: ci.head_sha }));
  setFact(facts, 'capability_factory_provider_projection', evidence(integratedCi && dashboard.sections?.includes('factory_cards') === true, 'operator dashboard/control-plane projection + integrated regression', { head_sha: ci.head_sha }));
  setFact(facts, 'provider_reasoning_evidence', evidence(integratedCi && dashboard.direct_provider_calls === false, 'provider projection/regression evidence', { head_sha: ci.head_sha }));
  setFact(facts, 'costs_budgets', evidence(integratedCi && projectCreate.variable_cost_ceiling_eur === 0 && completeness.automatic_paid_overflow === false, 'operator cost/budget contracts + integrated regression', { head_sha: ci.head_sha }));
  setFact(facts, 'approval_requests_controlled', evidence(dashboardCi && completeness.typed_plan_confirmation === 'CONFIRM_SYNTHETIC_STAGING' && completeness.live_staging_requires_server_executor === true, 'server-side approval contract + dashboard CI', { head_sha: ci.head_sha }));
  setFact(facts, 'synthetic_staging_mission', evidence(umrCi && runtime.external_writes === false && projectCreate.synthetic_only === true, 'universal mission acceptance + synthetic runtime safety', { head_sha: ci.head_sha }));
  setFact(facts, 'timeline_status', evidence(integratedCi && dashboard.sections?.includes('execution_summary') === true, 'project timeline/status projections + integrated regression', { head_sha: ci.head_sha }));
  setFact(facts, 'quality_results', evidence(umrCi && dashboard.sections?.includes('delivery_feed') === true, 'UMR quality gate + delivery projection', { head_sha: ci.head_sha }));
  setFact(facts, 'unified_delivery', evidence(umrCi && dashboard.sections?.includes('delivery_feed') === true, 'universal mission delivery + authoritative dashboard feed', { head_sha: ci.head_sha }));
  setFact(facts, 'factory_provider_health', evidence(dashboardCi && Array.isArray(healthManifest.authoritative_sources) && healthManifest.authoritative_sources.includes('provider_evidence'), 'authoritative system-health contract + dashboard CI', { head_sha: ci.head_sha }));
  setFact(facts, 'audit_timeline', evidence(integratedCi && shell.includes('Audit Log'), 'operator audit projection + integrated regression', { head_sha: ci.head_sha }));
  setFact(facts, 'project_isolation', evidence(integratedCi && runtime.state_revision_guard === 'compare_and_swap_required_for_mutations' && runtime.mode === 'single_operator_stateful_control_runtime', 'runtime project scope/CAS + integrated regression', { head_sha: ci.head_sha }));
  setFact(facts, 'production_lockout', evidence(ci.ok && runtime.production_deploy === false && dashboard.production_deploy === false && completeness.production_deploy === false && projectCreate.production_deploy === false, 'cross-layer production lockout + exact-head CI', { head_sha: ci.head_sha }));
  setFact(facts, 'responsive_accessibility', evidence(dashboardCi && shell.includes('@media(max-width:760px)') && shell.includes(':focus-visible') && shell.includes('aria-live="polite"') && shell.includes('aria-label="Hauptnavigation"'), 'dashboard responsive/accessibility foundations + dashboard CI', { head_sha: ci.head_sha }));
  setFact(facts, 'ci_green_exact_head', evidence(ci.ok, 'github_actions_exact_factory_control_head', { head_sha: ci.head_sha, gates: ci.required }));
  setFact(facts, 'reality_labels', evidence(integratedCi && shell.includes('Reality:') && ['PLANNED','SYNTHETIC','LIVE_STAGING_VERIFIED','PRODUCTION_ACTIVE'].every((key) => Object.hasOwn(OPERATOR_STATUS_MAP, key)), 'operator reality UI + authoritative status taxonomy + integrated regression', { head_sha: ci.head_sha }));
  setFact(facts, 'no_core_duplication', evidence(ci.ok && completeness.backend_authority_unchanged === true && dashboard.presentation_only === true && dashboard.direct_provider_calls === false, 'existing backend authority retained + exact-head CI', { head_sha: ci.head_sha }));
  setFact(facts, 'single_dashboard_system', evidence(dashboardCi && completeness.enriches_existing_dashboard_only === true && dashboard.schema === 'riosystems.operator-dashboard-view.v1', 'single dashboard enrichment chain + dashboard CI', { head_sha: ci.head_sha }));

  return facts;
}

function buildActivationEvidence({ system_health = {}, request_context = {}, deployment_evidence = {}, access_evidence = {} } = {}) {
  const activation = {};
  const persistence = system_health.signals?.runtime_persistence;
  const staging = system_health.signals?.staging_availability;
  const head = system_health.branch_truth?.head_sha || null;
  const persistenceHealthy = healthy(persistence) && persistence?.store_mode === 'supabase';

  setFact(activation, 'durable_runtime_schema_applied', evidence(persistenceHealthy, 'live Supabase-backed runtime snapshot', { runtime_revision: persistence?.runtime_revision ?? null }));
  setFact(activation, 'durable_runtime_secrets_configured', evidence(persistenceHealthy, 'successful server-side Supabase runtime probe', { store_mode: persistence?.store_mode || null }));

  const accessStatus = String(access_evidence.status || '').toUpperCase();
  const accessVerified = accessStatus === 'HEALTHY' && access_evidence.access_application_configured === true && access_evidence.restrictive_policy_verified === true
    ? true
    : accessStatus === 'BLOCKED' ? false : undefined;
  setFact(activation, 'access_application_configured', evidence(
    accessVerified,
    'authoritative GitHub Cloudflare Access read-only evidence',
    clone(access_evidence)
  ));

  const deploymentStatus = String(deployment_evidence.status || '').toUpperCase();
  const deployedSha = deployment_evidence.deployed_sha || null;
  const deploymentVerified = deploymentStatus === 'HEALTHY' && deployedSha && head
    ? deployedSha === head
    : ['BLOCKED','STALE'].includes(deploymentStatus) ? false : undefined;
  setFact(activation, 'latest_factory_control_deployed_to_staging', evidence(
    deploymentVerified,
    'authoritative GitHub zero-cost staging deployment evidence',
    { ...clone(deployment_evidence), canonical_head_sha: head }
  ));

  setFact(activation, 'authenticated_staging_smoke_passed', evidence(healthy(staging) && request_context.server_side_operator_authorized === true, 'current authenticated staging operator request', { staging_status: staging?.status || null }));

  return activation;
}

export function buildRiosystemsV1AcceptanceFromEvidence(input = {}) {
  const definitionOfDone = buildCodeEvidence(input);
  const stagingActivation = buildActivationEvidence(input);
  const runtime = operatorRuntimeManifest();
  const completeness = operatorDashboardCompletenessManifest();
  const projectCreate = operatorProjectCreateDashboardManifest();
  const safety = {
    production_active: false,
    real_customer_data_active: projectCreate.synthetic_only === true ? false : null,
    automatic_paid_overflow: completeness.automatic_paid_overflow === false ? false : null,
    unapproved_external_writes: completeness.live_staging_requires_server_executor === true && runtime.external_writes === false ? false : null,
    ...(input.safety_overrides || {})
  };
  const acceptance = buildRiosystemsV1Acceptance({ definition_of_done: definitionOfDone, staging_activation: stagingActivation, safety, human_outcome: input.human_outcome || {} });
  return {
    ...acceptance,
    evidence_collector: {
      schema: 'riosystems.v1-acceptance-evidence.v1',
      exact_head_sha: input.system_health?.branch_truth?.head_sha || null,
      no_inferred_activation_success: true,
      access_requires_authoritative_readonly_evidence: true,
      deployment_requires_exact_sha_evidence: true,
      human_outcome_requires_final_composed_browser_evidence: true,
      production_deploy: false
    }
  };
}

export function riosystemsV1AcceptanceEvidenceManifest() {
  return {
    schema: 'riosystems.v1-acceptance-evidence.v1',
    code_sources: ['operator-runtime-v1','operator-dashboard-v1','operator-dashboard-completeness-v1','operator-project-create-dashboard-v1','operator-system-health-v1','operator-dashboard-shell-v1','operator-dashboard-http-v1','github_actions_exact_factory_control_head'],
    activation_sources: ['live_supabase_runtime_snapshot','github_actions_cloudflare_access_readonly','github_actions_zero_cost_staging_deploy','current_authenticated_staging_operator_request'],
    unknown_activation_is_not_verified: true,
    production_deploy: false
  };
}
