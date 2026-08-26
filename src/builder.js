function clean(value, max = 500) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function slugify(value) {
  return clean(value, 120).toLowerCase().normalize("NFKD").replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "website";
}

function inferBrand(analysis, requestedName) {
  const explicit = clean(requestedName, 120);
  if (explicit) return explicit;
  const firstTitle = analysis?.information_architecture?.page_titles?.[0] || analysis?.pages?.[0]?.title || "New Website";
  return clean(String(firstTitle).split(/[|·—-]/)[0], 120) || "New Website";
}

function dedupe(values, limit = 20) {
  return [...new Set((values || []).map((v) => clean(v, 120)).filter(Boolean))].slice(0, limit);
}

function derivePages(analysis) {
  const urls = analysis?.information_architecture?.page_urls || [];
  const out = [{ path: "/", label: "Home", purpose: "Primary conversion and brand entry point" }];
  for (const raw of urls) {
    try {
      const url = new URL(raw);
      let path = url.pathname.replace(/\/+$/, "") || "/";
      if (path === "/" || out.some((x) => x.path === path)) continue;
      if (/\.(jpg|jpeg|png|webp|gif|svg|pdf|zip)$/i.test(path)) continue;
      const parts = path.split("/").filter(Boolean);
      const label = clean(parts[parts.length - 1].replace(/[-_]+/g, " ").replace(/\b\w/g, (m) => m.toUpperCase()), 80);
      out.push({ path, label: label || "Page", purpose: "Preserve observed business-information coverage with improved UX" });
      if (out.length >= 8) break;
    } catch {}
  }
  return out;
}

function deriveSections(analysis) {
  const h1 = dedupe(analysis?.information_architecture?.primary_headings, 8);
  const h2 = dedupe(analysis?.information_architecture?.secondary_headings, 12);
  const ctas = dedupe(analysis?.conversion_inventory?.detected_ctas, 8);
  const sections = [
    { id: "hero", goal: "State the business value clearly and create one primary action", evidence: h1.slice(0, 2) },
    { id: "services", goal: "Present the main products/services in a scannable structure", evidence: h2.slice(0, 6) },
    { id: "trust", goal: "Add factual trust signals, proof and local relevance", evidence: [] },
    { id: "conversion", goal: "Make contact, booking or purchase intent obvious", evidence: ctas },
    { id: "contact", goal: "Expose public contact/location information clearly", evidence: [] }
  ];
  return sections;
}

