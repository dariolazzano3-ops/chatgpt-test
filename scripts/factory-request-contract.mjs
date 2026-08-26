const MODES = new Set(["generate", "rebuild", "edit", "evolve", "qa", "recheck"]);

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function assert(condition, code) {
  if (!condition) throw new Error(code);
}

export function validateFactoryRequest(input) {
  assert(input && typeof input === "object" && !Array.isArray(input), "REQUEST_OBJECT_REQUIRED");

  const job = { ...input };
  const mode = text(job.mode || "generate").toLowerCase();
  assert(MODES.has(mode), `UNSUPPORTED_MODE:${mode}`);
  job.mode = mode;

  if (Object.prototype.hasOwnProperty.call(job, "production_deploy")) {
    assert(job.production_deploy === false, "PRODUCTION_DEPLOY_NOT_ALLOWED_IN_FACTORY_CONTROL");
  }

  if (Object.prototype.hasOwnProperty.call(job, "base_branch")) {
    assert(text(job.base_branch) === "main", "BASE_BRANCH_MUST_BE_MAIN");
  }

  if (Object.prototype.hasOwnProperty.call(job, "active_state_path")) {
    const statePath = text(job.active_state_path);
    assert(/^factory-state\/[A-Za-z0-9._-]+\.json$/.test(statePath), "ACTIVE_STATE_PATH_INVALID");
    job.active_state_path = statePath;
  }

  if (mode === "generate") {
    assert(text(job.project_name), "PROJECT_NAME_REQUIRED");
    assert(text(job.prompt), "PROMPT_REQUIRED");
  }

  if (mode === "rebuild") {
    assert(text(job.project_name), "PROJECT_NAME_REQUIRED");
    const sourceUrl = text(job.source_url);
    assert(sourceUrl, "SOURCE_URL_REQUIRED");
    let parsed;
    try { parsed = new URL(sourceUrl); } catch { throw new Error("SOURCE_URL_INVALID"); }
    assert(parsed.protocol === "https:" || parsed.protocol === "http:", "SOURCE_URL_PROTOCOL_INVALID");
    assert(!["localhost", "127.0.0.1", "::1"].includes(parsed.hostname), "SOURCE_URL_LOCALHOST_BLOCKED");
    if (job.max_pages !== undefined) {
      assert(Number.isInteger(job.max_pages) && job.max_pages >= 1 && job.max_pages <= 20, "MAX_PAGES_OUT_OF_RANGE");
    }
  }

  if (mode === "edit" || mode === "evolve") {
    const hasPrompt = Boolean(text(job.prompt));
    const hasChanges = Array.isArray(job.changes) ? job.changes.length > 0 : Boolean(job.changes && typeof job.changes === "object");
    assert(hasPrompt || hasChanges, "EDIT_INSTRUCTION_REQUIRED");
  }

  if (mode === "qa" || mode === "recheck") {
    assert(!job.prompt && !job.changes && !job.source_url, "QA_REQUEST_MUST_BE_READ_ONLY");
  }

  return job;
}
