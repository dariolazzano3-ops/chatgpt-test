const clean = (value, max = 240) => String(value || '').trim().slice(0, max);
const lower = (value) => clean(value, 4000).toLowerCase();

const RULES = [
  { id: 'branding', factory: 'business', match: /brand|branding|logo|identity|marke/ },
  { id: 'website', factory: 'web', match: /webseite|website|landingpage|web shop|shop/ },
  { id: 'crm', factory: 'business', match: /crm|kundenverwaltung|pipeline|vertrieb|sales/ },
  { id: 'lead-flow', factory: 'automation', match: /lead|anfrage|kontakt|formular|automation|automatis/ },
  { id: 'support-ai', factory: 'ai', match: /support.?ki|support ai|chatbot|kunden.?ki|assistant|assistent/ },
  { id: 'content-ai', factory: 'ai', match: /content|texte|text|beschreibung|copy/ },
  { id: 'analytics', factory: 'automation', match: /analytics|tracking|analyse|conversion/ },
  { id: 'email', factory: 'automation', match: /email|e-mail|mail flow|newsletter/ }
];

export function compileProjectBlueprint(input = {}) {
  const objective = clean(input.objective || input.prompt || input.goal, 4000);
  if (!objective) return { ok: false, error: 'PROJECT_OBJECTIVE_REQUIRED' };
  const text = lower(objective);
  const capabilities = RULES.filter((rule) => rule.match.test(text)).map((rule) => ({
    id: rule.id,
    factory: rule.factory,
    required: true,
    status: 'PLANNED',
    external_activation_required: ['crm','lead-flow','email','analytics'].includes(rule.id)
  }));
  if (!capabilities.length) capabilities.push({ id: 'business-system', factory: 'business', required: true, status: 'PLANNED', external_activation_required: false });
  const factories = [...new Set(capabilities.map((item) => item.factory))];
  return {
    ok: true,
    blueprint: {
      schema_version: 'riosystems.project-blueprint.v1',
      objective,
      capabilities,
      factories,
      one_command_candidate: true,
      external_activation_separate: capabilities.some((item) => item.external_activation_required),
      production_deploy: false
    }
  };
}

export function projectBlueprintManifest() {
  return { version: 'riosystems.project-blueprint.v1', deterministic_capability_mapping: true, factories: ['web','automation','ai','business'], production_deploy: false };
}
