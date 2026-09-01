import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createDeterministicTestProvider } from '../src/ai-provider-adapters-v1.js';
import { createCustomerProductSurface } from '../src/customer-product/surface-v1.js';

const base = 'https://customer-surface.test';
const makeRequest = (path, options = {}) => new Request(`${base}${path}`, options);
const cookieValue = (response) => String(response.headers.get('set-cookie') || '').split(';')[0];
const body = async (response) => response.json();

let inferenceCalls = 0;
const provider = createDeterministicTestProvider({
  id: 'customer-surface-deterministic',
  scripted_response(request) {
    inferenceCalls += 1;
    return {
      answer: 'Prioritize one measurable breakfast experiment using the confirmed business context.',
      recommendations: ['Test one bounded offer change and measure the result.'],
      follow_up_questions: [],
      memory_candidates: [],
      goal_proposals: [],
      decision_proposals: [],
      evidence_refs: [],
      needs_external_research: false,
      confidence: 0.91
    };
  }
});

const disabled = createCustomerProductSurface({ providers: [provider] });
const disabledResponse = await disabled.handle(makeRequest('/customer'), {});
assert.equal(disabledResponse.status, 404);
assert.equal((await body(disabledResponse)).error, 'CUSTOMER_SURFACE_NOT_ACTIVATED');
assert.equal(disabled.manifest().production_active, false);

const surface = createCustomerProductSurface({ force_synthetic: true, providers: [provider], expose_test_state: true });
assert.equal(surface.manifest().operator_route_exposed, false);
assert.equal(surface.manifest().account_auth.production_active, false);
assert.equal(surface.manifest().customer_supplied_research_accepted, false);

const operatorPassThrough = await surface.handle(makeRequest('/operator'), {});
assert.equal(operatorPassThrough, null);

