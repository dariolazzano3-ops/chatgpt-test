import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const checks = [
  'scripts/jarvis-program-completion-seal-v1-smoke.mjs',
  'scripts/jarvis-v2-autonomous-e2e-v1.mjs',
  'scripts/jarvis-v2-failure-matrix-v1-smoke.mjs',
  'scripts/jarvis-v2-safety-closure-v1-smoke.mjs',
  'scripts/jarvis-program-controller-v1-smoke.mjs',
  'scripts/jarvis-program-loop-v1-smoke.mjs',
  'scripts/jarvis-program-runner-v1-smoke.mjs',
  'scripts/jarvis-program-runner-recovery-v1-smoke.mjs',
  'scripts/jarvis-wave-registry-v1-smoke.mjs'
];
const results = [];
for (const file of checks) {
  const started = Date.now();
  execFileSync(process.execPath, [file], { cwd: process.cwd(), stdio: ['ignore', 'pipe', 'pipe'], timeout: 120000 });
  results.push({ file, passed: true, duration_ms: Date.now() - started });
}
assert.equal(results.length, checks.length);
assert.ok(results.every((r) => r.passed));
console.log(JSON.stringify({ schema:'aurentara.jarvis.v2.final-regression.v1', passed:true, checks:results, production_deploy:false, hamyren_data_flow:false }, null, 2));
