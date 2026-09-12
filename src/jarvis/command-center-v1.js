/* Server shell for the accepted JARVIS Command Center (orange/amber).

   The visual design lives in src/jarvis/command-center-ui/jarvis-command-center.jsx
   (VISUAL_BASELINE=ACCEPTED) and is delivered as a single inline bundle built by
   scripts/jarvis-command-center-ui-build-v1.mjs. This module only wraps that
   bundle in an HTML document and hands the client the API base so the
   System Status section can read GET <apiBase>/runtime-truth.

   No redesign happens here. The legacy blue surface (src/jarvis/ui-v1.js) is
   NOT used for this route. */
import {
  JARVIS_COMMAND_CENTER_BUNDLE_V1,
  JARVIS_COMMAND_CENTER_BUNDLE_SHA256_V1,
  JARVIS_COMMAND_CENTER_BUNDLE_BYTES_V1
} from './command-center-ui/bundle.built.js';
import { JARVIS_V2_PROGRAM_ID } from './v2-progress-v1.js';

export function renderJarvisCommandCenterV1(options = {}) {
  const basePath = options.base_path === '' ? '' : '/jarvis';
  const apiBase = basePath + '/api';
  // Wave 2: lets the Command Center call /api/program/state + /api/program/
  // tick itself instead of an operator typing repo_dir/target_branch into a
  // curl command. Both are injected DI-style from the Node-only local
  // operator launcher (see local-operator-server-v1.js) — this module stays
  // Cloudflare-Worker-safe and never derives them itself. Absent ->
  // null -> the client is required to render "nicht konfiguriert", never a
  // guess.
  const boot = JSON.stringify({
    apiBase,
    runtime_truth_path: apiBase + '/runtime-truth',
    programName: JARVIS_V2_PROGRAM_ID,
    programRepoDir: options.program_repo_dir || null,
    programTargetBranch: options.program_target_branch || null
  });

  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="application-name" content="JARVIS Command Center">
<meta name="jarvis-visual-baseline" content="ACCEPTED">
<title>JARVIS · Command Center</title>
<!-- VISUAL_BASELINE=ACCEPTED · source: src/jarvis/command-center-ui/jarvis-command-center.jsx · amber design system --amber:#ffab40 -->
<style>
html,body{margin:0;background:#040405;color:#f3e9db}
#jarvis-command-center-root{min-height:100vh}
.jcc-fallback{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;padding:2rem;
  font-family:'IBM Plex Mono',ui-monospace,SFMono-Regular,Menlo,monospace;color:#ffab40;text-align:center;letter-spacing:.12em}
</style>
</head>
<body>
<div id="jarvis-command-center-root">
  <div class="jcc-fallback">JARVIS Command Center benötigt JavaScript.</div>
</div>
<script>window.__JARVIS_CC__=${boot};</script>
<script>${JARVIS_COMMAND_CENTER_BUNDLE_V1}</script>
</body>
</html>`;
}

export function jarvisCommandCenterManifestV1() {
  return {
    schema: 'aurentara.jarvis.command-center-frontend.v1',
    visual_baseline: 'ACCEPTED',
    source: 'src/jarvis/command-center-ui/jarvis-command-center.jsx',
    delivery: 'inline_bundle',
    bundle_bytes: JARVIS_COMMAND_CENTER_BUNDLE_BYTES_V1,
    bundle_sha256: JARVIS_COMMAND_CENTER_BUNDLE_SHA256_V1,
    system_status_source: '/jarvis/api/runtime-truth',
    system_status_canonical_only: true,
    system_status_fail_closed: 'Nicht verbunden',
    program_controller_source: '/jarvis/api/program/state',
    program_controller_action_source: '/jarvis/api/program/tick',
    program_controller_fail_closed: 'Nicht konfiguriert',
    program_controller_auto_advances_further_waves: false,
    mock_areas: ['runs', 'activity', 'approvals', 'limits', 'notices', 'pipeline'],
    legacy_blue_ui_used: false,
    production_deploy: false,
    hamyren_data_flow: false
  };
}
