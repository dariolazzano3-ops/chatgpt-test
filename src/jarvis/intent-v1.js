import { JARVIS_DOMAINS } from './contracts-v1.js';

const clean = (value, max = 6000) => String(value ?? '').trim().slice(0, max);

const rules = [
  ['REMINDER', /\b(remind|reminder|erinner|erinnerung)\b/i],
  ['CALENDAR', /\b(calendar|kalender|termin|appointment|meeting)\b/i],
  ['EMAIL', /\b(email|e-mail|mail|gmail|nachricht)\b/i],
  ['TASKS', /\b(task|tasks|aufgabe|todo|to-do)\b/i],
  ['FILES', /\b(file|files|datei|dokument|document)\b/i],
  ['PROJECTS', /\b(project|projekt|aurentara|riosystems)\b/i],
  ['RESEARCH', /\b(search|research|recherch|suche|finde|web)\b/i],
  ['AUTOMATION', /\b(automation|automatisier|automatisch|workflow)\b/i],
  ['SMART_HOME', /\b(light|licht|thermostat|home|smart home|steckdose)\b/i],
  ['PERSONAL_STATUS', /\b(heute|today|mein tag|my day|was steht an|what.*today)\b/i]
];

function actionFor(message, domain) {
  const write = /\b(send|sende|schick|create|erstell|buche|book|setze|stell|schalte|lösche|delete|verschiebe|move)\b/i.test(message);
  if (domain === 'EMAIL') return write ? 'SEND_EMAIL' : 'DRAFT_EMAIL';
  if (domain === 'CALENDAR') return write ? 'CREATE_CALENDAR_EVENT' : 'PREPARE_CALENDAR_EVENT';
  if (domain === 'REMINDER') return 'CREATE_REMINDER';
  if (domain === 'TASKS') return write ? 'CREATE_TASK' : 'PREPARE_TASK';
  if (domain === 'FILES' && write) return 'FILE_WRITE';
  if (domain === 'SMART_HOME') return 'SMART_HOME_ACTION';
  if (domain === 'RESEARCH') return 'RESEARCH_WEB';
  return 'READ_PERSONAL_CONTEXT';
}

export function resolveJarvisIntentV1(input = {}) {
  const message = clean(input.message || input.text);
  if (!message) return { ok: false, error: 'JARVIS_MESSAGE_REQUIRED' };

  const domain = rules.find(([, regex]) => regex.test(message))?.[0] || 'GENERAL';
  if (!JARVIS_DOMAINS.includes(domain)) return { ok: false, error: 'JARVIS_DOMAIN_INVALID' };

  const financial = /\b(überweis|transfer|bezahlen|pay|zahlung|kauf|buy|trade|broker|bank)\b/i.test(message);
  const action = financial ? 'FINANCIAL_ACTION' : actionFor(message, domain);

  return {
    ok: true,
    schema: 'aurentara.jarvis.intent.v1',
    raw_message: message,
    domain,
    action,
    asks_for_action: action !== 'READ_PERSONAL_CONTEXT' && action !== 'RESEARCH_WEB',
    financial_intent: financial
  };
}
