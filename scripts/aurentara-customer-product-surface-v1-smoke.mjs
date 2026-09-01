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
assert.equal(surface.manifest().guest_session.free_business_question_limit, 5);
assert.equal(surface.manifest().guest_session.successful_answers_only_count, true);
assert.equal(surface.manifest().guest_session.separate_from_entitlement_compute_budget, true);

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
  assert.equal(payload.session.free_question_limit, 5);
  assert.equal(payload.session.successful_free_questions, 0);
  assert.equal(payload.session.remaining_free_questions, 5);
  assert.equal(payload.session.next_step, 'ASK_BUSINESS_QUESTION');
  return { cookie: cookieValue(response), session: payload.session };
}

async function ask(cookie, message) {
  const response = await surface.handle(makeRequest('/customer/api/chat', {
    method: 'POST', headers: { cookie, 'content-type': 'application/json', origin: base },
    body: JSON.stringify({ message })
  }), {});
  return { response, payload: await body(response) };
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
assert.equal(sessionA.session.remaining_free_questions, 5);

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

// A + B: guest starts at five, first successful answer consumes exactly one.
const callsBeforeLowRisk = inferenceCalls;
const lowRisk = await ask(guestA.cookie, 'How should I improve our breakfast offer?');
assert.equal(lowRisk.response.status, 200);
assert.equal(lowRisk.payload.ok, true);
assert.equal(lowRisk.payload.remaining_free_questions, 4);
assert.equal(lowRisk.payload.successful_free_questions, 1);
assert.equal(lowRisk.payload.next_step, 'ASK_BUSINESS_QUESTION');
assert.equal(lowRisk.payload.operator_access, false);
assert.equal(lowRisk.payload.action_executed, false);
assert.equal(inferenceCalls, callsBeforeLowRisk + 1);

const historyResponse = await surface.handle(makeRequest('/customer/api/history', { headers: { cookie: guestA.cookie } }), {});
const history = await body(historyResponse);
assert.equal(history.ok, true);
assert.ok(history.messages.some((message) => message.role === 'user'));
assert.ok(history.messages.some((message) => message.role === 'assistant'));

// F: a blocked/high-risk turn must not consume a free question or invoke inference.
const callsBeforeHighRisk = inferenceCalls;
const highRisk = await ask(guestA.cookie, 'What is the current Mindestlohn and what must I pay an employee?');
assert.equal(highRisk.response.status, 409);
assert.equal(highRisk.payload.trusted_research_required, true);
assert.equal(highRisk.payload.remaining_free_questions, 4);
assert.equal(highRisk.payload.successful_free_questions, 1);
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
const afterRejectedSession = await body(await surface.handle(makeRequest('/customer/api/session', { headers: { cookie: guestA.cookie } }), {}));
assert.equal(afterRejectedSession.session.remaining_free_questions, 4);

// C + D: four more successful answers finish the five-question trial; answer five is still delivered.
const expectedRemaining = [3, 2, 1, 0];
let fifthPayload = null;
for (let index = 0; index < expectedRemaining.length; index += 1) {
  const turn = await ask(guestA.cookie, `Synthetic successful business question ${index + 2}`);
  assert.equal(turn.response.status, 200);
  assert.equal(turn.payload.ok, true);
  assert.equal(turn.payload.remaining_free_questions, expectedRemaining[index]);
  assert.equal(turn.payload.successful_free_questions, index + 2);
  if (index === expectedRemaining.length - 1) fifthPayload = turn.payload;
}
assert.equal(fifthPayload.remaining_free_questions, 0);
assert.equal(fifthPayload.next_step, 'ACCOUNT_OR_PERSISTENT_CONTEXT_HANDOFF');
assert.equal(fifthPayload.account_handoff.route, '/customer/api/account');
assert.equal(fifthPayload.account_handoff.account_core, 'existing_customer_account_core');
assert.equal(fifthPayload.account_handoff.account_auth_active, false);
assert.equal(fifthPayload.account_handoff.automatic_account_creation, false);
assert.equal(fifthPayload.answer, 'Prioritize one measurable breakfast experiment using the confirmed business context.');

// E: question six is blocked before inference and before any compute reservation.
const callsBeforeSixth = inferenceCalls;
const sixth = await ask(guestA.cookie, 'This should not become a sixth free turn.');
assert.equal(sixth.response.status, 409);
assert.equal(sixth.payload.error, 'HAMYREN_FREE_QUESTION_TRIAL_COMPLETE');
assert.equal(sixth.payload.remaining_free_questions, 0);
assert.equal(sixth.payload.next_step, 'ACCOUNT_OR_PERSISTENT_CONTEXT_HANDOFF');
assert.equal(inferenceCalls, callsBeforeSixth);

for (const endpoint of ['goals', 'decisions']) {
  const response = await surface.handle(makeRequest(`/customer/api/${endpoint}`, { headers: { cookie: guestA.cookie } }), {});
  assert.equal(response.status, 200);
  const payload = await body(response);
  assert.equal(payload.ok, true);
  assert.ok(Array.isArray(payload[endpoint]));
}

// G + H: trial is separate from the existing 20-unit Free Starter entitlement/fair-use ledger.
const entitlementResponse = await surface.handle(makeRequest('/customer/api/entitlement', { headers: { cookie: guestA.cookie } }), {});
const entitlement = await body(entitlementResponse);
assert.equal(entitlement.ok, true);
assert.equal(entitlement.plan.plan_id, 'free-starter-v1');
assert.equal(entitlement.plan.monthly_compute_units, 20);
assert.equal(entitlement.entitlement.source, 'default_free');

const usageResponse = await surface.handle(makeRequest('/customer/api/usage', { headers: { cookie: guestA.cookie } }), {});
const usage = await body(usageResponse);
assert.equal(usage.ok, true);
assert.equal(usage.trial.free_question_limit, 5);
assert.equal(usage.trial.successful_free_questions, 5);
assert.equal(usage.trial.remaining_free_questions, 0);
assert.equal(usage.usage.compute_unit_budget, 20);
assert.equal(usage.usage.spent_compute_units, 5);
assert.equal(usage.usage.remaining_compute_units, 15);
assert.equal(usage.usage.variable_cost_eur, 0);
assert.equal(usage.usage.variable_cost_ceiling_eur, 0);
assert.equal(usage.plan.plan_id, 'free-starter-v1');
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
const economicsSource = await fs.readFile(new URL('../src/customer-product/economics-v1.js', import.meta.url), 'utf8');
assert.ok(entrySource.indexOf('url.pathname === "/operator"') < entrySource.indexOf('url.pathname === "/customer"'));
assert.doesNotMatch(surfaceSource, /from ['"].*operator-/i);
assert.doesNotMatch(surfaceSource, /\/operator\/api\//i);
assert.match(surfaceSource, /HAMYREN_FREE_QUESTION_LIMIT_V1/);
assert.match(economicsSource, /monthly_compute_units:\s*20/);
assert.match(economicsSource, /plan_id:\s*'free-starter-v1'/);

console.log(JSON.stringify({
  suite: 'AURENTARA PERSONAL BUSINESS AI CUSTOMER PRODUCT SURFACE V1',
  status: 'PASS',
  guest_sessions_verified: 2,
  free_question_limit: 5,
  successful_free_questions_verified: 5,
  sixth_free_turn_blocked: true,
  failed_turn_consumed_free_question: false,
  free_starter_compute_units: 20,
  trial_entitlement_separation_verified: true,
  account_handoff_route: '/customer/api/account',
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
