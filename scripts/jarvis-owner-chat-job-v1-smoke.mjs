import assert from 'node:assert/strict';
import { handleJarvisHttpV1 } from '../src/jarvis/http-v1.js';
import { createMemoryJarvisStoreV1 } from '../src/jarvis/memory-store-memory-v1.js';
import { createJarvisClaudeCodeBridgeV1, createLocalFixtureExecutorV1 } from '../src/jarvis/claude-code-bridge-v1.js';
import { classifyJarvisChatWorkRequestV1 } from '../src/jarvis/chat-work-router-v1.js';
import {
  dispatchJarvisOwnerChatJobV1,
  runJarvisOwnerChatJobV1,
  deriveJarvisOwnerChatJobTitleV1,
  jarvisOwnerChatJobManifestV1,
  isJarvisOwnerChatReadOnlyGoalV1,
  findJarvisOwnerChatRecoverableFailedCandidateV1
} from '../src/jarvis/owner-chat-job-v1.js';
import { createJarvisCommandCenterReadBindingsV1 } from '../src/jarvis/command-center-read-bindings-v1.js';

const authorize = async () => ({ ok: true, operator_id: 'jarvis-operator:op@example.invalid', email: 'op@example.invalid' });
const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const OWNER_REF = 'jarvis:operator:owner-chat-job-smoke@example.invalid';

function postChat(store, message, correlation_id, claude_bridge) {
  return handleJarvisHttpV1(
    new Request('https://example.invalid/jarvis/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message, correlation_id })
    }),
    {}, {}, { authorize, memory_store: store, claude_bridge: claude_bridge || null }
  );
}

/* ── 1. Deterministic classification regressions at the router level ── */
{
  assert.equal(classifyJarvisChatWorkRequestV1('Wie geht es dir heute?').classification, 'CONVERSATION');
  assert.equal(classifyJarvisChatWorkRequestV1('Implementiere einen Bugfix im Modul X.').classification, 'ACTIONABLE_WORK');
  assert.equal(classifyJarvisChatWorkRequestV1('Lösche die Kundendaten aus der Produktionsdatenbank.').classification, 'APPROVAL_REQUIRED_ACTION');
  // Risk wins even when an actionable verb+noun also matches.
  assert.equal(classifyJarvisChatWorkRequestV1('Implementiere ein Deployment auf den Production-Server.').classification, 'APPROVAL_REQUIRED_ACTION');
  assert.equal(isJarvisOwnerChatReadOnlyGoalV1('Prüfe den Stand. Verändere nichts.'), true);
  assert.equal(isJarvisOwnerChatReadOnlyGoalV1('Inspect the repo, do not modify anything.'), true);
  assert.equal(isJarvisOwnerChatReadOnlyGoalV1('Implementiere den Fix.'), false);
}

/* ── 2. CONVERSATION regression at the HTTP layer: never creates a job ── */
{
  const store = createMemoryJarvisStoreV1();
  const r = await postChat(store, 'Wie geht es dir heute?', 'aaaaaaaa-1111-4111-8111-111111111111');
  assert.equal(r.status, 200);
  const b = await r.json();
  assert.equal(b.chat_work_classification, 'CONVERSATION');
  assert.notEqual(b.action, 'IMPLEMENTATION_MISSION');
  assert.equal(b.owner_chat_job, undefined, 'CONVERSATION must never produce a job');
}

/* ── 3. APPROVAL_REQUIRED_ACTION regression at the HTTP layer: never
        auto-executes, never creates a job, even though it names an
        engineering-shaped noun ── */
{
  const store = createMemoryJarvisStoreV1();
  const r = await postChat(store, 'Lösche die Kundendaten in der Live-Produktion und aktualisiere den Code dafür.', 'bbbbbbbb-2222-4222-8222-222222222222');
  const b = await r.json();
  assert.equal(b.chat_work_classification, 'APPROVAL_REQUIRED_ACTION');
  assert.notEqual(b.action, 'IMPLEMENTATION_MISSION', 'a risk-signal message must never auto-dispatch as an engineering mission');
  assert.equal(b.owner_chat_job, undefined);
  assert.equal(b.external_effect, false);
}

