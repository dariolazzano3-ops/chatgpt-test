import {
  createTrustedRetrievalAdapter,
  createDistributedRateLimitAdapter,
  createCustomerDeletionExecutor,
  createCustomerObservabilityAdapter
} from './production-activation-contracts-v1.js';

const clean = (value, max = 1000) => String(value ?? '').trim().slice(0, max);
const clone = (value) => structuredClone(value ?? null);
const HEX_HASH = /^[a-f0-9]{32,128}$/i;

export const CUSTOMER_OBSERVABILITY_EVENTS_V1 = Object.freeze([
  'customer.request.completed',
  'customer.request.failed',
  'customer.rate_limited',
  'customer.research.blocked',
  'customer.compute.threshold',
  'customer.deletion.completed',
  'customer.security.signal',
  'customer.availability.signal'
]);

function activationAllowed(options = {}) {
  return options.provider_active === true || options.production_active === true || options.sink_active === true || options.synthetic_fixture === true;
}

export function externalCapabilityBindingsManifest() {
  return {
    version: 'aurentara.personal-business-ai.external-capability-bindings.v1',
    trusted_retrieval_binding_ready: true,
    distributed_abuse_binding_ready: true,
    auxiliary_purge_binding_ready: true,
    observability_binding_ready: true,
    all_external_callbacks_require_activation: true,
    synthetic_fixture_override_explicit: true,
    raw_customer_identity_in_rate_key_forbidden: true,
    trusted_source_policy_bypass_forbidden: true,
    purge_preflight_required: true,
    observability_redaction_before_sink_required: true,
    live_trusted_retrieval_active: false,
    distributed_rate_limit_active: false,
    production_deletion_active: false,
    production_observability_active: false,
    real_customer_data_used: false,
    public_customer_traffic_active: false,
    paid_api_calls: false,
    variable_cost_eur: 0
  };
}

export function createCustomerTrustedRetrievalBinding(options = {}) {
  const providerId = clean(options.provider_id || 'unconfigured', 100);
  const retrieve = typeof options.retrieve === 'function' ? options.retrieve : null;
  const adapter = createTrustedRetrievalAdapter({
    provider_active: options.provider_active === true,
    synthetic_fixture: options.synthetic_fixture === true,
    retrieve: retrieve ? async (input) => {
      const result = await retrieve({ ...clone(input), provider_id: providerId });
      if (!result?.ok) return result;
      return { ok: true, sources: Array.isArray(result.sources) ? result.sources : [] };
    } : null
  });

  return {
    manifest() {
      const base = adapter.manifest();
      return {
        schema: 'aurentara.customer.trusted-retrieval-binding.v1',
        contract_ready: true,
        provider_id: providerId,
        provider_active: base.provider_active,
        synthetic_fixture: options.synthetic_fixture === true,
        source_policy_bypass_allowed: false,
        output_requires_block03_policy_evaluation: true,
        source_content_is_untrusted_data: true
      };
    },
    async retrieve(input = {}) {
      const query = clean(input.query, 4000);
      const jurisdiction = clean(input.jurisdiction, 120);
      if (!query) return { ok: false, error: 'TRUSTED_RETRIEVAL_QUERY_REQUIRED', sources: [] };
      if (!jurisdiction) return { ok: false, error: 'TRUSTED_RETRIEVAL_JURISDICTION_REQUIRED', sources: [] };
      const result = await adapter.retrieve({ query, jurisdiction, max_sources: input.max_sources, retrieved_at: input.retrieved_at });
      if (!result.ok) return result;
      return {
        ...result,
        provider_id: providerId,
        policy_evaluation_required: true,
        source_content_is_untrusted_data: true
      };
    }
  };
}

export function createCustomerDistributedAbuseBinding(options = {}) {
  const providerId = clean(options.provider_id || 'unconfigured', 100);
  const decide = typeof options.decide === 'function' ? options.decide : null;
  const adapter = createDistributedRateLimitAdapter({
    provider_active: options.provider_active === true,
    synthetic_fixture: options.synthetic_fixture === true,
    decide: decide ? async (input) => decide({ ...clone(input), provider_id: providerId }) : null
  });

  return {
    manifest() {
      return {
        schema: 'aurentara.customer.distributed-abuse-binding.v1',
        contract_ready: true,
        provider_id: providerId,
        provider_active: adapter.manifest().provider_active,
        synthetic_fixture: options.synthetic_fixture === true,
        fail_open: false,
        subject_hash_required: true,
        raw_customer_identity_in_key: false,
        local_abuse_guard_replaced: false
      };
    },
    async check(input = {}) {
      const tenantId = clean(input.tenant_id, 120);
      const routeClass = clean(input.route_class, 80);
      const subjectHash = clean(input.subject_hash, 160);
      if (!tenantId || !routeClass) return { ok: false, limited: true, error: 'DISTRIBUTED_RATE_SCOPE_REQUIRED' };
      if (!HEX_HASH.test(subjectHash)) return { ok: false, limited: true, error: 'DISTRIBUTED_RATE_SUBJECT_HASH_REQUIRED' };
      return adapter.check({
        key: `tenant:${tenantId}:route:${routeClass}:subject:${subjectHash.toLowerCase()}`,
        route_class: routeClass,
        limit: input.limit,
        window_ms: input.window_ms,
        cost_units: input.cost_units
      });
    }
  };
}

