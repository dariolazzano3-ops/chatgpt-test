/* JARVIS — Automatic Project Route V1.
   Pure/deterministic. It only selects among server-configured project targets.
   No repository path, bridge project, or other client-supplied routing input is
   ever accepted here. Ambiguity fails closed to the ordinary owner-chat lane. */

const clean = (value, max = 4000) => String(value ?? '').trim().slice(0, max);

function escapeRegExp(value) {
  return value.replace(/[.*+?^$()|[\]\\]/g, '\\$&');
}

function containsRouteToken(text, token) {
  const wanted = clean(token, 160);
  if (!wanted) return false;
  const escaped = escapeRegExp(wanted);
  return new RegExp('(^|[^a-z0-9])' + escaped + '([^a-z0-9]|$)', 'i').test(text);
}

export function resolveJarvisAutomaticProjectRouteV1(message = '', targets = {}) {
  const text = clean(message, 4000);
  if (!text) {
    return { matched: false, status: 'NO_MATCH', target_id: null, target: null, candidates: [] };
  }

  const rows = Object.values(targets && typeof targets === 'object' ? targets : {})
    .filter((target) => target && typeof target === 'object')
    .map((target) => {
      const targetId = clean(target.target_id, 80).toUpperCase();
      const label = clean(target.label, 160);
      const aliases = Array.isArray(target.route_aliases)
        ? target.route_aliases.map((value) => clean(value, 160)).filter(Boolean)
        : [];
      const tokens = [...new Set([targetId, label, ...aliases].filter(Boolean))];
      const matchedBy = tokens.find((token) => containsRouteToken(text, token)) || null;
      return { target, target_id: targetId, matched_by: matchedBy };
    })
    .filter((row) => row.target_id && row.matched_by);

  if (rows.length !== 1) {
    return {
      matched: false,
      status: rows.length > 1 ? 'AMBIGUOUS' : 'NO_MATCH',
      target_id: null,
      target: null,
      candidates: rows.map((row) => row.target_id).sort()
    };
  }

  return {
    matched: true,
    status: 'MATCHED',
    target_id: rows[0].target_id,
    target: rows[0].target,
    matched_by: rows[0].matched_by,
    candidates: [rows[0].target_id]
  };
}

export function jarvisAutomaticProjectRouteManifestV1() {
  return {
    schema: 'aurentara.jarvis.automatic-project-route.v1',
    deterministic: true,
    server_configured_targets_only: true,
    explicit_target_token_required: true,
    ambiguous_route_fails_closed: true,
    client_supplied_repo_paths_allowed: false,
    client_supplied_bridge_projects_allowed: false,
    production_deploy: false,
    hamyren_data_flow: false
  };
}
