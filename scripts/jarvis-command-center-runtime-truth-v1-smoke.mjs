import assert from 'node:assert/strict';
import {
  createJarvisCommandCenterTruthSnapshotV1,
  JARVIS_COMMAND_CENTER_DATA_SOURCE_MAP_V1,
  jarvisCommandCenterRuntimeTruthManifestV1
} from '../src/jarvis/command-center-runtime-truth-v1.js';

const NOW = '2026-09-10T15:52:00.000Z';
const observed = '2026-09-10T15:51:30.000Z';

const empty = await createJarvisCommandCenterTruthSnapshotV1({}, { now: NOW });
assert.equal(empty.validation.ok, true);
assert.equal(empty.systems.data.JARVIS, 'UNKNOWN');
assert.equal(empty.systems.data.HERMES, 'UNKNOWN');
assert.equal(empty.systems.data.CLAUDE, 'UNKNOWN');
assert.equal(empty.systems.data.CODEX, 'UNKNOWN');
assert.equal(empty.systems.data.BRIDGE, 'UNKNOWN');
assert.equal(empty.systems.data.GIT, 'UNKNOWN');
assert.equal(empty.runs.data.items.length, 0);
assert.equal(empty.activity.data.items.length, 0);
assert.equal(empty.approvals.data.items.length, 0);
assert.equal(empty.systems.source.source_state, 'NOT_CONNECTED');
assert.equal(empty.safeguards.read_only, true);
assert.equal(empty.safeguards.command_dispatch_enabled, false);
assert.equal(empty.safeguards.production_deploy, false);
assert.equal(empty.safeguards.hamyren_data_flow, false);

const real = await createJarvisCommandCenterTruthSnapshotV1({
  system_status: async () => ({
    classification: 'REAL',
    source_id: 'jarvis-runtime-health-probe-v1',
    observed_at: observed,
    data: {
      JARVIS: 'ONLINE',
      HERMES: 'ONLINE',
      ASTRA: 'AVAILABLE',
      CLAUDE: 'BUSY',
      CODEX: 'STANDBY',
      BRIDGE: 'HEALTHY',
      GIT: 'SYNCED'
    }
  }),
  runs: async () => ({
    classification: 'REAL',
    source_id: 'runtime-job-store-v1',
    observed_at: observed,
    data: [
      {
        job_id: 'job-real-1',
        task_type: 'Command Center Runtime Truth',
        provider: 'CLAUDE_CODE',
        status: 'RUNNING',
        created_at: '2026-09-10T15:50:00.000Z',
        progress: 40,
        progress_verified: false
      },
      {
        job_id: 'job-real-2',
        task_type: 'Git remote truth verification',
        provider: 'GITHUB',
        status: 'COMPLETED',
        created_at: '2026-09-10T15:49:00.000Z',
        progress: 100,
        progress_verified: true,
        progress_basis: 'All 4 explicitly defined verification checks passed',
        evidence_ref: 'evidence:git-real-2'
      }
    ]
  }),
  approvals: async () => ({
    classification: 'REAL',
    source_id: 'canonical-runtime-approvals-v1',
    observed_at: observed,
    data: [{ approval_id: 'approval-1', scope_key: 'jarvis:command-center', approval_type: 'EXTERNAL_WRITE', granted: false }]
  }),
  activity: async () => ({
    classification: 'REAL',
    source_id: 'jarvis-audit-reader-v1',
    observed_at: observed,
    data: [
      { event: 'RUNTIME_TRUTH_READ', at: '2026-09-10T15:51:00.000Z', summary: 'Runtime source read completed' },
      { event: 'INVALID_WITHOUT_TIMESTAMP', summary: 'Must not become a fake timeline event' }
    ]
  }),
  evidence: async () => ({
    classification: 'DERIVED',
    source_id: 'evidence-index-v1',
    observed_at: observed,
    derived_from: ['runtime-job-store-v1', 'git-remote-truth-v1'],
    data: [{ evidence_id: 'evidence:git-real-2', kind: 'GIT_REMOTE_TRUTH', status: 'VERIFIED', observed_at: observed }]
  })
}, { now: NOW });

