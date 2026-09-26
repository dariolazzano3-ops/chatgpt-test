/* JARVIS — Owner Chat Job V1.

   Closes the dispatch gap chat-work-router-v1.js's header describes: once a
   natural owner chat message classifies ACTIONABLE_WORK, something has to
   turn it into a real, durable, independently-verified engineering mission
   WITHOUT the owner having to leave chat and use the dedicated Command Center
   approve button. This module is that something.

   It does not invent a new execution architecture. It composes three
   already-existing, already-audited components in sequence, for the SAME
   action gate every other engineering mission goes through
   (engineering-mission-v1.js / action-gate-v1.js):

     1. a self-approval audit row, in EXACTLY the shape
        command-center-approval-runtime-v1.js writes for an operator's
        Command Center decision (actor_type OPERATOR, explicit: true,
        decision 'approve', decided_run_id = this request_id) — never a
        looser shape, never bypassing evaluateJarvisActionGateV1. The
        authenticated owner's own imperative, typed into an already-Access-
        authenticated chat session, IS the distinct explicit approval
        decision this mission's action gate requires — not a substitute for
        one. This is why chat-work-router-v1.js only ever reaches this module
        for ACTIONABLE_WORK: a bounded, internal, reversible engineering
        imperative with no risk signal. APPROVAL_REQUIRED_ACTION never
        reaches here, and never gets this self-approval row;
     2. handleJarvisEngineeringMissionRuntimeV1 (engineering-mission-v1.js) —
        unmodified, same fail-closed-without-a-bound-bridge behaviour;
     3. evaluateJarvisEngineeringMissionAcceptanceStateV1
        (engineering-mission-acceptance-v1.js) — the same pure repo-bound
        evidence rule used by explicit acceptance, but WITHOUT writing an
        OPERATOR acceptance row. Automatic completion is SYSTEM verification;
        explicit human acceptance remains a separate action.

   Dispatch is two-phase, so the HTTP layer can answer the owner immediately
   while the actual work runs after the response is sent (http-v1.js wires
   the second phase through ctx.waitUntil, same as any other Cloudflare
   Worker background task):

     dispatchJarvisOwnerChatJobV1  — synchronous-fast: validates, mints the
                                      job's request_id, persists the
                                      self-approval row, returns immediately
                                      with a deterministic German
                                      acknowledgement (never an LLM call —
                                      nothing here should make the owner wait
                                      on a second network round trip just to
                                      hear "okay, starting").
     runJarvisOwnerChatJobV1       — the background body: dispatch, verify,
                                      and — only on insufficient verification,
                                      never on a plain worker failure the
                                      owner should see as-is — a bounded
                                      number of repair re-dispatches, each its
                                      own request_id (the bridge dedupes by
                                      correlation_id, so re-running the exact
                                      same request_id would just replay the
                                      cached result, never re-execute).
                                      Finishes with ONE durable notification
                                      audit row, persisted under the
                                      ORIGINAL request_id so it groups into
                                      the SAME Command Center run the owner's
                                      chat message started — the durable
                                      owner notification/outbox this closes
                                      is the existing audit trail + Command
                                      Center Activity/Runs projection
                                      (command-center-read-bindings-v1.js),
                                      not a new channel.

   A repair attempt's own mission/acceptance rows are NOT retroactively
   relabelled under the original request_id (the bridge's correlation_id ===
   request_id coupling in engineering-mission-v1.js makes that structurally
   impossible without weakening bridge idempotency, and this module
   deliberately never modifies engineering-mission-v1.js's own audit-row
   shape to work around it). They are linked instead via result.attempt_chain
   — every attempt's request_id, wave_state and acceptance outcome — carried
   on the ONE final notification row. A run's own acceptance_state projection in
   command-center-read-bindings-v1.js reflects only that run's own request_id
   — for a run that needed repair, the terminal COMPLETE/FAILED status still
   surfaces correctly (the notification row's result.status drives it), but
   acceptance_state on the ORIGINAL request_id can stay NOT_APPLICABLE even
   after a repaired attempt succeeds. Documented, not hidden: full evidence is
   always in attempt_chain.

   Worker-safe: no Node-only imports. */

import { createJarvisAuditEventV1 } from './audit-v1.js';
import { handleJarvisEngineeringMissionRuntimeV1 } from './engineering-mission-v1.js';
import { evaluateJarvisEngineeringMissionAcceptanceStateV1 } from './engineering-mission-acceptance-v1.js';
import { normalizeJarvisMemoryEntryV1, retrieveJarvisMemoryV1 } from './memory-v1.js';

const clean = (value, max = 4000) => String(value ?? '').trim().slice(0, max);

