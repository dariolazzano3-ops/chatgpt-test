import { buildOperatorQueue, portfolioSnapshot } from './project-portfolio.js';
import { providerStackV1 } from './provider-stack-v1.js';

const clone = (value) => structuredClone(value ?? null);
const clean = (value, max = 240) => String(value || '').trim().slice(0, max);
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

function normalizeApproval(item = {}) {
  return {
    approval_id: clean(item.approval_id, 180) || null,
    scope_key: clean(item.scope_key, 260) || null,
    approval_type: clean(item.approval_type, 120) || null,
    actor_id: clean(item.actor_id, 160) || null,
    provider_id: clean(item.provider_id, 120) || null,
    capability: clean(item.capability, 120) || null,
    granted: item.granted === true,
    expires_at: item.expires_at || null
  };
}

function providerReadinessSnapshot() {
  const stack = providerStackV1();
  return {
    status: stack.status,
    source_of_truth: stack.source_of_truth,
    factories: {
      web: {
        provider_read_verified: stack.factories.web.provider_read_verified === true,
        staging_deploy_verified: stack.factories.web.staging_deploy_verified === true,
        evidence: clone(stack.factories.web.staging_deploy_evidence)
      },
      automation: {
        staging_activation_verified: stack.factories.automation.staging_activation_verified === true,
        evidence: clone(stack.factories.automation.staging_activation_evidence)
      },
      ai: {
        cloudflare_runtime_verified: stack.factories.ai.cloudflare_ai_runtime_verified === true,
        evidence: clone(stack.factories.ai.cloudflare_ai_runtime_evidence),
        blocker: stack.factories.ai.cloudflare_ai_blocker
      },
      business: {
        provider_read_verified: stack.factories.business.provider_read_verified === true,
        staging_write_plan_ready: stack.factories.business.staging_write_plan_ready === true,
        staging_write_verified: stack.factories.business.staging_write_verified === true,
        posthog_staging_analytics_verified: stack.factories.business.analytics_staging_verified === true,
        evidence: clone(stack.factories.business.provider_read_evidence),
        staging_write_evidence: clone(stack.factories.business.staging_write_evidence),
        posthog_staging_analytics_evidence: clone(stack.factories.business.analytics_staging_evidence)
      }
    },
    paid_execution: false,
    automatic_paid_overflow: false,
    production_deploy: false
  };
}

export function createCommandCenterState(input = {}) {
  const operatorId = clean(input.operator_id, 160);
  if (!operatorId) return { ok: false, error: 'COMMAND_CENTER_OPERATOR_REQUIRED', production_deploy: false };
  return {
    ok: true,
    state: {
      schema_version: 'riosystems.command-center.v1',
      operator_id: operatorId,
      portfolio: clone(input.portfolio || { operator_id: operatorId, projects: [] }),
      approvals: (input.approvals || []).map(normalizeApproval),
      integration_health: clone(input.integration_health || {}),
      execution_runs: clone(input.execution_runs || []),
      alerts: clone(input.alerts || []),
      audit: [{ event: 'COMMAND_CENTER_CREATED', actor: operatorId, at: input.at || new Date().toISOString() }],
      production_deploy: false
    }
  };
}

export function buildCommandCenterSnapshot(state = {}) {
  const queue = buildOperatorQueue(state.portfolio || {});
  const portfolio = portfolioSnapshot(state.portfolio || {});
  const runs = state.execution_runs || [];
  const approvals = state.approvals || [];
  const approvalQueue = approvals.filter((item) => item.granted !== true);
  const runStates = {};
  for (const run of runs) runStates[run.status || 'UNKNOWN'] = (runStates[run.status || 'UNKNOWN'] || 0) + 1;
  const healthValues = Object.values(state.integration_health || {});
  return {
    snapshot_version: 'riosystems.command-center.snapshot.v1',
    operator_id: state.operator_id || null,
    portfolio,
    queue: queue.queue || [],
    approvals: {
      pending_count: approvalQueue.length,
      pending: clone(approvalQueue)
    },
    executions: {
      count: runs.length,
      states: runStates,
      waiting_count: runs.filter((item) => ['WAITING_APPROVAL','WAITING_EXTERNAL','QA','RECOVERABLE'].includes(item.status)).length,
      failed_count: runs.filter((item) => item.status === 'FAILED').length
    },
    integrations: {
      known_count: healthValues.length,
      healthy_count: healthValues.filter((value) => value === 'healthy').length,
      degraded_count: healthValues.filter((value) => value === 'degraded').length,
      offline_count: healthValues.filter((value) => value === 'offline').length
    },
    provider_readiness: providerReadinessSnapshot(),
    alerts: clone(state.alerts || []),
    production_deploy: false
  };
}

