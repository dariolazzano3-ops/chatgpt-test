import {
  createCustomerIdentityAdapter,
  createDurableCustomerStoreAdapter,
  createDeterministicCustomerStoreDriver
} from './production-activation-contracts-v1.js';

const clean = (value, max = 500) => String(value ?? '').trim().slice(0, max);
const clone = (value) => structuredClone(value ?? null);

const KNOWN_COLLECTIONS = Object.freeze(new Set([
  'tenant', 'memberships', 'businesses', 'memory-facts', 'memory-candidates', 'goals', 'decisions',
  'business-state-snapshots', 'audit', 'deletion-jobs', 'conversations', 'messages',
  'entitlements', 'usage', 'events', 'subscriptions', 'projection'
]));

export function parseSupabaseProjectRef(input = '') {
  const value = clean(input, 1000);
  if (!value) return null;
  if (/^[a-z0-9]{20}$/i.test(value)) return value.toLowerCase();
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return null;
    const match = url.hostname.match(/^([a-z0-9]{20})\.supabase\.co$/i);
    return match ? match[1].toLowerCase() : null;
  } catch {
    return null;
  }
}

export function validateDedicatedCustomerPlane(input = {}) {
  const customerRef = parseSupabaseProjectRef(input.customer_project_ref || input.customer_supabase_url);
  const operatorRef = parseSupabaseProjectRef(input.operator_project_ref || input.operator_supabase_url);
  if (!customerRef) return { ok: false, error: 'CUSTOMER_DATA_PLANE_PROJECT_REF_REQUIRED' };
  if (!operatorRef) return { ok: false, error: 'OPERATOR_DATA_PLANE_PROJECT_REF_REQUIRED' };
  if (customerRef === operatorRef) {
    return {
      ok: false,
      error: 'CUSTOMER_OPERATOR_DATA_PLANE_COLLISION',
      customer_project_ref: customerRef,
      operator_project_ref: operatorRef
    };
  }
  return {
    ok: true,
    customer_project_ref: customerRef,
    operator_project_ref: operatorRef,
    customer_operator_plane_separate: true
  };
}

function invocationAllowed(options = {}) {
  return options.provider_active === true || options.synthetic_fixture === true;
}

export function dedicatedRuntimeBindingsManifest() {
  return {
    version: 'aurentara.personal-business-ai.dedicated-runtime-bindings.v1',
    identity_binding_contract_ready: true,
    durable_store_binding_contract_ready: true,
    dedicated_customer_project_required: true,
    operator_project_reuse_forbidden: true,
    browser_service_role_key_forbidden: true,
    provider_callbacks_require_activation: true,
    known_collection_allowlist: [...KNOWN_COLLECTIONS],
    production_customer_project_provisioned: false,
    production_identity_active: false,
    production_store_active: false,
    real_customer_data_used: false,
    production_deploy: false,
    variable_cost_eur: 0
  };
}

export function createSupabaseCustomerIdentityBinding(options = {}) {
  const config = validateDedicatedCustomerPlane(options);
  const verifyAccessToken = typeof options.verify_access_token === 'function' ? options.verify_access_token : null;
  const loadMemberships = typeof options.load_memberships === 'function' ? options.load_memberships : null;

  const adapter = createCustomerIdentityAdapter({
    provider_active: invocationAllowed(options),
    synthetic_fixture: options.synthetic_fixture === true,
    verify_assertion: async (assertion = {}) => {
      if (!config.ok) return config;
      if (!verifyAccessToken || !loadMemberships) return { ok: false, error: 'CUSTOMER_IDENTITY_BINDING_CALLBACKS_REQUIRED' };
      const verified = await verifyAccessToken({
        access_token: clean(assertion.access_token, 12000),
        expected_project_ref: config.customer_project_ref
      });
      if (!verified?.ok) return { ok: false, error: verified?.error || 'CUSTOMER_ACCESS_TOKEN_INVALID' };
      const issuerRef = parseSupabaseProjectRef(verified.project_ref || verified.issuer || '');
      if (issuerRef !== config.customer_project_ref) return { ok: false, error: 'CUSTOMER_IDENTITY_PROJECT_MISMATCH' };
      const userId = clean(verified.user_id || verified.sub, 120);
      const sessionId = clean(verified.session_id, 180);
      if (!userId || !sessionId) return { ok: false, error: 'CUSTOMER_IDENTITY_CLAIMS_INCOMPLETE' };
      const membershipsResult = await loadMemberships({
        project_ref: config.customer_project_ref,
        user_id: userId,
        access_token: clean(assertion.access_token, 12000)
      });
      if (!membershipsResult?.ok) return { ok: false, error: membershipsResult?.error || 'CUSTOMER_MEMBERSHIP_LOOKUP_FAILED' };
      return {
        ok: true,
        user_id: userId,
        session_id: sessionId,
        authenticated_at: verified.authenticated_at || new Date().toISOString(),
        memberships: Array.isArray(membershipsResult.memberships) ? clone(membershipsResult.memberships) : [],
        synthetic: options.synthetic_fixture === true
      };
    }
  });

  return {
    manifest() {
      return {
        schema: 'aurentara.customer.supabase-identity-binding.v1',
        contract_ready: true,
        dedicated_plane_config_ok: config.ok,
        provider_active: options.provider_active === true && config.ok && Boolean(verifyAccessToken) && Boolean(loadMemberships),
        synthetic_fixture: options.synthetic_fixture === true,
        project_ref: config.ok ? config.customer_project_ref : null,
        operator_project_reuse_forbidden: true,
        operator_access: false
      };
    },
    resolve: adapter.resolve,
    config
  };
}

