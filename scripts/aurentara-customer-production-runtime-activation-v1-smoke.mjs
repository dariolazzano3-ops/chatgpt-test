import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { enforceCustomerDistributedRateLimit } from '../src/customer-product/customer-rate-limit-do-v1.js';

const config = JSON.parse(await fs.readFile(new URL('../wrangler.jsonc', import.meta.url), 'utf8'));
assert.equal(config.vars.AURENTARA_CUSTOMER_SURFACE_MODE, 'off');
assert.equal(config.vars.AURENTARA_CUSTOMER_DISTRIBUTED_RATE_ACTIVE, 'true');
assert.equal(config.vars.AURENTARA_CUSTOMER_SUPABASE_PROJECT_REF, 'pqmbtfzjcdnihovvppjr');
assert.equal(config.vars.AURENTARA_OPERATOR_SUPABASE_PROJECT_REF, 'pgzayxpqiakuvibhonwh');
assert.notEqual(config.vars.AURENTARA_CUSTOMER_SUPABASE_PROJECT_REF, config.vars.AURENTARA_OPERATOR_SUPABASE_PROJECT_REF);
assert.equal(config.durable_objects.bindings[0].name, 'CUSTOMER_RATE_LIMITER');
assert.equal(config.durable_objects.bindings[0].class_name, 'AurentaraCustomerRateLimiter');
assert.ok(config.migrations.some((m) => m.new_sqlite_classes?.includes('AurentaraCustomerRateLimiter')));

let called = 0;
let objectName = null;
const fakeBinding = {
  idFromName(name) { objectName = name; return `id:${name}`; },
  get() {
    return {
      async fetch() {
        called += 1;
        return new Response(JSON.stringify({ ok: true, limited: false, remaining: 12, retry_after_seconds: 0 }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        });
      }
    };
  }
};

const off = await enforceCustomerDistributedRateLimit(
  new Request('https://example.test/customer/api/chat', { headers: { 'cf-connecting-ip': '203.0.113.44' } }),
  { AURENTARA_CUSTOMER_SURFACE_MODE: 'off', AURENTARA_CUSTOMER_DISTRIBUTED_RATE_ACTIVE: 'true', CUSTOMER_RATE_LIMITER: fakeBinding }
);
assert.equal(off.ok, true);
assert.equal(off.skipped, true);
assert.equal(called, 0);

const controlled = await enforceCustomerDistributedRateLimit(
  new Request('https://example.test/customer/api/chat', { method: 'POST', headers: { 'cf-connecting-ip': '203.0.113.44' } }),
  { AURENTARA_CUSTOMER_SURFACE_MODE: 'controlled-prelaunch', AURENTARA_CUSTOMER_DISTRIBUTED_RATE_ACTIVE: 'true', CUSTOMER_RATE_LIMITER: fakeBinding }
);
assert.equal(controlled.ok, true);
assert.equal(controlled.skipped, false);
assert.equal(called, 1);
assert.ok(objectName.startsWith('customer_chat:'));
assert.equal(objectName.includes('203.0.113.44'), false);
assert.match(objectName, /^customer_chat:[a-f0-9]{64}$/);

const missing = await enforceCustomerDistributedRateLimit(
  new Request('https://example.test/customer/api/chat'),
  { AURENTARA_CUSTOMER_SURFACE_MODE: 'public', AURENTARA_CUSTOMER_DISTRIBUTED_RATE_ACTIVE: 'true' }
);
assert.equal(missing.ok, false);
assert.equal(missing.status, 503);
assert.equal(missing.error, 'CUSTOMER_RATE_LIMITER_BINDING_MISSING');

const limitedBinding = {
  idFromName(name) { return `id:${name}`; },
  get() {
    return {
      async fetch() {
        return new Response(JSON.stringify({ ok: false, limited: true, retry_after_seconds: 17 }), {
          status: 429,
          headers: { 'content-type': 'application/json' }
        });
      }
    };
  }
};
const limited = await enforceCustomerDistributedRateLimit(
  new Request('https://example.test/customer/api/chat', { method: 'POST' }),
  { AURENTARA_CUSTOMER_SURFACE_MODE: 'public', AURENTARA_CUSTOMER_DISTRIBUTED_RATE_ACTIVE: 'true', CUSTOMER_RATE_LIMITER: limitedBinding }
);
assert.equal(limited.ok, false);
assert.equal(limited.status, 429);
assert.equal(limited.retry_after_seconds, 17);

console.log(JSON.stringify({
  suite: 'AURENTARA CUSTOMER PRODUCTION RUNTIME ACTIVATION V1',
  status: 'PASS',
  customer_project_ref: config.vars.AURENTARA_CUSTOMER_SUPABASE_PROJECT_REF,
  operator_project_ref: config.vars.AURENTARA_OPERATOR_SUPABASE_PROJECT_REF,
  surface_mode: config.vars.AURENTARA_CUSTOMER_SURFACE_MODE,
  distributed_rate_binding: config.durable_objects.bindings[0].name,
  raw_client_ip_forwarded_to_object_name: false,
  variable_cost_eur: 0,
  real_customer_data: false,
  public_customer_traffic: false
}, null, 2));
