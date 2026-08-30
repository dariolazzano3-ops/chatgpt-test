import { createOperatorRuntime } from './operator-runtime-v1.js';
import { createOperatorRuntimeApiService } from './operator-runtime-api-v1.js';
import { createOperatorRuntimeStoreFromEnv } from './operator-runtime-store-supabase-v1.js';

const clean = (value, max = 500) => String(value ?? '').trim().slice(0, max);
const services = new Map();

function seededPortfolio(operatorId) {
  return {
    operator_id: operatorId,
    projects: [
      {
        customer_id: 'synthetic-customer-bakery',
        project_id: 'bakery-muller:universal-regression-v1',
        scope_key: 'synthetic-customer-bakery:bakery-muller:universal-regression-v1',
        name: 'Bäckerei Müller', industry: 'bakery', country: 'DE', language: 'de',
        state: 'READY', blocked: false, priority: 10, budget_cost_units: 0,
        capability_count: 5, mission_count: 0, delivery_count: 1, production_deploy: false
      },
      {
        customer_id: 'synthetic-customer-craft',
        project_id: 'handwerk-modernisierung:universal-v1',
        scope_key: 'synthetic-customer-craft:handwerk-modernisierung:universal-v1',
        name: 'Muster Handwerksbetrieb', industry: 'handwerk', country: 'DE', language: 'de',
        state: 'ACTIVE', blocked: false, priority: 20, budget_cost_units: 0,
        capability_count: 5, mission_count: 0, delivery_count: 0, production_deploy: false
      },
      {
        customer_id: 'synthetic-customer-service',
        project_id: 'service-studio:operator-v1',
        scope_key: 'synthetic-customer-service:service-studio:operator-v1',
        name: 'Synthetic Service Studio', industry: 'professional-services', country: 'DE', language: 'de',
        state: 'READY', blocked: false, priority: 30, budget_cost_units: 0,
        capability_count: 3, mission_count: 0, delivery_count: 0, production_deploy: false
      }
    ],
    production_deploy: false
  };
}

function createInitialRuntime(operatorId, at = null) {
  const created = createOperatorRuntime({
    operator_id: operatorId,
    portfolio: seededPortfolio(operatorId),
    at: at || new Date().toISOString()
  });
  if (!created.ok) throw new Error(created.error || 'OPERATOR_RUNTIME_INIT_FAILED');
  return created.runtime;
}

export function createDurableOperatorRuntimeServiceFromEnv(env = {}, options = {}) {
  const mode = clean(env.RIOSYSTEMS_OPERATOR_RUNTIME_STORE, 80).toLowerCase();
  if (!mode || mode === 'memory') {
    if (clean(env.RIOSYSTEMS_ENVIRONMENT, 80).toLowerCase() === 'staging') {
      throw new Error('OPERATOR_RUNTIME_DURABLE_STORE_REQUIRED_IN_STAGING');
    }
    return null;
  }

  const email = clean(env.RIOSYSTEMS_OPERATOR_EMAIL, 320).toLowerCase();
  if (!email) throw new Error('RIOSYSTEMS_OPERATOR_EMAIL_REQUIRED');
  const operatorId = `operator:${email}`;
  const store = createOperatorRuntimeStoreFromEnv(env, options);
  if (!store) return null;

  return createOperatorRuntimeApiService({
    operator_id: operatorId,
    store,
    initial_runtime: createInitialRuntime(operatorId, options.at)
  });
}

export function getDurableOperatorRuntimeService(env = {}, options = {}) {
  const mode = clean(env.RIOSYSTEMS_OPERATOR_RUNTIME_STORE, 80).toLowerCase();
  if (!mode || mode === 'memory') return createDurableOperatorRuntimeServiceFromEnv(env, options);

  const email = clean(env.RIOSYSTEMS_OPERATOR_EMAIL, 320).toLowerCase();
  const url = clean(env.RIOSYSTEMS_OPERATOR_RUNTIME_SUPABASE_URL, 2000);
  const table = clean(env.RIOSYSTEMS_OPERATOR_RUNTIME_SUPABASE_TABLE || 'riosystems_operator_runtime_v1', 120);
  const key = `${mode}:${email}:${url}:${table}`;
  if (!services.has(key)) services.set(key, createDurableOperatorRuntimeServiceFromEnv(env, options));
  return services.get(key);
}

export function operatorRuntimeBootstrapManifest() {
  return {
    schema: 'riosystems.operator-runtime-bootstrap.v1',
    staging_store_required: 'supabase',
    fail_closed: true,
    memory_allowed_in_staging: false,
    synthetic_seed_only: true,
    browser_secrets: false,
    production_deploy: false
  };
}
