import fs from "node:fs/promises";
import crypto from "node:crypto";

const projectSha = process.argv[2];
const qaScriptPath = process.argv[3] || ".factory-runtime/visual-qa.mjs";
const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
const repository = process.env.GITHUB_REPOSITORY;
const qaOnly = String(process.env.QA_ONLY || "false").toLowerCase() === "true";

if (!projectSha) throw new Error("PROJECT_SHA_REQUIRED");
if (!token) throw new Error("GITHUB_TOKEN_REQUIRED");
if (!repository || !repository.includes("/")) throw new Error("GITHUB_REPOSITORY_REQUIRED");

const headers = {
  authorization: `Bearer ${token}`,
  accept: "application/vnd.github+json",
  "x-github-api-version": "2022-11-28"
};

async function github(path) {
  const response = await fetch(`https://api.github.com${path}`, { headers });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GITHUB_API_${response.status}:${body.slice(0, 500)}`);
  }
  return response.json();
}

const qaScript = await fs.readFile(qaScriptPath);
const qaHash = crypto.createHash("sha256").update(qaScript).digest("hex").slice(0, 12);
const qaContext = `factory-control/visual-qa-${qaHash}`;

const now = new Date();
const year = now.getUTCFullYear();
const month = String(now.getUTCMonth() + 1).padStart(2, "0");
const day = String(now.getUTCDate()).padStart(2, "0");
const created = encodeURIComponent(`${year}-${month}-01..${year}-${month}-${day}`);

const workflowRuns = await github(`/repos/${repository}/actions/workflows/factory-control.yml/runs?per_page=1&created=${created}`);
const monthlyRuns = Number(workflowRuns.total_count || 0);

const statuses = await github(`/repos/${repository}/commits/${projectSha}/statuses?per_page=100`);
const previous = statuses.find((status) => status.context === qaContext && status.state === "success" && status.target_url);
const duplicate = Boolean(qaOnly && previous);
const existingUrl = previous?.target_url || "";

let usageLevel = "normal";
if (monthlyRuns >= 450) usageLevel = "critical";
else if (monthlyRuns >= 350) usageLevel = "warning";

if (usageLevel === "warning") {
  console.log(`::warning::Factory usage guard: ${monthlyRuns} Factory Control runs this month. Soft warning threshold is 350.`);
}
if (usageLevel === "critical") {
  console.log(`::warning::Factory usage guard: ${monthlyRuns} Factory Control runs this month. Critical threshold is 450.`);
}

if (qaOnly && monthlyRuns >= 475 && !duplicate) {
  console.error(`::error::Factory usage guard stopped a new QA-only preview at ${monthlyRuns} monthly runs. Manual review or a new month is required.`);
  process.exit(78);
}

if (duplicate) {
  console.log(`Factory usage guard: identical QA already passed for project ${projectSha} with ${qaContext}; expensive preview/QA work can be skipped.`);
}

const result = {
  project_sha: projectSha,
  qa_context: qaContext,
  qa_hash: qaHash,
  monthly_factory_control_runs: monthlyRuns,
  usage_level: usageLevel,
  qa_only: qaOnly,
  duplicate,
  existing_url: existingUrl,
  thresholds: { warning: 350, critical: 450, qa_only_stop: 475 }
};

console.log(JSON.stringify(result, null, 2));

if (process.env.GITHUB_OUTPUT) {
  const lines = [
    `qa_context=${qaContext}`,
    `monthly_runs=${monthlyRuns}`,
    `usage_level=${usageLevel}`,
    `duplicate=${duplicate ? "true" : "false"}`,
    `existing_url=${existingUrl}`
  ];
  await fs.appendFile(process.env.GITHUB_OUTPUT, `${lines.join("\n")}\n`);
}
