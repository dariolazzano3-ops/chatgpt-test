import assert from 'node:assert/strict';
import { makeSupabaseSyntheticExecutionPayload } from '../src/make-supabase-lead-payload.js';

const payload = makeSupabaseSyntheticExecutionPayload();
assert.equal(payload.schema, 'riosystems.synthetic-lead-envelope.v1');
assert.equal(payload.project_scope, 'bakery-muller:digital-system-v1');
assert.equal(payload.contact.external_ref, 'bakery-muller-digital-system-v1-synthetic-contact-001');
assert.equal(payload.contact.email, 'synthetic.lead@example.invalid');
assert.equal(payload.lead.idempotency_key, 'bakery-muller-digital-system-v1-synthetic-lead-001');
assert.equal(payload.synthetic, true);
assert.equal(payload.real_customer_data, false);
assert.equal(payload.production, false);
console.log('RIOSYSTEMS canonical Make -> Supabase payload: OK');
