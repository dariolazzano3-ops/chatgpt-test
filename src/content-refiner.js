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
    "inhalt überarbeiten", "inhalt ueberarbeiten", "texte überarbeiten", "texte ueberarbeiten",
    "vollständig visuell", "vollstaendig visuell", "vollständig sprachlich", "vollstaendig sprachlich"
  ]);
  const qualityIntent = includesAny(text, ["hochwertig", "hochwertiger", "professionell", "besser", "verbessern", "überarbeiten", "ueberarbeiten", "stärker", "staerker", "minimalistisch"]);
  const operations = wholePage || (qualityIntent && includesAny(text, ["inhalt", "texte", "copy", "content", "dashboard", "oberfläche", "oberflaeche"]))
    ? [{ action: "refine_whole_page_copy", scope: "whole_page", reason: "Improve project-wide copy using active project context" }]
    : [];

  return {
    version: 2,
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

function isRiosystemsDashboard(html) {
  return /RIOSYSTEMS/i.test(html) && /request-form|FACTORY STATE|Current pipeline|NEW FACTORY REQUEST/i.test(html);
}

function refineRiosystemsDashboard(html, css) {
  const replacements = [
    [/<html lang="en">/i, '<html lang="de">'],
    [/RIOSYSTEMS Dashboard — LEAN V3 Factory operations interface\./g, 'RIOSYSTEMS Dashboard – Steuerzentrale für LEAN V3.'],
    [/SYSTEM ONLINE/g, 'SYSTEM BEREIT'],
    [/LOG OUT/g, 'ABMELDEN'],
    [/LEAN V3 OPERATIONS/g, 'LEAN V3 STEUERUNG'],
    [/Control the factory\.<br>Keep production deliberate\./g, 'Deine digitale<br>Produktionszentrale.'],
    [/Send work into the active Factory project, watch the pipeline, review the preview and keep Production behind a human gate\./g, 'Änderungen beauftragen, testen und prüfen. Veröffentlicht wird erst nach deiner Freigabe.'],
    [/ACTIVE PROJECT/g, 'AKTIVES PROJEKT'],
    [/NEW FACTORY REQUEST/g, 'NEUER AUFTRAG'],
    [/What should the Factory change\?/g, 'Was möchtest du ändern?'],
    [/EDIT MODE/g, 'BEARBEITEN'],
    [/INSTRUCTION/g, 'DEIN AUFTRAG'],
    [/Example: Make the hero more cinematic, keep mobile clean and do not touch production\./g, 'Beschreibe einfach, was geändert werden soll …'],
    [/MODE/g, 'MODUS'],
    [/PROJECT/g, 'PROJEKT'],
    [/SEND TO FACTORY/g, 'ÄNDERUNG STARTEN'],
    [/Creates a Factory request on the control branch\. Production deployment is hard-coded off\./g, 'Der Auftrag wird sicher an LEAN V3 übergeben. Production bleibt gesperrt.'],
    [/FACTORY STATE/g, 'AKTUELLER STATUS'],
    [/Current pipeline/g, 'Aktueller Ablauf'],
    [/REFRESH/g, 'AKTUALISIEREN'],
    [/PROMPT/g, 'AUFTRAG'],
    [/Ready for instruction/g, 'Bereit für deinen Auftrag'],
    [/BUILD/g, 'UMSETZUNG'],
    [/Factory branch/g, 'Neue Revision'],
    [/PREVIEW/g, 'PREVIEW'],
    [/Cloudflare Pages/g, 'Testversion'],
    [/Desktop \+ Mobile/g, 'Desktop + Mobil'],
    [/REVIEW/g, 'PRÜFUNG'],
    [/Human decision/g, 'Deine Entscheidung'],
    [/PRODUCTION/g, 'PRODUCTION'],
    [/Manual approval only/g, 'Nur mit deiner Freigabe'],
    [/LOCKED/g, 'GESPERRT'],
    [/TELEMETRY/g, 'STATUS'],
    [/System snapshot/g, 'Systemübersicht'],
    [/VISUAL QA/g, 'QUALITÄTSPRÜFUNG'],
    [/CONTROL/g, 'SYSTEM'],
    [/REVIEW DESTINATION/g, 'AKTUELLE PREVIEW'],
    [/Latest preview/g, 'Aktuelle Preview'],
    [/CANONICAL/g, 'AKTUELL'],
    [/Open MultiProject Alpha Preview/g, 'Preview öffnen'],
    [/The same canonical preview URL updates across iterations\./g, 'Hier siehst du immer die zuletzt geprüfte Version.'],
    [/PRODUCTION GATE/g, 'VERÖFFENTLICHUNG'],
    [/Release control/g, 'Production-Freigabe'],
    [/Production cannot be triggered from Dashboard V1\. A separate explicit approval flow will be required before this control can ever become active\./g, 'Diese Version wird erst veröffentlicht, wenn du sie ausdrücklich freigibst.'],
    [/PRODUCTION DEPLOY DISABLED/g, 'PRODUCTION GESPERRT'],
    [/AUTHENTICATED OPERATIONS INTERFACE/g, 'GESCHÜTZTE STEUERZENTRALE'],
    [/REQUEST ACCEPTED/g, 'AUFTRAG ANGENOMMEN'],
    [/REQUEST VERIFIED/g, 'AUFTRAG BESTÄTIGT'],
    [/REQUEST BLOCKED/g, 'AUFTRAG FEHLGESCHLAGEN'],
    [/SENDING…/g, 'WIRD ÜBERGEBEN…'],
    [/CHECKING…/g, 'WIRD AKTUALISIERT…']
  ];
  let nextHtml = html;
  for (const [pattern, value] of replacements) nextHtml = nextHtml.replace(pattern, value);

  const marker = '/* RIOSYSTEMS minimalist dashboard refinement */';
  let nextCss = String(css || '');
  if (!nextCss.includes(marker)) {
    nextCss += `\n\n${marker}\n:root{--rio-accent:#86f7cf;--rio-panel:rgba(12,17,20,.78)}\nbody{letter-spacing:-.01em}\n.grid{opacity:.32}\nmain{max-width:1180px;margin-inline:auto}\n.intro{padding-top:clamp(42px,8vw,100px);padding-bottom:clamp(34px,6vw,72px)}\n.intro h1{font-size:clamp(2.7rem,7vw,6.6rem);line-height:.88;letter-spacing:-.065em;max-width:900px}\n.intro p{max-width:650px;font-size:clamp(1rem,1.7vw,1.2rem);line-height:1.7}\n.panel{background:linear-gradient(180deg,rgba(15,21,24,.9),rgba(8,12,14,.88));backdrop-filter:blur(16px);border-color:rgba(255,255,255,.09);box-shadow:0 24px 80px rgba(0,0,0,.18)}\n.command-panel{border-color:rgba(134,247,207,.19)}\ntextarea{min-height:190px;font-size:1.05rem;line-height:1.6}\n.primary{min-height:58px;font-size:.86rem}\n.pipeline .step{min-height:64px}\n.metrics>div{padding:22px}\n.preview-link{min-height:76px}\n@media(max-width:760px){.topbar{padding-inline:18px}.brand small{display:none}main{padding-inline:16px}.intro{grid-template-columns:1fr}.intro h1{font-size:clamp(2.65rem,13vw,4.6rem)}.hero-state{width:100%}.dashboard-grid{display:grid;grid-template-columns:1fr}.panel{border-radius:18px;padding:20px}.form-row{grid-template-columns:1fr}.metrics{grid-template-columns:1fr 1fr}.pipeline .step{padding-inline:12px}footer{padding-inline:18px;gap:10px;flex-wrap:wrap}}\n`;
  }
  return { html: nextHtml, css: nextCss };
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
  let nextCss = String(css || "");

  if (isRiosystemsDashboard(nextHtml)) {
    const refined = refineRiosystemsDashboard(nextHtml, nextCss);
    nextHtml = refined.html;
    nextCss = refined.css;
  } else {
    nextHtml = replaceHeroCopy(nextHtml, profile);
    nextHtml = replacePrimarySection(nextHtml, profile);
    nextHtml = replaceComposedSection(nextHtml, "faq", context);
    nextHtml = replaceComposedSection(nextHtml, "services", context);
    nextHtml = replaceComposedSection(nextHtml, "references", context);
    nextHtml = replaceComposedSection(nextHtml, "cta", context);
    nextHtml = replaceContact(nextHtml, profile);
  }

  if (nextHtml === html && nextCss === css) return { error: "CONTENT_REFINEMENT_MADE_NO_CHANGES", applied: [], context };

  return {
    ok: true,
    html: nextHtml,
    css: nextCss,
    context,
    applied: [{ action: "refine_whole_page_copy", scope: "whole_page", domain: context.domain, dashboard_profile: isRiosystemsDashboard(html) }],
    changed_files: nextCss === css ? ["index.html"] : ["index.html", "styles.css"]
  };
}