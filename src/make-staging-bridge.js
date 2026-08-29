const clean = (value, max = 400) => String(value ?? '').trim().slice(0, max);
const clone = (value) => structuredClone(value ?? null);

const MAKE_ZONE_HOSTS = Object.freeze([
  'eu1.make.com',
  'eu2.make.com',
  'us1.make.com',
  'us2.make.com',
  'eu1.make.celonis.com',
  'us1.make.celonis.com'
]);
const MAKE_TOKEN_REF_RE = /^(?:env|secret):[A-Z][A-Z0-9_]{2,100}$/;
const WRITE_SCOPES = Object.freeze(['scenarios:write']);
const RUN_SCOPES = Object.freeze(['scenarios:read', 'scenarios:write', 'scenarios:run']);
const READ_SCOPES = Object.freeze(['organization:read', 'scenarios:read']);
const READ_PAGE_LIMIT = 25;

function normalizeZoneUrl(value) {
  const raw = clean(value, 300);
  if (!raw) return { ok: false, error: 'MAKE_ZONE_URL_REQUIRED' };
  let parsed;
  try { parsed = new URL(raw); } catch { return { ok: false, error: 'MAKE_ZONE_URL_INVALID' }; }
  if (parsed.protocol !== 'https:') return { ok: false, error: 'MAKE_HTTPS_REQUIRED' };
  if (!MAKE_ZONE_HOSTS.includes(parsed.hostname)) return { ok: false, error: 'MAKE_ZONE_HOST_NOT_ALLOWED', host: parsed.hostname };
  return { ok: true, zone_url: parsed.origin, api_base_url: `${parsed.origin}/api/v2`, host: parsed.hostname };
}

function normalizeTeamId(value) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function normalizeScopes(value) {
  return [...new Set((Array.isArray(value) ? value : []).map((item) => clean(item, 80)).filter(Boolean))].sort();
}

function hasScopes(granted, required) {
  const set = new Set(granted);
  return required.every((scope) => set.has(scope));
}

function secretPath(path, key) {
  return path ? `${path}.${key}` : key;
}

function findEmbeddedSecret(value, path = '') {
  if (!value || typeof value !== 'object') return null;
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const found = findEmbeddedSecret(value[index], `${path}[${index}]`);
      if (found) return found;
    }
    return null;
  }
  for (const [key, item] of Object.entries(value)) {
    const lower = key.toLowerCase();
    const nextPath = secretPath(path, key);
    const looksSecret = ['token', 'authorization', 'password', 'secret', 'api_key', 'apikey', 'access_token'].includes(lower);
    const isReference = lower.endsWith('_ref') || lower.endsWith('ref');
    if (looksSecret && !isReference && item !== null && clean(item, 200)) return nextPath;
    const nested = findEmbeddedSecret(item, nextPath);
    if (nested) return nested;
  }
  return null;
}

export function makeStagingActivationManifest() {
  return {
    schema: 'riosystems.make-staging-activation.v1',
    provider_id: 'make-core',
    status: 'CONTRACT_READY_CONNECTION_REQUIRED',
    api_version: 'v2',
    supported_zone_hosts: [...MAKE_ZONE_HOSTS],
    credential_reference_only: true,
    read_only_preflight_supported: true,
    read_only_page_limit: READ_PAGE_LIMIT,
    read_only_pagination: 'offset_limit',
    scenario_create_planning_supported: true,
    scenario_run_planning_supported: true,
    real_http_execution_implemented: false,
    paid_plan_api_access_required: true,
    automatic_extra_credit_purchase: false,
    external_write_requires_explicit_approval: true,
    supervised_execution_required: true,
    production_deploy: false
  };
}

