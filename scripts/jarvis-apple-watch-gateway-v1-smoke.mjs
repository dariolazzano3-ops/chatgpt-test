import assert from 'node:assert/strict';
import { handleJarvisStandaloneWorkerV1 } from '../src/jarvis/standalone-worker-v1.js';

const authorize = async () => ({
  ok: true,
  email: 'owner@example.com',
  operator_id: 'jarvis-operator:owner@example.com',
  authentication: 'TEST'
});

function memoryStore() {
  const audit = [];
  return {
    durable: true,
    kind: 'watch-smoke',
    async loadMemory() { return []; },
    async upsertMemory() { return { ok: true }; },
    async appendAudit({ event }) { audit.push(event); return { ok: true }; },
    async readAudit() { return audit; }
  };
}

let providerCalls = 0;
const conversationProvider = {
  configured: true,
  provider: 'CLAUDE_BRIDGE_CONVERSATION',
  async generate() {
    providerCalls += 1;
    return {
      ok: true,
      answer: 'Die Apple Watch nutzt denselben privaten JARVIS-Pfad. Antworten werden für das kleine Display kompakt gehalten. Dieser dritte Satz wird nicht mehr ausgegeben.',
      external_effect: false
    };
  }
};

const options = {
  authorize,
  memory_store: memoryStore(),
  conversation_provider: conversationProvider
};

const capabilities = await handleJarvisStandaloneWorkerV1(
  new Request('https://jarvis.test/api/watch/capabilities'),
  {}, {}, options
);
assert.equal(capabilities.status, 200);
const capBody = await capabilities.json();
assert.equal(capBody.ok, true);
assert.equal(capBody.schema, 'aurentara.jarvis.apple-watch-gateway.v1');
assert.equal(capBody.private, true);
assert.equal(capBody.public_access, false);
assert.equal(capBody.same_private_runtime, true);
assert.equal(capBody.same_memory_namespace, true);
assert.equal(capBody.long_lived_bridge_secret_on_watch, false);

const response = await handleJarvisStandaloneWorkerV1(
  new Request('https://jarvis.test/api/watch/ask', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      utterance: 'Jarvis, was kannst du gerade?',
      locale: 'de-DE',
      source: 'SIRI_APP_INTENT'
    })
  }),
  {}, {}, options
);
assert.equal(response.status, 200);
assert.equal(response.headers.get('x-jarvis-watch-gateway'), 'v1');
assert.equal(response.headers.get('x-jarvis-watch-same-runtime'), 'true');

const body = await response.json();
assert.equal(body.ok, true);
assert.equal(body.schema, 'aurentara.jarvis.apple-watch-response.v1');
assert.equal(body.source, 'SIRI_APP_INTENT');
assert.equal(body.same_private_runtime, true);
assert.equal(body.same_memory_namespace, true);
assert.equal(body.external_effect, false);
assert.equal(body.audit_persisted, true);
assert.equal(body.server_audio_generated, false);
assert.ok(body.answer.length <= 320);
assert.equal(body.answer.includes('Dieser dritte Satz'), false);
assert.equal(providerCalls, 1);

const actionResponse = await handleJarvisStandaloneWorkerV1(
  new Request('https://jarvis.test/api/watch/ask', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      utterance: 'Erinnere mich morgen um 9 Uhr an den Termin.',
      locale: 'de-DE',
      source: 'WATCH_APP'
    })
  }),
  {}, {}, options
);
const actionBody = await actionResponse.json();
assert.equal(providerCalls, 1);
assert.equal(actionBody.same_private_runtime, true);
assert.equal(actionBody.external_effect, false);
assert.equal(actionBody.server_audio_generated, false);

console.log('JARVIS Apple Watch Gateway V1 smoke: PASS');