export function isJarvisOwnerChatReadOnlyGoalV1(goal) {
  const text = clean(goal, 4000).toLowerCase();
  if (!text) return false;
  return [
    'read-only',
    'read only',
    'readonly',
    'verändere nichts',
    'nichts verändern',
    'keine änderungen',
    'ohne änderungen',
    'do not modify',
    'do not change',
    'no changes',
    'without changes'
  ].some((marker) => text.includes(marker));
}
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const JARVIS_OWNER_CHAT_JOB_PROGRAM = 'JARVIS_OWNER_CHAT';
export const JARVIS_OWNER_CHAT_JOB_ACTION = 'IMPLEMENTATION_MISSION';
export const JARVIS_OWNER_CHAT_APPROVAL_GATE_STATUS = 'APPROVED_BY_OWNER_CHAT_IMPERATIVE';
export const JARVIS_OWNER_CHAT_NOTIFICATION_INTENT = 'OWNER_CHAT_JOB_NOTIFICATION';
// Hard ceiling, independent of whatever a caller passes as
// deps.max_repair_attempts — bounded repair must stay bounded no matter what.
export const JARVIS_OWNER_CHAT_JOB_MAX_REPAIR_ATTEMPTS_CEILING = 5;
export const JARVIS_OWNER_CHAT_JOB_DEFAULT_MAX_REPAIR_ATTEMPTS = 2;
export const JARVIS_OWNER_CHAT_JOB_READ_ONLY_MAX_REPAIR_ATTEMPTS = 1;

/** Pure. A short, stable job title derived only from the owner's own message
 *  — never truncated silently past what resolveJarvisEngineeringMissionIntentV1
 *  (engineering-mission-v1.js) itself allows (200 chars), so nothing here can
 *  desync from what actually gets persisted as the mission title. */
export function deriveJarvisOwnerChatJobTitleV1(message = '') {
  const oneLine = clean(message, 4000).replace(/\s+/g, ' ').trim();
  return oneLine.length > 160 ? `${oneLine.slice(0, 157)}...` : oneLine;
}

/** Pure. Deterministic, immediate, never an LLM call — the owner should
 *  never wait on a second network round trip just to hear "okay, starting". */
export function buildJarvisOwnerChatAckV1(title = '') {
  const safeTitle = clean(title, 160);
  return `Verstanden. Ich kümmere mich jetzt darum: „${safeTitle}". Ich melde mich, sobald es abgeschlossen ist.`;
}

function buildNotificationText(status, title, reason, attempts) {
  const safeTitle = clean(title, 160);
  if (status === 'COMPLETE') {
    return `Erledigt: „${safeTitle}" ist abgeschlossen und unabhängig verifiziert.`;
  }
  const attemptsText = attempts > 0 ? ` Ich habe ${attempts} Reparaturversuch(e) unternommen.` : '';
  return `„${safeTitle}" ist nicht abgeschlossen (Grund: ${clean(reason || 'UNKNOWN', 200)}).${attemptsText} Bitte prüfe es oder gib weitere Hinweise.`;
}

const auditAtV1 = (row) => Date.parse(row?.occurred_at || row?.timestamp || 0) || 0;
const sortedUniqueV1 = (items = []) => [...new Set((Array.isArray(items) ? items : []).map((x) => clean(x, 500)).filter(Boolean))].sort();

function buildJarvisOwnerChatFailedCandidateProvenanceV1(sourceRequestId, goal, verification = null) {
  const sourceId = clean(sourceRequestId, 80).toLowerCase();
  const wantedGoal = clean(goal, 4000);
  const v = verification && typeof verification === 'object' ? verification : null;
  if (!UUID_RE.test(sourceId) || !wantedGoal || !v) return null;

  const files = sortedUniqueV1(v.files_changed);
  const preDirty = sortedUniqueV1(v.pre_existing_dirty_files);
  const branch = clean(v.branch, 200);
  const head = clean(v.head || v?.git_evidence?.pre?.head, 80);
  const diff = clean(v?.git_evidence?.changes?.diff, 100000);
  if (
    files.length === 0
    || preDirty.length > 0
    || v?.syntax_check?.passed !== true
    || !branch
    || !/^[0-9a-f]{40}$/i.test(head)
    || !diff
  ) return null;

  return {
    schema: 'aurentara.jarvis.owner-failed-candidate-provenance.v1',
    source_request_id: sourceId,
    goal: wantedGoal,
    branch,
    head,
    files,
    diff,
    post_status: sortedUniqueV1(v?.git_evidence?.post?.status),
    filesystem_post_sha256: clean(v?.filesystem_evidence?.post?.sha256, 80) || null,
    syntax_check_passed: true,
    pre_existing_dirty_files: []
  };
}

