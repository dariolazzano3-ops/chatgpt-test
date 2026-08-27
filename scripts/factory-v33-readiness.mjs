import fs from 'node:fs';

const failures = [];
const passes = [];
const read = (path) => fs.existsSync(path) ? fs.readFileSync(path, 'utf8') : (failures.push(`missing ${path}`), '');
const need = (label, text, expected) => text.includes(expected) ? passes.push(label) : failures.push(`${label}: expected ${JSON.stringify(expected)}`);

const jobs = read('scripts/factory-job-state.mjs');
const loop = read('scripts/qa-repair-loop.mjs');
const observability = read('scripts/factory-observability.mjs');
const control = read('.github/workflows/factory-control.yml');
const pkg = read('package.json');

need('Job state schema advanced to telemetry V2', jobs, 'version: 2');
need('Job state exposes telemetry version', jobs, 'telemetry_version: 1');
need('Job state bounds event history', jobs, 'const MAX_EVENTS = 80');
need('Job state supports durable event recording', jobs, 'recordFactoryJobEvent');
need('Job state hard-disables production', jobs, 'production_deploy: false');
need('QA loop records attempt start', loop, "type: 'QA_ATTEMPT_STARTED'");
need('QA loop records preview timing', loop, "type: 'PREVIEW_READY'");
need('QA loop records QA outcomes', loop, "type: 'QA_ATTEMPT_RESULT'");
need('QA loop records repair outcomes', loop, "type: 'REPAIR_RESULT'");
need('QA loop stores loop timing metrics', loop, 'qa_metrics');
need('Observability computes terminal success rate', observability, 'terminal_success_rate_pct');
need('Observability computes repair recovery rate', observability, 'auto_repair_recovery_rate_pct');
need('Observability aggregates failure codes', observability, 'failureCodes');
need('Observability aggregates repair profiles', observability, 'repairProfiles');
need('Observability captures QA duration', observability, 'average_qa_ms');
need('Observability hard-disables production', observability, 'production_deploy: false');
need('Factory runtime stages observability module', control, 'cp scripts/factory-observability.mjs .factory-runtime/factory-observability.mjs');
need('Factory Control refreshes observability', control, 'Refresh Factory observability snapshot');
need('Factory Control identifies V3.3 result', control, 'Factory Control V3.3 completed successfully');
need('Package runtime version advanced', pkg, '"version": "1.7.0-alpha.1"');
need('Package executes observability smoke', pkg, 'node scripts/factory-observability-smoke.mjs');

const result = { version: 'LEAN V3.3', ready: failures.length === 0, checks_passed: passes.length, checks_failed: failures.length, passes, failures };
console.log(JSON.stringify(result, null, 2));
if (failures.length) process.exit(1);