export function evaluateCommand(state = {}, command = {}) {
  const type = clean(command.type, 120);
  const scopeKey = clean(command.scope_key, 260);
  const allowed = ['PRIORITIZE_PROJECT','PAUSE_PROJECT','RESUME_PROJECT','GRANT_APPROVAL','REVOKE_APPROVAL','ACK_ALERT','REQUEST_EXECUTION','REQUEST_QA','REQUEST_HANDOFF'];
  if (!allowed.includes(type)) return { ok: false, error: 'COMMAND_TYPE_UNSUPPORTED', production_deploy: false };
  const project = (state.portfolio?.projects || []).find((item) => item.scope_key === scopeKey);
  if (['PRIORITIZE_PROJECT','PAUSE_PROJECT','RESUME_PROJECT','REQUEST_EXECUTION','REQUEST_QA','REQUEST_HANDOFF'].includes(type) && !project) {
    return { ok: false, error: 'COMMAND_PROJECT_NOT_FOUND', scope_key: scopeKey, production_deploy: false };
  }
  const externalMutation = ['GRANT_APPROVAL','REVOKE_APPROVAL'].includes(type) || command.external_side_effect === true;
  const requiresExplicitApproval = ['REQUEST_EXECUTION','REQUEST_HANDOFF'].includes(type) || externalMutation;
  return {
    ok: true,
    command_id: clean(command.command_id, 180) || `${state.operator_id || 'operator'}:${type}:${Date.now()}`,
    type,
    scope_key: scopeKey || null,
    project: project ? clone(project) : null,
    priority: type === 'PRIORITIZE_PROJECT' ? Math.max(0, finite(command.priority, 0)) : null,
    requires_explicit_approval: requiresExplicitApproval,
    ready_for_dispatch: !requiresExplicitApproval || command.approved === true,
    production_deploy: false
  };
}

export function applyLocalCommand(state = {}, evaluated = {}) {
  if (!evaluated.ok) return evaluated;
  if (!evaluated.ready_for_dispatch) return { ok: true, state: clone(state), command: evaluated, user_action_required: true, production_deploy: false };
  const next = clone(state);
  const project = (next.portfolio?.projects || []).find((item) => item.scope_key === evaluated.scope_key);
  if (evaluated.type === 'PRIORITIZE_PROJECT' && project) project.priority = evaluated.priority;
  if (evaluated.type === 'PAUSE_PROJECT' && project) project.state = 'PAUSED';
  if (evaluated.type === 'RESUME_PROJECT' && project && project.state === 'PAUSED') project.state = 'READY';
  next.audit = [...(next.audit || []), { event: 'COMMAND_APPLIED', command_id: evaluated.command_id, type: evaluated.type, scope_key: evaluated.scope_key, actor: state.operator_id || 'operator', at: new Date().toISOString() }];
  return { ok: true, state: next, command: evaluated, external_side_effect_performed: false, production_deploy: false };
}

export function commandCenterManifest() {
  return {
    version: 'riosystems.command-center.v1',
    surfaces: ['portfolio','priority_queue','approvals','executions','integration_health','provider_readiness','alerts','audit'],
    commands: ['prioritize','pause','resume','grant_approval','revoke_approval','request_execution','request_qa','request_handoff'],
    dashboard_contract_ready: true,
    command_dispatch_fail_closed: true,
    external_side_effects_implicit: false,
    production_deploy: false
  };
}
