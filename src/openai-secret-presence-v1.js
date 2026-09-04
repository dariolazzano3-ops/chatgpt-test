function json(value, status = 200) {
  return new Response(JSON.stringify(value, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff"
    }
  });
}

function isAuthorized(request, env = {}) {
  if (!env.API_TOKEN) return false;
  const authorization = request.headers.get("authorization") || "";
  return authorization === `Bearer ${env.API_TOKEN}`;
}

function clean(value, max = 180) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

async function probeOpenAiModels(apiKey) {
  try {
    const response = await fetch("https://api.openai.com/v1/models", {
      method: "GET",
      headers: {
        authorization: `Bearer ${apiKey}`,
        accept: "application/json",
        "user-agent": "aurentara-openai-connection-diagnostics/1.0"
      }
    });
    const text = await response.text();
    let body = null;
    try { body = text ? JSON.parse(text) : null; } catch {}
    return {
      ok: response.ok,
      reachable: true,
      status: response.status,
      model_count: response.ok && Array.isArray(body?.data) ? body.data.length : null,
      error_type: response.ok ? null : clean(body?.error?.type || body?.error?.code || `OPENAI_HTTP_${response.status}`),
      error_message: response.ok ? null : clean(body?.error?.message || `OPENAI_HTTP_${response.status}`)
    };
  } catch (error) {
    return {
      ok: false,
      reachable: false,
      status: null,
      model_count: null,
      error_type: "OPENAI_NETWORK_ERROR",
      error_message: clean(error?.message || "OPENAI_NETWORK_ERROR")
    };
  }
}

const OPERATOR_AI_INFERENCE_PROBE = Object.freeze({
  confirmation: "AURENTARA_OPERATOR_AI_INFERENCE_TEST_V1",
  expected_text: "AURENTARA_OPERATOR_AI_OK",
  preferred_model: "gpt-5.6-luna",
  fallback_models: Object.freeze(["gpt-5.4-nano", "gpt-5-nano"]),
  max_output_tokens: 32,
  timeout_ms: 15000,
  call_cost_ceiling_usd: 0.01,
  run_cost_ceiling_usd: 0.25,
  pricing_usd_per_million_tokens: Object.freeze({
    "gpt-5.6-luna": Object.freeze({ input: 0.20, output: 1.20 }),
    "gpt-5.4-nano": Object.freeze({ input: 0.20, output: 1.25 }),
    "gpt-5-nano": Object.freeze({ input: 0.05, output: 0.40 })
  })
});

function estimateProbeCostUsd(model, inputTokens, outputTokens) {
  const pricing = OPERATOR_AI_INFERENCE_PROBE.pricing_usd_per_million_tokens[model];
  if (!pricing) return null;
  const value = (Math.max(0, Number(inputTokens) || 0) * pricing.input
    + Math.max(0, Number(outputTokens) || 0) * pricing.output) / 1_000_000;
  return Number(value.toFixed(8));
}

function extractResponseText(body) {
  if (typeof body?.output_text === "string") return body.output_text.trim();
  for (const item of Array.isArray(body?.output) ? body.output : []) {
    for (const content of Array.isArray(item?.content) ? item.content : []) {
      if (content?.type === "output_text" && typeof content.text === "string") return content.text.trim();
    }
  }
  return "";
}

function countToolCalls(body) {
  return (Array.isArray(body?.output) ? body.output : []).filter((item) =>
    ["function_call", "web_search_call", "file_search_call", "computer_call", "image_generation_call", "code_interpreter_call", "mcp_call"].includes(String(item?.type || ""))
  ).length;
}

async function loadOpenAiModelIds(apiKey, fetchFn) {
  try {
    const response = await fetchFn("https://api.openai.com/v1/models", {
      method: "GET",
      headers: {
        authorization: `Bearer ${apiKey}`,
        accept: "application/json",
        "user-agent": "aurentara-operator-ai-inference-probe/1.0"
      }
    });
    const body = await response.json().catch(() => null);
    return {
      ok: response.ok,
      status: response.status,
      ids: response.ok && Array.isArray(body?.data) ? body.data.map((item) => String(item?.id || "")).filter(Boolean) : [],
      error_type: response.ok ? null : clean(body?.error?.type || body?.error?.code || `OPENAI_HTTP_${response.status}`)
    };
  } catch (error) {
    return { ok: false, status: null, ids: [], error_type: clean(error?.name || "OPENAI_NETWORK_ERROR") };
  }
}

