const clean = (value, max = 500) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const norm = (value) => clean(value).toLowerCase().replace(/[^a-z0-9äöüß]+/g, ' ').trim();
const clone = (value) => structuredClone(value ?? null);

function aliases(project = {}) {
  const stop = new Set(['project','projekt','website','systems','system','company','customer','kunde','public','private','staging','production']);
  const raw = [project.scope_key, project.project_id, project.name, project.project_name, project.business_name, ...(Array.isArray(project.aliases) ? project.aliases : [])];
  const values = raw.map(norm).filter((v) => v && v.length >= 3);
  for (const value of [...values]) {
    for (const token of value.split(' ')) if (token.length >= 4 && !stop.has(token)) values.push(token);
  }
  return [...new Set(values)];
}

function explicitMatches(message, projects = []) {
  const text = norm(message);
  return projects.filter((project) => aliases(project).some((alias) => text.includes(alias)));
}

export function resolveOperatorAiProject(input = {}) {
  const projects = Array.isArray(input.projects) ? input.projects : [];
  const message = clean(input.message || input.raw_message, 6000);
  const explicitReference = clean(input.project_reference, 500);
  const matchText = explicitReference || message;
  const explicit = explicitMatches(matchText, projects);

  if (explicit.length > 1) {
    return { ok: false, status: 'AMBIGUOUS', error: 'OPERATOR_AI_PROJECT_AMBIGUOUS', candidates: explicit.map((p) => ({ scope_key: p.scope_key, name: p.name || p.project_name || p.project_id })), production_deploy: false };
  }
  if (explicit.length === 1) {
    return { ok: true, status: 'RESOLVED', source: 'EXPLICIT_OPERATOR_INPUT', project: clone(explicit[0]), scope_key: explicit[0].scope_key, production_deploy: false };
  }

  const selected = clean(input.selected_project_scope, 500);
  if (selected) {
    const project = projects.find((p) => p.scope_key === selected);
    if (project) return { ok: true, status: 'RESOLVED', source: 'DASHBOARD_SELECTED_PROJECT', project: clone(project), scope_key: selected, production_deploy: false };
  }

  const conversationScope = clean(input.conversation_project_scope, 500);
  if (conversationScope) {
    const project = projects.find((p) => p.scope_key === conversationScope);
    if (project) return { ok: true, status: 'RESOLVED', source: 'ACTIVE_CONVERSATION_CONTEXT', project: clone(project), scope_key: conversationScope, production_deploy: false };
  }

  if (projects.length === 1) return { ok: true, status: 'RESOLVED', source: 'UNIQUE_PROJECT_REGISTRY', project: clone(projects[0]), scope_key: projects[0].scope_key, production_deploy: false };
  return { ok: false, status: projects.length ? 'AMBIGUOUS' : 'UNKNOWN', error: projects.length ? 'OPERATOR_AI_PROJECT_REQUIRED' : 'OPERATOR_AI_PROJECT_REGISTRY_EMPTY', candidates: projects.slice(0, 10).map((p) => ({ scope_key: p.scope_key, name: p.name || p.project_name || p.project_id })), production_deploy: false };
}

export function operatorAiProjectResolutionManifest() {
  return { schema: 'aurentara.operator-ai.project-resolution.v1', priority: ['explicit_input','dashboard_selection','conversation_context','unique_registry'], cross_project_isolation: true, ambiguous_fails_closed: true, production_deploy: false };
}
