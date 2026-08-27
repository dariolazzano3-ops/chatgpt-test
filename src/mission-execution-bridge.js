import { buildTaskExecutionContract, transitionMissionTask } from "./orchestration-state.js";
import { authorizeAdapterDispatch, buildAdapterDispatchEnvelope, validateAdapterResult } from "./execution-adapters.js";

const text = (value, max = 4000) => String(value || "").trim().slice(0, max);
const slug = (value) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(value || "").trim()) ? String(value).trim() : null;

function webRequest(contract, envelope, options = {}) {
  const base = {
    prompt: text(contract.prompt || contract.goal),
    active_state_path: "factory-state/projects.json",
    production_deploy: false,
    mission_id: contract.mission_id,
    mission_task_id: contract.task_id,
    execution_adapter: envelope.adapter_id
  };
  if (contract.capability === "web_evolve") {
    const target = slug(contract.project || options.project_slug);
    if (!target) return { ok: false, error: "WEB_PROJECT_SLUG_REQUIRED" };
    return { ok: true, request: { ...base, mode: "edit", target_project_slug: target } };
  }
  if (contract.capability === "web_generate") {
    const projectSlug = slug(contract.project || options.project_slug);
    const projectName = text(options.project_name || contract.project || `Mission ${contract.mission_id.slice(-8)}`, 120);
    return { ok: true, request: { ...base, mode: "generate", project_name: projectName, ...(projectSlug ? { project_slug: projectSlug } : {}) } };
  }
  if (contract.capability === "web_rebuild") {
    const sourceUrl = text(options.source_url || contract.dependency_outputs?.source_url, 2000);
    if (!sourceUrl) return { ok: false, error: "WEB_REBUILD_SOURCE_URL_REQUIRED" };
    const projectSlug = slug(contract.project || options.project_slug);
    const projectName = text(options.project_name || contract.project || `Mission ${contract.mission_id.slice(-8)}`, 120);
    return { ok: true, request: { ...base, mode: "rebuild", project_name: projectName, source_url: sourceUrl, ...(projectSlug ? { project_slug: projectSlug } : {}) } };
  }
  return { ok: false, error: "WEB_CAPABILITY_NOT_SUPPORTED", capability: contract.capability };
}

export function prepareMissionTaskDispatch(mission, taskId, approval = {}, options = {}) {
  const contract = buildTaskExecutionContract(mission, taskId);
  if (!contract.ok) return contract;
  const rawEnvelope = buildAdapterDispatchEnvelope(contract);
  if (!rawEnvelope.ok) return rawEnvelope;
  const authorized = authorizeAdapterDispatch(rawEnvelope, approval);
  if (!authorized.ok) return authorized;
  if (authorized.envelope.engine !== "web") return { ok: false, error: "ADAPTER_BRIDGE_NOT_IMPLEMENTED", engine: authorized.envelope.engine };
  const requestResult = webRequest(contract, authorized.envelope, options);
  if (!requestResult.ok) return requestResult;
  const started = transitionMissionTask(mission, taskId, "start", {
    inputs: { adapter_id: authorized.envelope.adapter_id, factory_request: requestResult.request },
    external_job_id: options.external_job_id || null
  });
  if (!started.ok) return started;
  return {
    ok: true,
    mission: started.mission,
    contract,
    envelope: authorized.envelope,
    factory_request: requestResult.request,
    dispatch: {
      workflow: ".github/workflows/factory-control.yml",
      branch: "factory-control",
      request_directory: "factory-requests",
      automatic_dispatch: false,
      production_deploy: false
    }
  };
}

export function webFactoryJobToAdapterResult(job = {}) {
  const status = text(job.status, 80).toUpperCase();
  if (status === "READY_FOR_REVIEW") {
    return {
      status: "COMPLETED",
      outputs: {
        project_slug: job.project_slug || null,
        revision: job.revision ?? null,
        commit_sha: job.commit_sha || null,
        preview_url: job.preview_url || null,
        qa_status: job.qa_status || null,
        qa_attempt: job.qa_attempt ?? null
      },
      external_job_id: job.job_id || null,
      production_deploy: false
    };
  }
  if (["FAILED", "FAIL_SAFE", "WORKSHOP_REQUIRED"].includes(status)) {
    return {
      status: "FAILED",
      error: {
        code: job.failure_code || job.failure_kind || status,
        message: job.last_error || null,
        retryable: job.recovery_status === "safe_retry" || job.recoverable === true
      },
      external_job_id: job.job_id || null,
      production_deploy: false
    };
  }
  return { status: "PENDING", production_deploy: false };
}

export function reconcileMissionTaskResult(mission, taskId, envelope, adapterResult) {
  if (adapterResult?.status === "PENDING") return { ok: true, pending: true, mission };
  const validated = validateAdapterResult(envelope, adapterResult);
  if (!validated.ok) return validated;
  if (validated.result.status === "COMPLETED") return transitionMissionTask(mission, taskId, "complete", { outputs: validated.result.outputs });
  return transitionMissionTask(mission, taskId, "fail", {
    code: validated.result.error?.code || "ADAPTER_FAILED",
    message: validated.result.error?.message || null,
    retryable: validated.result.error?.retryable === true
  });
}
