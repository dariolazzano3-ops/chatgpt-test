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

  document.querySelectorAll('[data-gated-upgrade]').forEach((button) => {
    button.addEventListener('click', () => show('Pricing and upgrade state are read from the canonical HAMYREN Product Surface. Billing remains closed.'));
  });
})();
