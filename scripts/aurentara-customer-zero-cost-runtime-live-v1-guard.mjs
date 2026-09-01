import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const requestPath = process.argv[2];
assert.ok(requestPath, 'ACTIVATION_REQUEST_PATH_REQUIRED');
const request = JSON.parse(await readFile(requestPath, 'utf8'));
const config = JSON.parse(await readFile('wrangler.customer-production.jsonc', 'utf8'));
const entry = await readFile('src/customer-product/customer-runtime-entry-v1.js', 'utf8');
const accountSurface = await readFile('src/customer-product/production-account-surface-v1.js', 'utf8');

assert.equal(request.mode, 'customer-production-runtime-zero-cost-activation');
assert.equal(request.worker_name, 'aurentara-customer-runtime');
assert.equal(request.customer_surface_mode, 'off');
assert.equal(request.real_customer_ai_processing, false);
assert.equal(request.real_customer_data, false);
assert.equal(request.paid_provider_calls, false);
assert.equal(request.variable_cost_ceiling_eur, 0);
assert.equal(request.public_domain_activation, false);
assert.equal(request.operator_control_plane_change, false);
assert.equal(request.existing_shared_worker_change, false);
assert.equal(request.synthetic_validation_only, true);

assert.equal(config.name, request.worker_name);
assert.equal(config.main, 'src/customer-product/customer-runtime-entry-v1.js');
assert.equal(config.workers_dev, true);
assert.equal(config.preview_urls, false);
assert.equal(config.keep_vars, true);
assert.equal(config.vars.AURENTARA_CUSTOMER_SURFACE_MODE, 'off');
assert.equal(config.vars.AURENTARA_CUSTOMER_DISTRIBUTED_RATE_ACTIVE, 'true');
assert.equal(config.vars.AURENTARA_CUSTOMER_OBSERVABILITY_ACTIVE, 'true');
assert.equal(config.vars.AURENTARA_CUSTOMER_OFFICIAL_RETRIEVAL_ACTIVE, 'true');
assert.equal(config.vars.AURENTARA_CUSTOMER_SUPABASE_PROJECT_REF, 'pqmbtfzjcdnihovvppjr');
assert.equal(config.vars.AURENTARA_OPERATOR_SUPABASE_PROJECT_REF, 'pgzayxpqiakuvibhonwh');
assert.notEqual(config.vars.AURENTARA_CUSTOMER_SUPABASE_PROJECT_REF, config.vars.AURENTARA_OPERATOR_SUPABASE_PROJECT_REF);
assert.ok(String(config.vars.AURENTARA_CUSTOMER_SUPABASE_URL).includes(config.vars.AURENTARA_CUSTOMER_SUPABASE_PROJECT_REF));
assert.ok(String(config.vars.AURENTARA_CUSTOMER_SUPABASE_PUBLISHABLE_KEY).startsWith('sb_publishable_'));

const durable = config.durable_objects?.bindings || [];
assert.ok(durable.some((item) => item.name === 'CUSTOMER_RATE_LIMITER' && item.class_name === 'AurentaraCustomerRateLimiter'));
assert.ok((config.migrations || []).some((item) => Array.isArray(item.new_sqlite_classes) && item.new_sqlite_classes.includes('AurentaraCustomerRateLimiter')));
assert.equal(config.d1_databases, undefined);
assert.equal(config.routes, undefined);

assert.doesNotMatch(entry, /operator-dashboard|operator-runtime|handleFactory|handleMcp|handleDiagnostics/);
assert.match(entry, /createCustomerLaunchShield/);
assert.match(entry, /enforceCustomerDistributedRateLimit/);
assert.match(entry, /createProductionCustomerAccountPrivacySurface/);
assert.match(accountSurface, /REAL_CUSTOMER_AI_PROCESSING_NOT_APPROVED/);
assert.match(accountSurface, /customer_data_sent_to_ai_provider:\s*false/);

console.log(JSON.stringify({
  suite: 'AURENTARA CUSTOMER ZERO COST RUNTIME LIVE V1 GUARD',
  status: 'PASS',
  worker_name: config.name,
  dedicated_customer_worker: true,
  operator_modules_imported: false,
  existing_shared_worker_change: false,
  customer_surface_mode: config.vars.AURENTARA_CUSTOMER_SURFACE_MODE,
  distributed_rate_configured: true,
  official_retrieval_configured: true,
  observability_configured: true,
  customer_operator_project_separation: true,
  real_customer_ai_processing: false,
  real_customer_data: false,
  paid_provider_calls: false,
  public_domain_activation: false,
  variable_cost_ceiling_eur: 0
}, null, 2));
