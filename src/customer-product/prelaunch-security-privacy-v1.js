import { createMemoryRuntimeStore } from '../durable-runtime-store.js';
import { createHardenedCustomerProductSurface } from './abuse-guard-v1.js';

const clean = (value, max = 1000) => String(value ?? '').trim().slice(0, max);
const clone = (value) => structuredClone(value ?? null);
const now = () => new Date().toISOString();

export const CUSTOMER_LAUNCH_MODES_V1 = Object.freeze({
  OFF: 'off',
  SYNTHETIC_STAGING: 'synthetic-staging',
  CONTROLLED_PRELAUNCH: 'controlled-prelaunch',
  PUBLIC: 'public'
});

export const CUSTOMER_CONSENT_PURPOSES_V1 = Object.freeze([
  'persistent_business_memory',
  'trusted_research',
  'product_analytics',
  'service_handoff'
]);

function bool(value) {
  return value === true || String(value || '').toLowerCase() === 'true';
}

function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'no-referrer',
      ...headers
    }
  });
}

function constantTimeEqual(a = '', b = '') {
  const left = String(a);
  const right = String(b);
  if (!left || !right || left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i += 1) diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return diff === 0;
}

export function customerPrelaunchSecurityPrivacyManifest() {
  return {
    version: 'aurentara.personal-business-ai.prelaunch-security-privacy.v1',
    sql_security_contract_verifier_ready: true,
    consent_ledger_contract_ready: true,
    business_export_contract_ready: true,
    deletion_plan_contract_ready: true,
    launch_shield_contract_ready: true,
    public_mode_default: false,
    controlled_prelaunch_requires_token: true,
    controlled_prelaunch_synthetic_only: true,
    public_activation_requires_operator_gate: true,
    production_retention_policy_approved: false,
    legal_review_complete: false,
    real_customer_data_allowed: false,
    public_customer_traffic_active: false,
    production_deploy: false,
    variable_cost_eur: 0
  };
}

export function evaluateCustomerSqlSecurityContract(input = {}) {
  const foundation = String(input.foundation_sql || '');
  const chat = String(input.chat_sql || '');
  const failures = [];
  const foundationTables = [
    'tenants', 'memberships', 'businesses', 'memory_facts', 'memory_candidates', 'goals', 'decisions',
    'business_state_snapshots', 'usage_attribution', 'audit_log', 'deletion_jobs'
  ];
  const chatTables = ['conversations', 'conversation_messages', 'conversation_turns'];

  if (!foundation.includes('Must remain separate from Operator Control in production')) failures.push('DEDICATED_CUSTOMER_PLANE_DECLARATION_MISSING');
  if (!foundation.includes('security definer') || !foundation.includes('set search_path = aurentara_customer_ai, pg_temp')) failures.push('TENANT_MEMBERSHIP_FUNCTION_HARDENING_MISSING');
  if (!foundation.includes('grant execute on function aurentara_customer_ai.is_tenant_member(text) to authenticated')) failures.push('TENANT_MEMBERSHIP_EXECUTE_POLICY_MISSING');
  for (const table of foundationTables) {
    if (!foundation.includes(`alter table aurentara_customer_ai.${table} enable row level security`)) failures.push(`RLS_MISSING:${table}`);
  }
  for (const table of chatTables) {
    if (!chat.includes(`alter table aurentara_customer_ai.${table} enable row level security`)) failures.push(`RLS_MISSING:${table}`);
  }
  if (/for\s+delete\s+to\s+authenticated/i.test(foundation) || /for\s+delete\s+to\s+authenticated/i.test(chat)) failures.push('CUSTOMER_HARD_DELETE_POLICY_FORBIDDEN');
  if (!foundation.includes('WHERE tenant_id = $tenant AND business_id = $business')) failures.push('VECTOR_TENANT_FILTER_CONTRACT_MISSING');
  if (!chat.includes('owner_user_id = auth.uid()::text')) failures.push('CONVERSATION_OWNER_SCOPE_MISSING');
  if (!foundation.includes('rollback;') || !chat.includes('rollback;')) failures.push('UNAUTHORIZED_MIGRATION_APPLY_RISK');

  return {
    ok: failures.length === 0,
    schema: 'aurentara.customer.sql-security-contract-result.v1',
    failures,
    dedicated_customer_plane_required: true,
    rls_required: true,
    customer_delete_policy_forbidden: true,
    vector_filter_at_query_time_required: true,
    reviewed_contracts_apply_automatically: false
  };
}

