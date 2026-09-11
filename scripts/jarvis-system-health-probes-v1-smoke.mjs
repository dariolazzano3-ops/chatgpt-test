import assert from 'node:assert/strict';
import {
  createHttpHealthProbeV1,
  createJarvisSelfProbeV1,
  createJarvisSystemHealthProbesFromEnvV1,
  jarvisSystemHealthProbesManifestV1
} from '../src/jarvis/system-health-probes-v1.js';
import { createMemoryJarvisStoreV1 } from '../src/jarvis/memory-store-memory-v1.js';
import { createJarvisSessionV1 } from '../src/jarvis/session-v1.js';
import { createJarvisCommandCenterLiveProbeBindingsV1, createJarvisCommandCenterTruthSnapshotV1 } from '../src/jarvis/command-center-runtime-truth-v1.js';

const NOW = '2026-09-12T00:00:00.000Z';
const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status });

// ── genuine 2xx -> healthy state ──
{
  const probe = createHttpHealthProbeV1({ domain: 'HERMES', url: 'https://hermes.example.invalid/health', clock: () => NOW, fetch_impl: async (u, init) => { assert.equal(init.method, 'GET'); return json({ status: 'ok' }); } });
  const r = await probe();
  assert.deepEqual(r, { live: true, state: 'ONLINE', source_id: 'jarvis-health-probe:hermes', observed_at: NOW, stale_after_ms: 60000 });
}

// ── non-2xx -> null (UNKNOWN), never a fabricated degraded ──
{
  const probe = createHttpHealthProbeV1({ domain: 'BRIDGE', url: 'https://bridge.example.invalid/health', fetch_impl: async () => new Response('down', { status: 503 }) });
  assert.equal(await probe(), null);
}

// ── network error / timeout -> null ──
{
  const probe = createHttpHealthProbeV1({ domain: 'ASTRA', url: 'https://astra.example.invalid/health', fetch_impl: async () => { throw new Error('ECONNREFUSED'); } });
  assert.equal(await probe(), null);
  const slow = createHttpHealthProbeV1({ domain: 'ASTRA', url: 'https://astra.example.invalid/health', timeout_ms: 40, fetch_impl: async (u, init) => { await new Promise((res, rej) => { const t = setTimeout(res, 2000); init.signal.addEventListener('abort', () => { clearTimeout(t); rej(new Error('aborted')); }); }); return json({}); } });
  assert.equal(await slow(), null);
}

// ── state_from may narrow within allowed states; invalid mapping -> null ──
{
  const busy = createHttpHealthProbeV1({ domain: 'CLAUDE', url: 'https://c.example.invalid/health', clock: () => NOW, state_from: (b) => b.busy ? 'BUSY' : 'AVAILABLE', fetch_impl: async () => json({ busy: true }) });
  assert.equal((await busy()).state, 'BUSY');
  const bogus = createHttpHealthProbeV1({ domain: 'CLAUDE', url: 'https://c.example.invalid/health', state_from: () => 'TOTALLY_MADE_UP', fetch_impl: async () => json({}) });
  assert.equal(await bogus(), null);
}

// ── no URL / config only -> no probe at all (domain stays UNKNOWN) ──
assert.equal(createHttpHealthProbeV1({ domain: 'HERMES', url: '' }), null);
assert.equal(createHttpHealthProbeV1({ domain: 'HERMES', url: 'http://insecure.example/health' }), null); // https only
assert.equal(createHttpHealthProbeV1({ domain: 'NOPE', url: 'https://x/health' }), null);

// ── JARVIS self-probe exercises the store ──
{
  const sess = await createJarvisSessionV1({ ok: true, email: 'op@example.invalid' });
  const store = createMemoryJarvisStoreV1();
  const probe = createJarvisSelfProbeV1({ store, owner_id: sess.owner_id, owner_ref: sess.owner_ref, clock: () => NOW });
  assert.equal((await probe()).state, 'ONLINE');

  const broken = createJarvisSelfProbeV1({ store: { readAudit: async () => { throw new Error('db down'); } }, owner_id: sess.owner_id, owner_ref: sess.owner_ref, clock: () => NOW });
  assert.equal((await broken()).state, 'DEGRADED');

  assert.equal(createJarvisSelfProbeV1({ store: {}, owner_id: sess.owner_id, owner_ref: sess.owner_ref }), null);
}

// ── env factory: only domains with a real URL get a probe ──
{
  const none = createJarvisSystemHealthProbesFromEnvV1({});
  assert.deepEqual(Object.keys(none), []);

  // JARVIS self-probe is opt-in only (default fail-closed)
  const sess2 = await createJarvisSessionV1({ ok: true, email: 'op@example.invalid' });
  const noSelf = createJarvisSystemHealthProbesFromEnvV1({}, { store: createMemoryJarvisStoreV1(), owner_id: sess2.owner_id, owner_ref: sess2.owner_ref });
  assert.deepEqual(Object.keys(noSelf), [], 'self-probe must not auto-enable');
  const withSelf = createJarvisSystemHealthProbesFromEnvV1({ JARVIS_SELF_PROBE: 'on' }, { store: createMemoryJarvisStoreV1(), owner_id: sess2.owner_id, owner_ref: sess2.owner_ref, clock: () => NOW });
  assert.deepEqual(Object.keys(withSelf), ['jarvis']);
  assert.equal((await withSelf.jarvis()).state, 'ONLINE');

  const some = createJarvisSystemHealthProbesFromEnvV1(
    { HERMES_HEALTH_URL: 'https://hermes.example.invalid/h', CLAUDE_HEALTH_URL: 'https://c.example.invalid/h' },
    { fetch_impl: async () => json({ status: 'ok' }), clock: () => NOW }
  );
  assert.deepEqual(Object.keys(some).sort(), ['claude', 'hermes']);

  // wired into the adapter -> only probed domains resolve, the rest stay UNKNOWN
  const bindings = createJarvisCommandCenterLiveProbeBindingsV1(some, { now: NOW });
  const snap = await createJarvisCommandCenterTruthSnapshotV1(bindings, { now: NOW });
  assert.equal(snap.systems.data.HERMES, 'ONLINE');
  assert.equal(snap.systems.data.CLAUDE, 'AVAILABLE');
  assert.equal(snap.systems.data.ASTRA, 'UNKNOWN');
  assert.equal(snap.systems.data.BRIDGE, 'UNKNOWN');
  assert.equal(snap.systems.data.CODEX, 'UNKNOWN');
  assert.equal(snap.systems.data.GIT, 'UNKNOWN');
}

const man = jarvisSystemHealthProbesManifestV1();
assert.equal(man.config_presence_implies_liveness, false);
assert.equal(man.non_2xx_result, 'UNKNOWN');
assert.equal(man.timeout_result, 'UNKNOWN');
assert.equal(man.read_only, true);

console.log('JARVIS system health probes V1 smoke: PASS');