export function createCustomerAuxiliaryPurgeBinding(options = {}) {
  const targets = {
    cache: typeof options.purge_cache === 'function' ? options.purge_cache : null,
    vector: typeof options.purge_vector === 'function' ? options.purge_vector : null,
    object_storage: typeof options.purge_object_storage === 'function' ? options.purge_object_storage : null
  };
  const configured = Object.values(targets).every(Boolean);

  return {
    manifest() {
      return {
        schema: 'aurentara.customer.auxiliary-purge-binding.v1',
        contract_ready: true,
        all_targets_configured: configured,
        required_targets: Object.keys(targets),
        preflight_before_delete: true,
        production_active: options.production_active === true,
        synthetic_fixture: options.synthetic_fixture === true
      };
    },
    async purge(input = {}) {
      const tenantId = clean(input.tenant_id, 120);
      const auditId = clean(input.audit_id, 180);
      const dryRun = input.dry_run === true;
      if (!tenantId || !auditId) return { ok: false, error: 'AUXILIARY_PURGE_SCOPE_REQUIRED' };
      if (!configured) return { ok: false, error: 'AUXILIARY_PURGE_TARGETS_REQUIRED', missing_targets: Object.entries(targets).filter(([, fn]) => !fn).map(([name]) => name) };
      if (!activationAllowed(options)) return { ok: false, error: 'AUXILIARY_PURGE_ACTIVATION_REQUIRED' };
      const results = [];
      for (const [scope, fn] of Object.entries(targets)) {
        const result = await fn({ tenant_id: tenantId, audit_id: auditId, dry_run: dryRun, synthetic: options.synthetic_fixture === true });
        if (result?.ok === false) return { ok: false, error: dryRun ? 'AUXILIARY_PURGE_PREFLIGHT_FAILED' : 'AUXILIARY_PURGE_FAILED', scope, cause: result.error || null };
        results.push({ scope, ok: true, deleted_items: Math.max(0, Number(result?.deleted_items || 0)) });
      }
      return { ok: true, dry_run: dryRun, results, deleted_items: results.reduce((sum, item) => sum + item.deleted_items, 0) };
    }
  };
}

export function createCustomerDeletionBinding(options = {}) {
  const auxiliary = options.auxiliary_purge || createCustomerAuxiliaryPurgeBinding(options);
  const executor = createCustomerDeletionExecutor({
    store: options.store,
    production_active: options.production_active === true,
    purge_targets: {
      cache_vector_scopes: async (input) => auxiliary.purge(input)
    }
  });

  return {
    manifest() {
      return {
        schema: 'aurentara.customer.deletion-binding.v1',
        contract_ready: true,
        executor: executor.manifest(),
        auxiliary: auxiliary.manifest(),
        user_confirmation_required: true,
        audit_required: true,
        preflight_before_delete: true,
        production_active: options.production_active === true
      };
    },
    plan: executor.plan,
    execute: executor.execute
  };
}

export function createCustomerObservabilityBinding(options = {}) {
  const providerId = clean(options.provider_id || 'unconfigured', 100);
  const emit = typeof options.emit === 'function' ? options.emit : null;
  const adapter = createCustomerObservabilityAdapter({
    sink_active: options.sink_active === true,
    synthetic_fixture: options.synthetic_fixture === true,
    emit: emit ? async (event) => emit({ ...clone(event), provider_id: providerId }) : null
  });

  return {
    manifest() {
      return {
        schema: 'aurentara.customer.observability-binding.v1',
        contract_ready: true,
        provider_id: providerId,
        sink_active: adapter.manifest().sink_active,
        synthetic_fixture: options.synthetic_fixture === true,
        allowed_events: [...CUSTOMER_OBSERVABILITY_EVENTS_V1],
        redact_before_sink: true,
        raw_prompt_logging: false,
        raw_customer_content_logging: false
      };
    },
    async record(input = {}) {
      const eventName = clean(input.event_name, 120);
      if (!CUSTOMER_OBSERVABILITY_EVENTS_V1.includes(eventName)) return { ok: false, error: 'OBSERVABILITY_EVENT_NOT_ALLOWED' };
      return adapter.record({
        event_name: eventName,
        severity: input.severity,
        tenant_id: input.tenant_id,
        business_id: input.business_id,
        occurred_at: input.occurred_at,
        attributes: clone(input.attributes || {})
      });
    }
  };
}

export function createExternalCustomerCapabilityBundle(options = {}) {
  const retrieval = createCustomerTrustedRetrievalBinding(options.retrieval || {});
  const abuse = createCustomerDistributedAbuseBinding(options.abuse || {});
  const auxiliaryPurge = createCustomerAuxiliaryPurgeBinding(options.deletion || {});
  const deletion = createCustomerDeletionBinding({ ...(options.deletion || {}), auxiliary_purge: auxiliaryPurge });
  const observability = createCustomerObservabilityBinding(options.observability || {});

  return {
    manifest() {
      const parts = {
        retrieval: retrieval.manifest(),
        abuse: abuse.manifest(),
        deletion: deletion.manifest(),
        observability: observability.manifest()
      };
      return {
        schema: 'aurentara.customer.external-capability-bundle.v1',
        contract_ready: true,
        technical_bindings_ready: Object.values(parts).every((item) => item.contract_ready === true),
        parts,
        live_external_activation_performed: false,
        real_customer_data_used: false,
        public_customer_traffic_active: false
      };
    },
    retrieval,
    abuse,
    deletion,
    observability
  };
}
