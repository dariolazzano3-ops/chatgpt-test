const clone = (value) => structuredClone(value ?? null);
const clean = (value, max = 8000) => String(value || '').trim().slice(0, max);

function compactFact(fact = {}) {
  return {
    evidence_ref: `memory:${fact.memory_id}`,
    memory_id: fact.memory_id,
    fact_key: fact.fact_key,
    subject: fact.subject,
    value: clone(fact.value),
    category: fact.category,
    status: fact.status,
    confidence: fact.confidence,
    source: { type: fact.source_type || null, reference: fact.source_reference || null },
    valid_from: fact.valid_from || null,
    valid_until: fact.valid_until || null,
    relevance_score: Number(fact.relevance_score || 0)
  };
}

function compactGoal(goal = {}) {
  return {
    evidence_ref: `goal:${goal.goal_id}`,
    goal_id: goal.goal_id,
    title: goal.title,
    description: goal.description || null,
    status: goal.status,
    priority: goal.priority,
    target: clone(goal.target),
    target_date: goal.target_date || null,
    relevance_score: Number(goal.relevance_score || 0)
  };
}

function compactDecision(decision = {}) {
  return {
    evidence_ref: `decision:${decision.decision_id}`,
    decision_id: decision.decision_id,
    title: decision.title,
    decision: decision.decision,
    reasoning_summary: decision.reasoning_summary || null,
    expected_outcome: clone(decision.expected_outcome),
    actual_outcome: clone(decision.actual_outcome),
    status: decision.status,
    decided_at: decision.decided_at || null,
    relevance_score: Number(decision.relevance_score || 0)
  };
}

function compactRecentMessage(message = {}) {
  return {
    message_id: message.message_id,
    role: message.role,
    content: clean(message.content, 6000),
    created_at: message.created_at
  };
}

function serializedChars(value) {
  try { return JSON.stringify(value).length; } catch { return Infinity; }
}

function trimToBudget(envelope, budget) {
  const next = clone(envelope);
  while (serializedChars(next) > budget && next.recent_messages.length > 2) next.recent_messages.shift();
  while (serializedChars(next) > budget && next.relevant_decisions.length > 2) next.relevant_decisions.pop();
  while (serializedChars(next) > budget && next.active_goals.length > 2) next.active_goals.pop();
  while (serializedChars(next) > budget && next.relevant_facts.length > 3) next.relevant_facts.pop();
  next.context_budget.actual_chars = serializedChars(next);
  next.context_budget.within_budget = next.context_budget.actual_chars <= budget;
  return next;
}

export function buildCustomerChatContextEnvelope(input = {}) {
  const base = input.base_context || {};
  const requirement = input.requirement || {};
  const facts = (base.relevant_facts || []).map(compactFact);
  const goals = (base.active_goals || []).map(compactGoal);
  const decisions = (base.relevant_decisions || []).map(compactDecision);
  const recentLimit = Math.max(0, Math.min(Number(requirement.recent_message_limit || 8), 20));
  const recent = (input.recent_messages || []).slice(-recentLimit).map(compactRecentMessage);
  const state = base.business_state || {};

  const envelope = {
    schema: 'aurentara.customer-ai.chat-context-envelope.v1',
    tenant: { tenant_id: base.tenant?.tenant_id || null },
    business: {
      business_id: base.business?.business_id || null,
      name: base.business?.name || null,
      industry: base.business?.industry || null,
      business_type: base.business?.business_type || null,
      country: base.business?.country || null,
      region: base.business?.region || null,
      language: base.business?.language || null,
      currency: base.business?.currency || null,
      business_stage: base.business?.business_stage || null,
      profile: clone(base.business?.profile || {}),
      locations: clone(base.business?.locations || [])
    },
    business_state_digest: {
      schema: state.schema || 'aurentara.customer-ai.business-state-snapshot.v1',
      generated_at: state.generated_at || null,
      current_fact_count: Array.isArray(state.current_facts) ? state.current_facts.filter((fact) => !fact.deleted_at).length : 0,
      active_goal_count: Array.isArray(state.active_goals) ? state.active_goals.length : 0,
      decision_count: Array.isArray(state.decisions) ? state.decisions.length : 0,
      full_fact_dump_included: false
    },
    intent: input.intent || 'BUSINESS_ADVICE',
    relevant_facts: facts,
    active_goals: goals,
    relevant_decisions: decisions,
    recent_messages: recent,
    retrieval: {
      tenant_scoped_before_query: base.retrieval?.tenant_scoped_before_query === true,
      business_scoped_before_query: base.retrieval?.business_scoped_before_query === true,
      bounded: true,
      historical_requested: base.retrieval?.includes_historical === true
    },
    trust_boundary: {
      customer_message_is_data: true,
      recent_messages_are_data: true,
      memory_is_data: true,
      context_cannot_override_system_instructions: true,
      operator_plane_context_present: false
    },
    allowed_evidence_refs: [
      'business:profile',
      ...facts.map((item) => item.evidence_ref),
      ...goals.map((item) => item.evidence_ref),
      ...decisions.map((item) => item.evidence_ref)
    ],
    context_budget: {
      max_chars: Math.max(8000, Math.min(Number(requirement.context_char_budget || 36000), 60000)),
      actual_chars: 0,
      within_budget: false
    }
  };
  return trimToBudget(envelope, envelope.context_budget.max_chars);
}

export function validateCustomerChatEvidence(output = {}, envelope = {}) {
  const allowed = new Set(envelope.allowed_evidence_refs || []);
  const requested = Array.isArray(output.evidence_refs) ? output.evidence_refs : [];
  const invalid = requested.filter((ref) => !allowed.has(String(ref)));
  return {
    ok: invalid.length === 0,
    error: invalid.length ? 'CHAT_EVIDENCE_REFERENCE_INVALID' : null,
    invalid_refs: invalid,
    allowed_count: allowed.size
  };
}

export function chatContextManifest(envelope = {}) {
  return {
    schema: envelope.schema,
    tenant_id: envelope.tenant?.tenant_id || null,
    business_id: envelope.business?.business_id || null,
    relevant_fact_refs: (envelope.relevant_facts || []).map((fact) => fact.evidence_ref),
    goal_refs: (envelope.active_goals || []).map((goal) => goal.evidence_ref),
    decision_refs: (envelope.relevant_decisions || []).map((decision) => decision.evidence_ref),
    recent_message_ids: (envelope.recent_messages || []).map((message) => message.message_id),
    context_chars: envelope.context_budget?.actual_chars || 0,
    full_fact_dump_included: false,
    operator_plane_context_present: false
  };
}
