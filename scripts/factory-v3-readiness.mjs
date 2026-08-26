import fs from 'node:fs';

const failures = [];
const passes = [];

function read(path) {
  if (!fs.existsSync(path)) {
    failures.push(`missing required file: ${path}`);
    return '';
  }
  return fs.readFileSync(path, 'utf8');
}

function requireText(label, text, expected) {
  if (text.includes(expected)) passes.push(label);
  else failures.push(`${label}: expected ${JSON.stringify(expected)}`);
}

function requireJson(label, value) {
  if (value) passes.push(label);
  else failures.push(label);
}

const control = read('.github/workflows/factory-control.yml');
const autopilot = read('.github/workflows/factory-autopilot.yml');
const requestContract = read('scripts/factory-request-contract.mjs');
const requestIdempotency = read('scripts/request-idempotency.mjs');
const factoryControl = read('scripts/factory-control.mjs');
const materializer = read('src/materializer.js');
const evolver = read('src/evolver.js');
const costGuard = read('scripts/cost-guard.mjs');
const visualQa = read('scripts/visual-qa.mjs');
const promoteActive = read('scripts/promote-active-project.mjs');
const activeRaw = read('factory-state/active-project.json');

requireText('Factory Control has explicit dispatch', control, 'workflow_dispatch:');
requireText('Factory Control serializes requests', control, 'factory-control-serial');
requireText('Factory Control pins push runs to the request event commit', control, "github.sha");
requireText('Factory Control refreshes durable state after queue wait', control, 'Refresh serialized control state');
requireText('Factory Control restores event worktree before branch checkout', control, 'Restore event worktree before project checkout');
requireText('Factory Control checks request idempotency', control, 'Check request idempotency');
requireText('Factory Control records successful request fingerprints', control, 'Record successful request');
requireText('Factory Control can write commit statuses', control, 'statuses: write');
requireText('Factory Control runs cost guard', control, 'Cost and usage guard');
requireText('Factory Control runs Visual QA', control, 'Run Visual QA');
requireText('Factory Control reports failed requests', control, 'Publish Factory failure');
requireText('Factory failure report confirms production remains disabled', control, 'Active project promotion: skipped');
requireText('Factory Control promotes successful projects', control, 'Promote successful project to active state');
requireText('Factory Control publishes preview status', control, "context='factory-control/preview'");
requireText('Request idempotency uses SHA-256 fingerprint', requestIdempotency, "createHash('sha256')");
requireText('Request idempotency persists a ledger', requestIdempotency, 'request-ledger.json');
requireText('Factory execution derives deterministic SHA-256 recovery key', factoryControl, 'crypto.createHash("sha256")');
requireText('Factory execution passes recovery key to materializer', factoryControl, 'recovery_key: recoveryKey');
requireText('Factory EVOLVE derives deterministic staging branch', factoryControl, 'edit-${recoveryKey.slice(0, 12)}');
requireText('Factory EVOLVE starts staging from prior active branch', factoryControl, 'source_branch: state.branch');
requireText('Factory EVOLVE does not mutate active branch in place', factoryControl, 'reuse_branch: false');
requireText('Factory EVOLVE enables retry recovery', factoryControl, 'recover_branch: true');
requireText('Evolver supports separate source branch', evolver, 'source_branch');
requireText('Evolver detects existing recovery staging branch', evolver, 'recoveredExistingBranch');
requireText('Evolver reuses existing open staging PR', evolver, 'findOpenPullRequest');
requireText('Evolver accepts recovery noop for already-applied edit', evolver, 'recovery_noop');
requireText('Materializer derives deterministic recovery branch', materializer, 'deterministicBranch');
requireText('Materializer detects existing recovery branch', materializer, 'resolve_recovery_branch');
requireText('Materializer updates existing partial files safely', materializer, 'if (existing?.sha) payload.sha = existing.sha');
requireText('Materializer reuses existing open pull request', materializer, 'findOpenPullRequest');
requireText('Materializer exposes recovery reuse state', materializer, 'reused_pull_request');
requireText('Active project promotion keeps production disabled', promoteActive, 'production_deploy: false');
requireText('Active project promotion writes to control branch', promoteActive, "controlRef = 'factory-control'");
requireText('Autopilot is restricted to V3 auto branches', autopilot, 'factory-v3/auto/*');
requireText('Autopilot requires successful CI', autopilot, "github.event.workflow_run.conclusion == 'success'");
requireText('Autopilot preserves durable queue/state', autopilot, 'durable queue/state: preserved');
requireText('Autopilot no longer force-resets Factory Control', autopilot, 'git push origin factory-control');
if (autopilot.includes('git push --force origin factory-control')) failures.push('Autopilot must not force-reset factory-control');
else passes.push('Autopilot does not force-reset factory-control');
requireText('Autopilot dispatches QA-only request', autopilot, '"mode": "qa"');
requireText('Autopilot does not deploy production', autopilot, 'Production deployment: disabled');
requireText('Strict request contract exists', requestContract, 'production_deploy');
requireText('Cost guard exposes QA-only stop threshold', costGuard, 'qa_only_stop');
requireText('Visual QA produces an ok verdict', visualQa, 'ok');

if (activeRaw) {
  try {
    const active = JSON.parse(activeRaw);
    requireJson('Active project is enabled', active.active === true);
    requireJson('Active project source is constrained to projects/', typeof active.source_path === 'string' && active.source_path.startsWith('projects/'));
    requireJson('Active project has canonical preview URL', typeof active.preview_url === 'string' && active.preview_url.startsWith('https://'));
    requireJson('Active project production deployment is disabled', active.production_deploy === false);
    requireJson('Active project editing mode is enabled', active.mode === 'editing');
  } catch (error) {
    failures.push(`active project JSON invalid: ${error.message}`);
  }
}

const result = { version: 1, ready: failures.length === 0, checks_passed: passes.length, checks_failed: failures.length, passes, failures };
console.log(JSON.stringify(result, null, 2));
if (failures.length > 0) process.exit(1);
