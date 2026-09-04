import assert from 'node:assert/strict';
import { handleOperatorDashboard, operatorProviderPreflightSealManifest } from '../src/operator-provider-preflight-seal-v1.js';

const options = {
  authorize: async () => ({ ok: true, operator_id: 'operator:synthetic-preflight', email: 'synthetic@example.invalid' })
};

const get = (path) => new Request(`https://operator.test${path}`, { method: 'GET' });
const post = (path, body) => new Request(`https://operator.test${path}`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body)
});

const shell = await handleOperatorDashboard(get('/operator'), {}, {}, options);
assert.equal(shell.status, 200);
assert.equal(shell.headers.get('x-aurentara-provider-preflight-seal-v1'), 'enabled');
const html = await shell.text();
for (const marker of [
  'Kosten-Preflight',
  'MISSION STARTEN',
  'GENAUER KALKULIEREN',
  'ROUTENDETAILS',
  'Approved Cost Ceiling',
  'Provider Ecosystem',
  'Aktive Runtime-Routen',
  'Technischer Provider-Contract',
  'ECONOMY',
  'BALANCED',
  'PREMIUM'
]) assert.equal(html.includes(marker), true, `operator shell missing ${marker}`);
assert.equal(html.includes('0 Paid Calls'), true);
assert.equal(html.includes('Production aktivieren'), false);
assert.equal(html.includes('Active Runtime Routes'), false, 'Phase-5 human presentation uses the German primary label while preserving active_runtime_routes in the API contract');
assert.equal(html.includes('Einsatzbereit (Staging)'), true, 'staging executable readiness must not read as generic production readiness');

const providersResponse = await handleOperatorDashboard(get('/operator/api/provider-ecosystem'), {}, {}, options);
assert.equal(providersResponse.status, 200);
const providers = await providersResponse.json();
assert.equal(providers.strategic_selection_is_not_technical_connection, true);
assert.equal(providers.read_only_evidence_is_not_active_runtime, true);
for (const provider of providers.provider_ecosystem.filter((row) => row.connection_state === 'NOT_CONNECTED')) assert.equal(provider.active_runtime, false);
for (const provider of providers.active_runtime_routes) assert.equal(['CONNECTED_STAGING','READ_ONLY_VERIFIED'].includes(provider.connection_state), true);
assert.equal(providers.schema, 'aurentara.provider-ecosystem.v2');
for (const provider of providers.provider_ecosystem) {
  assert.deepEqual(Object.keys(provider.presentation_dimensions), [
    'registered','available','configured','connected','staging_verified','executable','production_capable'
  ]);
  assert.equal(provider.presentation_dimensions.registered, 'REGISTERED');
  assert.equal(['EINSATZBEREIT','STAGING_VERIFIZIERT','KONFIGURIERT_NICHT_VERIFIZIERT','NICHT_VERBUNDEN','BLOCKIERT'].includes(provider.presentation_group), true);
  if (provider.connection_state === 'NOT_CONNECTED') assert.notEqual(provider.presentation_group, 'EINSATZBEREIT');
  if (provider.presentation_group === 'EINSATZBEREIT') assert.equal(provider.presentation_dimensions.executable, 'VERIFIED_STAGING', 'Einsatzbereit is staging execution readiness only');
  if (provider.production_deploy === false) assert.notEqual(provider.presentation_dimensions.production_capable, 'VERIFIED', 'Production capability must not be invented from a disabled deployment state');
}
assert.deepEqual(Object.keys(providers.presentation_groups), [
  'einsatzbereit','staging_verifiziert','konfiguriert_nicht_verifiziert','nicht_verbunden','blockiert'
]);
const providerNames = new Set(providers.provider_ecosystem.map((row) => row.name));
for (const name of ['Framer', 'Base44', 'Make', 'Activepieces', 'n8n', 'Lovable', 'Webflow']) assert.equal(providerNames.has(name), true, `provider UI projection missing ${name}`);

const quickResponse = await handleOperatorDashboard(post('/operator/api/cost-preflight/quick', {
  mission_text: 'Prepare a synthetic analytics baseline.',
  selected_capabilities: [{ capability: 'analytics' }]
}), {}, {}, options);
assert.equal(quickResponse.status, 200);
const quick = await quickResponse.json();
assert.equal(quick.mode, 'QUICK_ESTIMATE');
assert.equal(quick.selected_route, 'BALANCED');
assert.equal(quick.automatically_triggered, false);
assert.equal(quick.calculation_latency_ms <= 5000, true);
assert.equal(quick.paid_calls_performed, 0);

