/* JARVIS Universal Project Adapter V1: trusted catalog, deterministic routing.
 * Pure module. NEVER load a project catalog from a chat message or an
 * unverified branch. The caller must verify its immutable Git commit first.
 * This module does not provision workspaces or grant execution permissions.
 */
import { resolveJarvisAutomaticProjectRouteV1 } from './project-route-v1.js';

const ID = /^[A-Z][A-Z0-9_]{2,63}$/;
const SHA = /^[a-f0-9]{40}$/;
const OWNER_REPO = /^dariolazzano3-ops\/[A-Za-z0-9._-]{1,80}$/;
const SLUG = /^[a-z0-9][a-z0-9._-]{0,90}$/;
const ROUTE_NAME = /^[\p{L}\p{N} _.-]{3,80}$/u;
const BLOCKED = /(?:\.\.|\/\/|\\|\/$)/;
const clean = value => String(value ?? '').trim();
const fail = reason => { throw new Error('CATALOG_' + reason); };

function routeTokens(project) {
  return [...new Set([project.target_id, project.label, ...project.route_aliases]
    .map(x => clean(x).toLocaleLowerCase('en-US')))];
}

/** Caller proves source trust outside this module, e.g. immutable Git commit. */
export function validateTrustedProjectCatalogV1(input, trust = {}) {
  if (trust.approved_source !== true || !SHA.test(trust.verified_source_commit || ''))
    fail('VERIFIED_GIT_SOURCE_REQUIRED');
  if (!input || Array.isArray(input) || input.schema !== 'jarvis.universal-project-catalog.v1' ||
      !Array.isArray(input.projects) || input.projects.length > 100) fail('INVALID_FORMAT');
  if (input.projects.length < 1) fail('EMPTY');
  const seenIds = new Set(), seenTokens = new Set(), projects = [];
  for (const raw of input.projects) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail('INVALID_ENTRY');
    if (Object.keys(raw).some(k => ![
      'target_id', 'label', 'route_aliases', 'repository', 'branch',
      'subdirectory', 'expected_head', 'approved'
    ].includes(k))) fail('UNKNOWN_FIELD');
    if (!ID.test(raw.target_id || '') || seenIds.has(raw.target_id)) fail('DUPLICATE_OR_INVALID_ID');
    if (raw.approved !== true) continue;
    if (typeof raw.label !== 'string' || !ROUTE_NAME.test(raw.label)) fail('INVALID_LABEL');
    if (!Array.isArray(raw.route_aliases) || raw.route_aliases.length > 6 ||
        raw.route_aliases.some(a => typeof a !== 'string' || !ROUTE_NAME.test(a)))
      fail('INVALID_ALIASES');
    if (!OWNER_REPO.test(raw.repository || '')) fail('REPOSITORY_NOT_ALLOWED');
    if ((raw.branch !== 'main' && !/^factory\/[a-zA-Z0-9][a-zA-Z0-9._/-]{2,100}$/.test(raw.branch || '')) ||
        BLOCKED.test(raw.branch)) fail('UNSAFE_BRANCH');
    const parts = typeof raw.subdirectory === 'string' ? raw.subdirectory.split('/') : [];
    if (parts.length !== 2 || parts[0] !== 'projects' || !SLUG.test(parts[1]) ||
        BLOCKED.test(raw.subdirectory)) fail('UNSAFE_SUBDIRECTORY');
    if (!SHA.test(raw.expected_head || '')) fail('EXPECTED_HEAD_REQUIRED');
    for (const token of routeTokens(raw)) {
      if (seenTokens.has(token)) fail('DUPLICATE_ROUTE_ALIAS');
      seenTokens.add(token);
    }
    seenIds.add(raw.target_id);
    projects.push(Object.freeze({
      target_id: raw.target_id,
      label: raw.label,
      route_aliases: [...raw.route_aliases],
      repository: raw.repository,
      branch: raw.branch,
      subdirectory: raw.subdirectory,
      expected_head: raw.expected_head
    }));
  }
  return Object.freeze({
    schema: input.schema, source_commit: trust.verified_source_commit,
    projects: Object.freeze(projects)
  });
}

/** Read-only discovery. A route match is NOT permission to run Claude. */
export function resolveCatalogProjectV1(message, verifiedCatalog) {
  const projects = verifiedCatalog?.projects || [];
  const targets = Object.fromEntries(projects.map(p => [p.target_id, p]));
  return resolveJarvisAutomaticProjectRouteV1(message, targets);
}

export function listAuthorizedProjectsV1(verifiedCatalog) {
  return (verifiedCatalog?.projects || []).map(p => ({
    target_id: p.target_id, name: p.label, repository: p.repository,
    branch: p.branch, subdirectory: p.subdirectory,
    approved_commit: p.expected_head, execution_ready: false,
    status: 'APPROVED_CATALOG_ONLY'
  }));
}

/** Merge ONLY independently worker-attested bindings supplied by the server,
 * never objects from a chat request. Missing/mismatched receipts stay unbound.
 * Real OS sandbox and Git checks are separate, mandatory runtime gates.
 */
export function buildExecutableTargetsV1(verifiedCatalog, bindings = {}, existing = {}, options = {}) {
  // Immutable, server-configured sandbox location. NEVER accept this from chat.
  const root = options.approved_workspace_root;
  if (typeof root !== 'string' || !/^\/[A-Za-z0-9/_-]+$/.test(root) ||
      root.includes('..') || root.endsWith('/'))
    return { ...existing };
  const result = { ...existing };
  const taken = new Set(Object.values(existing).flatMap(t => [
    t.target_id, t.label, ...(t.route_aliases || [])
  ].filter(Boolean).map(t => clean(t).toLowerCase())));
  for (const project of verifiedCatalog?.projects || []) {
    if (project.target_id in result ||
        routeTokens(project).some(t => taken.has(t))) fail('EXISTING_TARGET_COLLISION');
    const proof = bindings[project.target_id];
    if (!proof || proof.server_attested !== true ||
        proof.repository !== project.repository ||
        proof.branch !== project.branch ||
        proof.commit !== project.expected_head ||
        proof.subdirectory !== project.subdirectory ||
        proof.isolation_verified !== true ||
        proof.bridge_verified !== true ||
        proof.repo_dir !== root + '/' + project.target_id ||
        proof.bridge_project !== project.subdirectory.split('/')[1] ||
        proof.bridge?.schema !== 'aurentara.jarvis.claude-code-bridge.v1' ||
        proof.bridge?.bound !== true || typeof proof.bridge?.submit !== 'function' ||
        typeof proof.workspace_preflight !== 'function') continue;
    result[project.target_id] = {
      ...project, enabled: true, program: 'PROJECT_MISSION_V1',
      target_branch: project.branch,
      repo_dir: proof.repo_dir, bridge_project: proof.bridge_project,
      bridge: proof.bridge, workspace_preflight: proof.workspace_preflight,
      execution_guidance: 'Modify only ' + project.subdirectory +
        ' in the verified isolated workspace. No secrets, shell, .git, ' +
        'pushes, production deployments, billing, or other projects.'
    };
  }
  return result;
}