export function buildMakeConnectionContract(input = {}) {
  if (input.production_deploy === true) return { ok: false, error: 'PRODUCTION_DEPLOY_REJECTED', production_deploy: false };
  const zone = normalizeZoneUrl(input.zone_url);
  const teamId = normalizeTeamId(input.team_id);
  const tokenRef = clean(input.token_ref, 120);
  const grantedScopes = normalizeScopes(input.granted_scopes);
  const plan = clean(input.plan, 40).toLowerCase() || 'unknown';
  const blockers = [];

  if (!zone.ok) blockers.push({ code: zone.error, host: zone.host || null });
  if (!teamId) blockers.push({ code: 'MAKE_TEAM_ID_REQUIRED' });
  if (!MAKE_TOKEN_REF_RE.test(tokenRef)) blockers.push({ code: 'MAKE_TOKEN_REFERENCE_REQUIRED', expected: 'secret:MAKE_API_TOKEN' });
  if (plan === 'free') blockers.push({ code: 'MAKE_API_PLAN_UPGRADE_REQUIRED' });
  if (plan === 'unknown') blockers.push({ code: 'MAKE_API_PLAN_ACCESS_UNVERIFIED' });
  if (!hasScopes(grantedScopes, READ_SCOPES)) blockers.push({ code: 'MAKE_READ_SCOPES_REQUIRED', required_scopes: [...READ_SCOPES] });

  return {
    ok: true,
    schema: 'riosystems.make-connection-contract.v1',
    provider_id: 'make-core',
    zone_url: zone.ok ? zone.zone_url : null,
    api_base_url: zone.ok ? zone.api_base_url : null,
    team_id: teamId,
    token_ref: MAKE_TOKEN_REF_RE.test(tokenRef) ? tokenRef : null,
    granted_scopes: grantedScopes,
    plan,
    ready_for_read_only_preflight: blockers.length === 0,
    blockers,
    secrets_embedded: false,
    automatic_extra_credit_purchase: false,
    production_deploy: false
  };
}

export function planMakeReadOnlyPreflight(input = {}) {
  const contract = buildMakeConnectionContract(input);
  if (!contract.ok) return contract;
  const scenarioUrl = new URL(`${contract.api_base_url}/scenarios`);
  scenarioUrl.searchParams.set('teamId', String(contract.team_id));
  scenarioUrl.searchParams.set('pg[offset]', '0');
  scenarioUrl.searchParams.set('pg[limit]', String(READ_PAGE_LIMIT));
  scenarioUrl.searchParams.set('pg[sortBy]', 'id');
  scenarioUrl.searchParams.set('pg[sortDir]', 'asc');
  return {
    ok: true,
    schema: 'riosystems.make-readonly-preflight.v1',
    provider_id: 'make-core',
    state: contract.ready_for_read_only_preflight ? 'READY_FOR_READ_ONLY_PREFLIGHT' : 'BLOCKED',
    blockers: clone(contract.blockers),
    auth: contract.token_ref ? { scheme: 'Token', token_ref: contract.token_ref } : null,
    requests: contract.ready_for_read_only_preflight ? [
      { method: 'GET', url: `${contract.api_base_url}/ping`, required_scopes: ['organization:read'], external_write: false },
      { method: 'GET', url: scenarioUrl.toString(), required_scopes: ['scenarios:read'], external_write: false }
    ] : [],
    pagination: { strategy: 'offset_limit', offset: 0, limit: READ_PAGE_LIMIT, sort_by: 'id', sort_dir: 'asc' },
    execute_http: false,
    external_write: false,
    automatic_extra_credit_purchase: false,
    production_deploy: false
  };
}

