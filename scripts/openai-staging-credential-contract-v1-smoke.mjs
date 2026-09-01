import assert from 'node:assert/strict';
import {
  OPENAI_STAGING_CREDENTIAL_CONTRACT,
  discoveredStagingProviderBindings,
  stagingProviderBindingsManifest
} from '../src/staging-provider-bindings.js';
import { providerActivationInventory } from '../src/provider-activation-inventory.js';

const contract = OPENAI_STAGING_CREDENTIAL_CONTRACT;
assert.equal(contract.provider_id, 'openai-api');
assert.equal(contract.runtime, 'riosystems-staging');
assert.equal(contract.secret_name, 'OPENAI_API_KEY');
assert.equal(contract.credential_ref, 'env://OPENAI_API_KEY');
assert.equal(contract.secret_value_in_repo, false);
assert.equal(contract.connection_verified, false);
assert.equal(contract.paid_execution_approved, false);
assert.equal(contract.production_deploy, false);

const openaiBinding = discoveredStagingProviderBindings()
  .find((item) => item.binding?.provider_id === 'openai-api');
assert.ok(openaiBinding, 'OpenAI staging binding must be declared');
assert.equal(openaiBinding.ok, true);
assert.equal(openaiBinding.binding.credential_ref, contract.credential_ref);
assert.equal(openaiBinding.binding.discovery, 'manual_reference');
assert.equal(openaiBinding.binding.secrets_embedded, false);
assert.equal(openaiBinding.binding.automatic_paid_overflow, false);
assert.equal(openaiBinding.binding.production_deploy, false);

const manifest = stagingProviderBindingsManifest();
assert.deepEqual(manifest.manual_credential_reference, ['openai-api']);
assert.equal(manifest.secret_values_present, false);
assert.equal(manifest.automatic_paid_overflow, false);
assert.equal(manifest.production_deploy, false);

const openaiInventory = providerActivationInventory().providers
  .find((provider) => provider.id === 'openai-api');
assert.ok(openaiInventory, 'OpenAI must remain in provider activation inventory');
assert.equal(openaiInventory.verification, 'NOT_CONNECTED');
assert.ok(openaiInventory.restrictions.includes('CREDENTIAL_AND_BUDGET_GATE'));
assert.ok(openaiInventory.restrictions.includes('PAID_EXECUTION_APPROVAL_REQUIRED'));

console.log(JSON.stringify({
  ok: true,
  provider_id: contract.provider_id,
  runtime: contract.runtime,
  credential_ref: contract.credential_ref,
  connection_verified: contract.connection_verified,
  paid_execution_approved: contract.paid_execution_approved,
  production_deploy: contract.production_deploy,
  secret_values_present: false
}, null, 2));