export function findJarvisOwnerChatRecoverableFailedCandidateV1(auditRows = [], goal = '', currentRequestId = '') {
  const wantedGoal = clean(goal, 4000);
  const currentId = clean(currentRequestId, 80).toLowerCase();
  if (!wantedGoal) return null;
  const rows = Array.isArray(auditRows) ? auditRows : [];
  const failedJobs = rows
    .filter((row) => row?.intent?.intent_type === JARVIS_OWNER_CHAT_NOTIFICATION_INTENT)
    .filter((row) => row?.result?.status === 'FAILED' && clean(row?.result?.goal, 4000) === wantedGoal)
    .filter((row) => clean(row?.request_id, 80).toLowerCase() !== currentId)
    .sort((a, b) => auditAtV1(b) - auditAtV1(a));

  for (const failed of failedJobs) {
    const failedId = clean(failed?.request_id, 80).toLowerCase();
    if (!UUID_RE.test(failedId)) continue;

    const attemptIds = sortedUniqueV1([
      failedId,
      ...((Array.isArray(failed?.result?.attempt_chain) ? failed.result.attempt_chain : [])
        .map((attempt) => clean(attempt?.request_id, 80).toLowerCase())
        .filter((id) => UUID_RE.test(id)))
    ]);
    const relatedRows = rows.filter((row) => attemptIds.includes(clean(row?.request_id, 80).toLowerCase()));
    if (relatedRows.some((row) => row?.result?.independent_acceptance === true)) continue;
    if (rows.some((row) =>
      row?.action === 'OWNER_CHAT_JOB_PUBLICATION'
      && attemptIds.includes(clean(row?.result?.request_id, 80).toLowerCase())
    )) continue;

    const missions = relatedRows
      .filter((row) => row?.action === JARVIS_OWNER_CHAT_JOB_ACTION)
      .filter((row) => row?.intent?.intent_type === 'IMPLEMENTATION_MISSION_REQUEST')
      .filter((row) => row?.result?.verification)
      .sort((a, b) => auditAtV1(b) - auditAtV1(a));

    for (const mission of missions) {
      const candidate = buildJarvisOwnerChatFailedCandidateProvenanceV1(
        clean(mission?.request_id, 80).toLowerCase(),
        wantedGoal,
        mission?.result?.verification
      );
      if (candidate) return candidate;
    }
  }
  return null;
}

/** Pure. Exactly the approval-decision shape command-center-approval-runtime-v1.js
 *  persists for an operator's Command Center decision — the only difference
 *  is the gate_status naming its true origin (the owner's own chat
 *  imperative, not a UI button), so this is never mistaken in the audit
 *  trail for a Command Center-recorded decision it isn't. */
export function buildJarvisOwnerChatSelfApprovalAuditEventV1({ ownerRef, requestId, title, now }) {
  const event = createJarvisAuditEventV1({
    timestamp: now,
    owner_ref: ownerRef,
    request: `Owner-Chat-Imperativ-Freigabe: ${clean(title, 160)}`,
    intent: { intent_type: 'APPROVAL_DECISION', domain: 'APPROVAL', action: 'APPROVAL_DECISION' },
    action: 'APPROVAL_DECISION',
    permissions: [],
    tools_used: [],
    result: {
      status: 'DECISION_RECORDED',
      verified: false,
      external_effect: false,
      decision: 'approve',
      approval_id: `${requestId}:approval`,
      decided_run_id: requestId
    },
    approval: {
      required: true,
      explicit: true,
      actor_type: 'OPERATOR',
      gate_status: JARVIS_OWNER_CHAT_APPROVAL_GATE_STATUS,
      decision: 'approve',
      approval_id: `${requestId}:approval`,
      decided_run_id: requestId
    },
    cost: { estimated_eur: 0, actual_eur: 0 },
    memory_updates: { accepted: 0, proposed: 0, rejected: 0 }
  });
  event.request_id = requestId;
  return event;
}

/** Fast, synchronous-shaped phase. Validates the request, mints the job's
 *  durable identity (request_id), persists the self-approval row, and
 *  returns immediately — before any bridge dispatch happens. The caller
 *  (http-v1.js) sends `ack` straight back to the owner and schedules
 *  `runJarvisOwnerChatJobV1` in the background (ctx.waitUntil). */
export async function dispatchJarvisOwnerChatJobV1(request = {}, deps = {}) {
  const ownerId = clean(request.owner_id, 80);
  const ownerRef = clean(request.owner_ref, 320);
  const message = clean(request.message, 4000);
  const now = clean(request.now, 80) || new Date().toISOString();
  const requestedId = clean(request.request_id, 80).toLowerCase();
  const requestId = UUID_RE.test(requestedId) ? requestedId : crypto.randomUUID();

  if (!UUID_RE.test(ownerId)) return { ok: false, error: 'JARVIS_OWNER_CHAT_JOB_OWNER_ID_REQUIRED' };
  if (!ownerRef) return { ok: false, error: 'JARVIS_OWNER_CHAT_JOB_OWNER_REF_REQUIRED' };
  if (!message) return { ok: false, error: 'JARVIS_OWNER_CHAT_JOB_MESSAGE_REQUIRED' };
  if (!deps.memory_store || typeof deps.memory_store.appendAudit !== 'function') {
    return { ok: false, error: 'JARVIS_OWNER_CHAT_JOB_MEMORY_STORE_REQUIRED' };
  }

  const title = deriveJarvisOwnerChatJobTitleV1(message);
  const goal = message;

  const approvalEvent = buildJarvisOwnerChatSelfApprovalAuditEventV1({ ownerRef, requestId, title, now });
  await deps.memory_store.appendAudit({ owner_id: ownerId, owner_ref: ownerRef, event: approvalEvent });

  return {
    ok: true,
    schema: 'aurentara.jarvis.owner-chat-job-dispatch.v1',
    request_id: requestId,
    program: JARVIS_OWNER_CHAT_JOB_PROGRAM,
    title,
    goal,
    ack: buildJarvisOwnerChatAckV1(title),
    audit_persisted: true,
    job: { owner_id: ownerId, owner_ref: ownerRef, request_id: requestId, title, goal, now }
  };
}

/** The background body. Dispatches through the injected Claude Code bridge,
 *  independently verifies the outcome (repo-bound evidence, never a bare
 *  exit code — see engineering-mission-acceptance-v1.js), and on
 *  insufficient verification only, retries a bounded number of times with a
 *  fresh request_id per attempt. Always ends in exactly one durable
 *  notification audit row under the ORIGINAL request_id. */
