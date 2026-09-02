import assert from 'node:assert/strict';
import { providerActivationInventory } from '../src/provider-activation-inventory.js';
import {
  quickMissionCostEstimate,
  deepMissionCostPreflight,
  evaluateMissionCostCeiling,
  selectCostAwareProvider,
  historicalEstimateRecord,
  calibrateEstimateFromHistory,
  missionCostPreflightManifest
} from '../src/mission-cost-preflight-v1.js';
import { runMissionCostPreflight, missionCostPreflightRunnerManifest } from '../src/mission-cost-preflight-runner-v1.js';
import { buildProviderEcosystemProjection } from '../src/operator-provider-preflight-v1.js';
import { operatorProviderPreflightSealManifest } from '../src/operator-provider-preflight-seal-v1.js';

const smallMission = {
  mission_text: 'Create a clear analytics baseline for a synthetic service business.',
  requested_outcomes: ['Analytics baseline'],
  known_constraints: ['synthetic only', 'no production'],
  selected_capabilities: [{ capability: 'analytics', factory: 'business' }],
  mission_type: 'ANALYTICS_BASELINE'
};

const complexMission = {
  mission_text: 'Build a synthetic multi-capability business system with website, CRM, automation, analytics and AI assistance integrations.',
  requested_outcomes: ['Website', 'CRM', 'Automation', 'Analytics', 'AI assistance'],
  known_constraints: ['synthetic only', 'no production', 'no paid activation'],
  selected_capabilities: [
    { capability: 'web_presence', factory: 'web', dependencies: [] },
    { capability: 'business_crm', factory: 'business', dependencies: ['web_presence'] },
    { capability: 'automation_followup', factory: 'automation', dependencies: ['business_crm'] },
    { capability: 'analytics', factory: 'business', dependencies: ['web_presence'] },
    { capability: 'ai_assistance', factory: 'ai', dependencies: ['business_crm'] }
  ],
  mission_type: 'CONNECTED_BUSINESS_SYSTEM'
};

// Provider Ecosystem catalog truth.
const inventory = providerActivationInventory();
const byId = new Map(inventory.providers.map((provider) => [provider.id, provider]));
const requiredCatalog = [
  ['framer-server-api', 'PRIMARY VISUAL DESIGN / EXPERIENCE'],
  ['base44', 'FULL-STACK APP / PORTAL SPECIALIST'],
  ['make-core', 'PRIMARY AUTOMATION'],
  ['activepieces-cloud-free', 'SECONDARY AUTOMATION'],
  ['n8n-client-owned', 'SPECIALIST / SELF-HOSTED AUTOMATION'],
  ['lovable-github', 'RAPID BUILD ACCELERATOR'],
  ['webflow-api', 'WEB SPECIALIST'],
  ['cloudflare-workers-free', 'DEPLOYMENT / EDGE / RUNTIME'],
  ['openai-api', 'PRIMARY QUALITY AI'],
  ['cloudflare-workers-ai-free', 'LOW-COST / STAGING AI'],
  ['supabase-free', 'PRIMARY BUSINESS BACKEND / CRM'],
  ['posthog-free', 'PRIMARY ANALYTICS']
];
for (const [id, role] of requiredCatalog) {
  assert.equal(byId.has(id), true, `catalog missing ${id}`);
  assert.equal(byId.get(id).role, role, `wrong role for ${id}`);
  assert.equal(byId.get(id).strategic_state, 'SELECTED');
  assert.equal(byId.get(id).availability, 'AVAILABLE');
}
for (const id of ['base44', 'activepieces-cloud-free', 'n8n-client-owned', 'lovable-github']) {
  assert.equal(byId.get(id).verification, 'NOT_CONNECTED');
  assert.equal(byId.get(id).runtime_eligible, false);
}
const webflowCatalog = byId.get('webflow-api');
assert.equal(webflowCatalog.verification, 'CONNECTION_VERIFIED_STAGING');
assert.equal(webflowCatalog.connection_state, 'CONNECTED_STAGING');
assert.equal(webflowCatalog.credential_state, 'PRESENT_VALID');
assert.equal(webflowCatalog.runtime_eligible, false);
assert.equal(webflowCatalog.routing_ready, false);
assert.equal(webflowCatalog.routing_scope, 'specialist_only');
assert.equal(webflowCatalog.staging_write_verified, false);
assert.equal(webflowCatalog.publish_verified, false);
assert.equal(webflowCatalog.production_eligible, false);
const framerCatalog = byId.get('framer-server-api');
assert.equal(framerCatalog.verification, 'CONNECTION_VERIFIED_STAGING');
assert.equal(framerCatalog.connection_state, 'CONNECTED_STAGING');
assert.equal(framerCatalog.credential_state, 'PRESENT_VALID');
assert.equal(framerCatalog.runtime_eligible, true);
assert.equal(framerCatalog.routing_scope, 'specialist_only');
assert.equal(framerCatalog.staging_write_verified, false);
assert.equal(framerCatalog.publish_verified, false);
assert.equal(framerCatalog.production_eligible, false);
assert.equal(framerCatalog.mutating_execution_approval_required, true);
assert.equal(inventory.strategic_selection_is_not_runtime_connection, true);

