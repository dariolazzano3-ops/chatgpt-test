const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const attr = (value) => esc(value).replace(/`/g, '&#96;');

function hrefFor(currentPath, targetPath) {
  if (targetPath === currentPath) return targetPath === '/' ? './' : '../';
  if (currentPath === '/') return targetPath === '/' ? './' : `.${targetPath}`;
  if (targetPath === '/') return '../';
  return `../${targetPath.replace(/^\//, '')}`;
}

export function renderHeader({ mission, blueprint, page }) {
  const links = blueprint.navigation.map((item) => `<a href="${attr(hrefFor(page.path, item.path))}"${item.path === page.path ? ' aria-current="page"' : ''}>${esc(item.label)}</a>`).join('');
  return `<header class="site-header" data-component="Header"><div class="container header-row"><a class="brand" href="${attr(hrefFor(page.path, '/'))}" aria-label="${esc(mission.business_name)} Home">${esc(mission.business_name)}</a><button class="nav-toggle" type="button" aria-expanded="false" aria-controls="primary-navigation">Menu</button><nav id="primary-navigation" class="site-nav" aria-label="Primary navigation" data-open="false">${links}</nav></div></header>`;
}

export function renderFooter({ mission, page }) {
  return `<footer class="site-footer" data-component="Footer"><div class="container footer-row"><div><strong>${esc(mission.business_name)}</strong><div class="muted">${esc(mission.brand_positioning)}</div></div><nav class="legal-links" aria-label="Legal"><a href="${attr(hrefFor(page.path, '/legal-notice/'))}">Legal Notice</a><a href="${attr(hrefFor(page.path, '/privacy/'))}">Privacy</a></nav></div></footer>`;
}

function hero(content) {
  return `<section class="section" data-component="Hero"><div class="container"><div class="eyebrow">Overview</div><h1>${esc(content.headline)}</h1><p class="lead">${esc(content.subheadline)}</p><div class="actions"><a class="button primary" href="${attr(content.cta.href)}">${esc(content.cta.label)}</a></div></div></section>`;
}

function featureGrid(content) {
  const items = (content.benefits || []).slice(0, 6).map((benefit) => `<article class="card"><h3>${esc(benefit)}</h3><p>Focused information, reusable structure and a clear next action.</p></article>`).join('');
  return items ? `<section class="section surface" data-component="FeatureGrid"><div class="container"><div class="eyebrow">Benefits</div><h2>Built for clarity.</h2><div class="grid">${items}</div></div></section>` : '';
}

function services(content) {
  const items = (content.services || []).map((item) => `<article class="card"><h3>${esc(item.title || item)}</h3><p>${esc(item.body || '')}</p></article>`).join('');
  return `<section class="section" data-component="Services"><div class="container"><div class="eyebrow">Services</div><h2>What we can help with.</h2><div class="grid">${items}</div></div></section>`;
}

function about(content) {
  return `<section class="section surface" data-component="About"><div class="container split"><div><div class="eyebrow">About</div><h2>${esc(content.headline)}</h2></div><div><p class="lead">${esc(content.body)}</p></div></div></section>`;
}

function stats(content) {
  const values = (content.stats || []).slice(0, 6);
  if (!values.length) return '';
  return `<section class="section" data-component="Stats"><div class="container stat-grid">${values.map((item) => `<div class="stat"><strong>${esc(item.value)}</strong><span>${esc(item.label)}</span></div>`).join('')}</div></section>`;
}

function testimonials(content) {
  const values = (content.testimonials || []).slice(0, 6);
  if (!values.length) return '';
  return `<section class="section surface" data-component="Testimonials"><div class="container"><div class="eyebrow">Testimonials</div><h2>Approved customer proof.</h2><div class="grid">${values.map((item) => `<figure class="card"><blockquote>${esc(item.quote)}</blockquote><figcaption>${esc(item.name || 'Customer')}</figcaption></figure>`).join('')}</div></div></section>`;
}

function gallery(content) {
  const values = (content.gallery || []).slice(0, 9);
  if (!values.length) return '';
  return `<section class="section" data-component="Gallery"><div class="container"><div class="eyebrow">Gallery</div><h2>Selected work.</h2><div class="grid">${values.map((item) => `<figure class="card"><img src="${attr(item.src)}" alt="${attr(item.alt || '')}" loading="lazy"><figcaption>${esc(item.caption || '')}</figcaption></figure>`).join('')}</div></div></section>`;
}

function faq(content) {
  const values = content.faq || [];
  return `<section class="section" data-component="FAQ"><div class="narrow"><div class="eyebrow">FAQ</div><h2>Common questions.</h2><div class="faq-list">${values.map((item) => `<details><summary>${esc(item.question)}</summary><p>${esc(item.answer)}</p></details>`).join('')}</div></div></section>`;
}

function cta(content) {
  return `<section class="section surface" data-component="CTA"><div class="narrow"><div class="eyebrow">Next step</div><h2>${esc(content.cta.goal)}</h2><a class="button primary" href="${attr(content.cta.href)}">${esc(content.cta.label)}</a></div></section>`;
}

function contact(content) {
  return `<section class="section" data-component="Contact"><div class="container split"><div><div class="eyebrow">Contact</div><h2>${esc(content.headline)}</h2><p>${esc(content.subheadline)}</p></div><form class="contact-form" action="#" method="post" data-static-form="true"><div class="field"><label for="contact-name">Name</label><input id="contact-name" name="name" autocomplete="name" required></div><div class="field"><label for="contact-email">Email</label><input id="contact-email" name="email" type="email" autocomplete="email" required></div><div class="field"><label for="contact-message">Message</label><textarea id="contact-message" name="message" required></textarea></div><button class="button primary" type="submit" disabled aria-disabled="true" title="Form delivery requires an approved integration">${esc(content.cta.label)}</button><p class="muted">Form delivery is disabled in staging until an approved integration is connected.</p></form></div></section>`;
}

function legalPlaceholder(content) {
  return `<section class="section" data-component="LegalPlaceholder"><div class="narrow"><h1>${esc(content.headline)}</h1><div class="legal-placeholder"><strong>Placeholder</strong><p>${esc(content.legal_placeholder?.text || '')}</p></div></div></section>`;
}

const REGISTRY = { hero, feature_grid: featureGrid, services, about, stats, testimonials, gallery, faq, cta, contact, legal_placeholder: legalPlaceholder };

export function composeComponents(page, content) {
  return page.sections.map((type) => ({ type, renderer: REGISTRY[type] ? type : null })).filter((item) => item.renderer);
}

export function renderComponents(page, content) {
  return composeComponents(page, content).map(({ type }) => REGISTRY[type](content)).filter(Boolean).join('\n');
}

export function componentRegistryManifest() {
  return {
    schema: 'riosystems.web-components.v1',
    components: ['Header', 'Navigation', 'Hero', 'FeatureGrid', 'Services', 'About', 'Stats', 'Testimonials', 'Gallery', 'FAQ', 'CTA', 'Contact', 'Footer'],
    properties: ['responsive', 'semantic', 'accessible-baseline', 'reusable', 'configurable']
  };
}
