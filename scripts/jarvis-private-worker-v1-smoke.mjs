import assert from 'node:assert/strict';
import fs from 'node:fs';
import { handleJarvisStandaloneWorkerV1, jarvisStandaloneWorkerManifestV1 } from '../src/jarvis/standalone-worker-v1.js';
import { createMemoryJarvisStoreV1 } from '../src/jarvis/memory-store-memory-v1.js';

const authorize = async () => ({
  ok: true,
  operator_id: 'jarvis-operator:private@example.invalid',
  email: 'private@example.invalid'
});
const store = createMemoryJarvisStoreV1();
const options = { authorize, memory_store: store, display_name: 'Private Operator' };

const root = await handleJarvisStandaloneWorkerV1(
  new Request('https://jarvis-private.example.workers.dev/'),
  {},
  {},
  options
);
assert.equal(root.status, 200);
assert.equal(root.headers.get('x-jarvis-standalone-worker'), 'v1');
assert.equal(root.headers.get('x-jarvis-aurentara-runtime-shared'), 'false');
const html = await root.text();
assert.match(html, /JARVIS · Private Command Center/);
assert.doesNotMatch(html, /\/jarvis\/api\//);
assert.match(html, /href="\/connect\/google"/);

const session = await handleJarvisStandaloneWorkerV1(
  new Request('https://jarvis-private.example.workers.dev/api/session'),
  {},
  {},
  options
);
assert.equal(session.status, 200);
const sessionBody = await session.json();
assert.equal(sessionBody.authenticated, true);
assert.equal(sessionBody.hamyren_session_shared, false);

const legacy = await handleJarvisStandaloneWorkerV1(
  new Request('https://jarvis-private.example.workers.dev/jarvis'),
  {},
  {},
  options
);
assert.equal(legacy.status, 404);

const denied = await handleJarvisStandaloneWorkerV1(
  new Request('https://jarvis-private.example.workers.dev/'),
  {},
  {},
  {}
);
assert.ok([401, 403, 503].includes(denied.status));

const config = JSON.parse(fs.readFileSync('wrangler.jarvis-private.jsonc', 'utf8'));
assert.equal(config.name, 'jarvis-private-staging');
assert.equal(config.main, 'src/jarvis/standalone-worker-v1.js');
assert.equal(config.workers_dev, false);
assert.equal('routes' in config, false);
assert.equal(config.vars.JARVIS_HOST_MODE, 'NEUTRAL_CUSTOM_HOST_REQUIRED');
assert.equal(config.vars.JARVIS_PUBLIC_ACCESS, 'false');
assert.equal(config.vars.JARVIS_PRODUCTION_DEPLOY, 'false');
assert.equal(config.vars.JARVIS_DATA_PLANE, 'EPHEMERAL_UNTIL_ISOLATED');
assert.equal(JSON.stringify(config).includes('aurentarasystems.com'), false);
assert.equal(JSON.stringify(config).includes('HAMYREN'), false);
assert.equal(JSON.stringify(config).includes('RIOSYSTEMS_'), false);
assert.equal(JSON.stringify(config).includes('SUPABASE_URL'), false);

const aurentaraEntry = fs.readFileSync('src/entry.js', 'utf8');
const aurentaraWrangler = fs.readFileSync('wrangler.jsonc', 'utf8');
assert.equal(aurentaraEntry.includes('handleJarvisHttpV1'), false);
assert.equal(aurentaraEntry.includes('/jarvis'), false);
assert.equal(aurentaraWrangler.includes('JARVIS_'), false);

const manifest = jarvisStandaloneWorkerManifestV1();
assert.equal(manifest.dedicated_worker, true);
assert.equal(manifest.aurentara_runtime_shared, false);
assert.equal(manifest.hamyren_runtime_shared, false);
assert.equal(manifest.public_access, false);
assert.equal(manifest.production_deploy, false);

console.log('JARVIS Standalone Private Worker V1 smoke: PASS');
