import assert from 'node:assert/strict';
import fs from 'node:fs';

const supervisor = fs.readFileSync('scripts/mission-web-supervisor.mjs', 'utf8');
const workflow = fs.readFileSync('.github/workflows/mission-web-executor.yml', 'utf8');

assert.match(supervisor, /fingerprint\(request\)/);
assert.doesNotMatch(supervisor, /mission_job_id\s*=/);
assert.match(supervisor, /production_deploy: false/);
assert.match(supervisor, /reconcileMissionTaskFromWebJob/);
assert.match(workflow, /workflow_dispatch:/);
assert.match(workflow, /factory-v40-readiness\.mjs/);
assert.match(workflow, /timeout-minutes: 25/);
assert.doesNotMatch(workflow, /factory-production-release/);
console.log('LEAN V4.0 supervisor safety smoke passed');
