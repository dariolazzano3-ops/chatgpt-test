const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

document.querySelector('[data-year]').textContent = new Date().getFullYear();

const menuButton = document.querySelector('[data-menu-button]');
const mobileMenu = document.querySelector('[data-mobile-menu]');
function setMobileMenu(open) {
  if (!menuButton || !mobileMenu) return;
  menuButton.setAttribute('aria-expanded', String(open));
  menuButton.setAttribute('aria-label', open ? 'Navigation schließen' : 'Navigation öffnen');
  mobileMenu.hidden = !open;
}
if (menuButton && mobileMenu) {
  menuButton.addEventListener('click', () => {
    setMobileMenu(menuButton.getAttribute('aria-expanded') !== 'true');
  });
  mobileMenu.addEventListener('click', (event) => {
    if (event.target.closest('a')) setMobileMenu(false);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && menuButton.getAttribute('aria-expanded') === 'true') {
      setMobileMenu(false);
      menuButton.focus();
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
    emitEvent('contact_validation_success');
  });
  intakeForm.addEventListener('focusin', () => emitEvent('contact_form_start'), { once: true });
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
