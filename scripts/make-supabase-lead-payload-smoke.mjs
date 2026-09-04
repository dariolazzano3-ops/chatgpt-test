import assert from 'node:assert/strict';
import { makeSupabaseSyntheticExecutionPayload } from '../src/make-supabase-lead-payload.js';

const legacy = makeSupabaseSyntheticExecutionPayload();
assert.equal(legacy.schema, 'riosystems.synthetic-lead-envelope.v1');
assert.equal(legacy.project_scope, 'bakery-muller:digital-system-v1');
assert.equal(legacy.contact.external_ref, 'bakery-muller-digital-system-v1-synthetic-contact-001');
assert.equal('email' in legacy.contact, false);
assert.equal('full_name' in legacy.contact, false);
assert.equal(legacy.lead.idempotency_key, 'bakery-muller-digital-system-v1-synthetic-lead-001');
assert.equal(legacy.synthetic, true);
assert.equal(legacy.pii_in_envelope, false);
assert.equal(legacy.real_customer_data, false);
assert.equal(legacy.production, false);

const mueller = makeSupabaseSyntheticExecutionPayload({
  customer_id: 'synthetic-mueller-elektrotechnik-saarbruecken',
  project_id: 'mueller-elektrotechnik-digital-customer-system-v1',
  project_uuid: 'b3f54cc8-4abf-4f9c-92c9-81a4ebcdd001'
});
assert.equal(mueller.project_scope, 'synthetic-mueller-elektrotechnik-saarbruecken:mueller-elektrotechnik-digital-customer-system-v1');
assert.match(mueller.contact.external_ref, /synthetic-contact-001$/);
assert.equal(JSON.stringify(mueller).includes('@'), false);
assert.equal(JSON.stringify(mueller).includes('phone'), false);
assert.equal(JSON.stringify(mueller).includes('message'), false);

console.log('RIOSYSTEMS project-scoped Make -> Supabase payload: OK');
