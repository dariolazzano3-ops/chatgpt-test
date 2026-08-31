import { createMemoryRuntimeStore } from '../durable-runtime-store.js';
import {
  MEMORY_STATUSES, MEMORY_CANDIDATE_STATUSES, MEMORY_CATEGORIES, GOAL_STATUSES, DECISION_STATUSES,
  normalizeTenantScope, semanticRetrievalContract, customerAiFoundationManifest
} from './contracts-v1.js';
import { buildContextPackage, resolveCurrentFacts } from './context-v1.js';

const clone = (value) => structuredClone(value ?? null);
const clean = (value, max = 240) => String(value || '').trim().slice(0, max);
const now = () => new Date().toISOString();

export function createCustomerAiFoundation(options = {}) {
  const store = options.store || createMemoryRuntimeStore();
  let sequence = 0;
  const nextId = (prefix) => `${prefix}_${String(++sequence).padStart(6, '0')}`;
  const tenantScope = (tenantId) => `tenant:${tenantId}`;
  const businessScope = (tenantId, businessId) => `${tenantId}:${businessId}`;

  async function record(scope, collection, id, value) {
    const result = await store.put(scope, collection, id, value);
    if (!result.ok) throw new Error(result.error || 'STORE_WRITE_FAILED');
    return clone(result.value);
  }

  async function read(scope, collection, id) {
    const result = await store.get(scope, collection, id);
    return result?.value ? clone(result.value) : null;
  }

  async function list(scope, collection) {
    return (await store.list(scope, collection)).map((item) => clone(item.value));
  }

  async function authorize(ctx = {}, businessId = null) {
    const tenantId = clean(ctx.tenant_id, 120);
    const userId = clean(ctx.user_id, 120);
    if (!tenantId || !userId) return { ok: false, error: 'AUTHENTICATED_TENANT_CONTEXT_REQUIRED' };
    const membership = await read(tenantScope(tenantId), 'memberships', userId);
    if (!membership || membership.status !== 'active') return { ok: false, error: 'TENANT_ACCESS_DENIED' };
    if (businessId) {
      const business = await read(tenantScope(tenantId), 'businesses', clean(businessId, 120));
      if (!business || business.tenant_id !== tenantId || business.deleted_at) return { ok: false, error: 'BUSINESS_ACCESS_DENIED' };
      return { ok: true, tenant_id: tenantId, user_id: userId, membership, business };
    }
    return { ok: true, tenant_id: tenantId, user_id: userId, membership };
  }

  async function audit(auth, businessId, action, entityType, entityId, metadata = {}) {
    const event = {
      audit_id: nextId('audit'), tenant_id: auth.tenant_id, business_id: businessId || null,
      actor_user_id: auth.user_id, action, entity_type: entityType, entity_id: entityId || null,
      metadata: clone(metadata), created_at: now()
    };
    const scope = businessId ? businessScope(auth.tenant_id, businessId) : tenantScope(auth.tenant_id);
    await record(scope, 'audit', event.audit_id, event);
    return event;
  }

  async function createTenant(input = {}) {
    const tenantId = clean(input.tenant_id || nextId('tenant'), 120);
    const userId = clean(input.owner_user_id, 120);
    if (!userId) return { ok: false, error: 'OWNER_USER_REQUIRED' };
    const existing = await read(tenantScope(tenantId), 'tenant', tenantId);
    if (existing) return { ok: false, error: 'TENANT_ALREADY_EXISTS' };
    const tenant = { tenant_id: tenantId, name: clean(input.name || 'AURENTARA Customer'), status: 'active', created_at: now(), data_plane: 'customer_ai' };
    const membership = { membership_id: nextId('membership'), tenant_id: tenantId, user_id: userId, role: 'owner', status: 'active', created_at: now() };
    await record(tenantScope(tenantId), 'tenant', tenantId, tenant);
    await record(tenantScope(tenantId), 'memberships', userId, membership);
    return { ok: true, tenant: clone(tenant), membership: clone(membership) };
  }

  async function addMembership(ctx, input = {}) {
    const auth = await authorize(ctx);
    if (!auth.ok) return auth;
    if (auth.membership.role !== 'owner') return { ok: false, error: 'TENANT_OWNER_REQUIRED' };
    const userId = clean(input.user_id, 120);
    if (!userId) return { ok: false, error: 'MEMBERSHIP_USER_REQUIRED' };
    const membership = { membership_id: nextId('membership'), tenant_id: auth.tenant_id, user_id: userId, role: input.role === 'viewer' ? 'viewer' : 'member', status: 'active', created_at: now() };
    await record(tenantScope(auth.tenant_id), 'memberships', userId, membership);
    await audit(auth, null, 'membership.created', 'membership', membership.membership_id, { user_id: userId, role: membership.role });
    return { ok: true, membership };
  }

  async function createBusiness(ctx, input = {}) {
    const auth = await authorize(ctx);
    if (!auth.ok) return auth;
    const businessId = clean(input.business_id || nextId('business'), 120);
    const business = {
      business_id: businessId, tenant_id: auth.tenant_id, name: clean(input.name || 'Business'), industry: clean(input.industry) || null,
      business_type: clean(input.business_type) || null, country: clean(input.country || 'DE', 8), region: clean(input.region) || null,
      language: clean(input.language || 'de', 12), currency: clean(input.currency || 'EUR', 8), business_stage: clean(input.business_stage) || null,
      founded_at: input.founded_at || null, locations: Array.isArray(input.locations) ? clone(input.locations) : [],
      owner_user_id: auth.user_id, profile: clone(input.profile || {}), created_at: now(), updated_at: now(), deleted_at: null
    };
    await record(tenantScope(auth.tenant_id), 'businesses', businessId, business);
    await record(businessScope(auth.tenant_id, businessId), 'business', businessId, business);
    await audit(auth, businessId, 'business.created', 'business', businessId);
    return { ok: true, business };
  }

  async function createMemoryCandidate(ctx, businessId, input = {}) {
    const auth = await authorize(ctx, businessId);
    if (!auth.ok) return auth;
    const category = MEMORY_CATEGORIES.includes(input.category) ? input.category : 'OTHER';
    const candidate = {
      candidate_id: nextId('candidate'), tenant_id: auth.tenant_id, business_id: businessId, category,
      fact_key: clean(input.fact_key || input.subject, 160), subject: clean(input.subject || input.fact_key, 240), value: clone(input.value),
      status: input.status === MEMORY_CANDIDATE_STATUSES.NEEDS_CONFIRMATION ? MEMORY_CANDIDATE_STATUSES.NEEDS_CONFIRMATION : MEMORY_CANDIDATE_STATUSES.PENDING,
      source_type: clean(input.source_type || 'user_statement', 80), source_reference: clean(input.source_reference, 240) || null,
      confidence: Math.max(0, Math.min(Number(input.confidence ?? 1), 1)), sensitivity: clean(input.sensitivity || 'normal', 40),
      created_at: now(), updated_at: now()
    };
    if (!candidate.fact_key) return { ok: false, error: 'MEMORY_FACT_KEY_REQUIRED' };
    await record(businessScope(auth.tenant_id, businessId), 'memory-candidates', candidate.candidate_id, candidate);
    await audit(auth, businessId, 'memory.candidate.created', 'memory_candidate', candidate.candidate_id, { fact_key: candidate.fact_key });
    return { ok: true, candidate };
  }

  async function writeMemoryFact(auth, businessId, input = {}) {
    const status = Object.values(MEMORY_STATUSES).includes(input.status) ? input.status : MEMORY_STATUSES.INFERRED_INFORMATION;
    if (status === MEMORY_STATUSES.CONFIRMED_FACT && input.confirmed_by_user !== true && input.confirmation_mechanism !== 'trusted_structured_input') {
      return { ok: false, error: 'CONFIRMED_FACT_REQUIRES_EXPLICIT_CONFIRMATION' };
    }
    const fact = {
      memory_id: input.memory_id || nextId('memory'), tenant_id: auth.tenant_id, business_id: businessId,
      category: MEMORY_CATEGORIES.includes(input.category) ? input.category : 'OTHER', fact_key: clean(input.fact_key || input.subject, 160),
      subject: clean(input.subject || input.fact_key, 240), value: clone(input.value), status,
      source_type: clean(input.source_type || (status === MEMORY_STATUSES.INFERRED_INFORMATION ? 'ai_inference' : 'user_statement'), 80),
      source_reference: clean(input.source_reference, 240) || null, confidence: Math.max(0, Math.min(Number(input.confidence ?? 1), 1)),
      sensitivity: clean(input.sensitivity || 'normal', 40), created_by: clean(input.created_by || auth.user_id, 120),
      created_at: input.created_at || now(), updated_at: now(), valid_from: input.valid_from || now(), valid_until: input.valid_until || null,
      last_confirmed_at: status === MEMORY_STATUSES.CONFIRMED_FACT ? now() : null,
      supersedes: input.supersedes || null, superseded_by: null, previous_status: input.previous_status || null, deleted_at: null
    };
    if (!fact.fact_key) return { ok: false, error: 'MEMORY_FACT_KEY_REQUIRED' };
    await record(businessScope(auth.tenant_id, businessId), 'memory-facts', fact.memory_id, fact);
    await audit(auth, businessId, 'memory.created', 'memory_fact', fact.memory_id, { fact_key: fact.fact_key, status: fact.status, source_type: fact.source_type });
    return { ok: true, fact };
  }

  async function addConfirmedMemory(ctx, businessId, input = {}) {
    const auth = await authorize(ctx, businessId);
    if (!auth.ok) return auth;
    return writeMemoryFact(auth, businessId, { ...input, status: MEMORY_STATUSES.CONFIRMED_FACT, confirmed_by_user: input.confirmed_by_user === true, confirmation_mechanism: input.confirmation_mechanism });
  }

  async function addInferredMemory(ctx, businessId, input = {}) {
    const auth = await authorize(ctx, businessId);
    if (!auth.ok) return auth;
    return writeMemoryFact(auth, businessId, { ...input, status: MEMORY_STATUSES.INFERRED_INFORMATION, source_type: input.source_type || 'ai_inference', confirmed_by_user: false });
  }

  async function acceptMemoryCandidate(ctx, businessId, candidateId, input = {}) {
    const auth = await authorize(ctx, businessId);
    if (!auth.ok) return auth;
    const candidate = await read(businessScope(auth.tenant_id, businessId), 'memory-candidates', candidateId);
    if (!candidate || candidate.status === MEMORY_CANDIDATE_STATUSES.REJECTED) return { ok: false, error: 'MEMORY_CANDIDATE_NOT_AVAILABLE' };
    const confirmed = input.confirmed_by_user === true;
    const created = await writeMemoryFact(auth, businessId, {
      ...candidate, memory_id: undefined, status: confirmed ? MEMORY_STATUSES.CONFIRMED_FACT : MEMORY_STATUSES.INFERRED_INFORMATION,
      confirmed_by_user: confirmed, source_reference: candidate.source_reference || candidate.candidate_id
    });
    if (!created.ok) return created;
    candidate.status = MEMORY_CANDIDATE_STATUSES.ACCEPTED;
    candidate.accepted_memory_id = created.fact.memory_id;
    candidate.updated_at = now();
    await record(businessScope(auth.tenant_id, businessId), 'memory-candidates', candidateId, candidate);
    return { ok: true, candidate, fact: created.fact };
  }

  async function rejectMemoryCandidate(ctx, businessId, candidateId) {
    const auth = await authorize(ctx, businessId);
    if (!auth.ok) return auth;
    const candidate = await read(businessScope(auth.tenant_id, businessId), 'memory-candidates', candidateId);
    if (!candidate) return { ok: false, error: 'MEMORY_CANDIDATE_NOT_FOUND' };
    candidate.status = MEMORY_CANDIDATE_STATUSES.REJECTED;
    candidate.updated_at = now();
    await record(businessScope(auth.tenant_id, businessId), 'memory-candidates', candidateId, candidate);
    await audit(auth, businessId, 'memory.candidate.rejected', 'memory_candidate', candidateId);
    return { ok: true, candidate };
  }

  async function correctMemory(ctx, businessId, memoryId, input = {}) {
    const auth = await authorize(ctx, businessId);
    if (!auth.ok) return auth;
    if (input.confirmed_by_user !== true) return { ok: false, error: 'MEMORY_CORRECTION_REQUIRES_USER_CONFIRMATION' };
    const old = await read(businessScope(auth.tenant_id, businessId), 'memory-facts', memoryId);
    if (!old || old.deleted_at) return { ok: false, error: 'MEMORY_NOT_FOUND' };
    const created = await writeMemoryFact(auth, businessId, {
      ...old, memory_id: undefined, value: clone(input.value), subject: input.subject || old.subject, status: MEMORY_STATUSES.CONFIRMED_FACT,
      source_type: input.source_type || 'user_statement', source_reference: input.source_reference || memoryId,
      supersedes: memoryId, confirmed_by_user: true, previous_status: old.status, valid_from: input.valid_from || now(), valid_until: null
    });
    if (!created.ok) return created;
    old.previous_status = old.status;
    old.status = MEMORY_STATUSES.HISTORICAL_FACT;
    old.superseded_by = created.fact.memory_id;
    old.valid_until = created.fact.valid_from;
    old.updated_at = now();
    await record(businessScope(auth.tenant_id, businessId), 'memory-facts', memoryId, old);
    await audit(auth, businessId, 'memory.corrected', 'memory_fact', created.fact.memory_id, { supersedes: memoryId });
    return { ok: true, previous: old, current: created.fact };
  }

  async function deleteMemory(ctx, businessId, memoryId, input = {}) {
    const auth = await authorize(ctx, businessId);
    if (!auth.ok) return auth;
    const fact = await read(businessScope(auth.tenant_id, businessId), 'memory-facts', memoryId);
    if (!fact) return { ok: false, error: 'MEMORY_NOT_FOUND' };
    fact.deleted_at = now();
    fact.updated_at = fact.deleted_at;
    fact.deletion_reason = clean(input.reason || 'user_request', 160);
    await record(businessScope(auth.tenant_id, businessId), 'memory-facts', memoryId, fact);
    await audit(auth, businessId, 'memory.deleted', 'memory_fact', memoryId, { reason: fact.deletion_reason });
    return { ok: true, deleted_memory_id: memoryId };
  }

  async function searchMemory(ctx, businessId, input = {}) {
    const auth = await authorize(ctx, businessId);
    if (!auth.ok) return auth;
    const facts = await list(businessScope(auth.tenant_id, businessId), 'memory-facts');
    const query = clean(input.query, 240).toLowerCase();
    const includeHistorical = input.include_historical === true;
    const filtered = facts.filter((fact) => !fact.deleted_at && (includeHistorical || ![MEMORY_STATUSES.HISTORICAL_FACT, MEMORY_STATUSES.OUTDATED_INFORMATION].includes(fact.status)) && (!query || `${fact.fact_key} ${fact.subject} ${JSON.stringify(fact.value)} ${fact.category}`.toLowerCase().includes(query)));
    return { ok: true, tenant_id: auth.tenant_id, business_id: businessId, facts: filtered };
  }

  async function createGoal(ctx, businessId, input = {}) {
    const auth = await authorize(ctx, businessId);
    if (!auth.ok) return auth;
    const goal = {
      goal_id: nextId('goal'), tenant_id: auth.tenant_id, business_id: businessId, title: clean(input.title), description: clean(input.description, 1000) || null,
      status: GOAL_STATUSES.includes(input.status) ? input.status : 'PROPOSED', priority: Number(input.priority || 0), target: clone(input.target ?? null),
      target_date: input.target_date || null, source: clean(input.source || 'user_statement', 80), user_confirmed: input.user_confirmed === true,
      created_at: now(), updated_at: now(), deleted_at: null
    };
    if (!goal.title) return { ok: false, error: 'GOAL_TITLE_REQUIRED' };
    if (goal.status === 'ACTIVE' && !goal.user_confirmed) return { ok: false, error: 'ACTIVE_GOAL_REQUIRES_USER_CONFIRMATION' };
    await record(businessScope(auth.tenant_id, businessId), 'goals', goal.goal_id, goal);
    await audit(auth, businessId, 'goal.created', 'goal', goal.goal_id, { status: goal.status });
    return { ok: true, goal };
  }

  async function updateGoal(ctx, businessId, goalId, patch = {}) {
    const auth = await authorize(ctx, businessId);
    if (!auth.ok) return auth;
    const goal = await read(businessScope(auth.tenant_id, businessId), 'goals', goalId);
    if (!goal || goal.deleted_at) return { ok: false, error: 'GOAL_NOT_FOUND' };
    const meaningful = ['title', 'description', 'target', 'target_date', 'status', 'priority'].some((key) => key in patch);
    if (meaningful && patch.user_confirmed !== true) return { ok: false, error: 'GOAL_CHANGE_REQUIRES_USER_CONFIRMATION' };
    const before = clone(goal);
    for (const key of ['title', 'description', 'target', 'target_date', 'status', 'priority']) if (key in patch) goal[key] = clone(patch[key]);
    if (!GOAL_STATUSES.includes(goal.status)) return { ok: false, error: 'GOAL_STATUS_INVALID' };
    goal.user_confirmed = true;
    goal.updated_at = now();
    await record(businessScope(auth.tenant_id, businessId), 'goals', goalId, goal);
    await audit(auth, businessId, 'goal.changed', 'goal', goalId, { before, after: goal });
    return { ok: true, goal };
  }

  async function recordDecision(ctx, businessId, input = {}) {
    const auth = await authorize(ctx, businessId);
    if (!auth.ok) return auth;
    const decision = {
      decision_id: nextId('decision'), tenant_id: auth.tenant_id, business_id: businessId, title: clean(input.title), decision: clean(input.decision, 2000),
      reasoning_summary: clean(input.reasoning_summary, 2000) || null, alternatives_considered: Array.isArray(input.alternatives_considered) ? clone(input.alternatives_considered) : [],
      expected_outcome: clone(input.expected_outcome ?? null), actual_outcome: null, status: DECISION_STATUSES.includes(input.status) ? input.status : 'RECORDED',
      decided_at: input.decided_at || now(), review_at: input.review_at || null, source: clean(input.source || 'user_statement', 80), created_by: auth.user_id,
      created_at: now(), updated_at: now(), deleted_at: null
    };
    if (!decision.title || !decision.decision) return { ok: false, error: 'DECISION_CONTENT_REQUIRED' };
    await record(businessScope(auth.tenant_id, businessId), 'decisions', decision.decision_id, decision);
    await audit(auth, businessId, 'decision.recorded', 'decision', decision.decision_id);
    return { ok: true, decision };
  }

  async function recordDecisionOutcome(ctx, businessId, decisionId, input = {}) {
    const auth = await authorize(ctx, businessId);
    if (!auth.ok) return auth;
    const decision = await read(businessScope(auth.tenant_id, businessId), 'decisions', decisionId);
    if (!decision || decision.deleted_at) return { ok: false, error: 'DECISION_NOT_FOUND' };
    decision.actual_outcome = clone(input.actual_outcome ?? null);
    decision.status = 'OUTCOME_RECORDED';
    decision.updated_at = now();
    await record(businessScope(auth.tenant_id, businessId), 'decisions', decisionId, decision);
    await audit(auth, businessId, 'decision.outcome_recorded', 'decision', decisionId);
    return { ok: true, decision };
  }

  async function getBusinessState(ctx, businessId) {
    const auth = await authorize(ctx, businessId);
    if (!auth.ok) return auth;
    const scope = businessScope(auth.tenant_id, businessId);
    const facts = await list(scope, 'memory-facts');
    const goals = (await list(scope, 'goals')).filter((goal) => !goal.deleted_at && ['ACTIVE', 'PROPOSED'].includes(goal.status));
    const decisions = (await list(scope, 'decisions')).filter((decision) => !decision.deleted_at && decision.status !== 'SUPERSEDED');
    const currentFacts = resolveCurrentFacts(facts);
    return {
      ok: true,
      snapshot: {
        schema: 'aurentara.customer-ai.business-state-snapshot.v1', tenant_id: auth.tenant_id, business_id: businessId,
        business: clone(auth.business), current_facts: currentFacts, active_goals: goals, decisions,
        generated_at: now(), excludes_superseded_as_current: true,
        provenance_refs: currentFacts.map((fact) => ({ memory_id: fact.memory_id, source_type: fact.source_type, source_reference: fact.source_reference }))
      }
    };
  }

  async function getRelevantContext(ctx, businessId, input = {}) {
    const auth = await authorize(ctx, businessId);
    if (!auth.ok) return auth;
    const scope = businessScope(auth.tenant_id, businessId);
    const tenant = await read(tenantScope(auth.tenant_id), 'tenant', auth.tenant_id);
    const facts = await list(scope, 'memory-facts');
    const goals = await list(scope, 'goals');
    const decisions = await list(scope, 'decisions');
    const state = await getBusinessState(ctx, businessId);
    const semantic = semanticRetrievalContract({ tenant_id: auth.tenant_id, business_id: businessId });
    return {
      ok: true,
      semantic_retrieval_contract: semantic.contract,
      context: buildContextPackage({ tenant, business: auth.business, business_state: state.snapshot, facts, goals, decisions, query: input.query, max_facts: input.max_facts, max_goals: input.max_goals, max_decisions: input.max_decisions, include_historical: input.include_historical === true })
    };
  }

  async function getGoals(ctx, businessId) {
    const auth = await authorize(ctx, businessId);
    if (!auth.ok) return auth;
    return { ok: true, goals: (await list(businessScope(auth.tenant_id, businessId), 'goals')).filter((goal) => !goal.deleted_at) };
  }

  async function getDecisions(ctx, businessId) {
    const auth = await authorize(ctx, businessId);
    if (!auth.ok) return auth;
    return { ok: true, decisions: (await list(businessScope(auth.tenant_id, businessId), 'decisions')).filter((decision) => !decision.deleted_at) };
  }

  async function exportBusiness(ctx, businessId) {
    const auth = await authorize(ctx, businessId);
    if (!auth.ok) return auth;
    const scope = businessScope(auth.tenant_id, businessId);
    const collections = ['memory-facts', 'memory-candidates', 'goals', 'decisions', 'audit'];
    const data = { business: clone(auth.business) };
    for (const collection of collections) data[collection] = await list(scope, collection);
    return { ok: true, schema: 'aurentara.customer-ai.export.v1', tenant_id: auth.tenant_id, business_id: businessId, exported_at: now(), data };
  }

  async function buildDeletionPlan(ctx, businessId) {
    const auth = await authorize(ctx, businessId);
    if (!auth.ok) return auth;
    const scope = businessScope(auth.tenant_id, businessId);
    const collections = ['business', 'memory-facts', 'memory-candidates', 'goals', 'decisions', 'audit', 'deletion-jobs'];
    const counts = {};
    for (const collection of collections) counts[collection] = (await list(scope, collection)).length;
    return {
      ok: true,
      plan: {
        schema: 'aurentara.customer-ai.deletion-plan.v1', tenant_id: auth.tenant_id, business_id: businessId, scope,
        collections, counts, vector_index_scope: { tenant_id: auth.tenant_id, business_id: businessId },
        cache_scope_prefix: `${auth.tenant_id}:${businessId}:`, requires_storage_cleanup: true,
        production_executor_implemented: false
      }
    };
  }

  return {
    manifest: customerAiFoundationManifest,
    createTenant, addMembership, createBusiness, createMemoryCandidate, acceptMemoryCandidate, rejectMemoryCandidate,
    addConfirmedMemory, addInferredMemory, correctMemory, deleteMemory, searchMemory,
    createGoal, updateGoal, getGoals, recordDecision, recordDecisionOutcome, getDecisions,
    getBusinessState, getRelevantContext, exportBusiness, buildDeletionPlan,
    semanticRetrievalContract,
    async getAudit(ctx, businessId) {
      const auth = await authorize(ctx, businessId);
      if (!auth.ok) return auth;
      return { ok: true, events: await list(businessScope(auth.tenant_id, businessId), 'audit') };
    }
  };
}
