const clean = (value, max = 240) => String(value || '').trim().slice(0, max);
const clone = (value) => structuredClone(value ?? null);
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

const PROVIDER_ID = /^[a-z0-9][a-z0-9._-]{0,119}$/i;
const CAPABILITY_ID = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)+$/i;
const CREDENTIAL_REFERENCE = /^(?:secret|env|binding|vault):\/\/[a-z0-9][a-z0-9._:/-]*$/i;
const PROVIDER_KINDS = new Set(['ai_provider','crm','email','automation','cloud_platform','payments','analytics','storage','generic_api']);
const AUTOMATION_INTERFACES = new Set(['none','api','mcp','sdk','webhook']);
const OWNERSHIP_GRADES = ['unknown','restricted','exportable','owned'];
const DATA_CLASSES = new Set(['public','business','personal','sensitive']);

function normalizeList(values = [], max = 120) {
  return [...new Set((Array.isArray(values) ? values : []).map((value) => clean(value, max)).filter(Boolean))];
}

function normalizeEndpoint(value) {
  const endpoint = clean(value, 500);
  if (!endpoint) return { ok: true, endpoint: null, host: null };
  try {
    const parsed = new URL(endpoint);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password) return { ok: false, error: 'PROVIDER_HTTPS_ENDPOINT_REQUIRED' };
    return { ok: true, endpoint: parsed.toString(), host: parsed.host };
  } catch {
    return { ok: false, error: 'PROVIDER_ENDPOINT_INVALID' };
  }
}

function ownershipRank(value) {
  return OWNERSHIP_GRADES.indexOf(value);
}

function candidateBlockers(provider = {}) {
  const blockers = [];
  if (!PROVIDER_ID.test(provider.id || '')) blockers.push({ code: 'PROVIDER_ID_INVALID' });
  if (!CAPABILITY_ID.test(provider.capability || '')) blockers.push({ code: 'PROVIDER_CAPABILITY_INVALID' });
  if (!PROVIDER_KINDS.has(provider.kind)) blockers.push({ code: 'PROVIDER_KIND_UNSUPPORTED' });
  if (provider.enabled !== true) blockers.push({ code: 'PROVIDER_NOT_ENABLED' });
  if (!CREDENTIAL_REFERENCE.test(provider.credential_ref || '')) blockers.push({ code: 'CREDENTIAL_REFERENCE_REQUIRED' });
  if (provider.endpoint_error) blockers.push({ code: provider.endpoint_error });
  if (['api','webhook'].includes(provider.automation_interface) && !provider.endpoint) blockers.push({ code: 'PROVIDER_ENDPOINT_REQUIRED' });
  if (provider.endpoint_host && !(provider.allowed_hosts || []).includes(provider.endpoint_host)) blockers.push({ code: 'PROVIDER_HOST_NOT_ALLOWLISTED', host: provider.endpoint_host });
  if (!AUTOMATION_INTERFACES.has(provider.automation_interface)) blockers.push({ code: 'PROVIDER_AUTOMATION_INTERFACE_INVALID' });
  if (!OWNERSHIP_GRADES.includes(provider.ownership_grade)) blockers.push({ code: 'PROVIDER_OWNERSHIP_GRADE_INVALID' });
  if (!(Array.isArray(provider.allowed_data_classes)) || provider.allowed_data_classes.some((value) => !DATA_CLASSES.has(value))) blockers.push({ code: 'PROVIDER_DATA_CLASS_INVALID' });
  if (!Number.isFinite(provider.estimated_monthly_cost_eur) || provider.estimated_monthly_cost_eur < 0) blockers.push({ code: 'PROVIDER_MONTHLY_COST_INVALID' });
  if (!Number.isFinite(provider.estimated_cost_per_run_eur) || provider.estimated_cost_per_run_eur < 0) blockers.push({ code: 'PROVIDER_RUN_COST_INVALID' });
  return blockers;
}

