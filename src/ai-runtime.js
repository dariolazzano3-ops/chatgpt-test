import { normalizeAIContract } from './ai-factory.js';
import { executeAIContract } from './ai-executor.js';
import { createAIJob, recordAIJobEvent, completeAIJob, failAIJob, summarizeAIJob } from './ai-job-state.js';
import { routeAIProvider } from './ai-provider-registry.js';

function applyEvent(job, event) {
  const recorded = recordAIJobEvent(job, event);
  return recorded.ok ? recorded.job : job;
}

export async function runAIJob(contract = {}, options = {}) {
  const normalized = normalizeAIContract(contract);
  let job = createAIJob({ job_id: options.job_id, task_type: normalized.ok ? normalized.contract.task_type : contract.task_type });
  if (!normalized.ok) {
    const failed = failAIJob(job, { code: 'AI_CONTRACT_INVALID', message: normalized.errors.join(', ') });
    return { ok: false, job: failed.ok ? failed.job : job, summary: summarizeAIJob(failed.ok ? failed.job : job), result: null };
  }

  job = applyEvent(job, { type: 'STARTED' });
  const routed = routeAIProvider(options.registry || { providers: [] }, normalized.contract, options.preferences || {});
  if (!routed.ok) {
    const failed = failAIJob(job, { code: routed.error, message: 'No enabled injected provider runner matched the AI task.' });
    return { ok: false, job: failed.ok ? failed.job : job, summary: summarizeAIJob(failed.ok ? failed.job : job), result: null };
  }

  job = applyEvent(job, { type: 'PROVIDER_SELECTED', provider: routed.provider, model: routed.model });
  const wrappedRunner = async (request) => {
    job = applyEvent(job, { type: 'ATTEMPT', attempt: request.attempt });
    job = applyEvent(job, { type: 'RUNNER_CALL', attempt: request.attempt });
    if (request.repair_directive) job = applyEvent(job, { type: 'REPAIR_DIRECTIVE', attempt: request.attempt, failure_code: request.repair_directive.failure_code });
    return routed.runner(request);
  };

  const execution = await executeAIContract(normalized.contract, { runner: wrappedRunner, provider: routed.provider, model: routed.model });
  const result = execution.result || null;
  if (result?.execution_trace) {
    for (const item of result.execution_trace) {
      if (item.status === 'FAILED' && (item.code === 'AI_STRUCTURED_OUTPUT_INVALID' || item.code === 'AI_OUTPUT_JSON_PARSE_FAILED' || item.code === 'AI_TEXT_OUTPUT_TYPE_INVALID')) {
        job = applyEvent(job, { type: 'VALIDATION_FAILED', attempt: item.attempt, code: item.code });
      }
    }
  }

  if (execution.ok && result?.status === 'COMPLETED') {
    const completed = completeAIJob(job, result);
    const finalJob = completed.ok ? completed.job : job;
    return { ok: true, job: finalJob, summary: summarizeAIJob(finalJob), result };
  }

  const failure = result?.error || { code: 'AI_EXECUTION_FAILED', message: 'AI execution failed.' };
  const blocked = failure.code === 'AI_SIDE_EFFECT_DECLARATION_REJECTED';
  const failed = failAIJob(job, failure, blocked);
  const finalJob = failed.ok ? failed.job : job;
  return { ok: false, job: finalJob, summary: summarizeAIJob(finalJob), result };
}
