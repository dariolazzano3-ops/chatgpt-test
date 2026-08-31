import { handleOperatorDashboard as handleFunctionalDashboard } from './operator-functional-completion-dashboard-v1.js';
import { providerActivationInventory } from './provider-activation-inventory.js';

const clone = (value) => structuredClone(value ?? null);
const clean = (value, max = 500) => String(value ?? '').trim().slice(0, max);
const upper = (value) => clean(value, 160).toUpperCase() || 'UNKNOWN';
const asArray = (value) => Array.isArray(value) ? value : [];
const COMPLETE_STATES = new Set(['COMPLETED','DONE','SUCCESS','DELIVERY_READY','SIMULATED_HANDOFF_READY','SYNTHETIC_STAGING_COMPLETED']);
const FAILURE_STATES = new Set(['FAILED','FAILURE','ERROR']);
const BLOCKED_STATES = new Set(['BLOCKED','BLOCK','LOCKED']);
const ACTIVE_STATES = new Set(['ACTIVE','RUNNING','QUEUED','WAITING','RETRYING']);
const AVAILABLE_PROVIDER_STATES = new Set(['AVAILABLE','STAGING_ONLY']);
const GATED_PROVIDER_STATES = new Set(['CREDENTIAL_REQUIRED','BUDGET_GATE','PERMISSION_GATE']);

function json(body, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff'
    }
  });
}

function timestampOf(item = {}) {
  return item.completed || item.completed_at || item.updated || item.updated_at || item.started || item.started_at || item.created || item.created_at || null;
}

