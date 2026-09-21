import assert from 'node:assert/strict';
import {
  deriveJarvisAnatomyStateV1,
  deriveJarvisAutonomyStateV1,
  jarvisAnatomyStateManifestV1,
  JARVIS_ANATOMY_STATUS,
  JARVIS_ANATOMY_MODULES,
  JARVIS_AUTONOMY_STAGE
} from '../src/jarvis/anatomy-state-v1.js';
import { createJarvisCommandCenterTruthSnapshotV1 } from '../src/jarvis/command-center-runtime-truth-v1.js';

const NOW = '2026-09-21T12:00:00.000Z';
const OBSERVED = '2026-09-21T11:59:30.000Z';

/* ── manifest ── */
const manifest = jarvisAnatomyStateManifestV1();
assert.equal(manifest.modules.length, 9);
assert.equal(manifest.fabricates_data, false);
assert.equal(manifest.production_deploy, false);
assert.deepEqual([...manifest.modules].sort(), [...JARVIS_ANATOMY_MODULES].sort());
assert.ok(manifest.autonomy_stages.includes('COMPLETE'));
assert.ok(manifest.autonomy_stages.includes('REPAIRING'));

/* ── missing source entirely: no `domains` at all ── */
{
  const anatomy = deriveJarvisAnatomyStateV1({}, { now: NOW });
  for (const key of JARVIS_ANATOMY_MODULES) {
    assert.equal(anatomy[key].status, JARVIS_ANATOMY_STATUS.NOT_CONNECTED, `${key} must default NOT_CONNECTED when no domains are supplied`);
    assert.equal(anatomy[key].source, null);
    assert.equal(anatomy[key].evidence_ref, null);
  }
  assert.equal(anatomy.eyes.label.includes('Perception'), true);
  assert.equal(anatomy.left_hand.reason, 'NO_GENUINE_SOURCE_BOUND');
}

/* ── NOT_CONNECTED via full runtime-truth snapshot (no bindings injected) ── */
{
  const snapshot = await createJarvisCommandCenterTruthSnapshotV1({}, { now: NOW });
  assert.ok(snapshot.anatomy, 'anatomy must be present on the runtime-truth snapshot');
  for (const key of JARVIS_ANATOMY_MODULES) {
    assert.equal(snapshot.anatomy[key].status, JARVIS_ANATOMY_STATUS.NOT_CONNECTED);
  }
  assert.equal(snapshot.validation.ok, true);
}

/* ── genuine HEALTHY composition ── */
{
  const snapshot = await createJarvisCommandCenterTruthSnapshotV1({
    system_status: async () => ({
      classification: 'DERIVED',
      source_id: 'jarvis-command-center-live-probes-v1',
      observed_at: OBSERVED,
      derived_from: ['jarvis:probe', 'bridge:probe'],
      data: { JARVIS: 'ONLINE', ASTRA: 'AVAILABLE', CLAUDE: 'AVAILABLE', BRIDGE: 'HEALTHY', GIT: 'SYNCED', HERMES: 'ONLINE', CODEX: 'STANDBY' }
    }),
    memory: async () => ({
      classification: 'REAL',
      source_id: 'jarvis-memory-store-v1',
      observed_at: OBSERVED,
      data: { entries: 12 }
    }),
    runs: async () => ({
      classification: 'DERIVED',
      source_id: 'jarvis-run-projection-v1',
      derived_from: ['jarvis-audit-reader-v1'],
      observed_at: OBSERVED,
      data: [{
        id: 'req-1', title: 'Ship anatomy view', worker: 'Claude Code', status: 'COMPLETE',
        started_at: '2026-09-21T11:00:00.000Z', updated_at: OBSERVED, evidence_ref: 'evidence:req-1'
      }]
    }),
    evidence: async () => ({
      classification: 'DERIVED',
      source_id: 'jarvis-evidence-projection-v1',
      derived_from: ['jarvis-audit-reader-v1'],
      observed_at: OBSERVED,
      data: [{ evidence_id: 'evidence:req-1', kind: 'GIT_COMMIT', status: 'VERIFIED', observed_at: OBSERVED }]
    })
  }, { now: NOW });

  const a = snapshot.anatomy;
  assert.equal(a.core.status, JARVIS_ANATOMY_STATUS.HEALTHY);
  assert.equal(a.core.last_success, OBSERVED);
  assert.equal(a.brain.status, JARVIS_ANATOMY_STATUS.HEALTHY);
  assert.equal(a.nervous_system.status, JARVIS_ANATOMY_STATUS.HEALTHY);
  assert.equal(a.right_hand.status, JARVIS_ANATOMY_STATUS.HEALTHY);
  assert.equal(a.right_hand.evidence_ref, 'evidence:req-1');
  assert.equal(a.right_hand.last_success, OBSERVED);
  assert.equal(a.infrastructure.status, JARVIS_ANATOMY_STATUS.HEALTHY, 'infra HEALTHY only when git+memory+jarvis are all proven');
  // still-unproven modules must stay NOT_CONNECTED even inside an otherwise-healthy snapshot
  assert.equal(a.eyes.status, JARVIS_ANATOMY_STATUS.NOT_CONNECTED);
  assert.equal(a.ears.status, JARVIS_ANATOMY_STATUS.NOT_CONNECTED);
  assert.equal(a.mouth.status, JARVIS_ANATOMY_STATUS.NOT_CONNECTED);
  assert.equal(a.left_hand.status, JARVIS_ANATOMY_STATUS.NOT_CONNECTED);
}

