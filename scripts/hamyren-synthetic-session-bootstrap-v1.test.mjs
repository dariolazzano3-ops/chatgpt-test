import assert from 'node:assert/strict';
import test from 'node:test';
import { createDeterministicTestProvider } from '../src/ai-provider-adapters-v1.js';
import { createCustomerLaunchShield } from '../src/customer-product/prelaunch-security-privacy-v1.js';
import { handleSyntheticSessionBootstrap, syntheticSessionBootstrapManifest } from '../src/customer-product/synthetic-session-bootstrap-v1.js';

const base = 'https://control.aurentarasystems.com';
const env = {
  AURENTARA_CUSTOMER_SURFACE_MODE: 'synthetic-staging',
  RIOSYSTEMS_ENVIRONMENT: 'staging',
  RIOSYSTEMS_PRODUCTION_DEPLOY: 'false',
  RIOSYSTEMS_EXTERNAL_WRITES: 'false'
};
const request = (path, options = {}) => new Request(`${base}${path}`, options);
const firstCookie = (response) => String(response.headers.get('set-cookie') || '').split(';')[0];

function makeShield(providers = []) {
  return createCustomerLaunchShield({ surface_options: { providers } });
}

async function through(shield, req, runtimeEnv = env) {
  return handleSyntheticSessionBootstrap({ launch_shield: shield, request: req, env: runtimeEnv });
}

test('synthetic guest cookie recovers across fresh worker surface and first answer consumes one trial question', async () => {
  let providerCalls = 0;
  const provider = createDeterministicTestProvider({
    id: 'hamyren-session-bootstrap-deterministic',
    scripted_response() {
      providerCalls += 1;
      return {
        answer: 'Synthetic HAMYREN processing completed.',
        recommendations: [],
        follow_up_questions: [],
        memory_candidates: [],
        goal_proposals: [],
        decision_proposals: [],
        evidence_refs: [],
        needs_external_research: false,
        confidence: 0.9
      };
    }
  });

  // Surface A represents the isolate that serves the browser bootstrap request.
  const surfaceA = makeShield([provider]);
  const created = await through(surfaceA, request('/customer/api/guest-session', {
    method: 'POST',
    headers: { origin: base, 'content-type': 'application/json' },
    body: '{}'
  }));
  assert.equal(created.status, 201);
  const staleCookie = firstCookie(created);
  assert.match(staleCookie, /^aurentara_guest_session=gst-/);

  // Surface B is deliberately fresh. Before this repair its local session Map did not know the cookie.
  const surfaceB = makeShield([provider]);
  const answered = await through(surfaceB, request('/customer/api/chat', {
    method: 'POST',
    headers: { origin: base, 'content-type': 'application/json', cookie: staleCookie },
    body: JSON.stringify({ message: 'How should I improve my synthetic breakfast offer?' })
  }));
  const answer = await answered.json();
  assert.equal(answered.status, 200);
  assert.equal(answer.ok, true);
  assert.equal(answer.answer, 'Synthetic HAMYREN processing completed.');
  assert.equal(answer.successful_free_questions, 1);
  assert.equal(answer.remaining_free_questions, 4);
  assert.equal(providerCalls, 1);
  assert.equal(answered.headers.get('x-aurentara-synthetic-session-bootstrap'), 'recovered');
  const recoveredCookie = firstCookie(answered);
  assert.match(recoveredCookie, /^aurentara_guest_session=gst-/);
  assert.notEqual(recoveredCookie, staleCookie);

  const session = await through(surfaceB, request('/customer/api/session', { headers: { cookie: recoveredCookie } }));
  const sessionPayload = await session.json();
  assert.equal(session.status, 200);
  assert.equal(sessionPayload.session.successful_free_questions, 1);
  assert.equal(sessionPayload.session.remaining_free_questions, 4);
});

test('no anonymous bypass and no public-mode recovery', async () => {
  const shield = makeShield([]);
  const anonymous = await through(shield, request('/customer/api/chat', {
    method: 'POST',
    headers: { origin: base, 'content-type': 'application/json' },
    body: JSON.stringify({ message: 'anonymous' })
  }));
  assert.equal(anonymous.status, 401);
  assert.equal((await anonymous.json()).error, 'CUSTOMER_SESSION_REQUIRED');

  const off = await through(shield, request('/customer/api/chat', {
    method: 'POST',
    headers: { origin: base, 'content-type': 'application/json', cookie: 'aurentara_guest_session=gst-stale' },
    body: JSON.stringify({ message: 'must stay off' })
  }), { ...env, AURENTARA_CUSTOMER_SURFACE_MODE: 'off' });
  assert.equal(off.status, 404);
  assert.equal((await off.json()).error, 'CUSTOMER_SURFACE_NOT_ACTIVATED');
});

test('after bootstrap, missing AI provider is surfaced as provider gate instead of session gate', async () => {
  const surfaceA = makeShield([]);
  const created = await through(surfaceA, request('/customer/api/guest-session', {
    method: 'POST',
    headers: { origin: base, 'content-type': 'application/json' },
    body: '{}'
  }));
  const staleCookie = firstCookie(created);

  const surfaceB = makeShield([]);
  const response = await through(surfaceB, request('/customer/api/chat', {
    method: 'POST',
    headers: { origin: base, 'content-type': 'application/json', cookie: staleCookie },
    body: JSON.stringify({ message: 'Reach the provider gate without a paid call.' })
  }));
  const payload = await response.json();
  assert.notEqual(payload.error, 'CUSTOMER_SESSION_REQUIRED');
  assert.equal(response.headers.get('x-aurentara-synthetic-session-bootstrap'), 'recovered');
  assert.equal(payload.remaining_free_questions, 5);
});

const manifest = syntheticSessionBootstrapManifest();
assert.equal(manifest.mode, 'synthetic-staging');
assert.equal(manifest.anonymous_bypass, false);
assert.equal(manifest.public_mode_supported, false);
assert.equal(manifest.billing_active, false);
assert.equal(manifest.real_customer_data_allowed, false);
assert.equal(manifest.paid_provider_required, false);
