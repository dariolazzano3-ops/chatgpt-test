import { normalizeResearchSource } from '../customer-ai/trusted-research-v1.js';

const clean = (value, max = 1000) => String(value ?? '').trim().slice(0, max);
const clone = (value) => structuredClone(value ?? null);
const now = () => new Date().toISOString();
const canInvoke = (options, fn) => Boolean(fn) && (options.provider_active === true || options.production_active === true || options.sink_active === true || options.synthetic_fixture === true);

function parseCustomerScope(scope = '') {
  const value = clean(scope, 360);
  if (!value) return null;
  if (value.startsWith('tenant:')) {
    const tenantId = clean(value.slice(7), 120);
    return tenantId ? { tenant_id: tenantId, scope: value, scope_kind: 'tenant' } : null;
  }
  const [tenantId, businessId, ...rest] = value.split(':');
  if (!tenantId || !businessId || rest.length) return null;
  return { tenant_id: clean(tenantId, 120), business_id: clean(businessId, 120), scope: value, scope_kind: 'business' };
}

export function productionActivationContractsManifest() {
  return {
    version: 'aurentara.personal-business-ai.production-activation-contracts.v1',
    identity_adapter_contract_ready: true,
    durable_store_contract_ready: true,
    trusted_retrieval_adapter_contract_ready: true,
    distributed_rate_adapter_contract_ready: true,
    deletion_executor_contract_ready: true,
    observability_contract_ready: true,
    provider_neutral: true,
    external_callback_execution_requires_activation: true,
    synthetic_fixture_override_explicit: true,
    production_identity_active: false,
    production_store_active: false,
    live_retrieval_active: false,
    distributed_rate_limit_active: false,
    production_deletion_active: false,
    production_observability_active: false,
    production_deploy: false,
    real_customer_data_used: false,
    paid_api_calls: false
  };
}

export function createCustomerIdentityAdapter(options = {}) {
  const verify = typeof options.verify_assertion === 'function' ? options.verify_assertion : null;
  return {
    manifest() {
      return { schema: 'aurentara.customer.identity-adapter.v1', contract_ready: true, provider_active: Boolean(verify) && options.provider_active === true, synthetic_fixture: options.synthetic_fixture === true, tenant_membership_required: true, operator_access: false };
    },
    async resolve(input = {}) {
      if (!verify) return { ok: false, error: 'CUSTOMER_IDENTITY_PROVIDER_NOT_CONFIGURED' };
      if (!canInvoke(options, verify)) return { ok: false, error: 'CUSTOMER_IDENTITY_PROVIDER_ACTIVATION_REQUIRED' };
      const verified = await verify(clone(input.assertion));
      if (!verified?.ok) return { ok: false, error: verified?.error || 'CUSTOMER_IDENTITY_ASSERTION_INVALID' };
      const userId = clean(verified.user_id, 120);
      const sessionId = clean(verified.session_id, 180);
      const requestedTenant = clean(input.tenant_id, 120);
      const memberships = Array.isArray(verified.memberships) ? verified.memberships : [];
      const membership = memberships.find((item) => clean(item?.tenant_id, 120) === requestedTenant && item?.status === 'active');
      if (!userId || !sessionId || !requestedTenant || !membership) return { ok: false, error: 'CUSTOMER_TENANT_MEMBERSHIP_REQUIRED' };
      return {
        ok: true,
        principal: {
          schema: 'aurentara.customer.principal.v1',
          user_id: userId,
          session_id: sessionId,
          tenant_id: requestedTenant,
          role: clean(membership.role || 'member', 40),
          authenticated_at: verified.authenticated_at || now(),
          synthetic: verified.synthetic === true,
          operator_access: false
        }
      };
    }
  };
}

