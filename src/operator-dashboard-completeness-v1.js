import { handleOperatorDashboard as handleBaseOperatorDashboard } from './operator-dashboard-http-v1.js';

const SYNTHETIC_CONFIRMATION = 'CONFIRM_SYNTHETIC_STAGING';
const LIVE_CONFIRMATION = 'CONFIRM_LIVE_STAGING_ZERO_COST';

function json(body, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' }
  });
}

async function bodyFrom(request) {
  try { return await request.clone().json(); } catch { return {}; }
}

function safeInputFromPreflight(payload = {}, body = {}) {
  const mission = payload.mission || {};
  return {
    customer_id: mission.customer_id,
    project_id: mission.project_id,
    business_name: mission.business_name,
    industry: mission.industry || body.industry,
    country: mission.country || body.country || 'DE',
    language: mission.language || body.language || 'de',
    mission_text: mission.mission_text || body.mission_text,
    business_goals: mission.business_goals || body.business_goals || [],
    known_constraints: mission.known_constraints || body.known_constraints || [],
    existing_systems: mission.existing_systems || body.existing_systems || [],
    requested_outcomes: mission.requested_outcomes || body.requested_outcomes || [],
    budget_policy: { variable_cost_ceiling_eur: 0, paid_overflow: false },
    approval_policy: { external_writes_require_approval: true, production_requires_explicit_approval: true },
    data_policy: { synthetic_only: true, real_customer_data: false },
    environment: 'staging',
    production_authorized: false
  };
}

function publicPlan(plan = {}, liveAvailable = false) {
  const review = plan.review || {};
  return {
    plan_token: plan.plan_token,
    scope_key: plan.scope_key,
    mission_id: plan.mission_id,
    business_name: plan.business_name,
    mission_text: plan.mission_text,
    selected_capabilities: review.plan?.selected_capabilities || [],
    rejected_capabilities: review.plan?.rejected_capabilities || [],
    providers: [...new Set((review.plan?.selected_capabilities || []).flatMap((task) => [task.provider?.primary, task.provider?.fallback]).filter(Boolean))],
    generated_by: 'universal-mission-run-v1',
    estimated_variable_cost_eur: Number(review.preflight?.estimated_variable_cost_eur || 0),
    risk: liveAvailable ? 'LIVE_STAGING_ZERO_COST_OPTION_AVAILABLE' : 'SYNTHETIC_STAGING_ONLY',
    side_effects: liveAvailable ? 'REAL_STAGING_WRITES_REQUIRE_SEPARATE_TYPED_APPROVAL' : 'NO_REAL_PROVIDER_WRITES',
    confirmation_text: SYNTHETIC_CONFIRMATION,
    live_confirmation_text: LIVE_CONFIRMATION,
    live_staging_available: liveAvailable,
    status: plan.status,
    runtime_revision: plan.runtime_revision,
    created_at: plan.created_at,
    expires_at: plan.expires_at,
    production_deploy: false
  };
}

async function authorizeThroughBase(request, env, ctx, options) {
  const url = new URL(request.url);
  url.pathname = '/operator/api/approvals';
  const probe = new Request(url.toString(), { method: 'GET', headers: request.headers });
  return handleBaseOperatorDashboard(probe, env, ctx, options);
}