function selectProbeModel(ids = []) {
  const available = new Set(ids);
  if (available.has(OPERATOR_AI_INFERENCE_PROBE.preferred_model)) {
    return { model: OPERATOR_AI_INFERENCE_PROBE.preferred_model, fallback_used: false };
  }
  for (const model of OPERATOR_AI_INFERENCE_PROBE.fallback_models) {
    if (available.has(model)) return { model, fallback_used: true };
  }
  return { model: null, fallback_used: false };
}

async function runOpenAiInferenceProbe(apiKey, options = {}) {
  const fetchFn = typeof options.fetch === "function" ? options.fetch : fetch;
  const models = await loadOpenAiModelIds(apiKey, fetchFn);
  if (!models.ok) {
    return { ok: false, error: "OPENAI_MODEL_DISCOVERY_FAILED", model_discovery_status: models.status, provider_requests: 1, paid_inference_calls: 0 };
  }

  const selected = selectProbeModel(models.ids);
  if (!selected.model) {
    return {
      ok: false,
      error: "OPENAI_OPERATOR_AI_MODEL_UNAVAILABLE",
      preferred_model: OPERATOR_AI_INFERENCE_PROBE.preferred_model,
      allowed_fallback_models: [...OPERATOR_AI_INFERENCE_PROBE.fallback_models],
      provider_requests: 1,
      paid_inference_calls: 0
    };
  }

  const prompt = `${OPERATOR_AI_INFERENCE_PROBE.confirmation}\nAntworte ausschließlich mit:\n${OPERATOR_AI_INFERENCE_PROBE.expected_text}`;
  const conservativeInputTokens = Math.ceil(prompt.length / 3) + 32;
  const preflightCost = estimateProbeCostUsd(selected.model, conservativeInputTokens, OPERATOR_AI_INFERENCE_PROBE.max_output_tokens);
  if (preflightCost === null || preflightCost > OPERATOR_AI_INFERENCE_PROBE.call_cost_ceiling_usd) {
    return {
      ok: false,
      error: "OPENAI_OPERATOR_AI_PROBE_COST_CEILING_EXCEEDED",
      model: selected.model,
      preflight_cost_usd: preflightCost,
      call_cost_ceiling_usd: OPERATOR_AI_INFERENCE_PROBE.call_cost_ceiling_usd,
      provider_requests: 1,
      paid_inference_calls: 0
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OPERATOR_AI_INFERENCE_PROBE.timeout_ms);
  let response;
  let body = null;
  try {
    response = await fetchFn("https://api.openai.com/v1/responses", {
      method: "POST",
      signal: controller.signal,
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
        accept: "application/json",
        "user-agent": "aurentara-operator-ai-inference-probe/1.0"
      },
      body: JSON.stringify({
        model: selected.model,
        input: prompt,
        reasoning: { effort: "none" },
        text: { verbosity: "low" },
        max_output_tokens: OPERATOR_AI_INFERENCE_PROBE.max_output_tokens,
        tools: [],
        store: false
      })
    });
    body = await response.json().catch(() => null);
  } catch (error) {
    clearTimeout(timeout);
    return {
      ok: false,
      error: error?.name === "AbortError" ? "OPENAI_INFERENCE_TIMEOUT" : "OPENAI_INFERENCE_NETWORK_ERROR",
      model: selected.model,
      provider_requests: 2,
      paid_inference_calls: 1
    };
  }
  clearTimeout(timeout);

  const text = extractResponseText(body);
  const usage = body?.usage && typeof body.usage === "object" ? body.usage : null;
  const toolCalls = countToolCalls(body);
  const actualCost = usage
    ? estimateProbeCostUsd(selected.model, usage.input_tokens, usage.output_tokens)
    : null;
  const semanticOk = text === OPERATOR_AI_INFERENCE_PROBE.expected_text;

  return {
    ok: response.ok && semanticOk && usage !== null && toolCalls === 0,
    error: response.ok ? (semanticOk ? (usage ? (toolCalls === 0 ? null : "OPENAI_TOOL_CALL_NOT_ALLOWED") : "OPENAI_USAGE_MISSING") : "OPENAI_INFERENCE_SEMANTIC_MISMATCH") : clean(body?.error?.type || body?.error?.code || `OPENAI_HTTP_${response.status}`),
    http_status: response.status,
    model: selected.model,
    preferred_model: OPERATOR_AI_INFERENCE_PROBE.preferred_model,
    model_fallback_used: selected.fallback_used,
    response_text: text,
    usage: usage ? {
      input_tokens: Number(usage.input_tokens ?? 0),
      output_tokens: Number(usage.output_tokens ?? 0),
      total_tokens: Number(usage.total_tokens ?? (Number(usage.input_tokens || 0) + Number(usage.output_tokens || 0)))
    } : null,
    estimated_cost_usd: actualCost,
    call_cost_ceiling_usd: OPERATOR_AI_INFERENCE_PROBE.call_cost_ceiling_usd,
    provider_requests: 2,
    paid_inference_calls: 1,
    tool_calls: toolCalls
  };
}

