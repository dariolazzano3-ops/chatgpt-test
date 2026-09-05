import { OPERATOR_AI_RESULT_SCHEMA } from './contracts-v1.js';

const clean = (value, max = 2000) => String(value ?? '').trim().slice(0, max);
const arr = (value) => Array.isArray(value) ? value : [];

export function interpretOperatorAiResult(input = {}) {
  const repairs = arr(input.repairs);
  const externalBlocker = arr(input.blockers).find((b) => ['EXTERNAL_BLOCKER','CUSTOMER_REQUIRED','PROVIDER_REQUIRED','PAID_APPROVAL_REQUIRED','PRODUCTION_APPROVAL_REQUIRED','OPERATOR_REQUIRED'].includes(b.classification));
  const rawStatus = clean(input.status,100).toUpperCase();
  const failed = input.ok === false || rawStatus.includes('FAIL');
  const pendingExternalTasks = arr(input.pending_external_tasks);
  const canonicalInProgress = input.canonical_execution === true && !failed && !externalBlocker && (pendingExternalTasks.length > 0 || ['RUNNING','READY','PARTIALLY_BLOCKED'].includes(rawStatus));
  let summary;
  if (externalBlocker) summary = `Alles intern Lösbare ist bis zum aktuellen Stand abgeschlossen. Nächster Blocker: ${clean(externalBlocker.message || externalBlocker.code)}.`;
  else if (failed) summary = `Der Run ist innerhalb der gesetzten Grenzen gestoppt. ${clean(input.error || input.status || 'Interner Fehler blieb nach dem Repair-Limit bestehen.')}`;
  else if (canonicalInProgress) summary = `Die Execution wurde an den kanonischen Execution-Pfad übergeben und ist noch nicht terminal abgeschlossen. ${pendingExternalTasks.length ? `${pendingExternalTasks.length} Task(s) warten auf den vorgesehenen externen/supervised Abschluss.` : 'Der kanonische Mission-State ist noch nicht terminal.'}`;
  else summary = `Die angeforderte interne Arbeit ist abgeschlossen. ${repairs.length ? `${repairs.length} reparierbare Zwischenfehler wurden innerhalb des Limits behoben.` : 'Die relevanten Prüfungen sind abgeschlossen.'}`;
  return {
    schema: OPERATOR_AI_RESULT_SCHEMA,
    status: externalBlocker ? 'BLOCKED_EXTERNAL' : failed ? 'BLOCKED_WITH_INTERNAL_FAILURE' : canonicalInProgress ? 'IN_PROGRESS' : 'COMPLETED',
    summary,
    repairs: repairs.map((r) => ({ issue: clean(r.issue || r.error,500), action: clean(r.action || r.fix,500), retest: clean(r.retest || r.status,200) })),
    tests: arr(input.tests),
    quality_before: input.quality_before ?? null,
    quality_after: input.quality_after ?? null,
    next_action: externalBlocker ? clean(externalBlocker.message || externalBlocker.code) : canonicalInProgress ? 'CANONICAL_EXECUTION_CONTINUE' : clean(input.next_action) || null,
    canonical_execution: input.canonical_execution === true,
    pending_external_tasks: pendingExternalTasks,
    production_changed: false,
    external_writes: false,
    variable_cost_eur: Number(input.variable_cost_eur || 0),
    paid_provider_calls: Number(input.paid_provider_calls || 0)
  };
}

export function operatorAiResultInterpreterManifest() {
  return { schema: OPERATOR_AI_RESULT_SCHEMA, bounded_repair_reporting: true, external_blockers_distinct_from_internal_failures: true, canonical_in_progress_distinct_from_success: true, unsupported_execution_success_never_projected: true, production_deploy: false };
}
