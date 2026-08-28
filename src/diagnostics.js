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

function isAuthorized(request, env = {}) {
  if (!env.API_TOKEN) return false;
  const authorization = request.headers.get("authorization") || "";
  return authorization === `Bearer ${env.API_TOKEN}`;
}

const SENTRY_BASE_URLS = new Set([
  "https://de.sentry.io",
  "https://sentry.io"
]);

function githubHeaders(token) {
  return {
    authorization: `Bearer ${token}`,
    accept: "application/vnd.github+json",
    "x-github-api-version": "2022-11-28",
    "user-agent": "chatgpt-project-factory-diagnostics/1.3"
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

function normalizeSentryBaseUrl(value) {
  try {
    const candidate = new URL(clean(value || "https://de.sentry.io", 200));
    if (candidate.username || candidate.password || candidate.search || candidate.hash) return null;
    if (candidate.pathname !== "/" && candidate.pathname !== "") return null;
    return SENTRY_BASE_URLS.has(candidate.origin) ? candidate.origin : null;
  } catch {
    return null;
  }
}

function sentryHeaders(token) {
  return {
    authorization: `Bearer ${token}`,
    accept: "application/json",
    "user-agent": "riosystems-sentry-diagnostics/1.1"
  };
}

async function sentryProbe(baseUrl, token, path) {
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method: "GET",
      headers: sentryHeaders(token)
    });
    const text = await response.text();
    let body = null;
    try { body = text ? JSON.parse(text) : null; } catch {}
    return {
      ok: response.ok,
      status: response.status,
      message: response.ok ? null : clean(body?.detail || body?.message || `SENTRY_HTTP_${response.status}`),
      body
    };
  } catch (error) {
    return {
      ok: false,
      status: null,
      message: clean(error?.message || "SENTRY_NETWORK_ERROR"),
      body: null
    };
  }
}

function safeSentryProbe(probe) {
  return {
    ok: probe.ok,
    status: probe.status,
    message: probe.message
  };
}

function safeSentryIssue(issue) {
  return {
    id: clean(issue?.id, 80) || null,
    short_id: clean(issue?.shortId, 80) || null,
    title: clean(issue?.title, 240) || null,
    culprit: clean(issue?.culprit, 240) || null,
    level: clean(issue?.level, 40) || null,
    status: clean(issue?.status, 40) || null,
    count: clean(issue?.count, 40) || "0",
    user_count: Number.isFinite(Number(issue?.userCount)) ? Number(issue.userCount) : null,
    first_seen: clean(issue?.firstSeen, 80) || null,
    last_seen: clean(issue?.lastSeen, 80) || null,
    permalink: clean(issue?.permalink, 300) || null
  };
}