async function handleDurableApi(request, env, ctx, options = {}) {
  const url = new URL(request.url);
  const service = options.runtime_service;
  if (!service || typeof service.recordMissionPlan !== 'function') return null;

  if (request.method === 'POST' && url.pathname === '/operator/api/mission-preflight') {
    const body = await bodyFrom(request);
    const base = await handleBaseOperatorDashboard(request, env, ctx, options);
    if (!base || base.status !== 201) return base;
    const payload = await base.clone().json();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    const recorded = await service.recordMissionPlan({
      expected_revision: payload.runtime_revision,
      scope_key: body.scope_key,
      review: { mission: payload.mission, analysis: payload.analysis, plan: payload.plan, preflight: payload.preflight },
      safe_input: safeInputFromPreflight(payload, body),
      created_at: new Date().toISOString(),
      expires_at: expiresAt
    });
    if (!recorded.ok) return json(recorded.body || { error: 'DURABLE_MISSION_PLAN_RECORD_FAILED', production_deploy: false }, recorded.status || 409);
    const plan = recorded.body?.plan;
    return json({
      ...payload,
      plan_token: plan.plan_token,
      runtime_revision: recorded.runtime.revision,
      status: 'APPROVAL_REQUIRED',
      durable_plan: true,
      live_staging_available: typeof options.live_staging_executor === 'function',
      live_confirmation_text: LIVE_CONFIRMATION,
      production_deploy: false
    }, 201);
  }

  if (request.method === 'GET' && url.pathname === '/operator/api/approvals') {
    const base = await handleBaseOperatorDashboard(request, env, ctx, options);
    if (!base || base.status !== 200) return base;
    const payload = await base.clone().json();
    const plans = await service.listMissionPlans();
    const liveAvailable = typeof options.live_staging_executor === 'function';
    return json({
      ...payload,
      mission_plans: (plans.body?.items || []).filter((item) => ['APPROVAL_REQUIRED','DEFERRED'].includes(item.status)).map((item) => publicPlan(item, liveAvailable)),
      runtime_revision: plans.runtime.revision,
      durable_plan_store: true,
      production_deploy: false
    });
  }

  if (request.method === 'POST' && url.pathname === '/operator/api/mission-plan-decision') {
    const auth = await authorizeThroughBase(request, env, ctx, options);
    if (!auth || auth.status !== 200) return auth;
    const body = await bodyFrom(request);
    const plans = await service.listMissionPlans();
    const plan = (plans.body?.items || []).find((item) => item.plan_token === body.plan_token);
    if (!plan) return json({ error: 'PLAN_APPROVAL_NOT_FOUND_OR_EXPIRED', production_deploy: false }, 404);

    if (body.decision === 'approve') {
      const result = await service.approveSyntheticMissionPlan({ plan_token: plan.plan_token, confirmation_text: body.confirmation_text });
      return json(result.body, result.status);
    }

    if (body.decision === 'approve_live_staging') {
      if (typeof options.live_staging_executor !== 'function') return json({ error: 'LIVE_STAGING_EXECUTOR_NOT_CONFIGURED', production_deploy: false }, 503);
      const idempotencyKey = `operator:${plan.scope_key}:${plan.mission_id}:live-staging-v1`;
      const result = await service.runLiveStaging({
        expected_revision: plans.runtime.revision,
        plan_token: plan.plan_token,
        confirmation_text: body.confirmation_text,
        idempotency_key: idempotencyKey,
        environment: 'staging',
        synthetic_only: true,
        production_authorized: false,
        variable_cost_ceiling_eur: 0,
        paid_overflow: false,
        provider_eligibility_pass: true,
        project_scope_pass: true,
        provider_routes: publicPlan(plan, true).providers
      }, { executor: options.live_staging_executor });
      return json(result.body, result.status);
    }

    if (['reject','defer'].includes(body.decision)) {
      const result = await service.decideMissionPlan({
        expected_revision: plans.runtime.revision,
        plan_token: plan.plan_token,
        decision: body.decision
      });
      return json(result.body, result.status);
    }

    return json({ error: 'MISSION_PLAN_DECISION_UNSUPPORTED', production_deploy: false }, 400);
  }

  return null;
}

