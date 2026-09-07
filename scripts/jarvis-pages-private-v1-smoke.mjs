import assert from 'node:assert/strict';
import fs from 'node:fs';
import { jarvisPagesWorkerManifestV1 } from '../src/jarvis/pages-worker-v1.js';
import { validateJarvisNeutralHostV1 } from '../src/jarvis/host-policy-v1.js';

const config = JSON.parse(fs.readFileSync('wrangler.jarvis-pages.jsonc', 'utf8'));
assert.equal(config.name, 'jarvis-private-core');
assert.equal(config.pages_build_output_dir, './.jarvis-pages-dist');
assert.equal('main' in config, false);
assert.equal('workers_dev' in config, false);
assert.equal('routes' in config, false);
assert.equal(config.vars.JARVIS_PUBLIC_ACCESS, 'false');
assert.equal(config.vars.JARVIS_PRODUCTION_DEPLOY, 'false');
assert.equal(config.vars.JARVIS_PERSONAL_MEMORY_STORE, 'supabase-rpc');
assert.match(config.vars.JARVIS_PERSONAL_MEMORY_SUPABASE_URL, /^https:\/\/[a-z0-9]+\.supabase\.co$/);
assert.equal('JARVIS_PERSONAL_MEMORY_SUPABASE_SERVICE_ROLE_KEY' in config.vars, false);
assert.equal(config.vars.JARVIS_HOST_MODE, 'PAGES_DEV_ACCESS_REQUIRED');

const neutral = validateJarvisNeutralHostV1(config.name + '.pages.dev');
assert.equal(neutral.ok, true);
assert.equal(neutral.neutral, true);

const manifest = jarvisPagesWorkerManifestV1();
assert.equal(manifest.platform, 'cloudflare-pages-functions-advanced-mode');
assert.equal(manifest.pages_dev_host, true);
assert.equal(manifest.custom_domain_required, false);
assert.equal(manifest.cloudflare_access_required, true);
assert.equal(manifest.access_jwt_validation_required, true);
assert.equal(manifest.public_access, false);

console.log('JARVIS Pages Private Runtime V1 smoke: PASS');
