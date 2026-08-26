function json(value, status = 200) {
  return new Response(JSON.stringify(value, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=UTF-8",
      "cache-control": "no-store"
    }
  });
}

function clean(value, max = 240) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function githubHeaders(token) {
  return {
    authorization: `Bearer ${token}`,
    accept: "application/vnd.github+json",
    "x-github-api-version": "2022-11-28",
    "user-agent": "chatgpt-project-factory-diagnostics/1.2"
  };
}

async function githubProbe(token, path) {
  try {
    const response = await fetch(`https://api.github.com${path}`, {
      method: "GET",
      headers: githubHeaders(token)
    });
    const text = await response.text();
    let body = null;
    try { body = text ? JSON.parse(text) : null; } catch {}
    return {
      ok: response.ok,
      status: response.status,
      message: response.ok ? null : clean(body?.message || `GITHUB_HTTP_${response.status}`),
      documentation_url: response.ok ? null : clean(body?.documentation_url || "") || null,
      accepted_permissions: clean(response.headers.get("x-accepted-github-permissions") || "", 300) || null,
      oauth_scopes: clean(response.headers.get("x-oauth-scopes") || "", 300) || null,
      token_expiration: clean(response.headers.get("github-authentication-token-expiration") || "", 120) || null,
      body
    };
  } catch (error) {
    return {
      ok: false,
      status: null,
      message: clean(error?.message || "GITHUB_NETWORK_ERROR"),
      documentation_url: null,
      accepted_permissions: null,
      oauth_scopes: null,
      token_expiration: null,
      body: null
    };
  }
}

function safeProbe(probe) {
  return {
    ok: probe.ok,
    status: probe.status,
    message: probe.message,
    documentation_url: probe.documentation_url,
    accepted_permissions: probe.accepted_permissions,
    oauth_scopes: probe.oauth_scopes,
    token_expiration: probe.token_expiration
  };
}

export async function handleDiagnostics(request, env = {}) {
  const url = new URL(request.url);
  if (request.method !== "GET") return null;
  if (url.pathname !== "/factory/diagnostics" && url.pathname !== "/factory/diagnostics/github") return null;

  const repository = clean(env.GITHUB_REPOSITORY || "dariolazzano3-ops/chatgpt-test", 200);
  const repositoryValid = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository);
  const [owner, repo] = repositoryValid ? repository.split("/") : [null, null];

  const result = {
    ok: true,
    service: "chatgpt-project-factory-diagnostics",
    version: "1.2",
    timestamp: new Date().toISOString(),
    secrets: {
      api_token_configured: Boolean(env.API_TOKEN),
      github_token_configured: Boolean(env.GITHUB_TOKEN),
      github_token_shape: env.GITHUB_TOKEN ? (String(env.GITHUB_TOKEN).startsWith("github_pat_") ? "fine_grained_pat" : "other") : null,
      secret_values_exposed: false
    },
    configuration: {
      repository,
      repository_valid: repositoryValid,
      base_branch: "main",
      github_user_agent_configured: true
    },
    checks: {
      github_api_reachable: null,
      repository_access: null,
      base_branch_readable: null
    }
  };

  if (!repositoryValid) {
    result.ok = false;
    result.error = "INVALID_GITHUB_REPOSITORY";
    return json(result, 200);
  }

  if (!env.GITHUB_TOKEN) {
    result.ok = false;
    result.error = "GITHUB_TOKEN_NOT_CONFIGURED";
    return json(result, 200);
  }

  const repoProbe = await githubProbe(env.GITHUB_TOKEN, `/repos/${owner}/${repo}`);
  result.checks.github_api_reachable = repoProbe.status !== null;
  result.checks.repository_access = safeProbe(repoProbe);

  if (!repoProbe.ok) {
    result.ok = false;
    result.error = "GITHUB_REPOSITORY_ACCESS_FAILED";
    return json(result, 200);
  }

  const branchProbe = await githubProbe(env.GITHUB_TOKEN, `/repos/${owner}/${repo}/git/ref/heads/main`);
  result.checks.base_branch_readable = {
    ...safeProbe(branchProbe),
    sha_present: Boolean(branchProbe.body?.object?.sha)
  };

  if (!branchProbe.ok) {
    result.ok = false;
    result.error = "GITHUB_BASE_BRANCH_READ_FAILED";
    return json(result, 200);
  }

  result.summary = "Worker configuration and GitHub read access are healthy.";
  return json(result, 200);
}
