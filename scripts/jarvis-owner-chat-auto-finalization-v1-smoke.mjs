import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

import { createMemoryJarvisStoreV1 } from '../src/jarvis/memory-store-memory-v1.js';
import { createJarvisAcceptedWorkPublisherV1 } from '../src/jarvis/accepted-work-publisher-v1.js';
import {
  dispatchJarvisOwnerChatJobV1,
  runJarvisOwnerChatJobV1,
  jarvisOwnerChatJobManifestV1
} from '../src/jarvis/owner-chat-job-v1.js';
import {
  createJarvisClaudeCodeBridgeV1,
  createLocalFixtureExecutorV1
} from '../src/jarvis/claude-code-bridge-v1.js';
import { jarvisRemoteOperatorManifestV1 } from '../src/jarvis/remote-operator-server-v1.js';

const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const OWNER_REF = 'jarvis:operator:auto-finalization-smoke@example.invalid';
const BRANCH = 'factory/jarvis-owner-chat-auto-finalization-smoke';

function git(cwd, args) {
  return execFileSync('git', args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] }).toString('utf8').trim();
}

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-owner-chat-finalize-'));
const repo = path.join(root, 'repo');
const bare = path.join(root, 'github.git');
fs.mkdirSync(repo, { recursive: true });
execFileSync('git', ['init', '--bare', bare], { stdio: 'ignore' });
execFileSync('git', ['init', repo], { stdio: 'ignore' });
git(repo, ['config', 'user.name', 'Smoke']);
git(repo, ['config', 'user.email', 'smoke@example.invalid']);
fs.writeFileSync(path.join(repo, 'README.md'), 'baseline\n');
git(repo, ['add', 'README.md']);
git(repo, ['commit', '-m', 'baseline']);
git(repo, ['switch', '-c', BRANCH]);
git(repo, ['remote', 'add', 'github', bare]);

fs.mkdirSync(path.join(repo, 'src'), { recursive: true });
fs.writeFileSync(path.join(repo, 'src', 'change.js'), 'export const changed = true;\n');

const verification = {
  schema: 'aurentara.jarvis.repo-bound-verification.v1',
  repo_dir: repo,
  branch: BRANCH,
  branch_drift: false,
  files_changed: ['src/change.js'],
  pre_existing_dirty_files: [],
  syntax_check: {
    passed: true,
    checked: 1,
    results: [{ file: 'src/change.js', passed: true }]
  },
  at: '2026-09-23T15:00:00.000Z'
};

const store = createMemoryJarvisStoreV1();
const publisher = createJarvisAcceptedWorkPublisherV1({
  owner_chat_push_enabled: true,
  owner_chat_push_remote: 'github'
}, {
  memory_store: store,
  now: () => '2026-09-23T15:00:01.000Z'
});

const requestId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const published = await publisher.publishVerifiedOwnerChatJob({
  owner_id: OWNER_ID,
  owner_ref: OWNER_REF,
  request_id: requestId,
  title: 'Auto-finalization smoke',
  repo_dir: repo,
  target_branch: BRANCH,
  verification
});

assert.equal(published.ok, true);
assert.equal(published.push, true);
assert.equal(published.push_remote, 'github');
assert.equal(published.merge, false);
assert.equal(published.deploy, false);
assert.equal(git(repo, ['status', '--porcelain']), '');
assert.equal(git(repo, ['rev-parse', 'HEAD']), published.commit);
assert.equal(git(bare, ['rev-parse', `refs/heads/${BRANCH}`]), published.commit);
assert.match(git(repo, ['log', '-1', '--format=%B']), new RegExp(requestId));

const retry = await publisher.publishVerifiedOwnerChatJob({
  owner_id: OWNER_ID,
  owner_ref: OWNER_REF,
  request_id: requestId,
  title: 'Auto-finalization smoke',
  repo_dir: repo,
  target_branch: BRANCH,
  verification
});
assert.equal(retry.ok, true);
assert.equal(retry.commit, published.commit);
assert.equal(retry.push, true);

const protectedRefusal = await publisher.publishVerifiedOwnerChatJob({
  owner_id: OWNER_ID,
  owner_ref: OWNER_REF,
  request_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  title: 'Protected branch refusal',
  repo_dir: repo,
  target_branch: 'main',
  verification: { ...verification, branch: 'main' }
});
assert.equal(protectedRefusal.ok, false);
assert.equal(protectedRefusal.error, 'OWNER_CHAT_PUBLISHER_BRANCH_NOT_ALLOWED');