export function planMakeScenarioCreate(input = {}) {
  if (input.production_deploy === true) return { ok: false, error: 'PRODUCTION_DEPLOY_REJECTED', production_deploy: false };
  const contract = buildMakeConnectionContract(input);
  const spec = input.scenario_spec && typeof input.scenario_spec === 'object' && !Array.isArray(input.scenario_spec)
    ? clone(input.scenario_spec) : null;
  const blockers = [...(contract.blockers || [])];
  const secretAt = findEmbeddedSecret(spec);

  if (!spec) blockers.push({ code: 'MAKE_SCENARIO_SPEC_REQUIRED' });
  if (secretAt) blockers.push({ code: 'EMBEDDED_SECRET_REJECTED', path: secretAt });
  if (!hasScopes(contract.granted_scopes || [], WRITE_SCOPES)) blockers.push({ code: 'MAKE_WRITE_SCOPE_REQUIRED', required_scopes: [...WRITE_SCOPES] });
  if (input.paid_provider_approved !== true) blockers.push({ code: 'PAID_PROVIDER_APPROVAL_REQUIRED', provider_id: 'make-core' });
  if (input.external_write_approved !== true) blockers.push({ code: 'EXTERNAL_WRITE_APPROVAL_REQUIRED', provider_id: 'make-core' });
  if (input.supervised_execution_approved !== true) blockers.push({ code: 'SUPERVISED_EXECUTION_APPROVAL_REQUIRED', provider_id: 'make-core' });
  if (input.staging_only !== true) blockers.push({ code: 'STAGING_ONLY_REQUIRED' });

  return {
    ok: true,
    schema: 'riosystems.make-scenario-create-plan.v1',
    provider_id: 'make-core',
    state: blockers.length === 0 ? 'WRITE_PLAN_APPROVED_NOT_EXECUTED' : 'BLOCKED',
    blockers,
    request: blockers.length === 0 ? {
      method: 'POST',
      url: `${contract.api_base_url}/scenarios`,
      required_scopes: [...WRITE_SCOPES],
      team_id: contract.team_id,
      scenario_spec: spec,
      auth: { scheme: 'Token', token_ref: contract.token_ref }
    } : null,
    execute_http: false,
    external_write: true,
    automatic_extra_credit_purchase: false,
    production_deploy: false
  };
}

export function planMakeScenarioRun(input = {}) {
  if (input.production_deploy === true) return { ok: false, error: 'PRODUCTION_DEPLOY_REJECTED', production_deploy: false };
  const contract = buildMakeConnectionContract(input);
  const scenarioId = normalizeTeamId(input.scenario_id);
  const blockers = [...(contract.blockers || [])];
  if (!scenarioId) blockers.push({ code: 'MAKE_SCENARIO_ID_REQUIRED' });
  if (!hasScopes(contract.granted_scopes || [], RUN_SCOPES)) blockers.push({ code: 'MAKE_RUN_SCOPES_REQUIRED', required_scopes: [...RUN_SCOPES] });
  if (input.paid_provider_approved !== true) blockers.push({ code: 'PAID_PROVIDER_APPROVAL_REQUIRED', provider_id: 'make-core' });
  if (input.external_write_approved !== true) blockers.push({ code: 'EXTERNAL_WRITE_APPROVAL_REQUIRED', provider_id: 'make-core' });
  if (input.supervised_execution_approved !== true) blockers.push({ code: 'SUPERVISED_EXECUTION_APPROVAL_REQUIRED', provider_id: 'make-core' });
  if (input.staging_only !== true) blockers.push({ code: 'STAGING_ONLY_REQUIRED' });

  return {
    ok: true,
    schema: 'riosystems.make-scenario-run-plan.v1',
    provider_id: 'make-core',
    state: blockers.length === 0 ? 'RUN_PLAN_APPROVED_NOT_EXECUTED' : 'BLOCKED',
    blockers,
    request: blockers.length === 0 ? {
      method: 'POST',
      url: `${contract.api_base_url}/scenarios/${scenarioId}/run`,
      required_scopes: [...RUN_SCOPES],
      auth: { scheme: 'Token', token_ref: contract.token_ref }
    } : null,
    execute_http: false,
    external_write: true,
    automatic_extra_credit_purchase: false,
    production_deploy: false
  };
}

export function bakeryMullerMakeStagingSpec() {
  return {
    schema: 'riosystems.automation-scenario-spec.v1',
    project: 'Bäckerei Müller',
    name: 'RIOSYSTEMS STAGING - Bäckerei Müller Lead Intake',
    environment: 'staging',
    intent: 'accept_test_lead_normalize_qualify_and_return_structured_output',
    steps: [
      { id: 'input', type: 'webhook_input', data_class: 'synthetic_test_data' },
      { id: 'normalize', type: 'transform', depends_on: ['input'] },
      { id: 'qualify', type: 'condition', depends_on: ['normalize'] },
      { id: 'output', type: 'structured_output', depends_on: ['qualify'] }
    ],
    real_customer_data: false,
    downstream_crm_write: false,
    secrets_embedded: false,
    production_deploy: false
  };
}
