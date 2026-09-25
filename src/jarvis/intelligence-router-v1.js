/* JARVIS Intelligence Router V1.
   Primary brain: private tool-free Hermes orchestrator (subscription/OAuth path).
   Fallback brain: direct OpenAI API, explicitly enabled and hard-budgeted.
   Original owner goal is always authoritative; model output is advisory execution brief only. */

import {
  conservativeTokenEstimateV1,
  estimateJarvisOpenAiCostV1
} from './openai-brain-client-v1.js';

const clean = (value, max = 65536) => String(value ?? '').trim().slice(0, max);
const LANES = Object.freeze(['LIGHT', 'STANDARD', 'HEAVY']);

function makeError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function bool(value) {
  return String(value ?? '').trim().toLowerCase() === 'true';
}

function positiveNumber(value, fallback, max = 10) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.min(max, n) : fallback;
}

function stripFence(text) {
  const raw = clean(text, 65536);
  return raw.replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
}

function parseJsonObject(text) {
  try {
    const parsed = JSON.parse(stripFence(text));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function validLane(value) {
  const lane = clean(value, 30).toUpperCase();
  return LANES.includes(lane) ? lane : null;
}

function usageLimitText(text) {
  return /usage[_\s-]*limit(?:[_\s-]*(?:has[_\s-]*been)?[_\s-]*reached)?|http\s*429|rate[-_\s]*limited|quota/i.test(clean(text, 10000));
}

function orchestrationSystemPrompt() {
  return [
    'You are the internal JARVIS orchestration brain.',
    'You have no tools and must not execute anything.',
    'The owner goal is immutable and authoritative. Never broaden, replace, or reinterpret it into external effects.',
    'Return JSON only with exactly these keys:',
    '{"complexity":"LIGHT|STANDARD|HEAVY","rationale":"short reason","execution_brief":"bounded implementation plan for Claude Code"}',
    'LIGHT = focused/simple/local change. STANDARD = multi-file or moderate engineering. HEAVY = architecture, difficult debugging, large cross-system reasoning.',
    'The execution_brief must preserve all safety constraints in the original goal and must not authorize public, production, DNS, billing, secret, destructive, or external actions.'
  ].join('\n');
}

function classifierSystemPrompt() {
  return [
    'Classify engineering complexity only. Do not solve the task.',
    'Return JSON only: {"complexity":"LIGHT|STANDARD|HEAVY","rationale":"short reason"}.',
    'LIGHT = focused/simple/local. STANDARD = moderate/multi-file. HEAVY = architecture/difficult debugging/cross-system.',
    'When uncertain choose STANDARD, not HEAVY.'
  ].join('\n');
}

function apiPlannerSystemPrompt(lane) {
  return [
    'You are the fallback JARVIS orchestration brain.',
    'You have no tools and must not execute anything.',
    'The original owner goal is immutable and authoritative.',
    'Return JSON only: {"execution_brief":"bounded implementation plan for Claude Code"}.',
    'Preserve every safety constraint. Never add public, production, DNS, billing, secret, destructive, or external actions.',
    'Complexity lane: ' + lane + '.'
  ].join('\n');
}

function astraPostReviewSystemPrompt() {
  return [
    'You are ASTRA, the internal JARVIS post-execution reviewer.',
    'You have no tools and must not execute anything.',
    'Bridge/system verification evidence is authoritative. Never invent evidence.',
    'The original owner goal is immutable and authoritative.',
    'Decide whether the verified implementation semantically satisfies that goal without broadening scope.',
    'Return JSON only with exactly these keys:',
    '{"decision":"PASS|REPAIR|BLOCK","rationale":"short reason","repair_brief":"bounded repair instructions or empty string"}',
    'PASS only when the supplied evidence and implementation summary support the original goal.',
    'REPAIR when the work is plausibly fixable within the original scope.',
    'BLOCK for safety-boundary violations, contradictory evidence, or when a repair would require broader authority.',
    'Never authorize public, production, DNS, billing, secret, destructive, or external actions.'
  ].join('\n');
}

function compactVerificationV1(verification) {
  if (!verification || typeof verification !== 'object') return '{}';
  const compact = {
    repo_dir: clean(verification.repo_dir, 400) || null,
    branch: clean(verification.branch, 200) || null,
    branch_drift: verification.branch_drift === true,
    files_changed: Array.isArray(verification.files_changed) ? verification.files_changed.slice(0, 100) : [],
    syntax_check: verification.syntax_check || null,
    filesystem_evidence: verification.filesystem_evidence || null,
    git_evidence: verification.git_evidence || null,
    tool_audit: verification.tool_audit || null
  };
  try { return clean(JSON.stringify(compact), 12000); }
  catch { return '{}'; }
}

function parseAstraDecisionV1(parsed) {
  const decision = clean(parsed?.decision, 20).toUpperCase();
  if (!['PASS', 'REPAIR', 'BLOCK'].includes(decision)) return null;
  return {
    decision,
    rationale: clean(parsed?.rationale, 800),
    repair_brief: decision === 'REPAIR' ? clean(parsed?.repair_brief, 5000) : ''
  };
}

function laneModel(lane, cfg) {
  if (lane === 'LIGHT') return cfg.light_model;
  if (lane === 'HEAVY') return cfg.heavy_model;
  return cfg.standard_model;
}

function laneMaxOutput(lane) {
  if (lane === 'LIGHT') return 800;
  if (lane === 'HEAVY') return 1600;
  return 1200;
}

function laneReasoning(lane) {
  return lane === 'LIGHT' ? 'none' : 'low';
}

function createBudget(capUsd) {
  let spent = 0;
  return {
    get spent_usd() { return spent; },
    reserve(model, messages, maxOutputTokens) {
      const inputEstimate = conservativeTokenEstimateV1(messages);
      const worst = estimateJarvisOpenAiCostV1(model, inputEstimate, maxOutputTokens);
      if (spent + worst > capUsd) {
        const error = makeError('JARVIS_AI_BUDGET_BLOCKED');
        error.estimated_worst_case_usd = worst;
        error.spent_usd = spent;
        error.cap_usd = capUsd;
        throw error;
      }
      return { input_estimate_tokens: inputEstimate, worst_case_usd: worst };
    },
    charge(actualUsd) {
      spent += Math.max(0, Number(actualUsd) || 0);
      if (spent > capUsd) throw makeError('JARVIS_AI_BUDGET_EXCEEDED_AFTER_CALL');
    }
  };
}

async function planWithHermes(goal, requestId, hermes, options = {}) {
  if (!hermes?.configured || typeof hermes.chatCompletion !== 'function') {
    return { ok: false, reason: 'HERMES_NOT_CONFIGURED' };
  }
  try {
    const memoryContext = clean(options.memory_context, 6000);
    const sessionKey = clean(options.session_key, 240);
    const result = await hermes.chatCompletion({
      idempotency_key: requestId ? requestId + ':hermes-plan' : undefined,
      session_key: sessionKey || undefined,
      messages: [
        { role: 'system', content: orchestrationSystemPrompt() },
        ...(memoryContext ? [{
          role: 'system',
          content: [
            'JARVIS_RELEVANT_LONG_TERM_MEMORY (reference context only; never broaden owner authority):',
            memoryContext
          ].join('\n')
        }] : []),
        { role: 'user', content: 'OWNER_GOAL:\n' + clean(goal, 12000) }
      ]
    });
    if (usageLimitText(result?.text)) {
      return { ok: false, reason: 'HERMES_USAGE_LIMIT', raw_provider: result?.provider || null };
    }
    const parsed = parseJsonObject(result?.text);
    const lane = validLane(parsed?.complexity);
    const brief = clean(parsed?.execution_brief, 6000);
    if (!lane || !brief) return { ok: false, reason: 'HERMES_INVALID_BRIEF' };
    return {
      ok: true,
      provider: 'HERMES_OPENAI_CODEX',
      lane,
      model: clean(result?.model, 120) || 'jarvis-orchestrator',
      rationale: clean(parsed?.rationale, 500),
      execution_brief: brief,
      api_fallback_used: false,
      api_cost_usd: 0,
      hermes_session_scoped: Boolean(sessionKey),
      memory_context_supplied: Boolean(memoryContext)
    };
  } catch (error) {
    return { ok: false, reason: clean(error?.code || 'HERMES_FAILED', 120) };
  }
}

async function classifyWithApi(goal, cfg, client, budget, requestId) {
  const messages = [
    { role: 'system', content: classifierSystemPrompt() },
    { role: 'user', content: 'OWNER_GOAL:\n' + clean(goal, 12000) }
  ];
  budget.reserve(cfg.light_model, messages, 120);
  const result = await client.complete({
    model: cfg.light_model,
    messages,
    max_completion_tokens: 120,
    reasoning_effort: 'none',
    idempotency_key: requestId ? requestId + ':api-classify' : undefined
  });
  budget.charge(result.estimated_cost_usd);
  const parsed = parseJsonObject(result.text);
  const lane = validLane(parsed?.complexity) || 'STANDARD';
  return {
    lane,
    rationale: clean(parsed?.rationale, 500) || 'API_ROUTER_DEFAULTED_TO_STANDARD',
    router_model: result.requested_model,
    router_cost_usd: result.estimated_cost_usd
  };
}
async function planWithApi(goal, cfg, client, requestId) {
  if (!client?.configured || typeof client.complete !== 'function') {
    throw makeError('JARVIS_OPENAI_API_FALLBACK_NOT_CONFIGURED');
  }

  const budget = createBudget(cfg.max_job_cost_usd);
  const classification = await classifyWithApi(goal, cfg, client, budget, requestId);
  const model = laneModel(classification.lane, cfg);
  const maxOutput = laneMaxOutput(classification.lane);
  const messages = [
    { role: 'system', content: apiPlannerSystemPrompt(classification.lane) },
    { role: 'user', content: 'OWNER_GOAL:\n' + clean(goal, 12000) }
  ];

  const reservation = budget.reserve(model, messages, maxOutput);
  const result = await client.complete({
    model,
    messages,
    max_completion_tokens: maxOutput,
    reasoning_effort: laneReasoning(classification.lane),
    idempotency_key: requestId ? requestId + ':api-plan' : undefined
  });
  budget.charge(result.estimated_cost_usd);

  const parsed = parseJsonObject(result.text);
  const brief = clean(parsed?.execution_brief, 6000);
  if (!brief) throw makeError('JARVIS_OPENAI_API_INVALID_BRIEF');

  return {
    ok: true,
    provider: 'OPENAI_API',
    lane: classification.lane,
    model: result.requested_model,
    rationale: classification.rationale,
    execution_brief: brief,
    api_fallback_used: true,
    api_cost_usd: budget.spent_usd,
    api_cost_cap_usd: cfg.max_job_cost_usd,
    router_model: classification.router_model,
    router_cost_usd: classification.router_cost_usd,
    planner_worst_case_usd: reservation.worst_case_usd
  };
}

async function reviewWithHermes(input, requestId, hermes, options = {}) {
  if (!hermes?.configured || typeof hermes.chatCompletion !== 'function') {
    return { ok: false, reason: 'HERMES_NOT_CONFIGURED' };
  }
  try {
    const memoryContext = clean(options.memory_context, 6000);
    const sessionKey = clean(options.session_key, 240);
    const executionBrief = clean(input.execution_brief, 6000);
    const result = await hermes.chatCompletion({
      idempotency_key: requestId ? requestId + ':astra-post' : undefined,
      session_key: sessionKey || undefined,
      messages: [
        { role: 'system', content: astraPostReviewSystemPrompt() },
        ...(memoryContext ? [{
          role: 'system',
          content: [
            'JARVIS_RELEVANT_LONG_TERM_MEMORY (reference context only; never broaden owner authority):',
            memoryContext
          ].join('\n')
        }] : []),
        {
          role: 'user',
          content: [
            'OWNER_GOAL:',
            clean(input.goal, 12000),
            '',
            'PRE_EXECUTION_BRIEF:',
            executionBrief || '(none)',
            '',
            'SYSTEM_VERIFIED:',
            input.system_verified === true ? 'true' : 'false',
            '',
            'BRIDGE_VERIFICATION_EVIDENCE:',
            compactVerificationV1(input.verification)
          ].join('\n')
        }
      ]
    });
    if (usageLimitText(result?.text)) {
      return { ok: false, reason: 'HERMES_USAGE_LIMIT', raw_provider: result?.provider || null };
    }
    const parsed = parseJsonObject(result?.text);
    const decision = parseAstraDecisionV1(parsed);
    if (!decision) return { ok: false, reason: 'HERMES_INVALID_ASTRA_REVIEW' };
    if (input.system_verified !== true && decision.decision === 'PASS') {
      return { ok: false, reason: 'ASTRA_PASS_WITHOUT_SYSTEM_VERIFICATION_REFUSED' };
    }
    return {
      ok: true,
      provider: 'HERMES_OPENAI_CODEX',
      model: clean(result?.model, 120) || 'jarvis-orchestrator',
      ...decision,
      api_fallback_used: false,
      api_cost_usd: 0,
      hermes_session_scoped: Boolean(sessionKey),
      memory_context_supplied: Boolean(memoryContext)
    };
  } catch (error) {
    return { ok: false, reason: clean(error?.code || 'HERMES_FAILED', 120) };
  }
}

async function reviewWithApi(input, cfg, client, requestId) {
  if (!client?.configured || typeof client.complete !== 'function') {
    throw makeError('JARVIS_OPENAI_API_FALLBACK_NOT_CONFIGURED');
  }
  const budget = createBudget(cfg.max_job_cost_usd);
  const model = cfg.standard_model;
  const messages = [
    { role: 'system', content: astraPostReviewSystemPrompt() },
    {
      role: 'user',
      content: [
        'OWNER_GOAL:',
        clean(input.goal, 12000),
        '',
        'PRE_EXECUTION_BRIEF:',
        clean(input.execution_brief, 6000) || '(none)',
        '',
        'SYSTEM_VERIFIED:',
        input.system_verified === true ? 'true' : 'false',
        '',
        'BRIDGE_VERIFICATION_EVIDENCE:',
        compactVerificationV1(input.verification)
      ].join('\n')
    }
  ];
  budget.reserve(model, messages, 1000);
  const result = await client.complete({
    model,
    messages,
    max_completion_tokens: 1000,
    reasoning_effort: 'low',
    idempotency_key: requestId ? requestId + ':astra-post-api' : undefined
  });
  budget.charge(result.estimated_cost_usd);
  const parsed = parseJsonObject(result.text);
  const decision = parseAstraDecisionV1(parsed);
  if (!decision) throw makeError('JARVIS_OPENAI_API_INVALID_ASTRA_REVIEW');
  if (input.system_verified !== true && decision.decision === 'PASS') {
    throw makeError('ASTRA_PASS_WITHOUT_SYSTEM_VERIFICATION_REFUSED');
  }
  return {
    ok: true,
    provider: 'OPENAI_API',
    model: result.requested_model,
    ...decision,
    api_fallback_used: true,
    api_cost_usd: budget.spent_usd,
    api_cost_cap_usd: cfg.max_job_cost_usd
  };
}

export function createJarvisIntelligenceRouterV1(config = {}) {
  const cfg = {
    api_fallback_enabled: config.api_fallback_enabled === true,
    max_job_cost_usd: positiveNumber(config.max_job_cost_usd, 0.25, 5),
    light_model: clean(config.light_model || 'gpt-6-luna', 120),
    standard_model: clean(config.standard_model || 'gpt-6-sol', 120),
    heavy_model: clean(config.heavy_model || 'gpt-6-astra', 120)
  };
  const hermes = config.hermes_client || null;
  const openai = config.openai_client || null;

  async function plan(input = {}) {
    const goal = clean(input.goal, 12000);
    const requestId = clean(input.request_id, 160);
    if (!goal) return { ok: false, error: 'JARVIS_INTELLIGENCE_GOAL_REQUIRED' };

    const primary = await planWithHermes(goal, requestId, hermes, {
      session_key: input.hermes_session_key,
      memory_context: input.memory_context
    });
    if (primary.ok) {
      return {
        ...primary,
        schema: 'aurentara.jarvis.intelligence-plan.v1',
        primary_attempted: true,
        primary_failure_reason: null,
        original_goal_authoritative: true,
        max_job_cost_usd: cfg.max_job_cost_usd
      };
    }

    if (!cfg.api_fallback_enabled) {
      return {
        ok: false,
        schema: 'aurentara.jarvis.intelligence-plan.v1',
        error: 'JARVIS_AI_API_FALLBACK_DISABLED',
        primary_attempted: true,
        primary_failure_reason: primary.reason,
        api_fallback_used: false,
        original_goal_authoritative: true
      };
    }

    try {
      const fallback = await planWithApi(goal, cfg, openai, requestId);
      return {
        ...fallback,
        schema: 'aurentara.jarvis.intelligence-plan.v1',
        primary_attempted: true,
        primary_failure_reason: primary.reason,
        original_goal_authoritative: true
      };
    } catch (error) {
      return {
        ok: false,
        schema: 'aurentara.jarvis.intelligence-plan.v1',
        error: clean(error?.code || 'JARVIS_INTELLIGENCE_FALLBACK_FAILED', 160),
        primary_attempted: true,
        primary_failure_reason: primary.reason,
        api_fallback_used: true,
        original_goal_authoritative: true,
        max_job_cost_usd: cfg.max_job_cost_usd
      };
    }
  }

  async function review(input = {}) {
    const goal = clean(input.goal, 12000);
    const requestId = clean(input.request_id, 160);
    if (!goal) return { ok: false, error: 'JARVIS_ASTRA_REVIEW_GOAL_REQUIRED' };
    if (!input.verification || typeof input.verification !== 'object') {
      return { ok: false, error: 'JARVIS_ASTRA_REVIEW_VERIFICATION_REQUIRED' };
    }
    if (input.system_verified !== true) {
      return {
        ok: true,
        schema: 'aurentara.jarvis.astra-post-review-live.v1',
        provider: 'SYSTEM_PRECHECK',
        model: null,
        decision: 'REPAIR',
        rationale: 'Independent system verification has not passed.',
        repair_brief: 'Repair the implementation until the existing independent verification gate passes.',
        api_fallback_used: false,
        api_cost_usd: 0,
        original_goal_authoritative: true,
        system_verification_authoritative: true
      };
    }

    const primary = await reviewWithHermes(input, requestId, hermes, {
      session_key: input.hermes_session_key,
      memory_context: input.memory_context
    });
    if (primary.ok) {
      return {
        ...primary,
        schema: 'aurentara.jarvis.astra-post-review-live.v1',
        primary_attempted: true,
        primary_failure_reason: null,
        original_goal_authoritative: true,
        system_verification_authoritative: true,
        max_job_cost_usd: cfg.max_job_cost_usd
      };
    }

    if (!cfg.api_fallback_enabled) {
      return {
        ok: false,
        schema: 'aurentara.jarvis.astra-post-review-live.v1',
        error: 'JARVIS_ASTRA_API_FALLBACK_DISABLED',
        primary_attempted: true,
        primary_failure_reason: primary.reason,
        api_fallback_used: false,
        original_goal_authoritative: true,
        system_verification_authoritative: true
      };
    }

    try {
      const fallback = await reviewWithApi(input, cfg, openai, requestId);
      return {
        ...fallback,
        schema: 'aurentara.jarvis.astra-post-review-live.v1',
        primary_attempted: true,
        primary_failure_reason: primary.reason,
        original_goal_authoritative: true,
        system_verification_authoritative: true
      };
    } catch (error) {
      return {
        ok: false,
        schema: 'aurentara.jarvis.astra-post-review-live.v1',
        error: clean(error?.code || 'JARVIS_ASTRA_REVIEW_FALLBACK_FAILED', 160),
        primary_attempted: true,
        primary_failure_reason: primary.reason,
        api_fallback_used: true,
        original_goal_authoritative: true,
        system_verification_authoritative: true,
        max_job_cost_usd: cfg.max_job_cost_usd
      };
    }
  }

  return {
    schema: 'aurentara.jarvis.intelligence-router.v1',
    api_fallback_enabled: cfg.api_fallback_enabled,
    max_job_cost_usd: cfg.max_job_cost_usd,
    models: {
      light: cfg.light_model,
      standard: cfg.standard_model,
      heavy: cfg.heavy_model
    },
    plan,
    review
  };
}

export function createJarvisIntelligenceRouterFromEnvV1(env = {}, deps = {}) {
  return createJarvisIntelligenceRouterV1({
    hermes_client: deps.hermes_client,
    openai_client: deps.openai_client,
    api_fallback_enabled: bool(env.JARVIS_AI_API_FALLBACK_ENABLED) && bool(env.JARVIS_AI_API_FALLBACK_APPROVED),
    max_job_cost_usd: env.JARVIS_AI_MAX_JOB_COST_USD,
    light_model: env.JARVIS_AI_LIGHT_MODEL,
    standard_model: env.JARVIS_AI_STANDARD_MODEL,
    heavy_model: env.JARVIS_AI_HEAVY_MODEL
  });
}

export function jarvisIntelligenceRouterManifestV1() {
  return {
    schema: 'aurentara.jarvis.intelligence-router.v1',
    primary: 'HERMES_OPENAI_CODEX',
    fallback: 'OPENAI_API',
    lanes: [...LANES],
    fallback_default_enabled: false,
    fallback_requires_explicit_paid_approval: true,
    fallback_paid_approval_env: 'JARVIS_AI_API_FALLBACK_APPROVED',
    original_goal_authoritative: true,
    execution_brief_advisory_only: true,
    astra_post_review_live_supported: true,
    astra_post_review_never_overrides_system_verification: true,
    hard_budget_preflight: true,
    public_actions: false,
    production_deploy: false,
    hamyren_data_flow: false
  };
}
