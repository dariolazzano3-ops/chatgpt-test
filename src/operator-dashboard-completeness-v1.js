import { handleOperatorDashboard as handleBaseOperatorDashboard } from './operator-dashboard-http-v1.js';

const COMPLETENESS_SCRIPT = String.raw`<script>
(() => {
  const REQUIRED_CONFIRMATION = 'CONFIRM_SYNTHETIC_STAGING';
  const FILTER_OPTIONS = [
    ['all', 'Alle Projekte'],
    ['active', 'Aktiv'],
    ['blocked', 'Blockiert'],
    ['approval_required', 'Approval erforderlich'],
    ['staging', 'Staging'],
    ['delivery_ready', 'Delivery Ready'],
    ['completed', 'Abgeschlossen'],
    ['failed', 'Fehlgeschlagen'],
    ['synthetic', 'Synthetisch'],
    ['production', 'Production']
  ];

  if (typeof projectRows === 'function') {
    projectRows = function () {
      const items = state.data.projects?.items || [];
      const query = state.projectQuery.toLowerCase();
      return items.filter((project) => {
        const matchesQuery = !query || [project.name, project.project_id, project.customer_id, project.scope_key]
          .some((value) => String(value || '').toLowerCase().includes(query));
        const tags = new Set((project.filter_tags || []).map((value) => String(value).toLowerCase()));
        const selected = String(state.projectStatus || 'all').toLowerCase();
        const matchesFilter = selected === 'all'
          || tags.has(selected)
          || String(project.state || '').toLowerCase() === selected
          || String(project.mission_status || '').toLowerCase() === selected;
        return matchesQuery && matchesFilter;
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
      if (decision === 'approve') {
        const entered = window.prompt('Bestätigungstext eingeben:\n' + REQUIRED_CONFIRMATION, '');
        if (entered === null) return null;
        confirmationText = String(entered).trim();
        if (confirmationText !== REQUIRED_CONFIRMATION) {
          setError(new Error('Freigabe nicht ausgeführt: Bestätigungstext stimmt nicht überein.'));
          return null;
        }
      }
      try {
        const result = await api('/mission-plan-decision', {
          method: 'POST',
          body: JSON.stringify({ plan_token: token, decision, confirmation_text: confirmationText })
        });
        if (decision === 'approve') {
          state.plan = null;
          await loadAll();
          go('deliveries');
        } else {
          await loadAll();
          go('approvals');
        }
        return result;
      } catch (error) {
        setError(error);
        return null;
      }
    };
  }

  if (typeof renderApprovals === 'function') {
    const baseRenderApprovals = renderApprovals;
    renderApprovals = function () {
      baseRenderApprovals();
      document.querySelectorAll('.plan-action[data-decision="approve"]').forEach((button) => {
        const card = button.closest('.cap');
        if (!card || card.querySelector('[data-confirmation-hint]')) return;
        const hint = document.createElement('div');
        hint.className = 'small';
        hint.dataset.confirmationHint = 'true';
        hint.style.marginTop = '8px';
        hint.textContent = 'Erforderlicher Bestätigungstext: ' + REQUIRED_CONFIRMATION;
        const actions = button.closest('.actions');
        if (actions) actions.insertAdjacentElement('afterend', hint);
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
      if (!row || row.parentElement.querySelector('[data-plan-confirmation-hint]')) return;
      const hint = document.createElement('div');
      hint.className = 'small';
      hint.dataset.planConfirmationHint = 'true';
      hint.style.marginTop = '8px';
      hint.textContent = 'Für den Start ist der Bestätigungstext ' + REQUIRED_CONFIRMATION + ' erforderlich.';
      row.insertAdjacentElement('afterend', hint);
    };
  }
})();
</script>`;

export async function handleOperatorDashboard(request, env = {}, ctx = {}, options = {}) {
  const response = await handleBaseOperatorDashboard(request, env, ctx, options);
  if (!response) return null;

  const url = new URL(request.url);
  const type = response.headers.get('content-type') || '';
  if (!(url.pathname === '/operator' || url.pathname === '/operator/') || !type.includes('text/html') || response.status !== 200) {
    return response;
  }

  const source = await response.text();
  const body = source.includes('</body>')
    ? source.replace('</body>', `${COMPLETENESS_SCRIPT}</body>`)
    : `${source}${COMPLETENESS_SCRIPT}`;
  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers
  });
}

export function operatorDashboardCompletenessManifest() {
  return {
    schema: 'riosystems.operator-dashboard-completeness.v1',
    enriches_existing_dashboard_only: true,
    typed_plan_confirmation: 'CONFIRM_SYNTHETIC_STAGING',
    project_filters: ['active','blocked','approval_required','staging','delivery_ready','completed','failed','synthetic','production'],
    backend_authority_unchanged: true,
    direct_provider_calls: false,
    automatic_paid_overflow: false,
    production_deploy: false
  };
}
