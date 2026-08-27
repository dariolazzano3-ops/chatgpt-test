import { resolveSemanticSelector } from "./project-analyzer.js";

function clean(value, max = 4000) { return String(value || "").trim().slice(0, max); }
function includesAny(text, terms) { return terms.some((term) => text.includes(term)); }
function operation(target, action, value, reason, semantic = null, scope = null) { return { target, action, value, reason, semantic, scope }; }
function extractText(raw, patterns, max = 180) { for (const pattern of patterns) { const match = pattern.exec(raw.trim()); if (match?.[1]) return clean(match[1].replace(/[.!]+$/, ""), max); } return ""; }
function extractHeadline(raw = "") { return extractText(raw, [/(?:ändere|aendere|setze|mach)\s+(?:die\s+)?(?:hero[- ]?)?(?:headline|überschrift|ueberschrift)\s+(?:auf|zu|in)\s+["„“']?([^\n"„“']{2,180})["„“']?[.!]?$/i, /(?:headline|überschrift|ueberschrift)\s*:\s*["„“']?([^\n"„“']{2,180})["„“']?/i]); }
function extractSubheadline(raw = "") { return extractText(raw, [/(?:ändere|aendere|setze|mach)\s+(?:die\s+)?(?:hero[- ]?)?(?:subheadline|unterüberschrift|unterueberschrift|untertitel|beschreibung)\s+(?:auf|zu|in)\s+["„“']?([^\n"„“']{2,260})["„“']?[.!]?$/i], 260); }
function extractCtaText(raw = "") { return extractText(raw, [/(?:ändere|aendere|setze|mach)\s+(?:den\s+|die\s+)?(?:cta|button|knopf|cta[- ]?text|button[- ]?text)\s+(?:auf|zu|in)\s+["„“']?([^\n"„“']{1,100})["„“']?[.!]?$/i], 100); }
function extractColumns(raw = "") { const match = /(?:grid|cards?|karten|kacheln)[^\n]{0,50}?(?:auf|in|mit)?\s*(\d)\s*(?:spalten|columns?)/i.exec(raw); return match ? Math.max(1, Math.min(4, Number(match[1]))) : null; }
function detectScope(text) {
  const ordinal = /(?:die|der|das)?\s*(erste|zweite|dritte|vierte|1\.|2\.|3\.|4\.)\s+(?:section|sektion|abschnitt|bereich)/i.exec(text);
  if (ordinal) { const map = { erste:1, "1.":1, zweite:2, "2.":2, dritte:3, "3.":3, vierte:4, "4.":4 }; return { kind:"ordinal-section", index: map[ordinal[1].toLowerCase()] }; }
  if (includesAny(text, ["im hero", "hero-bereich", "hero bereich", "im startbereich"])) return { kind:"semantic-section", name:"hero" };
  if (includesAny(text, ["leistungsbereich", "services-bereich", "servicebereich", "im services", "bei den leistungen"])) return { kind:"semantic-section", name:"services" };
  if (includesAny(text, ["referenzbereich", "referenzen", "case studies", "cases-bereich"])) return { kind:"semantic-section", name:"references" };
  if (includesAny(text, ["faq-bereich", "im faq", "häufige fragen"])) return { kind:"semantic-section", name:"faq" };
  if (includesAny(text, ["kontaktbereich", "kontakt-bereich", "im kontakt"])) return { kind:"semantic-section", name:"contact" };
  return null;
}
function scopedTarget(scope, base) {
  if (!scope) return base;
  if (scope.kind === "ordinal-section") return `section:nth-of-type(${scope.index}) ${base}`;
  const map = { hero: ".hero", services: "#factory-services,.services,.service-section", references: "#factory-references,.references,.projects,.cases", faq: "#factory-faq,.faq", contact: "#contact,.contact,.contact-section" };
  const section = map[scope.name];
  return section ? `${section} ${base}` : base;
}

