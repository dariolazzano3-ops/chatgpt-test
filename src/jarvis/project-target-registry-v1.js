import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export const JARVIS_PROJECT_TARGET_REGISTRY_SCHEMA = 'aurentara.jarvis.project-target-registry.v1';
export const JARVIS_PROJECT_TARGET_REGISTRY_DEFAULT_PATH = '/opt/jarvis/owner-deploy-queue/project-targets.v1.json';
export const JARVIS_CONTROL_PLANE_RESTART_DEFAULT_PATH = '/opt/jarvis/owner-deploy-queue/restart-request.v1.json';

const ID_RE = /^[A-Z][A-Z0-9_-]{1,63}$/;
const PROGRAM_RE = /^[A-Z][A-Z0-9_:-]{2,79}$/;
const BRIDGE_PROJECT_RE = /^[a-zA-Z0-9][a-zA-Z0-9._-]{1,159}$/;
const FORBIDDEN_BRANCHES = new Set(['main','master','factory-control']);
const ALLOWED_KEYS = new Set([
  'target_id','label','route_aliases','program','repo_dir','bridge_project',
  'target_branch','enabled','execution_guidance'
]);

const clean = (value, max = 4000) => String(value ?? '').trim().slice(0, max);

function atomicWriteJson(filePath, value) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true, mode: 0o2770 });
  const tmp = path.join(dir, '.' + path.basename(filePath) + '.' + process.pid + '.' + randomUUID() + '.tmp');
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2) + '\n', { mode: 0o660 });
  fs.renameSync(tmp, filePath);
}

function validateRepoDir(value) {
  const raw = clean(value, 400);
  if (!raw || !path.isAbsolute(raw)) return null;
  const resolved = path.resolve(raw);
  if (!resolved.startsWith('/opt/jarvis/')) return null;
  if (resolved.includes('/../') || resolved === '/opt/jarvis') return null;
  return resolved;
}

export function validateJarvisProjectTargetV1(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok:false, error:'PROJECT_TARGET_OBJECT_REQUIRED' };
  }
  const extra = Object.keys(input).filter((key) => !ALLOWED_KEYS.has(key));
  if (extra.length) return { ok:false, error:'PROJECT_TARGET_UNKNOWN_FIELDS', fields:extra.sort() };

  const targetId = clean(input.target_id, 80).toUpperCase();
  const label = clean(input.label, 120);
  const program = clean(input.program, 80).toUpperCase();
  const repoDir = validateRepoDir(input.repo_dir);
  const bridgeProject = clean(input.bridge_project, 160);
  const targetBranch = clean(input.target_branch, 200);
  const aliases = Array.isArray(input.route_aliases)
    ? [...new Set(input.route_aliases.map((x)=>clean(x,120)).filter(Boolean))].slice(0,12)
    : [];
  const guidance = clean(input.execution_guidance, 2500);

  if (!ID_RE.test(targetId)) return { ok:false, error:'PROJECT_TARGET_ID_INVALID' };
  if (!label) return { ok:false, error:'PROJECT_TARGET_LABEL_REQUIRED' };
  if (!PROGRAM_RE.test(program)) return { ok:false, error:'PROJECT_TARGET_PROGRAM_INVALID' };
  if (!repoDir) return { ok:false, error:'PROJECT_TARGET_REPO_DIR_INVALID' };
  if (!BRIDGE_PROJECT_RE.test(bridgeProject)) return { ok:false, error:'PROJECT_TARGET_BRIDGE_PROJECT_INVALID' };
  if (targetBranch && FORBIDDEN_BRANCHES.has(targetBranch)) return { ok:false, error:'PROJECT_TARGET_BRANCH_FORBIDDEN' };

  return {
    ok:true,
    target:{
      target_id:targetId,
      label,
      route_aliases:aliases,
      program,
      repo_dir:repoDir,
      bridge_project:bridgeProject,
      target_branch:targetBranch || null,
      enabled:input.enabled !== false,
      execution_guidance:guidance || null
    }
  };
}

