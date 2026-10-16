import { renderSiteHeader, renderSiteFooter } from './components/nav.js';
import { hydrateAssetFigures } from './components/asset-image.js';
import { renderRequestForm } from './components/request-form.js';
import { renderRentalInquiry } from './components/rental-inquiry-v128.js';
import { renderCakeInquiry } from './components/cake-inquiry-v127.js';
import { initCakeIpad } from './components/cake-ipad.js';
import { initHeroFlavors } from './components/hero-flavors.js';
import { initDiscoveryFlavors } from './components/discovery-flavors.js';
import { initDiscoveryCups } from './components/discovery-cups.js';

function initCaffeScroll() {
  const section = document.querySelector('[data-caffe-scroll]');
  const visual = section?.querySelector('.v73-caffe__visual');
  if (!visual) return;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const clamp = (value) => Math.max(0, Math.min(1, value));
  let visible = false;
  let currentAngle = 0;
  let targetAngle = 0;
  let frame = 0;
  let lastFrameTime = 0;

  // Measure the untransformed visual wrapper so rotation cannot move its own reference point.
  function measureAngle() {
    const box = visual.getBoundingClientRect();
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    const cupCenter = box.top + box.height / 2;
    // One calm, complete revolution while the cup passes through the viewport.
    const progress = clamp((viewportHeight * 0.95 - cupCenter) / viewportHeight);
    section.style.setProperty('--coffee-focus', (1 - Math.abs(progress - 0.5) * 2).toFixed(3));
    return progress * 360;
  }

  function paint(angle) {
    visual.style.setProperty('--coffee-rotation', `${angle.toFixed(2)}deg`);
  }

  // Time-based damping eliminates trackpad/touch-wheel steps without becoming a free-running spin.
  // No perpetual RAF: stop precisely at the scroll-derived target after the last movement.
  function animate(time) {
    frame = 0;
    if (reducedMotion.matches || !visible || document.hidden) {
      lastFrameTime = 0;
      return;
    }
    const elapsed = lastFrameTime ? Math.min(64, time - lastFrameTime) : 16;
    lastFrameTime = time;
    const smoothing = 1 - Math.exp(-elapsed / 90);
    currentAngle += (targetAngle - currentAngle) * smoothing;
    if (Math.abs(targetAngle - currentAngle) < 0.08) currentAngle = targetAngle;
    paint(currentAngle);
    if (currentAngle !== targetAngle) frame = window.requestAnimationFrame(animate);
    else lastFrameTime = 0;
  }

  function update() {
    targetAngle = measureAngle();
    if (reducedMotion.matches) {
      if (frame) window.cancelAnimationFrame(frame);
      frame = 0;
      lastFrameTime = 0;
      currentAngle = 0;
      paint(0);
      return;
    }
    if (!visible || document.hidden) {
      if (frame) window.cancelAnimationFrame(frame);
      frame = 0;
      lastFrameTime = 0;
      currentAngle = targetAngle;
      paint(currentAngle);
      return;
    }
    if (!frame && Math.abs(targetAngle - currentAngle) > 0.01) {
      frame = window.requestAnimationFrame(animate);
    }
  }

  const observer = new IntersectionObserver((entries) => {
    visible = entries[0].isIntersecting;
    section.classList.toggle('v81-in-view', visible);
    update();
  }, { rootMargin: '120px 0px' });
  observer.observe(section);
  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update, { passive: true });
  document.addEventListener('visibilitychange', update);
  if (reducedMotion.addEventListener) reducedMotion.addEventListener('change', update);
  update();
}