/* ── 4. ACTIONABLE_WORK at the HTTP layer: immediate ack + job id, nothing
        executes synchronously inside the response ── */
{
  const store = createMemoryJarvisStoreV1();
  const corr = 'cccccccc-3333-4333-8333-333333333333';
  const r = await postChat(store, 'Implementiere einen kleinen Bugfix im Modul X.', corr);
  assert.equal(r.status, 200);
  const b = await r.json();
  assert.equal(b.chat_work_classification, 'ACTIONABLE_WORK');
  assert.equal(b.action, 'IMPLEMENTATION_MISSION');
  assert.equal(b.intent, 'IMPLEMENTATION_MISSION_REQUEST');
  assert.equal(b.request_id, corr);
  assert.equal(b.run_state, 'RUNNING');
  assert.equal(b.approval_required, false, "the owner's own explicit imperative IS the recorded explicit approval");
  assert.equal(b.claude_execution, null, 'nothing executes synchronously inside the HTTP response');
  assert.ok(b.answer && b.answer.length > 0, 'an immediate natural German acknowledgement is returned');
  assert.match(b.answer, /[a-zäöüß]/i);
  assert.equal(b.owner_chat_job.request_id, corr);
  assert.equal(b.owner_chat_job.status, 'RUNNING');
  assert.equal(b.audit_persisted, true);
}