function validateCollection(collection) {
  const value = clean(collection, 120);
  return KNOWN_COLLECTIONS.has(value) ? { ok: true, collection: value } : { ok: false, error: 'CUSTOMER_STORE_COLLECTION_NOT_ALLOWED' };
}

export function createSupabaseCustomerStoreDriver(options = {}) {
  const config = validateDedicatedCustomerPlane(options);
  const execute = typeof options.execute_operation === 'function' ? options.execute_operation : null;
  const allowed = invocationAllowed(options);

  async function call(operation, input = {}) {
    if (!config.ok) return config;
    if (!allowed) return { ok: false, error: 'CUSTOMER_STORE_PROVIDER_ACTIVATION_REQUIRED' };
    if (!execute) return { ok: false, error: 'CUSTOMER_STORE_PROVIDER_CALLBACK_REQUIRED' };
    const collectionGate = validateCollection(input.collection);
    if (!collectionGate.ok) return collectionGate;
    const response = await execute({
      operation,
      project_ref: config.customer_project_ref,
      tenant_id: clean(input.tenant_id, 120),
      business_id: clean(input.business_id, 120) || null,
      scope: clean(input.scope, 360),
      scope_kind: clean(input.scope_kind, 40),
      collection: collectionGate.collection,
      id: clean(input.id, 180),
      value: clone(input.value),
      expected_revision: input.expected_revision
    });
    return response?.ok === false ? response : clone(response);
  }

  return {
    schema: 'aurentara.customer.supabase-store-driver.v1',
    manifest() {
      return {
        contract_ready: true,
        dedicated_plane_config_ok: config.ok,
        provider_active: options.provider_active === true && config.ok && Boolean(execute),
        synthetic_fixture: options.synthetic_fixture === true,
        project_ref: config.ok ? config.customer_project_ref : null,
        collection_allowlist_enforced: true,
        tenant_scope_forwarded_before_provider: true,
        browser_service_role_key_forbidden: true
      };
    },
    async get(input) {
      const result = await call('get', input);
      if (result?.ok === false) return null;
      return result?.record ?? result ?? null;
    },
    async put(input) { return call('put', input); },
    async list(input) {
      const result = await call('list', input);
      if (result?.ok === false) return [];
      return Array.isArray(result?.records) ? result.records : Array.isArray(result) ? result : [];
    },
    async purgeTenant(input) {
      if (!config.ok) return config;
      if (!allowed) return { ok: false, error: 'CUSTOMER_STORE_PROVIDER_ACTIVATION_REQUIRED' };
      if (!execute) return { ok: false, error: 'CUSTOMER_STORE_PROVIDER_CALLBACK_REQUIRED' };
      return execute({
        operation: 'purgeTenant',
        project_ref: config.customer_project_ref,
        tenant_id: clean(input.tenant_id, 120),
        reason: clean(input.reason, 240),
        audit_id: clean(input.audit_id, 180)
      });
    },
    config
  };
}

export function createDedicatedCustomerStoreBinding(options = {}) {
  const driver = options.driver || createSupabaseCustomerStoreDriver(options);
  return createDurableCustomerStoreAdapter({
    driver,
    production_active: options.production_active === true,
    production_activation_approved: options.production_activation_approved === true,
    synthetic_fixture: options.synthetic_fixture === true
  });
}

export function createSyntheticDedicatedCustomerRuntime(input = {}) {
  const customerRef = clean(input.customer_project_ref || 'aaaaaaaaaaaaaaaaaaaa', 20);
  const operatorRef = clean(input.operator_project_ref || 'bbbbbbbbbbbbbbbbbbbb', 20);
  const driver = createDeterministicCustomerStoreDriver();
  const store = createDurableCustomerStoreAdapter({ driver, synthetic_fixture: true });
  return {
    config: validateDedicatedCustomerPlane({ customer_project_ref: customerRef, operator_project_ref: operatorRef }),
    driver,
    store,
    synthetic: true,
    production_active: false
  };
}
