import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { ensureJarvisOwnerWorkspaceGitIndexAccessV1 } from '../src/jarvis/owner-workspace-git-index-access-v1.js';

const repo = '/home/jarvis/claude-worker/workspace/aurentara-real-lifecycle-v1';
const git = (args) => execFileSync('git', ['-c', `safe.directory=${repo}`, ...args], {
  cwd: repo, stdio: ['ignore','pipe','pipe'], timeout: 20000
}).toString('utf8').trim();

const result = ensureJarvisOwnerWorkspaceGitIndexAccessV1({
  repo_dir: repo,
  worker_gid: 11000,
  recover_failed_candidate: null,
  quarantine_unrelated_dirty: true,
  quarantine_stale_failed_project_scope: true
});
console.log('UID=' + (typeof process.getuid === 'function' ? process.getuid() : 'na'));
console.log('GIDS=' + (typeof process.getgroups === 'function' ? process.getgroups().join(',') : 'na'));
console.log('RECOVERY=' + JSON.stringify(result));
assert.equal(result.ok, true, result.error || 'workspace recovery failed');
const status = git(['status','--porcelain=v1','--untracked-files=all']);
assert.equal(status, '', 'AURENTARA workspace must be clean after recovery');
const exclude = fs.readFileSync(repo + '/.git/info/exclude','utf8');
assert.equal(exclude.includes('/projects/gelato-donatello-website-v5/'), false);
assert.equal(exclude.includes('/projects/gelato-donatello-premium-v5/'), false);
console.log('AURENTARA_WORKSPACE_RECOVERY_V1=PASS');
