import { createCommandCenterState, buildCommandCenterSnapshot } from './command-center.js';
import { providerStackV1, providerActivationMatrix } from './provider-stack-v1.js';
import { aggregateMissionDelivery } from './mission-delivery-aggregator.js';
import { bakeryMullerLiveE2EEvidence, isBakeryMullerLiveE2EVerified } from './bakery-muller-live-e2e-evidence.js';
import { growthFactoryManifest } from './growth-v1/contracts.js';

const clone = (value) => structuredClone(value ?? null);
const clean = (value, max = 240) => String(value ?? '').trim().slice(0, max);

function statusFor(condition, fallback = 'NOT_READY') {
  return condition ? 'LIVE_STAGING_VERIFIED' : fallback;
}

export function buildFactoryReadinessMatrix() {
  const stack = providerStackV1();
  const growth = growthFactoryManifest();
  const items = [
    {
      factory: 'web',
      role: 'website_production',
      status: statusFor(stack.factories.web.staging_deploy_verified === true, stack.factories.web.provider_read_verified === true ? 'READ_VERIFIED' : 'NOT_READY'),
      provider_path: clone(stack.factories.web.primary_path),
      evidence: clone(stack.factories.web.staging_deploy_evidence),
      production_deploy: false
    },
    {
      factory: 'automation',
      role: 'automation_execution',
      status: statusFor(stack.factories.automation.staging_activation_verified === true),
      provider_path: clone(stack.factories.automation.primary_path),
      evidence: clone(stack.factories.automation.staging_activation_evidence),
      production_deploy: false
    },
    {
      factory: 'ai',
      role: 'ai_execution',
      status: statusFor(stack.factories.ai.cloudflare_ai_runtime_verified === true),
      provider_path: clone(stack.factories.ai.free_staging_path),
      evidence: clone(stack.factories.ai.cloudflare_ai_runtime_evidence),
      production_deploy: false
    },
    {
      factory: 'business',
      role: 'crm_business_backend_analytics',
      status: statusFor(
        stack.factories.business.provider_read_verified === true
          && stack.factories.business.staging_write_verified === true
          && stack.factories.business.analytics_staging_verified === true
      ),
      provider_path: clone(stack.factories.business.primary_path),
      evidence: {
        read: clone(stack.factories.business.provider_read_evidence),
        write: clone(stack.factories.business.staging_write_evidence),
        analytics: clone(stack.factories.business.analytics_staging_evidence)
      },
      production_deploy: false
    },
    {
      factory: 'growth',
      role: growth.role,
      status: growth.provider_neutral === true ? 'STRATEGY_ENGINE_READY' : 'NOT_READY',
      provider_path: ['provider-neutral'],
      evidence: { schema: growth.schema, owns: clone(growth.owns), safety: clone(growth.safety) },
      production_deploy: false
    },
    {
      factory: 'app',
      role: 'application_factory',
      status: stack.app_factory.status === 'AVAILABLE' ? 'AVAILABLE' : 'PLANNED',
      provider_path: [],
      evidence: { reason: stack.app_factory.reason },
      production_deploy: false
    }
  ];

  const live = items.filter((item) => item.status === 'LIVE_STAGING_VERIFIED').length;
  const strategic = items.filter((item) => item.status === 'STRATEGY_ENGINE_READY').length;
  return {
    schema: 'riosystems.factory-readiness-matrix.v1',
    items,
    summary: {
      total: items.length,
      live_staging_verified: live,
      strategy_engines_ready: strategic,
      planned: items.filter((item) => item.status === 'PLANNED').length,
      core_live_staging_chain_ready: ['web','automation','ai','business'].every((factory) => items.find((item) => item.factory === factory)?.status === 'LIVE_STAGING_VERIFIED')
    },
    automatic_paid_overflow: false,
    production_deploy: false
  };
}

function normalizeMissionEntry(entry = {}) {
  if (entry?.mission && typeof entry.mission === 'object') return { mission: entry.mission, activation: entry.activation || null };
  return { mission: entry, activation: null };
}

export function buildMissionDeliveryRegistry(entries = []) {
  const reports = [];
  for (const [index, raw] of (Array.isArray(entries) ? entries : []).entries()) {
    const entry = normalizeMissionEntry(raw);
    const report = aggregateMissionDelivery(entry.mission, { activation: entry.activation });
    if (!report.ok) return { ok: false, error: 'CONTROL_PLANE_MISSION_INVALID', index, cause: report.error || null, production_deploy: false };
    reports.push(report);
  }
  const liveProofVerified = isBakeryMullerLiveE2EVerified();
  const liveProof = liveProofVerified ? bakeryMullerLiveE2EEvidence() : null;
  return {
    ok: true,
    schema: 'riosystems.delivery-registry.v1',
    mission_reports: reports,
    live_proofs: liveProof ? [{
      proof_id: liveProof.trace_id,
      kind: 'cross_provider_live_staging_e2e',
      project_scope: liveProof.project_scope,
      status: liveProof.unified_delivery.status,
      provider_chain: clone(liveProof.provider_chain),
      qa_passed: liveProof.qa.passed === true,
      variable_cost_eur: liveProof.safety.variable_cost_eur,
      production_deploy: false,
      evidence: liveProof
    }] : [],
    summary: {
      mission_count: reports.length,
      structurally_complete: reports.filter((item) => item.structural_completion === true).length,
      externally_ready: reports.filter((item) => item.external_activation_ready === true).length,
      unresolved_count: reports.reduce((sum, item) => sum + (item.unresolved || []).length, 0),
      live_e2e_proof_count: liveProof ? 1 : 0,
      live_e2e_verified: liveProofVerified
    },
    production_deploy: false
  };
}

