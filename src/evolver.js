function clean(value, max = 4000) {
  return String(value || "").trim().slice(0, max);
}

function slugify(value) {
  return clean(value, 120).toLowerCase().normalize("NFKD").replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "project";
}

function authorized(request, env) {
  if (!env.API_TOKEN) return false;
  return (request.headers.get("authorization") || "") === `Bearer ${env.API_TOKEN}`;
}

function headers(token) {
  return {
    authorization: `Bearer ${token}`,
    accept: "application/vnd.github+json",
    "x-github-api-version": "2022-11-28",
    "content-type": "application/json"
  };
}

async function github(token, path, init = {}) {
  const response = await fetch(`https://api.github.com${path}`, { ...init, headers: { ...headers(token), ...(init.headers || {}) } });
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = { raw: text }; }
  if (!response.ok) {
    const error = new Error(body?.message || `GITHUB_HTTP_${response.status}`);
    error.status = response.status;
    throw error;
  }
  return body;
}

function decodeBase64(content) {
  return decodeURIComponent(escape(atob(String(content || "").replace(/\n/g, ""))));
}

function encodeBase64(content) {
  return btoa(unescape(encodeURIComponent(content)));
}

function replaceFirst(source, regex, replacement) {
  return regex.test(source) ? source.replace(regex, replacement) : source;
}

