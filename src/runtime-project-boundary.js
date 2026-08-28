const clean = (value, max = 240) => String(value || '').trim().slice(0, max);

function normalizePath(value) {
  const path = clean(value, 500).replaceAll('\\', '/').replace(/^\/+/, '');
  if (!path || path.includes('../') || path === '..') return null;
  return path;
}

export function createProjectBoundary(input = {}) {
  const customerId = clean(input.customer_id, 120);
  const projectId = clean(input.project_id, 120);
  const root = normalizePath(input.project_root || `projects/${projectId}`);
  if (!customerId || !projectId || !root) return { ok: false, error: 'PROJECT_BOUNDARY_INVALID' };
  const allowed = Array.isArray(input.allowed_paths) && input.allowed_paths.length
    ? input.allowed_paths.map(normalizePath).filter(Boolean)
    : [root];
  return {
    ok: true,
    boundary: {
      boundary_version: 'riosystems.project-boundary.v1',
      customer_id: customerId,
      project_id: projectId,
      scope_key: `${customerId}:${projectId}`,
      project_root: root,
      allowed_paths: [...new Set(allowed)],
      deny_shared_core_by_default: input.deny_shared_core_by_default !== false,
      owner: clean(input.owner, 160) || null,
      production_deploy: false
    }
  };
}

export function authorizeProjectWrite(boundary = {}, request = {}) {
  const path = normalizePath(request.path);
  if (!path) return { ok: false, authorized: false, code: 'PROJECT_WRITE_PATH_INVALID' };
  if (request.customer_id && request.customer_id !== boundary.customer_id) return { ok: true, authorized: false, code: 'CUSTOMER_SCOPE_MISMATCH', path };
  if (request.project_id && request.project_id !== boundary.project_id) return { ok: true, authorized: false, code: 'PROJECT_SCOPE_MISMATCH', path };
  const actorId = clean(request.actor_id, 160);
  if (boundary.owner && actorId !== boundary.owner && request.owner_override_approved !== true) {
    return { ok: true, authorized: false, code: 'CODE_OWNER_APPROVAL_REQUIRED', path, required_owner: boundary.owner };
  }
  const sharedCore = /^(src|scripts|config|\.github)\//.test(path);
  if (sharedCore && boundary.deny_shared_core_by_default === true && request.shared_core_approved !== true) {
    return { ok: true, authorized: false, code: 'SHARED_CORE_WRITE_APPROVAL_REQUIRED', path };
  }
  const allowed = (boundary.allowed_paths || []).some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
  if (!allowed) return { ok: true, authorized: false, code: 'PROJECT_WRITE_OUTSIDE_BOUNDARY', path };
  return { ok: true, authorized: true, path, scope_key: boundary.scope_key, owner: boundary.owner || null, production_deploy: false };
}

export function runtimeProjectBoundaryManifest() {
  return { version: 'riosystems.project-boundary.v1', customer_project_isolation: true, code_owner_enforcement: true, shared_core_write_requires_approval: true, production_deploy: false };
}