export function defineRealProviderCandidate(input = {}) {
  const endpoint = normalizeEndpoint(input.endpoint);
  const provider = {
    schema: 'riosystems.real-provider-candidate.v2',
    id: clean(input.id, 120),
    capability: clean(input.capability, 120),
    kind: clean(input.kind || 'generic_api', 80),
    enabled: input.enabled === true,
    credential_ref: clean(input.credential_ref, 240) || null,
    endpoint: endpoint.ok ? endpoint.endpoint : clean(input.endpoint, 500) || null,
    endpoint_host: endpoint.ok ? endpoint.host : null,
    endpoint_error: endpoint.ok ? null : endpoint.error,
    allowed_hosts: normalizeList(input.allowed_hosts, 240),
    paid: input.paid === true,
    estimated_monthly_cost_eur: finite(input.estimated_monthly_cost_eur, Number.NaN),
    estimated_cost_per_run_eur: finite(input.estimated_cost_per_run_eur, Number.NaN),
    free_tier_confirmed: input.free_tier_confirmed === true,
    external: true,
    external_write: input.external_write === true,
    automation_interface: clean(input.automation_interface || 'none', 40).toLowerCase(),
    ownership_grade: clean(input.ownership_grade || 'unknown', 40).toLowerCase(),
    code_export_supported: input.code_export_supported === true,
    allowed_data_classes: normalizeList(input.allowed_data_classes, 40).map((value) => value.toLowerCase()),
    production: false
  };
  const blockers = candidateBlockers(provider);
  return blockers.length
    ? { ok: false, error: blockers[0].code, blockers, provider: clone(provider), production_deploy: false }
    : { ok: true, provider, production_deploy: false };
}

export function evaluateProviderEligibility(provider = {}, requirements = {}) {
  const blockers = candidateBlockers(provider);
  const maxMonthly = requirements.max_monthly_cost_eur;
  const maxPerRun = requirements.max_cost_per_run_eur;
  if (Number.isFinite(Number(maxMonthly)) && provider.estimated_monthly_cost_eur > Number(maxMonthly)) blockers.push({ code: 'PROVIDER_MONTHLY_BUDGET_EXCEEDED', estimated_eur: provider.estimated_monthly_cost_eur, maximum_eur: Number(maxMonthly) });
  if (Number.isFinite(Number(maxPerRun)) && provider.estimated_cost_per_run_eur > Number(maxPerRun)) blockers.push({ code: 'PROVIDER_RUN_BUDGET_EXCEEDED', estimated_eur: provider.estimated_cost_per_run_eur, maximum_eur: Number(maxPerRun) });
  if (requirements.free_tier_required === true && provider.free_tier_confirmed !== true) blockers.push({ code: 'PROVIDER_FREE_TIER_REQUIRED' });
  if (requirements.code_export_required === true && provider.code_export_supported !== true) blockers.push({ code: 'PROVIDER_CODE_EXPORT_REQUIRED' });
  const minimumOwnership = clean(requirements.minimum_ownership_grade, 40).toLowerCase();
  if (minimumOwnership && (!OWNERSHIP_GRADES.includes(minimumOwnership) || ownershipRank(provider.ownership_grade) < ownershipRank(minimumOwnership))) blockers.push({ code: 'PROVIDER_OWNERSHIP_GRADE_INSUFFICIENT', actual: provider.ownership_grade, required: minimumOwnership });
  const requiredDataClasses = normalizeList(requirements.data_classes, 40).map((value) => value.toLowerCase());
  for (const dataClass of requiredDataClasses) if (!(provider.allowed_data_classes || []).includes(dataClass)) blockers.push({ code: 'PROVIDER_DATA_CLASS_NOT_ALLOWED', data_class: dataClass });
  if (requirements.automation_required === true && provider.automation_interface === 'none') blockers.push({ code: 'PROVIDER_AUTOMATION_INTERFACE_REQUIRED' });
  return { ok: blockers.length === 0, eligible: blockers.length === 0, blockers, provider_id: provider.id || null, capability: provider.capability || null, production_deploy: false };
}