// A) Small known mission: quick estimate, no deep preflight required.
const quickA = quickMissionCostEstimate(smallMission);
assert.equal(quickA.mode, 'QUICK_ESTIMATE');
assert.equal(quickA.selected_route, 'BALANCED');
assert.equal(quickA.default_route, 'BALANCED');
assert.equal(quickA.deep_preflight_required, false);
assert.equal(quickA.calculation_latency_ms <= 5000, true);
assert.equal(quickA.paid_calls_performed, 0);
assert.equal(quickA.low_estimate_eur <= quickA.estimated_cost_eur, true);
assert.equal(quickA.estimated_cost_eur <= quickA.high_estimate_eur, true);
assert.equal(Array.isArray(quickA.expected_capabilities), true);
assert.equal(Array.isArray(quickA.expected_provider_classes), true);
assert.equal(Array.isArray(quickA.uncertainties), true);

// B) Complex mission: all three optimization routes and Balanced default.
const quickB = quickMissionCostEstimate(complexMission);
assert.equal(quickB.routes.economy.route, 'ECONOMY');
assert.equal(quickB.routes.balanced.route, 'BALANCED');
assert.equal(quickB.routes.premium.route, 'PREMIUM');
assert.equal(quickB.routes.economy.estimated_cost_eur < quickB.routes.balanced.estimated_cost_eur, true);
assert.equal(quickB.routes.balanced.estimated_cost_eur < quickB.routes.premium.estimated_cost_eur, true);
assert.equal(quickB.routes.economy.estimate_basis.quality_floor < quickB.routes.balanced.estimate_basis.quality_floor, true);
assert.equal(quickB.routes.balanced.estimate_basis.quality_floor < quickB.routes.premium.estimate_basis.quality_floor, true);

// C) Explicit Deep Preflight improves confidence and adds execution structure.
const deepC = deepMissionCostPreflight({ ...complexMission, route: 'BALANCED' });
assert.equal(deepC.mode, 'DEEP_PREFLIGHT');
assert.equal(deepC.confidence_score >= quickB.routes.balanced.confidence_score, true);
assert.equal(Boolean(deepC.provider_plan), true);
assert.equal(Array.isArray(deepC.expected_execution_structure.capability_graph), true);
assert.equal(deepC.expected_execution_structure.expected_runs >= 1, true);
assert.equal(deepC.paid_calls_performed, 0);

// Mandatory Deep only when safety/governance/system policy requires it.
const governedC = runMissionCostPreflight({ ...smallMission, governance_requires_deep_preflight: true });
assert.equal(governedC.mode, 'DEEP_PREFLIGHT');
assert.equal(governedC.automatically_triggered, true);
assert.equal(governedC.automatic_trigger_reason.includes('GOVERNANCE_POLICY'), true);
const normalC = runMissionCostPreflight(smallMission);
assert.equal(normalC.mode, 'QUICK_ESTIMATE');
assert.equal(normalC.automatically_triggered, false);

