import fs from 'node:fs';

const failures = [];
const passes = [];
const read = (path) => fs.existsSync(path) ? fs.readFileSync(path, 'utf8') : (failures.push(`missing ${path}`), '');
const need = (label, text, expected) => text.includes(expected) ? passes.push(label) : failures.push(`${label}: expected ${JSON.stringify(expected)}`);

const recovery = read('scripts/factory-recovery.mjs');
const jobs = read('scripts/factory-job-state.mjs');
const observability = read('scripts/factory-observability.mjs');
const control = read('scripts/factory-control.mjs');
const pkg = read('package.json');

need('Recovery policy detects stale jobs', recovery, 'STALE_INCOMPLETE_JOB');
need('Recovery policy separates infrastructure failure', recovery, "return 'infrastructure'");
need('Recovery policy protects project quality failures', recovery, "state: 'manual_review'");
need('Job state schema advanced', jobs, 'version: 3');
need('Job state exposes recovery version', jobs, 'recovery_version: 1');
need('Job state records recovery start', jobs, "type: 'RECOVERY_STARTED'");
need('Job state tracks recovery attempt', jobs, 'recovery_attempt');
need('Job state classifies ambiguity directly', jobs, "return 'request_ambiguity'");
need('Job state blocks unchanged manual-review retries', jobs, 'RECOVERY_MANUAL_REVIEW_REQUIRED');
need('Job state marks nonrecoverable failures manual review', jobs, "'manual_review'");
need('Job state still hard-disables production', jobs, 'production_deploy: false');
need('Factory Control persists semantic failures before throwing', control, 'persistSemanticFailure');
need('Factory Control recognizes ambiguity as manual semantic failure', control, "return 'request_ambiguity'");
need('Factory Control records semantic failure event', control, "type: 'SEMANTIC_FAILURE'");
need('Factory Control preserves clarification reasons', control, 'clarification_reasons');
need('Observability exposes resilience section', observability, 'resilience: {');
need('Observability counts stale jobs', observability, 'stale_nonterminal_jobs');
need('Observability counts recovery starts', observability, 'recovery_starts');
need('Observability counts recovered jobs', observability, 'recovered_jobs');
need('Observability aggregates failure kinds', observability, 'failure_kinds');
need('Observability remains production-safe', observability, 'production_deploy: false');
need('Package runtime version advanced', pkg, '"version": "1.8.0-alpha.1"');
need('Package executes recovery smoke', pkg, 'node scripts/factory-recovery-smoke.mjs');

const result = { version: 'LEAN V3.4', ready: failures.length === 0, checks_passed: passes.length, checks_failed: failures.length, passes, failures };
console.log(JSON.stringify(result, null, 2));
if (failures.length) process.exit(1);
