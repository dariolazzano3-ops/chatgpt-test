import { resolveSemanticSelector } from "./project-analyzer.js";

function clean(value, max = 4000) {
  return String(value || "").trim().slice(0, max);
}

function includesAny(text, terms) {
  return terms.some((term) => text.includes(term));
}

function detectIntensity(text) {
  if (includesAny(text, ["viel größer", "deutlich größer", "massiv", "riesig", "brutaler", "extrem", "richtig viel"])) return "strong";
  if (includesAny(text, ["größer", "mehr", "stärker", "dichter", "dunkler", "heller", "realistischer"])) return "medium";
  if (includesAny(text, ["etwas", "leicht", "bisschen", "bishen", "dezent"])) return "light";
  return "normal";
}

function operation(target, action, value, reason, semantic = null) {
  return { target, action, value, reason, semantic };
}

export function planNaturalEdit(prompt = "", projectAnalysis = null) {
  const raw = clean(prompt, 4000);
  const text = raw.toLowerCase();
  const intensity = detectIntensity(text);
  const operations = [];
  const targets = new Set();

  const rocket = includesAny(text, ["rakete", "rocket"]);
  const smoke = includesAny(text, ["rauch", "smoke", "dampf"]);
  const hero = includesAny(text, ["hero", "startbereich", "kopfbereich", "hintergrund"]);
  const nav = includesAny(text, ["navigation", "navbar", "menü", "header"]);

  const rocketSelector = resolveSemanticSelector(projectAnalysis, "rocket", ".rocket-system");
  const smokeSelector = resolveSemanticSelector(projectAnalysis, "smoke", ".smoke");
  const heroSelector = resolveSemanticSelector(projectAnalysis, "hero", ".hero");
  const navSelector = resolveSemanticSelector(projectAnalysis, "navigation", ".site-header");

  if (rocket) {
    targets.add("rocket");
    if (includesAny(text, ["größer", "riesig", "massiv"])) {
      const scale = intensity === "strong" ? 1.6 : intensity === "light" ? 1.15 : 1.35;
      operations.push(operation(rocketSelector, "scale", scale, "Increase rocket visual size", "rocket"));
    }
    if (includesAny(text, ["realistisch", "realistischer", "echter"])) {
      operations.push(operation(rocketSelector, "detail_level", "high", "Increase visual realism and structural detail", "rocket"));
      operations.push(operation(rocketSelector, "lighting", "cinematic", "Improve metallic lighting and depth", "rocket"));
    }
    if (includesAny(text, ["schneller", "langsamer"])) {
      operations.push(operation(rocketSelector, "motion_profile", text.includes("langsamer") ? "slower" : "faster", "Adjust launch timing", "rocket"));
    }
  }

  if (smoke) {
    targets.add("smoke");
    if (includesAny(text, ["mehr", "richtig", "massiv", "dichter", "viel"])) {
      const density = intensity === "strong" ? 1.8 : intensity === "light" ? 1.15 : 1.45;
      operations.push(operation(smokeSelector, "density", density, "Increase launch smoke volume", "smoke"));
      operations.push(operation(smokeSelector, "spread", intensity === "strong" ? "wide" : "medium", "Expand smoke footprint", "smoke"));
    }
    if (includesAny(text, ["weniger", "reduzier", "leichter"])) {
      operations.push(operation(smokeSelector, "density", 0.7, "Reduce smoke volume", "smoke"));
    }
  }

  if (hero) {
    targets.add("hero");
    if (text.includes("dunkler")) operations.push(operation(heroSelector, "brightness", 0.78, "Darken hero presentation", "hero"));
    if (text.includes("heller")) operations.push(operation(heroSelector, "brightness", 1.12, "Brighten hero presentation", "hero"));
    if (includesAny(text, ["größer", "höher"])) operations.push(operation(heroSelector, "min_height", "92svh", "Increase hero presence", "hero"));
  }

  if (nav) {
    targets.add("navigation");
    if (includesAny(text, ["transparent", "durchsichtig"])) operations.push(operation(navSelector, "surface_opacity", 0.72, "Increase header transparency", "navigation"));
    if (text.includes("dunkler")) operations.push(operation(navSelector, "surface_opacity", 0.94, "Increase header contrast", "navigation"));
  }

  const explicitColor = /#[0-9a-f]{3,8}\b/i.exec(raw);
  if (explicitColor) {
    targets.add("theme");
    operations.push(operation(":root", "accent_color", explicitColor[0], "Apply explicit accent color", "theme"));
  }

  return {
    version: 2,
    mode: "natural-edit-plan",
    prompt: raw,
    intensity,
    targets: [...targets],
    operations,
    project_aware: Boolean(projectAnalysis),
    resolved_selectors: projectAnalysis?.semantic || null,
    requires_interpretation: operations.length === 0,
    safety: {
      production_deploy: false,
      active_project_only: true,
      create_new_project: false,
      standalone_image_generation: false
    }
  };
}