assert.equal(real.validation.ok, true);
assert.equal(real.systems.data.JARVIS, 'ONLINE');
assert.equal(real.systems.data.CLAUDE, 'BUSY');
assert.equal(real.systems.data.CODEX, 'STANDBY');
assert.equal(real.runs.data.items.length, 2);
assert.equal(real.runs.data.items[0].progress, null, 'progress without verified derivation must be hidden');
assert.equal(real.runs.data.items[1].status, 'COMPLETE');
assert.equal(real.runs.data.items[1].progress, 100);
assert.equal(real.runs.data.items[1].evidence_ref, 'evidence:git-real-2');
assert.equal(real.approvals.data.pending_count, 1);
assert.equal(real.activity.data.items.length, 1, 'activity without a real timestamp must be rejected');
assert.equal(real.activity.data.rejected_count, 1);
assert.equal(real.evidence.data.items.length, 1);

const mock = await createJarvisCommandCenterTruthSnapshotV1({
  system_status: async () => ({
    classification: 'MOCK',
    source_id: 'screenshot-demo',
    observed_at: observed,
    data: { JARVIS: 'ONLINE', HERMES: 'ONLINE', CLAUDE: 'AVAILABLE', GIT: 'SYNCED' }
  }),
  runs: async () => ({
    classification: 'STATIC',
    source_id: 'ui-fixture',
    observed_at: observed,
    data: [{ id: 'R-0142', title: 'Demo run', status: 'RUNNING', progress: 94, progress_verified: true, progress_basis: 'demo' }]
  })
}, { now: NOW });

assert.equal(mock.systems.data.JARVIS, 'UNKNOWN');
assert.equal(mock.systems.source.source_state, 'REJECTED');
assert.equal(mock.systems.source.rejected_classification, 'MOCK');
assert.equal(mock.runs.data.items.length, 0);
assert.equal(mock.runs.source.rejected_classification, 'STATIC');
assert.equal(mock.validation.ok, true, 'rejected mock input must not leak into operational truth');

const stale = await createJarvisCommandCenterTruthSnapshotV1({
  system_status: async () => ({
    classification: 'REAL',
    source_id: 'old-health-probe',
    observed_at: '2026-09-10T14:00:00.000Z',
    stale_after_ms: 60_000,
    data: { JARVIS: 'ONLINE' }
  })
}, { now: NOW });
assert.equal(stale.systems.data.JARVIS, 'UNKNOWN');
assert.equal(stale.systems.source.source_state, 'STALE');

const failed = await createJarvisCommandCenterTruthSnapshotV1({
  system_status: async () => { const error = new Error('connection failed'); error.code = 'HEALTH_SOURCE_DOWN'; throw error; }
}, { now: NOW });
assert.equal(failed.systems.data.JARVIS, 'UNKNOWN');
assert.equal(failed.systems.source.source_state, 'UNAVAILABLE');
assert.equal(failed.systems.source.error_code, 'HEALTH_SOURCE_DOWN');

const manifest = jarvisCommandCenterRuntimeTruthManifestV1();
assert.equal(manifest.mode, 'READ_ONLY');
assert.equal(manifest.mock_operational_truth_allowed, false);
assert.equal(manifest.writes_enabled, false);
assert.equal(manifest.production_deploy, false);
assert.equal(manifest.hamyren_data_flow, false);
assert.ok(JARVIS_COMMAND_CENTER_DATA_SOURCE_MAP_V1.some((entry) => entry.domain === 'GIT' && entry.classification === 'REAL'));
assert.ok(JARVIS_COMMAND_CENTER_DATA_SOURCE_MAP_V1.some((entry) => entry.domain === 'CODEX' && entry.classification === 'UNKNOWN'));

console.log('JARVIS Command Center Runtime Truth V1 smoke: PASS');
