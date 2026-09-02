import fs from 'node:fs';

function replaceOrFail(text, pattern, replacement, label) {
  if (!pattern.test(text)) throw new Error(`RECONCILE_PATTERN_MISSING:${label}`);
  return text.replace(pattern, replacement);
}

const write = (path, text) => fs.writeFileSync(path, text);

write('src/webflow-staging-connection-evidence-v1.js', `const EVIDENCE = Object.freeze({
  schema: 'aurentara.webflow-staging-connection-evidence.v1',
  provider_id: 'webflow-api',
  environment: 'riosystems-staging',
  source: Object.freeze({
    verification: 'protected_staging_runtime_diagnostic',
    diagnostic_schema: 'aurentara.webflow-readonly-connection.v1',
    verification_method: 'GET /v2/sites',
    github_actions_run_id: 33575596473,
    live_staging_sha: '621a84f0119e0f6ca80d5aefae06a4f39d5f4a06',
    cloudflare_access_cleanup_verified: true
  }),
  connection: Object.freeze({
    credential_present: true,
    credential_valid: true,
    authenticated: true,
    site_accessible: true,
    site_metadata_read: true,
    connected_staging: true,
    provider_requests: 1
  }),
  execution: Object.freeze({
    provider_writes: 0,
    staging_write_verified: false,
    publish_verified: false,
    publish_performed: false,
    routing_ready: false,
    routing_scope: 'specialist_only'
  }),
  cost_guard: Object.freeze({
    variable_cost_eur: 0,
    automatic_paid_actions: false
  }),
  safety: Object.freeze({
    secret_value_exposed: false,
    secrets_embedded: false,
    real_customer_data: false,
    production_deploy: false,
    production_eligible: false
  }),
  verified_at: '2026-09-02'
});

export function webflowStagingConnectionEvidence() {
  return structuredClone(EVIDENCE);
}

export function isWebflowStagingConnected() {
  return EVIDENCE.provider_id === 'webflow-api'
    && EVIDENCE.environment === 'riosystems-staging'
    && EVIDENCE.source.verification_method === 'GET /v2/sites'
    && EVIDENCE.source.cloudflare_access_cleanup_verified === true
    && EVIDENCE.connection.credential_present === true
    && EVIDENCE.connection.credential_valid === true
    && EVIDENCE.connection.authenticated === true
    && EVIDENCE.connection.site_accessible === true
    && EVIDENCE.connection.site_metadata_read === true
    && EVIDENCE.connection.connected_staging === true
    && EVIDENCE.connection.provider_requests === 1
    && EVIDENCE.execution.provider_writes === 0
    && EVIDENCE.execution.staging_write_verified === false
    && EVIDENCE.execution.publish_verified === false
    && EVIDENCE.execution.publish_performed === false
    && EVIDENCE.execution.routing_ready === false
    && EVIDENCE.cost_guard.variable_cost_eur === 0
    && EVIDENCE.cost_guard.automatic_paid_actions === false
    && EVIDENCE.safety.secret_value_exposed === false
    && EVIDENCE.safety.secrets_embedded === false
    && EVIDENCE.safety.real_customer_data === false
    && EVIDENCE.safety.production_deploy === false
    && EVIDENCE.safety.production_eligible === false;
}
`);

