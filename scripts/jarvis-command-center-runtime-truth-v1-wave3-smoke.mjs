import assert from 'node:assert/strict';
import { handleJarvisHttpV1, jarvisHttpManifestV1 } from '../src/jarvis/http-v1.js';
import {
  createJarvisCommandCenterLiveProbeBindingsV1,
  createJarvisCommandCenterTruthSnapshotV1,
  jarvisCommandCenterLiveProbeContractV1,
  jarvisCommandCenterRuntimeTruthManifestV1
} from '../src/jarvis/command-center-runtime-truth-v1.js';
import { deriveRemoteGitStatus, sourceOfTruthManifest } from '../src/source-of-truth.js';
import { jarvisIntegrationLivenessClaimV1, jarvisIntegrationManifestV1 } from '../src/jarvis/integration-layer-v1.js';

const NOW = '2026-09-11T12:00:00.000Z';
const FRESH = '2026-09-11T11:59:30.000Z';
const HEAD_A = 'a'.repeat(40);
const HEAD_B = 'b'.repeat(40);

const authorize = async () => ({ ok: true, operator_id: 'operator:private@example.invalid', email: 'private@example.invalid' });

async function runtimeTruth(options) {
  const res = await handleJarvisHttpV1(
    new Request('https://example.invalid/jarvis/api/runtime-truth'),
    {},
    {},
    { authorize, now: NOW, ...options }
  );
  const body = await res.json();
  return { res, body };
}

// 1. Fail-closed default: no probes configured -> everything UNKNOWN / empty.
{
  const { res, body } = await runtimeTruth({});
  assert.equal(res.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.read_only, true);
  assert.equal(body.production_deploy, false);
  assert.equal(body.hamyren_data_flow, false);
  assert.equal(body.schema, 'aurentara.jarvis.command-center.runtime-truth.v1');
  assert.equal(body.validation.ok, true);
  assert.equal(body.systems.source.source_state, 'NOT_CONNECTED');
  for (const system of ['JARVIS', 'HERMES', 'ASTRA', 'CLAUDE', 'CODEX', 'BRIDGE', 'GIT']) {
    assert.equal(body.systems.data[system], 'UNKNOWN', `${system} must fail closed to UNKNOWN`);
  }
  assert.equal(body.runs.data.items.length, 0);
  assert.equal(body.activity.data.items.length, 0);
  assert.equal(body.approvals.data.items.length, 0);
  assert.equal(body.evidence.data.items.length, 0);
  assert.equal(body.projects.data, null);
  assert.equal(body.costs.data, null);
  assert.equal(body.safeguards.command_dispatch_enabled, false);
  assert.equal(body.safeguards.production_deploy, false);
  assert.equal(body.safeguards.canonical_merge, false);
  assert.equal(body.safeguards.dns_write, false);
  assert.equal(body.safeguards.billing_write, false);
  assert.equal(body.safeguards.secret_rotation, false);
  assert.equal(body.safeguards.hamyren_data_flow, false);
}

// 2. Auth gate: unauthorized callers get a private 403, no snapshot.
{
  const res = await handleJarvisHttpV1(
    new Request('https://example.invalid/jarvis/api/runtime-truth'),
    {},
    {},
    { authorize: async () => ({ ok: false, status: 403, error: 'DENIED' }) }
  );
  assert.equal(res.status, 403);
  const body = await res.json();
  assert.equal(body.ok, false);
  assert.equal(body.private, true);
}

// 3. A genuine live probe proves exactly one system; the rest stay UNKNOWN.
{
  const { body } = await runtimeTruth({
    command_center_probes: {
      jarvis: async () => ({ live: true, state: 'ONLINE', source_id: 'jarvis-health-probe-v1', observed_at: FRESH })
    }
  });
  assert.equal(body.systems.data.JARVIS, 'ONLINE');
  for (const system of ['HERMES', 'ASTRA', 'CLAUDE', 'CODEX', 'BRIDGE', 'GIT']) {
    assert.equal(body.systems.data[system], 'UNKNOWN', `${system} without a probe must stay UNKNOWN`);
  }
  assert.equal(body.systems.source.classification, 'DERIVED');
  assert.deepEqual(body.systems.source.derived_from, ['jarvis:jarvis-health-probe-v1']);
  assert.equal(body.validation.ok, true);
}

// 4. Probes without genuine live proof are rejected -> UNKNOWN.
{
  const { body } = await runtimeTruth({
    command_center_probes: {
      jarvis: async () => ({ live: false, state: 'ONLINE', source_id: 'p', observed_at: FRESH }),
      hermes: async () => ({ state: 'ONLINE', source_id: 'p', observed_at: FRESH }),          // no live flag
      astra: async () => ({ live: true, state: 'ONLINE', source_id: 'p', observed_at: FRESH }), // wrong enum for ASTRA
      claude: async () => ({ live: true, state: 'AVAILABLE', observed_at: FRESH }),             // no source_id
      codex: async () => ({ live: true, state: 'ACTIVE', source_id: 'p' }),                     // no observed_at
      bridge: async () => { throw new Error('probe transport failure'); }
    }
  });
  for (const system of ['JARVIS', 'HERMES', 'ASTRA', 'CLAUDE', 'CODEX', 'BRIDGE']) {
    assert.equal(body.systems.data[system], 'UNKNOWN', `${system} unproven probe must stay UNKNOWN`);
  }
}

