import { analyzeProject, resolveSemanticSelector } from "./project-analyzer.js";

function clean(value, max = 4000) { return String(value || "").trim().slice(0, max); }
function safeNumber(value, fallback = 1) { const n = Number(value); return Number.isFinite(n) ? n : fallback; }
function escapeHtml(value = "") { return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
function overrideBlock(selector, declarations = {}) { const body = Object.entries(declarations).filter(([, value]) => value !== null && value !== undefined && value !== "").map(([key, value]) => `  ${key}: ${value};`).join("\n"); return body ? `${selector} {\n${body}\n}` : ""; }
function mediaBlock(query, blocks = []) { const body = blocks.filter(Boolean).map((block) => block.split("\n").map((line) => `  ${line}`).join("\n")).join("\n\n"); return body ? `@media(${query}) {\n${body}\n}` : ""; }
const MANAGED_START = "/* Project Factory V3 Overrides: START */";
const MANAGED_END = "/* Project Factory V3 Overrides: END */";
const LEGACY_MARKER = "/* Project Factory V3 Natural Edit Overrides */";
function extractFactoryOverrideBody(css = "") { const match = String(css || "").match(/\/\* Project Factory V3 Overrides: START \*\/([\s\S]*?)\/\* Project Factory V3 Overrides: END \*\//); return match?.[1]?.trim() || ""; }
function stripFactoryOverrides(css = "") { let next = String(css || ""); next = next.replace(/\/\* Project Factory V3 Overrides: START \*\/[\s\S]*?\/\* Project Factory V3 Overrides: END \*\//g, ""); const legacyIndex = next.indexOf(LEGACY_MARKER); if (legacyIndex !== -1) next = next.slice(0, legacyIndex); return next.trimEnd(); }
function buildManagedOverrideBlock(blocks = []) { const body = blocks.filter(Boolean).join("\n\n").trim(); return body ? `${MANAGED_START}\n${body}\n${MANAGED_END}` : ""; }
function replaceHeadline(html, value) { return /<h1\b[^>]*>[\s\S]*?<\/h1>/i.test(html) ? html.replace(/(<h1\b[^>]*>)[\s\S]*?(<\/h1>)/i, `$1${escapeHtml(value)}$2`) : html; }
function replaceSubheadline(html, value) { const heroLead = /(<(?:p|div)\b[^>]*class=["'][^"']*(?:hero-copy|hero-text|hero-lead|lead|subtitle|subheadline)[^"']*["'][^>]*>)[\s\S]*?(<\/(?:p|div)>)/i; if (heroLead.test(html)) return html.replace(heroLead, `$1${escapeHtml(value)}$2`); const afterH1 = /(<h1\b[^>]*>[\s\S]*?<\/h1>[\s\S]*?<p\b[^>]*>)[\s\S]*?(<\/p>)/i; return afterH1.test(html) ? html.replace(afterH1, `$1${escapeHtml(value)}$2`) : html; }
function replaceCta(html, value) { const cta = /(<a\b[^>]*class=["'][^"']*(?:cta|btn-primary|button-primary|hero-cta)[^"']*["'][^>]*>)[\s\S]*?(<\/a>)/i; if (cta.test(html)) return html.replace(cta, `$1${escapeHtml(value)}$2`); const button = /(<button\b[^>]*>)[\s\S]*?(<\/button>)/i; return button.test(html) ? html.replace(button, `$1${escapeHtml(value)}$2`) : html; }

export function executeNaturalEditPlan({ css = "", html = "", plan }) {
  if (!plan || plan.mode !== "natural-edit-plan") return { error: "INVALID_NATURAL_EDIT_PLAN" };
  if (plan?.safety?.production_deploy !== false) return { error: "PRODUCTION_MUST_REMAIN_DISABLED" };
  if (plan?.safety?.active_project_only !== true) return { error: "ACTIVE_PROJECT_ONLY_REQUIRED" };
  const priorManagedBody = extractFactoryOverrideBody(css);
  const cleanCss = stripFactoryOverrides(css);
  const analysis = analyzeProject({ html, css: cleanCss });
  const resolved = analysis.semantic || {};
  const cssOverrides = [];
  const applied = [];
  let nextHtml = String(html || "");

  for (const op of Array.isArray(plan.operations) ? plan.operations : []) {
    const semantic = clean(op.semantic, 80);
    const fallbackTarget = clean(op.target, 120);
    const target = semantic && !["theme", "headline", "subheadline"].includes(semantic) ? resolveSemanticSelector(analysis, semantic, fallbackTarget) : fallbackTarget;
    const action = clean(op.action, 120);
    if (!target) continue;
    if (semantic === "headline" && action === "replace_text") {
      const value = clean(op.value, 180); const changed = value ? replaceHeadline(nextHtml, value) : nextHtml; if (changed === nextHtml) continue; nextHtml = changed; applied.push({ target: "h1", action, value, semantic });
    } else if (semantic === "subheadline" && action === "replace_text") {
      const value = clean(op.value, 260); const changed = value ? replaceSubheadline(nextHtml, value) : nextHtml; if (changed === nextHtml) continue; nextHtml = changed; applied.push({ target: "hero-supporting-text", action, value, semantic });
    } else if (semantic === "cta" && action === "replace_text") {
      const value = clean(op.value, 100); const changed = value ? replaceCta(nextHtml, value) : nextHtml; if (changed === nextHtml) continue; nextHtml = changed; applied.push({ target, action, value, semantic });
    } else if (semantic === "rocket" && action === "scale") {
      const scale = Math.max(0.5, Math.min(2.5, safeNumber(op.value, 1))); cssOverrides.push(overrideBlock(target, { "--factory-rocket-scale": scale, scale: "var(--factory-rocket-scale)" })); applied.push({ target, action, value: scale, semantic });
    } else if (semantic === "rocket" && action === "detail_level" && op.value === "high") {
      cssOverrides.push(overrideBlock(target, { filter: "drop-shadow(0 18px 24px rgba(0,0,0,.42)) drop-shadow(0 0 22px rgba(180,215,255,.16))", "backface-visibility": "hidden" })); const body = resolved.rocket_body; if (body) cssOverrides.push(overrideBlock(`${body}, .booster`, { "box-shadow": "inset -10px 0 18px rgba(0,0,0,.28), inset 8px 0 16px rgba(255,255,255,.12)" })); applied.push({ target, action, value: "high", semantic });
    } else if (semantic === "rocket" && action === "lighting" && op.value === "cinematic") {
      const body = resolved.rocket_body || target; cssOverrides.push(overrideBlock(`${body}, .booster`, { background: "linear-gradient(90deg, #8e99a6 0%, #eef4f8 28%, #aab6c2 58%, #55606c 100%)" })); applied.push({ target, action, value: "cinematic", semantic });
    } else if (semantic === "rocket" && action === "motion_profile") {
      const duration = op.value === "slower" ? "7.2s" : "4.1s"; cssOverrides.push(overrideBlock(target, { "animation-duration": duration })); applied.push({ target, action, value: op.value, semantic });
    } else if (semantic === "smoke" && action === "density") {
      const density = Math.max(0.2, Math.min(2.5, safeNumber(op.value, 1))); cssOverrides.push(overrideBlock(target, { opacity: Math.min(1, 0.48 * density).toFixed(2), scale: Math.min(2.4, 0.9 + density * 0.35).toFixed(2) })); applied.push({ target, action, value: density, semantic });
    } else if (semantic === "smoke" && action === "spread") {
      const spread = op.value === "wide" ? "1.55" : "1.25"; const field = resolved.smoke_field || target; cssOverrides.push(overrideBlock(field, { transform: `scaleX(${spread})` })); applied.push({ target: field, action, value: op.value, semantic });
    } else if (semantic === "hero" && action === "brightness") {
      const brightness = Math.max(0.4, Math.min(1.6, safeNumber(op.value, 1))); cssOverrides.push(overrideBlock(target, { filter: `brightness(${brightness})` })); applied.push({ target, action, value: brightness, semantic });
    } else if (semantic === "hero" && action === "min_height") {
      cssOverrides.push(overrideBlock(target, { "min-height": clean(op.value, 32) })); applied.push({ target, action, value: clean(op.value, 32), semantic });
    } else if (semantic === "hero_copy" && action === "text_align") {
      const align = op.value === "center" ? "center" : "left"; cssOverrides.push(overrideBlock(target, { "text-align": align, "align-items": align === "center" ? "center" : "flex-start" })); applied.push({ target, action, value: align, semantic });
    } else if (semantic === "cards" && action === "border_radius") {
      const value = clean(op.value, 32); cssOverrides.push(overrideBlock(target, { "border-radius": value })); applied.push({ target, action, value, semantic });
    } else if (semantic === "cards" && action === "padding") {
      const value = clean(op.value, 32); cssOverrides.push(overrideBlock(target, { padding: value })); applied.push({ target, action, value, semantic });
    } else if (semantic === "grid" && action === "columns") {
      const count = Math.max(1, Math.min(4, Math.round(safeNumber(op.value, 3)))); cssOverrides.push(overrideBlock(target, { "grid-template-columns": `repeat(${count}, minmax(0, 1fr))` })); cssOverrides.push(mediaBlock("max-width:760px", [overrideBlock(target, { "grid-template-columns": "1fr" })])); applied.push({ target, action, value: count, semantic });
    } else if (semantic === "section" && action === "vertical_spacing") {
      const value = clean(op.value, 32); cssOverrides.push(overrideBlock(target, { "padding-top": value, "padding-bottom": value })); applied.push({ target, action, value, semantic });
    } else if (semantic === "hero" && action === "mobile_launch_containment") {
      const rocket = resolved.rocket || ".rocket-system"; const smokeField = resolved.smoke_field || ".smoke-field"; const mobileSmokeKeyframes = `@keyframes factoryMobileSmokeBillow {\n  0% { opacity: 0; transform: translate(0,80px) scale(.3); }\n  16% { opacity: .9; }\n  42% { opacity: .88; transform: translate(0,10px) scale(.9); }\n  100% { opacity: .16; transform: translate(0,-120px) scale(1.02); }\n}`;
      cssOverrides.push(mediaBlock("max-width:760px", [overrideBlock(target, { overflow: "hidden", "max-width": "100%", contain: "paint" }), overrideBlock(".launch-scene", { overflow: "hidden", "max-width": "100%", contain: "paint" }), overrideBlock(rocket, { right: "0", "max-width": "calc(100% - 8px)" }), overrideBlock(".launch-pad", { right: "0", "max-width": "100%" }), overrideBlock(".launch-glow", { right: "0", "max-width": "100%", "transform-origin": "right center" }), overrideBlock(smokeField, { right: "0", width: "100%", overflow: "hidden", "max-width": "100%", contain: "paint" }), overrideBlock(`${smokeField} .smoke`, { "max-width": "62%", "transform-origin": "center center", "animation-name": "factoryMobileSmokeBillow" }), mobileSmokeKeyframes])); applied.push({ target, action, value: "geometry-strict", semantic });
    } else if (semantic === "navigation" && action === "surface_opacity") {
      const opacity = Math.max(0, Math.min(1, safeNumber(op.value, 0.9))); cssOverrides.push(overrideBlock(target, { background: `rgba(6, 9, 18, ${opacity})`, "backdrop-filter": "blur(18px)" })); applied.push({ target, action, value: opacity, semantic });
    } else if (target === ":root" && action === "accent_color" && /^#[0-9a-f]{3,8}$/i.test(clean(op.value, 16))) {
      cssOverrides.push(overrideBlock(":root", { "--accent": clean(op.value, 16) })); applied.push({ target, action, value: clean(op.value, 16), semantic: "theme" });
    }
  }
  if (!applied.length) return { error: "NO_EXECUTABLE_NATURAL_EDIT_OPERATIONS", applied: [], analysis };
  const managedBlock = buildManagedOverrideBlock([priorManagedBody, ...cssOverrides]);
  const nextCss = managedBlock ? `${cleanCss}\n\n${managedBlock}\n` : `${cleanCss}\n`;
  const changedFiles = []; if (nextHtml !== html) changedFiles.push("index.html"); if (nextCss !== css) changedFiles.push("styles.css");
  return { ok: true, css: nextCss, html: nextHtml, applied, analysis, override_management: { mode: "append-preserve", prior_managed_overrides_preserved: Boolean(priorManagedBody), legacy_overrides_removed: css.includes(LEGACY_MARKER), managed_block: Boolean(managedBlock) }, changed_files: changedFiles };
}
