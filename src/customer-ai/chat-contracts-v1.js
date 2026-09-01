import { MEMORY_CATEGORIES } from './contracts-v1.js';

const freeze = (value) => Object.freeze(value);
const clean = (value, max = 8000) => String(value || '').trim().slice(0, max);

export const CUSTOMER_CHAT_INTENTS = freeze([
  'BUSINESS_ADVICE',
  'FACT_QUERY',
  'GOAL_SUPPORT',
  'DECISION_SUPPORT',
  'PLANNING',
  'MEMORY_UPDATE',
  'ACTION_REQUEST'
]);

export const CUSTOMER_CHAT_CONVERSATION_STATUSES = freeze(['ACTIVE', 'ARCHIVED']);
export const CUSTOMER_CHAT_DATA_CLASSES = freeze(['synthetic', 'internal', 'customer', 'sensitive']);

export const CUSTOMER_CHAT_RUNTIME_SAFETY = freeze({
  production: false,
  real_customer_ai_execution: false,
  paid_provider_execution: false,
  external_research_execution: false,
  operator_plane_sharing: false,
  automatic_memory_promotion: false,
  automatic_goal_mutation: false,
  automatic_decision_recording: false,
  action_execution: false,
  variable_cost_ceiling_eur: 0
});

const hasAny = (value, words) => words.some((word) => value.includes(word));

export function classifyCustomerBusinessIntent(message = '') {
  const value = clean(message).toLowerCase();
  if (!value) return { intent: 'BUSINESS_ADVICE', confidence: 0.4 };

  if (hasAny(value, ['stimmt nicht', 'korrektur', 'korrigiere', 'ändern', 'aendern', 'actually', 'correction', 'wrong fact', 'update memory'])) {
    return { intent: 'MEMORY_UPDATE', confidence: 0.92 };
  }
  if (hasAny(value, ['ziel', 'goal', 'target', 'umsatzziel', 'wachstumsziel'])) {
    return { intent: 'GOAL_SUPPORT', confidence: 0.86 };
  }
  if (hasAny(value, ['entscheiden', 'entscheidung', 'decision', 'soll ich', 'should i', 'hire', 'einstellen', 'investieren'])) {
    return { intent: 'DECISION_SUPPORT', confidence: 0.88 };
  }
  if (hasAny(value, ['plan', 'strategie', 'strategy', 'roadmap', 'schritte', 'steps', 'launch plan'])) {
    return { intent: 'PLANNING', confidence: 0.84 };
  }
  if (hasAny(value, ['umsetzen', 'bauen', 'implement', 'execute', 'automatisiere', 'automate', 'von aurentara umsetzen'])) {
    return { intent: 'ACTION_REQUEST', confidence: 0.9 };
  }
  if (/^(was|wer|wann|wo|wie viel|wieviel|what|who|when|where|how many|how much)\b/i.test(value) || value.includes('?')) {
    return { intent: 'FACT_QUERY', confidence: 0.7 };
  }
  return { intent: 'BUSINESS_ADVICE', confidence: 0.62 };
}

export function requiresCurrentExternalResearch(message = '') {
  const value = clean(message).toLowerCase();
  return hasAny(value, [
    'heute', 'aktuell', 'neueste', 'neuesten', 'latest', 'today', 'current market', 'this week',
    'gesetz', 'regulation', 'wettbewerber aktuell', 'current competitor', 'marktpreis', 'market price'
  ]);
}

