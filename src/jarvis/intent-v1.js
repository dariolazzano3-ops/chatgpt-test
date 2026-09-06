import { JARVIS_DOMAINS, JARVIS_INTENTS } from './contracts-v1.js';

const clean = (value, max = 6000) => String(value ?? '').trim().slice(0, max);

const rules = [
  ['REMINDER', 'REMINDER_REQUEST', /\b(remind\w*|erinner\w*)\b/i],
  ['CALENDAR', 'CALENDAR_REQUEST', /(?:\b(calendar|kalender|termin|appointment|meeting|freie slots?|wann.*zeit)\b|was\s+steht\s+(?:heute|morgen|übermorgen)\s+an|what(?:'s| is)?\s+(?:on|scheduled)\s+(?:today|tomorrow))/i],
  ['EMAIL', 'EMAIL_REQUEST', /\b(email|e-mail|mail|gmail|nachricht)\b/i],
  ['TASKS', 'TASK_REQUEST', /\b(task|tasks|aufgabe|todo|to-do)\b/i],
  ['FILES', 'FILE_REQUEST', /\b(file|files|datei|dokument|document|unterlagen)\b/i],
  ['MEMORY', 'MEMORY_REQUEST', /\b(erinnerst du|was habe ich.*entschieden|letztes mal|memory|gedächtnis|remember)\b/i],
  ['PROJECTS', 'PROJECT_REQUEST', /\b(project|projekt|aurentara|riosystems)\b/i],
  ['RESEARCH', 'RESEARCH_REQUEST', /\b(search|research|recherch|suche|finde|web)\b/i],
  ['AUTOMATION', 'AUTOMATION_REQUEST', /\b(automation|automatisier|automatisch|workflow)\b/i],
  ['SMART_HOME', 'DEVICE_REQUEST', /\b(light|licht|thermostat|home|smart home|steckdose|gerät|device)\b/i],
  ['PERSONAL_STATUS', 'STATUS_REQUEST', /\b(heute|today|mein tag|my day|was steht an|what.*today)\b/i]
];

function actionFor(message, domain) {
  const write = /\b(send|sende|schick|create|erstell|buche|book|setze|stell|schalte|lösche|delete|verschiebe|move|trag\w* ein)\b/i.test(message);
  if (domain === 'EMAIL') return write ? 'SEND_EMAIL' : 'DRAFT_EMAIL';
  if (domain === 'CALENDAR') return write ? 'CREATE_CALENDAR_EVENT' : 'READ_CALENDAR';
  if (domain === 'REMINDER') return 'CREATE_REMINDER';
  if (domain === 'TASKS') return write ? 'CREATE_TASK' : 'PREPARE_TASK';
  if (domain === 'FILES') return write ? 'FILE_WRITE' : 'SEARCH_FILES';
  if (domain === 'MEMORY') return 'READ_PERSONAL_MEMORY';
  if (domain === 'SMART_HOME') return 'SMART_HOME_ACTION';
  if (domain === 'RESEARCH') return 'RESEARCH_WEB';
  return 'READ_PERSONAL_CONTEXT';
}

function fallbackIntentType(message) {
  if (/\b(plan|plane|planung|woche planen|week plan)\b/i.test(message)) return 'PLANNING_REQUEST';
  if (/\b(entscheidung|decide|entscheidungshilfe|empfiehl|recommend)\b/i.test(message)) return 'DECISION_SUPPORT_REQUEST';
  if (/\b(status|stand|fortschritt|progress)\b/i.test(message)) return 'STATUS_REQUEST';
  return 'INFORMATION_REQUEST';
}

export function resolveJarvisIntentV1(input = {}) {
  const message = clean(input.message || input.text);
  if (!message) return { ok: false, error: 'JARVIS_MESSAGE_REQUIRED' };

  const matched = rules.find(([, , regex]) => regex.test(message));
  const domain = matched?.[0] || 'GENERAL';
  const intentType = matched?.[1] || fallbackIntentType(message);
  if (!JARVIS_DOMAINS.includes(domain)) return { ok: false, error: 'JARVIS_DOMAIN_INVALID' };
  if (!JARVIS_INTENTS.includes(intentType)) return { ok: false, error: 'JARVIS_INTENT_INVALID' };

  const financial = /(überweis|transfer|bezahlen|\bpay\b|zahlung|kauf|\bbuy\b|\btrade\b|broker|bank)/i.test(message);
  const action = financial ? 'FINANCIAL_ACTION' : actionFor(message, domain);

  return {
    ok: true,
    schema: 'aurentara.jarvis.intent.v1',
    raw_message: message,
    intent_type: financial ? 'EXECUTION_REQUEST' : intentType,
    domain,
    action,
    asks_for_action: !['READ_PERSONAL_CONTEXT', 'READ_PERSONAL_MEMORY', 'READ_CALENDAR', 'SEARCH_FILES', 'RESEARCH_WEB'].includes(action),
    financial_intent: financial
  };
}