/* ── 5. Full synthetic E2E: request -> router -> ack/job id -> persisted
        job -> injected bridge called -> independent repo-bound verification
        -> COMPLETE -> durable notification + linked evidence.
        Calls dispatchJarvisOwnerChatJobV1/runJarvisOwnerChatJobV1 directly
        (the exact same functions http-v1.js schedules via ctx.waitUntil) so
        the background phase can be awaited deterministically instead of
        polled. ── */
{
  const store = createMemoryJarvisStoreV1();
  const message = 'Implementiere MARKER-E2E-OK: kleinen, in sich abgeschlossenen Bugfix im internen Modul.';
  const now = '2026-09-21T10:00:00.000Z';

  const dispatch = await dispatchJarvisOwnerChatJobV1({ owner_id: OWNER_ID, owner_ref: OWNER_REF, message, now }, { memory_store: store });
  assert.equal(dispatch.ok, true);
  assert.equal(dispatch.program, 'JARVIS_OWNER_CHAT');
  assert.equal(dispatch.title, deriveJarvisOwnerChatJobTitleV1(message));
  assert.match(dispatch.ack, /kümmere/i);
  assert.equal(dispatch.audit_persisted, true);

  // The self-approval row must already be durably persisted before the
  // background phase ever runs — this IS the job's durable identity/state.
  const afterDispatch = await store.readAudit({ owner_id: OWNER_ID, owner_ref: OWNER_REF, limit: 50 });
  const selfApproval = afterDispatch.find((row) => row.request_id === dispatch.request_id && row.approval?.decision === 'approve');
  assert.ok(selfApproval, 'self-approval audit row persisted before dispatch');
  assert.equal(selfApproval.approval.decided_run_id, dispatch.request_id);
  assert.equal(selfApproval.approval.actor_type, 'OPERATOR');
  assert.equal(selfApproval.approval.explicit, true);

  const bridge = createJarvisClaudeCodeBridgeV1({
    executor: createLocalFixtureExecutorV1({
      'MARKER-E2E-OK': {
        exit_code: 0,
        stdout: 'fix applied',
        verification: {
          schema: 'aurentara.jarvis.repo-bound-verification.v1',
          repo_dir: '/workspace/projects/jarvis-engineering-mission',
          branch: 'feature/owner-chat-job-smoke',
          branch_drift: false,
          files_changed: ['src/example/module.js'],
          pre_existing_dirty_files: [],
          syntax_check: { passed: true, checked: 1, results: [{ file: 'src/example/module.js', passed: true }] },
          tool_audit: {
            complete: true,
            compliant: true,
            result: 'MARKER-E2E-OK verified result: the internal module bugfix is complete and independently verified.'
          },
          at: now
        }
      }
    })
  });

  const result = await runJarvisOwnerChatJobV1(dispatch.job, { memory_store: store, claude_bridge: bridge });
  assert.equal(result.ok, true);
  assert.equal(result.status, 'COMPLETE');
  assert.equal(result.repair_attempts, 0, 'no repair needed when verification is sufficient on the first attempt');
  assert.equal(result.attempt_chain.length, 1);
  assert.equal(result.acceptance_ref, null, 'automatic completion never creates or implies operator acceptance');
  assert.ok(result.evidence_id, 'bridge-computed evidence id is carried through');
  assert.match(result.notification, /Erledigt/);
  assert.equal(result.verified_result_memory.persisted, true);
  assert.match(result.verified_result_memory.memory_id, /^jarvis:owner-job-result:/);

  const persistedMemory = await store.loadMemory({ owner_id: OWNER_ID, owner_ref: OWNER_REF });
  const resultMemory = persistedMemory.find((entry) => entry.memory_id === result.verified_result_memory.memory_id);
  assert.ok(resultMemory, 'verified COMPLETE owner job is promoted into durable memory');
  assert.equal(resultMemory.category, 'PROJECTS');
  assert.equal(resultMemory.status, 'CONFIRMED');
  assert.equal(resultMemory.sensitivity, 'INTERNAL');
  assert.equal(resultMemory.value.request_id, dispatch.request_id);
  assert.match(resultMemory.value.result_summary, /MARKER-E2E-OK verified result/);

  const finalAudit = await store.readAudit({ owner_id: OWNER_ID, owner_ref: OWNER_REF, limit: 50 });
  const missionRow = finalAudit.find((row) => row.request_id === dispatch.request_id && row.action === 'IMPLEMENTATION_MISSION' && row.result?.claude_execution_state);
  assert.ok(missionRow, 'the mission dispatch is a real, persisted audit row');
  assert.equal(missionRow.result.claude_execution_state, 'COMPLETE');
  assert.equal(missionRow.result.independent_acceptance, false, 'the bridge exit code is never itself independent acceptance');

  const acceptanceRow = finalAudit.find((row) => row.request_id === dispatch.request_id && row.intent?.intent_type === 'IMPLEMENTATION_MISSION_ACCEPTANCE');
  assert.equal(acceptanceRow, undefined, 'automatic outcome verification never writes a human/operator acceptance row');

  const notificationRow = finalAudit.find((row) => row.request_id === dispatch.request_id && row.intent?.intent_type === 'OWNER_CHAT_JOB_NOTIFICATION');
  assert.ok(notificationRow, 'exactly one durable notification row exists under the original job id');
  assert.equal(notificationRow.result.status, 'COMPLETED');
  assert.equal(notificationRow.result.job_status, 'COMPLETE');
  assert.equal(notificationRow.result.repair_attempts, 0);
  assert.equal(notificationRow.result.independent_acceptance, false);
  assert.equal(notificationRow.result.independent_verification, true);
  assert.equal(notificationRow.result.verification_actor_type, 'SYSTEM');
  assert.equal(notificationRow.result.acceptance_ref, null);
  assert.equal(notificationRow.result.verified_result_memory.persisted, true);
  assert.equal(notificationRow.memory_updates.accepted, 1);

  // Every row sharing this job's durable identity (request_id) groups into
  // ONE real Command Center run, with no extra wiring or projection changes.
  const bindings = createJarvisCommandCenterReadBindingsV1({ store, owner_id: OWNER_ID, owner_ref: OWNER_REF });
  const runs = await bindings.runs();
  const run = runs.data.find((item) => item.id === dispatch.request_id);
  assert.ok(run, 'the job shows up as one real projected Command Center run');
  assert.equal(run.status, 'COMPLETE');
  assert.ok(run.evidence_ref, 'linked evidence is discoverable on the run');

  const evidence = await bindings.evidence();
  assert.equal(evidence.data.some((item) => item.run_ref === dispatch.request_id && item.independent_acceptance === true), false,
    'automatic system verification never projects as human/operator Independent Acceptance');
}

