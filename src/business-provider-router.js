import { evaluateBusinessProviderReadiness, getBusinessProvider } from './business-provider-strategy.js';

const clean = (value, max = 240) => String(value || '').trim().slice(0, max);

export function planBusinessProviderRoute(input = {}) {
  if (input.production_deploy === true) return { ok: false, error: 'PRODUCTION_DEPLOY_REJECTED', production_deploy: false };
  const readiness = evaluateBusinessProviderReadiness(input);
  if (!readiness.ok) return readiness;
  const sourceRevision = clean(input.source_revision, 120);
  const blockers = [...readiness.blockers];
  if (!sourceRevision) blockers.push({ code: 'SOURCE_REVISION_REQUIRED' });
  if (input.execute_external_writes === true && input.supervised_execution_approved !== true) blockers.push({ code: 'SUPERVISED_BUSINESS_EXECUTION_APPROVAL_REQUIRED' });
  const unique = blockers.filter((item, index, list) => list.findIndex((other) => other.code === item.code && other.provider_id === item.provider_id) === index);
  const control = getBusinessProvider('riosystems-native-business');
  return {
    ok: true,
    schema: 'riosystems.business-provider-route.v1',
    capability: clean(input.capability, 120) || 'business.configure',
    source_revision: sourceRevision || null,
    control_provider: control,
    backend_provider: getBusinessProvider('supabase-free'),
    analytics_provider: getBusinessProvider('posthog-free'),
    route: [control.id, 'supabase-free', 'posthog-free'],
    state: unique.length === 0 ? (input.execute_external_writes === true ? 'BUSINESS_EXECUTION_APPROVED' : 'ROUTE_READY') : 'ROUTE_BLOCKED',
    blockers: unique,
    external_write: input.execute_external_writes === true,
    automatic_paid_overflow: false,
    production_deploy: false
  };
}
