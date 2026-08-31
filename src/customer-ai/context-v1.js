import { MEMORY_STATUSES, truthPrecedence } from './contracts-v1.js';

const tokenize = (value) => new Set(String(value || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').split(/\s+/).filter((part) => part.length > 2));
const text = (value) => typeof value === 'string' ? value : JSON.stringify(value ?? '');

function overlapScore(queryTokens, value) {
  const tokens = tokenize(value);
  let score = 0;
  for (const token of queryTokens) if (tokens.has(token)) score += 8;
  return score;
}

function intentBoost(query, category) {
  const q = String(query || '').toLowerCase();
  const c = String(category || '');
  const rules = [
    { words: ['hire', 'hiring', 'employee', 'staff', 'mitarbeiter', 'personal'], categories: ['EMPLOYEE', 'FINANCE', 'OPERATIONS'] },
    { words: ['marketing', 'werbung', 'lead', 'leads'], categories: ['MARKETING', 'FINANCE', 'CUSTOMER'] },
    { words: ['price', 'pricing', 'preis', 'margin', 'marge', 'profit', 'gewinn'], categories: ['FINANCE', 'PRODUCT_SERVICE'] },
    { words: ['website', 'crm', 'automation', 'system'], categories: ['SYSTEM', 'MARKETING', 'OPERATIONS'] }
  ];
  return rules.some((rule) => rule.words.some((word) => q.includes(word)) && rule.categories.includes(c)) ? 18 : 0;
}

export function resolveCurrentFacts(facts = []) {
  const candidates = facts.filter((fact) => !fact.deleted_at && ![MEMORY_STATUSES.HISTORICAL_FACT, MEMORY_STATUSES.OUTDATED_INFORMATION].includes(fact.status));
  const byKey = new Map();
  for (const fact of candidates) {
    const key = String(fact.fact_key || fact.subject || fact.id || 'unknown');
    const current = byKey.get(key);
    const nextScore = truthPrecedence(fact);
    const currentScore = current ? truthPrecedence(current) : -Infinity;
    if (!current || nextScore > currentScore || (nextScore === currentScore && String(fact.updated_at || fact.created_at) > String(current.updated_at || current.created_at))) {
      byKey.set(key, fact);
    }
  }
  return [...byKey.values()];
}

export function rankRelevantContext(input = {}) {
  const query = String(input.query || '');
  const queryTokens = tokenize(query);
  const maxFacts = Math.max(1, Math.min(Number(input.max_facts || 12), 40));
  const maxGoals = Math.max(0, Math.min(Number(input.max_goals || 5), 20));
  const maxDecisions = Math.max(0, Math.min(Number(input.max_decisions || 5), 20));
  const includeHistorical = input.include_historical === true;

  const currentFacts = resolveCurrentFacts(input.facts || []);
  const historical = includeHistorical ? (input.facts || []).filter((fact) => !fact.deleted_at && fact.status === MEMORY_STATUSES.HISTORICAL_FACT) : [];
  const rankedFacts = [...currentFacts, ...historical].map((fact) => {
    const relevance = overlapScore(queryTokens, `${fact.fact_key} ${fact.subject} ${text(fact.value)} ${fact.category}`) + intentBoost(query, fact.category);
    const currentBoost = fact.status === MEMORY_STATUSES.CONFIRMED_FACT ? 10 : fact.status === MEMORY_STATUSES.INFERRED_INFORMATION ? 2 : -2;
    return { ...fact, _context_score: relevance + currentBoost };
  }).sort((a, b) => b._context_score - a._context_score || truthPrecedence(b) - truthPrecedence(a)).slice(0, maxFacts);

  const goals = (input.goals || []).filter((goal) => ['ACTIVE', 'PROPOSED'].includes(goal.status)).map((goal) => ({
    ...goal,
    _context_score: overlapScore(queryTokens, `${goal.title} ${goal.description} ${text(goal.target)}`) + (goal.status === 'ACTIVE' ? 6 : 0) + Number(goal.priority || 0)
  })).sort((a, b) => b._context_score - a._context_score).slice(0, maxGoals);

  const decisions = (input.decisions || []).filter((decision) => decision.status !== 'SUPERSEDED').map((decision) => ({
    ...decision,
    _context_score: overlapScore(queryTokens, `${decision.title} ${decision.decision} ${decision.reasoning_summary} ${decision.expected_outcome}`) + 3
  })).sort((a, b) => b._context_score - a._context_score || String(b.decided_at).localeCompare(String(a.decided_at))).slice(0, maxDecisions);

  return { facts: rankedFacts, goals, decisions };
}

export function buildContextPackage(input = {}) {
  const ranked = rankRelevantContext(input);
  return {
    schema: 'aurentara.customer-ai.context-package.v1',
    tenant: { tenant_id: input.tenant?.tenant_id, name: input.tenant?.name || null },
    business: input.business,
    business_state: input.business_state,
    relevant_facts: ranked.facts.map(({ _context_score, ...fact }) => ({ ...fact, relevance_score: _context_score })),
    active_goals: ranked.goals.map(({ _context_score, ...goal }) => ({ ...goal, relevance_score: _context_score })),
    relevant_decisions: ranked.decisions.map(({ _context_score, ...decision }) => ({ ...decision, relevance_score: _context_score })),
    retrieval: {
      tenant_scoped_before_query: true,
      business_scoped_before_query: true,
      bounded: true,
      max_facts: Number(input.max_facts || 12),
      includes_historical: input.include_historical === true
    }
  };
}
