function clean(value, max = 4000) {
  return String(value || "").trim().slice(0, max);
}

function safeNumber(value, fallback = 1) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function overrideBlock(selector, declarations = {}) {
  const body = Object.entries(declarations)
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .map(([key, value]) => `  ${key}: ${value};`)
    .join("\n");
  return body ? `${selector} {\n${body}\n}` : "";
}

export function executeNaturalEditPlan({ css = "", html = "", plan }) {
  if (!plan || plan.mode !== "natural-edit-plan") return { error: "INVALID_NATURAL_EDIT_PLAN" };
  if (plan?.safety?.production_deploy !== false) return { error: "PRODUCTION_MUST_REMAIN_DISABLED" };
  if (plan?.safety?.active_project_only !== true) return { error: "ACTIVE_PROJECT_ONLY_REQUIRED" };

  const cssOverrides = [];
  const applied = [];
  const resolved = plan.resolved_selectors || {};

  for (const op of Array.isArray(plan.operations) ? plan.operations : []) {
    const target = clean(op.target, 120);
    const action = clean(op.action, 120);
    const semantic = clean(op.semantic, 80);

    if (semantic === "rocket" && action === "scale") {
      const scale = Math.max(0.5, Math.min(2.5, safeNumber(op.value, 1)));
      cssOverrides.push(overrideBlock(target, { "--factory-rocket-scale": scale, scale: "var(--factory-rocket-scale)" }));
      applied.push({ target, action, value: scale, semantic });
    } else if (semantic === "rocket" && action === "detail_level" && op.value === "high") {
      cssOverrides.push(overrideBlock(target, { filter: "drop-shadow(0 18px 24px rgba(0,0,0,.42)) drop-shadow(0 0 22px rgba(180,215,255,.16))", "backface-visibility": "hidden" }));
      const body = resolved.rocket_body;
      if (body) cssOverrides.push(overrideBlock(`${body}, .booster`, { "box-shadow": "inset -10px 0 18px rgba(0,0,0,.28), inset 8px 0 16px rgba(255,255,255,.12)" }));
      applied.push({ target, action, value: "high", semantic });
    } else if (semantic === "rocket" && action === "lighting" && op.value === "cinematic") {
      const body = resolved.rocket_body || target;
      cssOverrides.push(overrideBlock(`${body}, .booster`, { background: "linear-gradient(90deg, #8e99a6 0%, #eef4f8 28%, #aab6c2 58%, #55606c 100%)" }));
      applied.push({ target, action, value: "cinematic", semantic });
    } else if (semantic === "rocket" && action === "motion_profile") {
      const duration = op.value === "slower" ? "7.2s" : "4.1s";
      cssOverrides.push(overrideBlock(target, { "animation-duration": duration }));
      applied.push({ target, action, value: op.value, semantic });
    } else if (semantic === "smoke" && action === "density") {
      const density = Math.max(0.2, Math.min(2.5, safeNumber(op.value, 1)));
      cssOverrides.push(overrideBlock(target, { opacity: Math.min(1, 0.48 * density).toFixed(2), scale: Math.min(2.4, 0.9 + density * 0.35).toFixed(2) }));
      applied.push({ target, action, value: density, semantic });
    } else if (semantic === "smoke" && action === "spread") {
      const spread = op.value === "wide" ? "1.55" : "1.25";
      const field = resolved.smoke_field || ".smoke-field";
      cssOverrides.push(overrideBlock(field, { "transform": `scaleX(${spread})` }));
      applied.push({ target: field, action, value: op.value, semantic });
    } else if (semantic === "hero" && action === "brightness") {
      const brightness = Math.max(0.4, Math.min(1.6, safeNumber(op.value, 1)));
      cssOverrides.push(overrideBlock(target, { filter: `brightness(${brightness})` }));
      applied.push({ target, action, value: brightness, semantic });
    } else if (semantic === "hero" && action === "min_height") {
      cssOverrides.push(overrideBlock(target, { "min-height": clean(op.value, 32) }));
      applied.push({ target, action, value: clean(op.value, 32), semantic });
    } else if (semantic === "navigation" && action === "surface_opacity") {
      const opacity = Math.max(0, Math.min(1, safeNumber(op.value, 0.9)));
      cssOverrides.push(overrideBlock(target, { background: `rgba(6, 9, 18, ${opacity})`, "backdrop-filter": "blur(18px)" }));
      applied.push({ target, action, value: opacity, semantic });
    } else if (target === ":root" && action === "accent_color" && /^#[0-9a-f]{3,8}$/i.test(clean(op.value, 16))) {
      cssOverrides.push(overrideBlock(":root", { "--accent": clean(op.value, 16) }));
      applied.push({ target, action, value: clean(op.value, 16), semantic: "theme" });
    }
  }

  if (!applied.length) return { error: "NO_EXECUTABLE_NATURAL_EDIT_OPERATIONS", applied: [] };

  const marker = "/* Project Factory V3 Natural Edit Overrides */";
  const nextCss = `${css.trimEnd()}\n\n${marker}\n${cssOverrides.filter(Boolean).join("\n\n")}\n`;
  return { ok: true, css: nextCss, html, applied, changed_files: ["styles.css"] };
}
