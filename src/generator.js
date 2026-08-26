function clean(value, max = 8000) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function slugify(value) {
  return clean(value, 120).toLowerCase().normalize("NFKD").replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "website";
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>\"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

function extractRequestedName(prompt, explicitName) {
  if (clean(explicitName, 120)) return clean(explicitName, 120);
  const patterns = [
    /(?:name|firma|unternehmen|brand|marke)\s*(?:ist|heißt|:)?\s*["']?([A-Za-z0-9ÄÖÜäöüß ._-]{2,60})/i,
    /(?:für|namens)\s+["']?([A-ZÄÖÜ][A-Za-z0-9ÄÖÜäöüß._-]{1,50})["']?/i
  ];
  for (const re of patterns) {
    const m = re.exec(prompt);
    if (m?.[1]) return clean(m[1].replace(/[.,;].*$/, ""), 120);
  }
  return "New Project";
}

function inferIntent(prompt) {
  const p = prompt.toLowerCase();
  if (/restaurant|döner|pizza|gelato|eis|café|cafe|bar|bäckerei|baeckerei/.test(p)) return "local_food_business";
  if (/agentur|agency|ki|ai|software|saas|tech|technologie/.test(p)) return "technology_business";
  if (/shop|ecommerce|e-commerce|produkt|verkauf/.test(p)) return "commerce";
  if (/arzt|praxis|anwalt|kanzlei|berater|beratung|dienstleistung/.test(p)) return "professional_service";
  return "general_business";
}

function inferSections(intent, prompt) {
  const base = [
    { id: "hero", goal: "Value proposition and primary CTA" },
    { id: "benefits", goal: "Explain the strongest customer benefits" }
  ];
  if (intent === "local_food_business") base.push(
    { id: "menu", goal: "Show core products/menu in a scannable form" },
    { id: "story", goal: "Build local trust and brand character" },
    { id: "visit", goal: "Address, hours and direct contact" }
  );
  else if (intent === "technology_business") base.push(
    { id: "solution", goal: "Explain the system/solution clearly" },
    { id: "capabilities", goal: "Present capabilities without generic feature dumping" },
    { id: "proof", goal: "Add trust, references or architecture evidence" },
    { id: "contact", goal: "Primary conversion section" }
  );
  else if (intent === "commerce") base.push(
    { id: "products", goal: "Present products or categories" },
    { id: "trust", goal: "Reduce purchase friction" },
    { id: "conversion", goal: "Drive to checkout/contact" }
  );
  else base.push(
    { id: "services", goal: "Explain services clearly" },
    { id: "trust", goal: "Proof and credibility" },
    { id: "contact", goal: "Make next action obvious" }
  );
  if (/faq/i.test(prompt)) base.push({ id: "faq", goal: "Resolve objections and common questions" });
  return base;
}

function inferDesign(prompt, style = {}) {
  const p = prompt.toLowerCase();
  let direction = "premium, modern, clear";
  let bg = "#0d0f12";
  let surface = "#151920";
  let text = "#f5f7f8";
  let muted = "#aab2bd";
  let accent = "#7ee0c3";
  if (/hell|light|weiß|white/.test(p)) {
    bg = "#f7f7f5"; surface = "#ffffff"; text = "#121212"; muted = "#666d76"; accent = "#1b6cff";
    direction = "light, premium, editorial";
  }
  if (/futur|dark|dunkel|technisch|tech/.test(p)) direction = "dark, futuristic, technical, premium";
  if (/luxus|luxury|elegant/.test(p)) { direction = "luxury, minimal, editorial"; accent = "#d8c49b"; }
  return {
    direction: clean(style.tone || direction, 160),
    tokens: {
      color_bg: style.color_bg || bg,
      color_surface: style.color_surface || surface,
      color_text: style.color_text || text,
      color_muted: style.color_muted || muted,
      color_accent: style.color_accent || accent,
      radius: style.radius || (/kantig|square|sharp/.test(p) ? "2px" : "16px"),
      max_width: style.max_width || "1180px"
    },
    principles: ["mobile-first","clear hierarchy","fast-loading","accessible focus states","strong primary CTA","original visual expression"]
  };
}

function buildHtml(blueprint) {
  const name = escapeHtml(blueprint.project.name);
  const cta = escapeHtml(blueprint.content.primary_cta);
  const cards = blueprint.architecture.home_sections.filter((s) => !["hero","contact","visit","conversion"].includes(s.id)).map((s) => `<article class="card"><span>${escapeHtml(s.id.toUpperCase())}</span><h3>${escapeHtml(s.goal)}</h3><p>Diese Sektion wird aus dem Projektbriefing mit eigenständigem Content ausgearbeitet.</p></article>`).join("");
  return `<!doctype html>\n<html lang="de">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1">\n<meta name="description" content="${escapeHtml(blueprint.content.meta_description)}">\n<title>${name}</title>\n<link rel="stylesheet" href="./styles.css">\n</head>\n<body>\n<header class="site-header"><a class="brand" href="#top">${name}</a><nav><a href="#content">Mehr erfahren</a><a href="#contact">Kontakt</a></nav></header>\n<main id="top">\n<section class="hero"><div class="eyebrow">GENERATE // PROJECT FACTORY</div><h1>${name}</h1><p>${escapeHtml(blueprint.content.hero_support)}</p><a class="cta" href="#contact">${cta}</a></section>\n<section id="content" class="section"><div class="section-head"><span>System</span><h2>${escapeHtml(blueprint.content.section_headline)}</h2></div><div class="grid">${cards}</div></section>\n<section id="contact" class="section contact"><span class="kicker">NEXT STEP</span><h2>${cta}</h2><p>Diese erste Version ist direkt aus dem Prompt erzeugt und für weitere EVOLVE-Schritte vorbereitet.</p></section>\n</main>\n<footer>© ${name}</footer>\n</body>\n</html>`;
}

function buildCss(t) {
  return `:root{--bg:${t.color_bg};--surface:${t.color_surface};--text:${t.color_text};--muted:${t.color_muted};--accent:${t.color_accent};--radius:${t.radius};--max:${t.max_width}}*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--bg);color:var(--text);font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;line-height:1.5}.site-header{position:sticky;top:0;z-index:20;display:flex;align-items:center;justify-content:space-between;padding:18px max(22px,calc((100vw - var(--max))/2));border-bottom:1px solid #ffffff18;background:color-mix(in srgb,var(--bg) 88%,transparent);backdrop-filter:blur(16px)}.brand,nav a{color:var(--text);text-decoration:none}.brand{font-weight:800}nav{display:flex;gap:20px}.hero,.section{max-width:var(--max);margin:auto;padding:clamp(72px,10vw,150px) 22px}.hero{min-height:80svh;display:flex;flex-direction:column;justify-content:center}.eyebrow,.kicker,.section-head span,.card span{font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:var(--accent)}h1{font-size:clamp(58px,10vw,140px);line-height:.9;letter-spacing:-.06em;margin:18px 0 28px}h2{font-size:clamp(38px,6vw,78px);line-height:.95;letter-spacing:-.045em;margin:12px 0 28px}.hero p,.section p{max-width:760px;color:var(--muted);font-size:clamp(18px,2vw,24px)}.cta{display:inline-flex;width:max-content;margin-top:28px;padding:14px 18px;background:var(--accent);color:#07110e;text-decoration:none;font-weight:800;border-radius:999px}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}.card{padding:28px;border:1px solid #ffffff18;background:var(--surface);border-radius:var(--radius)}.card h3{font-size:24px;margin:12px 0}.card p{font-size:16px}.contact{border-top:1px solid #ffffff18}footer{max-width:var(--max);margin:auto;padding:30px 22px 60px;color:var(--muted);border-top:1px solid #ffffff18}@media(max-width:760px){nav{display:none}.grid{grid-template-columns:1fr}.hero{min-height:72svh}}`;
}

export function buildGenerateBlueprint(input = {}) {
  const prompt = clean(input.prompt, 12000);
  if (!prompt) return { error: "PROMPT_REQUIRED" };
  const projectName = extractRequestedName(prompt, input.project_name);
  const projectSlug = slugify(input.project_slug || projectName);
  const intent = inferIntent(prompt);
  const design = inferDesign(prompt, input.style || {});
  const sections = inferSections(intent, prompt);
  const primaryCta = clean(input.primary_cta, 80) || (intent === "local_food_business" ? "Jetzt entdecken" : "Jetzt starten");
  const blueprint = {
    ok: true,
    version: "1.5-alpha",
    type: "generated_website_blueprint",
    mode: "generate",
    project: { name: projectName, slug: projectSlug },
    brief: { prompt, intent, goal: clean(input.goal, 400) || "Create a high-quality independent website from the supplied prompt." },
    architecture: { pages: [{ path: "/", label: "Home", purpose: "Primary website experience" }], home_sections: sections },
    design_system: design,
    content: {
      hero_support: clean(input.hero_support, 300) || `Eine eigenständige digitale Präsenz für ${projectName}, entwickelt aus deinem Briefing.`,
      section_headline: clean(input.section_headline, 160) || "Eine klare Struktur statt generischem Template.",
      primary_cta: primaryCta,
      meta_description: clean(input.meta_description, 180) || `${projectName} — moderne, eigenständige Website.`
    },
    quality_gates: ["brief_coverage","original_copy","mobile_responsiveness","accessibility_basics","seo_metadata","clear_primary_cta","preview_before_production","no_production_without_approval"],
    status: "BLUEPRINT_READY"
  };
  blueprint.files = {
    "index.html": buildHtml(blueprint),
    "styles.css": buildCss(design.tokens),
    "project.json": JSON.stringify({ project: blueprint.project, mode: "generate", intent, generated_by: "chatgpt-project-factory-1.5" }, null, 2)
  };
  return blueprint;
}
