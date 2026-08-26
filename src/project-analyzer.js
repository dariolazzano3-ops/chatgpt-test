function uniq(values) {
  return [...new Set(values.filter(Boolean))];
}

function classNames(html = "") {
  const found = [];
  for (const match of html.matchAll(/class=["']([^"']+)["']/gi)) {
    for (const name of match[1].split(/\s+/)) if (name) found.push(`.${name}`);
  }
  return uniq(found);
}

function idNames(html = "") {
  return uniq([...html.matchAll(/id=["']([^"']+)["']/gi)].map((match) => `#${match[1]}`));
}

function cssSelectors(css = "") {
  const selectors = [];
  for (const match of css.matchAll(/(^|})\s*([^@}{][^{]+)\{/g)) {
    for (const selector of match[2].split(",")) {
      const clean = selector.trim();
      if (clean && clean.length <= 160) selectors.push(clean);
    }
  }
  return uniq(selectors);
}

function scoreSelector(selector, terms = []) {
  const value = selector.toLowerCase();
  let score = 0;
  for (const term of terms) {
    const t = term.toLowerCase();
    if (value === `.${t}` || value === `#${t}`) score += 100;
    if (value.includes(t)) score += 30;
    for (const part of t.split(/[-_\s]+/)) if (part.length > 2 && value.includes(part)) score += 8;
  }
  if (/[:>+~\s]/.test(selector)) score -= 3;
  return score;
}

function bestSelector(selectors, terms, fallback = null) {
  const ranked = selectors
    .map((selector) => ({ selector, score: scoreSelector(selector, terms) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.selector.length - b.selector.length);
  return ranked[0]?.selector || fallback;
}

export function analyzeProject({ html = "", css = "" } = {}) {
  const selectors = uniq([...classNames(html), ...idNames(html), ...cssSelectors(css)]);
  const semantic = {
    rocket: bestSelector(selectors, ["rocket-system", "rocket", "launch-vehicle", "spaceship"]),
    rocket_body: bestSelector(selectors, ["rocket-core", "rocket-body", "vehicle-core"]),
    smoke: bestSelector(selectors, ["smoke", "exhaust-smoke", "steam"]),
    smoke_field: bestSelector(selectors, ["smoke-field", "smoke-container", "exhaust-field"]),
    hero: bestSelector(selectors, ["hero", "hero-section", "intro", "masthead"]),
    navigation: bestSelector(selectors, ["site-header", "navbar", "navigation", "header"]),
    cards: bestSelector(selectors, ["card", "cards", "feature-card", "service-card"]),
    grid: bestSelector(selectors, ["grid", "cards-grid", "services-grid"]),
    cta: bestSelector(selectors, ["cta", "primary-button", "button-primary"])
  };

  return {
    version: 1,
    selector_count: selectors.length,
    selectors,
    semantic,
    capabilities: {
      has_rocket: Boolean(semantic.rocket),
      has_smoke: Boolean(semantic.smoke),
      has_hero: Boolean(semantic.hero),
      has_navigation: Boolean(semantic.navigation),
      has_cards: Boolean(semantic.cards)
    }
  };
}

export function resolveSemanticSelector(analysis, semanticName, fallback = null) {
  return analysis?.semantic?.[semanticName] || fallback;
}
