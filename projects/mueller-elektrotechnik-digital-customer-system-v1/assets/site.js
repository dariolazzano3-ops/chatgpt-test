(() => {
  const toggle = document.querySelector('.nav-toggle');
  const menu = document.querySelector('#nav-menu');
  const setMenu = (open) => {
    if (!toggle || !menu) return;
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Navigation schließen' : 'Navigation öffnen');
    menu.dataset.open = String(open);
  };
  toggle?.addEventListener('click', () => setMenu(toggle.getAttribute('aria-expanded') !== 'true'));
  menu?.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => setMenu(false)));
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && toggle?.getAttribute('aria-expanded') === 'true') { setMenu(false); toggle.focus(); } });
  const form = document.querySelector('[data-lead-form]');
  const result = document.querySelector('[data-form-result]');
  document.querySelectorAll('[data-service]').forEach((link) => link.addEventListener('click', () => {
    const select = form?.elements?.project_type;
    if (select) select.value = link.dataset.service || '';
  }));
  form?.addEventListener('submit', (event) => {
    event.preventDefault();
    [...form.elements].forEach((field) => field.classList?.remove('field-error'));
    if (!form.checkValidity()) {
      form.querySelectorAll(':invalid').forEach((field) => field.classList.add('field-error'));
      form.reportValidity();
      if (result) { result.hidden = false; result.textContent = 'Bitte prüfen Sie die markierten Pflichtfelder.'; }
      return;
    }
    if (document.documentElement.dataset.riosystemsSyntheticE2e === 'true') {
      const projectType = String(form.elements?.project_type?.value || '').trim().slice(0, 80);
      window.dispatchEvent(new CustomEvent('aurentara:synthetic-lead-ready', {
        detail: {
          schema: 'aurentara.synthetic-form-lead.v1',
          project_id: 'mueller-elektrotechnik-digital-customer-system-v1',
          scope_key: 'synthetic-mueller-elektrotechnik-saarbruecken:mueller-elektrotechnik-digital-customer-system-v1',
          idempotency_key: 'mueller-elektrotechnik-digital-customer-system-v1-synthetic-lead-001',
          project_type: projectType,
          environment: 'staging',
          synthetic: true,
          pii_in_event: false,
          production_deploy: false
        }
      }));
    }
    if (result) {
      result.hidden = false;
      result.textContent = 'Testmodus: Die Anfrage ist vollständig und wurde lokal validiert. Es wurden keine Daten übertragen oder gespeichert.';
    }
  });
})();