function privacyScope(tenantId) {
  return `tenant:${tenantId}:customer-privacy`;
}

export function createCustomerConsentLedger(options = {}) {
  const store = options.store || createMemoryRuntimeStore();
  let sequence = 0;
  const nextId = () => `consent_${String(++sequence).padStart(8, '0')}`;

  async function current(tenantId, userId, purpose) {
    const records = await store.list(privacyScope(tenantId), 'consents');
    const matches = records.map((entry) => entry.value).filter((item) => item.user_id === userId && item.purpose === purpose);
    return matches.sort((a, b) => String(b.recorded_at).localeCompare(String(a.recorded_at)))[0] || null;
  }

  return {
    manifest() {
      return {
        schema: 'aurentara.customer.consent-ledger.v1',
        contract_ready: true,
        tenant_scoped: true,
        consent_version_required: true,
        withdrawal_supported: true,
        allowed_purposes: [...CUSTOMER_CONSENT_PURPOSES_V1]
      };
    },
    async record(input = {}) {
      const tenantId = clean(input.tenant_id, 120);
      const userId = clean(input.user_id, 120);
      const purpose = clean(input.purpose, 120);
      const policyVersion = clean(input.policy_version, 120);
      if (!tenantId || !userId) return { ok: false, error: 'CONSENT_TENANT_USER_REQUIRED' };
      if (!CUSTOMER_CONSENT_PURPOSES_V1.includes(purpose)) return { ok: false, error: 'CONSENT_PURPOSE_NOT_ALLOWED' };
      if (!policyVersion) return { ok: false, error: 'CONSENT_POLICY_VERSION_REQUIRED' };
      if (input.granted !== true && input.granted !== false) return { ok: false, error: 'CONSENT_DECISION_REQUIRED' };
      const event = {
        schema: 'aurentara.customer.consent-event.v1',
        consent_id: nextId(),
        tenant_id: tenantId,
        user_id: userId,
        purpose,
        granted: input.granted === true,
        policy_version: policyVersion,
        source: clean(input.source || 'customer_ui', 80),
        recorded_at: input.recorded_at || now()
      };
      const written = await store.put(privacyScope(tenantId), 'consents', event.consent_id, event);
      return written.ok ? { ok: true, consent: clone(written.value) } : written;
    },
    async getCurrent(input = {}) {
      const tenantId = clean(input.tenant_id, 120);
      const userId = clean(input.user_id, 120);
      const purpose = clean(input.purpose, 120);
      if (!tenantId || !userId || !purpose) return { ok: false, error: 'CONSENT_SCOPE_REQUIRED' };
      return { ok: true, consent: clone(await current(tenantId, userId, purpose)) };
    },
    async withdraw(input = {}) {
      return this.record({ ...input, granted: false, source: input.source || 'customer_withdrawal' });
    }
  };
}

export function createCustomerPrivacyTechnicalController(options = {}) {
  const foundation = options.foundation;
  const deletionExecutor = options.deletion_executor;
  const consent = options.consent_ledger || createCustomerConsentLedger(options);

  return {
    manifest() {
      return {
        schema: 'aurentara.customer.privacy-technical-controller.v1',
        contract_ready: Boolean(foundation) && Boolean(deletionExecutor),
        export_supported: Boolean(foundation?.exportBusiness),
        memory_correction_reused_from_foundation: Boolean(foundation?.correctMemory),
        deletion_plan_supported: Boolean(foundation?.buildDeletionPlan),
        hard_delete_executor_bound: Boolean(deletionExecutor?.execute),
        consent_ledger_bound: true,
        production_retention_policy_approved: false,
        legal_review_complete: false
      };
    },
    consent,
    async exportBusiness(ctx, businessId) {
      if (!foundation?.exportBusiness) return { ok: false, error: 'PRIVACY_EXPORT_FOUNDATION_REQUIRED' };
      return foundation.exportBusiness(ctx, clean(businessId, 120));
    },
    async buildDeletionPlan(ctx, businessId) {
      if (!foundation?.buildDeletionPlan) return { ok: false, error: 'PRIVACY_DELETION_PLAN_FOUNDATION_REQUIRED' };
      return foundation.buildDeletionPlan(ctx, clean(businessId, 120));
    },
    async executeTenantDeletion(input = {}) {
      if (!deletionExecutor?.execute) return { ok: false, error: 'PRIVACY_DELETION_EXECUTOR_REQUIRED' };
      if (input.user_confirmed !== true) return { ok: false, error: 'DELETION_USER_CONFIRMATION_REQUIRED' };
      return deletionExecutor.execute(input);
    }
  };
}

