import { buildJarvisContextV1 } from './context-v1.js';
import { resolveJarvisIntentV1 } from './intent-v1.js';
import { evaluateJarvisActionGateV1 } from './action-gate-v1.js';
import { jarvisContractsManifestV1, normalizeJarvisPolicy } from './contracts-v1.js';

const clean = (value, max = 6000) => String(value ?? '').trim().slice(0, max);

export function handleJarvisRequestV1(input = {}, personalState = {}, options = {}) {
  const intent = resolveJarvisIntentV1(input);
  if (!intent.ok) return { ok: false, status: 'BLOCKED', error: intent.error };

  const policy = normalizeJarvisPolicy(options.policy || {});
  const context = buildJarvisContextV1({
    ...personalState,
    query: intent.raw_message,
    now: options.now || personalState.now
  }, {
    allow_sensitive_context: policy.allow_sensitive_context
  });

  const gate = evaluateJarvisActionGateV1({
    action: intent.action,
    policy,
    explicit_approval: options.explicit_approval === true
  });

  return {
    ok: gate.ok,
    schema: 'aurentara.jarvis.response.v1',
    status: gate.status,
    message: clean(intent.raw_message),
    intent,
    context,
    action_gate: gate,
    action_plan: {
      action: intent.action,
      domain: intent.domain,
      prepare_only: gate.execution_authorized !== true,
      execution_authorized: gate.execution_authorized === true,
      provider_binding: null,
      connector_binding: null
    },
    isolation: {
      personal_memory_namespace: 'jarvis.personal',
      hamyren_memory_access: false,
      hamyren_memory_write: false,
      automatic_data_flow_to_hamyren: false
    },
    safeguards: {
      financial_actions_enabled: false,
      production_actions_enabled: false,
      billing_actions_enabled: false,
      credential_actions_enabled: false
    }
  };
}

export function jarvisServiceManifestV1() {
  return {
    ...jarvisContractsManifestV1(),
    service: 'handleJarvisRequestV1',
    current_stage: 'FOUNDATION',
    live_connectors_bound: false,
    voice_bound: false,
    proactive_mode_bound: false
  };
}