function evolveIndex(html, changes = {}) {
  let next = html;
  const applied = [];

  if (clean(changes.title, 160)) {
    next = replaceFirst(next, /<title>[\s\S]*?<\/title>/i, `<title>${clean(changes.title, 160)}</title>`);
    applied.push("title");
  }
  if (clean(changes.meta_description, 320)) {
    const value = clean(changes.meta_description, 320).replace(/"/g, "&quot;");
    if (/<meta[^>]+name=["']description["'][^>]*>/i.test(next)) {
      next = next.replace(/<meta[^>]+name=["']description["'][^>]*>/i, `<meta name="description" content="${value}">`);
    } else {
      next = next.replace(/<\/head>/i, `  <meta name="description" content="${value}">\n</head>`);
    }
    applied.push("meta_description");
  }
  if (clean(changes.headline, 240)) {
    next = replaceFirst(next, /<h1([^>]*)>[\s\S]*?<\/h1>/i, `<h1$1>${clean(changes.headline, 240)}</h1>`);
    applied.push("headline");
  }
  if (clean(changes.cta_text, 120)) {
    next = replaceFirst(next, /<a([^>]*class=["'][^"']*cta[^"']*["'][^>]*)>[\s\S]*?<\/a>/i, `<a$1>${clean(changes.cta_text, 120)}</a>`);
    applied.push("cta_text");
  }

  return { content: next, applied };
}

function evolveCss(css, changes = {}) {
  let next = css;
  const applied = [];
  if (clean(changes.accent_color, 32) && /^#[0-9a-f]{3,8}$/i.test(clean(changes.accent_color, 32))) {
    const value = clean(changes.accent_color, 32);
    if (/--accent\s*:[^;}]+/i.test(next)) next = next.replace(/--accent\s*:[^;}]+/i, `--accent:${value}`);
    else next = `:root{--accent:${value}}\n${next}`;
    applied.push("accent_color");
  }
  if (clean(changes.radius, 32) && /^\d+(?:\.\d+)?(?:px|rem|em|%)$/i.test(clean(changes.radius, 32))) {
    const value = clean(changes.radius, 32);
    if (/--radius\s*:[^;}]+/i.test(next)) next = next.replace(/--radius\s*:[^;}]+/i, `--radius:${value}`);
    else next = `:root{--radius:${value}}\n${next}`;
    applied.push("radius");
  }
  return { content: next, applied };
}

function inferChanges(body = {}) {
  const explicit = body.changes && typeof body.changes === "object" ? { ...body.changes } : {};
  const prompt = clean(body.prompt, 4000);
  const rules = [
    ["headline", /(?:headline|überschrift)\s*[:=]\s*["“]?([^\n"”]{3,240})/i],
    ["cta_text", /(?:cta|button(?:text)?)\s*[:=]\s*["“]?([^\n"”]{2,120})/i],
    ["accent_color", /(?:accent|akzent(?:farbe)?)\s*[:=]\s*(#[0-9a-f]{3,8})/i],
    ["meta_description", /(?:meta description|beschreibung)\s*[:=]\s*["“]?([^\n"”]{10,320})/i]
  ];
  for (const [key, regex] of rules) {
    if (explicit[key]) continue;
    const match = regex.exec(prompt);
    if (match) explicit[key] = match[1].trim();
  }
  return explicit;
}

export function buildEvolvePlan(body = {}) {
  const projectSlug = slugify(body.project_slug || body.project || "");
  if (!clean(body.project_slug || body.project, 120)) return { error: "PROJECT_REQUIRED" };
  if (!clean(body.prompt, 4000) && (!body.changes || typeof body.changes !== "object")) return { error: "PROMPT_OR_CHANGES_REQUIRED" };
  const changes = inferChanges(body);
  const recognized = Object.keys(changes).filter((key) => ["title", "meta_description", "headline", "cta_text", "accent_color", "radius"].includes(key));
  return {
    ok: true,
    version: "1.5-alpha",
    mode: "evolve",
    project_slug: projectSlug,
    prompt: clean(body.prompt, 4000) || null,
    changes,
    recognized_changes: recognized,
    unsupported_prompt_requires_ai_or_manual_edit: recognized.length === 0,
    protected_contracts: ["project_path", "production_approval_gate", "branch_isolation", "existing_unrelated_files"],
    status: recognized.length ? "EVOLVE_PLAN_READY" : "EVOLVE_PLAN_NEEDS_INTERPRETATION"
  };
}

export async function evolveProject(request, env, body = {}) {
  if (!authorized(request, env)) return { error: "UNAUTHORIZED", status: 401 };
  if (!env.GITHUB_TOKEN) return { error: "GITHUB_TOKEN_NOT_CONFIGURED", status: 503 };

  const plan = buildEvolvePlan(body);
  if (plan.error) return { ...plan, status: 400 };
  if (!plan.recognized_changes.length) return { ...plan, status: 422 };

  const repository = clean(env.GITHUB_REPOSITORY || "dariolazzano3-ops/chatgpt-test", 200);
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) return { error: "INVALID_GITHUB_REPOSITORY", status: 500 };
  const [owner, repo] = repository.split("/");
  const base = clean(body.base_branch || "main", 100) || "main";
  const branch = clean(body.branch_name || `factory/evolve-${plan.project_slug}-${Date.now()}`, 180);
  const prefix = `projects/${plan.project_slug}`;

  try {
    const baseRef = await github(env.GITHUB_TOKEN, `/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(base)}`);
    const baseSha = baseRef?.object?.sha;
    if (!baseSha) return { error: "BASE_BRANCH_SHA_NOT_FOUND", status: 502 };

    await github(env.GITHUB_TOKEN, `/repos/${owner}/${repo}/git/refs`, {
      method: "POST",
      body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: baseSha })
    });

    const updates = [];
    const targets = ["index.html", "styles.css"];
    for (const filename of targets) {
      let current;
      try {
        current = await github(env.GITHUB_TOKEN, `/repos/${owner}/${repo}/contents/${prefix}/${filename}?ref=${encodeURIComponent(branch)}`);
      } catch (error) {
        if (error.status === 404) continue;
        throw error;
      }
      if (!current?.content || !current?.sha) continue;
      const original = decodeBase64(current.content);
      const evolved = filename === "index.html" ? evolveIndex(original, plan.changes) : evolveCss(original, plan.changes);
      if (evolved.content === original) continue;
      await github(env.GITHUB_TOKEN, `/repos/${owner}/${repo}/contents/${prefix}/${filename}`, {
        method: "PUT",
        body: JSON.stringify({
          message: `Factory EVOLVE: update ${plan.project_slug} ${filename}`,
          content: encodeBase64(evolved.content),
          sha: current.sha,
          branch
        })
      });
      updates.push({ path: `${prefix}/${filename}`, applied: evolved.applied });
    }

    if (!updates.length) return { error: "NO_APPLICABLE_CHANGES", plan, status: 422 };

    const pr = await github(env.GITHUB_TOKEN, `/repos/${owner}/${repo}/pulls`, {
      method: "POST",
      body: JSON.stringify({
        title: `EVOLVE: ${plan.project_slug}`,
        head: branch,
        base,
        draft: true,
        body: `Generated by Project Factory EVOLVE.\n\nProject: \`${prefix}/\`\nChanges: ${updates.map((u) => u.applied.join(", ")).filter(Boolean).join("; ")}\n\nProduction remains approval-gated.`
      })
    });

    return {
      ok: true,
      status: 201,
      repository,
      base_branch: base,
      branch,
      project_path: prefix,
      updates,
      pull_request: { number: pr?.number, url: pr?.html_url, draft: pr?.draft === true },
      production_deployed: false
    };
  } catch (error) {
    return { error: "EVOLVE_GITHUB_FAILED", message: clean(error?.message || "Unknown GitHub error", 300), github_status: error?.status || null, status: 502 };
  }
}
