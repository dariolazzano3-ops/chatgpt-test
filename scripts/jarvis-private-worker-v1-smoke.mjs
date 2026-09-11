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
assert.match(html, /JARVIS · Command Center/);
assert.match(html, /VISUAL_BASELINE=ACCEPTED/);
assert.match(html, /--amber:#ffab40/);
assert.doesNotMatch(html, /A BRIGHTER YOU/, 'accepted orange Command Center, not the legacy blue UI');
assert.doesNotMatch(html, /\/jarvis\/api\//);

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
assert.equal(config.vars.JARVIS_DATA_PLANE, 'ISOLATED_SUPABASE_TARGET_CONFIGURED_SECRET_REQUIRED');
assert.equal(JSON.stringify(config).includes('aurentarasystems.com'), false);
assert.equal(JSON.stringify(config).includes('HAMYREN'), false);
assert.equal(JSON.stringify(config).includes('RIOSYSTEMS_'), false);
assert.equal(config.vars.JARVIS_PERSONAL_MEMORY_STORE, 'supabase-rpc');
assert.match(config.vars.JARVIS_PERSONAL_MEMORY_SUPABASE_URL, /^https:\/\/[a-z0-9]+\.supabase\.co$/);
assert.equal('JARVIS_PERSONAL_MEMORY_SUPABASE_SERVICE_ROLE_KEY' in config.vars, false);

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


const accessSource = fs.readFileSync('src/jarvis/access-v1.js', 'utf8');
const httpSource = fs.readFileSync('src/jarvis/http-v1.js', 'utf8');
assert.equal(accessSource.includes('RIOSYSTEMS_OPERATOR_EMAIL'), false);
assert.equal(httpSource.includes('RIOSYSTEMS_ENVIRONMENT'), false);

const unboundChat = await handleJarvisStandaloneWorkerV1(
  new Request('https://jarvis-private.example.invalid/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ message: 'Was ist heute geplant?' })
  }),
  {
    JARVIS_ENVIRONMENT: 'private-staging',
    JARVIS_PERSONAL_MEMORY_STORE: 'supabase-rpc',
    JARVIS_PERSONAL_MEMORY_SUPABASE_URL: 'https://example.supabase.co'
  },
  {},
  { authorize }
);
assert.equal(unboundChat.status, 503);
const unboundBody = await unboundChat.json();
assert.equal(unboundBody.error, 'JARVIS_DURABLE_MEMORY_NOT_READY');

console.log('JARVIS shared-runtime fallback guard: PASS');