export function evaluateRealProviderBridge(provider = {}, context = {}) {
  const eligibility = evaluateProviderEligibility(provider, context.requirements || {});
  const blockers = [...eligibility.blockers];
  if (context.production === true || context.production_deploy === true) blockers.push({ code: 'PRODUCTION_NOT_AUTHORIZED' });
  if (context.execute === true) {
    if (context.provider_activation_approved !== true) blockers.push({ code: 'REAL_PROVIDER_ACTIVATION_APPROVAL_REQUIRED' });
    if (context.supervised_execution_approved !== true) blockers.push({ code: 'SUPERVISED_EXECUTION_APPROVAL_REQUIRED' });
    if (provider.paid === true && context.cost_approved !== true) blockers.push({ code: 'PAID_PROVIDER_REQUIRES_USER_APPROVAL' });
    if (provider.external_write === true && context.external_write_approved !== true) blockers.push({ code: 'EXTERNAL_WRITE_REQUIRES_USER_APPROVAL' });
  }
  const uniqueBlockers = blockers.filter((item, index, values) => values.findIndex((other) => other.code === item.code && other.data_class === item.data_class) === index);
  const approvedExecution = context.execute === true && uniqueBlockers.length === 0;
  return {
    ok: uniqueBlockers.length === 0,
    eligible: eligibility.eligible,
    stage: uniqueBlockers.length ? 'WAITING_FOR_PROVIDER_ACTIVATION' : context.execute === true ? 'REAL_PROVIDER_EXECUTION_READY' : 'REAL_PROVIDER_STAGING_READY',
    blockers: uniqueBlockers,
    user_action_required: uniqueBlockers.some((item) => ['CREDENTIAL_REFERENCE_REQUIRED','REAL_PROVIDER_ACTIVATION_APPROVAL_REQUIRED','SUPERVISED_EXECUTION_APPROVAL_REQUIRED','PAID_PROVIDER_REQUIRES_USER_APPROVAL','EXTERNAL_WRITE_REQUIRES_USER_APPROVAL'].includes(item.code)),
    execution_mode: context.execute === true ? 'supervised' : 'dry_run',
    execution_approval_requirements: {
      provider_activation: true,
      cost: provider.paid === true,
      external_write: provider.external_write === true,
      supervised_execution: true
    },
    external_side_effects_allowed: approvedExecution && (provider.external_write !== true || context.external_write_approved === true),
    production_deploy: false
  };
}

export function buildRealProviderIntegrationEntry(input = {}, options = {}) {
  const blockers = input?.schema?.startsWith('riosystems.real-provider-candidate.') ? candidateBlockers(input) : null;
  const defined = blockers ? { ok: blockers.length === 0, provider: clone(input), blockers } : defineRealProviderCandidate(input);
  if (!defined.ok) return { ok: false, error: defined.error || defined.blockers?.[0]?.code || 'REAL_PROVIDER_CANDIDATE_INVALID', blockers: defined.blockers || [], production_deploy: false };
  const provider = defined.provider;
  return {
    ok: true,
    entry: {
      id: provider.id,
      capability: provider.capability,
      kind: provider.kind,
      provider: provider.id,
      credential_ref: provider.credential_ref,
      endpoint: provider.endpoint,
      allowed_hosts: [...provider.allowed_hosts],
      enabled: provider.enabled,
      external_write: provider.external_write,
      paid: provider.paid,
      health: ['healthy','degraded','offline','unknown'].includes(options.health) ? options.health : 'unknown',
      runner: typeof options.runner === 'function' ? options.runner : null,
      real_provider: true,
      provider_candidate: clone(provider),
      production_deploy: false
    },
    production_deploy: false
  };
}

export function buildMockToRealTransition(mockProvider = {}, realProvider = {}, context = {}) {
  const gate = evaluateRealProviderBridge(realProvider, context);
  return {
    ok: gate.ok,
    schema: 'riosystems.mock-to-real-transition.v2',
    capability: realProvider.capability || mockProvider.capability || null,
    from_provider: mockProvider.id || null,
    to_provider: realProvider.id || null,
    gate,
    fallback_to_mock: context.allow_mock_fallback === true,
    automatic_cutover: false,
    production_deploy: false
  };
}

export function realProviderBridgeManifest() {
  return {
    version: 'riosystems.real-provider-bridge.v2',
    hard_eligibility_before_execution: true,
    credential_reference_only: true,
    https_and_host_allowlist_required: true,
    paid_provider_user_approval_required: true,
    external_write_user_approval_required: true,
    provider_activation_approval_required: true,
    supervised_execution_approval_required: true,
    dry_run_default: true,
    automatic_cutover: false,
    mock_fallback_requires_explicit_opt_in: true,
    production_deploy: false
  };
}
