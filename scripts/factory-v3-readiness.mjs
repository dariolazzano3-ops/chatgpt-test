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
function requireText(label, text, expected) { if (text.includes(expected)) passes.push(label); else failures.push(`${label}: expected ${JSON.stringify(expected)}`); }
function requireJson(label, value) { if (value) passes.push(label); else failures.push(label); }

const control = read('.github/workflows/factory-control.yml');
const ci = read('.github/workflows/ci.yml');
const autopilot = read('.github/workflows/factory-autopilot.yml');
const productionRelease = read('.github/workflows/factory-production-release.yml');
const productionAudit = read('.github/workflows/factory-production-audit.yml');
const requestContract = read('scripts/factory-request-contract.mjs');
const requestIdempotency = read('scripts/request-idempotency.mjs');
const factoryControl = read('scripts/factory-control.mjs');
const stateValidator = read('scripts/validate-factory-state.mjs');
const releaseReadiness = read('scripts/release-readiness.mjs');
const productionGate = read('scripts/production-release-gate.mjs');
const releaseRecorder = read('scripts/record-production-release.mjs');
const materializer = read('src/materializer.js');
const evolver = read('src/evolver.js');
const costGuard = read('scripts/cost-guard.mjs');
const visualQa = read('scripts/visual-qa.mjs');
const promoteActive = read('scripts/promote-active-project.mjs');
const activeRaw = read('factory-state/active-project.json');