export function loadJarvisProjectTargetRegistryV1(filePath = JARVIS_PROJECT_TARGET_REGISTRY_DEFAULT_PATH) {
  let raw;
  try { raw = fs.readFileSync(filePath, 'utf8'); }
  catch (error) {
    if (error?.code === 'ENOENT') {
      return { ok:true, schema:JARVIS_PROJECT_TARGET_REGISTRY_SCHEMA, revision:0, targets:{} };
    }
    return { ok:false, error:'PROJECT_TARGET_REGISTRY_READ_FAILED' };
  }
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch { return { ok:false, error:'PROJECT_TARGET_REGISTRY_JSON_INVALID' }; }
  if (parsed?.schema !== JARVIS_PROJECT_TARGET_REGISTRY_SCHEMA || typeof parsed?.targets !== 'object' || Array.isArray(parsed.targets)) {
    return { ok:false, error:'PROJECT_TARGET_REGISTRY_SCHEMA_INVALID' };
  }
  const targets = {};
  for (const [key,value] of Object.entries(parsed.targets)) {
    const checked = validateJarvisProjectTargetV1(value);
    if (!checked.ok || checked.target.target_id !== key) {
      return { ok:false, error:'PROJECT_TARGET_REGISTRY_TARGET_INVALID', target_id:key, reason:checked.error || 'ID_KEY_MISMATCH' };
    }
    targets[key] = checked.target;
  }
  return {
    ok:true,
    schema:JARVIS_PROJECT_TARGET_REGISTRY_SCHEMA,
    revision:Number.isInteger(parsed.revision) && parsed.revision >= 0 ? parsed.revision : 0,
    updated_at:clean(parsed.updated_at,80) || null,
    targets
  };
}

export function applyJarvisProjectTargetRegistryV1(request = {}, options = {}) {
  const filePath = clean(options.file_path, 500) || JARVIS_PROJECT_TARGET_REGISTRY_DEFAULT_PATH;
  const current = loadJarvisProjectTargetRegistryV1(filePath);
  if (!current.ok) return current;
  const operation = clean(request.operation, 40).toLowerCase();
  const targetId = clean(request.target_id || request.target?.target_id, 80).toUpperCase();
  const targets = { ...current.targets };

  if (operation === 'upsert') {
    const checked = validateJarvisProjectTargetV1(request.target);
    if (!checked.ok) return checked;
    targets[checked.target.target_id] = checked.target;
  } else if (operation === 'set_enabled') {
    if (!ID_RE.test(targetId) || !targets[targetId]) return { ok:false, error:'PROJECT_TARGET_NOT_FOUND' };
    targets[targetId] = { ...targets[targetId], enabled:request.enabled === true };
  } else {
    return { ok:false, error:'PROJECT_TARGET_OPERATION_INVALID' };
  }

  const next = {
    schema:JARVIS_PROJECT_TARGET_REGISTRY_SCHEMA,
    revision:current.revision + 1,
    updated_at:new Date().toISOString(),
    targets
  };
  try { atomicWriteJson(filePath, next); }
  catch { return { ok:false, error:'PROJECT_TARGET_REGISTRY_WRITE_FAILED' }; }
  return { ok:true, ...next };
}

export function writeJarvisControlPlaneRestartRequestV1(reason, options = {}) {
  const filePath = clean(options.file_path, 500) || JARVIS_CONTROL_PLANE_RESTART_DEFAULT_PATH;
  const payload = {
    schema:'aurentara.jarvis.control-plane-restart-request.v1',
    request_id:randomUUID(),
    reason:clean(reason,200) || 'PROJECT_TARGET_REGISTRY_CHANGED',
    created_at:new Date().toISOString()
  };
  try { atomicWriteJson(filePath, payload); }
  catch { return { ok:false, error:'CONTROL_PLANE_RESTART_REQUEST_WRITE_FAILED' }; }
  return { ok:true, ...payload };
}

export function jarvisProjectTargetRegistryManifestV1() {
  return {
    schema:'aurentara.jarvis.project-target-registry-manifest.v1',
    registry_path:JARVIS_PROJECT_TARGET_REGISTRY_DEFAULT_PATH,
    restart_request_path:JARVIS_CONTROL_PLANE_RESTART_DEFAULT_PATH,
    unix_socket_control_only:true,
    secrets_allowed:false,
    arbitrary_shell_allowed:false,
    repo_root:'/opt/jarvis/',
    canonical_branches_forbidden:[...FORBIDDEN_BRANCHES],
    restart_via_existing_maintenance_gate:true,
    production_deploy:false,
    dns_actions:false,
    billing_actions:false
  };
}