const COMPLETENESS_SCRIPT = String.raw`<script>
(() => {
  const REQUIRED_CONFIRMATION = 'CONFIRM_SYNTHETIC_STAGING';
  const LIVE_CONFIRMATION = 'CONFIRM_LIVE_STAGING_ZERO_COST';
  const FILTER_OPTIONS = [
    ['all', 'Alle Projekte'],['active', 'Aktiv'],['blocked', 'Blockiert'],['approval_required', 'Approval erforderlich'],['staging', 'Staging'],['delivery_ready', 'Delivery Ready'],['completed', 'Abgeschlossen'],['failed', 'Fehlgeschlagen'],['synthetic', 'Synthetisch'],['production', 'Production']
  ];

  if (typeof projectRows === 'function') {
    projectRows = function () {
      const items = state.data.projects?.items || [];
      const query = state.projectQuery.toLowerCase();
      return items.filter((project) => {
        const matchesQuery = !query || [project.name, project.project_id, project.customer_id, project.scope_key].some((value) => String(value || '').toLowerCase().includes(query));
        const tags = new Set((project.filter_tags || []).map((value) => String(value).toLowerCase()));
        const selected = String(state.projectStatus || 'all').toLowerCase();
        return matchesQuery && (selected === 'all' || tags.has(selected) || String(project.state || '').toLowerCase() === selected || String(project.mission_status || '').toLowerCase() === selected);
      });
    };
  }

  if (typeof renderProjects === 'function') {
    const baseRenderProjects = renderProjects;
    renderProjects = function () {
      baseRenderProjects();
      const select = document.querySelector('#project-status');
      if (!select) return;
      select.innerHTML = FILTER_OPTIONS.map(([value, label]) => '<option value="' + value + '">' + label + '</option>').join('');
      select.value = String(state.projectStatus || 'all').toLowerCase();
    };
  }

  if (typeof decidePlan === 'function') {
    decidePlan = async function (token, decision) {
      let confirmationText = '';
      const required = decision === 'approve_live_staging' ? LIVE_CONFIRMATION : decision === 'approve' ? REQUIRED_CONFIRMATION : '';
      if (required) {
        const entered = window.prompt('Bestätigungstext eingeben:\n' + required, '');
        if (entered === null) return null;
        confirmationText = String(entered).trim();
        if (confirmationText !== required) { setError(new Error('Freigabe nicht ausgeführt: Bestätigungstext stimmt nicht überein.')); return null; }
      }
      try {
        const result = await api('/mission-plan-decision', { method: 'POST', body: JSON.stringify({ plan_token: token, decision, confirmation_text: confirmationText }) });
        if (decision === 'approve' || decision === 'approve_live_staging') { state.plan = null; await loadAll(); go('deliveries'); }
        else { await loadAll(); go('approvals'); }
        return result;
      } catch (error) { setError(error); return null; }
    };
  }

  if (typeof renderApprovals === 'function') {
    const baseRenderApprovals = renderApprovals;
    renderApprovals = function () {
      baseRenderApprovals();
      document.querySelectorAll('.plan-action[data-decision="approve"]').forEach((button) => {
        const card = button.closest('.cap');
        if (!card) return;
        const token = button.dataset.plan;
        const plan = (state.data.approvals?.mission_plans || []).find((item) => item.plan_token === token);
        const actions = button.closest('.actions');
        if (plan?.live_staging_available && actions && !actions.querySelector('[data-decision="approve_live_staging"]')) {
          const live = document.createElement('button');
          live.className = 'btn plan-action';
          live.dataset.plan = token;
          live.dataset.decision = 'approve_live_staging';
          live.textContent = 'Live Staging 0 €';
          live.onclick = () => decidePlan(token, 'approve_live_staging');
          actions.insertBefore(live, actions.children[1] || null);
        }
        if (!card.querySelector('[data-confirmation-hint]')) {
          const hint = document.createElement('div');
          hint.className = 'small'; hint.dataset.confirmationHint = 'true'; hint.style.marginTop = '8px';
          hint.textContent = plan?.live_staging_available ? 'Synthetic: ' + REQUIRED_CONFIRMATION + ' · Live Staging: ' + LIVE_CONFIRMATION : 'Erforderlicher Bestätigungstext: ' + REQUIRED_CONFIRMATION;
          if (actions) actions.insertAdjacentElement('afterend', hint);
        }
      });
    };
  }

  if (typeof renderPlan === 'function') {
    const baseRenderPlan = renderPlan;
    renderPlan = function (review) {
      baseRenderPlan(review);
      const button = document.querySelector('#approve-plan');
      if (!button) return;
      const row = button.closest('.row');
      if (review?.live_staging_available && row && !document.querySelector('#approve-live-plan')) {
        const live = document.createElement('button');
        live.id = 'approve-live-plan'; live.className = 'btn'; live.textContent = 'Live Staging 0 € starten';
        live.onclick = () => decidePlan(review.plan_token, 'approve_live_staging');
        row.appendChild(live);
      }
      if (row && !row.parentElement.querySelector('[data-plan-confirmation-hint]')) {
        const hint = document.createElement('div'); hint.className = 'small'; hint.dataset.planConfirmationHint = 'true'; hint.style.marginTop = '8px';
        hint.textContent = review?.live_staging_available ? 'Synthetic: ' + REQUIRED_CONFIRMATION + ' · Live Staging: ' + LIVE_CONFIRMATION : 'Für den Start ist der Bestätigungstext ' + REQUIRED_CONFIRMATION + ' erforderlich.';
        row.insertAdjacentElement('afterend', hint);
      }
    };
  }

  if (typeof renderDeliveries === 'function') {
    const baseRenderDeliveries = renderDeliveries;
    renderDeliveries = function () {
      baseRenderDeliveries();
      const runs = state.data.deliveries?.live_staging_executions || [];
      if (!runs.length) return;
      const target = document.querySelector('#deliveries .card:nth-child(2)');
      if (!target || target.querySelector('[data-live-runtime-evidence]')) return;
      const block = document.createElement('div'); block.dataset.liveRuntimeEvidence = 'true';
      block.innerHTML = '<h3>Runtime Live Staging</h3>' + runs.slice().reverse().map((x) => '<div class="row"><div><strong>' + esc(x.execution_id) + '</strong><div class="small">' + esc(x.scope_key) + ' · ' + fmtMoney(x.variable_cost_eur || 0) + '</div></div>' + badge(x.status) + '</div>').join('');
      target.appendChild(block);
    };
  }
})();
</script>`;

