import { handleOperatorDashboard as handleBaseOperatorDashboard } from './operator-project-create-dashboard-v1.js';
import { buildAuthoritativeOperatorSystemHealth } from './operator-system-health-v1.js';

function json(body, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' }
  });
}

function aggregateCi(signals = {}) {
  const items = ['core_ci','integrated_regression_gate','dashboard_ci','universal_mission_ci'].map((key) => signals[key]).filter(Boolean);
  const statuses = items.map((item) => item.status);
  const raw = statuses.includes('BLOCKED') ? 'BLOCKED'
    : statuses.includes('NOT_VERIFIED') ? 'NOT_VERIFIED'
      : statuses.includes('STALE') ? 'STALE'
        : statuses.includes('DEGRADED') ? 'DEGRADED'
          : items.length ? 'HEALTHY' : 'NOT_VERIFIED';
  return {
    raw,
    status: raw,
    label: raw === 'HEALTHY' ? 'Exact-head CI gates healthy' : `Exact-head CI: ${raw}`,
    tone: raw === 'HEALTHY' ? 'ready' : raw === 'BLOCKED' ? 'blocked' : raw === 'DEGRADED' || raw === 'STALE' ? 'attention' : 'neutral',
    signals: Object.fromEntries(['core_ci','integrated_regression_gate','dashboard_ci','universal_mission_ci'].map((key) => [key, signals[key]])),
    production_deploy: false
  };
}

const HEALTH_STATUS_SCRIPT = String.raw`<script>
(() => {
  if (typeof STATUS_MAP === 'object' && STATUS_MAP) {
    STATUS_MAP.HEALTHY = ['Healthy', 'ready'];
    STATUS_MAP.DEGRADED = ['Degraded', 'attention'];
    STATUS_MAP.BLOCKED = ['Blocked', 'blocked'];
    STATUS_MAP.STALE = ['Stale', 'attention'];
    STATUS_MAP.NOT_VERIFIED = ['Not verified', 'neutral'];
  }
  if (typeof renderHealth === 'function') {
    const baseRenderHealth = renderHealth;
    renderHealth = function () {
      baseRenderHealth();
      const health = state.data.health || {};
      const signals = health.signals || {};
      const section = document.querySelector('#health');
      if (!section || section.querySelector('[data-authoritative-health]')) return;
      const card = document.createElement('div');
      card.className = 'card';
      card.dataset.authoritativeHealth = 'true';
      const rows = [
        ['Core CI', signals.core_ci],
        ['Integrated Regression', signals.integrated_regression_gate],
        ['Dashboard CI', signals.dashboard_ci],
        ['Universal Mission CI', signals.universal_mission_ci],
        ['Factory Readiness', signals.factory_readiness],
        ['Provider Evidence', signals.provider_evidence_freshness],
        ['Runtime Persistence', signals.runtime_persistence],
        ['Staging Availability', signals.staging_availability]
      ];
      card.innerHTML = '<div class="row"><div><div class="eyebrow">Authoritative Health</div><h2 style="margin:3px 0">V1 System Signals</h2><div class="small">Exact factory-control head · echte Evidence · keine geratenen Grünzustände</div></div>' + badge(health.status || 'NOT_VERIFIED') + '</div>' +
        rows.map(([name, item]) => '<div class="row"><div><strong>' + esc(name) + '</strong><div class="small">' + esc(item?.label || 'Not verified') + '</div></div>' + badge(item?.status || 'NOT_VERIFIED') + '</div>').join('') +
        '<div class="small">Checked: ' + esc(fmtDate(health.checked_at)) + (health.branch_truth?.head_sha ? ' · ' + esc(health.branch_truth.head_sha.slice(0, 12)) : '') + '</div>';
      section.prepend(card);
    };
  }
})();
</script>`;

export async function handleOperatorDashboard(request, env = {}, ctx = {}, options = {}) {
  const url = new URL(request.url);
  if (request.method === 'GET' && url.pathname === '/operator/api/system-health') {
    const base = await handleBaseOperatorDashboard(request, env, ctx, options);
    if (!base || base.status !== 200) return base;
    const baseHealth = await base.clone().json();
    const authoritative = await buildAuthoritativeOperatorSystemHealth({
      base_health: baseHealth,
      env,
      runtime_service: options.runtime_service || null,
      fetch_impl: options.system_health_fetch || globalThis.fetch,
      now: options.system_health_now || new Date(),
      owner: options.system_health_owner || 'dariolazzano3-ops',
      repo: options.system_health_repo || 'chatgpt-test',
      branch: options.system_health_branch || 'factory-control',
      ci_max_age_ms: options.ci_max_age_ms || 12 * 60 * 60 * 1000,
      provider_max_age_ms: options.provider_max_age_ms || 7 * 24 * 60 * 60 * 1000
    });
    return json({
      ...baseHealth,
      schema: authoritative.schema,
      status: authoritative.status,
      checked_at: authoritative.checked_at,
      branch_truth: authoritative.branch_truth,
      signals: authoritative.signals,
      ci: aggregateCi(authoritative.signals),
      runtime_persistence: authoritative.signals.runtime_persistence,
      staging_availability: authoritative.signals.staging_availability,
      health_rules: authoritative.rules,
      production_deploy: false
    });
  }

  const response = await handleBaseOperatorDashboard(request, env, ctx, options);
  if (!response) return null;
  const type = response.headers.get('content-type') || '';
  if (!(url.pathname === '/operator' || url.pathname === '/operator/') || response.status !== 200 || !type.includes('text/html')) return response;
  const source = await response.text();
  const body = source.includes('</body>') ? source.replace('</body>', `${HEALTH_STATUS_SCRIPT}</body>`) : `${source}${HEALTH_STATUS_SCRIPT}`;
  return new Response(body, { status: response.status, statusText: response.statusText, headers: response.headers });
}

export function operatorSystemHealthDashboardManifest() {
  return {
    schema: 'riosystems.operator-system-health-dashboard.v1',
    status_states: ['HEALTHY','DEGRADED','BLOCKED','STALE','NOT_VERIFIED'],
    exact_factory_control_head: true,
    github_read_only: true,
    github_secret_required: false,
    runtime_persistence_is_live_probe: true,
    provider_evidence_has_freshness: true,
    guessed_green_states: false,
    production_deploy: false
  };
}