export async function runJarvisOwnerChatJobV1(job = {}, deps = {}) {
  const ownerId = clean(job.owner_id, 80);
  const ownerRef = clean(job.owner_ref, 320);
  const requestId = clean(job.request_id, 80).toLowerCase();
  const title = clean(job.title, 200);
  const originalGoal = clean(job.goal, 4000);
  const now = clean(job.now, 80) || new Date().toISOString();

  if (!UUID_RE.test(ownerId) || !ownerRef || !UUID_RE.test(requestId) || !title || !originalGoal) {
    return { ok: false, error: 'JARVIS_OWNER_CHAT_JOB_RUN_INPUT_INVALID', request_id: requestId || null };
  }
  if (!deps.memory_store || typeof deps.memory_store.appendAudit !== 'function' || typeof deps.memory_store.readAudit !== 'function') {
    return { ok: false, error: 'JARVIS_OWNER_CHAT_JOB_MEMORY_STORE_REQUIRED', request_id: requestId };
  }

  const configuredMaxAttempts = Math.min(
    JARVIS_OWNER_CHAT_JOB_MAX_REPAIR_ATTEMPTS_CEILING,
    Number.isInteger(deps.max_repair_attempts) && deps.max_repair_attempts >= 0
      ? deps.max_repair_attempts
      : JARVIS_OWNER_CHAT_JOB_DEFAULT_MAX_REPAIR_ATTEMPTS
  );
  const maxAttempts = isJarvisOwnerChatReadOnlyGoalV1(originalGoal)
    ? Math.min(JARVIS_OWNER_CHAT_JOB_READ_ONLY_MAX_REPAIR_ATTEMPTS, configuredMaxAttempts)
    : configuredMaxAttempts;

  const attemptChain = [];
  let attemptRequestId = requestId;
  let attemptGoal = originalGoal;
  let attemptNumber = 0;
  let finalStatus = 'FAILED';
  let finalReason = null;
  let finalEvidenceId = null;
  let finalVerification = null;
  let finalAstraPostReview = null;
  let astraReviewApiCostUsd = 0;
  let finalization = null;
  let intelligencePlan = null;
  let intelligenceFailed = false;
  let hermesMemoryContext = '';
  let hermesMemoryItems = 0;

  if (typeof deps.memory_store.loadMemory === 'function') {
    try {
      const allMemory = await deps.memory_store.loadMemory({ owner_id: ownerId, owner_ref: ownerRef, limit: 200 });
      const recalled = retrieveJarvisMemoryV1(allMemory, originalGoal, {
        owner_ref: ownerRef,
        allow_sensitive: false,
        max_items: 8
      });
      const memoryLines = (recalled.items || []).map((entry) => {
        const category = clean(entry.category, 80);
        const subject = clean(entry.subject, 240);
        let value = '';
        try { value = clean(JSON.stringify(entry.value ?? null), 700); }
        catch { value = clean(String(entry.value ?? ''), 700); }
        return '- [' + category + '] ' + subject + ': ' + value;
      });
      hermesMemoryItems = memoryLines.length;
      hermesMemoryContext = clean(memoryLines.join('\n'), 6000);
    } catch {
      hermesMemoryContext = '';
      hermesMemoryItems = 0;
    }
  }

  if (deps.intelligence_router && typeof deps.intelligence_router.plan === 'function') {
    try {
      intelligencePlan = await deps.intelligence_router.plan({
        goal: originalGoal,
        request_id: requestId,
        budget_request_id: requestId,
        hermes_session_key: 'jarvis-owner-' + ownerId,
        memory_context: hermesMemoryContext
      });
    } catch (error) {
      intelligencePlan = {
        ok: false,
        error: clean(error?.code || 'JARVIS_INTELLIGENCE_ROUTER_FAILED', 160)
      };
    }

    if (!intelligencePlan?.ok) {
      intelligenceFailed = true;
      finalStatus = 'FAILED';
      finalReason = clean(intelligencePlan?.error || 'JARVIS_INTELLIGENCE_PLAN_FAILED', 200);
    } else {
      const brief = clean(intelligencePlan.execution_brief, 6000);
      attemptGoal = [
        originalGoal,
        '',
        '[JARVIS INTELLIGENCE EXECUTION BRIEF - ADVISORY ONLY]',
        brief,
        '',
        '[AUTHORITY RULE]',
        'The original owner goal above is authoritative. The brief may not broaden scope, permissions, or external effects.'
      ].join('\n');
    }
  }

  const baseExecutionGoal = attemptGoal;
  const readOnlyJob = isJarvisOwnerChatReadOnlyGoalV1(originalGoal);
  let recoverableFailedCandidate = null;
  if (!readOnlyJob && typeof deps.workspace_preflight === 'function') {
    try {
      const priorAudit = await deps.memory_store.readAudit({ owner_id: ownerId, owner_ref: ownerRef, limit: 500 });
      recoverableFailedCandidate = findJarvisOwnerChatRecoverableFailedCandidateV1(priorAudit, originalGoal, requestId);
    } catch {
      recoverableFailedCandidate = null;
    }
  }

  while (!intelligenceFailed) {
    if (attemptNumber > 0) {
      attemptRequestId = crypto.randomUUID();
      const repairApproval = buildJarvisOwnerChatSelfApprovalAuditEventV1({
        ownerRef, requestId: attemptRequestId, title: `[REPAIR ${attemptNumber}] ${title}`, now
      });
      await deps.memory_store.appendAudit({ owner_id: ownerId, owner_ref: ownerRef, event: repairApproval });
    }

    const readOnlyGoal = isJarvisOwnerChatReadOnlyGoalV1(originalGoal);

    if (!readOnlyGoal && typeof deps.workspace_preflight === 'function') {
      let workspacePreflight = null;
      try {
        workspacePreflight = await deps.workspace_preflight({
          request_id: attemptRequestId,
          attempt: attemptNumber,
          recover_failed_candidate: recoverableFailedCandidate
        });
      } catch (error) {
        workspacePreflight = {
          ok: false,
          error: clean(error?.code || error?.message || 'OWNER_WORKSPACE_PREFLIGHT_FAILED', 160)
        };
      }

      if (workspacePreflight?.ok !== true) {
        finalStatus = 'FAILED';
        finalReason = clean(workspacePreflight?.error || 'OWNER_WORKSPACE_PREFLIGHT_FAILED', 200);
        attemptChain.push({
          request_id: attemptRequestId,
          attempt: attemptNumber,
          wave_state: 'BLOCKED',
          claude_state: null,
          system_verified: false,
          verification_error: finalReason,
          workspace_preflight: {
            ok: false,
            error: finalReason
          }
        });
        break;
      }
      if (workspacePreflight?.failed_candidate_recovered === true) {
        recoverableFailedCandidate = null;
      }
    }

    const mission = await handleJarvisEngineeringMissionRuntimeV1({
      owner_id: ownerId,
      owner_ref: ownerRef,
      title: attemptNumber > 0 ? `[REPAIR ${attemptNumber}] ${title}` : title,
      goal: attemptGoal,
      program: JARVIS_OWNER_CHAT_JOB_PROGRAM,
      correlation_id: attemptRequestId,
      wave_index: null,
      execution_mode: readOnlyGoal ? 'review' : 'implement',
      now
    }, {
      memory_store: deps.memory_store,
      claude_bridge: deps.claude_bridge,
      claude_timeout_ms: deps.claude_timeout_ms,
      workspace: deps.workspace
    });

    if (!mission.claude_bridge_bound) {
      finalStatus = 'FAILED';
      finalReason = 'CLAUDE_BRIDGE_NOT_BOUND';
      attemptChain.push({ request_id: attemptRequestId, attempt: attemptNumber, wave_state: mission.wave_state, claude_state: null });
      break;
    }

    let auditRows = [];
    try {
      auditRows = await deps.memory_store.readAudit({ owner_id: ownerId, owner_ref: ownerRef, limit: 500 });
    } catch {
      finalStatus = 'FAILED';
      finalReason = 'SYSTEM_VERIFICATION_AUDIT_READ_FAILED';
      attemptChain.push({
        request_id: attemptRequestId,
        attempt: attemptNumber,
        wave_state: mission.wave_state,
        claude_state: mission.claude_execution?.state || null,
        system_verified: false,
        verification_error: finalReason
      });
      break;
    }

    const verificationState = evaluateJarvisEngineeringMissionAcceptanceStateV1(auditRows, attemptRequestId);
    const verification = mission.claude_execution?.evidence?.verification || null;
    if (!readOnlyGoal) {
      const currentAttemptCandidate = buildJarvisOwnerChatFailedCandidateProvenanceV1(
        attemptRequestId,
        originalGoal,
        verification
      );
      if (currentAttemptCandidate) recoverableFailedCandidate = currentAttemptCandidate;
    }
    const fs = verification?.filesystem_evidence || null;
    const git = verification?.git_evidence || null;
    const audit = verification?.tool_audit || null;
    const uses = Array.isArray(audit?.tool_uses) ? audit.tool_uses : [];
    const mutatingToolUsed = uses.some((entry) => /^(edit|write|notebookedit)$/i.test(clean(entry?.tool || entry, 80)));
    const unsafeAudit = mutatingToolUsed
      || (Array.isArray(audit?.forbidden_tool_uses) && audit.forbidden_tool_uses.length > 0)
      || (Array.isArray(audit?.outside_workspace_targets) && audit.outside_workspace_targets.length > 0)
      || (Array.isArray(audit?.sensitive_targets) && audit.sensitive_targets.length > 0)
      || (Array.isArray(audit?.permission_denials) && audit.permission_denials.length > 0);
    const readOnlyVerified = readOnlyGoal
      && mission.claude_execution?.state === 'COMPLETE'
      && mission.claude_execution?.exit_code === 0
      && mission.claude_execution?.external_effect !== true
      && fs?.complete === true && fs?.unchanged === true
      && git?.head_unchanged === true
      && audit?.complete === true && audit?.is_error !== true
      && !unsafeAudit;
    const systemVerified = (verificationState.mission_found === true
      && verificationState.dispatched === true
      && verificationState.verification_sufficient === true) || readOnlyVerified;
    const claudeFailureReason = clean(mission.claude_execution?.failure_reason, 160) || null;
    const verificationError = systemVerified ? null
      : claudeFailureReason
        || (readOnlyGoal ? 'READ_ONLY_SYSTEM_VERIFICATION_INSUFFICIENT'
          : (verificationState.verification_insufficient_reason || 'VERIFICATION_INSUFFICIENT'));

    attemptChain.push({
      request_id: attemptRequestId,
      attempt: attemptNumber,
      wave_state: mission.wave_state,
      claude_state: mission.claude_execution?.state || null,
      claude_failure_reason: clean(mission.claude_execution?.failure_reason, 160) || null,
      system_verified: systemVerified,
      operator_accepted: verificationState.already_accepted === true,
      verification_error: verificationError
    });

    if (systemVerified) {
      finalVerification = verification;

      if (deps.astra_post_review_enabled === true) {
        if (!deps.intelligence_router || typeof deps.intelligence_router.review !== 'function') {
          finalStatus = 'FAILED';
          finalReason = 'ASTRA_POST_REVIEW_NOT_BOUND';
          const attemptRecord = attemptChain[attemptChain.length - 1];
          if (attemptRecord) attemptRecord.astra_post_review = { ok: false, error: finalReason };
          break;
        }

        try {
          finalAstraPostReview = await deps.intelligence_router.review({
            goal: originalGoal,
            execution_brief: intelligencePlan?.execution_brief || '',
            verification,
            system_verified: true,
            request_id: attemptRequestId,
            budget_request_id: requestId,
            hermes_session_key: 'jarvis-owner-' + ownerId,
            memory_context: hermesMemoryContext
          });
        } catch (error) {
          finalAstraPostReview = {
            ok: false,
            error: clean(error?.code || 'ASTRA_POST_REVIEW_FAILED', 160)
          };
        }

        astraReviewApiCostUsd += Number.isFinite(Number(finalAstraPostReview?.api_cost_usd))
          ? Number(finalAstraPostReview.api_cost_usd)
          : 0;

        const attemptRecord = attemptChain[attemptChain.length - 1];
        if (attemptRecord) {
          attemptRecord.astra_post_review = {
            ok: finalAstraPostReview?.ok === true,
            provider: clean(finalAstraPostReview?.provider, 80) || null,
            model: clean(finalAstraPostReview?.model, 120) || null,
            decision: clean(finalAstraPostReview?.decision, 20) || null,
            rationale: clean(finalAstraPostReview?.rationale, 500) || null,
            api_fallback_used: finalAstraPostReview?.api_fallback_used === true,
            error: clean(finalAstraPostReview?.error, 160) || null
          };
        }

        if (!finalAstraPostReview?.ok) {
          finalStatus = 'FAILED';
          finalReason = clean(finalAstraPostReview?.error || 'ASTRA_POST_REVIEW_FAILED', 200);
          break;
        }

        if (finalAstraPostReview.decision === 'BLOCK') {
          finalStatus = 'FAILED';
          finalReason = 'ASTRA_POST_REVIEW_BLOCK:' + clean(finalAstraPostReview.rationale || 'BLOCKED', 160);
          break;
        }

        if (finalAstraPostReview.decision === 'REPAIR') {
          finalReason = 'ASTRA_POST_REVIEW_REPAIR:' + clean(finalAstraPostReview.rationale || 'REPAIR_REQUIRED', 160);
          if (attemptNumber >= maxAttempts) {
            finalStatus = 'FAILED';
            break;
          }
          const repairBrief = clean(finalAstraPostReview.repair_brief, 5000)
            || 'Re-check the original owner goal against the verified implementation and repair the semantic mismatch without broadening scope.';
          attemptGoal = `${baseExecutionGoal}\n\n[ASTRA POST REVIEW REPAIR ${attemptNumber + 1}/${maxAttempts}]\n${repairBrief}\n\nThe original owner goal remains authoritative. Do not broaden permissions, scope, or external effects.`;
          attemptNumber += 1;
          continue;
        }

        if (finalAstraPostReview.decision !== 'PASS') {
          finalStatus = 'FAILED';
          finalReason = 'ASTRA_POST_REVIEW_INVALID_DECISION';
          break;
        }
      }

      finalStatus = 'COMPLETE';
      finalReason = null;
      finalEvidenceId = verificationState.evidence_id || mission.claude_execution?.evidence?.evidence_id || null;
      break;
    }

    finalReason = verificationError;
    if (attemptNumber >= maxAttempts) {
      finalStatus = 'FAILED';
      break;
    }
    attemptGoal = `${baseExecutionGoal}\n\n[Reparaturversuch ${attemptNumber + 1}/${maxAttempts}] Der vorherige Versuch hat die unabhängige Verifikation nicht bestanden (Grund: ${finalReason}). Behebe dies und schließe das ursprüngliche Ziel oben ab.`;
    attemptNumber += 1;
  }

  if (
    finalStatus === 'COMPLETE'
    && !readOnlyJob
    && deps.trusted_publisher
    && typeof deps.trusted_publisher.publishVerifiedOwnerChatJob === 'function'
  ) {
    try {
      finalization = await deps.trusted_publisher.publishVerifiedOwnerChatJob({
        owner_id: ownerId,
        owner_ref: ownerRef,
        request_id: requestId,
        title,
        repo_dir: clean(finalVerification?.repo_dir, 400),
        target_branch: clean(finalVerification?.branch, 200),
        verification: finalVerification
      });
    } catch (error) {
      finalization = {
        ok: false,
        error: clean(error?.code || error?.message || 'OWNER_CHAT_TRUSTED_PUBLICATION_FAILED', 200)
      };
    }
    if (!finalization?.ok) {
      finalStatus = 'FAILED';
      finalReason = clean(finalization?.error || 'OWNER_CHAT_TRUSTED_PUBLICATION_FAILED', 200);
    }
  }

  let verifiedResultMemory = {
    attempted: false,
    persisted: false,
    memory_id: null,
    error: null
  };
  if (
    finalStatus === 'COMPLETE'
    && finalVerification
    && typeof deps.memory_store.upsertMemory === 'function'
  ) {
    const verifiedSummary = clean(finalVerification?.tool_audit?.result, 3500);
    if (verifiedSummary) {
      verifiedResultMemory.attempted = true;
      const completedAt = new Date().toISOString();
      const normalizedMemory = normalizeJarvisMemoryEntryV1({
        memory_id: 'jarvis:owner-job-result:' + requestId,
        owner_ref: ownerRef,
        category: 'PROJECTS',
        subject: 'Verified owner job result: ' + clean(title, 180),
        value: {
          request_id: requestId,
          program: JARVIS_OWNER_CHAT_JOB_PROGRAM,
          title: clean(title, 300),
          goal: clean(originalGoal, 1200),
          result_summary: verifiedSummary,
          evidence_id: clean(finalEvidenceId, 240) || null,
          branch: clean(finalVerification?.branch, 200) || null,
          head: clean(finalVerification?.head, 80) || clean(finalVerification?.git_evidence?.pre?.head, 80) || null,
          astra_decision: clean(finalAstraPostReview?.decision, 20) || null
        },
        source: {
          type: 'VERIFIED_OWNER_CHAT_JOB',
          request_id: requestId,
          evidence_id: clean(finalEvidenceId, 240) || null
        },
        source_system: 'jarvis.owner_chat',
        confidence: 1,
        created_at: completedAt,
        updated_at: completedAt,
        valid_from: completedAt,
        status: 'CONFIRMED',
        sensitivity: 'INTERNAL',
        provenance: {
          system: 'jarvis.owner_chat',
          verification_actor_type: 'SYSTEM',
          independent_verification: true,
          astra_post_review: clean(finalAstraPostReview?.decision, 20) || null
        }
      }, { owner_ref: ownerRef, now: completedAt });

      if (!normalizedMemory.ok) {
        verifiedResultMemory.error = clean(normalizedMemory.error || 'OWNER_CHAT_RESULT_MEMORY_NORMALIZE_FAILED', 160);
      } else {
        try {
          await deps.memory_store.upsertMemory({
            owner_id: ownerId,
            owner_ref: ownerRef,
            entry: normalizedMemory.entry
          });
          verifiedResultMemory.persisted = true;
          verifiedResultMemory.memory_id = normalizedMemory.entry.memory_id;
        } catch (error) {
          verifiedResultMemory.error = clean(error?.code || error?.message || 'OWNER_CHAT_RESULT_MEMORY_PERSIST_FAILED', 160);
        }
      }
    }
  }

  const intelligenceRoute = intelligencePlan ? {
    memory_context_items: hermesMemoryItems,
    astra_post_review_enabled: deps.astra_post_review_enabled === true,
    astra_post_review_api_cost_usd: astraReviewApiCostUsd,
    astra_post_review_decision: clean(finalAstraPostReview?.decision, 20) || null,
    astra_post_review_provider: clean(finalAstraPostReview?.provider, 80) || null,
    astra_post_review_model: clean(finalAstraPostReview?.model, 120) || null,
    ok: intelligencePlan.ok === true,
    provider: clean(intelligencePlan.provider, 80) || null,
    lane: clean(intelligencePlan.lane, 40) || null,
    model: clean(intelligencePlan.model, 120) || null,
    api_fallback_used: intelligencePlan.api_fallback_used === true,
    hermes_session_scoped: intelligencePlan.hermes_session_scoped === true,
    memory_context_supplied: intelligencePlan.memory_context_supplied === true,
    api_cost_usd: Number.isFinite(Number(intelligencePlan.api_cost_usd))
      ? Number(intelligencePlan.api_cost_usd)
      : 0,
    max_job_cost_usd: Number.isFinite(Number(intelligencePlan.max_job_cost_usd))
      ? Number(intelligencePlan.max_job_cost_usd)
      : null,
    primary_failure_reason: clean(intelligencePlan.primary_failure_reason, 160) || null,
    error: clean(intelligencePlan.error, 160) || null,
    original_goal_authoritative: intelligencePlan.original_goal_authoritative !== false
  } : null;

  const notificationEvent = createJarvisAuditEventV1({
    timestamp: new Date().toISOString(),
    owner_ref: ownerRef,
    request: `[OWNER CHAT JOB] ${title}`,
    intent: { intent_type: JARVIS_OWNER_CHAT_NOTIFICATION_INTENT, domain: 'ENGINEERING', action: JARVIS_OWNER_CHAT_JOB_ACTION },
    action: JARVIS_OWNER_CHAT_JOB_ACTION,
    tools_used: [],
    permissions: [],
    result: {
      status: finalStatus === 'COMPLETE' ? 'COMPLETED' : 'FAILED',
      verified: finalStatus === 'COMPLETE',
      external_effect: false,
      independent_acceptance: false,
      independent_verification: finalStatus === 'COMPLETE',
      verification_actor_type: 'SYSTEM',
      acceptance_ref: null,
      evidence_id: finalEvidenceId,
      program: JARVIS_OWNER_CHAT_JOB_PROGRAM,
      wave_index: null,
      wave_state: finalStatus,
      title,
      goal: originalGoal,
      job_status: finalStatus,
      job_failure_reason: finalStatus === 'COMPLETE' ? null : finalReason,
      repair_attempts: attemptNumber,
      attempt_chain: attemptChain,
      intelligence_route: intelligenceRoute,
      astra_post_review: finalAstraPostReview,
      finalization,
      verified_result_memory: verifiedResultMemory,
      notification: buildNotificationText(finalStatus, title, finalReason, attemptNumber)
    },
    approval: { required: false, explicit: false, actor_type: 'SYSTEM', gate_status: 'OWNER_CHAT_JOB_NOTIFICATION' },
    cost: ((intelligenceRoute?.api_cost_usd || 0) + astraReviewApiCostUsd) > 0
      ? {
          estimated_eur: null,
          actual_eur: null,
          actual_usd: (intelligenceRoute?.api_cost_usd || 0) + astraReviewApiCostUsd,
          currency: 'USD'
        }
      : { estimated_eur: 0, actual_eur: 0 },
    memory_updates: {
      accepted: verifiedResultMemory.persisted === true ? 1 : 0,
      proposed: 0,
      rejected: verifiedResultMemory.error ? 1 : 0
    }
  });
  notificationEvent.request_id = requestId;
  await deps.memory_store.appendAudit({ owner_id: ownerId, owner_ref: ownerRef, event: notificationEvent });

  return {
    ok: finalStatus === 'COMPLETE',
    schema: 'aurentara.jarvis.owner-chat-job-result.v1',
    request_id: requestId,
    status: finalStatus,
    reason: finalStatus === 'COMPLETE' ? null : finalReason,
    repair_attempts: attemptNumber,
    attempt_chain: attemptChain,
    intelligence_route: intelligenceRoute,
    astra_post_review: finalAstraPostReview,
    finalization,
    verified_result_memory: verifiedResultMemory,
    acceptance_ref: null,
    evidence_id: finalEvidenceId,
    notification: buildNotificationText(finalStatus, title, finalReason, attemptNumber),
    audit_persisted: true
  };
}