let fast = fs.readFileSync('src/remaining-provider-fast-lane-evidence-v1.js', 'utf8');
fast = replaceOrFail(fast,
  /  'webflow-api': Object\.freeze\(\{[\s\S]*?\n  \}\),\n  'lovable-github'/,
  `  'webflow-api': Object.freeze({
    provider_id: 'webflow-api',
    strategic_role: 'specialist_visual_cms_platform',
    maturity_level: 'L3',
    final_classification: 'CONNECTED_STAGING',
    central_connection_required: true,
    account_state: 'READY',
    site_state: 'ACCESSIBLE',
    credential_state: 'PRESENT_VALID',
    connected: true,
    verification: 'PROTECTED_STAGING_RUNTIME_READ_ONLY_GET_V2_SITES_VERIFIED',
    routing_ready: false,
    architecture_reason: 'specialist_only_native_web_factory_framer_and_cloudflare_remain_primary',
    official_model: Object.freeze({
      api_available: true,
      authentication: 'bearer_site_token_or_oauth',
      workspace_token_enterprise_only: true,
      site_token_supports_read_only_scopes: true,
      read_only_verification: 'GET /v2/sites',
      required_scope: 'sites:read',
      free_starter_workspace_and_site_available: true,
      documentation: Object.freeze([
        'https://developers.webflow.com/data/reference/authentication',
        'https://developers.webflow.com/data/reference/sites/list',
        'https://help.webflow.com/hc/en-us/articles/33961356296723-Intro-to-Webflow-s-APIs',
        'https://help.webflow.com/hc/en-us/articles/33961232582419-Choose-a-Site-plan'
      ])
    }),
    operator_gate: null,
    provider_requests: 1,
    provider_writes: 0,
    variable_cost_eur: 0
  }),
  'lovable-github'`, 'fastlane-webflow');
write('src/remaining-provider-fast-lane-evidence-v1.js', fast);

let inventory = fs.readFileSync('src/provider-activation-inventory.js', 'utf8');
inventory = replaceOrFail(inventory,
  /import \{ framerStagingConnectionEvidence, isFramerStagingConnected \} from '\.\/framer-staging-connection-evidence-v1\.js';/,
  `import { framerStagingConnectionEvidence, isFramerStagingConnected } from './framer-staging-connection-evidence-v1.js';\nimport { webflowStagingConnectionEvidence, isWebflowStagingConnected } from './webflow-staging-connection-evidence-v1.js';`, 'inventory-import');
inventory = replaceOrFail(inventory,
  /const FRAMER_CONNECTED_STAGING = isFramerStagingConnected\(\);/,
  `const FRAMER_CONNECTED_STAGING = isFramerStagingConnected();\nconst WEBFLOW_CONNECTION_EVIDENCE = webflowStagingConnectionEvidence();\nconst WEBFLOW_CONNECTED_STAGING = isWebflowStagingConnected();`, 'inventory-constants');
