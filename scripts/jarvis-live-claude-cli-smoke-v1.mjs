/* JARVIS — ONE controlled, genuine Claude Code CLI execution smoke test.

   Operator-authorized, one-off. Runs a single bounded task through the real,
   already-authenticated local `claude` CLI, inside a disposable /tmp
   workspace, via the Claude Code execution bridge
   (src/jarvis/claude-code-bridge-v1.js) bound to the opt-in local CLI
   executor (src/jarvis/claude-code-local-cli-executor-v1.js).

   This script:
     - never touches repo files (cwd for the nested session is a fresh
       os.tmpdir() directory, outside the git working tree);
     - never deploys, merges, or writes external effects;
     - independently verifies the outcome by reading the fixture file back
       from disk itself — the nested session's self-report is never treated
       as acceptance;
     - deletes the disposable workspace when done;
     - prints one JSON evidence record and exits 0 only on genuine,
       independently-verified success. */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { createJarvisClaudeCodeBridgeV1 } from '../src/jarvis/claude-code-bridge-v1.js';
import { createLocalClaudeCodeCliExecutorV1 } from '../src/jarvis/claude-code-local-cli-executor-v1.js';

const FIXTURE_NAME = 'smoke.txt';
const EXPECTED_CONTENT = 'JARVIS_LIVE_SMOKE_V1_OK';
const correlationId = crypto.randomUUID();

const workspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-live-smoke-'));

const result = { schema: 'aurentara.jarvis.live-claude-cli-smoke.v1', correlation_id: correlationId, workspace_dir: workspaceDir };

try {
  const executor = createLocalClaudeCodeCliExecutorV1({ workspace_dir: workspaceDir, max_budget_usd: 0.25 });
  const bridge = createJarvisClaudeCodeBridgeV1({ executor, timeout_ms: 90000 });

  const task = [
    `Using only the Write tool, create exactly one file named ${FIXTURE_NAME} in the current directory.`,
    `Its entire content must be exactly this one line, nothing else: ${EXPECTED_CONTENT}`,
    'Do not create, read, or modify any other file. Do not use any tool other than Write/Read. Then stop.'
  ].join(' ');

  const handle = bridge.submit({
    correlation_id: correlationId,
    request_id: correlationId,
    owner_ref: 'jarvis:operator:local-live-smoke',
    workspace: '/workspace/projects/jarvis-live-smoke-v1',
    task,
    timeout_ms: 90000
  });

  const bridgeRecord = await handle.result;
  result.bridge_state = bridgeRecord.state;
  result.bridge_exit_code = bridgeRecord.exit_code;
  result.bridge_duration_ms = bridgeRecord.duration_ms;
  result.bridge_external_effect = bridgeRecord.external_effect;
  result.bridge_independent_acceptance = bridgeRecord.independent_acceptance;
  result.evidence = bridgeRecord.evidence;
  result.stderr_tail = String(bridgeRecord.stderr || '').slice(-2000);

  // ── independent verification: read the fixture back from disk ourselves.
  //    The bridge/worker's own exit code and stdout are NEVER trusted alone. ──
  const fixturePath = path.join(workspaceDir, FIXTURE_NAME);
  let actualContent = null;
  let verified = false;
  try {
    actualContent = fs.readFileSync(fixturePath, 'utf8').trim();
    verified = actualContent === EXPECTED_CONTENT;
  } catch (error) {
    result.independent_verification_error = String(error?.message || error);
  }

  // Did the nested session create anything other than the one expected file?
  const entries = fs.readdirSync(workspaceDir);
  const onlyExpectedFile = entries.length === 1 && entries[0] === FIXTURE_NAME;

  result.independent_verification = {
    fixture_path: fixturePath,
    fixture_found: actualContent !== null,
    fixture_content_matches: verified,
    only_expected_file_present: onlyExpectedFile,
    workspace_entries: entries
  };

  const genuineSuccess = bridgeRecord.state === 'COMPLETE' && verified && onlyExpectedFile;
  result.genuine_success = genuineSuccess;
  result.bridge_self_reported_acceptance_ignored = true;

  console.log(JSON.stringify(result, null, 2));
  process.exitCode = genuineSuccess ? 0 : 1;
} finally {
  // Disposable workspace cleanup — scoped to this exact mkdtemp() dir only.
  try { fs.rmSync(workspaceDir, { recursive: true, force: true }); } catch {}
}
