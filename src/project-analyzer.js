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

function stripTags(value = "") {
  return String(value).replace(/<script\b[\s\S]*?<\/script>/gi, " ").replace(/<style\b[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/\s+/g, " ").trim();
}

function elementSelector(attrs = "") {
  const id = /\bid=["']([^"']+)["']/i.exec(attrs)?.[1];
  if (id) return `#${id}`;
  const classes = /\bclass=["']([^"']+)["']/i.exec(attrs)?.[1]?.split(/\s+/).filter(Boolean) || [];
  return classes.length ? `.${classes[0]}` : null;
}

function textAnchors(html = "") {
  const anchors = [];
  const seen = new Set();
  const element = /<(span|small|strong|code|h1|h2|h3|p|button|a|div)\b([^>]*)>([\s\S]*?)<\/\1>/gi;
  for (const match of html.matchAll(element)) {
    const text = stripTags(match[3]);
    const selector = elementSelector(match[2]);
    if (!text || text.length < 2 || text.length > 180 || !selector) continue;
    const key = `${selector}\u0000${text.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    anchors.push({ selector, tag: match[1].toLowerCase(), text });
  }
  return anchors.slice(0, 240);
}

function normalizedWords(value = "") {
  return [...new Set(String(value).toLowerCase().normalize("NFKD").replace(/[^a-z0-9äöüß\s-]/gi, " ").split(/\s+/).map((part) => part.trim()).filter((part) => part.length >= 3 && !["aktuell","steht","dort","dieses","diese","einen","einem","einer","rechts","links","neben","schriftzug","kästchen","kasten","version"].includes(part)))];
}

export function resolveTextReference(prompt = "", analysis = null) {
  const anchors = Array.isArray(analysis?.text_anchors) ? analysis.text_anchors : [];
  const promptWords = normalizedWords(prompt);
  const promptText = String(prompt).toLowerCase();
  const ranked = anchors.map((anchor) => {
    const words = normalizedWords(anchor.text);
    const shared = words.filter((word) => promptWords.includes(word));
    let score = shared.length * 18;
    const anchorText = String(anchor.text || "").toLowerCase();
    if (anchorText.length >= 4 && promptText.includes(anchorText)) score += 120;
    if (/lean\s+version/i.test(prompt) && /lean\s+version/i.test(anchor.text)) score += 85;
    if (/riosystems\s+dashboard/i.test(prompt) && /riosystems\s+dashboard/i.test(anchor.text)) score += 85;
    if (String(anchor.selector || "").startsWith("#")) score += 12;
    return { ...anchor, score, shared_terms: shared };
  }).filter((item) => item.score >= 30).sort((a,b) => b.score - a.score || a.selector.length - b.selector.length);
  const best = ranked[0] || null;
  const second = ranked[1] || null;
  const unique = Boolean(best && (!second || best.score - second.score >= 18 || best.score >= 110));
  return { matched: Boolean(best), unique, best, candidates: ranked.slice(0, 5) };
}

export function analyzeProject({ html = "", css = "" } = {}) {
  const selectors = uniq([...classNames(html), ...idNames(html), ...cssSelectors(css)]);
  const semantic = {
    rocket: bestSelector(selectors, ["rocket-system", "rocket", "launch-vehicle", "spaceship"]),
    rocket_body: bestSelector(selectors, ["rocket-core", "rocket-body", "vehicle-core"]),
    smoke: bestSelector(selectors, ["smoke", "exhaust-smoke", "steam"]),
    smoke_field: bestSelector(selectors, ["smoke-field", "smoke-container", "exhaust-field"]),
    hero: bestSelector(selectors, ["hero", "hero-section", "intro", "masthead"]),
    hero_copy: bestSelector(selectors, ["hero-copy", "hero-content", "hero-text", "intro-copy", "lead"]),
    navigation: bestSelector(selectors, ["site-header", "navbar", "navigation", "header"]),
    cards: bestSelector(selectors, ["card", "cards", "feature-card", "service-card"]),
    grid: bestSelector(selectors, ["grid", "cards-grid", "services-grid", "features-grid"]),
    cta: bestSelector(selectors, ["cta", "primary-button", "button-primary", "hero-cta", "btn-primary"]),
    section: bestSelector(selectors, ["section", "content-section", "feature-section"]),
    section_head: bestSelector(selectors, ["section-head", "section-header", "section-title"])
  };
  const anchors = textAnchors(html);

  return {
    version: 2,
    selector_count: selectors.length,
    selectors,
    semantic,
    text_anchors: anchors,
    capabilities: {
      has_rocket: Boolean(semantic.rocket),
      has_smoke: Boolean(semantic.smoke),
      has_hero: Boolean(semantic.hero),
      has_navigation: Boolean(semantic.navigation),
      has_cards: Boolean(semantic.cards),
      has_grid: Boolean(semantic.grid),
      has_cta: Boolean(semantic.cta),
      has_section: Boolean(semantic.section),
      has_text_anchors: anchors.length > 0
    }
  };
}

export function resolveSemanticSelector(analysis, semanticName, fallback = null) {
  return analysis?.semantic?.[semanticName] || fallback;
}
