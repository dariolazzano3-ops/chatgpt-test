(() => {
  'use strict';

  const toast = document.querySelector('[data-toast]');
  const show = (message) => {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    window.clearTimeout(show.timer);
    show.timer = window.setTimeout(() => toast.classList.remove('show'), 3200);
  };

  // The static HAMYREN overview is presentation only. Pricing truth belongs exclusively
  // to the existing economics/entitlement runtime exposed by the canonical /customer surface.
  const pricingGrid = document.querySelector('#plans .pricing-grid');
  if (pricingGrid) {
    pricingGrid.innerHTML = `
      <article class="plan featured" data-canonical-pricing-bridge>
        <div class="plan-top"><span class="plan-label">Canonical Plan Catalog</span><span class="plan-badge">Runtime source</span></div>
        <h3>Pricing lives in the HAMYREN Product Surface.</h3>
        <p class="plan-note">Plan names, prices, compute limits, features and upgrade state are read from the existing Economics / Entitlement Core. This overview keeps no independent pricing truth.</p>
        <a class="button button-blue" href="/customer">Open Usage & Plan →</a>
      </article>`;
  }

  document.querySelectorAll('[data-gated-upgrade]').forEach((button) => {
    button.addEventListener('click', () => show('Pricing and upgrade state are read from the canonical HAMYREN Product Surface. Billing remains closed.'));
  });
})();