const ownerStore = createMemoryJarvisStoreV1();
const dispatch = await dispatchJarvisOwnerChatJobV1({
  owner_id: OWNER_ID,
  owner_ref: OWNER_REF,
  message: 'Implementiere MARKER-AUTO-FINALIZE: kleinen internen Bugfix.',
  now: '2026-09-23T15:10:00.000Z'
}, { memory_store: ownerStore });
assert.equal(dispatch.ok, true);

const bridge = createJarvisClaudeCodeBridgeV1({
  executor: createLocalFixtureExecutorV1({
    'MARKER-AUTO-FINALIZE': {
      exit_code: 0,
      stdout: 'fixture complete',
      verification: {
        schema: 'aurentara.jarvis.repo-bound-verification.v1',
        repo_dir: '/workspace/projects/auto-finalize-smoke',
        branch: 'factory/auto-finalize-smoke',
        branch_drift: false,
        files_changed: ['src/example.js'],
        pre_existing_dirty_files: [],
        syntax_check: {
          passed: true,
          checked: 1,
          results: [{ file: 'src/example.js', passed: true }]
        },
        at: '2026-09-23T15:10:01.000Z'
      }
    }
  })
});

let publisherCalls = 0;
const trustedPublisher = {
  async publishVerifiedOwnerChatJob(input) {
    publisherCalls += 1;
    assert.equal(input.request_id, dispatch.request_id);
    assert.equal(input.verification.schema, 'aurentara.jarvis.repo-bound-verification.v1');
    assert.equal(input.target_branch, 'factory/auto-finalize-smoke');
    return {
      ok: true,
      commit: 'cccccccccccccccccccccccccccccccccccccccc',
      push: true,
      push_remote: 'github',
      merge: false,
      deploy: false
    };
  }
};

const jobResult = await runJarvisOwnerChatJobV1(dispatch.job, {
  memory_store: ownerStore,
  claude_bridge: bridge,
  trusted_publisher: trustedPublisher
});
assert.equal(jobResult.ok, true);
assert.equal(jobResult.status, 'COMPLETE');
assert.equal(publisherCalls, 1);
assert.equal(jobResult.finalization.push, true);
assert.equal(jobResult.finalization.push_remote, 'github');

const auditRows = await ownerStore.readAudit({ owner_id: OWNER_ID, owner_ref: OWNER_REF, limit: 100 });
const notification = auditRows.find((row) =>
  row.request_id === dispatch.request_id &&
  row.intent?.intent_type === 'OWNER_CHAT_JOB_NOTIFICATION'
);
assert.ok(notification);
assert.equal(notification.result.finalization.push, true);

const failingStore = createMemoryJarvisStoreV1();
const failingDispatch = await dispatchJarvisOwnerChatJobV1({
  owner_id: OWNER_ID,
  owner_ref: OWNER_REF,
  message: 'Implementiere MARKER-AUTO-FINALIZE: zweiten internen Bugfix.',
  now: '2026-09-23T15:20:00.000Z'
}, { memory_store: failingStore });

const failedFinalization = await runJarvisOwnerChatJobV1(failingDispatch.job, {
  memory_store: failingStore,
  claude_bridge: bridge,
  trusted_publisher: {
    async publishVerifiedOwnerChatJob() {
      return { ok: false, error: 'OWNER_CHAT_PUBLISHER_PUSH_FAILED' };
    }
  }
});
assert.equal(failedFinalization.ok, false);
assert.equal(failedFinalization.status, 'FAILED');
assert.equal(failedFinalization.reason, 'OWNER_CHAT_PUBLISHER_PUSH_FAILED');

const ownerManifest = jarvisOwnerChatJobManifestV1();
assert.equal(ownerManifest.trusted_publication_after_system_verification_supported, true);
assert.equal(ownerManifest.trusted_publication_skipped_for_read_only_jobs, true);

const remoteManifest = jarvisRemoteOperatorManifestV1();
assert.equal(remoteManifest.owner_chat_auto_finalize_default, true);
assert.equal(remoteManifest.owner_chat_auto_commit_after_system_verification, true);
assert.equal(remoteManifest.owner_chat_auto_push_remote, 'github');
assert.equal(remoteManifest.owner_chat_force_push, false);
assert.equal(remoteManifest.production_deploy, false);
assert.equal(remoteManifest.public_access, false);

console.log('JARVIS Owner Chat Auto Finalization V1 smoke: PASS');
