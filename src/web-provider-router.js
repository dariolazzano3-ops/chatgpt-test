import { getWebProvider, selectWebBuildProvider } from './web-provider-strategy.js';

const clean = (value, max = 240) => String(value || '').trim().slice(0, max);

export function planWebFactoryProviderRoute(input = {}) {
  if (input.production_deploy === true) {
    return { ok: false, error: 'PRODUCTION_DEPLOY_REJECTED', production_deploy: false };
  }
  if (input.custom_domain_change === true) {
    return { ok: false, error: 'CUSTOM_DOMAIN_CHANGE_REQUIRES_SEPARATE_APPROVAL', production_deploy: false };
  }

  const build = selectWebBuildProvider(input);
  if (!build.ok) return build;
  const host = getWebProvider('cloudflare-workers-free');
  const blockers = [...build.blockers];

  const connected = new Set(Array.isArray(input.connected_providers) ? input.connected_providers : []);
  if (!connected.has(host.id)) blockers.push({ code: 'WEB_HOST_CONNECTION_REQUIRED', provider_id: host.id });
  if (input.execute_staging === true && input.external_write_approved !== true) {
    blockers.push({ code: 'STAGING_EXTERNAL_WRITE_APPROVAL_REQUIRED', provider_id: host.id });
  }
  if (input.execute_staging === true && input.supervised_execution_approved !== true) {
    blockers.push({ code: 'SUPERVISED_EXECUTION_APPROVAL_REQUIRED', provider_id: host.id });
  }

  const sourceRevision = clean(input.source_revision, 120);
  if (!sourceRevision) blockers.push({ code: 'SOURCE_REVISION_REQUIRED' });

  const unique = blockers.filter((item, index, list) =>
    list.findIndex((other) => other.code === item.code && other.provider_id === item.provider_id) === index
  );

  return {
    ok: true,
    schema: 'riosystems.web-provider-route.v1',
    capability: clean(input.capability, 120) || 'web.build.marketing-site',
    source_revision: sourceRevision || null,
    build_provider: build.provider,
    hosting_provider: host,
    route: [build.provider.id, host.id],
    state: unique.length === 0
      ? (input.execute_staging === true ? 'STAGING_EXECUTION_APPROVED' : 'ROUTE_READY')
      : 'ROUTE_BLOCKED',
    blockers: unique,
    execution_requested: input.execute_staging === true,
    external_write: input.execute_staging === true,
    automatic_paid_overflow: false,
    custom_domain_change: false,
    production_deploy: false
  };
}

export function authorizeWebStagingExecution(plan = {}, approval = {}) {
  if (!plan?.ok) return { ok: false, error: 'INVALID_WEB_ROUTE_PLAN', production_deploy: false };
  if (approval.production_deploy === true || approval.custom_domain_change === true) {
    return { ok: false, error: 'PRODUCTION_OR_DOMAIN_SIDE_EFFECT_REJECTED', production_deploy: false };
  }
  if (plan.blockers?.length) return { ok: false, error: 'WEB_ROUTE_BLOCKERS_PRESENT', blockers: plan.blockers, production_deploy: false };
  if (approval.external_write_approved !== true || approval.supervised_execution_approved !== true) {
    return { ok: false, error: 'WEB_STAGING_APPROVAL_REQUIRED', production_deploy: false };
  }
  return {
    ok: true,
    state: 'STAGING_EXECUTION_AUTHORIZED',
    route: [...plan.route],
    source_revision: plan.source_revision,
    automatic_paid_overflow: false,
    production_deploy: false
  };
}
