import assert from 'node:assert/strict';
import {
  buildJarvisConversationPromptV1,
  validateJarvisConversationBridgeV1
} from '../src/jarvis/conversation-provider-claude-bridge-v1.js';
import { handleJarvisStandaloneWorkerV1 } from '../src/jarvis/standalone-worker-v1.js';

const prompt = buildJarvisConversationPromptV1({
  message: 'Jarvis, wie ist mein Status?',
  intent: 'STATUS_REQUEST',
  action: 'READ_PERSONAL_CONTEXT',
  context: {
    projects: [{ name: 'JARVIS', status: 'active' }],
    memory_items: [{ subject: 'voice', value: 'enabled' }],
    owner_ref: 'must-not-leak',
    secret: 'must-not-leak'
  },
  runtime_summary: 'Private runtime active.'
});
assert.match(prompt, /Software copywriting task/);
assert.match(prompt, /ZERO tools/);
assert.doesNotMatch(prompt, /must-not-leak/);

const bridgeOk = {
  ok: true,
  mode: 'conversation',
  exit_code: 0,
  git_evidence: { head_unchanged: true },
  filesystem_evidence: {
    complete: true,
    unchanged: true,
    added_count: 0,
    removed_count: 0,
    changed_count: 0
  },
  tool_audit: {
    complete: true,
    compliant: true,
    tool_use_count: 0,
    result: 'Dein privater JARVIS-Conversation-Brain-Pfad ist aktiv.'
  }
};
assert.equal(validateJarvisConversationBridgeV1(bridgeOk).external_effect, false);
assert.throws(() => validateJarvisConversationBridgeV1({
  ...bridgeOk,
  tool_audit: { ...bridgeOk.tool_audit, tool_use_count: 1 }
}));
assert.throws(() => validateJarvisConversationBridgeV1({
  ...bridgeOk,
  filesystem_evidence: {
    ...bridgeOk.filesystem_evidence,
    unchanged: false,
    changed_count: 1
  }
}));
assert.throws(() => validateJarvisConversationBridgeV1({
  ...bridgeOk,
  tool_audit: { ...bridgeOk.tool_audit, result: 'Ich bin Claude Code und kein persönlicher Assistent namens Jarvis.' }
}));

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
    kind: 'test',
    async loadMemory() {
      return [{
        memory_id: 'm1',
        owner_ref: 'jarvis:operator:owner@example.com',
        kind: 'PROJECT',
        subject: 'JARVIS',
        value: 'Voice integration active',
        confidence: 1,
        sensitivity: 'normal',
        updated_at: '2026-09-19T12:00:00Z'
      }];
    },
    async upsertMemory() { return { ok: true }; },
    async appendAudit({ event }) { audit.push(event); return { ok: true }; },
    async readAudit() { return audit; }
  };
}

const env = {
  JARVIS_BRIDGE_URL: 'http://172.18.0.2:8788',
  JARVIS_BRIDGE_TOKEN: 'test-only',
  JARVIS_BRIDGE_PROJECT: 'chatgpt-test'
};

let bridgeCalls = 0;
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, init = {}) => {
  bridgeCalls += 1;
  assert.equal(url, 'http://172.18.0.2:8788/v1/run');
  const sent = JSON.parse(init.body);
  assert.equal(sent.mode, 'conversation');
  assert.match(sent.prompt, /ZERO tools/);
  assert.match(sent.prompt, /conversation_provider_invoked/);
  assert.doesNotMatch(sent.prompt, /Freie generative Antworten/);
  return {
    ok: true,
    status: 200,
    async json() { return bridgeOk; }
  };
};

try {
  const req = new Request('https://jarvis.test/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ message: 'Jarvis, wie ist mein aktueller Status?' })
  });
  const res = await handleJarvisStandaloneWorkerV1(req, env, {}, {
    authorize,
    memory_store: memoryStore()
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.equal(body.answer, bridgeOk.tool_audit.result);
  assert.equal(body.conversation_brain.ok, true);
  assert.equal(body.conversation_brain.provider, 'CLAUDE_BRIDGE_CONVERSATION');
  assert.equal(body.conversation_brain.external_effect, false);
  assert.equal(body.conversation_brain.fallback_used, false);
  assert.equal(bridgeCalls, 1);

  const actionReq = new Request('https://jarvis.test/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ message: 'Erinnere mich morgen an den Termin.' })
  });
  const actionRes = await handleJarvisStandaloneWorkerV1(actionReq, env, {}, {
    authorize,
    memory_store: memoryStore()
  });
  const actionBody = await actionRes.json();
  assert.equal(actionBody.conversation_brain, null);
  assert.equal(bridgeCalls, 1);
} finally {
  globalThis.fetch = originalFetch;
}

console.log('JARVIS Conversation Brain Live V1 smoke: PASS');
