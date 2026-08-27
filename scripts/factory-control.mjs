import crypto from "node:crypto";
import fs from "node:fs/promises";
import { buildGenerateBlueprint } from "../src/generator.js";
import { analyzePublicWebsite } from "../src/scraper.js";
import { buildRebuildBlueprint } from "../src/builder.js";
import { materializeProject } from "../src/materializer.js";
import { evolveProjectSafely } from "../src/evolve-safe.js";
import { validateFactoryRequest } from "./factory-request-contract.mjs";

const requestPath = process.argv[2];
if (!requestPath) throw new Error("REQUEST_FILE_REQUIRED");
if (!/^factory-requests\/[A-Za-z0-9._-]+\.json$/.test(requestPath)) throw new Error("REQUEST_PATH_INVALID");

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  return value;
}

const raw = await fs.readFile(requestPath, "utf8");
const parsedRequest = JSON.parse(raw);
const recoveryKey = crypto.createHash("sha256").update(JSON.stringify(stable(parsedRequest))).digest("hex");
const job = validateFactoryRequest(parsedRequest);
const mode = job.mode;
const internalToken = `actions-${process.env.GITHUB_RUN_ID || Date.now()}`;
const request = new Request("https://factory-control.local/run", { headers: { authorization: `Bearer ${internalToken}` } });
const env = { API_TOKEN: internalToken, GITHUB_TOKEN: process.env.GITHUB_TOKEN, GITHUB_REPOSITORY: process.env.GITHUB_REPOSITORY };

if (!env.GITHUB_TOKEN) throw new Error("GITHUB_TOKEN_REQUIRED");
if (!env.GITHUB_REPOSITORY) throw new Error("GITHUB_REPOSITORY_REQUIRED");

function validateProjectState(state, prefix = "PROJECT") {
  if (!state || typeof state !== "object") throw new Error(`${prefix}_STATE_INVALID`);
  if (state.mode !== "editing") throw new Error(`${prefix}_NOT_IN_EDITING_MODE`);
  if (!String(state.project_slug || "").trim()) throw new Error(`${prefix}_SLUG_REQUIRED`);
  if (state.source_path !== `projects/${state.project_slug}`) throw new Error(`${prefix}_PATH_MISMATCH`);
  if (!String(state.branch || "").startsWith("factory/")) throw new Error(`${prefix}_BRANCH_INVALID`);
  if (state.production_deploy !== false) throw new Error(`${prefix}_PRODUCTION_MUST_BE_DISABLED`);
  return state;
}

async function readRegisteredProject(slug) {
  const registryPath = "factory-state/projects.json";
  const headers = {
    authorization: `Bearer ${env.GITHUB_TOKEN}`,
    accept: "application/vnd.github+json",
    "x-github-api-version": "2022-11-28"
  };
  const response = await fetch(`https://api.github.com/repos/${env.GITHUB_REPOSITORY}/contents/${registryPath}?ref=factory-control`, { headers });
  if (response.status === 404) throw new Error("PROJECT_REGISTRY_NOT_FOUND");
  if (!response.ok) throw new Error(`PROJECT_REGISTRY_READ_FAILED_${response.status}`);
  const body = await response.json();
  const registry = JSON.parse(Buffer.from(body.content, "base64").toString("utf8"));
  const state = registry?.projects?.[slug];
  if (!state) throw new Error(`TARGET_PROJECT_NOT_FOUND:${slug}`);
  return { statePath: registryPath, state: validateProjectState(state, "TARGET_PROJECT"), targeted: true };
}

async function readProjectState() {
  if (job.target_project_slug) return readRegisteredProject(job.target_project_slug);

  const statePath = String(job.active_state_path || "factory-state/active-project.json");
  const state = JSON.parse(await fs.readFile(statePath, "utf8"));
  if (state.active !== true) throw new Error("NO_ACTIVE_PROJECT");
  return { statePath, state: validateProjectState(state, "ACTIVE_PROJECT"), targeted: false };
}

let output;

