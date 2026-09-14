/* JARVIS Legacy Bridge HTTP evidence reverification V1 — targeted smoke.

   CI-safe: real throwaway temp git repos, real `git diff`/`node --check`
   — no live Bridge/Claude/network call. Proves the narrow compatibility
   bridge for a mission dispatched before commit 5d5569844a: exact-scope
   match, content-diff match when available, mandatory syntax check, and
   that it never touches or weakens the canonical evidence path. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  isLegacyBridgeHttpEvidenceV1,
  reverifyLegacyBridgeHttpEvidenceV1,
  jarvisLegacyBridgeEvidenceReverificationManifestV1
} from '../src/jarvis/legacy-bridge-evidence-reverification-v1.js';
import {
  handleJarvisEngineeringMissionAcceptanceRuntimeV1,
  jarvisEngineeringMissionAcceptanceManifestV1
} from '../src/jarvis/engineering-mission-acceptance-v1.js';
import { createJarvisAuditEventV1 } from '../src/jarvis/audit-v1.js';
import { createMemoryJarvisStoreV1 } from '../src/jarvis/memory-store-memory-v1.js';
import { JARVIS_ENGINEERING_MISSION_ACTION, JARVIS_ENGINEERING_MISSION_INTENT, JARVIS_ENGINEERING_MISSION_DOMAIN } from '../src/jarvis/engineering-mission-v1.js';

const OWNER_ID = '99999999-8888-4777-8666-555555555555';
const OWNER_REF = 'jarvis:operator:legacy-reverify-smoke@example.invalid';
const BRANCH = 'factory/legacy-reverify-smoke';

let passed = 0;
async function check(name, fn) {
  await fn();
  passed++;
  console.log(`ok - ${name}`);
}

function git(dir, args) { return execFileSync('git', args, { cwd: dir, stdio: ['ignore', 'pipe', 'pipe'] }).toString('utf8'); }
function makeFixtureRepoV1() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-legacy-reverify-fixture-'));
  git(dir, ['init', '-q']);
  git(dir, ['symbolic-ref', 'HEAD', `refs/heads/${BRANCH}`]);
  git(dir, ['config', 'user.email', 'fixture@example.invalid']);
  git(dir, ['config', 'user.name', 'Fixture']);
  fs.writeFileSync(path.join(dir, 'target.js'), 'module.exports = () => 1;\n');
  git(dir, ['add', '.']);
  git(dir, ['commit', '-q', '-m', 'init']);
  return dir;
}

/** Simulates a completed legacy Bridge mission: edits target.js to valid
 *  new content, captures the real diff + claimed file list exactly as a
 *  legacy Bridge response might have reported them. Returns the legacy
 *  verification object and the repo dir. */
function simulateLegacyMissionV1(repo, newContent) {
  fs.writeFileSync(path.join(repo, 'target.js'), newContent);
  const diff = git(repo, ['diff', '--', 'target.js']).trim();
  const claimedFiles = git(repo, ['status', '--porcelain']).split('\n').map((l) => l.slice(3).trim()).filter(Boolean);
  return {
    schema: 'aurentara.jarvis.bridge-http-verification.v1',
    bridge_service: 'jarvis-claude-bridge', bridge_version: 4, mode: 'implement', project: 'chatgpt-test',
    git_evidence: { files_changed: [...claimedFiles], diff },
    filesystem_evidence: { files_changed: [...claimedFiles] },
    tool_audit: [{ tool: 'Edit', path: 'target.js' }],
    at: new Date().toISOString()
  };
}

/** The REAL, observed df92-style nested shape: two committed files
 *  ('a.js', 'b.js', standing in for the real mission's
 *  src/jarvis/program-controller-v1.js /
 *  scripts/jarvis-program-controller-v1-smoke.mjs), edited via
 *  `newContentA`/`newContentB`, with tracked_name_status/diff captured
 *  from real `git diff --name-status` / `git diff` — exactly the fields
 *  the real persisted evidence carries. */