inventory = replaceOrFail(inventory,
  /  strategic\(\{\n    id: 'webflow-api',[\s\S]*?\n  \}\),\n  \{\n    id: 'cloudflare-workers-free'/,
  `  strategic({
    id: 'webflow-api',
    name: 'Webflow',
    category: 'web_design',
    role: 'WEB SPECIALIST',
    roles: ['web_specialist'],
    capabilities: ['web.design', 'web.cms', 'web.publish'],
    verification: WEBFLOW_CONNECTED_STAGING ? 'CONNECTION_VERIFIED_STAGING' : 'NOT_CONNECTED',
    connection_state: WEBFLOW_CONNECTED_STAGING ? 'CONNECTED_STAGING' : 'NOT_CONNECTED',
    maturity_level: WEBFLOW_CONNECTED_STAGING ? 'L3' : WEBFLOW_RESOLUTION.maturity_level,
    final_classification: WEBFLOW_CONNECTED_STAGING ? 'CONNECTED_STAGING' : WEBFLOW_RESOLUTION.final_classification,
    central_connection_required: true,
    account_state: WEBFLOW_CONNECTED_STAGING ? 'READY' : WEBFLOW_RESOLUTION.account_state,
    credential_state: WEBFLOW_CONNECTED_STAGING ? 'PRESENT_VALID' : WEBFLOW_RESOLUTION.credential_state,
    site_binding_state: WEBFLOW_CONNECTED_STAGING ? 'ACCESSIBLE' : 'NOT_VERIFIED',
    routing_ready: false,
    runtime_eligible: false,
    free_tier_confirmed: true,
    cost_mode: 'free_starter_read_only_api_possible_paid_features_separate',
    restrictions: ['SPECIALIST_ONLY', 'CONNECTED_READ_ONLY', 'STAGING_WRITE_NOT_VERIFIED', 'PUBLISH_NOT_VERIFIED', 'PRODUCTION_DISABLED'],
    operator_gate: null,
    connection_evidence: WEBFLOW_CONNECTION_EVIDENCE,
    resolution_evidence: WEBFLOW_RESOLUTION,
    staging_write_verified: false,
    publish_verified: false,
    routing_scope: 'specialist_only',
    production_eligible: false,
    verified_at: '2026-09-02'
  }),
  {
    id: 'cloudflare-workers-free'`, 'inventory-webflow-block');
write('src/provider-activation-inventory.js', inventory);

let stack = fs.readFileSync('src/provider-stack-v1.js', 'utf8');
stack = replaceOrFail(stack,
  /import \{ framerStagingConnectionEvidence, isFramerStagingConnected \} from '\.\/framer-staging-connection-evidence-v1\.js';/,
  `import { framerStagingConnectionEvidence, isFramerStagingConnected } from './framer-staging-connection-evidence-v1.js';\nimport { webflowStagingConnectionEvidence, isWebflowStagingConnected } from './webflow-staging-connection-evidence-v1.js';`, 'stack-import');
stack = replaceOrFail(stack,
  /  const framerEvidence = framerStagingConnectionEvidence\(\);/,
  `  const framerEvidence = framerStagingConnectionEvidence();\n  const webflowEvidence = webflowStagingConnectionEvidence();`, 'stack-evidence');
stack = replaceOrFail(stack,
  /      framer_routing_scope: 'specialist_only',/,
  `      framer_routing_scope: 'specialist_only',\n      webflow_connected_staging: isWebflowStagingConnected(),\n      webflow_connection_evidence: webflowEvidence,\n      webflow_staging_write_verified: false,\n      webflow_publish_verified: false,\n      webflow_routing_scope: 'specialist_only',`, 'stack-web-factory');
stack = replaceOrFail(stack,
  /  const framerConnectedStaging = isFramerStagingConnected\(\);/,
  `  const framerConnectedStaging = isFramerStagingConnected();\n  const webflowConnectedStaging = isWebflowStagingConnected();\n  const webflowConnectionEvidence = webflowStagingConnectionEvidence();`, 'matrix-constants');
stack = replaceOrFail(stack,
  /      \{\n        id: 'webflow-api', selection: 'optional_specialist',[\s\S]*?\n      \}\n    \],/,
  `      {
        id: 'webflow-api', selection: 'optional_specialist',
        connection_state: webflowConnectedStaging ? 'CONNECTED_STAGING' : 'NOT_CONNECTED',
        activation: webflowConnectedStaging ? 'live_staging_verified_read_only_connection' : 'operator_gate_read_only_site_token_required',
        maturity_level: webflowConnectedStaging ? 'L3' : webflow.maturity_level,
        final_classification: webflowConnectedStaging ? 'CONNECTED_STAGING' : webflow.final_classification,
        account: webflowConnectedStaging ? 'ready' : 'not_verified',
        credential: webflowConnectedStaging ? 'present_valid' : 'not_verified',
        site_metadata_read: webflowConnectedStaging,
        connection_evidence: webflowConnectionEvidence,
        operator_gate: webflowConnectedStaging ? null : webflow.operator_gate,
        routing_eligibility: 'specialist_only_not_routing_ready_at_l3',
        provider_requests: webflowConnectedStaging ? 1 : 0,
        provider_writes: 0,
        staging_write_verified: false,
        publish_verified: false,
        publish_performed: false,
        production_eligible: false,
        resolution_evidence: webflow
      }
    ],`, 'matrix-webflow');
write('src/provider-stack-v1.js', stack);

let web = fs.readFileSync('src/web-provider-strategy.js', 'utf8');
web = replaceOrFail(web,
  /import \{ isFramerStagingConnected \} from '\.\/framer-staging-connection-evidence-v1\.js';/,
  `import { isFramerStagingConnected } from './framer-staging-connection-evidence-v1.js';\nimport { isWebflowStagingConnected } from './webflow-staging-connection-evidence-v1.js';`, 'web-import');