function initLocationReveal() {
  const surface = document.querySelector('[data-location-reveal]');
  if (!surface) return;
  const noMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Progressive enhancement: no JS, reduced motion or missing observer = fully visible map.
  if (noMotion || !('IntersectionObserver' in window)) return;
  document.body.classList.add('location-reveal-ready');
  const observer = new IntersectionObserver((entries) => {
    if (!entries[0]?.isIntersecting) return;
    surface.classList.add('is-revealed');
    observer.disconnect(); // Exactly once.
    // Let the V108 one-shot reveal and its two golden accents finish first.
    // Apply one shared class to start both heartbeat animations in the same frame.
    window.setTimeout(() => {
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        document.body.classList.add('location-heartbeat-active');
      }
    }, 2470);
  }, { threshold: 0.17, rootMargin: '0px 0px -4% 0px' });
  observer.observe(surface);
}

function initLocationNavigation() {
  const dialog = document.querySelector('#gelato-navigation-dialog');
  const links = [...document.querySelectorAll('#standort [data-location-navigation]')];
  if (!dialog || !links.length || typeof dialog.showModal !== 'function') {
    // Google Maps is linked in static HTML for both actions, no JS dependency.
    return;
  }
  const closeButton = dialog.querySelector('[data-navigation-close]');
  const apple = dialog.querySelector('[data-navigation-destination="apple"]');
  const google = dialog.querySelector('[data-navigation-destination="google"]');
  if (!closeButton || !apple || !google) return;
  let opener = null;
  const open = (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey ||
        event.ctrlKey || event.altKey || event.shiftKey) return;
    event.preventDefault();
    opener = event.currentTarget;
    if (!dialog.open) dialog.showModal();
    document.body.classList.add('v113-navigation-open');
    // Native dialog traps focus; explicit initial focus helps VoiceOver users.
    apple.focus({preventScroll:true});
  };
  links.forEach(link => link.addEventListener('click', open));
  const close = () => {
    if (dialog.open) dialog.close();
  };
  closeButton.addEventListener('click', close);
  apple.addEventListener('click', close);
  google.addEventListener('click', close);
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) close(); // native ::backdrop outside click
  });
  dialog.addEventListener('close', () => {
    document.body.classList.remove('v113-navigation-open');
    if (opener?.isConnected) opener.focus({preventScroll:true});
    opener = null;
  });
  // Escape is handled natively; cleanup after cancel is handled by close event.
  // Do not launch either map provider before the visitor makes a choice.
}

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

function initCakeCatalogRequests() {
  const selector = document.querySelector('#eistorten-anfrage-kreation');
  if (!selector) return;
  const variant = document.querySelector('#eistorten-anfrage-variante');
  document.querySelectorAll('[data-request-cake]').forEach((link) => {
    link.addEventListener('click', () => {
      const number = String(link.dataset.requestCake).padStart(2, '0');
      const option = [...selector.options].find((item) => item.value.startsWith('Nr. ' + number + ' · '));
      if (!option) return;
      selector.value = option.value;
      if (variant) {
        const index = Number(number);
        variant.value = index <= 19 ? 'Klassische Eistorte' : index <= 22 ? 'Spaghetti-Eistorte' : 'Eisbombe';
        variant.dispatchEvent(new Event('change', { bubbles: true }));
      }
      selector.dispatchEvent(new Event('change', { bubbles: true }));
    });
  });
}

function initRequestForms() {
  document.querySelectorAll('[data-component="rental-inquiry-form"]').forEach(renderRentalInquiry);
  document.querySelectorAll('[data-component="request-form"]').forEach((host) => {
    renderRequestForm(host, {
      formId: host.dataset.formId,
      fields: JSON.parse(host.dataset.fields)
    });
  });
  document.querySelectorAll('[data-component="cake-interest-form"]').forEach((host) => {
    renderCakeInquiry(host, { fields: JSON.parse(host.dataset.fields) });
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
  initCakeCatalogRequests();
  initCakeGallery();
  initCakeIpad();
  initHeroFlavors();
  initCaffeScroll();
  initLocationReveal();
  initLocationNavigation();
  initDiscoveryFlavors();
  initDiscoveryCups();
}

document.addEventListener('DOMContentLoaded', init);