/* ── 6. Bounded repair with a strict attempt cap: verification stays
        insufficient on every attempt -> job FAILED after exactly
        max_repair_attempts repairs, never fewer, never more, each a fresh
        request_id (the bridge dedupes by correlation_id, so re-running the
        same id would just replay the cached result). ── */
{
  const store = createMemoryJarvisStoreV1();
  const message = 'Implementiere MARKER-E2E-REPAIR: Feature das die Verifikation nie besteht.';
  const now = '2026-09-21T10:05:00.000Z';

  const dispatch = await dispatchJarvisOwnerChatJobV1({ owner_id: OWNER_ID, owner_ref: OWNER_REF, message, now }, { memory_store: store });
  assert.equal(dispatch.ok, true);

  // exit_code 0 with NO verification evidence: dispatched (COMPLETE), but
  // never independently acceptable — a bridge exit code is never enough.
  const bridge = createJarvisClaudeCodeBridgeV1({
    executor: createLocalFixtureExecutorV1({ 'MARKER-E2E-REPAIR': { exit_code: 0, stdout: 'looks done', verification: null } })
  });

  const result = await runJarvisOwnerChatJobV1(dispatch.job, { memory_store: store, claude_bridge: bridge, max_repair_attempts: 2 });
  assert.equal(result.ok, false);
  assert.equal(result.status, 'FAILED');
  assert.equal(result.repair_attempts, 2, 'exactly the configured cap of repair attempts, never more');
  assert.equal(result.attempt_chain.length, 3, 'original attempt + 2 repair attempts = 3 total dispatches');
  assert.equal(new Set(result.attempt_chain.map((a) => a.request_id)).size, 3, 'every attempt used a fresh, distinct request_id');
  assert.match(result.reason, /VERIFICATION_INSUFFICIENT|NO_VERIFICATION_EVIDENCE/);
  assert.match(result.notification, /nicht abgeschlossen/);

  const finalAudit = await store.readAudit({ owner_id: OWNER_ID, owner_ref: OWNER_REF, limit: 50 });
  const notificationRow = finalAudit.find((row) => row.request_id === dispatch.request_id && row.intent?.intent_type === 'OWNER_CHAT_JOB_NOTIFICATION');
  assert.ok(notificationRow);
  assert.equal(notificationRow.result.status, 'FAILED');
  assert.equal(notificationRow.result.repair_attempts, 2);
  assert.equal(notificationRow.result.attempt_chain.length, 3);

  const missionRows = finalAudit.filter((row) => row.action === 'IMPLEMENTATION_MISSION' && row.result?.claude_execution_state);
  assert.equal(missionRows.length, 3, 'three genuine, separately dispatched mission attempts were persisted');
  const failedMemories = await store.loadMemory({ owner_id: OWNER_ID, owner_ref: OWNER_REF });
  assert.equal(failedMemories.length, 0, 'FAILED owner jobs never enter verified result memory');
}


