import { OPERATOR_AI_RESULT_SCHEMA } from './contracts-v1.js';

const clean = (value, max = 2000) => String(value ?? '').trim().slice(0, max);
const arr = (value) => Array.isArray(value) ? value : [];

export function interpretOperatorAiResult(input = {}) {
  const repairs = arr(input.repairs);
  const externalBlocker = arr(input.blockers).find((b) => ['EXTERNAL_BLOCKER','CUSTOMER_REQUIRED','PROVIDER_REQUIRED','PAID_APPROVAL_REQUIRED','PRODUCTION_APPROVAL_REQUIRED','OPERATOR_REQUIRED'].includes(b.classification));
  const failed = input.ok === false || clean(input.status,100).toUpperCase().includes('FAIL');
  let summary;
  if (externalBlocker) summary = `Alles intern Lösbare ist bis zum aktuellen Stand abgeschlossen. Nächster Blocker: ${clean(externalBlocker.message || externalBlocker.code)}.`;
  else if (failed) summary = `Der Run ist innerhalb der gesetzten Grenzen gestoppt. ${clean(input.error || input.status || 'Interner Fehler blieb nach dem Repair-Limit bestehen.')}`;
  else summary = `Die angeforderte interne Arbeit ist abgeschlossen. ${repairs.length ? `${repairs.length} reparierbare Zwischenfehler wurden innerhalb des Limits behoben.` : 'Die relevanten Prüfungen sind abgeschlossen.'}`;
  return {
    schema: OPERATOR_AI_RESULT_SCHEMA,
    status: externalBlocker ? 'BLOCKED_EXTERNAL' : failed ? 'BLOCKED_WITH_INTERNAL_FAILURE' : 'COMPLETED',
    summary,
    repairs: repairs.map((r) => ({ issue: clean(r.issue || r.error,500), action: clean(r.action || r.fix,500), retest: clean(r.retest || r.status,200) })),
    tests: arr(input.tests),
    quality_before: input.quality_before ?? null,
    quality_after: input.quality_after ?? null,
    next_action: externalBlocker ? clean(externalBlocker.message || externalBlocker.code) : clean(input.next_action) || null,
    production_changed: false,
    external_writes: false,
    variable_cost_eur: Number(input.variable_cost_eur || 0),
    paid_provider_calls: Number(input.paid_provider_calls || 0)
  };
}

export function operatorAiResultInterpreterManifest() {
  return { schema: OPERATOR_AI_RESULT_SCHEMA, bounded_repair_reporting: true, external_blockers_distinct_from_internal_failures: true, production_deploy: false };
}
