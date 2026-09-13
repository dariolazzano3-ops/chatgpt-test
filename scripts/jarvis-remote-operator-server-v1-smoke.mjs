/* JARVIS Remote Operator V1 — targeted smoke test.

   CI-safe: no live Claude CLI spawn, no live Supabase network call, no live
   Cloudflare Access JWKS fetch. Uses real temp git repos (via `git`, already
   a build dependency of this project) and a real in-memory JARVIS store. The
   real Node http server binds to an ephemeral localhost port.

   Proves: (1) this runtime never accepts LOCAL_OPERATOR_AUTH and has no
   local-identity fallback; (2) it fails closed on missing Access config,
   Supabase RPC config, repo truth, and requested-but-unbound Claude
   execution; (3) the Program Controller is genuinely bound (not stubbed)
   when real dependencies are present; (4) it never binds a public interface
   and never imports the disposable-tmp Claude execution path. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  startJarvisRemoteOperatorV1,
  verifyJarvisRemoteOperatorSafetyFlagsV1,
  verifyJarvisRemoteOperatorAccessConfigV1,
  verifyJarvisRemoteOperatorSupabaseConfigV1,
  verifyJarvisRemoteOperatorCanonicalOwnerConfigV1,
  resolveJarvisRemoteOperatorProgramLocationV1,
  resolveJarvisRemoteOperatorClaudeBridgeV1,
  createJarvisRemoteOperatorProgramControllerV1,
  jarvisRemoteOperatorManifestV1,
  JARVIS_REMOTE_OPERATOR_BIND_HOST,
  REMOTE_OPERATOR_AUTHENTICATION_LABEL
} from '../src/jarvis/remote-operator-server-v1.js';
import { createMemoryJarvisStoreV1 } from '../src/jarvis/memory-store-memory-v1.js';
import { authorizeJarvisV1 } from '../src/jarvis/access-v1.js';

const CANONICAL_HISTORICAL_OWNER_ID = '8048e3a6-941f-5ea7-ac74-11f9929d2523';
const CANONICAL_HISTORICAL_OWNER_REF = 'jarvis:operator:local-operator@localhost';

let passed = 0;
async function check(name, fn) {
  await fn();
  passed++;
  console.log(`ok - ${name}`);
}

function initFixtureGitRepoV1(branchName) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-remote-smoke-'));
  execFileSync('git', ['init', '-q'], { cwd: dir });
  execFileSync('git', ['symbolic-ref', 'HEAD', `refs/heads/${branchName}`], { cwd: dir });
  execFileSync('git', ['config', 'user.email', 'smoke@example.invalid'], { cwd: dir });
  execFileSync('git', ['config', 'user.name', 'JARVIS Smoke'], { cwd: dir });
  fs.writeFileSync(path.join(dir, 'fixture.txt'), 'fixture\n');
  execFileSync('git', ['add', '.'], { cwd: dir });
  execFileSync('git', ['commit', '-q', '-m', 'fixture init'], { cwd: dir });
  return dir;
}

const REAL_ACCESS_ENV = {
  JARVIS_ACCESS_AUD: 'jarvis-remote-operator-fixture-aud',
  JARVIS_ACCESS_TEAM_DOMAIN: 'fixture-team.cloudflareaccess.com',
  JARVIS_OPERATOR_EMAIL: 'operator@example.invalid'
};
const REAL_SUPABASE_ENV = {
  JARVIS_PERSONAL_MEMORY_STORE: 'supabase-rpc',
  JARVIS_PERSONAL_MEMORY_SUPABASE_URL: 'https://fixture.supabase.co',
  JARVIS_PERSONAL_MEMORY_SUPABASE_SERVICE_ROLE_KEY: 'fixture-key-not-real'
};

// ── A. never binds a public interface ──
await check('A. bind address is 127.0.0.1, never 0.0.0.0', () => {
  assert.equal(JARVIS_REMOTE_OPERATOR_BIND_HOST, '127.0.0.1');
});

// ── B. no LOCAL_OPERATOR_AUTH import, no local-identity fallback ──
await check('B. this file never imports local-operator-server-v1.js or defines a LOCAL_OPERATOR_AUTH-style adapter', () => {
  const src = fs.readFileSync(new URL('../src/jarvis/remote-operator-server-v1.js', import.meta.url), 'utf8');
  // Prose comments legitimately name these modules/identifiers to document
  // the contrast; what must never appear is an actual import statement or
  // definition wiring them in.
  assert.doesNotMatch(src, /from\s+['"][^'"]*local-operator-server-v1/, 'must never import the local-only launcher');
  assert.doesNotMatch(src, /from\s+['"][^'"]*claude-code-local-runtime-binding-v1/, 'must never import the disposable-tmp execution path — repo-bound only');
  assert.doesNotMatch(src, /\b(?:function|const)\s+LOCAL_OPERATOR_AUTH\b/, 'must never define a local-identity auth adapter of its own');
  assert.doesNotMatch(src, /options\.authorize\s*=\s*(?!overrides\.authorize)/, 'authorize must only ever come from a test override, never a hardcoded local adapter');
  assert.equal(REMOTE_OPERATOR_AUTHENTICATION_LABEL, 'CLOUDFLARE_ACCESS_JWT');
});

// ── C. local-operator-server-v1.js stays unmodified / uncoupled by this feature ──
await check('C. local-operator-server-v1.js has no coupling to the remote runtime', () => {
  const src = fs.readFileSync(new URL('../src/jarvis/local-operator-server-v1.js', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /remote-operator/i, 'local launcher must stay untouched by the new remote entrypoint');
});

// ── D. fail-closed: safety flags ──
await check('D. refuses to start when JARVIS_PUBLIC_ACCESS or JARVIS_PRODUCTION_DEPLOY is true', () => {
  assert.equal(verifyJarvisRemoteOperatorSafetyFlagsV1({}).ok, true);
  const publicOn = verifyJarvisRemoteOperatorSafetyFlagsV1({ JARVIS_PUBLIC_ACCESS: 'true' });
  assert.equal(publicOn.ok, false);
  assert.equal(publicOn.error, 'JARVIS_REMOTE_OPERATOR_PUBLIC_ACCESS_FORBIDDEN');
  const prodOn = verifyJarvisRemoteOperatorSafetyFlagsV1({ JARVIS_PRODUCTION_DEPLOY: 'on' });
  assert.equal(prodOn.ok, false);
  assert.equal(prodOn.error, 'JARVIS_REMOTE_OPERATOR_PRODUCTION_DEPLOY_FORBIDDEN');
});

// ── E. fail-closed: Cloudflare Access config required at startup ──
await check('E. refuses to start without a dedicated Cloudflare Access audience/team/operator-email', () => {
  const missing = verifyJarvisRemoteOperatorAccessConfigV1({});
  assert.equal(missing.ok, false);
  assert.equal(missing.error, 'JARVIS_REMOTE_OPERATOR_ACCESS_CONFIG_MISSING');
  assert.deepEqual(missing.missing.sort(), ['JARVIS_ACCESS_AUD', 'JARVIS_ACCESS_TEAM_DOMAIN', 'JARVIS_OPERATOR_EMAIL'].sort());
  assert.equal(verifyJarvisRemoteOperatorAccessConfigV1(REAL_ACCESS_ENV).ok, true);
});

// ── F. fail-closed: Supabase RPC config required, legacy mode refused ──
await check('F. Supabase config verifier requires supabase-rpc and refuses the legacy mode', () => {
  assert.equal(verifyJarvisRemoteOperatorSupabaseConfigV1({}).error, 'JARVIS_REMOTE_OPERATOR_SUPABASE_RPC_MODE_REQUIRED');
  assert.equal(
    verifyJarvisRemoteOperatorSupabaseConfigV1({ JARVIS_PERSONAL_MEMORY_STORE: 'supabase' }).error,
    'JARVIS_REMOTE_OPERATOR_SUPABASE_RPC_MODE_REQUIRED',
    'legacy "supabase" mode fails closed, same as unset'
  );
  const partial = verifyJarvisRemoteOperatorSupabaseConfigV1({ JARVIS_PERSONAL_MEMORY_STORE: 'supabase-rpc' });
  assert.equal(partial.error, 'JARVIS_REMOTE_OPERATOR_SUPABASE_ENV_MISSING');
  assert.equal(verifyJarvisRemoteOperatorSupabaseConfigV1(REAL_SUPABASE_ENV).ok, true);
});

// ── G. fail-closed: real, provable repo/branch truth required ──
const fixtureRepoDir = initFixtureGitRepoV1('jarvis-remote-smoke-fixture-branch');
const detachedRepoDir = initFixtureGitRepoV1('jarvis-remote-smoke-detached-branch');
await check('G. repo truth resolves only from a real repo on a resolvable, non-detached branch', () => {
  assert.equal(resolveJarvisRemoteOperatorProgramLocationV1({}).error, 'JARVIS_REMOTE_OPERATOR_REPO_DIR_REQUIRED');
  assert.equal(
    resolveJarvisRemoteOperatorProgramLocationV1({ JARVIS_CLAUDE_REPO_DIR: '/nonexistent/jarvis-fixture-path' }).error,
    'JARVIS_REMOTE_OPERATOR_REPO_DIR_UNAVAILABLE'
  );

  const detachedSha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: detachedRepoDir }).toString('utf8').trim();
  execFileSync('git', ['checkout', '-q', detachedSha], { cwd: detachedRepoDir });
  const detached = resolveJarvisRemoteOperatorProgramLocationV1({ JARVIS_CLAUDE_REPO_DIR: detachedRepoDir });
  assert.equal(detached.ok, false);
  assert.equal(detached.error, 'JARVIS_REMOTE_OPERATOR_TARGET_BRANCH_UNPROVABLE');

  const real = resolveJarvisRemoteOperatorProgramLocationV1({ JARVIS_CLAUDE_REPO_DIR: fixtureRepoDir });
  assert.equal(real.ok, true);
  assert.equal(real.repo_dir, fixtureRepoDir);
  assert.equal(real.target_branch, 'jarvis-remote-smoke-fixture-branch');
});

// ── H. fail-closed: Claude execution is private Bridge HTTP only and never fabricates binding ──
await check('H. Claude bridge resolves off by default and never fabricates binding when the private Bridge is unavailable', async () => {
  const off = await resolveJarvisRemoteOperatorClaudeBridgeV1({});
  assert.equal(off.requested, false);
  assert.equal(off.bound, false);

  const unavailable = await resolveJarvisRemoteOperatorClaudeBridgeV1({
    JARVIS_BRIDGE_HTTP_EXECUTION: 'on',
    JARVIS_BRIDGE_URL: 'http://127.0.0.1:1',
    JARVIS_BRIDGE_TOKEN: 'fixture-token-not-real'
  }, { bridge_http_options: { health_timeout_ms: 500 } });
  assert.equal(unavailable.requested, true);
  assert.equal(unavailable.bound, false, 'an unreachable Bridge must never be reported as bound');
});

// ── I. startup wiring end-to-end refuses to start when requested execution is unbound ──
await check('I. startJarvisRemoteOperatorV1 fails closed when Bridge HTTP execution is requested but unbound', async () => {
  const result = await startJarvisRemoteOperatorV1({
    ...REAL_ACCESS_ENV,
    ...REAL_SUPABASE_ENV,
    JARVIS_CLAUDE_REPO_DIR: fixtureRepoDir,
    JARVIS_BRIDGE_HTTP_EXECUTION: 'on',
    JARVIS_BRIDGE_URL: 'http://127.0.0.1:1',
    JARVIS_BRIDGE_TOKEN: 'fixture-token-not-real'
  }, { claude_binding_options: { health_timeout_ms: 500 } });
  assert.equal(result.ok, false);
  assert.equal(result.error, 'JARVIS_BRIDGE_HTTP_EXECUTION_REQUESTED_BUT_UNBOUND');
});

// ── H2. no local Claude CLI is ever required to start this runtime ──
await check('H2. the remote operator never shells out to a `claude` binary anywhere in its own source', () => {
  const src = fs.readFileSync(new URL('../src/jarvis/remote-operator-server-v1.js', import.meta.url), 'utf8');
  // Prose comments legitimately name these modules to document the
  // contrast (see check B above for the same reasoning) — what must never
  // appear is an actual import statement wiring one in.
  assert.doesNotMatch(src, /from\s+['"][^'"]*claude-code-repo-bound-runtime-binding/, 'must not import the local-CLI repo-bound path');
  assert.doesNotMatch(src, /from\s+['"][^'"]*claude-code-local-runtime-binding/, 'must not import the disposable-tmp local path');
  assert.match(src, /from\s+['"][^'"]*claude-code-bridge-http-runtime-binding/, 'must import the Bridge HTTP binding');
  assert.doesNotMatch(src, /'claude'/, 'must not reference a local claude binary name');
});

// ── J. Program Controller is genuinely bound (not stubbed) when real deps are present ──
const memoryStore = createMemoryJarvisStoreV1();
await check('J. Program Controller reaches the real handler and reports genuine program state', async () => {
  const controller = createJarvisRemoteOperatorProgramControllerV1({}, { memory_store: memoryStore });
  const ownerId = crypto.randomUUID();
  const state = await controller.state({
    owner_id: ownerId, owner_ref: 'smoke-owner', program: 'JARVIS_MASTERARCHITECTURE_V2',
    repo_dir: fixtureRepoDir, target_branch: 'jarvis-remote-smoke-fixture-branch'
  });
  assert.equal(state.ok, true);
  assert.equal(state.schema, 'aurentara.jarvis.program-state.v1');
  assert.equal(typeof state.current_wave, 'number');

  // JARVIS_ENVIRONMENT=staging disables the in-memory fallback store
  // (resolveJarvisMemoryStoreV1's own rule — see http-v1.js), so with no
  // Supabase RPC env configured either, the store genuinely resolves to
  // null and the controller must fail closed rather than fabricate one.
  const noStoreController = createJarvisRemoteOperatorProgramControllerV1({ JARVIS_ENVIRONMENT: 'staging' }, {});
  const noStore = await noStoreController.state({});
  assert.equal(noStore.ok, false);
  assert.equal(noStore.status, 503);
});

// ── K. full private end-to-end server: real Cloudflare Access default path, no LOCAL_OPERATOR_AUTH bypass ──
// Per-request handling (handleJarvisRemoteOperatorRequestV1) deliberately
// reads real `process.env` for every request — same as local-operator-server-v1.js
// — so authorizeJarvisV1's real default path is exercised against the
// actual process environment, not just the `env` object passed to
// startJarvisRemoteOperatorV1 (which only governs this function's own
// startup gates above).
const previousProcessAccessEnv = {
  JARVIS_ACCESS_AUD: process.env.JARVIS_ACCESS_AUD,
  JARVIS_ACCESS_TEAM_DOMAIN: process.env.JARVIS_ACCESS_TEAM_DOMAIN,
  JARVIS_OPERATOR_EMAIL: process.env.JARVIS_OPERATOR_EMAIL
};
Object.assign(process.env, REAL_ACCESS_ENV);

const started = await startJarvisRemoteOperatorV1(
  { ...REAL_ACCESS_ENV, ...REAL_SUPABASE_ENV, JARVIS_REMOTE_PORT: '18788' },
  {
    safety_check: { ok: true },
    access_check: { ok: true },
    supabase_check: { ok: true },
    memory_store: memoryStore,
    program_location: { ok: true, repo_dir: fixtureRepoDir, target_branch: 'jarvis-remote-smoke-fixture-branch' }
    // deliberately NO `authorize` override — this exercises the real
    // authorizeJarvisV1 -> verifyJarvisCloudflareAccessJwtV1 default path.
  }
);
assert.equal(started.ok, true, 'server starts when all real config checks are satisfied');
assert.equal(started.claude_bridge_result.bound, false, 'no execution requested — read-only server');

const base = started.url;
try {
  await check('K1. an unauthenticated request is refused (401) — no Access JWT, no fallback', async () => {
    const res = await fetch(base + '/api/status');
    const body = await res.json();
    assert.equal(res.status, 401);
    assert.equal(body.ok, false);
    assert.match(body.error, /ACCESS/);
  });

  await check('K2. a forged/garbage Access header is still refused — no LOCAL_OPERATOR_AUTH-style trust-the-client path exists', async () => {
    const res = await fetch(base + '/api/status', {
      headers: { 'cf-access-jwt-assertion': 'not-a-real-jwt', 'x-jarvis-local-operator-email': 'operator@example.invalid' }
    });
    const body = await res.json();
    assert.equal(res.status, 401);
    assert.equal(body.ok, false);
  });

  await check('K3. env vars that would satisfy LOCAL_OPERATOR_AUTH have zero effect here', async () => {
    // Setting JARVIS_LOCAL_OPERATOR_EMAIL in process.env (as the local
    // launcher reads it) must not grant access through this runtime, since
    // this file never reads that variable and never wires that adapter.
    const previous = process.env.JARVIS_LOCAL_OPERATOR_EMAIL;
    process.env.JARVIS_LOCAL_OPERATOR_EMAIL = 'operator@example.invalid';
    try {
      const res = await fetch(base + '/api/status');
      assert.equal(res.status, 401);
    } finally {
      if (previous === undefined) delete process.env.JARVIS_LOCAL_OPERATOR_EMAIL;
      else process.env.JARVIS_LOCAL_OPERATOR_EMAIL = previous;
    }
  });
} finally {
  await new Promise((resolve) => started.server.close(resolve));
  for (const [key, value] of Object.entries(previousProcessAccessEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

// ── L. manifest is honest about this runtime's shape ──
await check('L. manifest declares no local-auth acceptance, private-Bridge-HTTP-only execution, no public/production access', () => {
  const manifest = jarvisRemoteOperatorManifestV1();
  assert.equal(manifest.local_operator_auth_accepted, false);
  assert.equal(manifest.disposable_tmp_execution_available, false);
  assert.equal(manifest.execution_mode, 'PRIVATE_BRIDGE_HTTP_ONLY');
  assert.equal(manifest.local_claude_cli_required, false);
  assert.equal(manifest.public_access, false);
  assert.equal(manifest.production_deploy, false);
  assert.equal(manifest.hamyren_data_flow, false);
  assert.equal(manifest.auth, 'CLOUDFLARE_ACCESS_JWT');
});

// ── M. canonical owner config fails startup closed when malformed ──
await check('M. malformed JARVIS_CANONICAL_OWNER_EMAIL fails startup closed', async () => {
  const invalid = verifyJarvisRemoteOperatorCanonicalOwnerConfigV1({ JARVIS_CANONICAL_OWNER_EMAIL: 'not-an-email' });
  assert.equal(invalid.ok, false);
  assert.equal(invalid.error, 'JARVIS_REMOTE_OPERATOR_CANONICAL_OWNER_EMAIL_INVALID');

  const startResult = await startJarvisRemoteOperatorV1(
    { ...REAL_ACCESS_ENV, ...REAL_SUPABASE_ENV, JARVIS_CANONICAL_OWNER_EMAIL: 'not-an-email', JARVIS_CLAUDE_REPO_DIR: fixtureRepoDir },
    {}
  );
  assert.equal(startResult.ok, false);
  assert.equal(startResult.error, 'JARVIS_REMOTE_OPERATOR_CANONICAL_OWNER_EMAIL_INVALID');
});

// ── N. absent by default -> unchanged behavior ──
await check('N. no JARVIS_CANONICAL_OWNER_EMAIL -> config check passes with an empty override (unchanged default behavior)', () => {
  const absent = verifyJarvisRemoteOperatorCanonicalOwnerConfigV1({});
  assert.equal(absent.ok, true);
  assert.equal(absent.canonical_owner_email, '');
});

// ── O. wrong Cloudflare identity still gets 403 from the real, unmodified access-v1.js path ──
await check('O. a verified-but-wrong Cloudflare email is refused (403) by the real authorizeJarvisV1 path', async () => {
  const env = { JARVIS_OPERATOR_EMAIL: 'operator@example.invalid', JARVIS_ACCESS_AUD: 'fixture-aud' };
  // ctx.access is the same Cloudflare-Pages-style Access binding adapter
  // authorizeJarvisV1 already supports — exercised here without a live JWT/
  // JWKS round trip, since only the post-verification identity check is
  // under test.
  const ctx = { access: { aud: 'fixture-aud', getIdentity: async () => ({ email: 'someone-else@example.invalid' }) } };
  const result = await authorizeJarvisV1(new Request('https://example.invalid/jarvis/api/status'), env, ctx, {});
  assert.equal(result.ok, false);
  assert.equal(result.status, 403);
  assert.equal(result.error, 'JARVIS_IDENTITY_NOT_ALLOWED');
});

// ── P. end-to-end: Program Controller receives the canonical owner_id/owner_ref,
//     regardless of which real Cloudflare identity authenticated, and no
//     client-supplied header/query can override it ──
await check('P. Program Controller receives canonical owner_id/owner_ref end-to-end; client overrides are ignored', async () => {
  const calls = [];
  const spyProgramController = {
    async tick(request) { calls.push(request); return { ok: true, status: 200 }; },
    async state(request) { calls.push(request); return { ok: true, status: 200, schema: 'aurentara.jarvis.program-state.v1' }; }
  };
  // A DIFFERENT real Cloudflare identity than the canonical owner — proves
  // owner scope is not simply "whoever is logged in".
  const authorize = async () => ({
    ok: true, operator_id: 'jarvis-operator:different-real-user@example.invalid',
    email: 'different-real-user@example.invalid', authentication: 'CLOUDFLARE_ACCESS_JWT'
  });

  const started = await startJarvisRemoteOperatorV1(
    { ...REAL_ACCESS_ENV, ...REAL_SUPABASE_ENV, JARVIS_REMOTE_PORT: '18801' },
    {
      safety_check: { ok: true }, access_check: { ok: true }, supabase_check: { ok: true },
      authorize, memory_store: memoryStore,
      program_controller: spyProgramController,
      canonical_owner_email: 'local-operator@localhost',
      program_location: { ok: true, repo_dir: fixtureRepoDir, target_branch: 'jarvis-remote-smoke-fixture-branch' }
    }
  );
  assert.equal(started.ok, true);
  assert.equal(started.canonical_owner_email, 'local-operator@localhost');

  try {
    const qs = new URLSearchParams({
      program: 'JARVIS_MASTERARCHITECTURE_V2', repo_dir: fixtureRepoDir, target_branch: 'jarvis-remote-smoke-fixture-branch',
      // client-supplied attempts to override owner scope directly — must be ignored
      owner_id: 'client-supplied-owner-id', owner_ref: 'client-supplied-owner-ref', canonical_owner_email: 'attacker@example.invalid'
    });
    const res = await fetch(started.url + '/api/program/state?' + qs.toString(), {
      headers: {
        'x-jarvis-canonical-owner-email': 'attacker@example.invalid',
        'x-jarvis-owner-id': 'client-supplied-owner-id'
      }
    });
    assert.equal(res.status, 200);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].owner_id, CANONICAL_HISTORICAL_OWNER_ID, 'Program Controller must receive the canonical owner_id, never a client-supplied one');
    assert.equal(calls[0].owner_ref, CANONICAL_HISTORICAL_OWNER_REF, 'Program Controller must receive the canonical owner_ref, never a client-supplied one');
  } finally {
    await new Promise((resolve) => started.server.close(resolve));
  }
});

fs.rmSync(fixtureRepoDir, { recursive: true, force: true });
fs.rmSync(detachedRepoDir, { recursive: true, force: true });

console.log(JSON.stringify({
  schema: 'aurentara.jarvis.remote-operator-server.smoke.v1',
  passed,
  canonical_historical_owner_id_verified: CANONICAL_HISTORICAL_OWNER_ID,
  live_claude_cli_invoked: false,
  live_supabase_network_call: false,
  live_cloudflare_access_jwks_fetch: false,
  supabase_mutated: false
}, null, 2));