// D) Ceiling projected overrun pauses mission and reuses canonical approval record contract.
const ceilingD = evaluateMissionCostCeiling({
  customer_id: 'synthetic-customer',
  project_id: 'synthetic-project',
  mission_id: 'synthetic-mission-cost-overrun',
  actor_id: 'operator:test',
  actual_spend_eur: 2,
  projected_final_cost_eur: 9,
  approved_ceiling_eur: 6,
  reason: 'SYNTHETIC_ACCEPTANCE_D'
});
assert.equal(ceilingD.ok, false);
assert.equal(ceilingD.status, 'PAUSED_COST_OVERRUN');
assert.equal(ceilingD.mission_paused, true);
assert.equal(ceilingD.additional_required_budget_eur, 3);
assert.deepEqual(ceilingD.actions, ['CONTINUE_APPROVE', 'ALTERNATIVE_ROUTE', 'STOP']);
assert.equal(ceilingD.approval.approval_version, 'riosystems.approval.v1');
assert.equal(ceilingD.approval.approval_type, 'MISSION_COST_CEILING_OVERRUN');
assert.equal(ceilingD.approval.granted, false);
assert.equal(ceilingD.existing_approval_contract_reused, true);

// E) SELECTED but NOT_CONNECTED can never be an active routing candidate.
const routeE = selectCostAwareProvider({
  route: 'ECONOMY',
  capability: 'web.deploy',
  candidates: [
    { id: 'strategic-not-connected', capabilities: ['web.deploy'], verification: 'NOT_CONNECTED', runtime_eligible: false, quality_score: 0.99, reliability_score: 0.99, estimated_cost_eur: 0.01 },
    { id: 'connected-valid', capabilities: ['web.deploy'], verification: 'VERIFIED_STAGING', runtime_eligible: true, connected: true, quality_score: 0.82, reliability_score: 0.82, estimated_cost_eur: 0.3 }
  ]
});
assert.equal(routeE.ok, true);
assert.equal(routeE.selected.id, 'connected-valid');

const ecosystem = buildProviderEcosystemProjection();
for (const provider of ecosystem.provider_ecosystem.filter((item) => item.connection_state === 'NOT_CONNECTED')) {
  assert.equal(provider.active_runtime, false, `${provider.id} cannot be active while NOT_CONNECTED`);
}
const framerEcosystem = ecosystem.provider_ecosystem.find((item) => item.id === 'framer-server-api');
assert.ok(framerEcosystem);
assert.equal(framerEcosystem.connection_state, 'CONNECTED_STAGING');
assert.equal(framerEcosystem.verification, 'VERIFIED_STAGING');
assert.equal(framerEcosystem.active_runtime, true);
assert.equal(framerEcosystem.restrictions.includes('SPECIALIST_ONLY'), true);
assert.equal(framerEcosystem.restrictions.includes('MUTATING_EXECUTION_APPROVAL_REQUIRED'), true);
assert.equal(framerEcosystem.evidence.provider_writes, 0);
assert.equal(framerEcosystem.evidence.staging_write_verified, false);
assert.equal(framerEcosystem.evidence.publish_verified, false);
assert.equal(framerEcosystem.evidence.production_eligible, false);
assert.equal(framerEcosystem.secrets_exposed, false);
assert.equal(framerEcosystem.production_deploy, false);

// F) Cheapest provider may be selected when it satisfies quality/reliability/safety/governance.
const routeF = selectCostAwareProvider({
  route: 'ECONOMY',
  capability: 'ai.generate',
  candidates: [
    { id: 'cheap-valid', capabilities: ['ai.generate'], verification: 'VERIFIED_STAGING', connected: true, quality_score: 0.8, reliability_score: 0.8, safety_ok: true, governance_ok: true, estimated_cost_eur: 0.1 },
    { id: 'costly-valid', capabilities: ['ai.generate'], verification: 'VERIFIED_STAGING', connected: true, quality_score: 0.85, reliability_score: 0.85, safety_ok: true, governance_ok: true, estimated_cost_eur: 0.8 }
  ]
});
assert.equal(routeF.ok, true);
assert.equal(routeF.selected.id, 'cheap-valid');

