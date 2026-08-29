import { buildMakeSafeStagingExecutionPlan, runMakeStagingScenarioOnce } from '../src/make-staging-execution-runner.js';

const zoneUrl = String(process.env.MAKE_ZONE_URL || '').trim();
const teamId = Number(process.env.MAKE_TEAM_ID);
const scenarioId = Number(process.env.MAKE_SCENARIO_ID);
const planClass = String(process.env.MAKE_PLAN || '').trim().toLowerCase();
const token = String(process.env.MAKE_API_TOKEN || '').trim();
const confirmation = String(process.env.RIOSYSTEMS_MAKE_STAGING_RUN_APPROVED || '').trim();

if (confirmation !== 'RUN_STAGING_ONCE') {
  console.error('MAKE_STAGING_EXECUTION_APPROVAL_REQUIRED');
  process.exit(2);
}
if (!token) {
  console.error('MAKE_API_TOKEN_SECRET_MISSING');
  process.exit(2);
}

const plan = buildMakeSafeStagingExecutionPlan({
  zone_url: zoneUrl,
  team_id: teamId,
  token_ref: 'secret:MAKE_API_TOKEN',
  plan: planClass,
  granted_scopes: ['organization:read','scenarios:read','scenarios:write','scenarios:run'],
  scenario_id: scenarioId,
  paid_provider_approved: true,
  external_write_approved: true,
  supervised_execution_approved: true,
  staging_only: true,
  production_deploy: false
});

if (!plan.ok || plan.state !== 'STAGING_EXECUTION_APPROVED_NOT_EXECUTED') {
  console.log(JSON.stringify({ ok: false, stage: 'MAKE_STAGING_EXECUTION_BLOCKED', blockers: plan.blockers || [{ code: plan.error || 'UNKNOWN' }], production_deploy: false }, null, 2));
  process.exit(3);
}

const result = await runMakeStagingScenarioOnce(plan, {
  confirmation: 'RUN_STAGING_ONCE',
  external_write_execution_approved: true,
  supervised_execution_approved: true,
  paid_provider_approved: true,
  staging_only: true,
  fetch_impl: globalThis.fetch,
  resolve_secret: async (ref) => ref === 'secret:MAKE_API_TOKEN' ? token : null,
  timeout_ms: 15000,
  production_deploy: false
});

console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exit(4);