export async function handleOperatorDashboard(request, env = {}, ctx = {}, options = {}) {
  const durable = await handleDurableApi(request, env, ctx, options);
  if (durable) return durable;
  const response = await handleBaseOperatorDashboard(request, env, ctx, options);
  if (!response) return null;

  const url = new URL(request.url);
  const type = response.headers.get('content-type') || '';
  if (!(url.pathname === '/operator' || url.pathname === '/operator/') || !type.includes('text/html') || response.status !== 200) return response;

  const source = await response.text();
  const body = source.includes('</body>') ? source.replace('</body>', `${COMPLETENESS_SCRIPT}</body>`) : `${source}${COMPLETENESS_SCRIPT}`;
  return new Response(body, { status: response.status, statusText: response.statusText, headers: response.headers });
}

export function operatorDashboardCompletenessManifest() {
  return {
    schema: 'riosystems.operator-dashboard-completeness.v1',
    enriches_existing_dashboard_only: true,
    durable_mission_plan_store: true,
    typed_plan_confirmation: SYNTHETIC_CONFIRMATION,
    typed_live_staging_confirmation: LIVE_CONFIRMATION,
    live_staging_requires_server_executor: true,
    live_staging_idempotency_required: true,
    project_filters: ['active','blocked','approval_required','staging','delivery_ready','completed','failed','synthetic','production'],
    backend_authority_unchanged: true,
    direct_provider_calls: false,
    automatic_paid_overflow: false,
    production_deploy: false
  };
}