web = replaceOrFail(web,
  /const FRAMER_CONNECTED = isFramerStagingConnected\(\);/,
  `const FRAMER_CONNECTED = isFramerStagingConnected();\nconst WEBFLOW_CONNECTED = isWebflowStagingConnected();`, 'web-constant');
web = replaceOrFail(web,
  /  Object\.freeze\(\{\n    id: 'webflow-api',[\s\S]*?\n  \}\)\n\]\);/,
  `  Object.freeze({
    id: 'webflow-api',
    role: 'optional_client_editable_cms',
    category: 'visual_cms_builder',
    capabilities: ['web.design.visual','web.cms.manage','web.publish.platform','web.export.static-code'],
    availability: WEBFLOW_CONNECTED ? 'connected_staging_read_only' : 'operator_gate',
    account_connection_required: true,
    central_connection_required: true,
    final_classification: WEBFLOW_CONNECTED ? 'CONNECTED_STAGING' : WEBFLOW_RESOLUTION.final_classification,
    code_ownership: 'partial_export_with_cms_limits',
    hosting_lock_in: 'cms_dependent',
    automation_fit: 'high',
    cost_mode: 'workspace_and_site_plans',
    paid_plan_required: true,
    read_only_connection_paid_plan_required: false,
    external_write: true,
    staging_write_verified: false,
    publish_verified: false,
    routing_scope: 'specialist_only_not_routing_ready_at_l3',
    production_deploy: false,
    operator_gate: WEBFLOW_CONNECTED ? null : WEBFLOW_RESOLUTION.operator_gate,
    evidence: WEBFLOW_CONNECTED ? 'src/webflow-staging-connection-evidence-v1.js' : WEBFLOW_RESOLUTION
  })
]);`, 'web-provider-block');
web = replaceOrFail(web,
  /reasons\.splice\(0, reasons\.length, 'client_editor_priority','cms_and_designer_api','operator_connection_gate'\);/,
  `reasons.splice(0, reasons.length, 'client_editor_priority','cms_and_designer_api','connected_staging_read_only');`, 'web-reason');
