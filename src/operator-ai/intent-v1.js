import { OPERATOR_AI_AUTONOMY, OPERATOR_AI_INTENTS } from './contracts-v1.js';

const clean = (value, max = 6000) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const lower = (value) => clean(value).toLowerCase();
const has = (text, patterns) => patterns.some((pattern) => typeof pattern === 'string' ? text.includes(pattern) : pattern.test(text));

const NO_EXECUTION = [
  'starte nichts','nichts starten','nicht starten','noch nicht starten','nur vorbereiten','nur planen','nur analysieren',
  'nur sagen','sag mir nur','nur den masterprompt','nur masterprompt','keine ausführung','nicht ausführen','do not start',
  'start nothing','prepare only','do not execute','no execution'
];
const RELEASE = ['bring live','mach live','live schalten','veröffentlichen','veroeffentlichen','production deploy','deploy production','go live'];
const PROMPT = ['masterprompt','master prompt','execution prompt','umsetzungsprompt'];
const PREPARE = ['bereite den run vor','bereite alles vor','execution vorbereiten','run vorbereiten','prepare the run','prepare execution'];
const PROJECT_CREATE = ['neues projekt','projekt erstellen','create project','new project'];
const CUSTOMER_CHANGE = ['der kunde hat','kunde hat jetzt','customer changed','customer says','neue öffnungszeiten','neue oeffnungszeiten'];
const COST = ['kosten','cost','budget','preislich','wie teuer','spend'];
const PROVIDER = ['provider','openai','framer','make','n8n','supabase','cloudflare','posthog'];
const APPROVAL = ['freigabe','approval','genehmigung','approve'];
const REVISION = ['gefällt mir nicht','gefaellt mir nicht','ruhiger','nur desktop','nur mobile','letzte änderung zurück','letzte aenderung zurueck','behalte mobile','revision'];
const QUALITY = ['premium','hochwertiger','qualität','qualitaet','score','punkte','conversion','accessibility','seo','responsive','performance'];
const STATUS = ['wie steht','status','stand von','wo stehen wir','wie weit','current state'];
const ANALYSIS = ['warum','wieso','weshalb','analysiere','analyse','blocker','nicht fertig','problem'];
const PLAN = ['was würdest du','was wuerdest du','was soll ich','nächster schritt','naechster schritt','plane','plan erstellen','what next'];
const EXECUTE = ['behebe','fix','repariere','verbessere','ändere','aendere','implementiere','mach den','bring ','optimiere','execute','repair'];

function inferProjectReference(message) {
  const text = clean(message);
  const quoted = text.match(/["“”']([^"“”']{2,120})["“”']/)?.[1];
  if (quoted) return quoted;
  const known = text.match(/\b(gelato(?:[-\s]donatello)?|hamyren|aurentara(?: systems)?|riosystems)\b/i)?.[1];
  return known ? clean(known, 120) : null;
}

function confidenceFor(intent, message) {
  if (!clean(message)) return 0;
  if (intent === 'INFORMATION_REQUEST') return 0.62;
  if (intent === 'UNSAFE_OR_BLOCKED_REQUEST') return 0.98;
  return 0.9;
}