export function planNaturalEdit(prompt = "", projectAnalysis = null) {
  const raw = clean(prompt, 4000); const text = raw.toLowerCase(); const operations = []; const targets = new Set(); const scope = detectScope(text);
  const rocket = includesAny(text,["rakete","rocket"]), smoke = includesAny(text,["rauch","smoke","dampf"]), hero = includesAny(text,["hero","startbereich","kopfbereich"]), nav = includesAny(text,["navigation","navbar","menü","header"]), cards = includesAny(text,["card","cards","karte","karten","kachel","kacheln"]), grid = includesAny(text,["grid","spalten","columns","karten","cards"]), section = includesAny(text,["section","sektion","abschnitt","bereich"]);
  const headline = extractHeadline(raw), subheadline = extractSubheadline(raw), ctaText = extractCtaText(raw), columns = extractColumns(raw);
  const heroSelector = resolveSemanticSelector(projectAnalysis,"hero",".hero"), heroCopy = resolveSemanticSelector(projectAnalysis,"hero_copy",".hero-copy"), cardSelector = resolveSemanticSelector(projectAnalysis,"cards",".card"), gridSelector = resolveSemanticSelector(projectAnalysis,"grid",".grid"), ctaSelector = resolveSemanticSelector(projectAnalysis,"cta",".cta"), navSelector = resolveSemanticSelector(projectAnalysis,"navigation",".site-header"), rocketSelector = resolveSemanticSelector(projectAnalysis,"rocket",".rocket-system"), smokeSelector = resolveSemanticSelector(projectAnalysis,"smoke",".smoke"), sectionSelector = resolveSemanticSelector(projectAnalysis,"section",".section");
  if (headline) operations.push(operation(scopedTarget(scope,"h1"),"replace_text",headline,"Replace scoped headline","headline",scope));
  if (subheadline) operations.push(operation(scopedTarget(scope,heroCopy),"replace_text",subheadline,"Replace scoped supporting text","subheadline",scope));
  if (ctaText) operations.push(operation(scopedTarget(scope,ctaSelector),"replace_text",ctaText,"Replace scoped CTA","cta",scope));
  if (hero && includesAny(text,["zentrier","mittig","center"])) operations.push(operation(scopedTarget(scope,heroCopy),"text_align","center","Center scoped hero copy","hero_copy",scope));
  if (cards && includesAny(text,["runder","abgerundet","runde ecken","rounded"])) operations.push(operation(scopedTarget(scope,cardSelector),"border_radius","22px","Round scoped cards","cards",scope));
  if (cards && includesAny(text,["eckiger","weniger rund","kantiger","square"])) operations.push(operation(scopedTarget(scope,cardSelector),"border_radius","6px","Square scoped cards","cards",scope));
  if (cards && includesAny(text,["mehr abstand","luftiger","mehr platz"])) operations.push(operation(scopedTarget(scope,cardSelector),"padding","28px","Increase scoped card padding","cards",scope));
  if (grid && columns) operations.push(operation(scopedTarget(scope,gridSelector),"columns",columns,"Set scoped grid columns","grid",scope));
  if (section && includesAny(text,["mehr abstand","luftiger","mehr platz"])) operations.push(operation(scope?.kind === "ordinal-section" ? `section:nth-of-type(${scope.index})` : sectionSelector,"vertical_spacing","88px","Increase scoped section spacing","section",scope));
  if (nav && includesAny(text,["transparent","durchsichtig"])) operations.push(operation(navSelector,"surface_opacity",0.72,"Increase header transparency","navigation",null));
  if (rocket && includesAny(text,["größer","riesig","massiv"])) operations.push(operation(scopedTarget(scope,rocketSelector),"scale",1.35,"Increase scoped rocket size","rocket",scope));
  if (smoke && includesAny(text,["mehr","dichter","viel"])) operations.push(operation(scopedTarget(scope,smokeSelector),"density",1.45,"Increase scoped smoke","smoke",scope));
  const explicitColor = /#[0-9a-f]{3,8}\b/i.exec(raw); if (explicitColor) operations.push(operation(":root","accent_color",explicitColor[0],"Apply accent color","theme",null));
  for (const op of operations) targets.add(op.semantic || op.target);
  return { version:3, mode:"natural-edit-plan", prompt:raw, targets:[...targets], operations, scope, project_aware:Boolean(projectAnalysis), resolved_selectors:projectAnalysis?.semantic || null, requires_interpretation:operations.length===0, safety:{ production_deploy:false, active_project_only:true, create_new_project:false, standalone_image_generation:false } };
}