function mergeProviders(baseProviders = []) {
  const map = new Map();
  const upsert = (name, patch = {}) => {
    const key = clean(name, 200);
    if (!key) return;
    const current = map.get(key) || {
      name: key,
      category: null,
      status: 'NOT_VERIFIED',
      environment: 'NOT_VERIFIED',
      credentials_state: 'NOT_VERIFIED',
      health: 'NOT_VERIFIED',
      cost_mode: 'NOT_VERIFIED',
      last_successful_call: null,
      last_failure: null,
      capabilities: [],
      current_restrictions: ['PRODUCTION_DISABLED'],
      credentials_exposed: false,
      production_deploy: false
    };
    map.set(key, {
      ...current,
      ...clone(patch),
      capabilities: [...new Set([...(current.capabilities || []), ...(patch.capabilities || [])])],
      current_restrictions: [...new Set([...(current.current_restrictions || []), ...(patch.current_restrictions || [])])]
    });
  };

  for (const item of asArray(baseProviders)) upsert(item.name, item);

  const inventory = providerActivationInventory();
  for (const provider of asArray(inventory.providers)) {
    upsert(provider.id, {
      category: asArray(provider.roles).join(', ') || 'provider_inventory',
      cost_mode: provider.cost_mode || 'NOT_VERIFIED',
      capabilities: provider.capabilities || [],
      inventory_registered: true,
      free_tier_confirmed: provider.free_tier_confirmed === true,
      credentials_required: provider.credentials_required === true,
      account_binding_required: provider.account_binding_required === true,
      external_write_capable: provider.external_write === true,
      inventory_verified_at: provider.verified_at || inventory.verified_at || null,
      pricing_reverification_required: inventory.pricing_must_be_reverified_before_activation === true,
      current_restrictions: ['PRODUCTION_DISABLED']
    });
  }

  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function buildMissionSummaryIndex(body = {}) {
  const rows = [];
  for (const row of asArray(body.universal)) rows.push({ kind: 'UNIVERSAL', row });
  for (const row of asArray(body.live_staging)) rows.push({ kind: 'LIVE_STAGING', row });
  for (const row of asArray(body.durable)) rows.push({ kind: 'DURABLE', row });
  return rows.filter(({ row }) => row?.mission_id);
}

function fallbackMission(kind, row = {}) {
  const status = upper(row.status || row.delivery_status || row.execution_state);
  return {
    mission_id: row.mission_id || null,
    project: row.business_name || row.project_id || row.scope_key || null,
    project_id: row.project_id || null,
    mission_type: kind,
    status,
    created: row.created_at || row.started_at || null,
    updated: row.updated_at || row.completed_at || null,
    estimated_cost_eur: row.estimated_variable_cost_eur ?? null,
    actual_cost_eur: row.variable_cost_eur ?? row.actual_cost_eur ?? null,
    approval_state: 'NOT_VERIFIED',
    execution_state: kind === 'LIVE_STAGING' ? status : 'NOT_VERIFIED',
    quality_state: row.quality_state ? upper(row.quality_state) : 'NOT_VERIFIED',
    quality_score: row.quality_score ?? null,
    delivery_state: row.delivery_status ? upper(row.delivery_status) : (kind === 'UNIVERSAL' ? status : 'NOT_VERIFIED'),
    mission_input: null,
    compiled_mission: null,
    plan: null,
    selected_capabilities: [],
    factories: [],
    providers: [],
    approval_requirements: [],
    execution: kind === 'LIVE_STAGING' && row.execution_id ? { execution_id: row.execution_id, status } : null,
    quality: null,
    deliverables: [],
    delivery: null,
    errors: ['MISSION_DETAIL_NOT_AVAILABLE'],
    evidence: null,
    reality: 'SUMMARY_ONLY_DETAIL_UNAVAILABLE',
    production_deploy: false
  };
}

function capabilityAvailability(capability = {}, factories = [], providers = []) {
  const factory = factories.find((item) => item.factory === capability.factory);
  const factoryState = upper(factory?.health || factory?.status);
  if (FAILURE_STATES.has(factoryState) || BLOCKED_STATES.has(factoryState)) return 'BLOCKED';

  const providerNames = [capability.provider_primary, capability.provider_fallback].filter(Boolean);
  const states = providerNames.map((name) => upper(providers.find((item) => item.name === name)?.status));
  if (states.some((state) => AVAILABLE_PROVIDER_STATES.has(state))) return 'ACTIVE';
  if (states.length && states.every((state) => state === 'UNAVAILABLE')) return 'UNAVAILABLE';
  if (states.some((state) => GATED_PROVIDER_STATES.has(state))) return 'BLOCKED';
  return 'UNKNOWN';
}

function buildFactoryTruth(baseFactories = {}, capabilities = {}, executions = [], providers = [], detailComplete = true) {
  const baseItems = asArray(baseFactories.items);
  const names = new Set([
    ...baseItems.map((item) => item.factory),
    ...asArray(capabilities.items).map((item) => item.factory),
    ...asArray(executions).map((item) => item.factory)
  ].filter(Boolean));

  return [...names].map((factoryName) => {
    const base = baseItems.find((item) => item.factory === factoryName) || {};
    const runs = asArray(executions).filter((item) => item.factory === factoryName);
    const completed = runs.filter((item) => COMPLETE_STATES.has(upper(item.state)));
    const failed = runs.filter((item) => FAILURE_STATES.has(upper(item.state)));
    const active = runs.filter((item) => ACTIVE_STATES.has(upper(item.state)));
    const terminal = completed.length + failed.length;
    const latest = runs.slice().sort((a, b) => String(timestampOf(b) || '').localeCompare(String(timestampOf(a) || '')))[0] || null;
    const lastFailed = failed.slice().sort((a, b) => String(timestampOf(b) || '').localeCompare(String(timestampOf(a) || '')))[0] || null;
    const caps = asArray(capabilities.items).filter((item) => item.factory === factoryName);
    const providerNames = [...new Set([
      ...caps.flatMap((item) => [item.provider_primary, item.provider_fallback]),
      ...runs.map((item) => item.provider),
      ...asArray(base.active_providers)
    ].filter(Boolean))];

    return {
      factory: factoryName,
      role: base.role || null,
      status: upper(base.status),
      health: upper(base.health || base.status),
      capabilities: caps.map((item) => item.capability),
      provider_availability: providerNames.map((name) => ({ name, status: upper(providers.find((item) => item.name === name)?.status) })),
      execution_count: runs.length,
      completed_runs: completed.length,
      failed_runs: failed.length,
      success_rate_percent: terminal ? Math.round((completed.length / terminal) * 10000) / 100 : null,
      last_execution: latest ? timestampOf(latest) : null,
      last_failed_execution: lastFailed ? timestampOf(lastFailed) : null,
      current_workload: detailComplete ? active.length : null,
      current_workload_state: detailComplete ? 'VERIFIED_FROM_EXECUTION_PROJECTION' : 'UNKNOWN',
      open_blockers: clone(base.open_blockers || []),
      source_execution_count: base.execution_count ?? null,
      quality_score: base.quality_score ?? null,
      ci_verification: base.ci_verification || 'NOT_VERIFIED',
      production_deploy: false
    };
  }).sort((a, b) => a.factory.localeCompare(b.factory));
}

function sealCapabilities(base = {}, factories = [], providers = []) {
  const items = asArray(base.items).map((item) => ({
    ...clone(item),
    registration_state: upper(item.status || 'REGISTERED'),
    availability_state: capabilityAvailability(item, factories, providers),
    provider_primary_state: upper(providers.find((provider) => provider.name === item.provider_primary)?.status),
    provider_fallback_state: item.provider_fallback ? upper(providers.find((provider) => provider.name === item.provider_fallback)?.status) : 'NOT_APPLICABLE',
    production_deploy: false
  }));
  return {
    ...clone(base),
    registration_state: upper(base.status || 'REGISTERED'),
    availability_summary: items.reduce((acc, item) => { acc[item.availability_state] = (acc[item.availability_state] || 0) + 1; return acc; }, {}),
    items,
    production_deploy: false
  };
}

export function buildFinalFunctionalSeal({ base_projection = {}, mission_list = {} } = {}) {
  const projection = clone(base_projection) || {};
  const summaryIndex = buildMissionSummaryIndex(mission_list);
  const known = new Set(asArray(projection.missions).map((item) => item.mission_id).filter(Boolean));
  const fallbacks = summaryIndex.filter(({ row }) => !known.has(row.mission_id)).map(({ kind, row }) => fallbackMission(kind, row));
  const missions = [...asArray(projection.missions), ...fallbacks].sort((a, b) => String(b.updated || b.created || '').localeCompare(String(a.updated || a.created || '')));
  const providers = mergeProviders(projection.providers);
  const detailComplete = fallbacks.length === 0;
  const factoryTruth = buildFactoryTruth(projection.factories, projection.capabilities, projection.executions, providers, detailComplete);
  const capabilities = sealCapabilities(projection.capabilities, factoryTruth, providers);
  const fallbackAlerts = fallbacks.map((mission) => ({
    key: `mission:${mission.mission_id}:detail-unavailable`,
    severity: 'UNKNOWN',
    what: `Mission detail unavailable: ${mission.mission_id}`,
    why: 'The canonical mission list contains this mission, but its detail projection could not be read.',
    impact: 'The mission remains visible, but lifecycle details cannot be claimed as verified.',
    next_action: 'Refresh Missions and inspect the mission detail API if the condition persists.',
    production_deploy: false
  }));
  const alerts = [...asArray(projection.alerts), ...fallbackAlerts];

  const failedMissions = missions.filter((item) => FAILURE_STATES.has(upper(item.status))).length;
  const blockedMissions = missions.filter((item) => BLOCKED_STATES.has(upper(item.status)) || BLOCKED_STATES.has(upper(item.quality_state))).length;
  const activeMissions = missions.filter((item) => ACTIVE_STATES.has(upper(item.status)) || ACTIVE_STATES.has(upper(item.execution_state))).length;
  const criticalAlerts = alerts.filter((item) => ['FAILED','BLOCKED'].includes(upper(item.severity))).length;
  let operatorState = upper(projection.summary?.operator_state);
  if (failedMissions) operatorState = 'FAILED';
  else if (blockedMissions || criticalAlerts) operatorState = 'BLOCKED';
  else if (upper(projection.summary?.operator_state) === 'ACTION_REQUIRED') operatorState = 'ACTION_REQUIRED';
  else if (fallbacks.length) operatorState = 'UNKNOWN';

  return {
    ...projection,
    schema: 'riosystems.operator-functional-v1-sealed',
    seal: {
      status: 'READY_FOR_FINAL_ACCEPTANCE',
      mission_detail_complete: detailComplete,
      mission_detail_fallback_count: fallbacks.length,
      factory_truth_projected: true,
      capability_registration_separated_from_availability: true,
      canonical_provider_inventory_included: true,
      production_deploy: false
    },
    summary: {
      ...(projection.summary || {}),
      operator_state: operatorState,
      active_missions: activeMissions,
      failed_missions: failedMissions,
      blocked_missions: blockedMissions,
      factory_count: factoryTruth.length,
      provider_counts: providers.reduce((acc, item) => { const state = upper(item.status); acc[state] = (acc[state] || 0) + 1; return acc; }, {}),
      critical_alerts: criticalAlerts
    },
    missions,
    factories: { ...(projection.factories || {}), items: factoryTruth, production_deploy: false },
    capabilities,
    providers,
    alerts,
    truth_rules: {
      ...(projection.truth_rules || {}),
      mission_summary_never_hidden_when_detail_missing: true,
      capability_registration_is_not_availability: true,
      unused_registered_providers_remain_visible: true,
      factory_zero_workload_requires_complete_execution_projection: true
    },
    safety: {
      ...(projection.safety || {}),
      production: 'OFF',
      external_writes: 'OFF',
      real_customer_data: 'NONE',
      additional_variable_cost_eur: 0
    },
    production_deploy: false
  };
}

async function callFunctional(request, env, ctx, options, path) {
  const url = new URL(request.url);
  url.pathname = `/operator/api${path}`;
  url.search = '';
  const probe = new Request(url.toString(), { method: 'GET', headers: request.headers });
  return handleFunctionalDashboard(probe, env, ctx, options);
}

const SEAL_SCRIPT = String.raw`<script>
(() => {
  if (window.__aurentaraFunctionalSealV1) return;
  window.__aurentaraFunctionalSealV1 = true;
  Object.assign(STATUS_MAP, { ACTIVE:['Active','ready'], UNAVAILABLE:['Unavailable','blocked'], NOT_APPLICABLE:['N/A','neutral'] });
  const previousRender = render;
  const rows = (value) => Array.isArray(value) ? value : [];
  const maybe = (value) => value === null || value === undefined ? 'UNKNOWN' : value;
  function renderSealedFactories() {
    const root=document.getElementById('factories'); if(!root) return;
    const items=rows(state.data.functional?.factories?.items);
    root.innerHTML='<div class="card"><div class="row"><div><h2>Factories</h2><div class="small">Health, capabilities, provider availability, workload and run evidence from existing Core projections.</div></div></div>'+
      (items.length?'<div class="table-wrap"><table class="table"><thead><tr><th>Factory</th><th>Health</th><th>Capabilities</th><th>Providers</th><th>Runs</th><th>Success</th><th>Failed</th><th>Workload</th><th>Last execution</th></tr></thead><tbody>'+items.map(x=>'<tr><td><strong>'+esc(x.factory)+'</strong><div class="small">'+esc(x.role||'')+'</div></td><td>'+badge(x.health)+'</td><td class="small">'+esc(rows(x.capabilities).join(', ')||'UNKNOWN')+'</td><td class="small">'+esc(rows(x.provider_availability).map(p=>p.name+': '+p.status).join(' · ')||'UNKNOWN')+'</td><td>'+esc(maybe(x.execution_count))+'</td><td>'+esc(x.success_rate_percent===null?'UNKNOWN':x.success_rate_percent+'%')+'</td><td>'+esc(maybe(x.failed_runs))+'</td><td>'+esc(x.current_workload===null?'UNKNOWN':x.current_workload)+'<div class="small">'+esc(x.current_workload_state)+'</div></td><td>'+esc(fmtDate(x.last_execution))+'</td></tr>').join('')+'</tbody></table></div>':'<div class="empty">No registered factories projected from Core.</div>')+'</div>';
  }
  function renderSealedCapabilities() {
    const root=document.getElementById('capabilities'); if(!root) return;
    const reg=state.data.functional?.capabilities||{}, items=rows(reg.items);
    root.innerHTML='<div class="card"><div class="row"><div><h2>Capability Registry</h2><div class="small">Registration and runtime availability are intentionally separate.</div></div>'+badge(reg.registration_state||'UNKNOWN')+'</div>'+
      (items.length?'<div class="table-wrap"><table class="table"><thead><tr><th>Capability</th><th>Factory</th><th>Registered</th><th>Availability</th><th>Primary Provider</th><th>Fallback</th><th>Requirements</th></tr></thead><tbody>'+items.map(x=>'<tr><td><strong>'+esc(x.capability)+'</strong><div class="small">'+esc(x.expected_deliverable||'')+'</div></td><td>'+esc(x.factory||'UNKNOWN')+'</td><td>'+badge(x.registration_state)+'</td><td>'+badge(x.availability_state)+'</td><td>'+esc(x.provider_primary||'UNKNOWN')+'<div>'+badge(x.provider_primary_state)+'</div></td><td>'+esc(x.provider_fallback||'NONE')+(x.provider_fallback?'<div>'+badge(x.provider_fallback_state)+'</div>':'')+'</td><td class="small">'+esc(rows(x.requirements).join(', ')||'None for synthetic route')+'</td></tr>').join('')+'</tbody></table></div>':'<div class="empty">Capability Registry could not be projected from Core.</div>')+'</div>';
  }
  render = function(id) { previousRender(id); if(id==='factories') renderSealedFactories(); if(id==='capabilities') renderSealedCapabilities(); };
})();
</script>`;

export async function handleOperatorDashboard(request, env = {}, ctx = {}, options = {}) {
  const url = new URL(request.url);
  if (request.method === 'GET' && url.pathname === '/operator/api/functional-completion') {
    const [baseResponse, missionResponse] = await Promise.all([
      callFunctional(request, env, ctx, options, '/functional-completion'),
      callFunctional(request, env, ctx, options, '/missions')
    ]);
    if (!baseResponse) return null;
    if (!baseResponse.ok) return baseResponse;
    const base = await baseResponse.clone().json().catch(() => ({}));
    const missionList = missionResponse?.ok ? await missionResponse.clone().json().catch(() => ({})) : {};
    return json(buildFinalFunctionalSeal({ base_projection: base, mission_list: missionList }));
  }

  const response = await handleFunctionalDashboard(request, env, ctx, options);
  if (!response) return null;
  const type = response.headers.get('content-type') || '';
  if (!(url.pathname === '/operator' || url.pathname === '/operator/') || response.status !== 200 || !type.includes('text/html')) return response;
  const source = await response.text();
  const body = source.includes('</body>') ? source.replace('</body>', `${SEAL_SCRIPT}</body>`) : `${source}${SEAL_SCRIPT}`;
  return new Response(body, { status: response.status, statusText: response.statusText, headers: response.headers });
}

export function operatorFunctionalSealManifest() {
  return {
    schema: 'riosystems.operator-functional-v1-seal.manifest',
    projection_only: true,
    existing_operator_control_reused: true,
    existing_mission_engine_reused: true,
    existing_capability_router_reused: true,
    existing_provider_inventory_reused: true,
    duplicate_core_engine: false,
    capability_registration_separate_from_availability: true,
    mission_summary_fail_closed: true,
    factory_truth_metrics: true,
    unsupported_actions_exposed: false,
    production_deploy: false,
    external_writes: false,
    real_customer_data: false,
    variable_cost_eur: 0
  };
}
