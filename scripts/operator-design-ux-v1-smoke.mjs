import assert from 'node:assert/strict';
import { handleOperatorDashboard, operatorDesignUxManifest } from '../src/operator-design-ux-v1.js';

const response = await handleOperatorDashboard(
  new Request('https://operator.example.test/operator'),
  {},
  {},
  { authorize: async () => ({ ok: true, operator_id: 'operator:design-ux', email: 'operator@example.test' }) }
);

assert.equal(response.status, 200);
const html = await response.text();

for (const required of [
  'aurentara-operator-design-v1',
  'AURENTARA SYSTEMS',
  'Operator Control',
  'A YSRIO Company',
  'Attention required',
  'Current operations',
  'System & control',
  'Recent activity',
  'nav-group',
  'nav-label',
  'Mission lifecycle',
  'prefers-reduced-motion',
  'aurentara-skeleton',
  "setAttribute('aria-label','Status: '",
  'Overview',
  'Work',
  'Operations',
  'Control'
]) {
  assert.ok(html.includes(required), `missing design/UX contract marker: ${required}`);
}

const designScriptMatch = html.match(/<script id="aurentara-operator-design-v1-script">([\s\S]*?)<\/script>/);
assert.ok(designScriptMatch, 'design browser script must be emitted once');
assert.doesNotThrow(() => new Function(designScriptMatch[1]), 'injected design browser script must parse as JavaScript');

assert.ok(html.includes('@media(max-width:1180px)'), 'laptop breakpoint must exist');
assert.ok(html.includes('@media(max-width:860px)'), 'tablet breakpoint must exist');
assert.ok(html.includes('@media(max-width:760px)'), 'mobile breakpoint must exist');
assert.ok(html.includes('outline:2px solid var(--focus)'), 'keyboard focus must remain visible');
assert.ok(html.includes('overflow-x:auto') || html.includes('overflow:auto'), 'tables/navigation must retain safe overflow behavior');
assert.ok(html.includes('aria-label=\"Mission lifecycle\"') || html.includes("setAttribute('aria-label','Mission lifecycle')"), 'mission lifecycle must have an accessible label');
assert.doesNotMatch(html, /data-action=["']retry["']/i);
assert.doesNotMatch(html, /data-action=["']cancel["']/i);

const apiResponse = await handleOperatorDashboard(
  new Request('https://operator.example.test/operator/api/dashboard'),
  {},
  {},
  { authorize: async () => ({ ok: true, operator_id: 'operator:design-ux', email: 'operator@example.test' }) }
);
assert.equal(apiResponse.status, 200);
const dashboard = await apiResponse.json();
assert.equal(dashboard.schema, 'riosystems.operator-dashboard-view.v1', 'design wrapper must preserve canonical dashboard API');
assert.equal(dashboard.safety_panel.production, 'LOCKED');

const manifest = operatorDesignUxManifest();
assert.equal(manifest.schema, 'aurentara.operator-design-ux.v1');
assert.equal(manifest.presentation_only, true);
assert.equal(manifest.canonical_route, '/operator');
assert.equal(manifest.existing_functional_seal_reused, true);
assert.equal(manifest.new_core_engine, false);
assert.equal(manifest.new_dashboard, false);
assert.equal(manifest.new_api_route, false);
assert.equal(manifest.grouped_navigation, true);
assert.equal(manifest.command_center_hierarchy, true);
assert.equal(manifest.mission_lifecycle_visualization, true);
assert.equal(manifest.status_not_color_only, true);
assert.equal(manifest.keyboard_focus_visible, true);
assert.equal(manifest.reduced_motion_supported, true);
assert.equal(manifest.loading_skeleton_supported, true);
assert.deepEqual(manifest.responsive_priority, ['desktop','laptop','tablet','mobile']);
assert.equal(manifest.production_deploy, false);
assert.equal(manifest.external_writes, false);
assert.equal(manifest.real_customer_data, false);
assert.equal(manifest.variable_cost_eur, 0);

console.log(JSON.stringify({
  ok: true,
  suite: 'operator-design-ux-v1',
  presentation_only: true,
  grouped_navigation: true,
  overview_hierarchy: true,
  mission_lifecycle: true,
  browser_script_parse: true,
  responsive: true,
  accessibility: true,
  canonical_api_preserved: true,
  functional_actions_unchanged: true,
  production_deploy: false,
  external_writes: false,
  real_customer_data: false,
  variable_cost_eur: 0
}, null, 2));