export function createDeterministicCustomerStoreDriver() {
  const records = new Map();
  const key = (input) => `${input.tenant_id}|${input.scope}|${input.collection}|${input.id}`;
  return {
    schema: 'aurentara.customer-store-driver.deterministic.v1',
    async get(input) { return clone(records.get(key(input)) ?? null); },
    async put(input) {
      const k = key(input);
      const current = records.get(k);
      const revision = Number(current?.revision || 0);
      if (input.expected_revision !== undefined && Number(input.expected_revision) !== revision) {
        return { ok: false, error: 'STORE_REVISION_CONFLICT', expected_revision: Number(input.expected_revision), actual_revision: revision };
      }
      const next = { revision: revision + 1, value: clone(input.value) };
      records.set(k, next);
      return { ok: true, ...clone(next) };
    },
    async list(input) {
      const prefix = `${input.tenant_id}|${input.scope}|${input.collection}|`;
      return [...records.entries()].filter(([k]) => k.startsWith(prefix)).map(([k, entry]) => ({ id: k.slice(prefix.length), revision: entry.revision, value: clone(entry.value) }));
    },
    async purgeTenant(input) {
      const prefix = `${input.tenant_id}|`;
      let deleted = 0;
      for (const k of [...records.keys()]) if (k.startsWith(prefix)) { records.delete(k); deleted += 1; }
      return { ok: true, deleted_records: deleted };
    },
    count() { return records.size; }
  };
}

export function createDurableCustomerStoreAdapter(options = {}) {
  const driver = options.driver;
  const ready = driver && ['get','put','list','purgeTenant'].every((name) => typeof driver[name] === 'function');
  const active = ready && (options.production_active === true || options.synthetic_fixture === true);
  function parsed(scope) {
    const scopeInfo = parseCustomerScope(scope);
    return scopeInfo || { error: 'CUSTOMER_STORE_SCOPE_INVALID' };
  }
  return {
    schema: 'aurentara.customer-store-adapter.v1',
    manifest() { return { contract_ready: true, driver_configured: Boolean(ready), tenant_scope_parsed_before_driver: true, optimistic_revision_control: true, purge_supported: true, production_active: options.production_active === true, synthetic_fixture: options.synthetic_fixture === true }; },
    async get(scope, collection, id) {
      if (!active) return null;
      const s = parsed(scope); if (s.error) return null;
      return driver.get({ ...s, collection: clean(collection, 120), id: clean(id, 180) });
    },
    async put(scope, collection, id, value, writeOptions = {}) {
      if (!ready) return { ok: false, error: 'CUSTOMER_STORE_DRIVER_NOT_CONFIGURED' };
      if (!active) return { ok: false, error: 'CUSTOMER_STORE_ACTIVATION_REQUIRED' };
      const s = parsed(scope); if (s.error) return { ok: false, error: s.error };
      return driver.put({ ...s, collection: clean(collection, 120), id: clean(id, 180), value: clone(value), expected_revision: writeOptions.expected_revision });
    },
    async list(scope, collection) {
      if (!active) return [];
      const s = parsed(scope); if (s.error) return [];
      return driver.list({ ...s, collection: clean(collection, 120) });
    },
    async purgeTenant(tenantId, input = {}) {
      const id = clean(tenantId, 120);
      if (!ready || !id) return { ok: false, error: 'CUSTOMER_STORE_PURGE_NOT_READY' };
      if (!active) return { ok: false, error: 'CUSTOMER_STORE_ACTIVATION_REQUIRED' };
      if (input.synthetic !== true && options.production_activation_approved !== true) return { ok: false, error: 'PRODUCTION_DELETION_APPROVAL_REQUIRED' };
      return driver.purgeTenant({ tenant_id: id, reason: clean(input.reason || 'user_request', 240), audit_id: clean(input.audit_id, 180) || null });
    }
  };
}