export function operatorAiInferenceProbeManifest() {
  return {
    schema: "aurentara.operator-ai-inference-probe.v1",
    provider_id: "openai-api",
    environment: "riosystems-staging",
    preferred_model: OPERATOR_AI_INFERENCE_PROBE.preferred_model,
    fallback_models: [...OPERATOR_AI_INFERENCE_PROBE.fallback_models],
    responses_api: true,
    max_output_tokens: OPERATOR_AI_INFERENCE_PROBE.max_output_tokens,
    timeout_ms: OPERATOR_AI_INFERENCE_PROBE.timeout_ms,
    tools_enabled: false,
    retry_count: 0,
    call_cost_ceiling_usd: OPERATOR_AI_INFERENCE_PROBE.call_cost_ceiling_usd,
    run_cost_ceiling_usd: OPERATOR_AI_INFERENCE_PROBE.run_cost_ceiling_usd,
    production_deploy: false,
    external_writes: false,
    secret_value_exposed: false
  };
}

export function openAiSecretPresenceManifest(env = {}) {
  const staging = String(env.RIOSYSTEMS_ENVIRONMENT || "").toLowerCase() === "staging";
  return Object.freeze({
    schema: "aurentara.openai-secret-presence.v1",
    provider_id: "openai-api",
    runtime: staging ? "riosystems-staging" : "non-staging",
    credential_ref: "env://OPENAI_API_KEY",
    secret_present: staging && Boolean(env.OPENAI_API_KEY),
    secret_value_exposed: false,
    external_request_performed: false,
    openai_api_called: false,
    paid_execution_approved: false,
    production_deploy: false
  });
}