/* ── 6b. Natural-language read-only job: "Verändere nichts" must accept
        unchanged filesystem/git evidence and must never waste repair attempts. ── */
{
  const store = createMemoryJarvisStoreV1();
  const message = 'Prüfe MARKER-READONLY den Repository-Stand. Verändere nichts.';
  const now = '2026-09-21T10:07:00.000Z';

  const dispatch = await dispatchJarvisOwnerChatJobV1(
    { owner_id: OWNER_ID, owner_ref: OWNER_REF, message, now },
    { memory_store: store }
  );
  assert.equal(dispatch.ok, true);

  const readOnlyFixture = createLocalFixtureExecutorV1({
    'MARKER-READONLY': {
      exit_code: 0,
      stdout: 'read-only inspection complete',
      verification: {
        schema: 'aurentara.jarvis.repo-bound-verification.v1',
        repo_dir: '/workspace/projects/jarvis-engineering-mission',
        branch: 'feature/owner-chat-readonly-smoke',
        branch_drift: false,
        files_changed: [],
        pre_existing_dirty_files: [],
        syntax_check: { passed: true, checked: 0, results: [] },
        filesystem_evidence: { complete: true, unchanged: true },
        git_evidence: { head_unchanged: true },
        tool_audit: {
          complete: true,
          is_error: false,
          tool_uses: [],
          forbidden_tool_uses: [],
          outside_workspace_targets: [],
          sensitive_targets: [],
          permission_denials: []
        },
        at: now
      }
    }
  });
  let observedExecutionMode = null;
  const bridge = createJarvisClaudeCodeBridgeV1({
    executor: async (input) => {
      observedExecutionMode = input.execution_mode;
      return readOnlyFixture(input);
    }
  });

  const result = await runJarvisOwnerChatJobV1(dispatch.job, {
    memory_store: store,
    claude_bridge: bridge,
    max_repair_attempts: 2
  });
  assert.equal(result.ok, true);
  assert.equal(result.status, 'COMPLETE');
  assert.equal(result.repair_attempts, 0);
  assert.equal(result.attempt_chain.length, 1);
  assert.equal(result.attempt_chain[0].system_verified, true);
  assert.equal(observedExecutionMode, 'review', 'natural-language read-only owner jobs must use Bridge review mode');
}

/* ── 6c. Read-only Astra REPAIR is allowed exactly once, stays in review
        mode, uses a fresh request id, and can then complete. ── */
{
  const store = createMemoryJarvisStoreV1();
  const message = 'READ-ONLY. Prüfe MARKER-READONLY-ASTRA vollständig. Verändere nichts.';
  const now = '2026-09-21T10:08:00.000Z';
  const dispatch = await dispatchJarvisOwnerChatJobV1(
    { owner_id: OWNER_ID, owner_ref: OWNER_REF, message, now },
    { memory_store: store }
  );

  let bridgeCalls = 0;
  const observedModes = [];
  const bridge = createJarvisClaudeCodeBridgeV1({
    executor: async (input) => {
      bridgeCalls += 1;
      observedModes.push(input.execution_mode);
      return {
        exit_code: 0,
        stdout: 'read-only review ' + bridgeCalls,
        stderr: '',
        external_effect: false,
        verification: {
          schema: 'aurentara.jarvis.repo-bound-verification.v1',
          repo_dir: '/workspace/projects/jarvis-engineering-mission',
          branch: 'feature/readonly-astra-repair',
          head: '1111111111111111111111111111111111111111',
          branch_drift: false,
          files_changed: [],
          pre_existing_dirty_files: [],
          syntax_check: { passed: true, checked: 0, results: [] },
          filesystem_evidence: { complete: true, unchanged: true },
          git_evidence: { head_unchanged: true, pre: { head: '1111111111111111111111111111111111111111' } },
          tool_audit: {
            complete: true,
            compliant: true,
            result: bridgeCalls === 1
              ? 'Initial read-only evidence summary.'
              : 'Repaired read-only summary with branch, commit, test and acceptance-gate evidence.'
          },
          at: now
        }
      };
    }
  });

  let reviewCalls = 0;
  const intelligenceRouter = {
    plan: async () => ({
      ok: true,
      provider: 'TEST',
      lane: 'STANDARD',
      model: 'test-model',
      execution_brief: 'Inspect read-only evidence.',
      api_fallback_used: false,
      api_cost_usd: 0,
      original_goal_authoritative: true
    }),
    review: async () => {
      reviewCalls += 1;
      return reviewCalls === 1
        ? {
            ok: true,
            provider: 'TEST',
            model: 'test-model',
            decision: 'REPAIR',
            rationale: 'Branch/commit/test evidence is incomplete.',
            repair_brief: 'Verify branch, commit, tests and acceptance gates read-only, then return exactly one blocker.',
            api_fallback_used: false,
            api_cost_usd: 0
          }
        : {
            ok: true,
            provider: 'TEST',
            model: 'test-model',
            decision: 'PASS',
            rationale: 'Evidence categories are now complete.',
            repair_brief: '',
            api_fallback_used: false,
            api_cost_usd: 0
          };
    }
  };

  const result = await runJarvisOwnerChatJobV1(dispatch.job, {
    memory_store: store,
    claude_bridge: bridge,
    intelligence_router: intelligenceRouter,
    astra_post_review_enabled: true,
    max_repair_attempts: 2
  });

  assert.equal(result.ok, true);
  assert.equal(result.status, 'COMPLETE');
  assert.equal(result.repair_attempts, 1, 'read-only Astra REPAIR gets exactly one bounded retry');
  assert.equal(result.attempt_chain.length, 2);
  assert.equal(new Set(result.attempt_chain.map((row) => row.request_id)).size, 2);
  assert.deepEqual(observedModes, ['review', 'review'], 'repair never escapes read-only review mode');
  assert.equal(reviewCalls, 2);
  assert.equal(result.astra_post_review.decision, 'PASS');
  assert.equal(result.verified_result_memory.persisted, true);
}