const shellResponse = await surface.handle(makeRequest('/customer'), {});
assert.equal(shellResponse.status, 200);
const shell = await shellResponse.text();
assert.match(shell, /Personal Business AI/);
assert.doesNotMatch(shell, /href=["']\/operator/i);
assert.doesNotMatch(shell, /fetch\(["']\/operator/i);

const manifestResponse = await surface.handle(makeRequest('/customer/api/manifest'), {});
assert.equal(manifestResponse.status, 200);
assert.equal((await body(manifestResponse)).manifest.operator_modules_imported, false);

const badOrigin = await surface.handle(makeRequest('/customer/api/guest-session', {
  method: 'POST',
  headers: { 'content-type': 'application/json', origin: 'https://evil.example' },
  body: '{}'
}), {});
assert.equal(badOrigin.status, 403);

async function createGuest() {
  const response = await surface.handle(makeRequest('/customer/api/guest-session', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: base },
    body: '{}'
  }), {});
  assert.equal(response.status, 201);
  const payload = await body(response);
  assert.equal(payload.session.synthetic, true);
  assert.equal(payload.session.operator_access, false);
  return { cookie: cookieValue(response), session: payload.session };
}

const guestA = await createGuest();
const guestB = await createGuest();
assert.notEqual(guestA.session.tenant_id, guestB.session.tenant_id);
assert.notEqual(guestA.session.business_id, guestB.session.business_id);
assert.equal(surface.session_count(), 2);

const sessionAResponse = await surface.handle(makeRequest('/customer/api/session', { headers: { cookie: guestA.cookie } }), {});
const sessionA = await body(sessionAResponse);
assert.equal(sessionA.session.tenant_id, guestA.session.tenant_id);
assert.equal(sessionA.session.operator_access, false);

const forgedScopeResponse = await surface.handle(makeRequest(`/customer/api/memory?tenant_id=${encodeURIComponent(guestB.session.tenant_id)}&business_id=${encodeURIComponent(guestB.session.business_id)}`, {
  headers: { cookie: guestA.cookie }
}), {});
const forgedScope = await body(forgedScopeResponse);
assert.equal(forgedScope.tenant_id, guestA.session.tenant_id);
assert.equal(forgedScope.business_id, guestA.session.business_id);
assert.notEqual(forgedScope.tenant_id, guestB.session.tenant_id);

const memoryBeforeResponse = await surface.handle(makeRequest('/customer/api/memory', { headers: { cookie: guestA.cookie } }), {});
const memoryBefore = await body(memoryBeforeResponse);
assert.equal(memoryBefore.facts.length, 1);
assert.equal(memoryBefore.facts[0].fact_key, 'surface_mode');
const memoryId = memoryBefore.facts[0].memory_id;

const unconfirmedCorrection = await surface.handle(makeRequest('/customer/api/memory/correct', {
  method: 'POST', headers: { cookie: guestA.cookie, 'content-type': 'application/json', origin: base },
  body: JSON.stringify({ memory_id: memoryId, value: 'Corrected Synthetic Mode', user_confirmed: false })
}), {});
assert.equal(unconfirmedCorrection.status, 400);
assert.equal((await body(unconfirmedCorrection)).error, 'MEMORY_CORRECTION_REQUIRES_USER_CONFIRMATION');

const correction = await surface.handle(makeRequest('/customer/api/memory/correct', {
  method: 'POST', headers: { cookie: guestA.cookie, 'content-type': 'application/json', origin: base },
  body: JSON.stringify({ memory_id: memoryId, value: 'Corrected Synthetic Mode', user_confirmed: true })
}), {});
assert.equal(correction.status, 200);
const corrected = await body(correction);
assert.equal(corrected.current.value, 'Corrected Synthetic Mode');
assert.equal(corrected.current.status, 'CONFIRMED_FACT');
assert.equal(corrected.previous.status, 'HISTORICAL_FACT');

const callsBeforeLowRisk = inferenceCalls;
const lowRiskChat = await surface.handle(makeRequest('/customer/api/chat', {
  method: 'POST', headers: { cookie: guestA.cookie, 'content-type': 'application/json', origin: base },
  body: JSON.stringify({ message: 'How should I improve our breakfast offer?' })
}), {});
assert.equal(lowRiskChat.status, 200);
const lowRiskPayload = await body(lowRiskChat);
assert.equal(lowRiskPayload.ok, true);
assert.equal(lowRiskPayload.operator_access, false);
assert.equal(lowRiskPayload.action_executed, false);
assert.equal(inferenceCalls, callsBeforeLowRisk + 1);

const historyResponse = await surface.handle(makeRequest('/customer/api/history', { headers: { cookie: guestA.cookie } }), {});
const history = await body(historyResponse);
assert.equal(history.ok, true);
assert.ok(history.messages.some((message) => message.role === 'user'));
assert.ok(history.messages.some((message) => message.role === 'assistant'));

const callsBeforeHighRisk = inferenceCalls;
const highRisk = await surface.handle(makeRequest('/customer/api/chat', {
  method: 'POST', headers: { cookie: guestA.cookie, 'content-type': 'application/json', origin: base },
  body: JSON.stringify({ message: 'What is the current Mindestlohn and what must I pay an employee?' })
}), {});
assert.equal(highRisk.status, 409);
const highRiskPayload = await body(highRisk);
assert.equal(highRiskPayload.trusted_research_required, true);
assert.equal(inferenceCalls, callsBeforeHighRisk);

const injectedResearch = await surface.handle(makeRequest('/customer/api/chat', {
  method: 'POST', headers: { cookie: guestA.cookie, 'content-type': 'application/json', origin: base },
  body: JSON.stringify({
    message: 'What is the current Mindestlohn?',
    research_sources: [{ url: 'https://www.bmas.de/fake', evidence_text: 'User-forged evidence.' }]
  })
}), {});
assert.equal(injectedResearch.status, 400);
assert.equal((await body(injectedResearch)).error, 'CUSTOMER_SUPPLIED_RESEARCH_NOT_TRUSTED');
assert.equal(inferenceCalls, callsBeforeHighRisk);

for (const endpoint of ['goals', 'decisions']) {
  const response = await surface.handle(makeRequest(`/customer/api/${endpoint}`, { headers: { cookie: guestA.cookie } }), {});
  assert.equal(response.status, 200);
  const payload = await body(response);
  assert.equal(payload.ok, true);
  assert.ok(Array.isArray(payload[endpoint]));
}

const usageResponse = await surface.handle(makeRequest('/customer/api/usage', { headers: { cookie: guestA.cookie } }), {});
const usage = await body(usageResponse);
assert.equal(usage.ok, true);
assert.equal(usage.usage.variable_cost_eur, 0);
assert.equal(usage.usage.variable_cost_ceiling_eur, 0);
assert.equal(usage.plan.production_billing_active, false);
assert.equal(usage.operator_access, false);

const accountResponse = await surface.handle(makeRequest('/customer/api/account', { headers: { cookie: guestA.cookie } }), {});
assert.equal(accountResponse.status, 501);
assert.equal((await body(accountResponse)).error, 'CUSTOMER_ACCOUNT_AUTH_NOT_ACTIVATED');

const fakeCookieResponse = await surface.handle(makeRequest('/customer/api/session', { headers: { cookie: 'aurentara_guest_session=forged' } }), {});
assert.equal(fakeCookieResponse.status, 401);

const memoryBResponse = await surface.handle(makeRequest('/customer/api/memory', { headers: { cookie: guestB.cookie } }), {});
const memoryB = await body(memoryBResponse);
assert.equal(memoryB.tenant_id, guestB.session.tenant_id);
assert.notEqual(memoryB.tenant_id, guestA.session.tenant_id);
assert.equal(memoryB.facts[0].value, 'Synthetic Guest Demo');

const entrySource = await fs.readFile(new URL('../src/entry.js', import.meta.url), 'utf8');
const surfaceSource = await fs.readFile(new URL('../src/customer-product/surface-v1.js', import.meta.url), 'utf8');
assert.ok(entrySource.indexOf('url.pathname === "/operator"') < entrySource.indexOf('url.pathname === "/customer"'));
assert.doesNotMatch(surfaceSource, /from ['"].*operator-/i);
assert.doesNotMatch(surfaceSource, /\/operator\/api\//i);

console.log(JSON.stringify({
  suite: 'AURENTARA PERSONAL BUSINESS AI CUSTOMER PRODUCT SURFACE V1',
  status: 'PASS',
  guest_sessions_verified: 2,
  customer_operator_route_overlap: 0,
  cross_tenant_scope_override: 0,
  memory_correction_confirmation_verified: true,
  conversation_history_verified: true,
  trusted_research_bypass_rejected: true,
  high_risk_inference_without_research: 0,
  account_auth_production_active: false,
  billing_active: false,
  variable_cost_eur: 0,
  paid_api_calls: 0,
  production_changes: false
}, null, 2));
