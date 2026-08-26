import { analyzeContentContext, composeSectionContent } from "./section-composer.js";

function clean(value, max = 4000) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function includesAny(text, terms) {
  return terms.some((term) => text.includes(term));
}

function escapeHtml(value = "") {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const profiles = {
  ai: {
    hero: "Wir verbinden KI, Automatisierung und digitale Produkte zu Systemen, die Abläufe vereinfachen, Entscheidungen beschleunigen und mit dem Unternehmen mitwachsen.",
    sectionHeadline: "Intelligente Systeme statt isolierter Einzellösungen.",
    cards: [
      ["AI Architecture", "KI wird dort eingesetzt, wo sie Entscheidungen, Wissen und operative Abläufe messbar verbessert."],
      ["Connected Automation", "Daten, Tools und Prozesse greifen ineinander, damit weniger Arbeit an manuellen Übergaben verloren geht."],
      ["Digital Experience", "Interfaces und technische Logik entstehen als ein Produkt: klar für Nutzer, belastbar im Hintergrund."]
    ],
    contactHeadline: "Aus einer Idee wird ein funktionierendes System.",
    contactBody: "Wir starten mit dem wichtigsten Engpass, bauen einen klar abgegrenzten Funktionskern und entwickeln ihn auf Basis echter Nutzung weiter.",
    cta: "Projekt besprechen"
  },
  gelato: {
    hero: "Handwerkliches Gelato, besondere Sorten und Angebote für Feiern, klar präsentiert und schnell gefunden.",
    sectionHeadline: "Gelato für den Alltag und besondere Momente.",
    cards: [
      ["Sorten", "Klassiker, saisonale Kreationen und Premium-Sorten übersichtlich an einem Ort."],
      ["Eistorten", "Individuelle Größen und Sortenkombinationen für Geburtstage, Feiern und besondere Anlässe."],
      ["Events", "Eisvitrinen, Eis und passende Ausstattung als unkompliziertes Paket für Veranstaltungen."]
    ],
    contactHeadline: "Lust auf Gelato?",
    contactBody: "Sorten entdecken, besondere Wünsche abstimmen oder das passende Angebot für eine Feier anfragen.",
    cta: "Jetzt anfragen"
  },
  automotive: {
    hero: "Reifen, Felgen und Kompletträder mit klarer Auswahl, aktuellen Produktdaten und einem direkten Weg zur passenden Lösung.",
    sectionHeadline: "Die passende Kombination für Fahrzeug und Einsatz.",
    cards: [
      ["Reifen", "Sommer-, Winter- und Ganzjahresreifen passend zu Dimension, Fahrzeug und Fahrprofil."],
      ["Felgen", "Eine klare Felgenauswahl mit relevanten Fahrzeug- und Größeninformationen."],
      ["Kompletträder", "Passende Kombinationen aus Reifen und Felgen, transparent zusammengestellt und einfach bestellbar."]
    ],
    contactHeadline: "Passende Räder finden.",
    contactBody: "Fahrzeug und Bedarf nennen, Auswahl eingrenzen und ohne unnötige Umwege zur passenden Kombination kommen.",
    cta: "Auswahl starten"
  },
  generic: {
    hero: "Eine klare digitale Präsenz, die Angebot, Nutzen und nächsten Schritt verständlich auf den Punkt bringt.",
    sectionHeadline: "Klarer Nutzen. Saubere Struktur. Ein nachvollziehbarer nächster Schritt.",
    cards: [
      ["Clarity", "Komplexe Anforderungen werden so strukturiert, dass Nutzer schnell verstehen, worum es geht."],
      ["Quality", "Inhalt, Gestaltung und Technik greifen zusammen und bilden eine konsistente Erfahrung."],
      ["Scale", "Die Lösung bleibt modular und kann mit neuen Anforderungen weiterentwickelt werden."]
    ],
    contactHeadline: "Den nächsten Schritt konkret machen.",
    contactBody: "Ziel und Prioritäten klären, den ersten sinnvollen Baustein definieren und daraus eine belastbare Lösung entwickeln.",
    cta: "Projekt starten"
  }
};

function profileFor(context) {
  return profiles[context?.domain] || profiles.generic;
}

export function planContentRefinement(prompt = "") {
  const raw = clean(prompt, 4000);
  const text = raw.toLowerCase();
  const wholePage = includesAny(text, [
    "ganze seite", "gesamte seite", "komplette seite", "alle texte", "inhaltlich hochwertiger",
    "inhalt hochwertiger", "texte hochwertiger", "texte verbessern", "copy verbessern", "content verbessern",
    "inhalt überarbeiten", "inhalt ueberarbeiten", "texte überarbeiten", "texte ueberarbeiten"
  ]);
  const qualityIntent = includesAny(text, ["hochwertig", "hochwertiger", "professionell", "besser", "verbessern", "überarbeiten", "ueberarbeiten", "stärker", "staerker"]);
  const operations = wholePage || (qualityIntent && includesAny(text, ["inhalt", "texte", "copy", "content"]))
    ? [{ action: "refine_whole_page_copy", scope: "whole_page", reason: "Improve project-wide copy using active project context" }]
    : [];

  return {
    version: 1,
    mode: "content-refinement-plan",
    prompt: raw,
    operations,
    requires_interpretation: operations.length === 0,
    safety: {
      production_deploy: false,
      active_project_only: true,
      preserve_layout: true,
      create_new_project: false
    }
  };
}

function replaceHeroCopy(html, profile) {
  const pattern = /(<div[^>]*class=["'][^"']*hero-content[^"']*["'][^>]*>[\s\S]*?<h1[^>]*>[\s\S]*?<\/h1>\s*)<p[^>]*>[\s\S]*?<\/p>/i;
  return html.replace(pattern, `$1<p>${escapeHtml(profile.hero)}</p>`);
}

function replacePrimarySection(html, profile) {
  const pattern = /(<section[^>]+id=["']content["'][^>]*>)([\s\S]*?)(<\/section>)/i;
  return html.replace(pattern, (_match, open, _body, close) => {
    const cards = profile.cards.map(([title, body], index) => `<article class="card"><span>${String(index + 1).padStart(2, "0")}</span><h3>${escapeHtml(title)}</h3><p>${escapeHtml(body)}</p></article>`).join("");
    return `${open}<div class="section-head"><span>System</span><h2>${escapeHtml(profile.sectionHeadline)}</h2></div><div class="grid">${cards}</div>${close}`;
  });
}

function replaceComposedSection(html, type, context) {
  const content = composeSectionContent(type, context);
  if (!content) return html;
  const id = `factory-${type}`;
  const pattern = new RegExp(`(<section[^>]+id=["']${id}["'][^>]*>)[\\s\\S]*?(<\\/section>)`, "i");
  if (!pattern.test(html)) return html;

  if (type === "faq") {
    const items = content.items.map((item) => `<details><summary>${escapeHtml(item.title)}</summary><p>${escapeHtml(item.body)}</p></details>`).join("\n    ");
    return html.replace(pattern, `$1\n  <div class="section-head"><span>${escapeHtml(content.eyebrow)}</span><h2>${escapeHtml(content.headline)}</h2></div>\n  <div class="factory-faq-list">\n    ${items}\n  </div>\n$2`);
  }

  if (type === "services" || type === "references") {
    const gridClass = type === "services" ? "factory-services-grid" : "factory-reference-grid";
    const items = content.items.map((item) => `<article class="card"><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.body)}</p></article>`).join("\n    ");
    return html.replace(pattern, `$1\n  <div class="section-head"><span>${escapeHtml(content.eyebrow)}</span><h2>${escapeHtml(content.headline)}</h2></div>\n  <div class="grid ${gridClass}">\n    ${items}\n  </div>\n$2`);
  }

  if (type === "cta") {
    return html.replace(pattern, `$1\n  <span class="kicker">${escapeHtml(content.eyebrow)}</span><h2>${escapeHtml(content.headline)}</h2>\n  <a class="cta" href="#contact">${escapeHtml(content.cta)}</a>\n$2`);
  }

  return html;
}

function replaceContact(html, profile) {
  const pattern = /(<section[^>]*(?:id=["']contact["']|class=["'][^"']*contact[^"']*["'])[^>]*>)[\s\S]*?(<\/section>)/i;
  if (!pattern.test(html)) return html;
  return html.replace(pattern, `$1<span class="kicker">NEXT STEP</span><h2>${escapeHtml(profile.contactHeadline)}</h2><p>${escapeHtml(profile.contactBody)}</p><a class="cta" href="#top">${escapeHtml(profile.cta)}</a>$2`);
}

export function executeContentRefinementPlan({ html = "", css = "", plan }) {
  if (!plan || plan.mode !== "content-refinement-plan") return { error: "INVALID_CONTENT_REFINEMENT_PLAN" };
  if (plan?.safety?.production_deploy !== false || plan?.safety?.active_project_only !== true || plan?.safety?.preserve_layout !== true) {
    return { error: "CONTENT_REFINEMENT_SAFETY_VIOLATION" };
  }
  if (!Array.isArray(plan.operations) || !plan.operations.some((op) => op.action === "refine_whole_page_copy")) {
    return { error: "NO_EXECUTABLE_CONTENT_REFINEMENT_OPERATIONS", applied: [] };
  }

  const context = analyzeContentContext(html);
  const profile = profileFor(context);
  let nextHtml = String(html || "");
  nextHtml = replaceHeroCopy(nextHtml, profile);
  nextHtml = replacePrimarySection(nextHtml, profile);
  nextHtml = replaceComposedSection(nextHtml, "faq", context);
  nextHtml = replaceComposedSection(nextHtml, "services", context);
  nextHtml = replaceComposedSection(nextHtml, "references", context);
  nextHtml = replaceComposedSection(nextHtml, "cta", context);
  nextHtml = replaceContact(nextHtml, profile);

  if (nextHtml === html) return { error: "CONTENT_REFINEMENT_MADE_NO_CHANGES", applied: [], context };

  return {
    ok: true,
    html: nextHtml,
    css,
    context,
    applied: [{ action: "refine_whole_page_copy", scope: "whole_page", domain: context.domain }],
    changed_files: ["index.html"]
  };
}