/* ── 6c2. A prior FAILED owner job can nominate only its exact,
        unaccepted, unpublished clean-base candidate for new-job recovery. ── */
{
  const priorId = '91919191-9191-4919-8919-919191919191';
  const currentId = '92929292-9292-4929-8929-929292929292';
  const goal = 'Implementiere exakt denselben kleinen Fix.';
  const head = '1'.repeat(40);
  const diff = 'diff --git a/src/edit-planner.js b/src/edit-planner.js\n--- a/src/edit-planner.js\n+++ b/src/edit-planner.js\n@@ -1 +1 @@\n-old\n+new';
  const rows = [
    {
      request_id: priorId,
      timestamp: '2026-09-21T10:08:10.000Z',
      intent: { intent_type: 'IMPLEMENTATION_MISSION_REQUEST' },
      action: 'IMPLEMENTATION_MISSION',
      result: {
        verification: {
          branch: 'factory/owner-candidate',
          head,
          files_changed: ['src/edit-planner.js'],
          pre_existing_dirty_files: [],
          syntax_check: { passed: true, checked: 1 },
          filesystem_evidence: { post: { sha256: 'a'.repeat(64) } },
          git_evidence: {
            pre: { head, status: [] },
            post: { status: ['M src/edit-planner.js'] },
            changes: { diff }
          }
        }
      }
    },
    {
      request_id: priorId,
      timestamp: '2026-09-21T10:08:20.000Z',
      intent: { intent_type: 'OWNER_CHAT_JOB_NOTIFICATION' },
      action: 'IMPLEMENTATION_MISSION',
      result: { status: 'FAILED', goal }
    }
  ];

  const candidate = findJarvisOwnerChatRecoverableFailedCandidateV1(rows, goal, currentId);
  assert.ok(candidate);
  assert.equal(candidate.source_request_id, priorId);
  assert.equal(candidate.branch, 'factory/owner-candidate');
  assert.equal(candidate.head, head);
  assert.deepEqual(candidate.files, ['src/edit-planner.js']);
  assert.equal(candidate.diff, diff);
  assert.deepEqual(candidate.pre_existing_dirty_files, []);

  assert.equal(findJarvisOwnerChatRecoverableFailedCandidateV1(rows, 'anderes Ziel', currentId), null,
    'a different owner goal must never inherit a prior candidate');
  const publishedRows = [...rows, {
    request_id: '93939393-9393-4939-8939-939393939393',
    action: 'OWNER_CHAT_JOB_PUBLICATION',
    result: { request_id: priorId, status: 'COMPLETED' }
  }];
  assert.equal(findJarvisOwnerChatRecoverableFailedCandidateV1(publishedRows, goal, currentId), null,
    'published work must never be treated as failed-candidate cleanup material');
}