async function sentryDiagnostics(request, env = {}) {
  if (!isAuthorized(request, env)) {
    return json({ ok: false, error: "UNAUTHORIZED" }, 401);
  }

  const organization = clean(env.SENTRY_ORG || "riosystems", 120);
  const project = clean(env.SENTRY_PROJECT || "riosystems-core", 120);
  const baseUrl = normalizeSentryBaseUrl(env.SENTRY_BASE_URL);
  const tokenConfigured = Boolean(env.SENTRY_AUTH_TOKEN);

  const result = {
    ok: true,
    service: "riosystems-sentry-readonly-bridge",
    version: "1.1",
    timestamp: new Date().toISOString(),
    secrets: {
      api_token_configured: Boolean(env.API_TOKEN),
      sentry_auth_token_configured: tokenConfigured,
      secret_values_exposed: false
    },
    configuration: {
      organization,
      project,
      base_url_allowed: Boolean(baseUrl),
      read_only_expected: true,
      issue_window: "24h",
      issue_limit: 10
    },
    checks: {
      sentry_api_reachable: null,
      project_access: null,
      issue_access: null
    },
    issues: []
  };

  if (!baseUrl) {
    result.ok = false;
    result.error = "SENTRY_BASE_URL_NOT_ALLOWED";
    return json(result, 200);
  }

  if (!tokenConfigured) {
    result.ok = false;
    result.error = "SENTRY_AUTH_TOKEN_NOT_CONFIGURED";
    return json(result, 200);
  }

  const encodedOrg = encodeURIComponent(organization);
  const encodedProject = encodeURIComponent(project);
  const projectProbe = await sentryProbe(
    baseUrl,
    env.SENTRY_AUTH_TOKEN,
    `/api/0/projects/${encodedOrg}/${encodedProject}/`
  );

  result.checks.sentry_api_reachable = projectProbe.status !== null;
  result.checks.project_access = safeSentryProbe(projectProbe);

  if (!projectProbe.ok) {
    result.ok = false;
    result.error = "SENTRY_PROJECT_ACCESS_FAILED";
    return json(result, 200);
  }

  const issueQuery = new URLSearchParams({
    statsPeriod: "24h",
    query: "is:unresolved",
    sort: "freq",
    limit: "10"
  });
  const issueProbe = await sentryProbe(
    baseUrl,
    env.SENTRY_AUTH_TOKEN,
    `/api/0/projects/${encodedOrg}/${encodedProject}/issues/?${issueQuery.toString()}`
  );

  result.checks.issue_access = safeSentryProbe(issueProbe);
  if (!issueProbe.ok) {
    result.ok = false;
    result.error = "SENTRY_ISSUE_ACCESS_FAILED";
    return json(result, 200);
  }

  const issues = Array.isArray(issueProbe.body) ? issueProbe.body : [];
  result.issues = issues.slice(0, 10).map(safeSentryIssue);
  result.summary = issues.length
    ? `Sentry read access is healthy. ${result.issues.length} unresolved issue(s) returned.`
    : "Sentry read access is healthy. No unresolved issues were returned.";
  return json(result, 200);
}

export async function handleDiagnostics(request, env = {}) {
  const url = new URL(request.url);
  const supported = new Set([
    "/factory/diagnostics",
    "/factory/diagnostics/github",
    "/factory/diagnostics/sentry"
  ]);
  if (!supported.has(url.pathname)) return null;
  if (request.method !== "GET") return json({ ok: false, error: "METHOD_NOT_ALLOWED" }, 405);
  if (url.pathname === "/factory/diagnostics/sentry") return sentryDiagnostics(request, env);

  const repository = clean(env.GITHUB_REPOSITORY || "dariolazzano3-ops/chatgpt-test", 200);
  const repositoryValid = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository);
  const controlBranch = clean(env.FACTORY_CONTROL_BRANCH || "factory-control", 200);
  const controlBranchValid = /^(?!\/)(?!.*\.\.)(?!.*\/$)[A-Za-z0-9._/-]+$/.test(controlBranch);
  const [owner, repo] = repositoryValid ? repository.split("/") : [null, null];

  const result = {
    ok: true,
    service: "chatgpt-project-factory-diagnostics",
    version: "1.3",
    timestamp: new Date().toISOString(),
    secrets: {
      api_token_configured: Boolean(env.API_TOKEN),
      github_token_configured: Boolean(env.GITHUB_TOKEN),
      github_token_shape: env.GITHUB_TOKEN ? (String(env.GITHUB_TOKEN).startsWith("github_pat_") ? "fine_grained_pat" : "other") : null,
      sentry_auth_token_configured: Boolean(env.SENTRY_AUTH_TOKEN),
      secret_values_exposed: false
    },
    configuration: {
      repository,
      repository_valid: repositoryValid,
      base_branch: controlBranch,
      base_branch_valid: controlBranchValid,
      canonical_control_branch: controlBranch === "factory-control",
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

  if (!controlBranchValid) {
    result.ok = false;
    result.error = "INVALID_FACTORY_CONTROL_BRANCH";
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

  const branchProbe = await githubProbe(env.GITHUB_TOKEN, `/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(controlBranch)}`);
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