export function jarvisOwnerChatJobManifestV1() {
  return {
    schema: 'aurentara.jarvis.owner-chat-job.v1',
    program: JARVIS_OWNER_CHAT_JOB_PROGRAM,
    action: JARVIS_OWNER_CHAT_JOB_ACTION,
    reuses_engineering_mission_dispatch: true,
    reuses_engineering_mission_acceptance_evidence_rule: true,
    automatic_operator_acceptance: false,
    automatic_verification_actor_type: 'SYSTEM',
    trusted_publication_after_system_verification_supported: true,
    trusted_publication_is_optional_dependency: true,
    trusted_publication_skipped_for_read_only_jobs: true,
    natural_language_read_only_detection: true,
    reuses_action_gate: true,
    action_gate_bypassed: false,
    self_approval_shape_matches_command_center_approval: true,
    worker_self_acceptance_counts_as_independent: false,
    max_repair_attempts_default: JARVIS_OWNER_CHAT_JOB_DEFAULT_MAX_REPAIR_ATTEMPTS,
    read_only_max_repair_attempts: JARVIS_OWNER_CHAT_JOB_READ_ONLY_MAX_REPAIR_ATTEMPTS,
    read_only_repairs_stay_in_review_mode: true,
    max_repair_attempts_ceiling: JARVIS_OWNER_CHAT_JOB_MAX_REPAIR_ATTEMPTS_CEILING,
    repair_uses_fresh_request_id_per_attempt: true,
    notification_grouped_under_original_request_id: true,
    verified_complete_result_memory_persisted_when_store_supports_upsert: true,
    failed_jobs_never_promoted_to_verified_result_memory: true,
    fails_closed_without_claude_bridge: true,
    implementation_workspace_preflight_dependency_supported: true,
    workspace_preflight_skipped_for_read_only_jobs: true,
    workspace_preflight_failure_blocks_before_claude_dispatch: true,
    failed_candidate_recovery_requires_exact_same_owner_goal: true,
    failed_candidate_recovery_requires_clean_original_candidate_base: true,
    failed_candidate_recovery_never_accepts_or_publishes_candidate: true,
    repair_attempt_preflight_receives_prior_verified_candidate: true,
    astra_post_review_optional_gate_supported: true,
    astra_post_review_repair_reuses_existing_bounded_attempt_loop: true,
    astra_post_review_cannot_override_failed_system_verification: true,
    worker_safe: true,
    production_deploy: false,
    hamyren_data_flow: false
  };
}
