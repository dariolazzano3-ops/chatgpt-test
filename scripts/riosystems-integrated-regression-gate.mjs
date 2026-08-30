import { spawnSync } from 'node:child_process';

const suites = Object.freeze([
  ['ai-intelligence-v2-readiness', 'scripts/ai-intelligence-v2-readiness.mjs'],
  ['ai-intelligence-v2', 'scripts/ai-intelligence-v2-smoke.mjs'],
  ['automation-factory-v2', 'scripts/automation-factory-v2-smoke.mjs'],
  ['business-crm-os-v2', 'scripts/business-crm-os-v2-smoke.mjs'],
  ['web-factory-os-v2', 'scripts/web-factory-operating-system-v2-smoke.mjs'],
  ['growth-gtm-factory-v1', 'scripts/growth-gtm-factory-v1-smoke.mjs'],
  ['provider-stack-v1', 'scripts/provider-stack-v1-smoke.mjs'],
  ['bakery-muller-block6-contract', 'scripts/bakery-muller-live-e2e-smoke.mjs'],
  ['bakery-muller-block6-evidence', 'scripts/bakery-muller-live-e2e-evidence-smoke.mjs']
]);

const completed = [];

for (const [name, script] of suites) {
  const result = spawnSync(process.execPath, [script], {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit'
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    console.error(JSON.stringify({
      ok: false,
      gate: 'riosystems-integrated-regression-v1',
      failed_suite: name,
      exit_code: result.status,
      external_side_effects: false,
      production_deploy: false
    }, null, 2));
    process.exit(result.status ?? 1);
  }

  completed.push(name);
}

console.log(JSON.stringify({
  ok: true,
  gate: 'riosystems-integrated-regression-v1',
  completed_suites: completed,
  suite_count: completed.length,
  synthetic_test_data_only: true,
  variable_cost_eur: 0,
  external_side_effects: false,
  production_deploy: false
}, null, 2));
