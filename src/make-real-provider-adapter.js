import { buildMakeConnectionContract } from './make-staging-bridge.js';
import {
  buildRealProviderIntegrationEntry,
  defineRealProviderCandidate,
  evaluateRealProviderBridge
} from './real-provider-bridge.js';

const clean = (value, max = 300) => String(value ?? '').trim().slice(0, max);
const finiteNonNegative = (value) => Number.isFinite(Number(value)) && Number(value) >= 0;

function toBridgeCredentialRef(tokenRef) {
  const value = clean(tokenRef, 180);
  if (!value) return null;
  const match = /^(env|secret):([A-Z][A-Z0-9_]{2,100})$/.exec(value);
  return match ? `${match[1]}://${match[2]}` : value;
}

function uniqueBlockers(values = []) {
  return values.filter((item, index, list) => list.findIndex((other) => other.code === item.code) === index);
}

export function buildMakeRealProviderCandidate(input = {}) {
  if (input.production_deploy === true) return { ok: false, error: 'PRODUCTION_DEPLOY_REJECTED', production_deploy: false };
  const contract = buildMakeConnectionContract(input);
  const blockers = [...(contract.blockers || [])];
  const monthlyCost = Number(input.estimated_monthly_cost_eur);
  const runCost = Number(input.estimated_cost_per_run_eur);

  if (!contract.ready_for_read_only_preflight) blockers.push({ code: 'MAKE_CONNECTION_CONTRACT_NOT_READY' });
  if (!finiteNonNegative(input.estimated_monthly_cost_eur)) blockers.push({ code: 'MAKE_MONTHLY_COST_ESTIMATE_REQUIRED' });
  if (!finiteNonNegative(input.estimated_cost_per_run_eur)) blockers.push({ code: 'MAKE_RUN_COST_ESTIMATE_REQUIRED' });
  if (input.automatic_extra_credit_purchase === true) blockers.push({ code: 'MAKE_AUTOMATIC_EXTRA_CREDITS_REJECTED' });

  const credentialRef = toBridgeCredentialRef(contract.token_ref);
  const unique = uniqueBlockers(blockers);
  if (unique.length) {
    return {
      ok: false,
      error: unique[0].code,
      blockers: unique,
      connection: contract,
      production_deploy: false
    };
  }

  const host = new URL(contract.api_base_url).host;
  const defined = defineRealProviderCandidate({
    id: 'make-core',
    capability: 'automation.run',
    kind: 'automation',
    enabled: true,
    credential_ref: credentialRef,
    endpoint: contract.api_base_url,
    allowed_hosts: [host],
    paid: true,
    estimated_monthly_cost_eur: monthlyCost,
    estimated_cost_per_run_eur: runCost,
    free_tier_confirmed: false,
    external_write: true,
    automation_interface: 'api',
    ownership_grade: 'exportable',
    code_export_supported: false,
    allowed_data_classes: ['public', 'business']
  });

  if (!defined.ok) return { ...defined, connection: contract };
  return {
    ok: true,
    provider: defined.provider,
    connection: contract,
    automatic_extra_credit_purchase: false,
    production_deploy: false
  };
}

export function evaluateMakeRealProviderActivation(input = {}, context = {}) {
  const built = buildMakeRealProviderCandidate(input);
  if (!built.ok) return built;
  const requirements = {
    max_monthly_cost_eur: context.max_monthly_cost_eur,
    max_cost_per_run_eur: context.max_cost_per_run_eur,
    data_classes: Array.isArray(context.data_classes) ? context.data_classes : ['business'],
    automation_required: true,
    minimum_ownership_grade: 'exportable'
  };
  const gate = evaluateRealProviderBridge(built.provider, {
    requirements,
    execute: context.execute === true,
    production: false,
    provider_activation_approved: context.provider_activation_approved === true,
    supervised_execution_approved: context.supervised_execution_approved === true,
    cost_approved: context.cost_approved === true,
    external_write_approved: context.external_write_approved === true
  });
  return {
    ok: gate.ok,
    schema: 'riosystems.make-real-provider-activation.v1',
    provider: built.provider,
    connection: built.connection,
    gate,
    automatic_extra_credit_purchase: false,
    production_deploy: false
  };
}

export function buildMakeRealProviderIntegration(input = {}, options = {}) {
  const built = buildMakeRealProviderCandidate(input);
  if (!built.ok) return built;
  const entry = buildRealProviderIntegrationEntry(built.provider, {
    health: clean(options.health, 40) || 'unknown',
    runner: typeof options.runner === 'function' ? options.runner : null
  });
  if (!entry.ok) return entry;
  return {
    ok: true,
    entry: entry.entry,
    connection: built.connection,
    runner_configured: typeof options.runner === 'function',
    automatic_extra_credit_purchase: false,
    production_deploy: false
  };
}

export function makeRealProviderAdapterManifest() {
  return {
    schema: 'riosystems.make-real-provider-adapter.v1',
    provider_id: 'make-core',
    capability: 'automation.run',
    real_provider_bridge_integrated: true,
    integration_catalog_entry_supported: true,
    runner_injection_supported: true,
    runner_configured_by_default: false,
    connection_required_before_activation: true,
    cost_estimate_required_before_activation: true,
    external_write: true,
    paid: true,
    automatic_extra_credit_purchase: false,
    supervised_execution_required: true,
    production_deploy: false
  };
}
