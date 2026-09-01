const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const hamyrenHref = './hamyren/index.html';
function installHamyrenEntryPoints() {
  const desktopNav = document.querySelector('.desktop-nav');
  if (desktopNav && !desktopNav.querySelector('[data-hamyren-entry]')) {
    const link = document.createElement('a');
    link.href = hamyrenHref;
    link.dataset.hamyrenEntry = '';
    link.textContent = 'HAMYREN';
    desktopNav.append(link);
  }

  const mobile = document.querySelector('[data-mobile-menu]');
  if (mobile && !mobile.querySelector('[data-hamyren-entry]')) {
    const link = document.createElement('a');
    link.href = hamyrenHref;
    link.dataset.hamyrenEntry = '';
    link.textContent = 'HAMYREN · Business AI';
    const project = mobile.querySelector('.button');
    if (project) mobile.insertBefore(link, project); else mobile.append(link);
  }

  const heroActions = document.querySelector('.hero .cta-row');
  if (heroActions && !heroActions.querySelector('[data-hamyren-entry]')) {
    const link = document.createElement('a');
    link.className = 'button button-ghost';
    link.href = hamyrenHref;
    link.dataset.hamyrenEntry = '';
    link.dataset.event = 'hamyren_entry_click';
    link.innerHTML = 'HAMYREN testen <span aria-hidden="true">→</span>';
    heroActions.append(link);
  }
}
installHamyrenEntryPoints();

document.querySelector('[data-year]').textContent = new Date().getFullYear();

const menuButton = document.querySelector('[data-menu-button]');
const mobileMenu = document.querySelector('[data-mobile-menu]');
if (menuButton && mobileMenu) {
  menuButton.addEventListener('click', () => {
    const open = menuButton.getAttribute('aria-expanded') === 'true';
    menuButton.setAttribute('aria-expanded', String(!open));
    mobileMenu.hidden = open;
  });
  mobileMenu.addEventListener('click', (event) => {
    if (event.target.closest('a')) {
      menuButton.setAttribute('aria-expanded', 'false');
      mobileMenu.hidden = true;
    }
  });
}

const revealItems = document.querySelectorAll('.reveal');
if (reducedMotion || !('IntersectionObserver' in window)) {
  revealItems.forEach((node) => node.classList.add('is-visible'));
} else {
  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      obs.unobserve(entry.target);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -4% 0px' });
  revealItems.forEach((node) => observer.observe(node));
}

const intakeDialog = document.querySelector('[data-intake-dialog]');
const intakeForm = document.querySelector('[data-intake-form]');
const formResult = document.querySelector('[data-form-result]');
document.querySelectorAll('[data-open-intake]').forEach((button) => {
  button.addEventListener('click', () => intakeDialog?.showModal());
});

if (intakeForm) {
  intakeForm.addEventListener('submit', (event) => {
    const submitter = event.submitter;
    if (submitter?.value === 'cancel') return;
    event.preventDefault();
    if (!intakeForm.reportValidity()) return;
    if (formResult) formResult.textContent = 'Staging-Validierung erfolgreich. Es wurden keine Daten übertragen.';
    emitEvent('form_submit_success');
  });
  intakeForm.addEventListener('focusin', () => emitEvent('form_start'), { once: true });
}

const supportedLocales = ['de', 'en', 'fr', 'it', 'es', 'nl', 'pl', 'pt'];
const localeSelect = document.querySelector('[data-locale]');
const storedLocale = localStorage.getItem('riosystems_locale');
const browserLocale = navigator.language?.slice(0, 2).toLowerCase();
const preferredLocale = supportedLocales.includes(storedLocale) ? storedLocale : supportedLocales.includes(browserLocale) ? browserLocale : 'de';
if (localeSelect) {
  localeSelect.value = preferredLocale;
  localeSelect.addEventListener('change', () => {
    localStorage.setItem('riosystems_locale', localeSelect.value);
    emitEvent('language_change', { locale: localeSelect.value });
    if (localeSelect.value !== 'de') {
      localeSelect.setCustomValidity('');
      alert('Die Spracharchitektur ist vorbereitet. Die vollständigen Übersetzungen folgen in einem späteren Content-Pass.');
    }
  });
}

document.querySelectorAll('[data-event]').forEach((node) => {
  node.addEventListener('click', () => emitEvent(node.dataset.event));
});

function emitEvent(name, properties = {}) {
  window.dispatchEvent(new CustomEvent('riosystems:analytics', {
    detail: { name, properties: { ...properties, page: 'public_home_v1' } }
  }));
}

emitEvent('page_view');
