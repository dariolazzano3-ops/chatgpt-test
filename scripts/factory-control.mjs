import fs from "node:fs/promises";
import { buildGenerateBlueprint } from "../src/generator.js";
import { analyzePublicWebsite } from "../src/scraper.js";
import { buildRebuildBlueprint } from "../src/builder.js";
import { materializeProject } from "../src/materializer.js";

const requestPath = process.argv[2];
if (!requestPath) throw new Error("REQUEST_FILE_REQUIRED");

const raw = await fs.readFile(requestPath, "utf8");
const job = JSON.parse(raw);
const mode = String(job.mode || "generate").toLowerCase();
const internalToken = `actions-${process.env.GITHUB_RUN_ID || Date.now()}`;
const request = new Request("https://factory-control.local/run", {
  headers: { authorization: `Bearer ${internalToken}` }
});
const env = {
  API_TOKEN: internalToken,
  GITHUB_TOKEN: process.env.GITHUB_TOKEN,
  GITHUB_REPOSITORY: process.env.GITHUB_REPOSITORY
};

if (!env.GITHUB_TOKEN) throw new Error("GITHUB_TOKEN_REQUIRED");

let blueprint;
let analysis = null;
if (mode === "generate") {
  blueprint = buildGenerateBlueprint(job);
} else if (mode === "rebuild") {
  if (!job.source_url) throw new Error("SOURCE_URL_REQUIRED");
  analysis = await analyzePublicWebsite({
    source_url: job.source_url,
    max_pages: job.max_pages
  });
  if (!analysis?.ok) throw new Error(analysis?.error || "REBUILD_ANALYSIS_FAILED");
  blueprint = buildRebuildBlueprint(analysis, {
    project_name: job.project_name,
    project_slug: job.project_slug,
    positioning: job.positioning,
    style: job.style || {}
  });
} else {
  throw new Error(`UNSUPPORTED_MODE:${mode}`);
}

if (blueprint?.error) throw new Error(blueprint.error);

const result = await materializeProject(request, env, {
  blueprint,
  project_name: job.project_name || blueprint.project?.name,
  project_slug: job.project_slug || blueprint.project?.slug,
  base_branch: job.base_branch || "main",
  branch_name: job.branch_name
});

if (!result?.ok) {
  console.error(JSON.stringify({ mode, analysis, blueprint, materialization: result }, null, 2));
  throw new Error(result?.error || "MATERIALIZATION_FAILED");
}

const output = {
  ok: true,
  mode,
  project: blueprint.project,
  branch: result.branch,
  project_path: result.project_path,
  preview_expected: result.preview?.url || null,
  pull_request: result.pull_request,
  production_deployed: false
};
console.log(JSON.stringify(output, null, 2));

if (process.env.GITHUB_OUTPUT) {
  const lines = [
    `branch=${result.branch}`,
    `project_slug=${blueprint.project?.slug || ""}`,
    `project_path=${result.project_path || ""}`,
    `pr_url=${result.pull_request?.url || ""}`
  ];
  await fs.appendFile(process.env.GITHUB_OUTPUT, `${lines.join("\n")}\n`);
}
