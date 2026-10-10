import { BUSINESS } from '../data/business.js';

const NAV_ITEMS = [
  { page: 'home', href: '/', label: 'Start' },
  { page: 'eisbecher', href: '/eisbecher/', label: 'Eisbecher' },
  { page: 'eistorten', href: '/eistorten/', label: 'Eistorten & Eisbomben' },
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
      <div class="site-header__brand-group">
        <a class="site-header__brand" href="/" aria-label="${BUSINESS.name} – Startseite">
        <img class="site-header__logo" src="/assets/images/brand/logo-donatello-header.webp" alt="${BUSINESS.name}" />
        <span class="site-header__since">Familiengeführt seit 1965</span>
        </a>
        <a class="site-header__call" href="${BUSINESS.phoneHref}" aria-label="Gelato Donatello anrufen: ${BUSINESS.phone}" title="Jetzt anrufen">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.37 1.91.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.33 1.85.57 2.81.7A2 2 0 0 1 22 16.92Z"/>
          </svg>
        </a>
      </div>
      <button class="nav__toggle" type="button" aria-label="Menü öffnen" aria-expanded="false" aria-controls="primary-nav">
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
    toggle.setAttribute('aria-label', open ? 'Menü öffnen' : 'Menü schließen');
    document.body.classList.toggle('nav-open', !open);
  });
  nav.querySelectorAll('.nav__link').forEach((link) => link.addEventListener('click', () => {
    nav.setAttribute('data-state', 'closed');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Menü öffnen');
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
