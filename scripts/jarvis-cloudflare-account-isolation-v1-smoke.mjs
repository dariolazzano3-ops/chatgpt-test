import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  validateJarvisCloudflareResourceIsolationV1,
  jarvisCloudflareResourceIsolationManifestV1
} from '../src/jarvis/cloudflare-account-isolation-v1.js';

const good = validateJarvisCloudflareResourceIsolationV1({
  account_id: 'shared-business-account-is-allowed',
  worker_name: 'jarvis-private-staging',
  access_audience: 'dedicated-jarvis-audience',
  host: 'jarvis-private.example.invalid',
  public_access: 'false',
  production_deploy: 'false'
});
assert.equal(good.ok, true);
assert.equal(good.account_sharing_allowed, true);
assert.equal(good.dedicated_worker, true);
assert.equal(good.dedicated_secrets_required, true);
assert.equal(good.dedicated_access_application_required, true);

const wrongWorker = validateJarvisCloudflareResourceIsolationV1({
  account_id: 'shared-account',
  worker_name: 'operator-staging',
  access_audience: 'dedicated-jarvis-audience',
  host: 'jarvis-private.example.invalid',
  public_access: 'false',
  production_deploy: 'false'
});
assert.equal(wrongWorker.ok, false);
assert.equal(wrongWorker.error, 'JARVIS_DEDICATED_WORKER_REQUIRED');

const workflow = fs.readFileSync('.github/workflows/jarvis-private-worker-staging.yml', 'utf8');
assert.match(workflow, /secrets\.JARVIS_CLOUDFLARE_API_TOKEN/);
assert.match(workflow, /secrets\.JARVIS_CLOUDFLARE_ACCOUNT_ID/);
assert.doesNotMatch(workflow, /secrets\.CLOUDFLARE_API_TOKEN/);
assert.doesNotMatch(workflow, /secrets\.CLOUDFLARE_ACCOUNT_ID/);
assert.doesNotMatch(workflow, /RIOSYSTEMS_CLOUDFLARE_ZERO_COST_CONFIRMED/);
assert.match(workflow, /ISOLATED_SUPABASE_READY_UNBOUND/);

const wrangler = JSON.parse(fs.readFileSync('wrangler.jarvis-private.jsonc', 'utf8'));
assert.equal(wrangler.name, 'jarvis-private-staging');
assert.equal(wrangler.workers_dev, false);
assert.equal('account_id' in wrangler, false);
assert.equal('routes' in wrangler, false);

const manifest = jarvisCloudflareResourceIsolationManifestV1();
assert.equal(manifest.account_boundary, 'SHARED_ACCOUNT_ALLOWED');
assert.equal(manifest.resource_boundary, 'DEDICATED_JARVIS_RESOURCES_REQUIRED');
assert.equal(manifest.shared_generic_credential_names_allowed, false);
assert.equal(manifest.workers_dev, false);

console.log('JARVIS Cloudflare Resource Isolation V1 smoke: PASS');
