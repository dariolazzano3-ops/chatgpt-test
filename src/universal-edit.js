function clean(value, max = 4000) {
  return String(value || "").trim().slice(0, max);
}

function includesAny(text, terms) {
  return terms.some((term) => text.includes(term));
}

function escapeHtml(value = "") {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function sectionId(type) {
  return `factory-${type}`;
}

function sectionExists(html, type) {
  return new RegExp(`id=["']${sectionId(type)}["']`, "i").test(html);
}

function insertBeforeContactOrFooter(html, block) {
  const contact = /<section[^>]+(?:id|class)=["'][^"']*contact[^"']*["'][^>]*>/i;
  const footer = /<footer\b/i;
  if (contact.test(html)) return html.replace(contact, `${block}\n$&`);
  if (footer.test(html)) return html.replace(footer, `${block}\n$&`);
  return html.replace(/<\/main>/i, `${block}\n</main>`);
}

export function planStructuralEdit(prompt = "") {
  const raw = clean(prompt, 4000);
  const text = raw.toLowerCase();
  const operations = [];

  if (includesAny(text, ["faq", "fragen und antworten", "häufige fragen"])) {
    operations.push({ action: "add_section", type: "faq", reason: "Add FAQ section" });
  }

  if (includesAny(text, ["referenzen", "referenzbereich", "projekte", "cases", "case studies"])) {
    operations.push({ action: "add_section", type: "references", reason: "Add references section" });
  }

  if (includesAny(text, ["leistungen", "services", "servicebereich", "leistungsbereich"])) {
    operations.push({ action: "add_section", type: "services", reason: "Add services section" });
  }

  if (includesAny(text, ["cta bereich", "cta-section", "call to action", "abschlusssbereich", "abschlussbereich"])) {
    operations.push({ action: "add_section", type: "cta", reason: "Add CTA section" });
  }

  const cardMatch = /(?:füge|mach|erstelle|baue)\s+(\d{1,2})\s+(?:neue\s+)?cards?/i.exec(raw);
  if (cardMatch) {
    operations.push({ action: "add_cards", count: Math.max(1, Math.min(12, Number(cardMatch[1]))), reason: "Add requested cards" });
  }

  if (includesAny(text, ["zweispaltig", "2 spalten", "zwei spalten"])) {
    operations.push({ action: "layout_columns", count: 2, reason: "Use two-column layout" });
  } else if (includesAny(text, ["vierspaltig", "4 spalten", "vier spalten"])) {
    operations.push({ action: "layout_columns", count: 4, reason: "Use four-column layout" });
  }

  return {
    version: 1,
    mode: "structural-edit-plan",
    prompt: raw,
    operations,
    requires_interpretation: operations.length === 0,
    safety: {
      production_deploy: false,
      active_project_only: true,
      create_new_project: false
    }
  };
}

function faqSection() {
  return `<section class="section factory-section factory-faq" id="factory-faq">\n  <div class="section-head"><span>FAQ</span><h2>Häufige Fragen.</h2></div>\n  <div class="factory-faq-list">\n    <details><summary>Wie startet ein Projekt?</summary><p>Wir definieren Ziel, Umfang und die relevanten Systeme und setzen daraus einen klaren Umsetzungsplan auf.</p></details>\n    <details><summary>Was kann automatisiert werden?</summary><p>Wiederkehrende Prozesse, Datenflüsse, interne Workflows und digitale Kundenerlebnisse können gezielt automatisiert werden.</p></details>\n    <details><summary>Wie schnell entstehen erste Ergebnisse?</summary><p>Erste funktionsfähige Bausteine können früh als Preview bereitstehen und iterativ weiterentwickelt werden.</p></details>\n  </div>\n</section>`;
}

function referencesSection() {
  return `<section class="section factory-section" id="factory-references">\n  <div class="section-head"><span>Referenzen</span><h2>Aus Ideen werden Systeme.</h2></div>\n  <div class="grid factory-reference-grid">\n    <article class="card"><span>01</span><h3>AI Operations</h3><p>Automatisierte Abläufe für schnellere Entscheidungen und weniger manuelle Übergaben.</p></article>\n    <article class="card"><span>02</span><h3>Digital Experience</h3><p>Hochwertige digitale Oberflächen mit intelligenter Logik im Hintergrund.</p></article>\n    <article class="card"><span>03</span><h3>Connected Systems</h3><p>Verknüpfte Daten, Prozesse und Schnittstellen in einem konsistenten System.</p></article>\n  </div>\n</section>`;
}

function servicesSection() {
  return `<section class="section factory-section" id="factory-services">\n  <div class="section-head"><span>Leistungen</span><h2>Von Strategie bis Betrieb.</h2></div>\n  <div class="grid factory-services-grid">\n    <article class="card"><h3>AI Systems</h3><p>Konzeption und Umsetzung intelligenter Systeme für konkrete Geschäftsprozesse.</p></article>\n    <article class="card"><h3>Automation</h3><p>Automatisierte Workflows, Integrationen und datengetriebene Abläufe.</p></article>\n    <article class="card"><h3>Digital Products</h3><p>Websites, Interfaces und digitale Produkte mit klarer technischer Architektur.</p></article>\n  </div>\n</section>`;
}

function ctaSection() {
  return `<section class="section factory-section factory-cta-section" id="factory-cta">\n  <span class="kicker">Nächster Schritt</span><h2>Bereit, aus Komplexität ein System zu bauen?</h2>\n  <a class="cta" href="#contact">Projekt besprechen</a>\n</section>`;
}

function cardsBlock(count) {
  const cards = Array.from({ length: count }, (_, index) => `<article class="card"><span>${String(index + 1).padStart(2, "0")}</span><h3>Neue Capability ${index + 1}</h3><p>Ein modularer Baustein, der gezielt an das bestehende System angedockt werden kann.</p></article>`).join("\n    ");
  return `<section class="section factory-section" id="factory-cards"><div class="section-head"><span>Capabilities</span><h2>Modular erweiterbar.</h2></div><div class="grid factory-card-grid">\n    ${cards}\n  </div></section>`;
}

export function executeStructuralEditPlan({ html = "", css = "", plan }) {
  if (!plan || plan.mode !== "structural-edit-plan") return { error: "INVALID_STRUCTURAL_EDIT_PLAN" };
  if (plan?.safety?.production_deploy !== false || plan?.safety?.active_project_only !== true) return { error: "STRUCTURAL_EDIT_SAFETY_VIOLATION" };

  let nextHtml = String(html || "");
  let nextCss = String(css || "");
  const applied = [];

  for (const op of Array.isArray(plan.operations) ? plan.operations : []) {
    if (op.action === "add_section") {
      const type = clean(op.type, 40);
      if (sectionExists(nextHtml, type)) continue;
      const templates = { faq: faqSection, references: referencesSection, services: servicesSection, cta: ctaSection };
      const render = templates[type];
      if (!render) continue;
      nextHtml = insertBeforeContactOrFooter(nextHtml, render());
      applied.push({ action: op.action, type });
    } else if (op.action === "add_cards") {
      if (sectionExists(nextHtml, "cards")) continue;
      const count = Math.max(1, Math.min(12, Number(op.count) || 3));
      nextHtml = insertBeforeContactOrFooter(nextHtml, cardsBlock(count));
      applied.push({ action: op.action, count });
    } else if (op.action === "layout_columns") {
      const count = Math.max(1, Math.min(4, Number(op.count) || 3));
      const markerStart = "/* Project Factory V3 Structure Styles: START */";
      const markerEnd = "/* Project Factory V3 Structure Styles: END */";
      nextCss = nextCss.replace(/\/\* Project Factory V3 Structure Styles: START \*\/[\s\S]*?\/\* Project Factory V3 Structure Styles: END \*\//g, "").trimEnd();
      nextCss += `\n\n${markerStart}\n.factory-card-grid,.factory-reference-grid,.factory-services-grid{grid-template-columns:repeat(${count},minmax(0,1fr))}\n.factory-faq-list{display:grid;gap:12px}.factory-faq-list details{padding:18px 0;border-bottom:1px solid #ffffff18}.factory-faq-list summary{cursor:pointer;font-weight:700}.factory-cta-section{padding-top:80px;padding-bottom:80px}\n@media(max-width:760px){.factory-card-grid,.factory-reference-grid,.factory-services-grid{grid-template-columns:1fr}}\n${markerEnd}\n`;
      applied.push({ action: op.action, count });
    }
  }

  if (!applied.length) return { error: "NO_EXECUTABLE_STRUCTURAL_EDIT_OPERATIONS", applied: [] };

  if (!nextCss.includes("Project Factory V3 Structure Styles: START")) {
    nextCss = `${nextCss.trimEnd()}\n\n/* Project Factory V3 Structure Styles: START */\n.factory-faq-list{display:grid;gap:12px}.factory-faq-list details{padding:18px 0;border-bottom:1px solid #ffffff18}.factory-faq-list summary{cursor:pointer;font-weight:700}.factory-cta-section{padding-top:80px;padding-bottom:80px}\n@media(max-width:760px){.factory-card-grid,.factory-reference-grid,.factory-services-grid{grid-template-columns:1fr}}\n/* Project Factory V3 Structure Styles: END */\n`;
  }

  return {
    ok: true,
    html: nextHtml,
    css: nextCss,
    applied,
    changed_files: ["index.html", "styles.css"]
  };
}
