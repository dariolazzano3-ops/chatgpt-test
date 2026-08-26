function jsonHeaders(token) {
  return {
    "authorization": `Bearer ${token}`,
    "accept": "application/vnd.github+json",
    "x-github-api-version": "2022-11-28",
    "content-type": "application/json"
  };
}

function clean(value, max = 160) {
  return String(value || "").trim().slice(0, max);
}

function slugify(value) {
  return clean(value, 120).toLowerCase().normalize("NFKD").replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "project";
}

function authorized(request, env) {
  if (!env.API_TOKEN) return false;
  return (request.headers.get("authorization") || "") === `Bearer ${env.API_TOKEN}`;
}

async function github(token, path, init = {}) {
  const response = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: { ...jsonHeaders(token), ...(init.headers || {}) }
  });
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = { raw: text }; }
  if (!response.ok) {
    const error = new Error(body?.message || `GITHUB_HTTP_${response.status}`);
    error.status = response.status;
    error.body = body;
    throw error;
  }
  return body;
}

function validateFiles(files) {
  if (!files || typeof files !== "object" || Array.isArray(files)) return { error: "FILES_REQUIRED" };
  const entries = Object.entries(files);
  if (!entries.length) return { error: "FILES_REQUIRED" };
  if (entries.length > 30) return { error: "TOO_MANY_FILES" };
  const normalized = [];
  for (const [rawPath, rawContent] of entries) {
    const path = String(rawPath || "").replace(/^\/+/, "");
    if (!path || path.includes("..") || path.startsWith(".git/") || path.length > 240) return { error: "INVALID_FILE_PATH", path: rawPath };
    if (typeof rawContent !== "string") return { error: "FILE_CONTENT_MUST_BE_TEXT", path };
    if (rawContent.length > 500_000) return { error: "FILE_TOO_LARGE", path };
    normalized.push([path, rawContent]);
  }
  return { ok: true, entries: normalized };
}

function previewAlias(branch, pagesProject = "chatgpt-factory-preview") {
  const safeBranch = slugify(branch);
  return `https://${safeBranch}.${pagesProject}.pages.dev`;
}

export async function materializeProject(request, env, body = {}) {
  if (!authorized(request, env)) return { error: "UNAUTHORIZED", status: 401 };
  if (!env.GITHUB_TOKEN) return { error: "GITHUB_TOKEN_NOT_CONFIGURED", status: 503 };

  const repository = clean(env.GITHUB_REPOSITORY || "dariolazzano3-ops/chatgpt-test", 200);
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) return { error: "INVALID_GITHUB_REPOSITORY", status: 500 };
  const [owner, repo] = repository.split("/");
  const base = clean(body.base_branch || "main", 100) || "main";
  const projectName = clean(body.project_name || body.blueprint?.project?.name || "Project", 120);
  const projectSlug = slugify(body.project_slug || body.blueprint?.project?.slug || projectName);
  const filesInput = body.files || body.blueprint?.files;
  const checked = validateFiles(filesInput);
  if (!checked.ok) return { ...checked, status: 400 };

  const prefix = `projects/${projectSlug}`;
  const branch = clean(body.branch_name || `factory/${projectSlug}-${Date.now()}`, 180);
  if (!/^[A-Za-z0-9._\/-]+$/.test(branch)) return { error: "INVALID_BRANCH_NAME", status: 400 };

  try {
    const baseRef = await github(env.GITHUB_TOKEN, `/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(base)}`);
    const baseSha = baseRef?.object?.sha;
    if (!baseSha) return { error: "BASE_BRANCH_SHA_NOT_FOUND", status: 502 };

    await github(env.GITHUB_TOKEN, `/repos/${owner}/${repo}/git/refs`, {
      method: "POST",
      body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: baseSha })
    });

    const written = [];
    for (const [relativePath, content] of checked.entries) {
      const fullPath = `${prefix}/${relativePath}`;
      await github(env.GITHUB_TOKEN, `/repos/${owner}/${repo}/contents/${fullPath.split("/").map(encodeURIComponent).join("/")}`, {
        method: "PUT",
        body: JSON.stringify({
          message: `Factory: add ${projectName} ${relativePath}`,
          content: btoa(unescape(encodeURIComponent(content))),
          branch
        })
      });
      written.push(fullPath);
    }

    const triggerPath = `${prefix}/.factory-preview-trigger`;
    const triggerPayload = JSON.stringify({
      project_slug: projectSlug,
      branch,
      created_at: new Date().toISOString()
    }, null, 2);
    await github(env.GITHUB_TOKEN, `/repos/${owner}/${repo}/contents/${triggerPath.split("/").map(encodeURIComponent).join("/")}`, {
      method: "PUT",
      body: JSON.stringify({
        message: `Factory: trigger preview for ${projectName}`,
        content: btoa(unescape(encodeURIComponent(triggerPayload))),
        branch
      })
    });
    written.push(triggerPath);

    const pr = await github(env.GITHUB_TOKEN, `/repos/${owner}/${repo}/pulls`, {
      method: "POST",
      body: JSON.stringify({
        title: `Factory: ${projectName}`,
        head: branch,
        base,
        draft: true,
        body: `Generated by Project Factory v1.5.\n\nProject: ${projectName}\nPath: \`${prefix}/\`\n\nPreview: ${previewAlias(branch)}\n\nProduction deployment remains approval-gated.`
      })
    });

    return {
      ok: true,
      status: 201,
      repository,
      base_branch: base,
      branch,
      project_path: prefix,
      files_written: written,
      preview: {
        automatic: true,
        status: "QUEUED_BY_GITHUB_PUSH",
        provider: "cloudflare_pages",
        url: previewAlias(branch),
        workflow: ".github/workflows/factory-preview.yml"
      },
      pull_request: {
        number: pr?.number,
        url: pr?.html_url,
        draft: pr?.draft === true
      },
      production_deployed: false
    };
  } catch (error) {
    return {
      error: "GITHUB_MATERIALIZATION_FAILED",
      message: clean(error?.message || "Unknown GitHub error", 300),
      github_status: error?.status || null,
      status: 502
    };
  }
}