/* ── genuine FAILED composition ── */
{
  const snapshot = await createJarvisCommandCenterTruthSnapshotV1({
    system_status: async () => ({
      classification: 'DERIVED',
      source_id: 'jarvis-command-center-live-probes-v1',
      observed_at: OBSERVED,
      derived_from: ['bridge:probe', 'claude:probe'],
      data: { BRIDGE: 'OFFLINE', CLAUDE: 'UNAVAILABLE' }
    })
  }, { now: NOW });

  const a = snapshot.anatomy;
  assert.equal(a.nervous_system.status, JARVIS_ANATOMY_STATUS.FAILED);
  assert.equal(a.nervous_system.reason, 'BRIDGE_OFFLINE');
  assert.equal(a.right_hand.status, JARVIS_ANATOMY_STATUS.FAILED);
  assert.equal(a.right_hand.reason, 'CLAUDE_UNAVAILABLE');
  // core has no OFFLINE/FAILED enum value upstream -> falls to UNKNOWN, never fabricated as FAILED
  assert.equal(a.core.status, JARVIS_ANATOMY_STATUS.UNKNOWN);
}

/* ── UNKNOWN: systems source connected but the specific value is unproven ── */
{
  const snapshot = await createJarvisCommandCenterTruthSnapshotV1({
    system_status: async () => ({
      classification: 'DERIVED',
      source_id: 'jarvis-command-center-live-probes-v1',
      observed_at: OBSERVED,
      derived_from: ['jarvis:probe'],
      data: {}
    })
  }, { now: NOW });
  const a = snapshot.anatomy;
  assert.equal(a.core.status, JARVIS_ANATOMY_STATUS.UNKNOWN);
  assert.equal(a.brain.status, JARVIS_ANATOMY_STATUS.UNKNOWN);
  assert.equal(a.core.source, 'jarvis-command-center-live-probes-v1', 'UNKNOWN still records which source was consulted');
}

/* ── NOT_CONNECTED: reader throws / source unavailable ── */
{
  const snapshot = await createJarvisCommandCenterTruthSnapshotV1({
    system_status: async () => { throw new Error('probe down'); }
  }, { now: NOW });
  const a = snapshot.anatomy;
  assert.equal(a.core.status, JARVIS_ANATOMY_STATUS.NOT_CONNECTED);
  assert.equal(a.core.reason, 'SYSTEMS_SOURCE_UNAVAILABLE');
}

/* ── stale source fail-closed ── */
{
  const snapshot = await createJarvisCommandCenterTruthSnapshotV1({
    system_status: async () => ({
      classification: 'REAL',
      source_id: 'old-health-probe',
      observed_at: '2026-09-21T10:00:00.000Z',
      stale_after_ms: 60_000,
      data: { JARVIS: 'ONLINE', ASTRA: 'AVAILABLE', BRIDGE: 'HEALTHY' }
    })
  }, { now: NOW });
  const a = snapshot.anatomy;
  assert.equal(a.core.status, JARVIS_ANATOMY_STATUS.NOT_CONNECTED, 'a stale source must never be shown as healthy');
  assert.equal(a.brain.status, JARVIS_ANATOMY_STATUS.NOT_CONNECTED);
  assert.equal(a.nervous_system.status, JARVIS_ANATOMY_STATUS.NOT_CONNECTED);
  assert.equal(snapshot.systems.source.source_state, 'STALE');
}