// G) Cheapest provider is rejected when the route quality floor is not met.
const routeG = selectCostAwareProvider({
  route: 'BALANCED',
  capability: 'ai.generate',
  candidates: [
    { id: 'cheapest-low-quality', capabilities: ['ai.generate'], verification: 'VERIFIED_STAGING', connected: true, quality_score: 0.5, reliability_score: 0.95, safety_ok: true, governance_ok: true, estimated_cost_eur: 0.01 },
    { id: 'valid-quality', capabilities: ['ai.generate'], verification: 'VERIFIED_STAGING', connected: true, quality_score: 0.9, reliability_score: 0.9, safety_ok: true, governance_ok: true, estimated_cost_eur: 0.4 }
  ]
});
assert.equal(routeG.ok, true);
assert.equal(routeG.selected.id, 'valid-quality');
assert.equal(routeG.cheapest_provider_not_forced, true);

// Historical calibration evidence, simple and inspectable, no ML.
const history = [
  historicalEstimateRecord({ mission_id: 'hist-1', mission_type: 'GENERAL', route: 'BALANCED', capability_mix: ['analytics'], estimated_cost: 4, actual_cost: 4.4, completed: true }),
  historicalEstimateRecord({ mission_id: 'hist-2', mission_type: 'GENERAL', route: 'BALANCED', capability_mix: ['analytics'], estimated_cost: 5, actual_cost: 5.5, completed: true })
];
for (const row of history) {
  assert.equal('estimated_cost' in row, true);
  assert.equal('actual_cost' in row, true);
  assert.equal('estimate_error' in row, true);
  assert.equal('mission_type' in row, true);
  assert.equal('route' in row, true);
  assert.equal(Array.isArray(row.capability_mix), true);
  assert.equal(row.machine_learning, false);
}
const calibration = calibrateEstimateFromHistory({ mission_type: 'GENERAL', route: 'BALANCED', capability_mix: ['analytics'] }, history);
assert.equal(calibration.calibration_applied, true);
assert.equal(calibration.comparable_samples, 2);
assert.equal(Math.abs(calibration.calibration_factor - 1.1) < 0.001, true);
assert.equal(calibration.machine_learning, false);

const manifest = missionCostPreflightManifest();
const runnerManifest = missionCostPreflightRunnerManifest();
const sealManifest = operatorProviderPreflightSealManifest();
for (const safety of [manifest, runnerManifest, sealManifest]) {
  assert.equal(safety.production_deploy, false);
  assert.equal(safety.external_writes, false);
  assert.equal(safety.real_customer_data, false);
  assert.equal(Number(safety.additional_variable_cost_eur || 0), 0);
}
assert.equal(manifest.paid_provider_activation, false);
assert.equal(sealManifest.paid_provider_activation, false);

console.log(`PROVIDER_PREFLIGHT_QUICK_LATENCY_MS=${quickA.calculation_latency_ms}`);
console.log(JSON.stringify({
  acceptance: { A: 'PASS', B: 'PASS', C: 'PASS', D: 'PASS', E: 'PASS', F: 'PASS', G: 'PASS' },
  quick_latency_ms: quickA.calculation_latency_ms,
  deep_confidence_score: deepC.confidence_score,
  balanced_confidence_score: quickB.routes.balanced.confidence_score,
  provider_catalog_count: inventory.providers.length,
  historical_calibration_factor: calibration.calibration_factor,
  framer_connected_staging: true,
  framer_write_verified: false,
  framer_publish_verified: false,
  webflow_connected_staging: true,
  webflow_write_verified: false,
  webflow_publish_verified: false,
  safety: { production: false, external_writes: false, paid_provider_activation: false, additional_variable_cost_eur: 0 }
}, null, 2));
