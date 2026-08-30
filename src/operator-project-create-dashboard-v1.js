import { handleOperatorDashboard as handleBaseOperatorDashboard } from './operator-dashboard-completeness-v1.js';

const clean = (value, max = 500) => String(value ?? '').trim().slice(0, max);

function json(body, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' }
  });
}

async function readBody(request) {
  try { return await request.clone().json(); } catch { return {}; }
}

async function authorizeThroughBase(request, env, ctx, options) {
  const url = new URL(request.url);
  url.pathname = '/operator/api/approvals';
  const probe = new Request(url.toString(), { method: 'GET', headers: request.headers });
  return handleBaseOperatorDashboard(probe, env, ctx, options);
}

async function handleProjectCreate(request, env, ctx, options = {}) {
  const url = new URL(request.url);
  if (request.method !== 'POST' || url.pathname !== '/operator/api/projects/create') return null;
  const service = options.runtime_service;
  if (!service || typeof service.handle !== 'function') {
    return json({ error: 'OPERATOR_RUNTIME_SERVICE_REQUIRED', production_deploy: false }, 503);
  }

  const auth = await authorizeThroughBase(request, env, ctx, options);
  if (!auth || auth.status !== 200) return auth;
  const body = await readBody(request);
  const expectedRevision = Number(body.expected_revision);
  if (!Number.isInteger(expectedRevision)) {
    return json({ error: 'RUNTIME_EXPECTED_REVISION_REQUIRED', production_deploy: false }, 409);
  }

  const command = {
    type: 'CREATE_PROJECT',
    expected_revision: expectedRevision,
    customer_id: clean(body.customer_id, 160),
    project_id: clean(body.project_id, 160),
    scope_key: clean(body.scope_key, 320) || undefined,
    business_name: clean(body.business_name, 220),
    industry: clean(body.industry, 160),
    country: clean(body.country, 80),
    language: clean(body.language, 40),
    mission_context: clean(body.mission_context, 4000),
    allowed_environments: ['staging'],
    data_policy: { synthetic_only: true, real_customer_data: false },
    budget_policy: { variable_cost_ceiling_eur: 0, paid_overflow: false },
    production_authorized: false,
    production_deploy: false
  };

  const result = await service.handle({ method: 'POST', path: '/commands', body: command });
  if (!result.ok) return json(result.body, result.status || 400);
  const evaluated = result.body?.command || {};
  return json({
    schema: 'riosystems.operator-project-create.v1',
    status: evaluated.idempotent_existing ? 'EXISTS' : 'CREATED',
    project: evaluated.project || null,
    scope_key: evaluated.scope_key || null,
    runtime_revision: result.runtime?.revision ?? result.body?.runtime_revision ?? null,
    idempotent_replay: evaluated.idempotent_existing === true,
    external_side_effect_performed: false,
    variable_cost_eur: 0,
    production_deploy: false
  }, evaluated.idempotent_existing ? 200 : 201);
}

const PROJECT_SCRIPT = String.raw`<script>
(() => {
  if (typeof renderProjects !== 'function') return;
  const baseRenderProjects = renderProjects;
  renderProjects = function () {
    baseRenderProjects();
    const section = document.querySelector('#projects');
    if (!section || section.querySelector('[data-project-create]')) return;
    const card = document.createElement('div');
    card.className = 'card project-detail';
    card.dataset.projectCreate = 'true';
    card.innerHTML = '<div class="row"><div><div class="eyebrow">Authoritative Runtime Command</div><h2 style="margin:3px 0">Neues Projekt anlegen</h2><div class="small">Das Projekt wird serverseitig im Runtime-Portfolio erstellt. Staging · synthetische Daten · 0 € · Production gesperrt.</div></div>'+badge('READY')+'</div>'+
      '<form id="project-create-form" class="form-grid">'+
      '<div class="field"><label>Kunden-ID</label><input name="customer_id" required placeholder="z. B. mueller-elektro"></div>'+
      '<div class="field"><label>Projekt-ID</label><input name="project_id" required placeholder="z. B. digital-system-v1"></div>'+
      '<div class="field full"><label>Unternehmensname</label><input name="business_name" required placeholder="z. B. Müller Elektrotechnik"></div>'+
      '<div class="field"><label>Branche</label><input name="industry" required placeholder="handwerk"></div>'+
      '<div class="field"><label>Land</label><input name="country" value="DE" required></div>'+
      '<div class="field"><label>Sprache</label><input name="language" value="de" required></div>'+
      '<div class="field"><label>Environment</label><input class="locked" value="staging" disabled></div>'+
      '<div class="field full"><label>Mission Context</label><textarea name="mission_context" placeholder="Optionaler Ausgangskontext für kommende Missionen"></textarea></div>'+
      '<div class="field"><label>Daten</label><input class="locked" value="synthetic_only" disabled></div>'+
      '<div class="field"><label>Budget</label><input class="locked" value="0 € variable Kosten" disabled></div>'+
      '<div class="field full"><button class="btn primary" type="submit">Projekt autoritativ anlegen</button></div></form>';
    section.appendChild(card);
    const form = document.querySelector('#project-create-form');
    form.onsubmit = async (event) => {
      event.preventDefault(); setError(null);
      const revision = Number(state.data.approvals?.runtime_revision);
      if (!Number.isInteger(revision)) { setError(new Error('Aktuelle Runtime Revision ist nicht verfügbar.')); return; }
      const fd = new FormData(form);
      try {
        const result = await api('/projects/create', { method: 'POST', body: JSON.stringify({
          expected_revision: revision,
          customer_id: fd.get('customer_id'), project_id: fd.get('project_id'), business_name: fd.get('business_name'),
          industry: fd.get('industry'), country: fd.get('country'), language: fd.get('language'), mission_context: fd.get('mission_context')
        }) });
        await loadAll();
        state.selectedScope = result.scope_key || state.selectedScope;
        go('projects');
      } catch (error) { setError(error); }
    };
  };
})();
</script>`;

export async function handleOperatorDashboard(request, env = {}, ctx = {}, options = {}) {
  const created = await handleProjectCreate(request, env, ctx, options);
  if (created) return created;
  const response = await handleBaseOperatorDashboard(request, env, ctx, options);
  if (!response) return null;
  const url = new URL(request.url);
  const type = response.headers.get('content-type') || '';
  if (!(url.pathname === '/operator' || url.pathname === '/operator/') || response.status !== 200 || !type.includes('text/html')) return response;
  const source = await response.text();
  const body = source.includes('</body>') ? source.replace('</body>', `${PROJECT_SCRIPT}</body>`) : `${source}${PROJECT_SCRIPT}`;
  return new Response(body, { status: response.status, statusText: response.statusText, headers: response.headers });
}

export function operatorProjectCreateDashboardManifest() {
  return {
    schema: 'riosystems.operator-project-create-dashboard.v1',
    authoritative_command: 'CREATE_PROJECT',
    runtime_cas_required: true,
    frontend_state_authoritative: false,
    allowed_environments: ['staging'],
    synthetic_only: true,
    variable_cost_ceiling_eur: 0,
    paid_overflow: false,
    external_side_effects: false,
    production_deploy: false
  };
}
