import { renderSiteHeader, renderSiteFooter } from './components/nav.js';
import { hydrateAssetFigures } from './components/asset-image.js';
import { renderRequestForm } from './components/request-form.js';

function initReveal() {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const targets = document.querySelectorAll('[data-reveal]');
  if (prefersReducedMotion || !('IntersectionObserver' in window)) {
    targets.forEach((el) => el.classList.add('is-visible'));
    return;
  }
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.01, rootMargin: '0px 0px 8% 0px' });
  targets.forEach((el) => observer.observe(el));
}

function initRequestForms() {
  document.querySelectorAll('[data-component="request-form"]').forEach((host) => {
    renderRequestForm(host, {
      formId: host.dataset.formId,
      fields: JSON.parse(host.dataset.fields)
    });
  });
}

function init() {
  document.body.classList.add('reveal-enabled');
  const activePage = document.body.dataset.page || '';
  renderSiteHeader(activePage);
  renderSiteFooter();
  hydrateAssetFigures(document);
  initReveal();

  initRequestForms();
}

document.addEventListener('DOMContentLoaded', init);
