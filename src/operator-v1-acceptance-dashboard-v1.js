import { handleOperatorDashboard as handleSystemHealthDashboard } from './operator-system-health-dashboard-v1.js';
import { buildRiosystemsV1AcceptanceFromEvidence } from './riosystems-v1-acceptance-evidence-v1.js';
import { readAuthoritativeStagingDeploymentEvidence } from './operator-staging-deployment-evidence-v1.js';

function json(body, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' }
  });
}

function explicitActivationEvidence(env = {}) {
  const accessVerified = String(env.RIOSYSTEMS_ACCESS_APPLICATION_VERIFIED || '').toLowerCase() === 'true';
  return accessVerified ? {
    access_application_configured: true,
    access_application_evidence: {
      source: 'server_environment_explicit_verification',
      marker: 'RIOSYSTEMS_ACCESS_APPLICATION_VERIFIED'
    }
  } : {};
}

async function acceptanceResponse(request, env, ctx, options = {}) {
  const url = new URL(request.url);
  url.pathname = '/operator/api/system-health';
  const probe = new Request(url.toString(), { method: 'GET', headers: request.headers });
  const healthResponse = await handleSystemHealthDashboard(probe, env, ctx, options);
  if (!healthResponse || healthResponse.status !== 200) return healthResponse;
  const health = await healthResponse.clone().json();
  const canonicalHead = health.branch_truth?.head_sha || null;
  const deploymentEvidence = await readAuthoritativeStagingDeploymentEvidence({
    fetch_impl: options.staging_deployment_fetch || globalThis.fetch,
    owner: options.system_health_owner || 'dariolazzano3-ops',
    repo: options.system_health_repo || 'chatgpt-test',
    branch: options.system_health_branch || 'factory-control',
    canonical_head_sha: canonicalHead
  });
  const acceptance = buildRiosystemsV1AcceptanceFromEvidence({
    system_health: health,
    request_context: { server_side_operator_authorized: true },
    activation_evidence: explicitActivationEvidence(env),
    deployment_evidence: deploymentEvidence
  });
  return json({
    ...acceptance,
    checked_at: health.checked_at || new Date().toISOString(),
    canonical_head_sha: canonicalHead,
    deployed_sha: deploymentEvidence.deployed_sha || null,
    staging_deployment_evidence: deploymentEvidence,
    production_deploy: false
  });
}

const ACCEPTANCE_SCRIPT = String.raw`<script>
(() => {
  const acceptanceStatus = {
    V1_ACCEPTED: ['V1 Accepted', 'ready'],
    CODE_ACCEPTED_EXTERNAL_ACTIVATION_REQUIRED: ['Code accepted · activation open', 'attention'],
    INCOMPLETE: ['Incomplete', 'neutral'],
    BLOCKED: ['Blocked', 'blocked']
  };
  if (typeof STATUS_MAP === 'object' && STATUS_MAP) Object.assign(STATUS_MAP, acceptanceStatus);

  async function renderAcceptance() {
    const section = document.querySelector('#health');
    if (!section) return;
    let card = section.querySelector('[data-v1-acceptance]');
    if (!card) {
      card = document.createElement('div');
      card.className = 'card';
      card.dataset.v1Acceptance = 'true';
      section.prepend(card);
    }
    card.innerHTML = '<div class="small">V1 Acceptance wird geprüft…</div>';
    try {
      const result = await api('/v1-acceptance');
      const dod = result.definition_of_done?.summary || {};
      const activation = result.staging_activation?.summary || {};
      const deploy = result.staging_deployment_evidence || {};
      const next = result.next_actions || [];
      card.innerHTML = '<div class="row"><div><div class="eyebrow">Formal Definition of Done</div><h2 style="margin:3px 0">RIOSYSTEMS V1 Acceptance</h2><div class="small">Code-Evidence + Live-Staging-Evidence · fail-closed</div></div>' + badge(result.status) + '</div>' +
        '<div class="grid three"><div class="kv"><b>Code DoD</b><span>' + esc(dod.VERIFIED || 0) + ' / ' + esc(dod.total || 23) + ' verifiziert</span></div><div class="kv"><b>Staging Activation</b><span>' + esc(activation.VERIFIED || 0) + ' / ' + esc(activation.total || 5) + ' verifiziert</span></div><div class="kv"><b>Canonical Head</b><span class="mono">' + esc((result.canonical_head_sha || '').slice(0, 12) || '–') + '</span></div></div>' +
        '<div class="row"><div><strong>Staging Deployment</strong><div class="small">' + esc(deploy.label || 'Not verified') + (deploy.deployed_sha ? ' · ' + esc(deploy.deployed_sha.slice(0, 12)) : '') + '</div></div>' + badge(deploy.status || 'NOT_VERIFIED') + '</div>' +
        (next.length ? '<h3>Nächste harte Gates</h3>' + next.slice(0, 5).map((item) => '<div class="row"><div><strong>' + esc(item.action || item.id || item.type) + '</strong><div class="small">' + esc(item.type || '') + '</div></div>' + badge('NOT_VERIFIED') + '</div>').join('') : '<div class="callout good">Alle V1 Acceptance Gates sind verifiziert.</div>') +
        '<div class="small">Unknown bleibt NOT_VERIFIED. Production bleibt gesperrt.</div>';
    } catch (error) {
      card.innerHTML = '<div class="row"><div><strong>V1 Acceptance nicht verifizierbar</strong><div class="small">' + esc(error.message || error) + '</div></div>' + badge('NOT_VERIFIED') + '</div>';
    }
  }

  if (typeof renderHealth === 'function') {
    const baseRenderHealth = renderHealth;
    renderHealth = function () { baseRenderHealth(); void renderAcceptance(); };
  }
})();
</script>`;

export async function handleOperatorDashboard(request, env = {}, ctx = {}, options = {}) {
  const url = new URL(request.url);
  if (request.method === 'GET' && url.pathname === '/operator/api/v1-acceptance') {
    return acceptanceResponse(request, env, ctx, options);
  }

  const response = await handleSystemHealthDashboard(request, env, ctx, options);
  if (!response) return null;
  const type = response.headers.get('content-type') || '';
  if (!(url.pathname === '/operator' || url.pathname === '/operator/') || response.status !== 200 || !type.includes('text/html')) return response;
  const source = await response.text();
  const body = source.includes('</body>') ? source.replace('</body>', `${ACCEPTANCE_SCRIPT}</body>`) : `${source}${ACCEPTANCE_SCRIPT}`;
  return new Response(body, { status: response.status, statusText: response.statusText, headers: response.headers });
}

export function operatorV1AcceptanceDashboardManifest() {
  return {
    schema: 'riosystems.operator-v1-acceptance-dashboard.v1',
    enriches_existing_system_health_dashboard_only: true,
    endpoint: '/operator/api/v1-acceptance',
    exact_head_ci_required: true,
    access_success_not_inferred: true,
    deployment_source: 'github_actions_zero_cost_staging_deploy',
    deployment_success_not_inferred: true,
    deployment_exact_head_required: true,
    production_deploy: false
  };
}