function makeDf92FixtureRepoV1() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-df92-fixture-'));
  git(dir, ['init', '-q']);
  git(dir, ['symbolic-ref', 'HEAD', `refs/heads/${BRANCH}`]);
  git(dir, ['config', 'user.email', 'fixture@example.invalid']);
  git(dir, ['config', 'user.name', 'Fixture']);
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'scripts'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'src', 'a.js'), 'module.exports = () => 1;\n');
  fs.writeFileSync(path.join(dir, 'scripts', 'b.mjs'), 'export default () => 1;\n');
  git(dir, ['add', '.']);
  git(dir, ['commit', '-q', '-m', 'init']);
  return dir;
}
function simulateDf92MissionV1(repo, newContentA, newContentB) {
  fs.writeFileSync(path.join(repo, 'src', 'a.js'), newContentA);
  fs.writeFileSync(path.join(repo, 'scripts', 'b.mjs'), newContentB);
  const trackedNameStatus = git(repo, ['diff', '--name-status', '--', 'src/a.js', 'scripts/b.mjs']).trim().split('\n').filter(Boolean);
  const diff = git(repo, ['diff', '--', 'src/a.js', 'scripts/b.mjs']).trim();
  const changed = trackedNameStatus.map((line) => line.split('\t')[1]);
  return {
    schema: 'aurentara.jarvis.bridge-http-verification.v1',
    bridge_service: 'jarvis-claude-bridge', bridge_version: 4, mode: 'implement', project: 'chatgpt-test',
    git_evidence: {
      pre: { head: 'abc' }, post: { head: 'abc' }, head_unchanged: true,
      changes: { tracked_name_status: trackedNameStatus, untracked_files: [], diff_stat: `${changed.length} files changed`, diff }
    },
    filesystem_evidence: { changed },
    tool_audit: [{ tool: 'Edit', path: 'src/a.js' }, { tool: 'Edit', path: 'scripts/b.mjs' }],
    at: new Date().toISOString()
  };
}

// ── real df92 nested shape ──
await check('df92: nested tracked_name_status + untracked_files + nested diff + filesystem_evidence.changed => parsed and accepted', () => {
  const repo = makeDf92FixtureRepoV1();
  try {
    const legacy = simulateDf92MissionV1(repo, 'module.exports = () => 2;\n', 'export default () => 2;\n');
    const result = reverifyLegacyBridgeHttpEvidenceV1({ verification: legacy, repo_dir: repo, target_branch: BRANCH });
    assert.equal(result.sufficient, true, JSON.stringify(result));
    assert.deepEqual(result.verification.files_changed.sort(), ['scripts/b.mjs', 'src/a.js']);
    assert.equal(result.verification.syntax_check.passed, true);
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
  }
});

await check('df92: exact current two-file dirty set matches the nested claim exactly', () => {
  const repo = makeDf92FixtureRepoV1();
  try {
    const legacy = simulateDf92MissionV1(repo, 'module.exports = () => 2;\n', 'export default () => 2;\n');
    const dirty = git(repo, ['status', '--porcelain']).split('\n').map((l) => l.slice(3).trim()).filter(Boolean).sort();
    assert.deepEqual(dirty, ['scripts/b.mjs', 'src/a.js']);
    const result = reverifyLegacyBridgeHttpEvidenceV1({ verification: legacy, repo_dir: repo, target_branch: BRANCH });
    assert.equal(result.sufficient, true);
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
  }
});

await check('df92: nested changes.diff is enforced content-level — a further edit to one claimed file after capture is rejected', () => {
  const repo = makeDf92FixtureRepoV1();
  try {
    const legacy = simulateDf92MissionV1(repo, 'module.exports = () => 2;\n', 'export default () => 2;\n');
    fs.writeFileSync(path.join(repo, 'src', 'a.js'), 'module.exports = () => 999;\n'); // altered after capture
    const result = reverifyLegacyBridgeHttpEvidenceV1({ verification: legacy, repo_dir: repo, target_branch: BRANCH });
    assert.equal(result.sufficient, false);
    assert.equal(result.reason, 'LEGACY_REVERIFY_DIFF_MISMATCH');
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
  }
});

await check('df92: an extra dirty file beyond the two claimed is rejected', () => {
  const repo = makeDf92FixtureRepoV1();
  try {
    const legacy = simulateDf92MissionV1(repo, 'module.exports = () => 2;\n', 'export default () => 2;\n');
    fs.writeFileSync(path.join(repo, 'src', 'extra.js'), 'module.exports = () => 3;\n');
    const result = reverifyLegacyBridgeHttpEvidenceV1({ verification: legacy, repo_dir: repo, target_branch: BRANCH });
    assert.equal(result.sufficient, false);
    assert.equal(result.reason, 'LEGACY_REVERIFY_UNEXPECTED_DIRTY_FILES');
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
  }
});

