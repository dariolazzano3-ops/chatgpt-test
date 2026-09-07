import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  validateJarvisCloudflareIsolationV1,
  jarvisCloudflareIsolationManifestV1
} from '../src/jarvis/cloudflare-account-isolation-v1.js';

const good = validateJarvisCloudflareIsolationV1({
  jarvis_account_id: 'jarvis-account',
  legacy_account_id: 'business-account',
  public_access: 'false',
  production_deploy: 'false'
});
assert.equal(good.ok, true);
assert.equal(good.dedicated_account, true);
assert.equal(good.shared_account, false);

const same = validateJarvisCloudflareIsolationV1({
  jarvis_account_id: 'same-account',
  legacy_account_id: 'same-account',
  public_access: 'false',
  production_deploy: 'false'
});
assert.equal(same.ok, false);
assert.equal(same.error, 'JARVIS_CLOUDFLARE_ACCOUNT_MUST_BE_SEPARATE');

const workflow = fs.readFileSync('.github/workflows/jarvis-private-worker-staging.yml', 'utf8');
assert.match(workflow, /secrets\.JARVIS_CLOUDFLARE_API_TOKEN/);
assert.match(workflow, /secrets\.JARVIS_CLOUDFLARE_ACCOUNT_ID/);
assert.doesNotMatch(workflow, /secrets\.CLOUDFLARE_API_TOKEN/);
assert.doesNotMatch(workflow, /secrets\.CLOUDFLARE_ACCOUNT_ID/);
assert.doesNotMatch(workflow, /RIOSYSTEMS_CLOUDFLARE_ZERO_COST_CONFIRMED/);

const wrangler = JSON.parse(fs.readFileSync('wrangler.jarvis-private.jsonc', 'utf8'));
assert.equal(wrangler.workers_dev, false);
assert.equal('account_id' in wrangler, false);
assert.equal('routes' in wrangler, false);

const manifest = jarvisCloudflareIsolationManifestV1();
assert.equal(manifest.account_boundary, 'DEDICATED_ACCOUNT_REQUIRED');
assert.equal(manifest.workers_dev, false);
assert.equal(manifest.public_access, false);

console.log('JARVIS Cloudflare Account Isolation V1 smoke: PASS');
