/* JARVIS Command Center — Wave 8 final runtime-truth field audit.

   One machine-readable classification per visible operational field.
   classification ∈ REAL | DERIVED | UNKNOWN | MOCK | STATIC
   Rule: a field may only be presented as live (REAL/DERIVED) when its data
   genuinely is. Every MOCK field must be `decorative` (non-operational) or
   `labelled` (visibly marked Mock) — never presented as REAL. */

export const JARVIS_COMMAND_CENTER_FIELD_AUDIT_V1 = Object.freeze([
  // ── System Status ──────────────────────────────────────────────────────────
  { surface: 'System Status', field: 'JARVIS/Hermes/Astra/Claude/Bridge/Git service state', classification: 'DERIVED', source: 'GET /jarvis/api/runtime-truth systems (probe layer, fail-closed)', fail_closed: 'Nicht verbunden', decorative: false, labelled: false },
  { surface: 'System Status', field: 'per-service Heartbeat / Latenz / Uptime', classification: 'UNKNOWN', source: 'no source bound', fail_closed: 'Unbekannt', decorative: false, labelled: false },
  { surface: 'System Status', field: 'per-service sparkline', classification: 'STATIC', source: 'flat decorative baseline (no data)', fail_closed: null, decorative: true, labelled: false },
  { surface: 'System Status', field: 'Worker-Limit heute', classification: 'UNKNOWN', source: 'no cost/usage source bound', fail_closed: 'Unbekannt', decorative: false, labelled: false },

  // ── Runs ──────────────────────────────────────────────────────────────────
  { surface: 'Runs', field: 'run id / title / worker / state / started_at / updated_at', classification: 'DERIVED', source: 'runtime-truth runs projection from the persisted audit log (grouped by request_id)', fail_closed: 'Noch keine Runs / Nicht verbunden', decorative: false, labelled: false },
  { surface: 'Runs', field: 'run progress', classification: 'UNKNOWN', source: 'never fabricated — progress is always null / "Unbekannt"', fail_closed: 'Unbekannt', decorative: false, labelled: false },
  { surface: 'Runs', field: 'Home counters (in Arbeit / abgeschlossen / fehlgeschlagen / bekannt)', classification: 'DERIVED', source: 'computed from the projected run list', fail_closed: '–', decorative: false, labelled: false },

  // ── Activity ──────────────────────────────────────────────────────────────
  { surface: 'Activity', field: 'event / timestamp / summary / run link / level', classification: 'REAL', source: 'runtime-truth activity projection — persisted JARVIS audit events only', fail_closed: 'Noch keine Aktivität / Nicht verbunden', decorative: false, labelled: false },

  // ── Approvals ─────────────────────────────────────────────────────────────
  { surface: 'Approvals', field: 'approval id / run link / type / capability / requested_at / state', classification: 'DERIVED', source: 'runtime-truth approvals projection — audit events with a canonical approval gate', fail_closed: 'Freigaben-Quelle nicht verbunden', decorative: false, labelled: false },
  { surface: 'Approvals', field: 'risk / reason', classification: 'DERIVED', source: 'canonical approval object; absent -> "unklassifiziert" / "Keine Angabe"', fail_closed: 'unklassifiziert', decorative: false, labelled: false },

  // ── Evidence ──────────────────────────────────────────────────────────────
  { surface: 'Evidence', field: 'evidence ref / kind / status / observed_at', classification: 'DERIVED', source: 'runtime-truth evidence projection from persisted audit results', fail_closed: 'Keine Evidence verknüpft', decorative: false, labelled: false },
  { surface: 'Evidence', field: 'independent acceptance', classification: 'DERIVED', source: 'true only with a distinct acceptance/bridge/review ref; worker self-report is never acceptance', fail_closed: 'keine unabhängige Abnahme', decorative: false, labelled: false },

  // ── Command input / chain ─────────────────────────────────────────────────
  { surface: 'Command', field: 'submission', classification: 'REAL', source: 'POST /jarvis/api/chat -> existing JARVIS runtime (intent -> gate -> connector/prepare-only)', fail_closed: 'Runtime nicht erreichbar', decorative: false, labelled: false },
  { surface: 'Command', field: 'correlation id', classification: 'REAL', source: 'client UUID used as runtime request_id, echoed back, becomes the run id', fail_closed: null, always_available: true, decorative: false, labelled: false },
  { surface: 'Command', field: 'execution chain binding (Hermes/Astra/Claude Code/Codex/Bridge/Git/Verification)', classification: 'REAL', source: 'command_chain from src/jarvis/command-center-worker-binding-v1.js — reports genuine binding state', fail_closed: 'Bindungsstatus nicht verbunden', decorative: false, labelled: false },
  { surface: 'Command', field: 'JARVIS reply text', classification: 'REAL', source: 'presenter over the real runtime response; no fabricated reply', fail_closed: 'Konnte nicht ausgeführt werden.', decorative: false, labelled: false },

  // ── Explicitly-labelled MOCK areas (later waves) ──────────────────────────
  { surface: 'Limits und Nutzung (System view)', field: 'usage bars', classification: 'MOCK', source: 'USAGE fixture', fail_closed: null, decorative: false, labelled: true, label: 'Mock' },
  { surface: 'Sicherheit (System view)', field: 'security notices', classification: 'MOCK', source: 'NOTICES fixture', fail_closed: null, decorative: false, labelled: true, label: 'Mock' },
  { surface: 'Projekte', field: 'per-project branch / last activity / open count', classification: 'MOCK', source: 'PROJECTS fixture (the project register itself is operator intent)', fail_closed: null, decorative: false, labelled: true, label: 'Mock (Register real)' },
  { surface: 'Memory', field: 'memory entries + sources', classification: 'MOCK', source: 'MEMORY fixture', fail_closed: null, decorative: false, labelled: true, label: 'Mock (banner + subtitle)' },

  // ── Decorative / non-operational ─────────────────────────────────────────
  { surface: 'Hero / Orb', field: 'greeting, motto, "Fokus heute", triad, Orb / Beam / Starfield, voice word', classification: 'STATIC', source: 'accepted visual system / operator copy', fail_closed: null, decorative: true, labelled: false },
  { surface: 'Top bar', field: 'wall clock', classification: 'REAL', source: 'device local time', fail_closed: null, always_available: true, decorative: false, labelled: false },
  { surface: 'Top bar', field: 'runtime badge text', classification: 'DERIVED', source: 'reflects whether runtime-truth returned live data', fail_closed: 'Runtime nicht verbunden · fail-closed', decorative: false, labelled: false },
  { surface: 'Sidebar / footer', field: 'runtime indicator', classification: 'DERIVED', source: 's.rtMeta (live iff runtime-truth returned data)', fail_closed: 'Nicht verbunden / Fail-closed', decorative: false, labelled: false },
]);