function deriveDesignSystem(analysis, style = {}) {
  const requestedTone = clean(style.tone, 120) || "premium, modern, clear, independent";
  return {
    direction: requestedTone,
    principles: [
      "mobile-first",
      "high-contrast hierarchy",
      "fast-loading",
      "accessible focus states",
      "original visual expression",
      "conversion clarity"
    ],
    tokens: {
      color_bg: style.color_bg || "#0d0f12",
      color_surface: style.color_surface || "#151920",
      color_text: style.color_text || "#f4f6f8",
      color_muted: style.color_muted || "#a9b1bc",
      color_accent: style.color_accent || "#7ee0c3",
      radius: style.radius || "14px",
      max_width: style.max_width || "1180px"
    },
    typography: {
      heading: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      body: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    }
  };
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>\"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

function buildIndexHtml(blueprint) {
  const brand = escapeHtml(blueprint.brand.name);
  const facts = blueprint.business_facts;
  const contactBits = [facts.phones?.[0], facts.emails?.[0]].filter(Boolean);
  const services = blueprint.source_observations.secondary_headings.slice(0, 6);
  const serviceCards = (services.length ? services : ["Services", "Solutions", "Experience"]).map((x) => `<article class="card"><h3>${escapeHtml(x)}</h3><p>Clear, customer-focused presentation based on observed public business information.</p></article>`).join("");
  return `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="description" content="${brand} — modernisierte, eigenständige Website.">
  <title>${brand}</title>
  <link rel="stylesheet" href="./styles.css">
</head>
<body>
<header class="site-header"><a class="brand" href="#top">${brand}</a><nav><a href="#services">Leistungen</a><a href="#contact">Kontakt</a></nav></header>
<main id="top">
  <section class="hero"><div class="eyebrow">Independent Rebuild</div><h1>${brand}</h1><p>Eine klarere, schnellere und conversion-stärkere digitale Präsenz, aufgebaut aus öffentlichen Geschäftsfakten statt kopierter Gestaltung.</p><a class="cta" href="#contact">Jetzt Kontakt aufnehmen</a></section>
  <section id="services" class="section"><div class="section-head"><span>Leistungen</span><h2>Was Kunden schnell verstehen sollen.</h2></div><div class="grid">${serviceCards}</div></section>
  <section class="section trust"><div><span class="kicker">Vertrauen</span><h2>Fakten zuerst.</h2></div><p>Öffentliche Kontaktdaten, Leistungen und Preise werden strukturiert dargestellt. Texte und visuelle Sprache werden eigenständig neu entwickelt.</p></section>
  <section id="contact" class="section contact"><span class="kicker">Kontakt</span><h2>Der nächste Schritt soll einfach sein.</h2><p>${escapeHtml(contactBits.join(" · ") || "Kontaktdaten werden aus dem Analyseergebnis übernommen und vor Veröffentlichung geprüft.")}</p></section>
</main>
<footer>© ${brand}</footer>
</body>
</html>`;
}

function buildCss(tokens) {
  return `:root{--bg:${tokens.color_bg};--surface:${tokens.color_surface};--text:${tokens.color_text};--muted:${tokens.color_muted};--accent:${tokens.color_accent};--radius:${tokens.radius};--max:${tokens.max_width}}*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--bg);color:var(--text);font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;line-height:1.5}.site-header{position:sticky;top:0;z-index:10;display:flex;justify-content:space-between;align-items:center;padding:18px max(22px,calc((100vw - var(--max))/2));background:color-mix(in srgb,var(--bg) 88%,transparent);backdrop-filter:blur(16px);border-bottom:1px solid #ffffff18}.brand{font-weight:700;text-decoration:none;color:var(--text)}nav{display:flex;gap:18px}nav a{color:var(--muted);text-decoration:none}.hero,.section{max-width:var(--max);margin:auto;padding:clamp(72px,10vw,150px) 22px}.hero{min-height:78svh;display:flex;flex-direction:column;justify-content:center}.eyebrow,.kicker,.section-head span{text-transform:uppercase;letter-spacing:.16em;font-size:12px;color:var(--accent)}h1{font-size:clamp(58px,10vw,140px);line-height:.9;letter-spacing:-.06em;margin:18px 0 28px}h2{font-size:clamp(38px,6vw,78px);line-height:.95;letter-spacing:-.045em;margin:12px 0 28px}.hero p,.section p{max-width:720px;color:var(--muted);font-size:clamp(18px,2vw,24px)}.cta{display:inline-flex;width:max-content;margin-top:28px;padding:14px 18px;border-radius:999px;background:var(--accent);color:#07110e;text-decoration:none;font-weight:700}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}.card{padding:28px;border:1px solid #ffffff18;border-radius:var(--radius);background:var(--surface)}.card h3{font-size:24px;margin:0 0 10px}.card p{font-size:16px}.trust{display:grid;grid-template-columns:1fr 1fr;gap:40px;border-top:1px solid #ffffff18}.contact{border-top:1px solid #ffffff18}footer{max-width:var(--max);margin:auto;padding:32px 22px 60px;color:var(--muted);border-top:1px solid #ffffff18}@media(max-width:760px){nav{display:none}.grid,.trust{grid-template-columns:1fr}.hero{min-height:70svh}}`;
}

export function buildRebuildBlueprint(analysis, options = {}) {
  if (!analysis || analysis.error || !analysis.ok) return { error: "VALID_ANALYSIS_REQUIRED" };
  const brandName = inferBrand(analysis, options.project_name);
  const projectSlug = slugify(options.project_slug || brandName);
  const design = deriveDesignSystem(analysis, options.style || {});
  const pages = derivePages(analysis);
  const blueprint = {
    ok: true,
    version: "1.5-alpha",
    type: "independent_rebuild_blueprint",
    project: { name: brandName, slug: projectSlug },
    brand: { name: brandName, positioning: clean(options.positioning, 400) || "A clearer, faster and more conversion-focused digital presence." },
    business_facts: analysis.business_facts || {},
    source_observations: {
      source_url: analysis.source_url,
      pages_analyzed: analysis.pages_analyzed,
      primary_headings: dedupe(analysis.information_architecture?.primary_headings, 8),
      secondary_headings: dedupe(analysis.information_architecture?.secondary_headings, 20),
      detected_ctas: dedupe(analysis.conversion_inventory?.detected_ctas, 12),
      detected_gaps: analysis.detected_gaps || []
    },
    architecture: { pages, home_sections: deriveSections(analysis) },
    design_system: design,
    quality_gates: [
      "business_fact_coverage",
      "original_copy",
      "original_visual_expression",
      "mobile_responsiveness",
      "accessibility_basics",
      "seo_metadata",
      "clear_primary_cta",
      "no_production_without_approval"
    ],
    status: "BLUEPRINT_READY"
  };
  blueprint.files = {
    "index.html": buildIndexHtml(blueprint),
    "styles.css": buildCss(design.tokens),
    "project.json": JSON.stringify({ project: blueprint.project, source_url: analysis.source_url, generated_by: "chatgpt-project-factory-1.5" }, null, 2)
  };
  return blueprint;
}
