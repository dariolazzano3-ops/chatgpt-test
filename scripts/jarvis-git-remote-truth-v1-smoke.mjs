import assert from 'node:assert/strict';
import {
  createGithubRemoteHeadResolverV1,
  createJarvisGitRemoteTruthProbeV1,
  createJarvisGitRemoteTruthProbeFromEnvV1,
  jarvisGitRemoteTruthManifestV1
} from '../src/jarvis/git-remote-truth-v1.js';
import { deriveRemoteGitStatus } from '../src/source-of-truth.js';
import { createJarvisCommandCenterLiveProbeBindingsV1, createJarvisCommandCenterTruthSnapshotV1 } from '../src/jarvis/command-center-runtime-truth-v1.js';

const SHA_A = 'a'.repeat(40);
const SHA_B = 'b'.repeat(40);
const NOW = '2026-09-12T00:00:00.000Z';

function fakeFetch(handler) {
  return async (url, init) => {
    assert.equal(init.method, 'GET', 'resolver must only ever GET');
    assert.ok(!/pulls|git\/refs\b|\/git\/commits\b/.test(url) || init.method === 'GET');
    return handler(url, init);
  };
}
const okBody = (sha) => new Response(JSON.stringify({ ref: 'refs/heads/x', object: { type: 'commit', sha } }), { status: 200 });

// ── SYNCED: remote == local ──
{
  const resolve = createGithubRemoteHeadResolverV1({ owner: 'o', repo: 'r', branch: 'b', token: 't', local_head: SHA_A, clock: () => NOW, fetch_impl: fakeFetch(() => okBody(SHA_A)) });
  const out = await resolve();
  assert.equal(out.remote_head, SHA_A);
  assert.equal(out.local_head, SHA_A);
  assert.equal(out.provenance.read_only, true);
  assert.match(out.provenance.endpoint, /api\.github\.com\/repos\/o\/r\/git\/ref\/heads\/b$/);
  assert.equal(deriveRemoteGitStatus({ ...out }).status, 'SYNCED');
}

// ── CHANGED: remote != local ──
{
  const resolve = createGithubRemoteHeadResolverV1({ owner: 'o', repo: 'r', branch: 'b', token: 't', local_head: SHA_A, clock: () => NOW, fetch_impl: fakeFetch(() => okBody(SHA_B)) });
  const out = await resolve();
  assert.equal(deriveRemoteGitStatus({ ...out }).status, 'CHANGED');
}

// ── UNKNOWN: http error, never fabricates SYNCED ──
{
  const resolve = createGithubRemoteHeadResolverV1({ owner: 'o', repo: 'r', branch: 'b', token: 't', local_head: SHA_A, clock: () => NOW, fetch_impl: fakeFetch(() => new Response('nope', { status: 404 })) });
  const out = await resolve();
  assert.equal(out.remote_head, undefined);
  assert.equal(out.error, 'GIT_REMOTE_TRUTH_HTTP_404');
  assert.notEqual(deriveRemoteGitStatus({ ...out }).status, 'SYNCED');
  assert.equal(deriveRemoteGitStatus({ ...out }).status, 'UNKNOWN');
}

// ── UNKNOWN: invalid sha in body ──
{
  const resolve = createGithubRemoteHeadResolverV1({ owner: 'o', repo: 'r', branch: 'b', token: 't', local_head: SHA_A, clock: () => NOW, fetch_impl: fakeFetch(() => new Response(JSON.stringify({ object: { sha: 'short' } }), { status: 200 })) });
  const out = await resolve();
  assert.equal(out.error, 'GIT_REMOTE_TRUTH_SHA_INVALID');
  assert.equal(deriveRemoteGitStatus({ ...out }).status, 'UNKNOWN');
}

// ── UNKNOWN: timeout ──
{
  const resolve = createGithubRemoteHeadResolverV1({ owner: 'o', repo: 'r', branch: 'b', token: 't', local_head: SHA_A, timeout_ms: 50, clock: () => NOW, fetch_impl: async (u, init) => {
    await new Promise((res, rej) => { const t = setTimeout(res, 2000); init.signal.addEventListener('abort', () => { clearTimeout(t); rej(new Error('aborted')); }); });
    return okBody(SHA_A);
  } });
  const out = await resolve();
  assert.equal(out.error, 'GIT_REMOTE_TRUTH_TIMEOUT');
  assert.equal(deriveRemoteGitStatus({ ...out }).status, 'UNKNOWN');
}

// ── not configured -> fails closed, no fetch ──
{
  let called = false;
  const resolve = createGithubRemoteHeadResolverV1({ owner: 'o', repo: 'r', branch: 'b', token: '', fetch_impl: () => { called = true; return okBody(SHA_A); } });
  const out = await resolve();
  assert.equal(called, false);
  assert.equal(out.error, 'GIT_REMOTE_TRUTH_NOT_CONFIGURED');
  assert.equal(resolve.configured, false);
}

// ── probe wired into the runtime-truth adapter -> GIT reflects real remote truth ──
{
  const probe = createJarvisGitRemoteTruthProbeV1({ owner: 'o', repo: 'r', branch: 'b', token: 't', local_head: SHA_A, clock: () => NOW, fetch_impl: fakeFetch(() => okBody(SHA_A)) });
  const bindings = createJarvisCommandCenterLiveProbeBindingsV1({ git: probe }, { now: NOW });
  const snap = await createJarvisCommandCenterTruthSnapshotV1(bindings, { now: NOW });
  assert.equal(snap.systems.data.GIT, 'SYNCED');
  for (const s of ['JARVIS', 'HERMES', 'ASTRA', 'CLAUDE', 'CODEX', 'BRIDGE']) assert.equal(snap.systems.data[s], 'UNKNOWN');

  const probeErr = createJarvisGitRemoteTruthProbeV1({ owner: 'o', repo: 'r', branch: 'b', token: 't', local_head: SHA_A, clock: () => NOW, fetch_impl: fakeFetch(() => new Response('x', { status: 500 })) });
  const snapErr = await createJarvisCommandCenterTruthSnapshotV1(createJarvisCommandCenterLiveProbeBindingsV1({ git: probeErr }, { now: NOW }), { now: NOW });
  assert.equal(snapErr.systems.data.GIT, 'UNKNOWN');
}

// ── env factory ──
{
  assert.equal(createJarvisGitRemoteTruthProbeFromEnvV1({}), null);
  const p = createJarvisGitRemoteTruthProbeFromEnvV1({ GITHUB_REPOSITORY: 'o/r', GITHUB_TOKEN: 't', JARVIS_PROJECT_HEAD: SHA_A }, { fetch_impl: fakeFetch(() => okBody(SHA_A)) });
  assert.equal(typeof p, 'function');
  assert.equal(p.configured, true);
}

const man = jarvisGitRemoteTruthManifestV1();
assert.equal(man.read_only, true);
assert.equal(man.write_operations, 0);
assert.equal(man.fabricates_synced, false);
assert.equal(man.fails_closed_to, 'UNKNOWN');
assert.equal(man.token_returned_or_logged, false);

console.log('JARVIS Git remote truth resolver V1 smoke: PASS');
