const PALETTES = [
  { background: '#ffffff', surface: '#f8fafc', text: '#0f172a', muted: '#475569', accent: '#1d4ed8', accentText: '#ffffff', border: '#cbd5e1' },
  { background: '#fffdf8', surface: '#f7f3e8', text: '#24201a', muted: '#665f54', accent: '#8a3f12', accentText: '#ffffff', border: '#d7d0c2' },
  { background: '#f8fbfa', surface: '#eef6f3', text: '#10231d', muted: '#48655c', accent: '#006b57', accentText: '#ffffff', border: '#bdd4cc' }
];

function hash(value = '') {
  let out = 0;
  for (const char of String(value)) out = (out * 31 + char.charCodeAt(0)) >>> 0;
  return out;
}

export function createDesignSystem(mission) {
  const existing = mission.existing_brand || {};
  const palette = PALETTES[hash(`${mission.industry}:${mission.tone}`) % PALETTES.length];
  return {
    schema: 'riosystems.web-design-system.v1',
    direction: mission.tone,
    tokens: {
      colors: {
        background: existing.colors?.background || palette.background,
        surface: existing.colors?.surface || palette.surface,
        text: existing.colors?.text || palette.text,
        muted: existing.colors?.muted || palette.muted,
        accent: existing.colors?.accent || palette.accent,
        accent_text: existing.colors?.accent_text || palette.accentText,
        border: existing.colors?.border || palette.border,
        focus: existing.colors?.focus || '#0ea5e9'
      },
      typography: {
        font_family_body: existing.typography?.body || "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        font_family_heading: existing.typography?.heading || "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        scale: { xs: '0.8125rem', sm: '0.9375rem', base: '1rem', lg: '1.125rem', xl: '1.375rem', '2xl': 'clamp(2rem, 5vw, 4.5rem)' },
        line_height_body: 1.65,
        line_height_heading: 1.05
      },
      spacing: { 1: '0.25rem', 2: '0.5rem', 3: '0.75rem', 4: '1rem', 6: '1.5rem', 8: '2rem', 12: '3rem', 16: '4rem', 24: '6rem' },
      radius: { sm: '0.5rem', md: '0.875rem', lg: '1.25rem', pill: '999px' },
      shadows: { card: '0 12px 32px rgba(15, 23, 42, 0.08)', focus: '0 0 0 3px rgba(14, 165, 233, 0.35)' },
      containers: { content: '72rem', narrow: '48rem' },
      breakpoints: { sm: 480, md: 768, lg: 1024, xl: 1280 },
      controls: { min_target: '44px' }
    },
    components: {
      buttons: { primary: 'solid accent', secondary: 'surface with border' },
      forms: { label_position: 'above', error_strategy: 'text + aria-describedby' },
      cards: { border: true, shadow: 'card', radius: 'md' },
      navigation: { mobile_pattern: 'button-controlled collapsible navigation' },
      footer: { legal_navigation: true },
      section_patterns: ['contained', 'split', 'grid', 'band']
    }
  };
}

