import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { businessStagingWriteEvidence, isBusinessStagingWriteVerified } from '../src/business-staging-write-evidence.js';

const foundation = readFileSync('supabase/migrations/20260830014000_riosystems_staging_crm_foundation.sql', 'utf8');
const indexes = readFileSync('supabase/migrations/20260830014100_riosystems_staging_crm_fk_indexes.sql', 'utf8');

for (const table of ['customer_projects','contacts','leads','lead_events','provider_execution_refs','audit_log']) {
  assert.ok(foundation.includes(`create table public.${table}`), `missing table ${table}`);
  assert.ok(foundation.includes(`alter table public.${table} force row level security;`), `missing forced RLS for ${table}`);
}

assert.ok(foundation.includes('revoke all on public.customer_projects, public.contacts, public.leads, public.lead_events, public.provider_execution_refs, public.audit_log from anon;'));
assert.ok(foundation.includes('unique (project_id, idempotency_key)'));
assert.ok(foundation.includes('foreign key (project_id, contact_id)'));
assert.ok(foundation.includes('foreign key (project_id, lead_id)'));
assert.ok(foundation.includes("with check (id = public.riosystems_current_project_id() and environment = 'staging')"));
assert.ok(indexes.includes('leads_project_contact_idx'));
assert.ok(indexes.includes('provider_execution_refs_project_lead_idx'));

const evidence = businessStagingWriteEvidence();
assert.equal(isBusinessStagingWriteVerified(), true);
assert.equal(evidence.provider, 'supabase-free');
assert.equal(evidence.foundation.public_tables.length, 6);
assert.equal(evidence.verification.repeated_identical_lead_write_count, 1);
assert.equal(evidence.verification.project_a_visible_leads, 1);
assert.equal(evidence.verification.project_b_visible_foreign_leads, 0);
assert.equal(evidence.verification.rls_enabled, true);
assert.equal(evidence.verification.rls_forced, true);
assert.equal(evidence.verification.anon_lead_insert, false);
assert.equal(evidence.verification.security_advisor_lints, 0);
assert.equal(evidence.safety.synthetic_data_only, true);
assert.equal(evidence.safety.real_customer_data, false);
assert.equal(evidence.safety.secrets_embedded, false);
assert.equal(evidence.safety.production_deploy, false);
assert.equal(evidence.safety.variable_cost_eur, 0);

console.log('RIOSYSTEMS Supabase staging CRM foundation smoke: OK');
