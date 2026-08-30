function cssValue(value, fallback) {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function component(spec, name) {
  return (spec.components || []).find((item) => String(item.component).toLowerCase() === String(name).toLowerCase()) || {};
}

function responsiveCss(spec) {
  return (spec.responsive || []).map((rule) => {
    const bp = Number(rule.breakpoint || 0);
    if (!bp) return '';
    const behavior = rule.behavior || {};
    const declarations = [];
    if (behavior.container_gutter) declarations.push(`.container,.narrow{width:min(calc(100% - ${cssValue(behavior.container_gutter, '2rem')}),var(--container))}`);
    if (behavior.hero_min_height) declarations.push(`main>.section:first-child{min-height:${cssValue(behavior.hero_min_height, 'auto')}}`);
    if (behavior.grid_columns) declarations.push(`.grid,.stat-grid{grid-template-columns:repeat(${Number(behavior.grid_columns)},minmax(0,1fr))}`);
    return declarations.length ? `@media(max-width:${bp}px){${declarations.join('')}}` : '';
  }).join('\n');
}

export function renderVisualDesignOverlay(spec = {}) {
  const accent = cssValue(spec.colors?.accent, 'var(--color-accent)');
  const background = cssValue(spec.colors?.background, 'var(--color-bg)');
  const surface = cssValue(spec.colors?.surface, 'var(--color-surface)');
  const text = cssValue(spec.colors?.text, 'var(--color-text)');
  const muted = cssValue(spec.colors?.muted, 'var(--color-muted)');
  const border = cssValue(spec.colors?.border, 'var(--color-border)');
  const hero = cssValue(spec.layout?.hero_min_height, 'auto');
  const container = cssValue(spec.layout?.container_width, '72rem');
  const narrow = cssValue(spec.layout?.narrow_container_width, '48rem');
  const section = cssValue(spec.spacing?.section, 'clamp(3.5rem,8vw,7rem)');
  const gridGap = cssValue(spec.spacing?.grid_gap || spec.layout?.grid_gap, '1.5rem');
  const cardRadius = cssValue(spec.radius?.card || spec.radius?.md, '0.875rem');
  const buttonRadius = cssValue(spec.radius?.button || spec.radius?.pill, '999px');
  const cardShadow = cssValue(spec.shadows?.card, 'var(--shadow-card)');
  const bodyFamily = cssValue(spec.typography?.body_family, 'var(--font-body)');
  const headingFamily = cssValue(spec.typography?.heading_family, 'var(--font-heading)');
  const heroSpec = component(spec, 'Hero');
  const cardSpec = component(spec, 'Card');
  const heroMax = cssValue(heroSpec.geometry?.content_max_width, '17ch');
  const heroAlign = cssValue(heroSpec.geometry?.text_align, 'left');
  const cardPadding = cssValue(cardSpec.geometry?.padding, 'var(--space-6)');
  const nativeInteractionCss = (spec.interactions?.items || []).flatMap((item) => {
    if (item.classification !== 'native_reproducible') return [];
    if (item.type === 'hover_transition') return ['.button,.card,.site-nav a{transition:transform .2s ease,box-shadow .2s ease,opacity .2s ease}.button:hover,.card:hover{transform:translateY(-2px)}'];
    if (item.type === 'sticky_section') return ['.site-header{position:sticky;top:0}'];
    return [];
  }).join('\n');

  return `
/* RIOSYSTEMS structured visual reconstruction overlay */
:root{--vf-hero-min-height:${hero};--vf-section-space:${section};--vf-grid-gap:${gridGap};--container:${container};--container-narrow:${narrow};--color-accent:${accent};--color-bg:${background};--color-surface:${surface};--color-text:${text};--color-muted:${muted};--color-border:${border};--radius-md:${cardRadius};--radius-pill:${buttonRadius};--shadow-card:${cardShadow};--font-body:${bodyFamily};--font-heading:${headingFamily}}
.section{padding:var(--vf-section-space) 0}
.grid,.stat-grid{gap:var(--vf-grid-gap)}
main>.section:first-child{min-height:var(--vf-hero-min-height)}
main>.section:first-child h1{max-width:${heroMax};text-align:${heroAlign}}
.card{border-radius:var(--radius-md);box-shadow:var(--shadow-card);padding:${cardPadding}}
.button{border-radius:var(--radius-pill)}
${nativeInteractionCss}
${responsiveCss(spec)}
`;
}
