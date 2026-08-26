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

  for (const op of Array.isArray(plan.operations) ? plan.operations : []) {
    const target = clean(op.target, 120);
    const action = clean(op.action, 120);

    if (target === ".rocket" && action === "scale") {
      const scale = Math.max(0.5, Math.min(2.5, safeNumber(op.value, 1)));
      cssOverrides.push(overrideBlock(".rocket", { "--factory-rocket-scale": scale, transform: `scale(var(--factory-rocket-scale))` }));
      applied.push({ target, action, value: scale });
    } else if (target === ".rocket" && action === "detail_level" && op.value === "high") {
      cssOverrides.push(overrideBlock(".rocket", { filter: "drop-shadow(0 18px 24px rgba(0,0,0,.42)) drop-shadow(0 0 22px rgba(180,215,255,.16))", "backface-visibility": "hidden" }));
      cssOverrides.push(overrideBlock(".rocket-body, .booster", { "box-shadow": "inset -10px 0 18px rgba(0,0,0,.28), inset 8px 0 16px rgba(255,255,255,.12)" }));
      applied.push({ target, action, value: "high" });
    } else if (target === ".rocket" && action === "lighting" && op.value === "cinematic") {
      cssOverrides.push(overrideBlock(".rocket-body, .booster", { background: "linear-gradient(90deg, #8e99a6 0%, #eef4f8 28%, #aab6c2 58%, #55606c 100%)" }));
      applied.push({ target, action, value: "cinematic" });
    } else if (target === ".rocket" && action === "motion_profile") {
      const duration = op.value === "slower" ? "7.2s" : "4.1s";
      cssOverrides.push(overrideBlock(".rocket", { "animation-duration": duration }));
      applied.push({ target, action, value: op.value });
    } else if (target === ".smoke" && action === "density") {
      const density = Math.max(0.2, Math.min(2.5, safeNumber(op.value, 1)));
      cssOverrides.push(overrideBlock(".smoke", { opacity: Math.min(1, 0.48 * density).toFixed(2), transform: `scale(${Math.min(2.4, 0.9 + density * 0.35).toFixed(2)})` }));
      applied.push({ target, action, value: density });
    } else if (target === ".smoke" && action === "spread") {
      const spread = op.value === "wide" ? "1.55" : "1.25";
      cssOverrides.push(overrideBlock(".smoke-field", { transform: `scaleX(${spread})` }));
      applied.push({ target, action, value: op.value });
    } else if (target === ".hero" && action === "brightness") {
      const brightness = Math.max(0.4, Math.min(1.6, safeNumber(op.value, 1)));
      cssOverrides.push(overrideBlock(".hero", { filter: `brightness(${brightness})` }));
      applied.push({ target, action, value: brightness });
    } else if (target === ".hero" && action === "min_height") {
      cssOverrides.push(overrideBlock(".hero", { "min-height": clean(op.value, 32) }));
      applied.push({ target, action, value: clean(op.value, 32) });
    } else if (target === ".site-header" && action === "surface_opacity") {
      const opacity = Math.max(0, Math.min(1, safeNumber(op.value, 0.9)));
      cssOverrides.push(overrideBlock(".site-header", { background: `rgba(6, 9, 18, ${opacity})`, "backdrop-filter": "blur(18px)" }));
      applied.push({ target, action, value: opacity });
    } else if (target === ":root" && action === "accent_color" && /^#[0-9a-f]{3,8}$/i.test(clean(op.value, 16))) {
      cssOverrides.push(overrideBlock(":root", { "--accent": clean(op.value, 16) }));
      applied.push({ target, action, value: clean(op.value, 16) });
    }
  }

  if (!applied.length) return { error: "NO_EXECUTABLE_NATURAL_EDIT_OPERATIONS", applied: [] };

  const marker = "/* Project Factory V3 Natural Edit Overrides */";
  const nextCss = `${css.trimEnd()}\n\n${marker}\n${cssOverrides.filter(Boolean).join("\n\n")}\n`;
  return { ok: true, css: nextCss, html, applied, changed_files: ["styles.css"] };
}
