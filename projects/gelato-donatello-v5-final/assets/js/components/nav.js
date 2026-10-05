// Gemeinsame Kopf- und Fusszeile. Eine einzige Quelle fuer Navigation und
// Footer, damit Aenderungen nicht auf sechs Seiten einzeln gepflegt werden
// muessen. Wird in jede Seite ueber ein leeres <div id="site-header"> /
// <div id="site-footer"> eingehaengt.
import { BUSINESS } from '../data/business.js';

const NAV_ITEMS = [
  { page: 'home', href: '/', label: 'Start' },
  { page: 'sortiment', href: '/sortiment/', label: 'Sortiment' },
  { page: 'eisbecher', href: '/eisbecher/', label: 'Eisbecher' },
  { page: 'eistorten-eisbomben', href: '/eistorten-eisbomben/', label: 'Eistorten & Eisbomben' },
  { page: 'eisvitrine', href: '/eisvitrine/', label: 'Eisvitrine' },
  { page: 'kontakt', href: '/kontakt/', label: 'Besuch / Kontakt' }
];

export function renderSiteHeader(activePage) {
  const header = document.getElementById('site-header');
  if (!header) return;

  const links = NAV_ITEMS.map((item) => {
    const isActive = item.page === activePage;
    return `<li class="nav__item">
      <a class="nav__link" href="${item.href}"${isActive ? ' aria-current="page"' : ''}>${item.label}</a>
    </li>`;
  }).join('');

  header.innerHTML = `
    <div class="site-header__bar container">
      <a class="site-header__brand" href="/" aria-label="${BUSINESS.name} – Startseite"><img class="site-header__logo" src="/assets/images/brand/logo-donatello.webp" alt="${BUSINESS.name}" /></a>
      <button class="nav__toggle" type="button" aria-expanded="false" aria-controls="primary-nav">
        <span class="nav__toggle-label">Menu</span>
      </button>
      <nav id="primary-nav" class="nav" aria-label="Hauptnavigation" data-state="closed">
        <ul class="nav__list">${links}</ul>
      </nav>
    </div>
  `;

  const toggle = header.querySelector('.nav__toggle');
  const nav = header.querySelector('.nav');

  toggle.addEventListener('click', () => {
    const isOpen = nav.getAttribute('data-state') === 'open';
    nav.setAttribute('data-state', isOpen ? 'closed' : 'open');
    toggle.setAttribute('aria-expanded', String(!isOpen));
  });

  nav.querySelectorAll('.nav__link').forEach((link) => {
    link.addEventListener('click', () => {
      nav.setAttribute('data-state', 'closed');
      toggle.setAttribute('aria-expanded', 'false');
    });
  });
}

export function renderSiteFooter() {
  const footer = document.getElementById('site-footer');
  if (!footer) return;

  footer.innerHTML = `
    <div class="site-footer__bar container">
      <p class="site-footer__brand">${BUSINESS.name} &mdash; familiengefuehrt seit ${BUSINESS.foundingYear}.</p>
      <p class="site-footer__address">${BUSINESS.address.street}, ${BUSINESS.address.postalCode} ${BUSINESS.address.city} &middot; <a href="${BUSINESS.phoneHref}">${BUSINESS.phone}</a></p>
      <p class="site-footer__note">Private Vorschau &mdash; nicht fuer Suchmaschinen bestimmt.</p>
    </div>
  `;
}
