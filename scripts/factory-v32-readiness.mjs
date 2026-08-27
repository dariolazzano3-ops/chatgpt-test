import fs from 'node:fs';

const failures = [];
const passes = [];
const read = (path) => fs.existsSync(path) ? fs.readFileSync(path, 'utf8') : (failures.push(`missing ${path}`), '');
const need = (label, text, expected) => text.includes(expected) ? passes.push(label) : failures.push(`${label}: expected ${JSON.stringify(expected)}`);

const visualQa = read('scripts/visual-qa.mjs');
const policy = read('scripts/qa-repair-policy.mjs');
const loop = read('scripts/qa-repair-loop.mjs');
const control = read('.github/workflows/factory-control.yml');
const pkg = read('package.json');

need('Visual QA report schema is V6', visualQa, 'version: 6');
need('Visual QA emits structured issues', visualQa, 'issues.push({ code, message, details })');
need('Visual QA preserves protected-preview handling', visualQa, 'protectedLogin');
need('Visual QA reports overflow culprit metadata', visualQa, 'whiteSpace: style.whiteSpace');
need('Repair policy limits automatic fixes to overflow classes', policy, "new Set(['GEOMETRIC_OVERFLOW', 'SCROLL_OVERFLOW'])");
need('Repair policy supports media containment', policy, "type: 'MEDIA_CONTAINMENT'");
need('Repair policy supports text wrapping', policy, "type: 'TEXT_WRAP'");
need('Repair policy supports layout containment', policy, "type: 'LAYOUT_CONTAINMENT'");
need('Repair policy supports viewport containment fallback', policy, "type: 'VIEWPORT_CONTAINMENT'");
need('Repair policy rejects unsafe unknown overflow', policy, "type: 'UNSAFE_UNKNOWN_OVERFLOW'");
need('Repair loop imports central policy', loop, "from './qa-repair-policy.mjs'");
need('Repair loop stores chosen repair profiles', loop, 'last_repair_profiles');
need('Repair loop uses deterministic repair markers', loop, 'factory-v3.2:auto-repair');
need('Repair loop remains capped at three attempts', loop, 'Math.min(3');
need('Repair loop keeps production disabled', loop, 'production_deploy: false');
need('Factory runtime stages repair policy', control, 'cp scripts/qa-repair-policy.mjs .factory-runtime/qa-repair-policy.mjs');
need('Factory runtime verifies staged repair policy', control, 'test -f .factory-runtime/qa-repair-policy.mjs');
need('Factory Control identifies V3.2 result', control, 'Factory Control V3.2 completed successfully');
need('Package runtime version advanced', pkg, '"version": "1.6.0-alpha.1"');
need('Package check executes QA repair policy smoke', pkg, 'node scripts/qa-repair-policy-smoke.mjs');

const result = { version: 'LEAN V3.2', ready: failures.length === 0, checks_passed: passes.length, checks_failed: failures.length, passes, failures };
console.log(JSON.stringify(result, null, 2));
if (failures.length) process.exit(1);