export function createTrustedRetrievalAdapter(options = {}) {
  const retrieve = typeof options.retrieve === 'function' ? options.retrieve : null;
  return {
    manifest() { return { schema: 'aurentara.customer.trusted-retrieval-adapter.v1', contract_ready: true, provider_active: options.provider_active === true && Boolean(retrieve), synthetic_fixture: options.synthetic_fixture === true, source_policy_bypass_allowed: false, output_contract: 'Block03 normalized research sources' }; },
    async retrieve(input = {}) {
      if (!retrieve) return { ok: false, error: 'TRUSTED_RETRIEVAL_PROVIDER_NOT_CONFIGURED', sources: [] };
      if (!canInvoke(options, retrieve)) return { ok: false, error: 'TRUSTED_RETRIEVAL_PROVIDER_ACTIVATION_REQUIRED', sources: [] };
      const raw = await retrieve({ query: clean(input.query, 4000), jurisdiction: clean(input.jurisdiction, 120) || null, max_sources: Math.max(1, Math.min(Number(input.max_sources || 8), 12)) });
      if (!raw?.ok) return { ok: false, error: raw?.error || 'TRUSTED_RETRIEVAL_FAILED', sources: [] };
      const sources = (Array.isArray(raw.sources) ? raw.sources : []).slice(0, 12).map((source, index) => normalizeResearchSource(source, index, { retrieved_at: input.retrieved_at || now() }));
      return { ok: true, sources, source_content_is_untrusted_data: true, policy_evaluation_required: true };
    }
  };
}

export function createDistributedRateLimitAdapter(options = {}) {
  const decide = typeof options.decide === 'function' ? options.decide : null;
  return {
    manifest() { return { schema: 'aurentara.customer.distributed-rate-adapter.v1', contract_ready: true, provider_active: options.provider_active === true && Boolean(decide), synthetic_fixture: options.synthetic_fixture === true, fail_open: false, local_abuse_guard_replaced: false }; },
    async check(input = {}) {
      if (!decide) return { ok: false, limited: true, error: 'DISTRIBUTED_RATE_LIMIT_PROVIDER_NOT_CONFIGURED' };
      if (!canInvoke(options, decide)) return { ok: false, limited: true, error: 'DISTRIBUTED_RATE_LIMIT_PROVIDER_ACTIVATION_REQUIRED' };
      const result = await decide({ key: clean(input.key, 300), route_class: clean(input.route_class, 80), limit: Math.max(1, Number(input.limit || 1)), window_ms: Math.max(1000, Number(input.window_ms || 60_000)), cost_units: Math.max(0, Number(input.cost_units || 1)) });
      if (!result?.ok) return { ok: false, limited: true, error: result?.error || 'DISTRIBUTED_RATE_LIMIT_UNAVAILABLE', retry_after_seconds: Math.max(1, Number(result?.retry_after_seconds || 1)) };
      if (result.limited === true) return { ok: false, limited: true, error: 'CUSTOMER_RATE_LIMITED', remaining: 0, retry_after_seconds: Math.max(1, Number(result.retry_after_seconds || 1)) };
      return { ok: true, limited: false, remaining: Math.max(0, Number(result.remaining ?? 0)), retry_after_seconds: 0 };
    }
  };
}

