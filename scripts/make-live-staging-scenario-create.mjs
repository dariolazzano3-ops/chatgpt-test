import { buildMakeSafeStagingScenarioCreatePlan, runMakeStagingScenarioCreate } from '../src/make-staging-write-runner.js';

const zoneUrl = String(process.env.MAKE_ZONE_URL || '').trim();
const teamId = Number(process.env.MAKE_TEAM_ID);
const planClass = String(process.env.MAKE_PLAN || '').trim().toLowerCase();
const token = String(process.env.MAKE_API_TOKEN || '').trim();
const approved = process.env.RIOSYSTEMS_MAKE_STAGING_CREATE_APPROVED === 'CREATE_STAGING_ONLY';

if (!approved) {
  console.error('MAKE_EXTERNAL_WRITE_EXECUTION_APPROVAL_REQUIRED');
  process.exit(2);
}
if (!token) {
  console.error('MAKE_API_TOKEN_SECRET_MISSING');
  process.exit(2);
}

const plan = buildMakeSafeStagingScenarioCreatePlan({
  zone_url: zoneUrl,
  team_id: teamId,
  token_ref: 'secret:MAKE_API_TOKEN',
  plan: planClass,
  granted_scopes: ['organization:read', 'scenarios:read', 'scenarios:write'],
  paid_provider_approved: true,
  external_write_approved: true,
  supervised_execution_approved: true,
  staging_only: true,
  production_deploy: false
});

if (!plan.ok || plan.state !== 'WRITE_PLAN_APPROVED_NOT_EXECUTED') {
  console.log(JSON.stringify({
    ok: false,
    stage: 'MAKE_STAGING_CREATE_BLOCKED',
    blockers: plan.blockers || [{ code: plan.error || 'UNKNOWN' }],
    external_side_effect_performed: false,
    production_deploy: false
  }, null, 2));
  process.exit(3);
}

const result = await runMakeStagingScenarioCreate(plan, {
  external_write_execution_approved: true,
  supervised_execution_approved: true,
  paid_provider_approved: true,
  staging_only: true,
  fetch_impl: globalThis.fetch,
  resolve_secret: async (ref) => ref === 'secret:MAKE_API_TOKEN' ? token : null,
  timeout_ms: 8000,
  production_deploy: false
});

console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exit(4);