await check('df92: a genuinely broken claimed file still fails syntax check, never bypassed', () => {
  const repo = makeDf92FixtureRepoV1();
  try {
    const legacy = simulateDf92MissionV1(repo, 'module.exports = ( => {\n', 'export default () => 2;\n');
    const result = reverifyLegacyBridgeHttpEvidenceV1({ verification: legacy, repo_dir: repo, target_branch: BRANCH });
    assert.equal(result.sufficient, false);
    assert.equal(result.reason, 'LEGACY_REVERIFY_SYNTAX_CHECK_FAILED');
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
  }
});

await check('df92: a rename/copy name-status record (3 columns) fails the whole extraction closed, never guessed', () => {
  const repo = makeDf92FixtureRepoV1();
  try {
    const legacy = simulateDf92MissionV1(repo, 'module.exports = () => 2;\n', 'export default () => 2;\n');
    legacy.git_evidence.changes.tracked_name_status = ['R100\tsrc/a.js\tsrc/a-renamed.js', 'M\tscripts/b.mjs'];
    const result = reverifyLegacyBridgeHttpEvidenceV1({ verification: legacy, repo_dir: repo, target_branch: BRANCH });
    assert.equal(result.sufficient, false);
    assert.equal(result.reason, 'LEGACY_REVERIFY_AMBIGUOUS_CHANGED_FILE_EVIDENCE');
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
  }
});

await check('df92: a malformed name-status entry (wrong column count / unrecognized status) fails closed', () => {
  const repo = makeDf92FixtureRepoV1();
  try {
    const legacy = simulateDf92MissionV1(repo, 'module.exports = () => 2;\n', 'export default () => 2;\n');
    legacy.git_evidence.changes.tracked_name_status = ['src/a.js', 'M\tscripts/b.mjs']; // first entry missing status/tab
    const badStatus = reverifyLegacyBridgeHttpEvidenceV1({ verification: legacy, repo_dir: repo, target_branch: BRANCH });
    assert.equal(badStatus.sufficient, false);
    assert.equal(badStatus.reason, 'LEGACY_REVERIFY_AMBIGUOUS_CHANGED_FILE_EVIDENCE');

    const legacy2 = simulateDf92MissionV1(repo, 'module.exports = () => 2;\n', 'export default () => 2;\n');
    legacy2.git_evidence.changes.tracked_name_status = ['X\tsrc/a.js', 'M\tscripts/b.mjs']; // unrecognized status letter
    const badLetter = reverifyLegacyBridgeHttpEvidenceV1({ verification: legacy2, repo_dir: repo, target_branch: BRANCH });
    assert.equal(badLetter.sufficient, false);
    assert.equal(badLetter.reason, 'LEGACY_REVERIFY_AMBIGUOUS_CHANGED_FILE_EVIDENCE');
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
  }
});

await check('df92: git_evidence.changes vs filesystem_evidence.changed disagreement still fails closed', () => {
  const repo = makeDf92FixtureRepoV1();
  try {
    const legacy = simulateDf92MissionV1(repo, 'module.exports = () => 2;\n', 'export default () => 2;\n');
    legacy.filesystem_evidence.changed = ['src/a.js']; // drops scripts/b.mjs — disagrees with git_evidence
    const result = reverifyLegacyBridgeHttpEvidenceV1({ verification: legacy, repo_dir: repo, target_branch: BRANCH });
    assert.equal(result.sufficient, false);
    assert.equal(result.reason, 'LEGACY_REVERIFY_EVIDENCE_DISAGREEMENT');
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
  }
});

// ── 1. legacy evidence + exact matching real repo + valid syntax => sufficient ──
await check('1. exact matching legacy evidence, unaltered, valid syntax -> sufficient, canonical object produced', () => {
  const repo = makeFixtureRepoV1();
  try {
    const legacy = simulateLegacyMissionV1(repo, 'module.exports = () => 2;\n');
    const result = reverifyLegacyBridgeHttpEvidenceV1({ verification: legacy, repo_dir: repo, target_branch: BRANCH });
    assert.equal(result.sufficient, true, JSON.stringify(result));
    assert.equal(result.verification.schema, 'aurentara.jarvis.repo-bound-verification.v1');
    assert.equal(result.verification.branch, BRANCH);
    assert.equal(result.verification.branch_drift, false);
    assert.deepEqual(result.verification.files_changed, ['target.js']);
    assert.equal(result.verification.syntax_check.passed, true);
    assert.equal(result.verification.reverified_from_legacy_evidence, true);
    assert.deepEqual(result.verification.legacy_evidence.tool_audit, [{ tool: 'Edit', path: 'target.js' }]);
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
  }
});