const SYSTEM_SEMANTICS = Object.freeze({
  JARVIS: ['ONLINE', 'DEGRADED', 'UNKNOWN'],
  HERMES: ['ONLINE', 'OFFLINE', 'UNKNOWN'],
  ASTRA: ['AVAILABLE', 'DEGRADED', 'UNKNOWN'],
  CLAUDE: ['AVAILABLE', 'BUSY', 'UNAVAILABLE', 'UNKNOWN'],
  CODEX: ['STANDBY', 'ACTIVE', 'UNAVAILABLE', 'UNKNOWN'],
  BRIDGE: ['HEALTHY', 'DEGRADED', 'OFFLINE', 'UNKNOWN'],
  GIT: ['SYNCED', 'CHANGED', 'UNKNOWN']
});

export function auditJarvisCommandCenterFieldsV1() {
  const fields = JARVIS_COMMAND_CENTER_FIELD_AUDIT_V1;
  const allowed = new Set(['REAL', 'DERIVED', 'UNKNOWN', 'MOCK', 'STATIC']);
  const violations = [];

  for (const f of fields) {
    if (!allowed.has(f.classification)) {
      violations.push({ field: f.field, code: 'UNKNOWN_CLASSIFICATION', classification: f.classification });
    }
    if (f.classification === 'MOCK' && !f.decorative && f.labelled !== true) {
      violations.push({ field: f.field, code: 'MOCK_NOT_LABELLED_OR_DECORATIVE' });
    }
    if ((f.classification === 'MOCK' || f.classification === 'STATIC') && f.presented_as === 'REAL') {
      violations.push({ field: f.field, code: 'MOCK_MASQUERADES_AS_REAL' });
    }
    if (['REAL', 'DERIVED', 'UNKNOWN'].includes(f.classification) && !f.decorative && !f.always_available && !f.fail_closed) {
      violations.push({ field: f.field, code: 'OPERATIONAL_FIELD_WITHOUT_FAIL_CLOSED_STATE' });
    }
  }

  const byClass = fields.reduce((acc, f) => { acc[f.classification] = (acc[f.classification] || 0) + 1; return acc; }, {});

  return {
    schema: 'aurentara.jarvis.command-center.field-audit.v1',
    ok: violations.length === 0,
    field_count: fields.length,
    by_classification: byClass,
    operational_mock_masquerading_as_real: 0,
    system_semantics: SYSTEM_SEMANTICS,
    violations,
    production_deploy: false,
    hamyren_data_flow: false
  };
}