/* ── partial / degraded composition ── */
{
  // Only GIT is proven (SYNCED); memory and JARVIS runtime are not connected at all.
  const snapshot = await createJarvisCommandCenterTruthSnapshotV1({
    system_status: async () => ({
      classification: 'DERIVED',
      source_id: 'jarvis-command-center-live-probes-v1',
      observed_at: OBSERVED,
      derived_from: ['git:probe'],
      data: { GIT: 'SYNCED' }
    })
  }, { now: NOW });
  const a = snapshot.anatomy;
  assert.equal(a.infrastructure.status, JARVIS_ANATOMY_STATUS.DEGRADED, 'partial infrastructure provenance must never read as HEALTHY');
  assert.equal(a.infrastructure.reason, 'PARTIAL_INFRASTRUCTURE_PROVENANCE');
  assert.notEqual(a.infrastructure.status, JARVIS_ANATOMY_STATUS.HEALTHY);
}

/* ── right_hand: live signal healthy but the most recent real execution failed ── */
{
  const snapshot = await createJarvisCommandCenterTruthSnapshotV1({
    system_status: async () => ({
      classification: 'DERIVED',
      source_id: 'jarvis-command-center-live-probes-v1',
      observed_at: OBSERVED,
      derived_from: ['claude:probe', 'bridge:probe'],
      data: { CLAUDE: 'AVAILABLE', BRIDGE: 'HEALTHY' }
    }),
    runs: async () => ({
      classification: 'DERIVED',
      source_id: 'jarvis-run-projection-v1',
      derived_from: ['jarvis-audit-reader-v1'],
      observed_at: OBSERVED,
      data: [{
        id: 'req-2', title: 'Broken deploy attempt', worker: 'Claude Code', status: 'FAILED',
        started_at: '2026-09-21T11:00:00.000Z', updated_at: OBSERVED
      }]
    })
  }, { now: NOW });
  const a = snapshot.anatomy;
  assert.equal(a.right_hand.status, JARVIS_ANATOMY_STATUS.FAILED, 'a proven last-run failure must never be hidden behind a currently-available live probe');
  assert.equal(a.right_hand.reason, 'LAST_RUN_FAILED');
  assert.equal(a.right_hand.detail.live.status, JARVIS_ANATOMY_STATUS.HEALTHY);
}

/* ── right_hand: CLAUDE proven AVAILABLE but BRIDGE unproven -> UNKNOWN, never HEALTHY ── */
{
  const snapshot = await createJarvisCommandCenterTruthSnapshotV1({
    system_status: async () => ({
      classification: 'DERIVED',
      source_id: 'jarvis-command-center-live-probes-v1',
      observed_at: OBSERVED,
      derived_from: ['claude:probe'],
      data: { CLAUDE: 'AVAILABLE' } // BRIDGE omitted -> normalizes to UNKNOWN
    })
  }, { now: NOW });
  const a = snapshot.anatomy;
  assert.equal(a.right_hand.status, JARVIS_ANATOMY_STATUS.UNKNOWN, 'CLAUDE=AVAILABLE with an unproven BRIDGE must never read as HEALTHY');
  assert.notEqual(a.right_hand.status, JARVIS_ANATOMY_STATUS.HEALTHY);
  assert.equal(a.right_hand.detail.live.claude, 'AVAILABLE');
  assert.equal(a.right_hand.detail.live.bridge, 'UNKNOWN');
}

