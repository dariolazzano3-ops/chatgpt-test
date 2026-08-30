const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const attr = (value) => esc(value).replace(/`/g, '&#96;');

const UI = {
  de: {
    home: 'Startseite', menu: 'Menü', primary_navigation: 'Hauptnavigation', legal_navigation: 'Rechtliches', legal_notice: 'Impressum', privacy: 'Datenschutz',
    overview: 'Überblick', benefits: 'Vorteile', clarity: 'Klar aufgebaut.', services: 'Leistungen', services_heading: 'Wobei wir helfen können.',
    about: 'Über uns', testimonials: 'Stimmen', testimonials_heading: 'Freigegebene Kundenstimmen.', gallery: 'Galerie', gallery_heading: 'Ausgewählte Arbeiten.',
    faq_heading: 'Häufige Fragen.', next_step: 'Nächster Schritt', contact: 'Kontakt', name: 'Name', email: 'E-Mail', message: 'Nachricht',
    disabled_form_title: 'Formularversand benötigt eine freigegebene Integration', disabled_form_note: 'Der Formularversand ist im Staging deaktiviert, bis eine freigegebene Integration verbunden ist.',
    placeholder: 'Platzhalter', benefit_body: 'Klare Information, wiederverwendbare Struktur und ein eindeutiger nächster Schritt.', customer: 'Kunde'
  },
  en: {
    home: 'Home', menu: 'Menu', primary_navigation: 'Primary navigation', legal_navigation: 'Legal', legal_notice: 'Legal Notice', privacy: 'Privacy',
    overview: 'Overview', benefits: 'Benefits', clarity: 'Built for clarity.', services: 'Services', services_heading: 'What we can help with.',
    about: 'About', testimonials: 'Testimonials', testimonials_heading: 'Approved customer proof.', gallery: 'Gallery', gallery_heading: 'Selected work.',
    faq_heading: 'Common questions.', next_step: 'Next step', contact: 'Contact', name: 'Name', email: 'Email', message: 'Message',
    disabled_form_title: 'Form delivery requires an approved integration', disabled_form_note: 'Form delivery is disabled in staging until an approved integration is connected.',
    placeholder: 'Placeholder', benefit_body: 'Focused information, reusable structure and a clear next action.', customer: 'Customer'
  }
};

function ui(mission, key) {
  const language = String(mission?.language || 'en').toLowerCase().startsWith('de') ? 'de' : 'en';
  return UI[language][key] || UI.en[key] || key;
}

function hrefFor(currentPath, targetPath) {
  if (targetPath === currentPath) return './';
  if (currentPath === '/') return targetPath === '/' ? './' : `.${targetPath}`;
  if (targetPath === '/') return '../';
  return `../${targetPath.replace(/^\//, '')}`;
}

export function renderHeader({ mission, blueprint, page }) {
  const links = blueprint.navigation.map((item) => `<a href="${attr(hrefFor(page.path, item.path))}"${item.path === page.path ? ' aria-current="page"' : ''}>${esc(item.label)}</a>`).join('');
  return `<header class="site-header" data-component="Header"><div class="container header-row"><a class="brand" href="${attr(hrefFor(page.path, '/'))}" aria-label="${esc(mission.business_name)} ${esc(ui(mission, 'home'))}">${esc(mission.business_name)}</a><button class="nav-toggle" type="button" aria-expanded="false" aria-controls="primary-navigation">${esc(ui(mission, 'menu'))}</button><nav id="primary-navigation" class="site-nav" aria-label="${esc(ui(mission, 'primary_navigation'))}" data-open="false">${links}</nav></div></header>`;
}

export function renderFooter({ mission, page }) {
  return `<footer class="site-footer" data-component="Footer"><div class="container footer-row"><div><strong>${esc(mission.business_name)}</strong><div class="muted">${esc(mission.brand_positioning)}</div></div><nav class="legal-links" aria-label="${esc(ui(mission, 'legal_navigation'))}"><a href="${attr(hrefFor(page.path, '/legal-notice/'))}">${esc(ui(mission, 'legal_notice'))}</a><a href="${attr(hrefFor(page.path, '/privacy/'))}">${esc(ui(mission, 'privacy'))}</a></nav></div></footer>`;
}

function hero(content, mission) {
  return `<section class="section" data-component="Hero"><div class="container"><div class="eyebrow">${esc(ui(mission, 'overview'))}</div><h1>${esc(content.headline)}</h1><p class="lead">${esc(content.subheadline)}</p><div class="actions"><a class="button primary" href="${attr(content.cta.href)}">${esc(content.cta.label)}</a></div></div></section>`;
}

function featureGrid(content, mission) {
  const items = (content.benefits || []).slice(0, 6).map((benefit) => `<article class="card"><h3>${esc(benefit)}</h3><p>${esc(ui(mission, 'benefit_body'))}</p></article>`).join('');
  return items ? `<section class="section surface" data-component="FeatureGrid"><div class="container"><div class="eyebrow">${esc(ui(mission, 'benefits'))}</div><h2>${esc(ui(mission, 'clarity'))}</h2><div class="grid">${items}</div></div></section>` : '';
}

function services(content, mission) {
  const items = (content.services || []).map((item) => `<article class="card"><h3>${esc(item.title || item)}</h3><p>${esc(item.body || '')}</p></article>`).join('');
  return `<section class="section" data-component="Services"><div class="container"><div class="eyebrow">${esc(ui(mission, 'services'))}</div><h2>${esc(ui(mission, 'services_heading'))}</h2><div class="grid">${items}</div></div></section>`;
}

function about(content, mission) {
  return `<section class="section surface" data-component="About"><div class="container split"><div><div class="eyebrow">${esc(ui(mission, 'about'))}</div><h2>${esc(content.headline)}</h2></div><div><p class="lead">${esc(content.body)}</p></div></div></section>`;
}

function stats(content) {
  const values = (content.stats || []).slice(0, 6);
  if (!values.length) return '';
  return `<section class="section" data-component="Stats"><div class="container stat-grid">${values.map((item) => `<div class="stat"><strong>${esc(item.value)}</strong><span>${esc(item.label)}</span></div>`).join('')}</div></section>`;
}

function testimonials(content, mission) {
  const values = (content.testimonials || []).slice(0, 6);
  if (!values.length) return '';
  return `<section class="section surface" data-component="Testimonials"><div class="container"><div class="eyebrow">${esc(ui(mission, 'testimonials'))}</div><h2>${esc(ui(mission, 'testimonials_heading'))}</h2><div class="grid">${values.map((item) => `<figure class="card"><blockquote>${esc(item.quote)}</blockquote><figcaption>${esc(item.name || ui(mission, 'customer'))}</figcaption></figure>`).join('')}</div></div></section>`;
}

function gallery(content, mission) {
  const values = (content.gallery || []).slice(0, 9);
  if (!values.length) return '';
  return `<section class="section" data-component="Gallery"><div class="container"><div class="eyebrow">${esc(ui(mission, 'gallery'))}</div><h2>${esc(ui(mission, 'gallery_heading'))}</h2><div class="grid">${values.map((item) => `<figure class="card"><img src="${attr(item.src)}" alt="${attr(item.alt || '')}" loading="lazy"><figcaption>${esc(item.caption || '')}</figcaption></figure>`).join('')}</div></div></section>`;
}

function faq(content, mission) {
  const values = content.faq || [];
  return `<section class="section" data-component="FAQ"><div class="narrow"><div class="eyebrow">FAQ</div><h2>${esc(ui(mission, 'faq_heading'))}</h2><div class="faq-list">${values.map((item) => `<details><summary>${esc(item.question)}</summary><p>${esc(item.answer)}</p></details>`).join('')}</div></div></section>`;
}

function cta(content, mission) {
  return `<section class="section surface" data-component="CTA"><div class="narrow"><div class="eyebrow">${esc(ui(mission, 'next_step'))}</div><h2>${esc(content.cta.goal)}</h2><a class="button primary" href="${attr(content.cta.href)}">${esc(content.cta.label)}</a></div></section>`;
}

function contact(content, mission) {
  return `<section class="section" data-component="Contact"><div class="container split"><div><div class="eyebrow">${esc(ui(mission, 'contact'))}</div><h2>${esc(content.headline)}</h2><p>${esc(content.subheadline)}</p></div><form class="contact-form" action="#" method="post" data-static-form="true"><div class="field"><label for="contact-name">${esc(ui(mission, 'name'))}</label><input id="contact-name" name="name" autocomplete="name" required></div><div class="field"><label for="contact-email">${esc(ui(mission, 'email'))}</label><input id="contact-email" name="email" type="email" autocomplete="email" required></div><div class="field"><label for="contact-message">${esc(ui(mission, 'message'))}</label><textarea id="contact-message" name="message" required></textarea></div><button class="button primary" type="submit" disabled aria-disabled="true" title="${attr(ui(mission, 'disabled_form_title'))}">${esc(content.cta.label)}</button><p class="muted">${esc(ui(mission, 'disabled_form_note'))}</p></form></div></section>`;
}

function legalPlaceholder(content, mission) {
  return `<section class="section" data-component="LegalPlaceholder"><div class="narrow"><h1>${esc(content.headline)}</h1><div class="legal-placeholder"><strong>${esc(ui(mission, 'placeholder'))}</strong><p>${esc(content.legal_placeholder?.text || '')}</p></div></div></section>`;
}

const REGISTRY = { hero, feature_grid: featureGrid, services, about, stats, testimonials, gallery, faq, cta, contact, legal_placeholder: legalPlaceholder };

export function composeComponents(page, content) {
  return page.sections.map((type) => ({ type, renderer: REGISTRY[type] ? type : null })).filter((item) => item.renderer);
}

export function renderComponents(page, content, mission) {
  return composeComponents(page, content).map(({ type }) => REGISTRY[type](content, mission)).filter(Boolean).join('\n');
}

export function componentRegistryManifest() {
  return {
    schema: 'riosystems.web-components.v1',
    components: ['Header', 'Navigation', 'Hero', 'FeatureGrid', 'Services', 'About', 'Stats', 'Testimonials', 'Gallery', 'FAQ', 'CTA', 'Contact', 'Footer'],
    properties: ['responsive', 'semantic', 'accessible-baseline', 'reusable', 'configurable', 'localized-baseline']
  };
}