// 5. Stale probe is not accepted as live truth.
{
  const { body } = await runtimeTruth({
    command_center_probes: {
      claude: async () => ({ live: true, state: 'BUSY', source_id: 'claude-probe', observed_at: '2026-09-11T10:00:00.000Z', stale_after_ms: 60_000 })
    }
  });
  assert.equal(body.systems.data.CLAUDE, 'UNKNOWN');
}

// 6. GIT status comes only from genuine remote truth.
{
  const synced = await runtimeTruth({
    command_center_probes: {
      git: async () => ({ source_id: 'github-remote-truth-v1', observed_at: FRESH, remote_head: HEAD_A, local_head: HEAD_A })
    }
  });
  assert.equal(synced.body.systems.data.GIT, 'SYNCED');

  const changed = await runtimeTruth({
    command_center_probes: {
      git: async () => ({ source_id: 'github-remote-truth-v1', observed_at: FRESH, remote_head: HEAD_A, local_head: HEAD_B })
    }
  });
  assert.equal(changed.body.systems.data.GIT, 'CHANGED');

  const noRemote = await runtimeTruth({
    command_center_probes: {
      git: async () => ({ source_id: 'github-remote-truth-v1', observed_at: FRESH, local_head: HEAD_A })
    }
  });
  assert.equal(noRemote.body.systems.data.GIT, 'UNKNOWN');

  const shortSha = await runtimeTruth({
    command_center_probes: {
      git: async () => ({ source_id: 'github-remote-truth-v1', observed_at: FRESH, remote_head: 'abc123', local_head: HEAD_A })
    }
  });
  assert.equal(shortSha.body.systems.data.GIT, 'UNKNOWN');
}

// 7. deriveRemoteGitStatus unit contract.
{
  assert.equal(deriveRemoteGitStatus({ remote_head: HEAD_A, local_head: HEAD_A, source_id: 's', observed_at: FRESH }).status, 'SYNCED');
  assert.equal(deriveRemoteGitStatus({ remote_head: HEAD_A, local_head: HEAD_B, source_id: 's', observed_at: FRESH }).status, 'CHANGED');
  assert.equal(deriveRemoteGitStatus({ remote_head: HEAD_A, source_id: 's', observed_at: FRESH }).status, 'UNKNOWN');
  assert.equal(deriveRemoteGitStatus({ remote_head: HEAD_A, local_head: HEAD_A }).status, 'UNKNOWN', 'provenance is mandatory');
  assert.equal(sourceOfTruthManifest().remote_git_status_fails_closed_to_unknown, true);
}

// 8. Builder omits the system binding entirely when nothing is configured.
{
  const bindings = createJarvisCommandCenterLiveProbeBindingsV1({}, { now: NOW });
  assert.equal('system_status' in bindings, false);
  const snapshot = await createJarvisCommandCenterTruthSnapshotV1(bindings, { now: NOW });
  assert.equal(snapshot.systems.source.source_state, 'NOT_CONNECTED');
  assert.equal(snapshot.systems.data.JARVIS, 'UNKNOWN');
}

// 9. Real runs / activity readers still flow through the accepted Wave 2 contract.
{
  const bindings = createJarvisCommandCenterLiveProbeBindingsV1({
    jarvis: async () => ({ live: true, state: 'ONLINE', source_id: 'jarvis-health-probe-v1', observed_at: FRESH }),
    runs: async () => ({
      classification: 'REAL',
      source_id: 'runtime-job-store-v1',
      observed_at: FRESH,
      data: [{ job_id: 'job-1', task_type: 'Runtime truth wiring', status: 'RUNNING', created_at: FRESH }]
    })
  }, { now: NOW });
  const snapshot = await createJarvisCommandCenterTruthSnapshotV1(bindings, { now: NOW });
  assert.equal(snapshot.systems.data.JARVIS, 'ONLINE');
  assert.equal(snapshot.runs.data.items.length, 1);
  assert.equal(snapshot.runs.data.items[0].status, 'RUNNING');
  assert.equal(snapshot.runs.data.items[0].progress, null, 'unverified progress stays hidden');
  assert.equal(snapshot.validation.ok, true);
}

// 10. Contracts / manifests advertise Wave 3 fail-closed behaviour.
{
  const contract = jarvisCommandCenterLiveProbeContractV1();
  assert.equal(contract.wave, 3);
  assert.equal(contract.git_status_source, 'genuine_remote_truth_only');
  assert.equal(contract.unproven_system_result, 'UNKNOWN');
  assert.equal(contract.fail_closed, true);
  assert.equal(contract.production_deploy, false);
  assert.equal(contract.hamyren_data_flow, false);

  const manifest = jarvisCommandCenterRuntimeTruthManifestV1();
  assert.equal(manifest.wave, 3);
  assert.equal(manifest.live_probe_bindings, true);
  assert.equal(manifest.git_status_requires_remote_truth, true);
  assert.equal(manifest.mock_operational_truth_allowed, false);
  assert.equal(manifest.writes_enabled, false);
  assert.equal(manifest.production_deploy, false);

  const liveness = jarvisIntegrationLivenessClaimV1('claude_code.analyze');
  assert.equal(liveness.registered, true);
  assert.equal(liveness.proves_runtime_liveness, false);
  assert.equal(liveness.proves_availability, false);
  assert.equal(jarvisIntegrationManifestV1().registry_proves_runtime_liveness, false);

  const http = jarvisHttpManifestV1();
  assert.equal(http.command_center_runtime_truth_route, '/jarvis/api/runtime-truth');
  assert.equal(http.command_center_runtime_truth_fail_closed, true);
  assert.equal(http.production_deploy, false);
}

console.log('JARVIS Command Center Runtime Truth V1 Wave 3 smoke: PASS');