/* ── right_hand: a historical COMPLETE run must never upgrade an unproven live signal to HEALTHY ── */
{
  const snapshot = await createJarvisCommandCenterTruthSnapshotV1({
    // systems source is connected, but neither CLAUDE nor BRIDGE keys are
    // present -> live availability is genuinely unproven (UNKNOWN), not absent.
    system_status: async () => ({
      classification: 'DERIVED',
      source_id: 'jarvis-command-center-live-probes-v1',
      observed_at: OBSERVED,
      derived_from: ['jarvis:probe'],
      data: {}
    }),
    runs: async () => ({
      classification: 'DERIVED',
      source_id: 'jarvis-run-projection-v1',
      derived_from: ['jarvis-audit-reader-v1'],
      observed_at: OBSERVED,
      data: [{
        id: 'req-3', title: 'Past successful run', worker: 'Claude Code', status: 'COMPLETE',
        started_at: '2026-09-21T11:00:00.000Z', updated_at: OBSERVED, evidence_ref: 'evidence:req-3'
      }]
    })
  }, { now: NOW });
  const a = snapshot.anatomy;
  assert.equal(a.right_hand.status, JARVIS_ANATOMY_STATUS.UNKNOWN, 'a COMPLETE run with no genuine live Claude/Bridge proof must stay UNKNOWN, not HEALTHY');
  assert.notEqual(a.right_hand.status, JARVIS_ANATOMY_STATUS.HEALTHY);
  // the historical run may still populate last_success / evidence_ref / detail
  assert.equal(a.right_hand.last_success, OBSERVED);
  assert.equal(a.right_hand.evidence_ref, 'evidence:req-3');
  assert.equal(a.right_hand.detail.last_success_run.id, 'req-3');

  // and NOT_CONNECTED (no systems source at all) must likewise never be upgraded to HEALTHY
  const noSystemsSnapshot = await createJarvisCommandCenterTruthSnapshotV1({
    runs: async () => ({
      classification: 'DERIVED',
      source_id: 'jarvis-run-projection-v1',
      derived_from: ['jarvis-audit-reader-v1'],
      observed_at: OBSERVED,
      data: [{
        id: 'req-4', title: 'Past successful run, no systems source', worker: 'Claude Code', status: 'COMPLETE',
        started_at: '2026-09-21T11:00:00.000Z', updated_at: OBSERVED, evidence_ref: 'evidence:req-4'
      }]
    })
  }, { now: NOW });
  assert.equal(noSystemsSnapshot.anatomy.right_hand.status, JARVIS_ANATOMY_STATUS.UNKNOWN, 'a proven execution with no current live health source is UNKNOWN, not NOT_CONNECTED or HEALTHY');
  assert.equal(noSystemsSnapshot.anatomy.right_hand.reason, 'LIVE_EXECUTION_STATUS_UNPROVEN');
}

/* ── error / degraded_reason contract: explicit typed fields alongside `reason` ── */
{
  // FAILED -> error carries the concrete proven reason; degraded_reason stays null
  const failedSnapshot = await createJarvisCommandCenterTruthSnapshotV1({
    system_status: async () => ({
      classification: 'DERIVED',
      source_id: 'jarvis-command-center-live-probes-v1',
      observed_at: OBSERVED,
      derived_from: ['bridge:probe', 'claude:probe'],
      data: { BRIDGE: 'OFFLINE', CLAUDE: 'UNAVAILABLE' }
    })
  }, { now: NOW });
  const fa = failedSnapshot.anatomy;
  assert.equal(fa.nervous_system.status, JARVIS_ANATOMY_STATUS.FAILED);
  assert.equal(fa.nervous_system.error, 'BRIDGE_OFFLINE');
  assert.equal(fa.nervous_system.degraded_reason, null);
  assert.equal(fa.right_hand.status, JARVIS_ANATOMY_STATUS.FAILED);
  assert.equal(fa.right_hand.error, 'CLAUDE_UNAVAILABLE');
  assert.equal(fa.right_hand.degraded_reason, null);

  // DEGRADED -> degraded_reason carries the concrete proven reason; error stays null
  const degradedSnapshot = await createJarvisCommandCenterTruthSnapshotV1({
    system_status: async () => ({
      classification: 'DERIVED',
      source_id: 'jarvis-command-center-live-probes-v1',
      observed_at: OBSERVED,
      derived_from: ['git:probe'],
      data: { GIT: 'SYNCED' }
    })
  }, { now: NOW });
  const da = degradedSnapshot.anatomy;
  assert.equal(da.infrastructure.status, JARVIS_ANATOMY_STATUS.DEGRADED);
  assert.equal(da.infrastructure.degraded_reason, 'PARTIAL_INFRASTRUCTURE_PROVENANCE');
  assert.equal(da.infrastructure.error, null);

  // other states -> both fields stay null, never invented
  const notConnected = await createJarvisCommandCenterTruthSnapshotV1({}, { now: NOW });
  const na = notConnected.anatomy;
  for (const key of JARVIS_ANATOMY_MODULES) {
    assert.equal(na[key].error, null, `${key} must not carry an error when NOT_CONNECTED`);
    assert.equal(na[key].degraded_reason, null, `${key} must not carry a degraded_reason when NOT_CONNECTED`);
  }
}

