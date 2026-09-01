import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  HAMYREN_PRODUCT_IDENTITY_V1,
  HAMYREN_CUSTOMER_DELETE_CONFIRMATION_V1,
  HAMYREN_LEGAL_REVIEW_ITEMS_V1,
  evaluateHamyrenLegalPrivacyTechnicalReadiness,
  hamyrenTrustSurfaceCopyV1
} from '../src/customer-product/legal-privacy-readiness-v1.js';
import {
  handleProductionCustomerPrivacyRoute,
  productionPrivacySurfaceManifest
} from '../src/customer-product/production-privacy-surface-v1.js';

const liveState = JSON.parse(await readFile('evidence/aurentara/customer-production-live-state-v1.json', 'utf8'));
const readiness = evaluateHamyrenLegalPrivacyTechnicalReadiness({ live_state: liveState });
assert.equal(readiness.ok, true, JSON.stringify(readiness.failures));
assert.equal(readiness.technical_readiness, true);
assert.equal(readiness.legal_acceptance_required, true);
assert.equal(readiness.legal_privacy_review_complete, false);
assert.equal(readiness.public_customer_surface_active, false);
assert.equal(readiness.real_customer_ai_processing_approved, false);
assert.equal(readiness.real_customer_data, false);
assert.equal(readiness.paid_provider_calls, 0);
assert.equal(readiness.variable_cost_eur, 0);
assert.deepEqual(readiness.product, {
  product_name: 'HAMYREN',
  descriptor: 'Your Personal Business AI',
  byline: 'by AURENTARA SYSTEMS'
});
assert.deepEqual(HAMYREN_PRODUCT_IDENTITY_V1, readiness.product);
assert.ok(HAMYREN_LEGAL_REVIEW_ITEMS_V1.length >= 10);
assert.ok(HAMYREN_LEGAL_REVIEW_ITEMS_V1.every((item) => item.status === 'REQUIRES_HUMAN_REVIEW'));

const trust = hamyrenTrustSurfaceCopyV1();
const trustText = JSON.stringify(trust);
assert.match(trustText, /HAMYREN/);
assert.match(trustText, /Your Personal Business AI/);
assert.match(trustText, /AURENTARA SYSTEMS/);
assert.doesNotMatch(trustText, /\/operator/i);
assert.doesNotMatch(trustText, /GDPR compliant|fully compliant|legally approved/i);
assert.match(trust.legal_status, /does not constitute legal approval/i);

const manifest = productionPrivacySurfaceManifest();
assert.equal(manifest.visible_product_name, 'HAMYREN');
assert.equal(manifest.customer_delete_confirmation_phrase, HAMYREN_CUSTOMER_DELETE_CONFIRMATION_V1);
assert.equal(manifest.internal_delete_confirmation_exposed, false);
assert.equal(manifest.account_delete_edge_function, 'aurentara-delete-account-v1');
assert.equal(manifest.service_role_in_worker, false);
assert.equal(manifest.user_jwt_and_rls, true);

const edgeCalls = [];
const fakeFetch = async (url, init = {}) => {
  edgeCalls.push({ url: String(url), method: init.method || 'GET', body: init.body || '' });
  if (String(url).endsWith('/functions/v1/aurentara-delete-account-v1')) {
    return Response.json({ ok: true, deleted: true, audit_id: 'synthetic-hamyren-delete-1' }, { status: 200 });
  }
  throw new Error(`Unexpected synthetic request: ${url}`);
};
const context = {
  config: { url: 'https://synthetic-customer.supabase.co', publishable_key: 'sb_publishable_synthetic' },
  access_token: 'synthetic-access-token',
  user: { id: 'synthetic-user-1' },
  fetch_impl: fakeFetch
};
const deletionRequest = (confirm) => new Request('https://customer.example/customer/api/account/delete', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ confirm })
});

const legacyVisiblePhrase = await handleProductionCustomerPrivacyRoute(deletionRequest('DELETE_MY_AURENTARA_DATA'), context);
assert.equal(legacyVisiblePhrase.response.status, 400);
const legacyBody = await legacyVisiblePhrase.response.json();
assert.equal(legacyBody.error, 'EXPLICIT_DELETION_CONFIRMATION_REQUIRED');
assert.equal(legacyBody.required_confirmation, 'DELETE_MY_HAMYREN_DATA');
assert.equal(edgeCalls.length, 0);

const hamyrenDelete = await handleProductionCustomerPrivacyRoute(deletionRequest('DELETE_MY_HAMYREN_DATA'), context);
assert.equal(hamyrenDelete.response.status, 200);
assert.equal(hamyrenDelete.clear_session, true);
assert.equal(edgeCalls.length, 1);
assert.equal(edgeCalls[0].method, 'POST');
assert.equal(JSON.parse(edgeCalls[0].body).confirm, 'DELETE_MY_AURENTARA_DATA');
const deleteResponseText = await hamyrenDelete.response.text();
assert.doesNotMatch(deleteResponseText, /DELETE_MY_AURENTARA_DATA/);

console.log(JSON.stringify({
  suite: 'HAMYREN LEGAL PRIVACY TECHNICAL READINESS V1',
  status: 'PASS',
  product_identity_verified: true,
  technical_privacy_readiness: true,
  human_legal_review_still_required: true,
  human_review_item_count: HAMYREN_LEGAL_REVIEW_ITEMS_V1.length,
  visible_delete_phrase: 'DELETE_MY_HAMYREN_DATA',
  stable_internal_edge_contract_reused: true,
  public_customer_surface_active: false,
  real_customer_ai_processing_approved: false,
  real_customer_data: false,
  paid_provider_calls: 0,
  variable_cost_eur: 0,
  production_changes: false
}, null, 2));