export async function handleOpenAiSecretPresence(request, env = {}, options = {}) {
  const url = new URL(request.url);
  if (url.pathname !== "/factory/diagnostics/openai-secret-presence") return null;
  const verify = String(url.searchParams.get("verify") || "").toLowerCase();
  const inferenceMode = verify === "inference";
  if ((inferenceMode && request.method !== "POST") || (!inferenceMode && request.method !== "GET")) {
    return json({ ok: false, error: "METHOD_NOT_ALLOWED" }, 405);
  }
  if (!isAuthorized(request, env)) return json({ ok: false, error: "UNAUTHORIZED" }, 401);
  if (String(env.RIOSYSTEMS_ENVIRONMENT || "").toLowerCase() !== "staging") {
    return json({ ok: false, error: "STAGING_ONLY", production_deploy: false }, 403);
  }

  const presence = openAiSecretPresenceManifest(env);

  if (!verify) {
    return json({
      ok: presence.secret_present,
      service: "aurentara-openai-secret-presence-v1",
      ...presence
    }, 200);
  }

  if (verify === "inference") {
    if (request.headers.get("x-aurentara-openai-probe-confirmation") !== OPERATOR_AI_INFERENCE_PROBE.confirmation) {
      return json({ ok: false, error: "OPENAI_INFERENCE_PROBE_CONFIRMATION_REQUIRED", paid_inference_calls: 0, production_deploy: false }, 403);
    }
    if (!presence.secret_present) {
      return json({
        ok: false,
        service: "aurentara-operator-ai-inference-probe-v1",
        schema: "aurentara.operator-ai-inference-probe-evidence.v1",
        provider_id: "openai-api",
        runtime: "riosystems-staging",
        credential_ref: "env://OPENAI_API_KEY",
        credential_present: false,
        credential_valid: null,
        connected_staging: false,
        inference_verified: false,
        token_generation_verified: false,
        secret_value_exposed: false,
        tool_calls: 0,
        paid_inference_calls: 0,
        production_deploy: false,
        external_writes: false,
        error: "OPENAI_API_KEY_NOT_CONFIGURED"
      }, 200);
    }
    const probe = await runOpenAiInferenceProbe(env.OPENAI_API_KEY, options);
    return json({
      ok: probe.ok,
      service: "aurentara-operator-ai-inference-probe-v1",
      schema: "aurentara.operator-ai-inference-probe-evidence.v1",
      provider_id: "openai-api",
      environment: "riosystems-staging",
      credential_ref: "env://OPENAI_API_KEY",
      credential_present: true,
      credential_valid: probe.http_status === 401 ? false : probe.ok || probe.http_status ? true : null,
      connected_staging: probe.ok || Boolean(probe.http_status),
      inference_verified: probe.ok,
      token_generation_verified: probe.ok && Number(probe.usage?.output_tokens || 0) > 0,
      model: probe.model || null,
      preferred_model: probe.preferred_model || OPERATOR_AI_INFERENCE_PROBE.preferred_model,
      model_fallback_used: probe.model_fallback_used === true,
      request_success: probe.ok,
      usage: probe.usage || null,
      estimated_cost_usd: probe.estimated_cost_usd ?? 0,
      call_cost_ceiling_usd: OPERATOR_AI_INFERENCE_PROBE.call_cost_ceiling_usd,
      run_cost_ceiling_usd: OPERATOR_AI_INFERENCE_PROBE.run_cost_ceiling_usd,
      provider_requests: probe.provider_requests ?? 0,
      paid_inference_calls: probe.paid_inference_calls ?? 0,
      secret_value_exposed: false,
      prompt_content_logged: false,
      tool_calls: probe.tool_calls ?? 0,
      external_writes: false,
      production_deploy: false,
      paid_execution_globally_approved: false,
      automatic_paid_overflow: false,
      error: probe.error || null
    }, 200);
  }

  if (verify !== "models") {
    return json({ ok: false, error: "UNSUPPORTED_VERIFICATION_MODE" }, 400);
  }

  if (!presence.secret_present) {
    return json({
      ok: false,
      service: "aurentara-openai-connection-check-v1",
      schema: "aurentara.openai-connection-check.v1",
      provider_id: "openai-api",
      runtime: "riosystems-staging",
      credential_ref: "env://OPENAI_API_KEY",
      credential_present: false,
      credential_valid: null,
      connected_staging: false,
      secret_value_exposed: false,
      external_request_performed: false,
      openai_api_called: false,
      inference_performed: false,
      paid_execution_approved: false,
      production_deploy: false,
      variable_cost_eur: 0,
      error: "OPENAI_API_KEY_NOT_CONFIGURED"
    }, 200);
  }

  const probe = await probeOpenAiModels(env.OPENAI_API_KEY);
  return json({
    ok: probe.ok,
    service: "aurentara-openai-connection-check-v1",
    schema: "aurentara.openai-connection-check.v1",
    provider_id: "openai-api",
    runtime: "riosystems-staging",
    credential_ref: "env://OPENAI_API_KEY",
    credential_present: true,
    credential_valid: probe.ok ? true : probe.status === 401 ? false : null,
    connected_staging: probe.ok,
    endpoint: "GET /v1/models",
    secret_value_exposed: false,
    external_request_performed: true,
    openai_api_called: true,
    inference_performed: false,
    prompt_submitted: false,
    token_generation_requested: false,
    paid_execution_approved: false,
    production_deploy: false,
    variable_cost_eur: 0,
    check: {
      reachable: probe.reachable,
      status: probe.status,
      authenticated: probe.ok,
      model_count: probe.model_count,
      error_type: probe.error_type,
      error_message: probe.error_message
    }
  }, 200);
}
