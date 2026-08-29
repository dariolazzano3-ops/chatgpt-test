import { getAutomationProvider, selectAutomationRuntime } from './automation-provider-strategy.js';

const clean = (value, max = 240) => String(value || '').trim().slice(0, max);

export function planAutomationProviderRoute(input = {}) {
  if (input.production_deploy === true) return { ok: false, error: 'PRODUCTION_DEPLOY_REJECTED', production_deploy: false };
  const runtime = selectAutomationRuntime(input);
  if (!runtime.ok) return runtime;
  const orchestrator = getAutomationProvider('riosystems-native-automation');
  const blockers = [...runtime.blockers];

  if (input.execute_external === true && input.external_write_approved !== true) {
    blockers.push({ code: 'EXTERNAL_WRITE_APPROVAL_REQUIRED', provider_id: runtime.provider.id });
  }
  if (input.execute_external === true && input.supervised_execution_approved !== true) {
    blockers.push({ code: 'SUPERVISED_EXECUTION_APPROVAL_REQUIRED', provider_id: runtime.provider.id });
  }
  const sourceRevision = clean(input.source_revision, 120);
  if (!sourceRevision) blockers.push({ code: 'SOURCE_REVISION_REQUIRED' });

  const unique = blockers.filter((item, index, list) =>
    list.findIndex((other) => other.code === item.code && other.provider_id === item.provider_id) === index
  );

  return {
    ok: true,
    schema: 'riosystems.automation-provider-route.v1',
    capability: clean(input.capability, 120) || 'automation.run',
    source_revision: sourceRevision || null,
    orchestrator,
    runtime_provider: runtime.provider,
    route: [orchestrator.id, runtime.provider.id],
    state: unique.length === 0
      ? (input.execute_external === true ? 'EXTERNAL_EXECUTION_APPROVED' : 'ROUTE_READY')
      : 'ROUTE_BLOCKED',
    blockers: unique,
    external_write: input.execute_external === true,
    automatic_paid_overflow: false,
    production_deploy: false
  };
}
