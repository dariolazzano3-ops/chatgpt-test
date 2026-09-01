import { providerActivationInventory } from './provider-activation-inventory.js';

const clean = (value, max = 240) => String(value || '').trim().slice(0, max);
const clone = (value) => structuredClone(value ?? null);
const REF = /^(?:account|project|env|secret|binding|vault):\/\/[a-z0-9][a-z0-9._:/-]*$/i;

export const OPENAI_STAGING_CREDENTIAL_CONTRACT = Object.freeze({
  schema: 'aurentara.openai-staging-credential-contract.v1',
  provider_id: 'openai-api',
  runtime: 'riosystems-staging',
  secret_name: 'OPENAI_API_KEY',
  credential_ref: 'env://OPENAI_API_KEY',
  secret_value_in_repo: false,
  credential_presence_only: true,
  connection_verified: false,
  paid_execution_approved: false,
  production_deploy: false
});

const DISCOVERED = [
  {
    provider_id: 'supabase-free',
    account_ref: 'account://supabase/connected',
    project_ref: 'project://supabase/riosystems-core',
    credential_ref: 'env://RIOSYSTEMS_SUPABASE_RUNTIME_SECRET',
    discovery: 'connected_read_only',
    external_write: true
  },
  {
    provider_id: 'posthog-free',
    account_ref: 'account://posthog/connected',
    project_ref: 'project://posthog/default-project',
    credential_ref: 'env://RIOSYSTEMS_POSTHOG_RUNTIME_KEY',
    discovery: 'connected_read_only',
    external_write: true
  },
  {
    provider_id: 'cloudflare-workers-free',
    account_ref: 'account://cloudflare/connected',
    project_ref: 'project://cloudflare/riosystems-staging',
    credential_ref: 'env://RIOSYSTEMS_CLOUDFLARE_API_TOKEN',
    discovery: 'project_required',
    external_write: true
  },
  {
    provider_id: 'cloudflare-workers-ai-free',
    account_ref: 'account://cloudflare/connected',
    project_ref: 'project://cloudflare/riosystems-staging',
    credential_ref: 'binding://cloudflare/workers-ai',
    discovery: 'project_required',
    external_write: false
  },
  {
    provider_id: OPENAI_STAGING_CREDENTIAL_CONTRACT.provider_id,
    account_ref: 'account://openai/operator-managed',
    project_ref: 'project://openai/aurentara-staging',
    credential_ref: OPENAI_STAGING_CREDENTIAL_CONTRACT.credential_ref,
    discovery: 'manual_reference',
    external_write: false
  }
];

function validReference(value) {
  return REF.test(value || '');
}

export function createStagingProviderBinding(input = {}) {
  const providerId = clean(input.provider_id, 120);
  const inventory = providerActivationInventory();
  const provider = inventory.providers.find((item) => item.id === providerId);
  if (!provider) return { ok: false, error: 'PROVIDER_NOT_IN_ACTIVATION_INVENTORY', production_deploy: false };
  const binding = {
    schema: 'riosystems.staging-provider-binding.v1',
    provider_id: providerId,
    account_ref: clean(input.account_ref),
    project_ref: clean(input.project_ref),
    credential_ref: clean(input.credential_ref),
    discovery: ['connected_read_only','connection_required','project_required','manual_reference'].includes(input.discovery) ? input.discovery : 'manual_reference',
    cost_mode: provider.cost_mode,
    external_write: provider.external_write === true,
    free_tier_confirmed: provider.free_tier_confirmed === true,
    secrets_embedded: false,
    automatic_paid_overflow: false,
    production_deploy: false
  };
  const blockers = [];
  if (!validReference(binding.account_ref)) blockers.push({ code: 'ACCOUNT_REFERENCE_INVALID' });
  if (!validReference(binding.project_ref)) blockers.push({ code: 'PROJECT_REFERENCE_INVALID' });
  if (!validReference(binding.credential_ref)) blockers.push({ code: 'CREDENTIAL_REFERENCE_INVALID' });
  if (binding.discovery === 'connection_required') blockers.push({ code: 'PROVIDER_CONNECTION_REQUIRED', provider_id: providerId });
  if (binding.discovery === 'project_required') blockers.push({ code: 'STAGING_PROJECT_REQUIRED', provider_id: providerId });
  return {
    ok: blockers.length === 0,
    binding,
    blockers,
    user_action_required: blockers.some((item) => ['PROVIDER_CONNECTION_REQUIRED','STAGING_PROJECT_REQUIRED'].includes(item.code)),
    production_deploy: false
  };
}

export function discoveredStagingProviderBindings() {
  return DISCOVERED.map((entry) => createStagingProviderBinding(entry));
}

export function evaluateStagingBindingReadiness(input = {}) {
  const requested = [...new Set(Array.isArray(input.provider_ids) ? input.provider_ids : [])];
  const entries = discoveredStagingProviderBindings();
  const byProvider = new Map(entries.map((item) => [item.binding?.provider_id, item]));
  const blockers = [];
  const bindings = [];
  for (const providerId of requested) {
    const item = byProvider.get(providerId);
    if (!item) {
      blockers.push({ code: 'STAGING_BINDING_NOT_DECLARED', provider_id: providerId });
      continue;
    }
    bindings.push(clone(item.binding));
    blockers.push(...(item.blockers || []));
    if (item.binding.external_write && input.external_write_approved !== true) {
      blockers.push({ code: 'EXTERNAL_WRITE_APPROVAL_REQUIRED', provider_id: providerId });
    }
  }
  const unique = blockers.filter((item, index, list) => list.findIndex((other) => other.code === item.code && other.provider_id === item.provider_id) === index);
  return {
    ok: true,
    ready_for_secret_injection: unique.filter((item) => ['PROVIDER_CONNECTION_REQUIRED','STAGING_PROJECT_REQUIRED'].includes(item.code)).length === 0,
    ready_for_external_execution: unique.length === 0 && input.supervised_execution_approved === true,
    bindings,
    blockers: unique,
    user_action_required: unique.some((item) => ['PROVIDER_CONNECTION_REQUIRED','STAGING_PROJECT_REQUIRED','EXTERNAL_WRITE_APPROVAL_REQUIRED'].includes(item.code)),
    secret_values_present: false,
    automatic_paid_overflow: false,
    production_deploy: false
  };
}

export function stagingProviderBindingsManifest() {
  return {
    version: 'riosystems.staging-provider-bindings.v1',
    discovered_read_only: ['supabase-free','posthog-free'],
    account_connected_read_only: ['cloudflare-workers-free','cloudflare-workers-ai-free'],
    staging_project_required: ['cloudflare-workers-free','cloudflare-workers-ai-free'],
    connection_required: [],
    manual_credential_reference: ['openai-api'],
    credential_references_only: true,
    secret_values_present: false,
    external_writes_approval_gated: true,
    automatic_paid_overflow: false,
    production_deploy: false
  };
}