/* ── 6d. Implementation workspace preflight runs before Claude and
        fails closed without consuming a Bridge attempt. Read-only jobs skip
        this dependency entirely. ── */
{
  const store = createMemoryJarvisStoreV1();
  const message = 'Implementiere MARKER-WORKSPACE-PREFLIGHT als kleine interne Änderung.';
  const dispatch = await dispatchJarvisOwnerChatJobV1(
    { owner_id: OWNER_ID, owner_ref: OWNER_REF, message, now: '2026-09-21T10:09:00.000Z' },
    { memory_store: store }
  );
  assert.equal(dispatch.ok, true);

  let bridgeCalls = 0;
  const bridge = createJarvisClaudeCodeBridgeV1({
    executor: async () => {
      bridgeCalls += 1;
      throw new Error('bridge must not run when workspace preflight fails');
    }
  });

  let preflightCalls = 0;
  const result = await runJarvisOwnerChatJobV1(dispatch.job, {
    memory_store: store,
    claude_bridge: bridge,
    workspace_preflight: async () => {
      preflightCalls += 1;
      return { ok: false, error: 'OWNER_WORKSPACE_GIT_INDEX_ACCESS_REPAIR_FAILED' };
    },
    max_repair_attempts: 2
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, 'FAILED');
  assert.equal(result.reason, 'OWNER_WORKSPACE_GIT_INDEX_ACCESS_REPAIR_FAILED');
  assert.equal(result.repair_attempts, 0);
  assert.equal(result.attempt_chain.length, 1);
  assert.equal(result.attempt_chain[0].wave_state, 'BLOCKED');
  assert.equal(result.attempt_chain[0].workspace_preflight.ok, false);
  assert.equal(preflightCalls, 1);
  assert.equal(bridgeCalls, 0, 'failed preflight must block before Claude dispatch');
}

{
  const store = createMemoryJarvisStoreV1();
  const message = 'READ-ONLY. Prüfe MARKER-PREFLIGHT-SKIP. Verändere nichts.';
  const dispatch = await dispatchJarvisOwnerChatJobV1(
    { owner_id: OWNER_ID, owner_ref: OWNER_REF, message, now: '2026-09-21T10:09:30.000Z' },
    { memory_store: store }
  );

  let preflightCalls = 0;
  const bridge = createJarvisClaudeCodeBridgeV1({
    executor: createLocalFixtureExecutorV1({
      'MARKER-PREFLIGHT-SKIP': {
        exit_code: 0,
        stdout: 'read only pass',
        verification: {
          schema: 'aurentara.jarvis.repo-bound-verification.v1',
          repo_dir: '/workspace/projects/jarvis-engineering-mission',
          branch: 'feature/preflight-skip',
          branch_drift: false,
          files_changed: [],
          pre_existing_dirty_files: [],
          syntax_check: { passed: true, checked: 0, results: [] },
          filesystem_evidence: { complete: true, unchanged: true },
          git_evidence: { head_unchanged: true },
          tool_audit: {
            complete: true,
            is_error: false,
            tool_uses: [],
            forbidden_tool_uses: [],
            outside_workspace_targets: [],
            sensitive_targets: [],
            permission_denials: []
          }
        }
      }
    })
  });

  const result = await runJarvisOwnerChatJobV1(dispatch.job, {
    memory_store: store,
    claude_bridge: bridge,
    workspace_preflight: async () => {
      preflightCalls += 1;
      return { ok: false, error: 'MUST_NOT_RUN_FOR_READ_ONLY' };
    }
  });

  assert.equal(result.ok, true);
  assert.equal(preflightCalls, 0, 'read-only owner jobs must not mutate git metadata');
}

/* ── 7. Fails closed, never fabricated: no Claude bridge bound at all -> job
        FAILED immediately, zero repair attempts wasted on a worker that was
        never going to run. ── */
{
  const store = createMemoryJarvisStoreV1();
  const message = 'Implementiere MARKER-E2E-NOBRIDGE: irgendein internes Feature.';
  const dispatch = await dispatchJarvisOwnerChatJobV1({ owner_id: OWNER_ID, owner_ref: OWNER_REF, message, now: '2026-09-21T10:10:00.000Z' }, { memory_store: store });
  const result = await runJarvisOwnerChatJobV1(dispatch.job, { memory_store: store, claude_bridge: null });
  assert.equal(result.ok, false);
  assert.equal(result.status, 'FAILED');
  assert.equal(result.reason, 'CLAUDE_BRIDGE_NOT_BOUND');
  assert.equal(result.repair_attempts, 0, 'never wastes a repair attempt when there was no worker to begin with');
  assert.equal(result.attempt_chain.length, 1);
}

/* ── 8. CONVERSATION and APPROVAL_REQUIRED_ACTION never reach
        dispatchJarvisOwnerChatJobV1 in the first place — enforced at the
        http-v1.js call site (classification check), not inside this module.
        Directly exercising this module's fail-closed input validation
        instead: a missing/invalid owner never gets a job. ── */
{
  const store = createMemoryJarvisStoreV1();
  const invalid = await dispatchJarvisOwnerChatJobV1({ owner_id: 'not-a-uuid', owner_ref: OWNER_REF, message: 'Implementiere X.' }, { memory_store: store });
  assert.equal(invalid.ok, false);
  assert.equal(invalid.error, 'JARVIS_OWNER_CHAT_JOB_OWNER_ID_REQUIRED');
  const empty = await dispatchJarvisOwnerChatJobV1({ owner_id: OWNER_ID, owner_ref: OWNER_REF, message: '' }, { memory_store: store });
  assert.equal(empty.ok, false);
  assert.equal(empty.error, 'JARVIS_OWNER_CHAT_JOB_MESSAGE_REQUIRED');
}

/* ── 9. Manifest / safety invariants ── */
{
  const man = jarvisOwnerChatJobManifestV1();
  assert.equal(man.production_deploy, false);
  assert.equal(man.hamyren_data_flow, false);
  assert.equal(man.action_gate_bypassed, false);
  assert.equal(man.worker_self_acceptance_counts_as_independent, false);
  assert.equal(man.fails_closed_without_claude_bridge, true);
  assert.equal(man.worker_safe, true);
  assert.equal(man.verified_complete_result_memory_persisted_when_store_supports_upsert, true);
  assert.equal(man.failed_jobs_never_promoted_to_verified_result_memory, true);
  assert.equal(man.read_only_max_repair_attempts, 1);
  assert.equal(man.read_only_repairs_stay_in_review_mode, true);
  assert.equal(man.implementation_workspace_preflight_dependency_supported, true);
  assert.equal(man.workspace_preflight_skipped_for_read_only_jobs, true);
  assert.equal(man.workspace_preflight_failure_blocks_before_claude_dispatch, true);
  assert.equal(man.failed_candidate_recovery_requires_exact_same_owner_goal, true);
  assert.equal(man.failed_candidate_recovery_requires_clean_original_candidate_base, true);
  assert.equal(man.failed_candidate_recovery_never_accepts_or_publishes_candidate, true);
}

console.log('JARVIS Owner Chat Job V1 (chat-work-router -> ack -> background dispatch -> verification -> bounded repair -> notification) smoke: PASS');