// ── 2. altered file after Bridge run => rejected ──
await check('2. a claimed file further altered after the persisted diff was captured is rejected (content, not just path, is checked)', () => {
  const repo = makeFixtureRepoV1();
  try {
    const legacy = simulateLegacyMissionV1(repo, 'module.exports = () => 2;\n');
    // Someone edits the SAME file differently after Bridge's evidence was captured.
    fs.writeFileSync(path.join(repo, 'target.js'), 'module.exports = () => 999;\n');
    const result = reverifyLegacyBridgeHttpEvidenceV1({ verification: legacy, repo_dir: repo, target_branch: BRANCH });
    assert.equal(result.sufficient, false);
    assert.equal(result.reason, 'LEGACY_REVERIFY_DIFF_MISMATCH');
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
  }
});

// ── 3. extra dirty file => rejected ──
await check('3. an extra, unrelated dirty file not in the claimed evidence is rejected', () => {
  const repo = makeFixtureRepoV1();
  try {
    const legacy = simulateLegacyMissionV1(repo, 'module.exports = () => 2;\n');
    fs.writeFileSync(path.join(repo, 'unrelated.js'), 'module.exports = () => 3;\n');
    const result = reverifyLegacyBridgeHttpEvidenceV1({ verification: legacy, repo_dir: repo, target_branch: BRANCH });
    assert.equal(result.sufficient, false);
    assert.equal(result.reason, 'LEGACY_REVERIFY_UNEXPECTED_DIRTY_FILES');
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
  }
});

// ── 4. broken JS syntax => rejected ──
await check('4. syntax validation remains mandatory — a claimed file that is genuinely invalid JS is rejected, never bypassed', () => {
  const repo = makeFixtureRepoV1();
  try {
    const legacy = simulateLegacyMissionV1(repo, 'module.exports = ( => {\n'); // invalid JS, diff matches exactly what's on disk
    const result = reverifyLegacyBridgeHttpEvidenceV1({ verification: legacy, repo_dir: repo, target_branch: BRANCH });
    assert.equal(result.sufficient, false);
    assert.equal(result.reason, 'LEGACY_REVERIFY_SYNTAX_CHECK_FAILED');
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
  }
});

// ── 5. branch mismatch => rejected ──
await check('5. a target_branch that does not match the real current branch is rejected', () => {
  const repo = makeFixtureRepoV1();
  try {
    const legacy = simulateLegacyMissionV1(repo, 'module.exports = () => 2;\n');
    const result = reverifyLegacyBridgeHttpEvidenceV1({ verification: legacy, repo_dir: repo, target_branch: 'factory/some-other-branch' });
    assert.equal(result.sufficient, false);
    assert.equal(result.reason, 'LEGACY_REVERIFY_BRANCH_MISMATCH');
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
  }
});

// ── 6. canonical new evidence remains unchanged and accepted; this module never touches it ──
await check('6. this module is a no-op for canonical evidence — isLegacyBridgeHttpEvidenceV1 is false, reverify refuses to apply', () => {
  const canonical = {
    schema: 'aurentara.jarvis.repo-bound-verification.v1',
    repo_dir: '/whatever', branch: BRANCH, branch_drift: false,
    files_changed: ['a.js'], pre_existing_dirty_files: [], syntax_check: { passed: true, checked: 1, results: [] }, at: new Date().toISOString()
  };
  assert.equal(isLegacyBridgeHttpEvidenceV1(canonical), false);
  const result = reverifyLegacyBridgeHttpEvidenceV1({ verification: canonical, repo_dir: '/whatever', target_branch: BRANCH });
  assert.equal(result.sufficient, false);
  assert.equal(result.reason, 'LEGACY_REVERIFY_NOT_APPLICABLE', 'never reinterprets or weakens canonical evidence');
});