/* ── current Owner E2E evidence drives Claude history + Autonomy without false green ── */
{
  const runId = 'b5acafe1-d006-42c6-aa05-98ac62c0ae57';
  const at = '2026-09-21T20:23:24.594Z';
  const domains = {
    runs: {
      source: { source_state: 'CONNECTED', source_id: 'jarvis-run-projection-v1', observed_at: at },
      data: { items: [{
        id: runId,
        title: 'Owner E2E',
        worker: 'Claude Code',
        status: 'COMPLETE',
        program: 'JARVIS_OWNER_CHAT',
        started_at: '2026-09-21T20:22:40.503Z',
        updated_at: at,
        evidence_ref: `claude-code:${runId}`,
        acceptance_state: 'ACCEPTANCE_PENDING',
        approval_state: 'GRANTED'
      }] }
    },
    activity: {
      source: { source_state: 'CONNECTED', source_id: 'jarvis-audit-reader-v1', observed_at: at },
      data: { items: [{
        run_id: runId,
        event: 'IMPLEMENTATION_MISSION',
        status: 'COMPLETED',
        at,
        summary: 'ENGINEERING · IMPLEMENTATION_MISSION'
      }] }
    },
    evidence: {
      source: { source_state: 'CONNECTED', source_id: 'jarvis-evidence-projection-v1', observed_at: at },
      data: { items: [{
        evidence_id: `claude-code:${runId}`,
        run_ref: runId,
        status: 'COMPLETED',
        observed_at: at,
        worker_verified: true,
        independent_acceptance: false,
        acceptance_ref: null
      }] }
    }
  };

  const anatomy = deriveJarvisAnatomyStateV1(domains, { now: '2026-09-21T20:24:00.000Z' });
  assert.equal(anatomy.right_hand.status, JARVIS_ANATOMY_STATUS.UNKNOWN, 'successful execution proves last success, not current Claude/Bridge health');
  assert.equal(anatomy.right_hand.last_success, at);
  assert.equal(anatomy.right_hand.evidence_ref, `claude-code:${runId}`);

  const autonomy = deriveJarvisAutonomyStateV1(domains, { now: '2026-09-21T20:24:00.000Z' });
  assert.equal(autonomy.stage, JARVIS_AUTONOMY_STAGE.COMPLETE);
  assert.equal(autonomy.current_run.id, runId);
  assert.equal(autonomy.evidence_ref, `claude-code:${runId}`);
  assert.equal(autonomy.operator_acceptance_fabricated, false);

  const repair = deriveJarvisAutonomyStateV1({
    ...domains,
    runs: {
      ...domains.runs,
      data: { items: [{ ...domains.runs.data.items[0], title: '[REPAIR 1] Owner E2E', status: 'RUNNING' }] }
    }
  }, { now: '2026-09-21T20:24:00.000Z' });
  assert.equal(repair.stage, JARVIS_AUTONOMY_STAGE.REPAIRING);

  const failed = deriveJarvisAutonomyStateV1({
    ...domains,
    runs: {
      ...domains.runs,
      data: { items: [{ ...domains.runs.data.items[0], status: 'FAILED' }] }
    }
  }, { now: '2026-09-21T20:24:00.000Z' });
  assert.equal(failed.stage, JARVIS_AUTONOMY_STAGE.FAILED);

  const idle = deriveJarvisAutonomyStateV1({
    runs: { source: { source_state: 'CONNECTED', source_id: 'jarvis-run-projection-v1', observed_at: at }, data: { items: [] } }
  }, { now: '2026-09-21T20:24:00.000Z' });
  assert.equal(idle.stage, JARVIS_AUTONOMY_STAGE.IDLE);
}

console.log('JARVIS Anatomy State V1 smoke: PASS');