export function createCustomerDeletionExecutor(options = {}) {
  const store = options.store;
  const purgeTargets = options.purge_targets && typeof options.purge_targets === 'object' ? options.purge_targets : {};
  const requiredExternalScopes = ['cache_vector_scopes'];
  function plan(input = {}) {
    const tenantId = clean(input.tenant_id, 120);
    if (!tenantId) return { ok: false, error: 'DELETION_TENANT_REQUIRED' };
    return { ok: true, plan: { schema: 'aurentara.customer.deletion-plan.v1', tenant_id: tenantId, store_scope: 'all_customer_store_records', external_scopes: [...requiredExternalScopes], covered_records: ['tenant','membership','business','conversation','memory','goal','decision','usage'], hard_delete: true, audit_required: true, generated_at: now() } };
  }
  return {
    manifest() { return { schema: 'aurentara.customer.deletion-executor.v1', contract_ready: true, production_active: options.production_active === true, audit_required: true, user_confirmation_required: true, required_external_scopes: [...requiredExternalScopes], preflight_before_delete: true }; },
    plan,
    async execute(input = {}) {
      if (input.user_confirmed !== true) return { ok: false, error: 'DELETION_USER_CONFIRMATION_REQUIRED' };
      const planned = plan(input); if (!planned.ok) return planned;
      if (!store || typeof store.purgeTenant !== 'function') return { ok: false, error: 'DELETION_STORE_ADAPTER_REQUIRED' };
      const auditId = clean(input.audit_id, 180);
      if (!auditId) return { ok: false, error: 'DELETION_AUDIT_ID_REQUIRED' };
      const missingTargets = requiredExternalScopes.filter((scope) => typeof purgeTargets[scope] !== 'function');
      if (missingTargets.length) return { ok: false, error: 'DELETION_PURGE_TARGET_NOT_CONFIGURED', missing_scopes: missingTargets };
      if (input.synthetic !== true && options.production_active !== true) return { ok: false, error: 'PRODUCTION_DELETION_ACTIVATION_REQUIRED' };
      const externalResults = [];
      for (const scope of requiredExternalScopes) {
        const checked = await purgeTargets[scope]({ tenant_id: planned.plan.tenant_id, audit_id: auditId, synthetic: input.synthetic === true, dry_run: true });
        if (checked?.ok === false) return { ok: false, error: 'DELETION_PURGE_PREFLIGHT_FAILED', scope, cause: checked.error || null };
      }
      const deleted = await store.purgeTenant(planned.plan.tenant_id, { synthetic: input.synthetic === true, reason: input.reason, audit_id: auditId });
      if (!deleted.ok) return deleted;
      for (const scope of requiredExternalScopes) {
        const result = await purgeTargets[scope]({ tenant_id: planned.plan.tenant_id, audit_id: auditId, synthetic: input.synthetic === true, dry_run: false });
        if (result?.ok === false) return { ok: false, error: 'DELETION_EXTERNAL_PURGE_FAILED', scope, cause: result.error || null, store_deleted_records: Number(deleted.deleted_records || 0) };
        externalResults.push({ scope, ok: true, deleted_items: Math.max(0, Number(result?.deleted_items || 0)) });
      }
      return { ok: true, audit_id: auditId, tenant_id: planned.plan.tenant_id, deleted_records: Number(deleted.deleted_records || 0), external_results: externalResults, completed_at: now(), production: input.synthetic !== true };
    }
  };
}

const SENSITIVE_KEY = /(message|prompt|answer|content|evidence|email|phone|authorization|cookie|token|secret|password|raw_text|source_text)/i;
function redactString(value) {
  return String(value).slice(0, 500)
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[REDACTED_EMAIL]')
    .replace(/Bearer\s+[^\s,;]+/gi, 'Bearer [REDACTED]');
}
function redact(value, depth = 0) {
  if (depth > 6) return '[TRUNCATED]';
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => redact(item, depth + 1));
  if (!value || typeof value !== 'object') return typeof value === 'string' ? redactString(value) : value;
  const out = {};
  for (const [key, item] of Object.entries(value)) out[key] = SENSITIVE_KEY.test(key) ? '[REDACTED]' : redact(item, depth + 1);
  return out;
}

export function createCustomerObservabilityAdapter(options = {}) {
  const emit = typeof options.emit === 'function' ? options.emit : null;
  return {
    manifest() { return { schema: 'aurentara.customer.observability-adapter.v1', contract_ready: true, sink_active: options.sink_active === true && Boolean(emit), synthetic_fixture: options.synthetic_fixture === true, redact_before_sink: true, raw_prompt_logging: false, raw_customer_content_logging: false }; },
    async record(input = {}) {
      const eventName = clean(input.event_name, 120);
      if (!eventName) return { ok: false, error: 'OBSERVABILITY_EVENT_NAME_REQUIRED' };
      const event = { schema: 'aurentara.customer.observability-event.v1', event_name: eventName, severity: ['INFO','WARN','ERROR','CRITICAL'].includes(input.severity) ? input.severity : 'INFO', tenant_id: clean(input.tenant_id, 120) || null, business_id: clean(input.business_id, 120) || null, occurred_at: input.occurred_at || now(), attributes: redact(clone(input.attributes || {})) };
      if (!emit) return { ok: false, error: 'OBSERVABILITY_SINK_NOT_CONFIGURED', event };
      if (!canInvoke(options, emit)) return { ok: false, error: 'OBSERVABILITY_SINK_ACTIVATION_REQUIRED', event };
      const result = await emit(clone(event));
      return result?.ok === false ? { ok: false, error: result.error || 'OBSERVABILITY_SINK_FAILED', event } : { ok: true, event };
    },
    redact
  };
}
