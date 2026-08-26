function clean(value, max = 180) {
  return String(value || "").trim().slice(0, max);
}

function slug(value) {
  return clean(value, 120)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "preview";
}

function cloudflareBranchAlias(branch) {
  return slug(branch).slice(0, 28).replace(/-+$/g, "") || "preview";
}

function json(value, status = 200) {
  return new Response(JSON.stringify(value, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=UTF-8", "cache-control": "no-store" }
  });
}

const DEFAULT_PAGES_PROJECT = "chatgpt-factory-preview";

export function buildPreviewPlan(input = {}, env = {}) {
  const projectSlug = slug(input.project_slug || input.project || "project");
  const branch = clean(input.branch || input.branch_name || `factory/${projectSlug}`, 180);
  const pagesProject = clean(env.CLOUDFLARE_PAGES_PROJECT || input.pages_project || DEFAULT_PAGES_PROJECT, 120);
  const safeBranch = cloudflareBranchAlias(branch);
  const previewUrl = `https://${safeBranch}.${pagesProject}.pages.dev`;

  return {
    ok: true,
    version: "1.5-alpha",
    project_slug: projectSlug,
    project_path: `projects/${projectSlug}`,
    branch,
    provider: "cloudflare_pages",
    preview_url: previewUrl,
    deployment: {
      automatic_production: false,
      preview_only: true,
      automatic_after_materialization: true,
      workflow: ".github/workflows/factory-preview.yml",
      workflow_dispatch_inputs: {
        project_slug: projectSlug,
        source_branch: branch
      }
    },
    cloudflare: {
      configured: true,
      pages_project: pagesProject,
      expected_branch_alias: previewUrl,
      required_github_secrets: ["CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID"],
      required_github_variable: null
    },
    gates: [
      "project_folder_must_exist",
      "ci_must_pass",
      "preview_before_production",
      "manual_production_approval"
    ],
    status: "PREVIEW_AUTOMATION_READY"
  };
}

export async function handlePreview(request, env = {}) {
  const url = new URL(request.url);
  if (request.method === "GET" && url.pathname === "/factory/preview") {
    return json({
      ok: true,
      endpoint: "POST /factory/preview/plan",
      provider: "cloudflare_pages",
      pages_project: DEFAULT_PAGES_PROJECT,
      automatic_after_materialization: true,
      production_deploy: false
    });
  }
  if (request.method !== "POST" || url.pathname !== "/factory/preview/plan") return null;
  let body;
  try { body = await request.json(); } catch { return json({ error: "INVALID_JSON" }, 400); }
  return json(buildPreviewPlan(body || {}, env));
}
