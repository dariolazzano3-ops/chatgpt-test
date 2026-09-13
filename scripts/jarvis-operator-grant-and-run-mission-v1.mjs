#!/usr/bin/env node
/* JARVIS — operator-invoked: grant Program Approval, read state, and
   (optionally) run one Astra-gated supervised mission — for real, against
   whatever real memory store / Bridge the process environment resolves to.

   Node-only, meant to be invoked with the SAME environment
   jarvis-remote-operator.service itself uses (sourced from
   /etc/jarvis/remote-operator.env) and, since the shared repo is only
   visible through a service-scoped bind mount, from WITHIN that service's
   own mount namespace (see the accompanying root wrapper). This file
   itself reads no secret file directly — it only reads process.env,
   exactly like remote-operator-server-v1.js does, and only ever prints
   the non-secret, already-designed-to-be-printable return values of
   existing trusted V2 functions (program-approval-v1.js,
   program-controller-v1.js, astra-supervised-mission-v1.js). It never
   prints process.env itself.

   Usage:
     node scripts/jarvis-operator-grant-and-run-mission-v1.mjs grant
     node scripts/jarvis-operator-grant-and-run-mission-v1.mjs state
     node scripts/jarvis-operator-grant-and-run-mission-v1.mjs mission \
       --title "..." --request "..." */

import { resolveJarvisMemoryStoreV1 } from '../src/jarvis/http-v1.js';
import { createJarvisSessionV1 } from '../src/jarvis/session-v1.js';
import { handleJarvisProgramApprovalGrantRuntimeV1 } from '../src/jarvis/program-approval-v1.js';
import { handleJarvisProgramStateRuntimeV1 } from '../src/jarvis/program-controller-v1.js';
import { createJarvisBridgeHttpRuntimeBindingV1 } from '../src/jarvis/claude-code-bridge-http-runtime-binding-v1.js';
import { runJarvisAstraSupervisedMissionV1 } from '../src/jarvis/astra-supervised-mission-v1.js';

const PROGRAM = 'JARVIS_MASTERARCHITECTURE_V2';
const REPO_DIR = process.env.JARVIS_CLAUDE_REPO_DIR || '';
const TARGET_BRANCH = 'factory/jarvis-masterarchitecture-v2';
const GRANT_SCOPE = [
  'REPO_INTERNAL_READ', 'REPO_INTERNAL_WRITE', 'REPO_INTERNAL_TEST',
  'LOCAL_FEATURE_BRANCH_MANAGEMENT', 'CLAUDE_REPO_BOUND_EXECUTION',
  'INDEPENDENT_VERIFICATION', 'REPAIR_RETRY', 'ACCEPTANCE',
  'PROGRESS_ADVANCEMENT', 'NEXT_WAVE_CONTINUATION'
];

function fail(message) {
  console.error(JSON.stringify({ ok: false, error: message }, null, 2));
  process.exit(1);
}

async function realSession() {
  const email = process.env.JARVIS_OPERATOR_EMAIL;
  if (!email) fail('JARVIS_OPERATOR_EMAIL_REQUIRED');
  const session = await createJarvisSessionV1(
    { ok: true, email },
    { canonical_owner_email: process.env.JARVIS_CANONICAL_OWNER_EMAIL }
  );
  if (!session.ok) fail('SESSION_CONSTRUCTION_FAILED:' + session.error);
  return session;
}

function realStore() {
  const store = resolveJarvisMemoryStoreV1(process.env, {});
  if (!store || store.durable !== true) fail('DURABLE_MEMORY_STORE_REQUIRED');
  return store;
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--title') out.title = argv[++i];
    else if (argv[i] === '--request') out.request = argv[++i];
  }
  return out;
}

const command = process.argv[2];
const session = await realSession();
const store = realStore();

if (!REPO_DIR) fail('JARVIS_CLAUDE_REPO_DIR_NOT_SET');

if (command === 'grant') {
  const result = await handleJarvisProgramApprovalGrantRuntimeV1({
    owner_id: session.owner_id, owner_ref: session.owner_ref,
    program: PROGRAM, repo_dir: REPO_DIR, target_branch: TARGET_BRANCH,
    scope: GRANT_SCOPE, confirm_scope: true
  }, { memory_store: store });
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.ok ? 0 : 1);
}

if (command === 'state') {
  const result = await handleJarvisProgramStateRuntimeV1({
    owner_id: session.owner_id, owner_ref: session.owner_ref,
    program: PROGRAM, repo_dir: REPO_DIR, target_branch: TARGET_BRANCH
  }, { memory_store: store });
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.ok ? 0 : 1);
}

if (command === 'mission') {
  const { title, request } = parseArgs(process.argv.slice(3));
  if (!title || !request) fail('MISSION_TITLE_AND_REQUEST_REQUIRED');

  const binding = await createJarvisBridgeHttpRuntimeBindingV1(process.env, {});
  if (!binding.bound) fail('BRIDGE_NOT_BOUND:' + binding.reason);

  const result = await runJarvisAstraSupervisedMissionV1({
    owner_id: session.owner_id, owner_ref: session.owner_ref,
    program: PROGRAM, repo_dir: REPO_DIR, target_branch: TARGET_BRANCH,
    title, request_text: request
  }, { memory_store: store, claude_bridge: binding.bridge });
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.ok ? 0 : 1);
}

fail('UNKNOWN_COMMAND — use one of: grant, state, mission');
