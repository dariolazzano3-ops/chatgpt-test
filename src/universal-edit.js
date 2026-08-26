import { analyzeContentContext, composeSectionContent } from "./section-composer.js";

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

  if (includesAny(text, ["faq", "fragen und antworten", "häufige fragen"])) operations.push({ action: "add_section", type: "faq", reason: "Add FAQ section" });
  if (includesAny(text, ["referenzen", "referenzbereich", "projekte", "cases", "case studies"])) operations.push({ action: "add_section", type: "references", reason: "Add references section" });
  if (includesAny(text, ["leistungen", "services", "servicebereich", "leistungsbereich"])) operations.push({ action: "add_section", type: "services", reason: "Add services section" });
  if (includesAny(text, ["cta bereich", "cta-section", "call to action", "abschlusssbereich", "abschlussbereich"])) operations.push({ action: "add_section", type: "cta", reason: "Add CTA section" });

  const cardMatch = /(?:füge|mach|erstelle|baue)\s+(\d{1,2})\s+(?:neue\s+)?cards?/i.exec(raw);
  if (cardMatch) operations.push({ action: "add_cards", count: Math.max(1, Math.min(12, Number(cardMatch[1]))), reason: "Add requested cards" });

  if (includesAny(text, ["zweispaltig", "2 spalten", "zwei spalten"])) operations.push({ action: "layout_columns", count: 2, reason: "Use two-column layout" });
  else if (includesAny(text, ["vierspaltig", "4 spalten", "vier spalten"])) operations.push({ action: "layout_columns", count: 4, reason: "Use four-column layout" });

  return {
    version: 2,
    mode: "structural-edit-plan",
    prompt: raw,
    operations,
    requires_interpretation: operations.length === 0,
    content_strategy: "project-context",
    safety: { production_deploy: false, active_project_only: true, create_new_project: false }
  };
}

function renderCardItems(items = [], numbered = false) {
  return items.map((item, index) => `<article class="card">${numbered ? `<span>${String(index + 1).padStart(2, "0")}</span>` : ""}<h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.body)}</p></article>`).join("\n    ");
}

function faqSection(context) {
  const content = composeSectionContent("faq", context);
  const items = content.items.map((item) => `<details><summary>${escapeHtml(item.title)}</summary><p>${escapeHtml(item.body)}</p></details>`).join("\n    ");
  return `<section class="section factory-section factory-faq" id="factory-faq">\n  <div class="section-head"><span>${escapeHtml(content.eyebrow)}</span><h2>${escapeHtml(content.headline)}</h2></div>\n  <div class="factory-faq-list">\n    ${items}\n  </div>\n</section>`;
}

function referencesSection(context) {
  const content = composeSectionContent("references", context);
  return `<section class="section factory-section" id="factory-references">\n  <div class="section-head"><span>${escapeHtml(content.eyebrow)}</span><h2>${escapeHtml(content.headline)}</h2></div>\n  <div class="grid factory-reference-grid">\n    ${renderCardItems(content.items, true)}\n  </div>\n</section>`;
}

function servicesSection(context) {
  const content = composeSectionContent("services", context);
  return `<section class="section factory-section" id="factory-services">\n  <div class="section-head"><span>${escapeHtml(content.eyebrow)}</span><h2>${escapeHtml(content.headline)}</h2></div>\n  <div class="grid factory-services-grid">\n    ${renderCardItems(content.items)}\n  </div>\n</section>`;
}

function ctaSection(context) {
  const content = composeSectionContent("cta", context);
  return `<section class="section factory-section factory-cta-section" id="factory-cta">\n  <span class="kicker">${escapeHtml(content.eyebrow)}</span><h2>${escapeHtml(content.headline)}</h2>\n  <a class="cta" href="#contact">${escapeHtml(content.cta)}</a>\n</section>`;
}

function cardsBlock(count, context) {
  const brand = escapeHtml(context?.brand || "das Projekt");
  const cards = Array.from({ length: count }, (_, index) => `<article class="card"><span>${String(index + 1).padStart(2, "0")}</span><h3>${brand} Capability ${index + 1}</h3><p>Ein modularer Baustein, der zum bestehenden Angebot und zur aktuellen Projektstruktur passt.</p></article>`).join("\n    ");
  return `<section class="section factory-section" id="factory-cards"><div class="section-head"><span>Capabilities</span><h2>Gezielt erweiterbar.</h2></div><div class="grid factory-card-grid">\n    ${cards}\n  </div></section>`;
}

function ensureStructureStyles(css, columns = null) {
  const markerStart = "/* Project Factory V3 Structure Styles: START */";
  const markerEnd = "/* Project Factory V3 Structure Styles: END */";
  let next = String(css || "").replace(/\/\* Project Factory V3 Structure Styles: START \*\/[\s\S]*?\/\* Project Factory V3 Structure Styles: END \*\//g, "").trimEnd();
  const gridRule = columns ? `.factory-card-grid,.factory-reference-grid,.factory-services-grid{grid-template-columns:repeat(${columns},minmax(0,1fr))}\n` : "";
  next += `\n\n${markerStart}\n${gridRule}.factory-faq-list{display:grid;gap:12px}.factory-faq-list details{padding:18px 0;border-bottom:1px solid #ffffff18}.factory-faq-list summary{cursor:pointer;font-weight:700}.factory-cta-section{padding-top:80px;padding-bottom:80px}\n@media(max-width:760px){.factory-card-grid,.factory-reference-grid,.factory-services-grid{grid-template-columns:1fr}}\n${markerEnd}\n`;
  return next;
}

export function executeStructuralEditPlan({ html = "", css = "", plan }) {
  if (!plan || plan.mode !== "structural-edit-plan") return { error: "INVALID_STRUCTURAL_EDIT_PLAN" };
  if (plan?.safety?.production_deploy !== false || plan?.safety?.active_project_only !== true) return { error: "STRUCTURAL_EDIT_SAFETY_VIOLATION" };

  let nextHtml = String(html || "");
  let nextCss = String(css || "");
  const applied = [];
  const context = analyzeContentContext(nextHtml);
  let requestedColumns = null;

  for (const op of Array.isArray(plan.operations) ? plan.operations : []) {
    if (op.action === "add_section") {
      const type = clean(op.type, 40);
      if (sectionExists(nextHtml, type)) continue;
      const templates = { faq: faqSection, references: referencesSection, services: servicesSection, cta: ctaSection };
      const render = templates[type];
      if (!render) continue;
      nextHtml = insertBeforeContactOrFooter(nextHtml, render(context));
      applied.push({ action: op.action, type, content_domain: context.domain, brand: context.brand });
    } else if (op.action === "add_cards") {
      if (sectionExists(nextHtml, "cards")) continue;
      const count = Math.max(1, Math.min(12, Number(op.count) || 3));
      nextHtml = insertBeforeContactOrFooter(nextHtml, cardsBlock(count, context));
      applied.push({ action: op.action, count, content_domain: context.domain });
    } else if (op.action === "layout_columns") {
      requestedColumns = Math.max(1, Math.min(4, Number(op.count) || 3));
      applied.push({ action: op.action, count: requestedColumns });
    }
  }

  if (!applied.length) return { error: "NO_EXECUTABLE_STRUCTURAL_EDIT_OPERATIONS", applied: [], context };

  nextCss = ensureStructureStyles(nextCss, requestedColumns);

  return {
    ok: true,
    html: nextHtml,
    css: nextCss,
    applied,
    content_context: context,
    changed_files: ["index.html", "styles.css"]
  };
}
