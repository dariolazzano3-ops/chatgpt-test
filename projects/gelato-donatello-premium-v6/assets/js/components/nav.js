import { BUSINESS } from '../data/business.js';

const NAV_ITEMS = [
  { page: 'home', href: '/', label: 'Start' },
  { page: 'eisbecher', href: '/eisbecher/', label: 'Eisbecher' },
  { page: 'eistorten', href: '/eistorten/', label: 'Eistorten' },
  { page: 'eisvitrine', href: '/eisvitrine/', label: 'Eisvitrine mieten' },
  { page: 'kontakt', href: '/kontakt/', label: 'Kontakt' }
];

export function renderSiteHeader(activePage) {
  const header = document.getElementById('site-header');
  if (!header) return;
  const links = NAV_ITEMS.map((item) => {
    const active = item.page === activePage;
    return `<li class="nav__item"><a class="nav__link" href="${item.href}"${active ? ' aria-current="page"' : ''}>${item.label}</a></li>`;
  }).join('');

  header.innerHTML = `
    <div class="site-header__bar">
      <a class="site-header__brand" href="/" aria-label="${BUSINESS.name} – Startseite">
        <img class="site-header__logo" src="/assets/images/brand/logo-donatello-header.webp" alt="${BUSINESS.name}" />
        <span class="site-header__since">Familiengeführt seit 1965</span>
      </a>
      <button class="nav__toggle" type="button" aria-expanded="false" aria-controls="primary-nav">
        <span>Menü</span><span class="nav__toggle-icon" aria-hidden="true"></span>
      </button>
      <nav id="primary-nav" class="nav" aria-label="Hauptnavigation" data-state="closed">
        <ul class="nav__list">${links}</ul>
      </nav>
    </div>
  `;

  const toggle = header.querySelector('.nav__toggle');
  const nav = header.querySelector('.nav');
  toggle.addEventListener('click', () => {
    const open = nav.getAttribute('data-state') === 'open';
    nav.setAttribute('data-state', open ? 'closed' : 'open');
    toggle.setAttribute('aria-expanded', String(!open));
    document.body.classList.toggle('nav-open', !open);
  });
  nav.querySelectorAll('.nav__link').forEach((link) => link.addEventListener('click', () => {
    nav.setAttribute('data-state', 'closed');
    toggle.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('nav-open');
  }));
}

export function renderSiteFooter() {
  const footer = document.getElementById('site-footer');
  if (!footer) return;
  const links = NAV_ITEMS.slice(1).map(item => `<a href="${item.href}">${item.label}</a>`).join('');
  footer.innerHTML = `
    <div class="site-footer__inner">
      <div class="site-footer__brand-block">
        <img class="site-footer__logo" src="/assets/images/brand/logo-donatello.webp" alt="${BUSINESS.name}" />
        <p>Familiengeführt seit ${BUSINESS.foundingYear}. Zweite Generation. Eigenes Eislabor.</p>
      </div>
      <div class="site-footer__contact">
        <span class="site-footer__label">Besuch</span>
        <address>${BUSINESS.address.street}<br>${BUSINESS.address.postalCode} ${BUSINESS.address.city}</address>
        <a href="${BUSINESS.phoneHref}">${BUSINESS.phone}</a>
      </div>
      <div class="site-footer__nav">
        <span class="site-footer__label">Entdecken</span>
        ${links}
      </div>
    </div>
    <div class="site-footer__legal">
      <span>Private V6 Vorschau · noindex</span>
      <span>Produktiv-Domain unverändert</span>
    </div>
  `;
}
