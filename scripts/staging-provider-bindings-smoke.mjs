import assert from 'node:assert/strict';
import {
  discoveredStagingProviderBindings,
  evaluateStagingBindingReadiness,
  stagingProviderBindingsManifest
} from '../src/staging-provider-bindings.js';

const discovered = discoveredStagingProviderBindings();
assert.equal(discovered.length, 4);
assert.equal(discovered.every((item) => item.binding?.secrets_embedded === false), true);
assert.equal(discovered.every((item) => item.binding?.automatic_paid_overflow === false), true);
assert.equal(discovered.every((item) => item.binding?.production_deploy === false), true);

const supabase = discovered.find((item) => item.binding?.provider_id === 'supabase-free');
const posthog = discovered.find((item) => item.binding?.provider_id === 'posthog-free');
const cloudflareAi = discovered.find((item) => item.binding?.provider_id === 'cloudflare-workers-ai-free');
assert.equal(supabase.ok, true);
assert.equal(posthog.ok, true);
assert.equal(cloudflareAi.ok, false);
assert.equal(cloudflareAi.binding.account_ref, 'account://cloudflare/connected');
assert.equal(cloudflareAi.blockers.some((item) => item.code === 'STAGING_PROJECT_REQUIRED'), true);
assert.equal(cloudflareAi.blockers.some((item) => item.code === 'PROVIDER_CONNECTION_REQUIRED'), false);

const readOnlyAi = evaluateStagingBindingReadiness({ provider_ids: ['cloudflare-workers-ai-free'] });
assert.equal(readOnlyAi.ready_for_secret_injection, false);
assert.equal(readOnlyAi.user_action_required, true);
assert.equal(readOnlyAi.secret_values_present, false);

const supabaseWrite = evaluateStagingBindingReadiness({ provider_ids: ['supabase-free'] });
assert.equal(supabaseWrite.ready_for_secret_injection, true);
assert.equal(supabaseWrite.ready_for_external_execution, false);
assert.equal(supabaseWrite.blockers.some((item) => item.code === 'EXTERNAL_WRITE_APPROVAL_REQUIRED'), true);

const posthogWrite = evaluateStagingBindingReadiness({
  provider_ids: ['posthog-free'],
  external_write_approved: true,
  supervised_execution_approved: true
});
assert.equal(posthogWrite.ready_for_external_execution, true);
assert.equal(posthogWrite.secret_values_present, false);

const manifest = stagingProviderBindingsManifest();
assert.deepEqual(manifest.discovered_read_only, ['supabase-free','posthog-free']);
assert.deepEqual(manifest.account_connected_read_only, ['cloudflare-workers-free','cloudflare-workers-ai-free']);
assert.deepEqual(manifest.staging_project_required, ['cloudflare-workers-free','cloudflare-workers-ai-free']);
assert.deepEqual(manifest.connection_required, []);
assert.equal(manifest.credential_references_only, true);
assert.equal(manifest.production_deploy, false);

console.log(JSON.stringify({
  ok: true,
  suite: 'staging-provider-bindings',
  discovered_read_only: manifest.discovered_read_only,
  account_connected_read_only: manifest.account_connected_read_only,
  staging_project_required: manifest.staging_project_required,
  connection_required: manifest.connection_required,
  secret_values_present: false
}, null, 2));