if (mode === "qa" || mode === "recheck") {
  const { statePath, state, targeted } = await readProjectState();
  output = {
    ok: true,
    mode: "qa",
    project: { name: state.project_name, slug: state.project_slug },
    branch: state.branch,
    source_branch: state.branch,
    project_path: state.source_path,
    preview_expected: state.preview_url || null,
    pull_request: state.pull_request ? { number: state.pull_request, url: `https://github.com/${env.GITHUB_REPOSITORY}/pull/${state.pull_request}` } : null,
    updates: [],
    active_state_path: statePath,
    targeted_project: targeted,
    production_deployed: false,
    qa_only: true,
    recovery_reused: false
  };
} else if (mode === "edit" || mode === "evolve") {
  const { statePath, state, targeted } = await readProjectState();
  const sourceBranch = state.branch;
  const stagingBranch = `factory/${state.project_slug}-edit-${recoveryKey.slice(0, 12)}`;
  const result = await evolveProjectSafely(request, env, {
    project_slug: state.project_slug,
    prompt: job.prompt,
    changes: job.changes,
    base_branch: "main",
    source_branch: sourceBranch,
    branch_name: stagingBranch,
    reuse_branch: false,
    recover_branch: true
  });

  if (!result?.ok || !Array.isArray(result.updates) || result.updates.length === 0) {
    console.error(JSON.stringify({ mode, project_state: state, edit: result }, null, 2));
    throw new Error(result?.error || "PROJECT_EDIT_NO_VERIFIED_UPDATES");
  }

  output = {
    ok: true,
    mode: "edit",
    project: { name: state.project_name, slug: state.project_slug },
    branch: result.branch,
    source_branch: sourceBranch,
    project_path: state.source_path,
    preview_expected: result.preview?.url || null,
    pull_request: result.pull_request,
    updates: result.updates,
    active_state_path: statePath,
    targeted_project: targeted,
    production_deployed: false,
    qa_only: false,
    recovery_reused: result.recovery_reused === true
  };
} else {
  let blueprint;
  let analysis = null;
  if (mode === "generate") {
    blueprint = buildGenerateBlueprint(job);
  } else if (mode === "rebuild") {
    analysis = await analyzePublicWebsite({ source_url: job.source_url, max_pages: job.max_pages });
    if (!analysis?.ok) throw new Error(analysis?.error || "REBUILD_ANALYSIS_FAILED");
    blueprint = buildRebuildBlueprint(analysis, {
      project_name: job.project_name,
      project_slug: job.project_slug,
      positioning: job.positioning,
      style: job.style || {}
    });
  }

  if (blueprint?.error) throw new Error(blueprint.error);
  const result = await materializeProject(request, env, {
    blueprint,
    project_name: job.project_name || blueprint.project?.name,
    project_slug: job.project_slug || blueprint.project?.slug,
    base_branch: "main",
    branch_name: job.branch_name,
    recovery_key: recoveryKey
  });
  if (!result?.ok) {
    console.error(JSON.stringify({ mode, analysis, blueprint, materialization: result }, null, 2));
    throw new Error(result?.error || "MATERIALIZATION_FAILED");
  }
  output = {
    ok: true,
    mode,
    project: blueprint.project,
    branch: result.branch,
    source_branch: "",
    project_path: result.project_path,
    preview_expected: result.preview?.url || null,
    pull_request: result.pull_request,
    targeted_project: false,
    production_deployed: false,
    qa_only: false,
    recovery_reused: result.recovery?.reused_branch === true || result.recovery?.reused_pull_request === true
  };
}

console.log(JSON.stringify(output, null, 2));

if (process.env.GITHUB_OUTPUT) {
  const lines = [
    `branch=${output.branch || ""}`,
    `source_branch=${output.source_branch || ""}`,
    `project_slug=${output.project?.slug || ""}`,
    `project_path=${output.project_path || ""}`,
    `pr_url=${output.pull_request?.url || ""}`,
    `qa_only=${output.qa_only ? "true" : "false"}`,
    `targeted_project=${output.targeted_project ? "true" : "false"}`,
    `recovery_reused=${output.recovery_reused ? "true" : "false"}`
  ];
  await fs.appendFile(process.env.GITHUB_OUTPUT, `${lines.join("\n")}\n`);
}
