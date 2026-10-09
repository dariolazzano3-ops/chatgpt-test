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

function initCakeGallery() {
  const section = document.querySelector('.v6-cake-gallery');
  if (!section) return;
  const cards = [...section.querySelectorAll('[data-cake-category]')];
  const filters = [...section.querySelectorAll('[data-cake-filter]')];
  const count = section.querySelector('.v6-cake-gallery__count');
  const dialog = section.querySelector('.v6-cake-lightbox');
  const largeImage = dialog.querySelector('.v6-cake-lightbox__img');
  const caption = dialog.querySelector('.v6-cake-lightbox__caption');
  const indexLabel = dialog.querySelector('.v6-cake-lightbox__index');
  let current = 0;
  const visibleCards = () => cards.filter(card => !card.hidden);

  filters.forEach(button => button.addEventListener('click', () => {
    const active = button.dataset.cakeFilter;
    filters.forEach(filter => filter.setAttribute('aria-pressed', String(filter === button)));
    cards.forEach(card => { card.hidden = active !== 'alle' && card.dataset.cakeCategory !== active; });
    const quantity = visibleCards().length;
    count.textContent = active === 'alle' ? 'Alle 24 Kreationen' : quantity + ' Kreationen';
  }));

  const show = position => {
    const visible = visibleCards();
    if (!visible.length) return;
    current = (position + visible.length) % visible.length;
    const button = visible[current].querySelector('.v6-cake-gallery__open');
    largeImage.src = button.dataset.cakeImage;
    largeImage.alt = button.dataset.cakeLabel + ' von Gelato Donatello';
    caption.textContent = button.dataset.cakeLabel;
    indexLabel.textContent = (current + 1) + ' / ' + visible.length;
  };

  cards.forEach(card => card.querySelector('.v6-cake-gallery__open').addEventListener('click', () => {
    show(visibleCards().indexOf(card));
    if (typeof dialog.showModal === 'function') dialog.showModal();
  }));

  dialog.querySelector('.v6-cake-lightbox__close').addEventListener('click', () => dialog.close());
  dialog.querySelector('.v6-cake-lightbox__prev').addEventListener('click', () => show(current - 1));
  dialog.querySelector('.v6-cake-lightbox__next').addEventListener('click', () => show(current + 1));
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  dialog.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      show(current + (event.key === 'ArrowLeft' ? -1 : 1));
    }
  });
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
  initCakeGallery();
}

document.addEventListener('DOMContentLoaded', init);