function customerMode(env = {}) {
  const raw = clean(env.AURENTARA_CUSTOMER_SURFACE_MODE || 'off', 40).toLowerCase();
  return Object.values(CUSTOMER_LAUNCH_MODES_V1).includes(raw) ? raw : CUSTOMER_LAUNCH_MODES_V1.OFF;
}

export function createCustomerLaunchShield(options = {}) {
  const syntheticSurface = options.synthetic_surface || createHardenedCustomerProductSurface(options.surface_options || {});
  const productionSurface = options.production_surface || null;

  async function handle(request, env = {}, ctx = null) {
    const url = new URL(request.url);
    if (!(url.pathname === '/customer' || url.pathname === '/customer/' || url.pathname.startsWith('/customer/api/'))) return null;
    const mode = customerMode(env);

    if (mode === CUSTOMER_LAUNCH_MODES_V1.OFF) {
      return json({ ok: false, error: 'CUSTOMER_SURFACE_NOT_ACTIVATED', mode, public_active: false }, 404);
    }

    if (mode === CUSTOMER_LAUNCH_MODES_V1.SYNTHETIC_STAGING) {
      return syntheticSurface.handle(request, { ...env, AURENTARA_CUSTOMER_SURFACE_MODE: 'synthetic-staging' }, ctx);
    }

    if (mode === CUSTOMER_LAUNCH_MODES_V1.CONTROLLED_PRELAUNCH) {
      if (!bool(env.AURENTARA_CUSTOMER_PRELAUNCH_ENABLED)) {
        return json({ ok: false, error: 'CUSTOMER_PRELAUNCH_NOT_ENABLED', public_active: false }, 404);
      }
      if (bool(env.AURENTARA_CUSTOMER_REAL_DATA_ALLOWED)) {
        return json({ ok: false, error: 'CUSTOMER_PRELAUNCH_MUST_REMAIN_SYNTHETIC', public_active: false }, 409);
      }
      const configured = clean(env.AURENTARA_CUSTOMER_PRELAUNCH_TOKEN, 500);
      const supplied = clean(request.headers.get('x-aurentara-prelaunch-token'), 500);
      if (!constantTimeEqual(configured, supplied)) {
        return json({ ok: false, error: 'CUSTOMER_PRELAUNCH_ACCESS_REQUIRED', public_active: false }, 401);
      }
      const response = await syntheticSurface.handle(request, { ...env, AURENTARA_CUSTOMER_SURFACE_MODE: 'synthetic-staging' }, ctx);
      const headers = new Headers(response.headers);
      headers.set('x-aurentara-customer-mode', 'controlled-prelaunch');
      return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
    }

    if (!bool(env.AURENTARA_CUSTOMER_PUBLIC_ACTIVATION_APPROVED)) {
      return json({ ok: false, error: 'CUSTOMER_PUBLIC_ACTIVATION_REQUIRED', mode, public_active: false }, 404);
    }
    if (!bool(env.AURENTARA_CUSTOMER_REAL_DATA_ALLOWED)) {
      return json({ ok: false, error: 'CUSTOMER_REAL_DATA_GATE_REQUIRED', mode, public_active: false }, 503);
    }
    if (!productionSurface || options.production_runtime_active !== true) {
      return json({ ok: false, error: 'CUSTOMER_PRODUCTION_RUNTIME_NOT_BOUND', mode, public_active: false }, 503);
    }
    return productionSurface.handle(request, env, ctx);
  }

  return {
    manifest() {
      return {
        schema: 'aurentara.customer.launch-shield.v1',
        default_mode: CUSTOMER_LAUNCH_MODES_V1.OFF,
        synthetic_staging_supported: true,
        controlled_prelaunch_supported: true,
        controlled_prelaunch_synthetic_only: true,
        controlled_prelaunch_token_required: true,
        public_activation_requires_explicit_approval: true,
        real_data_requires_explicit_approval: true,
        production_runtime_required_for_public: true,
        public_active: false
      };
    },
    handle
  };
}

let defaultShield = null;
export async function handlePrelaunchCustomerProductSurface(request, env = {}, ctx = null) {
  if (!defaultShield) defaultShield = createCustomerLaunchShield();
  return defaultShield.handle(request, env, ctx);
}
