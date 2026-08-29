import { planMakeReadOnlyPreflight } from '../src/make-staging-bridge.js';
import { runMakeReadOnlyPreflight } from '../src/make-readonly-runner.js';

const zoneUrl = String(process.env.MAKE_ZONE_URL || '').trim();
const teamId = Number(process.env.MAKE_TEAM_ID);
const planClass = String(process.env.MAKE_PLAN || '').trim().toLowerCase();
const token = String(process.env.MAKE_API_TOKEN || '').trim();
const approved = process.env.RIOSYSTEMS_READONLY_APPROVED === 'YES';

if (!approved) {
  console.error('MAKE_READONLY_EXECUTION_APPROVAL_REQUIRED');
  process.exit(2);
}
if (!token) {
  console.error('MAKE_API_TOKEN_SECRET_MISSING');
  process.exit(2);
}

const plan = planMakeReadOnlyPreflight({
  zone_url: zoneUrl,
  team_id: teamId,
  token_ref: 'secret:MAKE_API_TOKEN',
  plan: planClass,
  granted_scopes: ['organization:read', 'scenarios:read']
});

if (plan.state !== 'READY_FOR_READ_ONLY_PREFLIGHT') {
  console.log(JSON.stringify({
    ok: false,
    stage: 'MAKE_READONLY_PREFLIGHT_BLOCKED',
    blockers: plan.blockers,
    secrets_returned: false,
    external_side_effect_performed: false,
    production_deploy: false
  }, null, 2));
  process.exit(3);
}

const result = await runMakeReadOnlyPreflight(plan, {
  read_only_execution_approved: true,
  fetch_impl: globalThis.fetch,
  resolve_secret: async (ref) => ref === 'secret:MAKE_API_TOKEN' ? token : null,
  timeout_ms: 8000,
  max_response_bytes: 100000,
  production_deploy: false
});

console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exit(4);
