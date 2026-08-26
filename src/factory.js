const MODES = {
  generate: {
    label: "GENERATE",
    description: "Create a new website or app from a prompt, brief, screenshots or structured requirements."
  },
  rebuild: {
    label: "REBUILD",
    description: "Analyze an existing public website, extract business facts and structure, then plan an improved independent rebuild."
  },
  evolve: {
    label: "EVOLVE",
    description: "Improve an existing project through controlled iterations without rebuilding from zero."
  }
};

const DEFAULT_LIMITS = {
  max_iterations: 1,
  api_budget_eur: 0,
  auto_deploy: false,
  require_approval_before_production: true
};

function json(value, status = 200) {
  return new Response(JSON.stringify(value, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=UTF-8",
      "cache-control": "no-store"
    }
  });
}

function normalizeMode(value) {
  const mode = String(value || "").trim().toLowerCase();
  return MODES[mode] ? mode : null;
}

function cleanText(value, max = 4000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function limitsFrom(input = {}) {
  return {
    max_iterations: Math.floor(clampNumber(input.max_iterations, 0, 20, DEFAULT_LIMITS.max_iterations)),
    api_budget_eur: Number(clampNumber(input.api_budget_eur, 0, 1000, DEFAULT_LIMITS.api_budget_eur).toFixed(2)),
    auto_deploy: input.auto_deploy === true,
    require_approval_before_production: input.require_approval_before_production !== false
  };
}

function stepsFor(mode) {
  if (mode === "generate") {
    return [
      "normalize_brief",
      "derive_information_architecture",
      "derive_design_system",
      "generate_project_files",
      "run_static_checks",
      "create_preview",
      "review_against_brief"
    ];
  }
  if (mode === "rebuild") {
    return [
      "validate_source_url",
      "collect_public_pages",
      "extract_business_facts",
      "extract_information_architecture",
      "inventory_public_assets",
      "identify_ux_seo_conversion_gaps",
      "create_independent_rebuild_brief",
      "generate_project_files",
      "run_static_checks",
      "create_preview",
      "compare_business_coverage"
    ];
  }
  return [
    "inspect_existing_project",
    "identify_requested_changes",
    "protect_existing_contracts",
    "apply_targeted_changes",
    "run_static_checks",
    "create_preview",
    "compare_before_after"
  ];
}

function buildPlan(body) {
  const mode = normalizeMode(body.mode);
  if (!mode) return { error: "INVALID_MODE", allowed: Object.keys(MODES) };

  const prompt = cleanText(body.prompt);
  const sourceUrl = cleanText(body.source_url, 1000);
  const project = cleanText(body.project, 120);
  const limits = limitsFrom(body.limits || {});

  if (mode === "generate" && !prompt) return { error: "PROMPT_REQUIRED" };
  if (mode === "rebuild" && !sourceUrl) return { error: "SOURCE_URL_REQUIRED" };
  if (mode === "evolve" && !project) return { error: "PROJECT_REQUIRED" };

  return {
    version: "1.5-alpha",
    mode,
    mode_label: MODES[mode].label,
    project: project || null,
    source_url: sourceUrl || null,
    prompt: prompt || null,
    limits,
    execution: {
      default_mode: limits.max_iterations > 0 ? "assist" : "manual",
      automatic_loops_enabled: limits.max_iterations > 1,
      production_requires_approval: limits.require_approval_before_production,
      production_auto_deploy_requested: limits.auto_deploy
    },
    steps: stepsFor(mode),
    status: "PLANNED"
  };
}

export async function handleFactory(request) {
  const url = new URL(request.url);

  if (request.method === "GET" && url.pathname === "/factory") {
    return json({
      ok: true,
      service: "chatgpt-project-factory",
      version: "1.5-alpha",
      modes: MODES,
      defaults: DEFAULT_LIMITS,
      endpoints: {
        capabilities: "GET /factory/capabilities",
        plan: "POST /factory/plan"
      }
    });
  }

  if (request.method === "GET" && url.pathname === "/factory/capabilities") {
    return json({
      modes: MODES,
      execution_modes: {
        manual: "No autonomous iteration. ChatGPT/user drives each step.",
        assist: "One or a small number of bounded automated checks/iterations.",
        auto_loop: "Optional bounded autonomous iterations controlled by max_iterations and api_budget_eur."
      },
      safeguards: [
        "hard_iteration_limit",
        "hard_api_budget_limit",
        "production_approval_gate",
        "project_isolation",
        "preview_before_production"
      ]
    });
  }

  if (request.method === "POST" && url.pathname === "/factory/plan") {
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "INVALID_JSON" }, 400);
    }
    const plan = buildPlan(body || {});
    return json(plan, plan.error ? 400 : 200);
  }

  return null;
}