function deriveNextActions(command, deliveries, factories) {
  const actions = [];
  for (const approval of command.approvals.pending || []) {
    actions.push({ priority: 10, kind: 'approval', scope_key: approval.scope_key || null, message: `Approval required: ${approval.approval_type || approval.capability || 'external action'}` });
  }
  for (const project of command.queue || []) {
    if (project.blocked) actions.push({ priority: 20, kind: 'project_blocker', scope_key: project.scope_key, message: project.next_action || `Resolve ${project.blocker_count || 1} project blocker(s)` });
  }
  for (const report of deliveries.mission_reports || []) {
    for (const unresolved of report.unresolved || []) actions.push({ priority: 30, kind: 'mission_unresolved', mission_id: report.mission_id, task_id: unresolved.task_id, message: `${unresolved.engine || 'mission'} task is ${unresolved.state}` });
  }
  if (factories.summary.core_live_staging_chain_ready !== true) actions.push({ priority: 40, kind: 'factory_readiness', message: 'Complete core factory staging readiness before supervised cross-factory execution.' });
  if (!actions.length) actions.push({ priority: 100, kind: 'ready', message: 'Control plane is ready for the next supervised staging mission.' });
  return actions.sort((a, b) => a.priority - b.priority);
}

function deriveAlerts(command, deliveries, factories) {
  const alerts = [];
  if (command.executions.failed_count > 0) alerts.push({ severity: 'high', code: 'EXECUTION_FAILURES_PRESENT', count: command.executions.failed_count });
  if (command.portfolio.blocked_count > 0) alerts.push({ severity: 'medium', code: 'PROJECT_BLOCKERS_PRESENT', count: command.portfolio.blocked_count });
  if (command.approvals.pending_count > 0) alerts.push({ severity: 'medium', code: 'APPROVALS_PENDING', count: command.approvals.pending_count });
  if (deliveries.summary.unresolved_count > 0) alerts.push({ severity: 'medium', code: 'MISSION_ITEMS_UNRESOLVED', count: deliveries.summary.unresolved_count });
  if (factories.summary.core_live_staging_chain_ready !== true) alerts.push({ severity: 'medium', code: 'CORE_FACTORY_STAGING_INCOMPLETE' });
  return alerts;
}

export function buildOperatorControlPlane(input = {}) {
  const operatorId = clean(input.operator_id, 160);
  if (!operatorId) return { ok: false, error: 'CONTROL_PLANE_OPERATOR_REQUIRED', production_deploy: false };

  let state = input.command_center_state || null;
  if (!state) {
    const created = createCommandCenterState({
      operator_id: operatorId,
      portfolio: input.portfolio || { operator_id: operatorId, projects: [] },
      approvals: input.approvals || [],
      integration_health: input.integration_health || {},
      execution_runs: input.execution_runs || [],
      alerts: input.alerts || [],
      at: input.at
    });
    if (!created.ok) return { ok: false, error: created.error || 'COMMAND_CENTER_STATE_FAILED', production_deploy: false };
    state = created.state;
  }

  const command = buildCommandCenterSnapshot(state);
  const deliveries = buildMissionDeliveryRegistry(input.missions || []);
  if (!deliveries.ok) return deliveries;
  const factories = buildFactoryReadinessMatrix();
  const providerActivation = providerActivationMatrix();
  const alerts = deriveAlerts(command, deliveries, factories);
  const nextActions = deriveNextActions(command, deliveries, factories);
  const liveControlReady = factories.summary.core_live_staging_chain_ready === true && deliveries.summary.live_e2e_verified === true;
  const attention = alerts.length > 0;

  return {
    ok: true,
    schema: 'riosystems.operator-control-plane.v1',
    operator_id: operatorId,
    readiness: {
      status: attention ? 'OPERATOR_ATTENTION_REQUIRED' : liveControlReady ? 'LIVE_STAGING_CONTROL_READY' : 'CONTROL_PLANE_READY',
      live_staging_control_ready: liveControlReady,
      supervised_execution_only: true,
      external_activation_separate: true,
      production_ready: false
    },
    command_center: command,
    factories,
    providers: {
      source_of_truth: command.provider_readiness.source_of_truth,
      activation_matrix: providerActivation
    },
    deliveries,
    alerts,
    next_actions: nextActions,
    cost: {
      development_ceiling_eur: 0,
      live_proof_variable_cost_eur: deliveries.live_proofs.reduce((sum, item) => sum + Number(item.variable_cost_eur || 0), 0),
      automatic_paid_overflow: false,
      paid_execution_authorized: false
    },
    safety: {
      read_only_control_plane: true,
      external_mutations_performed: false,
      external_writes_require_explicit_approval: true,
      paid_execution_requires_explicit_approval: true,
      customer_project_isolation_required: true,
      real_customer_data_allowed: false,
      custom_domain_changes_allowed: false,
      mass_email_allowed: false,
      money_movement_allowed: false,
      production_deploy: false
    }
  };
}

export function operatorControlPlaneManifest() {
  return {
    schema: 'riosystems.operator-control-plane.v1',
    role: 'single_operator_factory_control_and_unified_delivery',
    surfaces: ['portfolio','operator_queue','approvals','executions','factory_readiness','provider_activation','mission_delivery','live_e2e_proofs','alerts','next_actions','cost','safety'],
    consumes_existing_command_center: true,
    consumes_existing_mission_delivery_aggregator: true,
    consumes_verified_block6_live_evidence: true,
    includes_growth_factory: true,
    external_mutations: false,
    automatic_paid_overflow: false,
    production_deploy: false
  };
}