export function planCustomerChatContext(intent = 'BUSINESS_ADVICE', message = '') {
  const plans = {
    BUSINESS_ADVICE: { max_facts: 8, max_goals: 4, max_decisions: 4, recent_message_limit: 8, include_historical: false },
    FACT_QUERY: { max_facts: 10, max_goals: 2, max_decisions: 2, recent_message_limit: 6, include_historical: false },
    GOAL_SUPPORT: { max_facts: 8, max_goals: 6, max_decisions: 4, recent_message_limit: 8, include_historical: false },
    DECISION_SUPPORT: { max_facts: 10, max_goals: 5, max_decisions: 6, recent_message_limit: 10, include_historical: false },
    PLANNING: { max_facts: 10, max_goals: 5, max_decisions: 5, recent_message_limit: 10, include_historical: false },
    MEMORY_UPDATE: { max_facts: 12, max_goals: 2, max_decisions: 2, recent_message_limit: 8, include_historical: true },
    ACTION_REQUEST: { max_facts: 10, max_goals: 5, max_decisions: 5, recent_message_limit: 10, include_historical: false }
  };
  const selected = plans[intent] || plans.BUSINESS_ADVICE;
  return {
    ...selected,
    context_char_budget: 36_000,
    current_external_research_required: requiresCurrentExternalResearch(message),
    tenant_pre_filter_required: true,
    business_pre_filter_required: true
  };
}

export function customerChatOutputSchema() {
  const shortString = { type: 'string', maxLength: 4000 };
  return {
    type: 'object',
    additionalProperties: false,
    required: [
      'answer', 'recommendations', 'follow_up_questions', 'memory_candidates',
      'goal_proposals', 'decision_proposals', 'evidence_refs', 'needs_external_research', 'confidence'
    ],
    properties: {
      answer: { type: 'string', minLength: 1, maxLength: 12000 },
      recommendations: { type: 'array', maxItems: 6, items: { type: 'string', maxLength: 1500 } },
      follow_up_questions: { type: 'array', maxItems: 4, items: { type: 'string', maxLength: 1000 } },
      memory_candidates: {
        type: 'array', maxItems: 6, items: {
          type: 'object', additionalProperties: false,
          required: ['fact_key', 'subject', 'value_text', 'category', 'confidence', 'needs_confirmation'],
          properties: {
            fact_key: { type: 'string', minLength: 1, maxLength: 160 },
            subject: { type: 'string', minLength: 1, maxLength: 240 },
            value_text: { type: 'string', minLength: 1, maxLength: 3000 },
            category: { type: 'string', enum: [...MEMORY_CATEGORIES] },
            confidence: { type: 'number', minimum: 0, maximum: 1 },
            needs_confirmation: { type: 'boolean' }
          }
        }
      },
      goal_proposals: {
        type: 'array', maxItems: 4, items: {
          type: 'object', additionalProperties: false,
          required: ['title', 'description', 'target_text'],
          properties: { title: { type: 'string', minLength: 1, maxLength: 240 }, description: shortString, target_text: shortString }
        }
      },
      decision_proposals: {
        type: 'array', maxItems: 4, items: {
          type: 'object', additionalProperties: false,
          required: ['title', 'decision', 'reasoning_summary', 'expected_outcome_text'],
          properties: {
            title: { type: 'string', minLength: 1, maxLength: 240 },
            decision: { type: 'string', minLength: 1, maxLength: 3000 },
            reasoning_summary: shortString,
            expected_outcome_text: shortString
          }
        }
      },
      evidence_refs: { type: 'array', maxItems: 16, items: { type: 'string', maxLength: 220 } },
      needs_external_research: { type: 'boolean' },
      confidence: { type: 'number', minimum: 0, maximum: 1 }
    }
  };
}

export function customerChatRuntimeManifest() {
  return {
    version: 'aurentara.personal-business-ai.customer-chat-runtime.v1',
    foundation_dependency: 'aurentara.personal-business-ai.foundation.v1',
    ai_engine: 'reuse_riosystems_ai_factory_v1',
    conversation_scope: ['tenant_id', 'business_id', 'conversation_id'],
    bounded_context: true,
    recent_conversation_window: true,
    full_lifetime_chat_in_prompt: false,
    memory_write_mode: 'candidate_only_until_explicit_confirmation',
    goal_write_mode: 'proposal_only_until_explicit_confirmation',
    decision_write_mode: 'proposal_only_until_explicit_confirmation',
    evidence_allowlist_required: true,
    prompt_injection_boundary: 'customer_and_business_context_is_untrusted_data',
    customer_operator_plane_separation: true,
    safety: { ...CUSTOMER_CHAT_RUNTIME_SAFETY }
  };
}