export function resolveOperatorAiIntent(input = {}) {
  const message = clean(input.message || input.text || input.prompt);
  const text = lower(message);
  if (!message) {
    return { ok: false, error: 'OPERATOR_AI_MESSAGE_REQUIRED', intent: 'UNSAFE_OR_BLOCKED_REQUEST', confidence: 1, requested_autonomy: 0, execution_requested: false, explicit_no_execution: true };
  }

  const explicitNoExecution = has(text, NO_EXECUTION);
  let intent = 'INFORMATION_REQUEST';
  let requestedAutonomy = OPERATOR_AI_AUTONOMY.READ_ONLY;
  let executionRequested = false;

  if (has(text, RELEASE)) {
    intent = text.includes('launch') || text.includes('live') ? 'LAUNCH_REQUEST' : 'RELEASE_REQUEST';
    requestedAutonomy = OPERATOR_AI_AUTONOMY.APPROVAL_GATED_EXTERNAL_ACTION;
    executionRequested = !explicitNoExecution;
  } else if (has(text, PROJECT_CREATE)) {
    intent = 'PROJECT_CREATION_REQUEST';
    requestedAutonomy = OPERATOR_AI_AUTONOMY.PLAN_GENERATE;
  } else if (has(text, CUSTOMER_CHANGE)) {
    intent = 'CUSTOMER_CHANGE_REQUEST';
    requestedAutonomy = OPERATOR_AI_AUTONOMY.PLAN_GENERATE;
  } else if (has(text, PROMPT)) {
    intent = 'PROMPT_GENERATION_REQUEST';
    requestedAutonomy = OPERATOR_AI_AUTONOMY.PLAN_GENERATE;
  } else if (has(text, PREPARE)) {
    intent = 'EXECUTION_PREPARATION_REQUEST';
    requestedAutonomy = OPERATOR_AI_AUTONOMY.PREPARE_EXECUTION;
  } else if (has(text, REVISION)) {
    intent = 'REVISION_REQUEST';
    requestedAutonomy = has(text, EXECUTE) && !explicitNoExecution ? OPERATOR_AI_AUTONOMY.SAFE_INTERNAL_EXECUTION : OPERATOR_AI_AUTONOMY.PLAN_GENERATE;
    executionRequested = requestedAutonomy >= 4;
  } else if (has(text, EXECUTE)) {
    intent = has(text, QUALITY) ? 'QUALITY_IMPROVEMENT_REQUEST' : 'EXECUTION_REQUEST';
    requestedAutonomy = OPERATOR_AI_AUTONOMY.SAFE_INTERNAL_EXECUTION;
    executionRequested = !explicitNoExecution;
  } else if (has(text, COST)) {
    intent = 'COST_REQUEST'; requestedAutonomy = OPERATOR_AI_AUTONOMY.ADVISE;
  } else if (has(text, PROVIDER)) {
    intent = 'PROVIDER_REQUEST'; requestedAutonomy = OPERATOR_AI_AUTONOMY.ADVISE;
  } else if (has(text, APPROVAL)) {
    intent = 'APPROVAL_REQUEST'; requestedAutonomy = OPERATOR_AI_AUTONOMY.PREPARE_EXECUTION;
  } else if (has(text, STATUS)) {
    intent = 'STATUS_REQUEST'; requestedAutonomy = OPERATOR_AI_AUTONOMY.READ_ONLY;
  } else if (has(text, ANALYSIS)) {
    intent = 'ANALYSIS_REQUEST'; requestedAutonomy = OPERATOR_AI_AUTONOMY.ADVISE;
  } else if (has(text, PLAN)) {
    intent = 'PLANNING_REQUEST'; requestedAutonomy = OPERATOR_AI_AUTONOMY.PLAN_GENERATE;
  }

  if (explicitNoExecution) {
    executionRequested = false;
    requestedAutonomy = Math.min(requestedAutonomy, intent === 'EXECUTION_PREPARATION_REQUEST' ? 3 : 2);
  }

  return {
    ok: true,
    schema: 'aurentara.operator-ai.intent-resolution.v1',
    intent: OPERATOR_AI_INTENTS.includes(intent) ? intent : 'UNSAFE_OR_BLOCKED_REQUEST',
    confidence: confidenceFor(intent, message),
    requested_autonomy: requestedAutonomy,
    execution_requested: executionRequested,
    explicit_no_execution: explicitNoExecution,
    project_reference: inferProjectReference(message),
    quality_target: Number(text.match(/\b(\d{2,3})\s*(?:punkte|points|score)?\b/)?.[1]) || null,
    cost_constraint: Number(text.match(/(?:max(?:imal)?|höchstens|hoechstens|unter|budget)\s*(\d+(?:[.,]\d+)?)\s*€?/i)?.[1]?.replace(',','.')) || null,
    production_intent: has(text, RELEASE),
    operator_constraints: explicitNoExecution ? ['NO_EXECUTION'] : [],
    raw_message: message,
    production_deploy: false
  };
}

export function operatorAiIntentManifest() {
  return { schema: 'aurentara.operator-ai.intent.v1', deterministic_guardrail_resolution: true, status_never_implies_execution: true, explicit_no_execution_wins: true, production_language_requires_approval_level: true, production_deploy: false };
}
