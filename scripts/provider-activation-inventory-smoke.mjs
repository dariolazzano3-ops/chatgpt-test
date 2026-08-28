import assert from 'node:assert/strict';
import {
  providerActivationInventory,
  candidatesForCapability,
  evaluateProviderActivationInventory,
  providerActivationInventoryManifest
} from '../src/provider-activation-inventory.js';

const inventory = providerActivationInventory();
assert.equal(inventory.production_deploy, false);
assert.equal(inventory.secrets_embedded, false);
assert.equal(inventory.pricing_must_be_reverified_before_activation, true);

const zeroCostAi = candidatesForCapability('ai.generate', { zero_cost_only: true });
assert.equal(zeroCostAi.length >= 1, true);
assert.equal(zeroCostAi[0].id, 'cloudflare-workers-ai-free');
assert.equal(zeroCostAi[0].cost_mode, 'free_tier_hard_fail');

const initial = evaluateProviderActivationInventory({
  required_capabilities: ['ai.generate','business.configure','web.analytics'],
  zero_cost_only: true
});
assert.equal(initial.zero_cost_path_available, true);
assert.equal(initial.ready_for_real_staging, false);
assert.equal(initial.user_action_required, true);
assert.equal(initial.automatic_paid_overflow, false);
assert.equal(initial.production_deploy, false);
assert.equal(initial.blockers.some((item) => item.code === 'PROVIDER_ACCOUNT_BINDING_REQUIRED'), true);

const readyReadOnly = evaluateProviderActivationInventory({
  required_capabilities: ['ai.generate'],
  zero_cost_only: true,
  account_bindings: ['cloudflare-workers-ai-free'],
  credential_refs: ['cloudflare-workers-ai-free']
});
assert.equal(readyReadOnly.ready_for_real_staging, true);

const writeStillBlocked = evaluateProviderActivationInventory({
  required_capabilities: ['business.configure'],
  zero_cost_only: true,
  account_bindings: ['supabase-free'],
  credential_refs: ['supabase-free']
});
assert.equal(writeStillBlocked.ready_for_real_staging, false);
assert.equal(writeStillBlocked.blockers.some((item) => item.code === 'EXTERNAL_WRITE_APPROVAL_REQUIRED'), true);

const premium = candidatesForCapability('ai.generate', { zero_cost_only: false });
assert.equal(premium.some((item) => item.id === 'openai-api' && item.cost_mode === 'paid_usage'), true);

const manifest = providerActivationInventoryManifest();
assert.equal(manifest.paid_overflow_disabled, true);
console.log(JSON.stringify({ ok: true, suite: 'provider-activation-inventory', providers: inventory.providers.map((item) => item.id), zero_cost_ai: zeroCostAi[0].id }, null, 2));