// ── 7. no worker self-report can satisfy verification (claimed files with no real backing repo change) ──
await check('7. a legacy evidence bundle claiming a change that never actually happened in the repo is rejected', () => {
  const repo = makeFixtureRepoV1();
  try {
    // Claims a file changed, but the repo is genuinely clean — a pure
    // self-report with no real, trusted-computed backing.
    const fabricated = {
      schema: 'aurentara.jarvis.bridge-http-verification.v1',
      git_evidence: { files_changed: ['target.js'] },
      filesystem_evidence: { files_changed: ['target.js'] },
      tool_audit: []
    };
    const result = reverifyLegacyBridgeHttpEvidenceV1({ verification: fabricated, repo_dir: repo, target_branch: BRANCH });
    assert.equal(result.sufficient, false);
    assert.equal(result.reason, 'LEGACY_REVERIFY_DIFF_MISMATCH', 'a claimed-but-not-real change is rejected, not trusted');
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
  }
});

// ── ambiguous / disagreeing evidence fails closed ──
await check('ambiguous or disagreeing git_evidence/filesystem_evidence fails closed, never guessed', () => {
  const noArrays = reverifyLegacyBridgeHttpEvidenceV1({
    verification: { schema: 'aurentara.jarvis.bridge-http-verification.v1', git_evidence: 'not-an-array-or-object-with-files', filesystem_evidence: null },
    repo_dir: '/whatever', target_branch: BRANCH
  });
  assert.equal(noArrays.sufficient, false);
  assert.equal(noArrays.reason, 'LEGACY_REVERIFY_AMBIGUOUS_CHANGED_FILE_EVIDENCE');

  const disagreeing = reverifyLegacyBridgeHttpEvidenceV1({
    verification: {
      schema: 'aurentara.jarvis.bridge-http-verification.v1',
      git_evidence: { files_changed: ['a.js'] },
      filesystem_evidence: { files_changed: ['b.js'] }
    },
    repo_dir: '/whatever', target_branch: BRANCH
  });
  assert.equal(disagreeing.sufficient, false);
  assert.equal(disagreeing.reason, 'LEGACY_REVERIFY_EVIDENCE_DISAGREEMENT');
});

// ── missing trusted repo scope is required, never optional/guessed ──
await check('missing trusted repo_dir/target_branch dependency refuses reverification outright', () => {
  const legacy = { schema: 'aurentara.jarvis.bridge-http-verification.v1', git_evidence: { files_changed: ['a.js'] }, filesystem_evidence: { files_changed: ['a.js'] } };
  assert.equal(reverifyLegacyBridgeHttpEvidenceV1({ verification: legacy }).reason, 'LEGACY_REVERIFY_TRUSTED_REPO_SCOPE_REQUIRED');
  assert.equal(reverifyLegacyBridgeHttpEvidenceV1({ verification: legacy, repo_dir: '/x' }).reason, 'LEGACY_REVERIFY_TRUSTED_REPO_SCOPE_REQUIRED');
});

// ══ integration: wired into handleJarvisEngineeringMissionAcceptanceRuntimeV1 ══

function missionAuditEventV1({ requestId, title, program, waveIndex }) {
  const e = createJarvisAuditEventV1({
    timestamp: '2026-09-14T00:00:00.000Z', owner_ref: OWNER_REF, request: title,
    intent: { intent_type: JARVIS_ENGINEERING_MISSION_INTENT, domain: JARVIS_ENGINEERING_MISSION_DOMAIN, action: JARVIS_ENGINEERING_MISSION_ACTION },
    tools_used: [], permissions: [], action: JARVIS_ENGINEERING_MISSION_ACTION,
    result: { status: 'QUEUED', title, goal: title, program, wave_index: waveIndex }
  });
  e.request_id = requestId;
  return e;
}
function dispatchAuditEventV1({ requestId, verification }) {
  const e = createJarvisAuditEventV1({
    timestamp: '2026-09-14T00:01:00.000Z', owner_ref: OWNER_REF, request: 'dispatch',
    intent: { intent_type: JARVIS_ENGINEERING_MISSION_INTENT, domain: JARVIS_ENGINEERING_MISSION_DOMAIN, action: JARVIS_ENGINEERING_MISSION_ACTION },
    tools_used: [], permissions: [], action: JARVIS_ENGINEERING_MISSION_ACTION,
    result: { claude_execution_state: 'COMPLETE', verification }
  });
  e.request_id = requestId;
  return e;
}

