const clean = (value, max = 8000) => String(value ?? '').trim().slice(0, max);

function safeContext(context = {}) {
  const out = {};
  for (const key of [
    'now', 'personal_facts', 'preferences', 'routines', 'goals',
    'commitments', 'projects', 'memory_items', 'transient_context', 'retrieval'
  ]) {
    if (context?.[key] !== undefined) out[key] = structuredClone(context[key]);
  }
  return out;
}

export function buildJarvisConversationPromptV1(input = {}) {
  const user = clean(input.message, 4000);
  if (!user) throw new Error('JARVIS_CONVERSATION_MESSAGE_REQUIRED');

  const contextJson = clean(JSON.stringify(safeContext(input.context || {})), 12000);
  const runtimeSummary = clean(input.runtime_summary, 3000);
  const action = clean(input.action, 120);
  const intent = clean(input.intent, 120);

  return [
    'JARVIS CONVERSATION BRAIN V1.',
    'Answer naturally and concisely in German unless the user clearly uses another language.',
    'Use only the supplied JARVIS context and runtime result. Never invent personal facts or action results.',
    'This call is reasoning-only. Use ZERO tools. Do not inspect or edit files. Do not perform external actions.',
    'If the runtime result says something is unavailable or blocked, preserve that limitation.',
    `INTENT=${intent}`,
    `ACTION=${action}`,
    `JARVIS_CONTEXT=${contextJson}`,
    `RUNTIME_RESULT=${runtimeSummary}`,
    `USER=${user}`
  ].join('\\n');
}

export function validateJarvisConversationBridgeV1(body = {}) {
  if (body.ok !== true || body.mode !== 'review') {
    throw new Error('JARVIS_CONVERSATION_BRIDGE_REJECTED');
  }

  const audit = body.tool_audit || {};
  const git = body.git_evidence || {};
  const fs = body.filesystem_evidence || {};

  if (audit.complete !== true || audit.compliant !== true) {
    throw new Error('JARVIS_CONVERSATION_AUDIT_FAILED');
  }
  if (Number(audit.tool_use_count || 0) !== 0) {
    throw new Error('JARVIS_CONVERSATION_TOOL_USE_FORBIDDEN');
  }
  if (git.head_unchanged !== true) {
    throw new Error('JARVIS_CONVERSATION_GIT_CHANGED');
  }
  if (fs.complete !== true || fs.unchanged !== true) {
    throw new Error('JARVIS_CONVERSATION_FILES_CHANGED');
  }
  if (
    Number(fs.added_count || 0) !== 0 ||
    Number(fs.removed_count || 0) !== 0 ||
    Number(fs.changed_count || 0) !== 0
  ) {
    throw new Error('JARVIS_CONVERSATION_FILES_CHANGED');
  }

  const answer = clean(audit.result, 12000);
  if (!answer) throw new Error('JARVIS_CONVERSATION_EMPTY_ANSWER');

  return {
    ok: true,
    answer,
    mode: 'review',
    external_effect: false,
    tool_use_count: 0,
    head_unchanged: true,
    filesystem_unchanged: true
  };
}

export function createJarvisClaudeConversationProviderV1(env = {}, options = {}) {
  const bridgeUrl = clean(options.bridge_url || env.JARVIS_BRIDGE_URL, 500).replace(/\/+$/, '');
  const bridgeToken = String(options.bridge_token || env.JARVIS_BRIDGE_TOKEN || '');
  const project = clean(options.project || env.JARVIS_BRIDGE_PROJECT, 200);
  const fetchImpl = options.fetch_impl || globalThis.fetch;
  const timeoutMs = Number(options.timeout_ms || env.JARVIS_BRIDGE_TIMEOUT_MS || 60000);
  const configured = Boolean(bridgeUrl && bridgeToken && project && typeof fetchImpl === 'function');

  return {
    configured,
    provider: 'CLAUDE_BRIDGE_REVIEW',
    async generate(input = {}) {
      if (!configured) {
        return { ok: false, error: 'JARVIS_CONVERSATION_PROVIDER_NOT_CONFIGURED' };
      }

      let response;
      try {
        response = await fetchImpl(`${bridgeUrl}/v1/run`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${bridgeToken}`
          },
          body: JSON.stringify({
            prompt: buildJarvisConversationPromptV1(input),
            project,
            mode: 'review'
          }),
          signal: AbortSignal.timeout(timeoutMs)
        });
      } catch (error) {
        return { ok: false, error: 'JARVIS_CONVERSATION_BRIDGE_UNREACHABLE' };
      }

      let body = null;
      try { body = await response.json(); } catch {}

      if (!response.ok) {
        return { ok: false, error: `JARVIS_CONVERSATION_BRIDGE_HTTP_${response.status}` };
      }

      try {
        return validateJarvisConversationBridgeV1(body);
      } catch (error) {
        return { ok: false, error: clean(error?.message || error, 200) };
      }
    }
  };
}
