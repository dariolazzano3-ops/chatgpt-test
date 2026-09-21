/* JARVIS — deterministic owner-chat work router V1.

   Closes a real gap: POST /jarvis/api/chat (http-v1.js) is conversation-first
   and never emits IMPLEMENTATION_MISSION (see engineering-mission-v1.js's own
   header comment) — a genuine engineering imperative typed into ordinary chat
   ("implementiere X", "fix the bug in Y") falls through intent-v1.js's
   keyword table onto READ_PERSONAL_CONTEXT, a read-only no-op. This module is
   the deterministic, regex-based (never LLM-based) classifier that decides,
   BEFORE anything else runs, which of three lanes an owner chat message
   belongs to:

     CONVERSATION           — everything else. The default. Never creates a
                               job, never touches the Claude Code bridge.
     ACTIONABLE_WORK         — an explicit, bounded, internal engineering
                               imperative (a verb + an engineering-shaped
                               noun) with NO risk signal present. The
                               authenticated owner's own imperative is what
                               authorizes dispatch for this lane — see
                               owner-chat-job-v1.js.
     APPROVAL_REQUIRED_ACTION — anything that reads as external, production,
                               destructive, secret-sensitive, financial, DNS,
                               public-access, or deployment-related. Checked
                               FIRST and wins over an actionable-work match,
                               so an ambiguous message fails closed toward
                               requiring explicit operator approval rather
                               than toward auto-dispatch.

   Deliberately conservative on the ACTIONABLE_WORK side: the engineering-noun
   list excludes bare "file"/"datei" (the existing FILES domain in
   intent-v1.js already owns generic personal file writes via its own
   approval-gated FILE_WRITE path — this module must never re-intercept that
   traffic, only the engineering-mission-shaped traffic intent-v1.js cannot
   reach). A message with no clear engineering-imperative shape classifies as
   CONVERSATION — the safe default — never as ACTIONABLE_WORK. Worker-safe:
   no Node-only imports. */

const clean = (value, max = 4000) => String(value ?? '').trim().slice(0, max);

export const JARVIS_CHAT_WORK_CLASSIFICATIONS = Object.freeze([
  'CONVERSATION',
  'ACTIONABLE_WORK',
  'APPROVAL_REQUIRED_ACTION'
]);

// Checked first, and wins over an actionable-work match. Intentionally broad
// (biased toward requiring approval on ambiguous signal, never toward
// auto-dispatch) — every category named in the mission: external, production,
// destructive, secret-sensitive, financial, DNS, public-access, deployment.
const RISK_RE = /\b(production|produktion\w*|live[- ]?system|live[- ]?server|prod[- ]?branch|deploy\w*|veröffentlich\w*|publish\w*|dns|domain\w*|öffentlich\w*|public\w*|geheimnis\w*|secrets?\b|api[- ]?keys?|credentials?\b|zugangsdaten|passwort\w*|passwords?\b|private[- ]?keys?|kreditkarte\w*|credit[- ]?cards?|bankkonto\w*|bank[- ]?account|zahlung\w*|payments?\b|rechnung\w*|invoices?\b|überweisung\w*|billing|abrechnung\w*|kundendaten|customer[- ]?data|kunden\w*|customers?\b|datenbank\w*|databases?\b|drop\s+table|main[- ]?branch|master[- ]?branch|force[- ]?push|merge\w*\s+(?:in\s+|into\s+)?(?:main|master)\b|push\w*\s+(?:to\s+|nach\s+)?(?:main|master)\b|extern\w*|third[- ]?party|dritt\w*anbieter|abonnement|subscription|kündig\w*|vertrag\w*|contract\b)\b/i;

// A bounded internal engineering imperative needs BOTH an action verb and an
// engineering-shaped noun in the same message — either alone is too weak a
// signal (a bare noun could be a question, a bare verb could target anything).
const ACTIONABLE_VERB_RE = /\b(implementier\w*|implement\w*|behebe\w*|beheb\w*|fix\w*|repariere\w*|erstelle\w*|create\w*|baue\w*|build\w*|schreibe\w*|write\w*|füge\w*|add\w*|refaktorier\w*|refactor\w*|überarbeite\w*|ändere\w*|aendere\w*|modify\w*|update\w*|aktualisiere\w*)\b/i;

const ENGINEERING_NOUN_RE = /\b(code|quellcode|funktion\w*|function\w*|methode\w*|method\w*|modul\w*|module\w*|klasse\w*|class\w*|komponente\w*|component\w*|bug\w*|fehler\w*|test\w*|skript\w*|script\w*|endpoint\w*|route\w*|feature\w*|repository|repo\b|branch\w*|pull[- ]?request|commit\w*|engineering|mission\b)\b/i;

/** Pure, deterministic, fail-closed. Never calls an LLM. Defaults to
 *  CONVERSATION on anything ambiguous or empty. */
export function classifyJarvisChatWorkRequestV1(message = '') {
  const text = clean(message, 4000);
  if (!text) return { schema: 'aurentara.jarvis.chat-work-classification.v1', classification: 'CONVERSATION', reason: 'EMPTY_MESSAGE' };

  if (RISK_RE.test(text)) {
    return { schema: 'aurentara.jarvis.chat-work-classification.v1', classification: 'APPROVAL_REQUIRED_ACTION', reason: 'RISK_SIGNAL_DETECTED' };
  }
  if (ACTIONABLE_VERB_RE.test(text) && ENGINEERING_NOUN_RE.test(text)) {
    return { schema: 'aurentara.jarvis.chat-work-classification.v1', classification: 'ACTIONABLE_WORK', reason: 'BOUNDED_ENGINEERING_IMPERATIVE' };
  }
  return { schema: 'aurentara.jarvis.chat-work-classification.v1', classification: 'CONVERSATION', reason: 'NO_ACTIONABLE_SIGNAL' };
}

export function jarvisChatWorkRouterManifestV1() {
  return {
    schema: 'aurentara.jarvis.chat-work-router.v1',
    classifications: [...JARVIS_CHAT_WORK_CLASSIFICATIONS],
    deterministic: true,
    llm_based: false,
    fail_closed_default: 'CONVERSATION',
    risk_signal_wins_over_actionable_match: true,
    excludes_generic_file_domain: true,
    worker_safe: true,
    production_deploy: false,
    hamyren_data_flow: false
  };
}
