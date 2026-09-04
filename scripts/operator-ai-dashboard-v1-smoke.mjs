import assert from 'node:assert/strict';
import { handleOperatorDashboard, operatorAiDashboardManifest } from '../src/operator-ai/dashboard-v1.js';

const manifest = operatorAiDashboardManifest();
assert.equal(manifest.schema, 'aurentara.operator-ai.dashboard.v1');
assert.equal(manifest.existing_dashboard_extended, true);
assert.deepEqual(manifest.active_autonomy_levels, [0, 1, 2, 3]);
assert.equal(manifest.safe_internal_execution_status, 'NOT_ACTIVATED');
assert.equal(manifest.production_deploy, false);
assert.equal(manifest.external_writes, false);

const request = new Request('https://operator.local/operator/api/operator-ai/manifest', { method: 'GET' });
const allowed = await handleOperatorDashboard(request, {}, {}, { authorize: async () => ({ ok: true, operator_id: 'operator:test' }) });
assert.equal(allowed.status, 200);
assert.equal(allowed.headers.get('x-aurentara-operator-ai-v1'), 'enabled');
const body = await allowed.json();
assert.equal(body.schema, 'aurentara.operator-ai.bundle.v1');
assert.equal(body.dashboard_integrated, true);
assert.deepEqual(body.active_autonomy_levels, [0, 1, 2, 3]);
assert.equal(body.safe_internal_execution_status, 'NOT_ACTIVATED');
assert.equal(body.production_deploy, false);
assert.equal(body.external_writes, false);

const denied = await handleOperatorDashboard(request, {}, {}, {});
assert.equal(denied.status, 503);
const deniedBody = await denied.json();
assert.equal(deniedBody.private_operator_access_required, true);
assert.equal(deniedBody.production_deploy, false);

console.log(JSON.stringify({ ok: true, schema: 'aurentara.operator-ai-dashboard-v1-smoke.result', authenticated_manifest_route: 'PASS', fail_closed_auth: 'PASS', dashboard_integrated: true, active_autonomy_levels: [0,1,2,3], safe_internal_execution: 'NOT_ACTIVATED', production_deploy: false, external_writes: false }, null, 2));