await check('integration: a legacy-shaped completed mission is accepted ONLY when a trusted repo_dir/target_branch dependency is supplied and genuinely reverifies', async () => {
  const repo = makeFixtureRepoV1();
  try {
    const legacy = simulateLegacyMissionV1(repo, 'module.exports = () => 2;\n');
    const requestId = '11111111-2222-4333-8444-555555555555';
    const store = createMemoryJarvisStoreV1();
    await store.appendAudit({ owner_id: OWNER_ID, owner_ref: OWNER_REF, event: missionAuditEventV1({ requestId, title: 'legacy mission', program: 'JARVIS_MASTERARCHITECTURE_V2', waveIndex: 4 }) });
    await store.appendAudit({ owner_id: OWNER_ID, owner_ref: OWNER_REF, event: dispatchAuditEventV1({ requestId, verification: legacy }) });

    // Without the trusted dependency: rejected, exactly like before this feature existed.
    const withoutDep = await handleJarvisEngineeringMissionAcceptanceRuntimeV1(
      { owner_id: OWNER_ID, owner_ref: OWNER_REF, request_id: requestId },
      { memory_store: store }
    );
    assert.equal(withoutDep.ok, false);
    assert.equal(withoutDep.error, 'JARVIS_ENGINEERING_MISSION_ACCEPTANCE_VERIFICATION_INSUFFICIENT');

    // With the trusted dependency, pointing at the real, still-matching repo: accepted.
    const withDep = await handleJarvisEngineeringMissionAcceptanceRuntimeV1(
      { owner_id: OWNER_ID, owner_ref: OWNER_REF, request_id: requestId },
      { memory_store: store, repo_dir: repo, target_branch: BRANCH }
    );
    assert.equal(withDep.ok, true, JSON.stringify(withDep));
    assert.equal(withDep.accepted, true);
    assert.deepEqual(withDep.verification_summary.files_changed, ['target.js']);
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
  }
});

await check('integration: canonical-shaped evidence is accepted exactly as before, unaffected by supplying repo_dir/target_branch', async () => {
  const requestId = '22222222-3333-4444-8555-666666666666';
  const store = createMemoryJarvisStoreV1();
  const canonicalVerification = {
    schema: 'aurentara.jarvis.repo-bound-verification.v1', repo_dir: '/anything', branch: BRANCH, branch_drift: false,
    files_changed: ['a.js'], pre_existing_dirty_files: [], syntax_check: { passed: true, checked: 1, results: [] }, at: new Date().toISOString()
  };
  await store.appendAudit({ owner_id: OWNER_ID, owner_ref: OWNER_REF, event: missionAuditEventV1({ requestId, title: 'canonical mission', program: 'JARVIS_MASTERARCHITECTURE_V2', waveIndex: 4 }) });
  await store.appendAudit({ owner_id: OWNER_ID, owner_ref: OWNER_REF, event: dispatchAuditEventV1({ requestId, verification: canonicalVerification }) });

  // repo_dir/target_branch supplied but IRRELEVANT here — the canonical
  // path never consults them, since verification_sufficient is already
  // true from the existing, unmodified pure check.
  const result = await handleJarvisEngineeringMissionAcceptanceRuntimeV1(
    { owner_id: OWNER_ID, owner_ref: OWNER_REF, request_id: requestId },
    { memory_store: store, repo_dir: '/some/nonexistent/path/never/checked', target_branch: 'irrelevant' }
  );
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.accepted, true);
});

// ── manifests are honest ──
await check('manifests are honest about scope and non-duplication', () => {
  const manifest = jarvisLegacyBridgeEvidenceReverificationManifestV1();
  assert.equal(manifest.applies_only_to_legacy_bridge_http_shape, true);
  assert.equal(manifest.canonical_path_untouched, true);
  assert.equal(manifest.trusts_worker_self_report, false);
  assert.equal(manifest.trusts_request_supplied_repo_scope, false);
  assert.equal(manifest.repo_scope_source, 'TRUSTED_DEPENDENCY_INJECTION_ONLY');

  const acceptanceManifest = jarvisEngineeringMissionAcceptanceManifestV1();
  assert.equal(acceptanceManifest.legacy_bridge_http_evidence_reverification_supported, true);
  assert.equal(acceptanceManifest.legacy_reverification_still_requires_syntax_check_pass, true);
});

console.log(JSON.stringify({
  schema: 'aurentara.jarvis.legacy-bridge-evidence-reverification.smoke.v1',
  passed,
  live_bridge_network_call: false,
  live_claude_cli_invoked: false,
  wave_accepted: false,
  progress_advanced: false
}, null, 2));