export function renderDesignCss(design) {
  const t = design.tokens;
  const c = t.colors;
  return `:root{--color-bg:${c.background};--color-surface:${c.surface};--color-text:${c.text};--color-muted:${c.muted};--color-accent:${c.accent};--color-accent-text:${c.accent_text};--color-border:${c.border};--color-focus:${c.focus};--font-body:${t.typography.font_family_body};--font-heading:${t.typography.font_family_heading};--space-1:${t.spacing[1]};--space-2:${t.spacing[2]};--space-3:${t.spacing[3]};--space-4:${t.spacing[4]};--space-6:${t.spacing[6]};--space-8:${t.spacing[8]};--space-12:${t.spacing[12]};--space-16:${t.spacing[16]};--space-24:${t.spacing[24]};--radius-sm:${t.radius.sm};--radius-md:${t.radius.md};--radius-lg:${t.radius.lg};--radius-pill:${t.radius.pill};--shadow-card:${t.shadows.card};--container:${t.containers.content};--container-narrow:${t.containers.narrow};--target:${t.controls.min_target}}\n*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--color-bg);color:var(--color-text);font-family:var(--font-body);line-height:${t.typography.line_height_body};overflow-wrap:anywhere}img,svg,video{display:block;max-width:100%;height:auto}a{color:inherit}a:focus-visible,button:focus-visible,input:focus-visible,textarea:focus-visible{outline:3px solid var(--color-focus);outline-offset:3px}button,a.button{min-height:var(--target);min-width:var(--target)}.container{width:min(calc(100% - 2rem),var(--container));margin-inline:auto}.narrow{width:min(calc(100% - 2rem),var(--container-narrow));margin-inline:auto}.site-header{position:sticky;top:0;z-index:30;background:color-mix(in srgb,var(--color-bg) 94%,transparent);border-bottom:1px solid var(--color-border);backdrop-filter:blur(12px)}.header-row{display:flex;align-items:center;justify-content:space-between;gap:var(--space-4);min-height:4.5rem}.brand{font-weight:800;text-decoration:none}.nav-toggle{display:none;border:1px solid var(--color-border);border-radius:var(--radius-sm);background:var(--color-surface);padding:.6rem .8rem;color:var(--color-text)}.site-nav{display:flex;align-items:center;gap:var(--space-4)}.site-nav a{text-decoration:none;padding:.7rem .2rem}.site-nav a[aria-current="page"]{font-weight:800}.section{padding:clamp(3.5rem,8vw,7rem) 0}.section.surface{background:var(--color-surface)}.eyebrow{font-size:${t.typography.scale.xs};font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--color-accent)}h1,h2,h3{font-family:var(--font-heading);line-height:${t.typography.line_height_heading};text-wrap:balance}h1{font-size:${t.typography.scale['2xl']};max-width:17ch;margin:.4em 0}.lead{font-size:clamp(1.1rem,2.4vw,1.4rem);color:var(--color-muted);max-width:62ch}.button{display:inline-flex;align-items:center;justify-content:center;padding:.75rem 1rem;border-radius:var(--radius-pill);text-decoration:none;font-weight:800;border:1px solid transparent}.button.primary{background:var(--color-accent);color:var(--color-accent-text)}.button.secondary{background:var(--color-surface);border-color:var(--color-border)}.actions{display:flex;flex-wrap:wrap;gap:var(--space-3);margin-top:var(--space-6)}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:var(--space-4)}.card{border:1px solid var(--color-border);border-radius:var(--radius-md);background:var(--color-bg);padding:var(--space-6);box-shadow:var(--shadow-card)}.card p,.muted{color:var(--color-muted)}.split{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:clamp(2rem,6vw,5rem);align-items:start}.stat-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:var(--space-4)}.stat strong{display:block;font-size:2rem}.faq-list{display:grid;gap:var(--space-3)}details{border:1px solid var(--color-border);border-radius:var(--radius-sm);padding:var(--space-4);background:var(--color-bg)}summary{cursor:pointer;font-weight:800;min-height:var(--target);display:flex;align-items:center}.contact-form{display:grid;gap:var(--space-4);max-width:42rem}.field{display:grid;gap:.4rem}.field input,.field textarea{width:100%;min-height:var(--target);border:1px solid var(--color-border);border-radius:var(--radius-sm);padding:.75rem;background:var(--color-bg);color:var(--color-text);font:inherit}.field textarea{min-height:9rem}.site-footer{padding:var(--space-12) 0;border-top:1px solid var(--color-border)}.footer-row{display:flex;justify-content:space-between;gap:var(--space-6);flex-wrap:wrap}.legal-links{display:flex;gap:var(--space-4);flex-wrap:wrap}.legal-placeholder{border:1px dashed var(--color-border);border-radius:var(--radius-md);padding:var(--space-6);background:var(--color-surface)}\n@media(max-width:${t.breakpoints.md}px){.grid,.split,.stat-grid{grid-template-columns:1fr}.nav-toggle{display:inline-flex;align-items:center;justify-content:center}.site-nav{position:absolute;left:1rem;right:1rem;top:4.25rem;display:none;flex-direction:column;align-items:stretch;background:var(--color-bg);border:1px solid var(--color-border);border-radius:var(--radius-md);padding:var(--space-4);box-shadow:var(--shadow-card)}.site-nav[data-open="true"]{display:flex}.site-nav a{padding:.75rem}}\n@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}*,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}}`;
}
