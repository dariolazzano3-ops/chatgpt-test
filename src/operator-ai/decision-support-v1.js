import { PREMIUM_QUALITY_DIMENSIONS } from '../web-factory/premium-standard-v1.js';

const clean = (value, max = 800) => String(value ?? '').trim().slice(0, max);
const asArray = (value) => Array.isArray(value) ? value : [];

const PRIORITY = Object.freeze({ P0: 0, P1: 1, P2: 2, P3: 3, P4: 4 });
function blocker(code, priority, classification, message, source = null) { return { code, priority, classification, message, source }; }

function qualityLeverage(quality = {}, target = null) {
  const scoreTarget = Number.isFinite(Number(target)) ? Number(target) : 90;
  const dims = asArray(quality.dimensions || quality.quality_dimensions);
  const byId = new Map(dims.map((d) => [d.id || d.dimension_id, d]));
  return PREMIUM_QUALITY_DIMENSIONS.map((d) => {
    const current = Number(byId.get(d.id)?.score);
    if (!Number.isFinite(current)) return null;
    return { dimension: d.id, current_score: current, target_score: scoreTarget, dimension_weight: d.weight, weighted_headroom: Math.max(0, (scoreTarget - current) * d.weight / 100) };
  }).filter(Boolean).sort((a, b) => b.weighted_headroom - a.weighted_headroom)[0] || null;
}

export function buildOperatorAiDecisionSupport(input = {}) {
  const snapshot = input.snapshot || {};
  const quality = snapshot.quality_state || {};
  const items = [];

  if (!snapshot.canonical_source?.canonical_head) items.push(blocker('CANONICAL_HEAD_UNKNOWN','P0','EXTERNAL_BLOCKER','Aktueller Canonical HEAD ist nicht verifiziert.','canonical_source'));
  if (snapshot.freshness?.canonical === 'STALE') items.push(blocker('CANONICAL_EVIDENCE_STALE','P0','EXTERNAL_BLOCKER','Canonical-Evidence ist veraltet und muss vor Execution aktualisiert werden.','canonical_source'));
  for (const conflict of asArray(snapshot.conflicts)) items.push(blocker(clean(conflict.code,160)||'SOURCE_CONFLICT','P0','EXTERNAL_BLOCKER','Ein kritischer Source-Konflikt blockiert sichere Execution.','context_snapshot'));

  const projectBlockers = asArray(snapshot.project_state?.blockers || snapshot.project_state?.project?.blockers);
  for (const item of projectBlockers) items.push(blocker(clean(item.code || item,160)||'PROJECT_BLOCKER','P2','INTERNALLY_SOLVABLE','Projektblocker erfordert Auflösung.','project_state'));

  const hardFailures = asArray(quality.hard_failures || quality.hard_gates?.failures);
  for (const item of hardFailures) items.push(blocker(clean(item.code || item,160)||'PREMIUM_HARD_GATE_FAIL','P0','INTERNALLY_SOLVABLE','Premium Hard Gate hat Vorrang vor Score-Polish.','premium_standard'));

  const missingCustomer = asArray(quality.missing_customer_inputs || snapshot.project_context?.missing_customer_inputs);
  for (const item of missingCustomer) items.push(blocker(`CUSTOMER_INPUT_REQUIRED:${clean(item,120)}`,'P1','CUSTOMER_REQUIRED','Zwingender Kundeninput fehlt.','project_context'));

  if (snapshot.cost_state?.approval_required === true) items.push(blocker('COST_APPROVAL_REQUIRED','P0','PAID_APPROVAL_REQUIRED','Kostenfreigabe ist erforderlich.','cost_state'));
  if (snapshot.release_state?.production_approval_required === true || snapshot.release_state?.operator_production_approval === false) items.push(blocker('PRODUCTION_APPROVAL_REQUIRED','P0','PRODUCTION_APPROVAL_REQUIRED','Production bleibt bis zur formalen Freigabe gesperrt.','release_state'));

  const providerBlocked = asArray(snapshot.provider_state?.provider_ecosystem).filter((p) => p.runtime_eligible === false || p.connection_state === 'NOT_CONNECTED');
  if (input.required_provider_ids?.some((id) => providerBlocked.some((p) => p.id === id))) items.push(blocker('REQUIRED_PROVIDER_UNAVAILABLE','P2','PROVIDER_REQUIRED','Ein benötigter Provider ist aktuell nicht runtime-eligible.','provider_state'));

  const leverage = qualityLeverage(quality, input.quality_target);
  const ordered = items.sort((a,b) => (PRIORITY[a.priority] ?? 9) - (PRIORITY[b.priority] ?? 9) || a.code.localeCompare(b.code));
  const primary = ordered[0] || (leverage
    ? { code: 'QUALITY_LEVERAGE', priority: 'P3', classification: 'INTERNALLY_SOLVABLE', message: `Größter belegter Quality-Hebel: ${leverage.dimension}.`, source: 'premium_standard', leverage }
    : { code: 'VERIFY_AND_ADVANCE', priority: 'P3', classification: 'OPERATOR_REQUIRED', message: 'Aktuellen verifizierten Zustand bestätigen und den nächsten gebundenen Brief erstellen.', source: 'context_snapshot' });

  return {
    schema: 'aurentara.operator-ai.decision-support.v1',
    primary_next_action: primary,
    secondary_actions: ordered.filter((x) => x !== primary).slice(0,2),
    blockers: ordered,
    quality_leverage: leverage,
    hard_gates_override_score_polish: true,
    recommendation_count: 1,
    production_deploy: false
  };
}

export function operatorAiDecisionSupportManifest() {
  return { schema: 'aurentara.operator-ai.decision-support.v1', deterministic_priority: ['P0','P1','P2','P3','P4'], primary_recommendation_count: 1, premium_standard_reused: 'aurentara.premium-website-standard.v1', guaranteed_score_gain_claimed: false, production_deploy: false };
}