web = replaceOrFail(web,
  /if \(provider\.account_connection_required && !connected\.has\(provider\.id\) && provider\.id !== 'cloudflare-workers-free'\) \{/,
  `if (provider.account_connection_required && !connected.has(provider.id) && !(provider.id === 'webflow-api' && WEBFLOW_CONNECTED) && provider.id !== 'cloudflare-workers-free') {`, 'web-connection-guard');
web = replaceOrFail(web,
  /    webflow_operator_connection_gate: true,/,
  `    webflow_connected_staging: WEBFLOW_CONNECTED,\n    webflow_operator_connection_gate: !WEBFLOW_CONNECTED,`, 'web-decision');
write('src/web-provider-strategy.js', web);

let smoke = fs.readFileSync('scripts/remaining-provider-fast-lane-smoke.mjs', 'utf8');
smoke = replaceOrFail(smoke,
  /import \{ framerStagingConnectionEvidence, isFramerStagingConnected \} from '\.\.\/src\/framer-staging-connection-evidence-v1\.js';/,
  `import { framerStagingConnectionEvidence, isFramerStagingConnected } from '../src/framer-staging-connection-evidence-v1.js';\nimport { webflowStagingConnectionEvidence, isWebflowStagingConnected } from '../src/webflow-staging-connection-evidence-v1.js';`, 'smoke-import');
smoke = replaceOrFail(smoke, /assert\.equal\(batch\.provider_requests, 0\);/, `assert.equal(batch.provider_requests, 1);`, 'smoke-batch-count');
smoke = replaceOrFail(smoke,
  /const webflow = byId\.get\('webflow-api'\);[\s\S]*?assert\.ok\(webflow\.operator_gate\);/,
  `const webflow = byId.get('webflow-api');
assert.equal(webflow.maturity_level, 'L3');
assert.equal(webflow.final_classification, 'CONNECTED_STAGING');
assert.equal(webflow.central_connection_required, true);
assert.equal(webflow.connection_state, 'CONNECTED_STAGING');
assert.equal(webflow.credential_state, 'PRESENT_VALID');
assert.equal(webflow.runtime_eligible, false);
assert.equal(webflow.routing_ready, false);
assert.equal(webflow.operator_gate, null);`, 'smoke-webflow-inventory');
smoke = replaceOrFail(smoke,
  /for \(const id of \['base44','activepieces-cloud-free','webflow-api','lovable-github','n8n-client-owned'\]\) \{[\s\S]*?\n\}/,
  `for (const id of ['base44','activepieces-cloud-free','lovable-github','n8n-client-owned']) {
  const row = matrixById.get(id);
  assert.ok(row, \`${'${id}'} missing from activation matrix\`);
  assert.equal(row.connection_state, 'NOT_CONNECTED');
  assert.equal(row.provider_writes, 0);
  assert.equal(row.production_eligible, false);
}
const webflowMatrix = matrixById.get('webflow-api');
assert.ok(webflowMatrix);
assert.equal(webflowMatrix.connection_state, 'CONNECTED_STAGING');
assert.equal(webflowMatrix.activation, 'live_staging_verified_read_only_connection');
assert.equal(webflowMatrix.maturity_level, 'L3');
assert.equal(webflowMatrix.final_classification, 'CONNECTED_STAGING');
assert.equal(webflowMatrix.provider_requests, 1);
assert.equal(webflowMatrix.provider_writes, 0);
assert.equal(webflowMatrix.staging_write_verified, false);
assert.equal(webflowMatrix.publish_verified, false);
assert.equal(webflowMatrix.production_eligible, false);`, 'smoke-matrix-loop');
smoke = smoke.replace(`assert.equal(matrixById.get('webflow-api').final_classification, 'OPERATOR_GATE');`, `assert.equal(matrixById.get('webflow-api').final_classification, 'CONNECTED_STAGING');`);
smoke = smoke.replace(`assert.equal(webById.get('webflow-api').availability, 'operator_gate');`, `assert.equal(webById.get('webflow-api').availability, 'connected_staging_read_only');`);
smoke = replaceOrFail(smoke,
  /const automation = automationProviderStrategy\(\);/,
  `const webflowEvidence = webflowStagingConnectionEvidence();
assert.equal(isWebflowStagingConnected(), true);
assert.equal(webflowEvidence.connection.provider_requests, 1);
assert.equal(webflowEvidence.connection.credential_valid, true);
assert.equal(webflowEvidence.connection.authenticated, true);
assert.equal(webflowEvidence.connection.site_accessible, true);
assert.equal(webflowEvidence.connection.site_metadata_read, true);
assert.equal(webflowEvidence.connection.connected_staging, true);
assert.equal(webflowEvidence.execution.provider_writes, 0);
assert.equal(webflowEvidence.execution.staging_write_verified, false);
assert.equal(webflowEvidence.execution.publish_verified, false);
assert.equal(webflowEvidence.safety.production_eligible, false);

const automation = automationProviderStrategy();`, 'smoke-webflow-evidence');
smoke = smoke.replace(`  provider_requests: 0,`, `  provider_requests: 1,`);
smoke = smoke.replace(`  operator_gates: ['activepieces-cloud-free','webflow-api'],`, `  operator_gates: ['activepieces-cloud-free'],`);
smoke = smoke.replace(`  framer_connected_staging: true,`, `  framer_connected_staging: true,\n  webflow_connected_staging: true,`);
write('scripts/remaining-provider-fast-lane-smoke.mjs', smoke);

console.log(JSON.stringify({ok:true, changed_files:[
  'src/webflow-staging-connection-evidence-v1.js',
  'src/remaining-provider-fast-lane-evidence-v1.js',
  'src/provider-activation-inventory.js',
  'src/provider-stack-v1.js',
  'src/web-provider-strategy.js',
  'scripts/remaining-provider-fast-lane-smoke.mjs'
], provider_requests:0, provider_writes:0, production:false, secrets_exposed:false}, null, 2));
