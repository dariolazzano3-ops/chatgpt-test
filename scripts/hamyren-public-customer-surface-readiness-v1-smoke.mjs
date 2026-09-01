import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { renderCustomerProductShell } from '../src/customer-product/shell-v1.js';
import { createProductionCustomerAccountSurface, productionAccountSurfaceManifest } from '../src/customer-product/production-account-surface-v1.js';
import { createCustomerLaunchShield, CUSTOMER_LAUNCH_MODES_V1 } from '../src/customer-product/prelaunch-security-privacy-v1.js';
import { evaluateHamyrenPublicSurfaceReadiness, hamyrenPublicSurfaceReadinessManifest } from '../src/customer-product/hamyren-public-surface-readiness-v1.js';

const manifest = hamyrenPublicSurfaceReadinessManifest();
assert.equal(manifest.product.product_name, 'HAMYREN');
assert.equal(manifest.product.tagline, 'Your Personal Business AI');
assert.equal(manifest.product.maker, 'AURENTARA SYSTEMS');
assert.equal(manifest.public_customer_traffic_active, false);
assert.equal(manifest.real_customer_ai_processing_active, false);

const syntheticShell = renderCustomerProductShell();
assert.match(syntheticShell, /HAMYREN/);
assert.match(syntheticShell, /Your Personal Business AI/);
assert.match(syntheticShell, /by AURENTARA SYSTEMS/);
assert.doesNotMatch(syntheticShell, /href=["']\/operator/i);
assert.doesNotMatch(syntheticShell, /fetch\(["']\/operator/i);

const accountManifest = productionAccountSurfaceManifest();
assert.equal(accountManifest.visible_product_name, 'HAMYREN');
assert.equal(accountManifest.visible_product_tagline, 'Your Personal Business AI');
assert.equal(accountManifest.visible_maker, 'AURENTARA SYSTEMS');
assert.equal(accountManifest.service_role_in_browser, false);
assert.equal(accountManifest.real_customer_ai_processing_active, false);
assert.equal(accountManifest.public_surface_active, false);

const projectRef = 'abcdefghijklmnopqrst';
const operatorRef = 'zyxwvutsrqponmlkjihg';
const env = {
  AURENTARA_CUSTOMER_SUPABASE_URL: `https://${projectRef}.supabase.co`,
  AURENTARA_CUSTOMER_SUPABASE_PROJECT_REF: projectRef,
  AURENTARA_OPERATOR_SUPABASE_PROJECT_REF: operatorRef,
  AURENTARA_CUSTOMER_SUPABASE_PUBLISHABLE_KEY: 'synthetic-publishable-key'
};
const fakeFetch = async (url) => {
  if (String(url).endsWith('/auth/v1/user')) {
    return new Response(JSON.stringify({ id: 'user-synthetic', email: 'synthetic@local.invalid' }), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  return new Response(JSON.stringify({}), { status: 200, headers: { 'content-type': 'application/json' } });
};
const productionSurface = createProductionCustomerAccountSurface({ fetch_impl: fakeFetch });
const accountResponse = await productionSurface.handle(new Request('https://hamyren.test/customer'), env);
assert.equal(accountResponse.status, 200);
const accountHtml = await accountResponse.text();
assert.match(accountHtml, /HAMYREN/);
assert.match(accountHtml, /Your Personal Business AI/);
assert.match(accountHtml, /by AURENTARA SYSTEMS/);
assert.doesNotMatch(accountHtml, /\/operator/);

const shield = createCustomerLaunchShield({ production_surface: productionSurface, production_runtime_active: true });
let response = await shield.handle(new Request('https://hamyren.test/customer'), { ...env, AURENTARA_CUSTOMER_SURFACE_MODE: CUSTOMER_LAUNCH_MODES_V1.OFF });
assert.equal(response.status, 404);
assert.equal((await response.json()).error, 'CUSTOMER_SURFACE_NOT_ACTIVATED');

response = await shield.handle(new Request('https://hamyren.test/customer'), { ...env, AURENTARA_CUSTOMER_SURFACE_MODE: CUSTOMER_LAUNCH_MODES_V1.PUBLIC });
assert.equal(response.status, 404);
assert.equal((await response.json()).error, 'CUSTOMER_PUBLIC_ACTIVATION_REQUIRED');

response = await shield.handle(new Request('https://hamyren.test/customer'), {
  ...env,
  AURENTARA_CUSTOMER_SURFACE_MODE: CUSTOMER_LAUNCH_MODES_V1.PUBLIC,
  AURENTARA_CUSTOMER_PUBLIC_ACTIVATION_APPROVED: 'true',
  AURENTARA_CUSTOMER_REAL_DATA_ALLOWED: 'false'
});
assert.equal(response.status, 503);
assert.equal((await response.json()).error, 'CUSTOMER_REAL_DATA_GATE_REQUIRED');

const readiness = evaluateHamyrenPublicSurfaceReadiness({ legal_privacy_technical_ready: true, operator_route_exposed: false });
assert.equal(readiness.ok, true, JSON.stringify(readiness.failures));
assert.equal(readiness.technical_public_surface_ready, true);
assert.equal(readiness.legal_privacy_technical_ready, true);
assert.equal(readiness.legal_privacy_review_complete, false);
assert.equal(readiness.public_customer_surface_active, false);
assert.equal(readiness.real_customer_ai_processing_active, false);
assert.deepEqual(readiness.required_operator_gates, ['legal_privacy_review', 'public_customer_surface', 'real_customer_ai_processing']);

const source = await fs.readFile(new URL('../src/customer-product/production-account-surface-v1.js', import.meta.url), 'utf8');
assert.match(source, /aurentara_customer_access/);
assert.match(source, /aurentara_customer_refresh/);
assert.match(source, /aurentara_customer_ai/);
assert.match(source, /REAL_CUSTOMER_AI_PROCESSING_NOT_APPROVED/);

console.log(JSON.stringify({
  suite: 'HAMYREN PUBLIC CUSTOMER SURFACE READINESS V1',
  status: 'PASS',
  visible_product: 'HAMYREN',
  visible_tagline: 'Your Personal Business AI',
  visible_maker: 'AURENTARA SYSTEMS',
  stable_internal_namespaces_preserved: true,
  technical_public_surface_ready: true,
  legal_privacy_review_complete: false,
  public_customer_surface_active: false,
  real_customer_ai_processing_active: false,
  real_customer_data: false,
  variable_cost_eur: 0
}, null, 2));
