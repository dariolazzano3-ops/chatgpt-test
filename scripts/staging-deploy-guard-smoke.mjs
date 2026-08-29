import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

const run = (mode, env = {}) => spawnSync(process.execPath, ['scripts/staging-deploy-guard.mjs', mode], {
  cwd: new URL('..', import.meta.url),
  env: { ...process.env, ...env },
  encoding: 'utf8'
});

const dryRun = run('--dry-run');
assert.equal(dryRun.status, 0, dryRun.stderr || dryRun.stdout);
const dryRunResult = JSON.parse(dryRun.stdout);
assert.equal(dryRunResult.worker, 'riosystems-staging');
assert.equal(dryRunResult.production_deploy, false);
assert.equal(dryRunResult.external_writes, false);

const unapproved = run('--deploy');
assert.notEqual(unapproved.status, 0);
assert.equal(JSON.parse(unapproved.stdout).blockers.includes('STAGING_DEPLOY_APPROVAL_REQUIRED'), true);
assert.equal(JSON.parse(unapproved.stdout).blockers.includes('ZERO_COST_CONFIRMATION_REQUIRED'), true);

const approved = run('--deploy', {
  RIOSYSTEMS_STAGING_DEPLOY_APPROVED: 'true',
  RIOSYSTEMS_ZERO_COST_CONFIRMED: 'true',
  RIOSYSTEMS_STAGING_CONFIRMATION: 'DEPLOY_RIOSYSTEMS_STAGING_ZERO_COST'
});
assert.equal(approved.status, 0, approved.stderr || approved.stdout);

const production = run('--production');
assert.notEqual(production.status, 0);
assert.equal(JSON.parse(production.stdout).blockers.includes('PRODUCTION_DEPLOY_COMMAND_DISABLED'), true);

console.log(JSON.stringify({
  ok: true,
  suite: 'staging-deploy-guard',
  staging_worker: 'riosystems-staging',
  approval_required: true,
  zero_cost_confirmation_required: true,
  production_deploy: false
}, null, 2));
