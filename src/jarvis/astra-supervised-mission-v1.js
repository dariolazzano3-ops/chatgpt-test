/* JARVIS — Astra Supervised Mission V1.

   The one orchestration wrapper for the FIRST Astra-gated mission per
   program+repo+branch. Reuses the EXISTING Program Controller tick flow
   (program-controller-v1.js) exactly as-is — no second dispatch path, no
   new branch-prep/dispatch/resume logic — to run one operator-authored
   mission (framed by astra-pre-review-v1.js) through to real Bridge
   evidence, then STOPS before acceptance so a human can review the Astra
   POST decision (astra-post-review-v1.js) first.

   It ticks the real controller forward one call at a time — exactly what
   an operator clicking "tick" repeatedly already does — and refuses to go
   past AUTHORIZE_AND_RESUME itself: it never calls
   handleJarvisEngineeringMissionAcceptanceRuntimeV1, and never lets a tick
   reach VERIFY_AND_ACCEPT. Acceptance remains a separate, later, explicit
   step outside this function, taken only after a human reviews
   `astra_post` here (see docs/JARVIS_ASTRA_REVIEW_V1.md for the
   supervised -> autonomous transition this sets up). */

import { handleJarvisProgramTickRuntimeV1 } from './program-controller-v1.js';
import { reviewJarvisAstraPreV1 } from './astra-pre-review-v1.js';
import { reviewJarvisAstraPostV1 } from './astra-post-review-v1.js';

const clean = (value, max = 4000) => String(value ?? '').trim().slice(0, max);
const MAX_TICKS = 8; // PREPARE_BRANCH, PROPOSE_WAVE_TASK, AUTHORIZE_AND_RESUME + headroom

/** Runs Astra PRE, then ticks the REAL Program Controller forward
 *  (PREPARE_BRANCH -> PROPOSE_WAVE_TASK, using Astra's framed task as the
 *  operator-supplied task -> AUTHORIZE_AND_RESUME) until a real dispatch
 *  either completes/fails or is refused (e.g. DISPATCH_NOT_COVERED), then
 *  runs Astra POST on the resulting Bridge evidence and STOPS — never
 *  calling acceptance. Returns the full decision package for human
 *  review, including the Program Controller action that WOULD run next
 *  if a human approves. */
export async function runJarvisAstraSupervisedMissionV1({
  owner_id, owner_ref, program, repo_dir, target_branch, title, request_text, expected_files
} = {}, deps = {}) {
  const pre = reviewJarvisAstraPreV1({ title, request_text, program, repo_dir, target_branch, expected_files });
  if (!pre.ok) {
    return { ok: false, stage: 'ASTRA_PRE', astra_pre: pre, program_tick_run: false, claude_mission_dispatched: false };
  }

  const tickReq = {
    owner_id, owner_ref,
    program: clean(program, 80).toUpperCase(),
    repo_dir: clean(repo_dir, 400),
    target_branch: clean(target_branch, 200)
  };
  const taskReq = { ...tickReq, task: { title: pre.goal, goal: pre.task } };

  let lastTick = null;
  let resumeDetail = null;
  let ticksRun = 0;
  for (let i = 0; i < MAX_TICKS; i++) {
    lastTick = await handleJarvisProgramTickRuntimeV1(taskReq, deps);
    ticksRun++;
    if (!lastTick.ok) {
      return { ok: false, stage: 'PROGRAM_CONTROLLER_ERROR', astra_pre: pre, tick: lastTick, program_tick_run: true, claude_mission_dispatched: false };
    }
    const action = lastTick.performed?.action;
    if (action === 'AUTHORIZE_AND_RESUME') {
      resumeDetail = lastTick.performed.detail;
      break;
    }
    if (action === 'NONE') {
      // Nothing more this tick can do right now (e.g. DISPATCH_NOT_COVERED,
      // or a genuine wait state) — surface it, never loop forever.
      return {
        ok: false, stage: 'PROGRAM_CONTROLLER_BLOCKED', astra_pre: pre, tick: lastTick,
        blocked_reason: lastTick.performed.detail, program_tick_run: true, claude_mission_dispatched: false
      };
    }
    // PREPARE_BRANCH / PROPOSE_WAVE_TASK / RESUME — keep ticking.
  }

  if (!resumeDetail) {
    return {
      ok: false, stage: 'PROGRAM_CONTROLLER_NO_DISPATCH_REACHED', astra_pre: pre, tick: lastTick,
      program_tick_run: true, claude_mission_dispatched: false, ticks_run: ticksRun
    };
  }

  const claudeExecution = resumeDetail.claude_execution || resumeDetail;
  const evidence = claudeExecution?.evidence?.verification ?? claudeExecution?.verification ?? null;
  const exitCode = claudeExecution?.exit_code ?? claudeExecution?.evidence?.exit_code ?? null;
  const externalEffect = claudeExecution?.external_effect ?? claudeExecution?.evidence?.external_effect ?? false;

  const post = reviewJarvisAstraPostV1({
    acceptance_criteria: pre.acceptance_criteria,
    safety_boundary: pre.safety_boundary,
    exit_code: exitCode,
    external_effect: externalEffect,
    verification: evidence
  });

  // The Program Controller action that WOULD run next if a human approves
  // this POST decision — computed from the same fixed action vocabulary
  // program-controller-v1.js already uses, but never executed here.
  const requestId = resumeDetail.request_id || lastTick.performed?.detail?.request_id || null;
  const wouldRunNext = post.decision === 'PASS'
    ? { action: 'VERIFY_AND_ACCEPT', request_id: requestId }
    : post.decision === 'REPAIR'
      ? { action: 'ANALYZE_FOR_REPAIR', request_id: requestId }
      : { action: 'BLOCKED_OPERATOR', reason: post.reason };

  return {
    ok: true,
    stage: 'ASTRA_POST_SUPERVISED_STOP',
    astra_pre: pre,
    dispatch_tick: lastTick,
    astra_post: post,
    would_run_next: wouldRunNext,
    accepted: false, // NEVER true from this function — acceptance is a separate, later, explicit step
    program_tick_run: true,
    claude_mission_dispatched: true,
    ticks_run: ticksRun
  };
}

export function jarvisAstraSupervisedMissionManifestV1() {
  return {
    schema: 'aurentara.jarvis.astra-supervised-mission.v1',
    calls_acceptance_itself: false,
    reaches_verify_and_accept_itself: false,
    second_dispatch_path: false,
    reuses_program_controller_tick: true,
    production_deploy: false,
    hamyren_data_flow: false
  };
}