requireText('Factory Control has explicit dispatch', control, 'workflow_dispatch:');
requireText('Factory Control serializes requests', control, 'factory-control-serial');
requireText('Factory Control pins push runs to the request event commit', control, 'github.sha');
requireText('Factory Control refreshes durable state after queue wait', control, 'Refresh serialized control state');
requireText('Factory Control restores event worktree before project checkout', control, 'Restore event worktree before project checkout');
requireText('Factory Control checks request idempotency', control, 'Check request idempotency');
requireText('Factory Control records successful request fingerprints', control, 'Record successful request');
requireText('Factory Control can write commit statuses', control, 'statuses: write');
requireText('Factory Control runs cost guard', control, 'Cost and usage guard');
requireText('Factory Control runs Visual QA', control, 'Run Visual QA');
requireText('Factory Control reports failed requests', control, 'Publish Factory failure');
requireText('Factory failure report confirms production remains disabled', control, 'Active project promotion: skipped');
requireText('Factory Control promotes successful projects', control, 'Promote successful project to active state');
requireText('Factory Control publishes preview status', control, "context='factory-control/preview'");
requireText('Generic CI keeps pull request validation enabled', ci, 'pull_request:');
requireText('Generic CI can ignore Factory project-only pull requests', ci, 'paths-ignore:');
requireText('Generic CI delegates projects/** pull requests to Factory Control', ci, "- 'projects/**'");
requireText('Request idempotency uses SHA-256 fingerprint', requestIdempotency, "createHash('sha256')");
requireText('Request idempotency persists a ledger', requestIdempotency, 'request-ledger.json');
requireText('Factory execution derives deterministic SHA-256 recovery key', factoryControl, 'crypto.createHash("sha256")');
requireText('Factory execution passes recovery key to materializer', factoryControl, 'recovery_key: recoveryKey');
requireText('Factory EVOLVE derives deterministic staging branch', factoryControl, 'edit-${recoveryKey.slice(0, 12)}');
requireText('Factory EVOLVE starts staging from prior active branch', factoryControl, 'source_branch: sourceBranch');
requireText('Factory EVOLVE exposes source branch lineage', factoryControl, 'source_branch: sourceBranch');
requireText('Factory EVOLVE exports source branch lineage', factoryControl, '`source_branch=${output.source_branch || ""}`');
requireText('Factory EVOLVE does not mutate active branch in place', factoryControl, 'reuse_branch: false');
requireText('Factory EVOLVE enables retry recovery', factoryControl, 'recover_branch: true');
requireText('Factory execution compares active state with project registry', factoryControl, 'assertProjectStatesMatch');
requireText('Factory execution rejects durable state drift', factoryControl, 'FACTORY_STATE_DRIFT');
requireText('Factory state drift guard includes release readiness', factoryControl, '"release_readiness"');
requireText('Factory state validator checks active/registry drift', stateValidator, 'active/registry drift');
requireText('Factory state validator keeps production disabled', stateValidator, 'production_deploy must remain false');
requireText('Factory state validator understands release readiness', stateValidator, 'validateReleaseReadiness');
requireText('Release readiness emits preview readiness', releaseReadiness, 'preview_ready');
requireText('Release readiness keeps production deployment disabled', releaseReadiness, 'production_deploy: false');
requireText('Release readiness requires manual production approval', releaseReadiness, 'manual_production_approval_required');
requireText('Active promotion binds QA evidence to exact commit SHA', promoteActive, 'project_sha: projectSha');
requireText('Production release is manual dispatch only', productionRelease, 'workflow_dispatch:');
requireText('Production release defaults to dry run', productionRelease, 'default: true');
requireText('Production release requires explicit confirmation string', productionGate, 'DEPLOY ${expectedSlug} REV ${expectedRevision}');
requireText('Production release rejects stale revisions', productionGate, 'active_project_revision_mismatch');
requireText('Production release rejects post-QA commit changes', productionGate, 'qa_project_sha_mismatch');
requireText('Production release requires configured target variable', productionRelease, 'CLOUDFLARE_PRODUCTION_PAGES_PROJECT');
requireText('Production release verifies Cloudflare production branch', productionRelease, 'PRODUCTION_BRANCH_MUST_BE_MAIN');
requireText('Production release records successful releases durably', productionRelease, 'factory-state/releases.json');
requireText('Production release synchronizes active state', productionRelease, 'record-production-release.mjs');
requireText('Production release records synchronized state files', productionRelease, 'factory-state/active-project.json factory-state/projects.json');
requireText('Production release recorder preserves deploy policy flag', releaseRecorder, 'active.production_release = productionRelease');
requireText('Production release recorder synchronizes project registry', releaseRecorder, 'registry.projects[projectSlug].production_release = productionRelease');
requireText('Production release recorder binds release to exact active SHA', releaseRecorder, 'ACTIVE_PROJECT_SHA_MISMATCH');
requireText('Production dry-run audit is explicit queue-driven', productionAudit, "'factory-audit-requests/*.json'");
requireText('Production dry-run audit validates request safety', productionAudit, 'AUDIT_MUST_NOT_DEPLOY_PRODUCTION');
requireText('Production dry-run audit loads canonical active state', productionAudit, 'factory-state/active-project.json');
requireText('Production dry-run audit never deploys production', productionAudit, 'Production deployed: no');
requireText('Production dry-run audit verifies exact branch tip', productionAudit, 'git rev-parse "origin/$BRANCH"');
requireText('Production dry-run audit runs the same production gate', productionAudit, 'production-release-gate.mjs');
requireText('Production dry-run audit requires Cloudflare credentials', productionAudit, 'CLOUDFLARE_API_TOKEN');
requireText('Production dry-run audit requires configured Cloudflare target', productionAudit, 'CLOUDFLARE_PRODUCTION_PAGES_PROJECT');
requireText('Production dry-run audit verifies Cloudflare project exists', productionAudit, 'CLOUDFLARE_PROJECT_LOOKUP_FAILED');
requireText('Production dry-run audit verifies Cloudflare production branch', productionAudit, 'PRODUCTION_BRANCH_MUST_BE_MAIN');
requireText('Production dry-run audit uses Cloudflare read-only project lookup', productionAudit, 'https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/pages/projects/$CLOUDFLARE_PRODUCTION_PAGES_PROJECT');
requireText('Production dry-run audit publishes commit status', productionAudit, "factory-production/dry-run-audit");
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
requireText('Active project promotion detects edit branches', promoteActive, 'isEditBranch');
requireText('Active project promotion verifies branch ancestry', promoteActive, 'assertBranchContains');
requireText('Active project promotion rejects stale lineage', promoteActive, 'PROJECT_LINEAGE_STALE');
requireText('Active project promotion persists previous branch', promoteActive, 'previous_branch');
requireText('Active project promotion increments edit revision', promoteActive, 'edit_revision');
requireText('Active project promotion requires PR evidence', promoteActive, 'PULL_REQUEST_REQUIRED_FOR_PROMOTION');
requireText('Active project promotion requires Visual QA evidence', promoteActive, 'RELEASE_READINESS_QA_EVIDENCE_MISSING');
requireText('Active project promotion persists release readiness', promoteActive, 'release_readiness: releaseReadiness');
requireText('Autopilot is restricted to V3 auto branches', autopilot, 'factory-v3/auto/*');
requireText('Autopilot requires successful CI', autopilot, "github.event.workflow_run.conclusion == 'success'");
requireText('Autopilot preserves durable queue/state', autopilot, 'durable queue/state: preserved');
requireText('Autopilot no longer force-resets Factory Control', autopilot, 'git push origin factory-control');
if (autopilot.includes('git push --force origin factory-control')) failures.push('Autopilot must not force-reset factory-control'); else passes.push('Autopilot does not force-reset factory-control');
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
    requireJson('Active project production deployment policy is disabled', active.production_deploy === false);
    requireJson('Active project editing mode is enabled', active.mode === 'editing');
  } catch (error) { failures.push(`active project JSON invalid: ${error.message}`); }
}

const result = { version: 1, ready: failures.length === 0, checks_passed: passes.length, checks_failed: failures.length, passes, failures };
console.log(JSON.stringify(result, null, 2));
if (failures.length > 0) process.exit(1);
