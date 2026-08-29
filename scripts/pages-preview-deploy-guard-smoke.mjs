import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

function run(args = [], env = {}) {
  return spawnSync(process.execPath, ['scripts/pages-preview-deploy-guard.mjs', ...args], {
    cwd: process.cwd(),
    env: { ...process.env, ...env },
    encoding: 'utf8'
  });
}

assert.equal(run().status, 0, 'Validation must pass for the synthetic staging artifact');
assert.notEqual(run(['--deploy']).status, 0, 'Unapproved deployment must fail');
assert.notEqual(run(['--production']).status, 0, 'Production must fail');
assert.notEqual(run([], { RIOSYSTEMS_PAGES_PROJECT_SLUG: 'another-project' }).status, 0, 'Unapproved project must fail');

const approved = run(['--deploy'], {
  RIOSYSTEMS_STAGING_DEPLOY_APPROVED: 'true',
  RIOSYSTEMS_ZERO_COST_CONFIRMED: 'true',
  RIOSYSTEMS_PAGES_STAGING_CONFIRMATION: 'DEPLOY_BAKERY_MULLER_PAGES_PREVIEW_ZERO_COST'
});
assert.equal(approved.status, 0, approved.stderr);

const sharedWorkflow = readFileSync('.github/workflows/factory-preview.yml', 'utf8');
const bakeryWorkflow = readFileSync('.github/workflows/riosystems-bakery-pages-preview.yml', 'utf8');
assert.doesNotMatch(sharedWorkflow, /pages project create/, 'Preview workflow must never create a Pages project');
assert.match(sharedWorkflow, /RIOSYSTEMS_CLOUDFLARE_ZERO_COST_CONFIRMED/);
assert.match(sharedWorkflow, /test "\$SOURCE_BRANCH" != 'main'/);
assert.match(sharedWorkflow, /test "\$SOURCE_BRANCH" != 'factory-control'/);
assert.match(bakeryWorkflow, /DEPLOY_BAKERY_MULLER_PAGES_PREVIEW_ZERO_COST/);
assert.match(bakeryWorkflow, /--branch riosystems-staging-bakery-muller/);
assert.match(bakeryWorkflow, /if: \$\{\{ github\.event_name == 'workflow_dispatch' \}\}/);

console.log('RIOSYSTEMS Pages preview deploy guard: OK');
