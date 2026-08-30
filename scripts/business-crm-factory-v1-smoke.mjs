import assert from 'node:assert/strict';
import { businessCrmFactoryV1Manifest, buildBusinessCrmV1, runSyntheticCrmE2E } from '../src/business-crm-factory-v1.js';
import { createSupabaseCrmAdapter } from '../src/business-crm-adapter.js';
import { mapBusinessEventToPostHog } from '../src/business-crm-events.js';

const bakery = {
  project_id: 'bakery-muller-crm-v1',
  business: 'Bäckerei Müller',
  industry: 'bakery',
  country: 'DE',
  language: 'de',
  crm_requirements: ['website leads', 'follow-up tasks', 'sales timeline'],
  lead_sources: ['website', 'walk-in', 'referral'],
  sales_pipeline: {
    key: 'sales', name: 'Bakery Sales', stages: [
      { key: 'new', name: 'Neu', position: 0, allowed_next: ['qualified'] },
      { key: 'qualified', name: 'Qualifiziert', position: 1, allowed_next: ['proposal'] },
      { key: 'proposal', name: 'Angebot', position: 2, allowed_next: ['won', 'lost'] },
      { key: 'won', name: 'Gewonnen', position: 3, terminal: true, outcome: 'won' },
      { key: 'lost', name: 'Verloren', position: 4, terminal: true, outcome: 'lost' }
    ]
  },
  custom_fields: [{ key: 'event_type', entity: 'lead', type: 'select', options: ['catering', 'wedding', 'business'] }],
  analytics_requirements: ['lead funnel', 'source conversion']
};

const b2bAgency = {
  project_id: 'northstar-consulting-crm-v1',
  business: 'Northstar Consulting Synthetic',
  industry: 'b2b-consulting',
  country: 'DE',
  language: 'en',
  crm_requirements: ['account based sales', 'long sales cycle', 'deal tasks'],
  lead_sources: ['linkedin', 'partner', 'webinar'],
  sales_pipeline: {
    key: 'enterprise-sales', name: 'Enterprise Sales', stages: [
      { key: 'discovery', name: 'Discovery', position: 0, allowed_next: ['solution-fit'] },
      { key: 'solution-fit', name: 'Solution Fit', position: 1, allowed_next: ['commercial'] },
      { key: 'commercial', name: 'Commercial', position: 2, allowed_next: ['closed-won', 'closed-lost'] },
      { key: 'closed-won', name: 'Closed Won', position: 3, terminal: true, outcome: 'won' },
      { key: 'closed-lost', name: 'Closed Lost', position: 4, terminal: true, outcome: 'lost' }
    ]
  },
  custom_fields: [{ key: 'employee_band', entity: 'company', type: 'select', options: ['1-10', '11-50', '51-250', '250+'] }],
  analytics_requirements: ['pipeline velocity', 'source quality']
};

for (const reference of [bakery, b2bAgency]) {
  const blueprint = buildBusinessCrmV1(reference);
  assert.equal(blueprint.ok, true);
  assert.equal(blueprint.mission.objective, 'build_operational_crm');
  const run = await runSyntheticCrmE2E(reference);
  assert.equal(run.ok, true, JSON.stringify(run.qa));
  assert.equal(run.qa.status, 'PASSED');
  assert.equal(run.proof.idempotent_replay, true);
  assert.equal(run.proof.cross_project_rows, 0);
  assert.equal(run.proof.audit_count, 3);
  assert.ok(run.proof.custom_field_count >= 1);
  assert.equal(run.external_side_effects, false);
  assert.equal(run.estimated_variable_cost_eur, 0);
  assert.equal(run.delivery.status, 'READY');
}

const manifest = businessCrmFactoryV1Manifest();
assert.equal(manifest.production, false);
assert.equal(manifest.real_customer_data, false);
assert.equal(manifest.destructive_db_operations, false);
assert.equal(manifest.variable_cost_ceiling_eur, 0);

const blockedAdapter = createSupabaseCrmAdapter({ transport: async () => ({ ok: true }), production: false, real_customer_data: false, max_variable_cost_eur: 0 });
const deleteResult = await blockedAdapter.controlledDelete('leads', 'bakery-muller-crm-v1', 'synthetic-id');
assert.equal(deleteResult.ok, false);
assert.equal(deleteResult.error, 'CRM_DESTRUCTIVE_DELETE_DISABLED');
const scopeMismatch = await blockedAdapter.create('leads', 'project-a', { project_id: 'project-b' });
assert.equal(scopeMismatch.ok, false);
assert.equal(scopeMismatch.error, 'CRM_PROJECT_SCOPE_MISMATCH');

let captured = null;
const boundAdapter = createSupabaseCrmAdapter({
  transport: async (request) => { captured = request; return { ok: true, row: request.record || null }; },
  production: false,
  real_customer_data: false,
  max_variable_cost_eur: 0,
  project_id: 'safe-project',
  project_uuid: '11111111-1111-4111-8111-111111111111'
});
const boundCreate = await boundAdapter.create('leads', 'safe-project', { source: 'synthetic', status: 'new' });
assert.equal(boundCreate.ok, true);
assert.equal(captured.project_id, '11111111-1111-4111-8111-111111111111');
assert.equal(captured.record.project_id, '11111111-1111-4111-8111-111111111111');
const unbound = await blockedAdapter.query('leads', 'safe-project', {});
assert.equal(unbound.ok, false);
assert.equal(unbound.error, 'SUPABASE_CRM_PROJECT_BINDING_REQUIRED');

const piiMap = mapBusinessEventToPostHog({ schema: 'riosystems.business-event.v1', project_id: 'safe-project', type: 'lead_created', resource_type: 'lead', resource_id: 'x', metadata: { email: 'must-not-leak@example.invalid', source_campaign: 'synthetic' }, synthetic: true });
assert.equal(piiMap.ok, true);
assert.equal(Object.hasOwn(piiMap.mapping.properties, 'email'), false);
assert.equal(piiMap.mapping.contains_direct_pii, false);

console.log('business-crm-factory-v1-smoke: ok');