const governedResponse = await handleOperatorDashboard(post('/operator/api/cost-preflight/quick', {
  mission_text: 'Prepare a synthetic analytics baseline requiring governance deep preflight.',
  selected_capabilities: [{ capability: 'analytics' }],
  governance_requires_deep_preflight: true
}), {}, {}, options);
assert.equal(governedResponse.status, 200);
const governed = await governedResponse.json();
assert.equal(governed.mode, 'DEEP_PREFLIGHT');
assert.equal(governed.automatically_triggered, true);
assert.equal(governed.automatic_trigger_reason.includes('GOVERNANCE_POLICY'), true);

const deepResponse = await handleOperatorDashboard(post('/operator/api/cost-preflight/deep', {
  mission_text: 'Build a synthetic connected business system.',
  selected_capabilities: [{ capability: 'web_presence' }, { capability: 'business_crm' }, { capability: 'automation_followup' }],
  route: 'PREMIUM'
}), {}, {}, options);
assert.equal(deepResponse.status, 200);
const deep = await deepResponse.json();
assert.equal(deep.mode, 'DEEP_PREFLIGHT');
assert.equal(deep.route, 'PREMIUM');
assert.equal(Boolean(deep.expected_execution_structure), true);
assert.equal(deep.paid_calls_performed, 0);

const ceilingResponse = await handleOperatorDashboard(post('/operator/api/cost-ceiling/evaluate', {
  customer_id: 'synthetic-customer',
  project_id: 'synthetic-project',
  actual_spend_eur: 1,
  projected_final_cost_eur: 7,
  approved_ceiling_eur: 5
}), {}, {}, options);
assert.equal(ceilingResponse.status, 200);
const ceiling = await ceilingResponse.json();
assert.equal(ceiling.status, 'PAUSED_COST_OVERRUN');
assert.equal(ceiling.mission_paused, true);
assert.equal(ceiling.additional_required_budget_eur, 2);
assert.equal(ceiling.approval.approval_version, 'riosystems.approval.v1');

const routingResponse = await handleOperatorDashboard(post('/operator/api/cost-routing/select', {
  route: 'BALANCED',
  capability: 'ai.generate',
  candidates: [
    { id: 'cheap-low-quality', capabilities: ['ai.generate'], verification: 'VERIFIED_STAGING', connected: true, quality_score: 0.5, reliability_score: 0.95, estimated_cost_eur: 0.01 },
    { id: 'valid', capabilities: ['ai.generate'], verification: 'VERIFIED_STAGING', connected: true, quality_score: 0.9, reliability_score: 0.9, estimated_cost_eur: 0.4 }
  ]
}), {}, {}, options);
assert.equal(routingResponse.status, 200);
const routing = await routingResponse.json();
assert.equal(routing.selected.id, 'valid');

const historyResponse = await handleOperatorDashboard(get('/operator/api/estimate-history'), {}, {}, options);
assert.equal(historyResponse.status, 200);
const history = await historyResponse.json();
assert.equal(history.schema, 'aurentara.mission-estimate-history.v1');
assert.equal(Array.isArray(history.items), true);
assert.equal(history.machine_learning, false);

const denied = await handleOperatorDashboard(get('/operator/api/provider-ecosystem'), {}, {}, { authorize: async () => ({ ok: false, status: 403, error: 'DENIED' }) });
assert.equal(denied.status, 403);

const manifest = operatorProviderPreflightSealManifest();
assert.equal(manifest.production_deploy, false);
assert.equal(manifest.external_writes, false);
assert.equal(manifest.real_customer_data, false);
assert.equal(manifest.paid_provider_activation, false);
assert.equal(manifest.additional_variable_cost_eur, 0);

console.log(JSON.stringify({
  operator_provider_preflight_smoke: 'PASS',
  catalog_dimensions_separated: true,
  provider_human_groups: true,
  quick_latency_ms: quick.calculation_latency_ms,
  governed_auto_deep: governed.automatically_triggered,
  provider_ecosystem_count: providers.provider_ecosystem.length,
  active_runtime_routes_count: providers.active_runtime_routes.length,
  safety: { production: false, external_writes: false, paid_provider_activation: false, real_customer_data: false, additional_variable_cost_eur: 0 }
}, null, 2));
