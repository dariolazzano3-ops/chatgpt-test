import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { superviseMission } from '../src/mission-supervisor.js';
import { validateMissionPersistence } from '../src/mission-persistence-guard.js';
import { resolveAndValidateSourceOfTruth } from '../src/source-of-truth.js';

const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
const repository = process.env.GITHUB_REPOSITORY;
const controlRef = 'factory-control';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const headers = () => ({ authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28', 'content-type': 'application/json' });
const flag = (name, fallback = null) => { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] : fallback; };
const boolFlag = (name) => String(flag(name, 'false')).toLowerCase() === 'true';
const stable = (value) => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])])) : value;
const fingerprint = (value) => crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');

if (!token) throw new Error('GITHUB_TOKEN_REQUIRED');
if (!repository?.includes('/')) throw new Error('GITHUB_REPOSITORY_REQUIRED');

async function readRemoteJson(file, required = true) {
  const response = await fetch(`https://api.github.com/repos/${repository}/contents/${file}?ref=${encodeURIComponent(controlRef)}`, { headers: headers() });
  if (response.status === 404 && !required) return { sha: null, value: null };
  if (!response.ok) throw new Error(`REMOTE_READ_FAILED_${response.status}:${file}`);
  const body = await response.json();
  return { sha: body.sha, value: JSON.parse(Buffer.from(body.content, 'base64').toString('utf8')) };
}

async function readBranchHead(branch) {
  if (!branch) throw new Error('SOURCE_BRANCH_REQUIRED');
  const response = await fetch(`https://api.github.com/repos/${repository}/git/ref/heads/${encodeURIComponent(branch)}`, { headers: headers() });
  if (!response.ok) throw new Error(`SOURCE_BRANCH_READ_FAILED_${response.status}`);
  const body = await response.json();
  return body.object?.sha || null;
}

async function writeRemoteJson(file, value, sha, message) {
  const payload = { message, branch: controlRef, content: Buffer.from(`${JSON.stringify(value, null, 2)}\n`).toString('base64') };
  if (sha) payload.sha = sha;
  const response = await fetch(`https://api.github.com/repos/${repository}/contents/${file}`, { method: 'PUT', headers: headers(), body: JSON.stringify(payload) });
  if (!response.ok) throw new Error(`REMOTE_WRITE_FAILED_${response.status}:${file}:${(await response.text()).slice(0, 240)}`);
  return response.json();
}

async function persistMission(file, mission, metadata = {}) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const current = await readRemoteJson(file, false);
    if (!current.value) return { ok: false, code: 'REMOTE_MISSION_NOT_FOUND', retryable: false };
    const guard = validateMissionPersistence(current.value, mission, metadata);
    if (!guard.ok) return guard;
    try {
      const written = await writeRemoteJson(file, mission, current.sha, `Mission ${mission.mission_id}: ${metadata.reason}:${metadata.task_id || 'mission'}`);
      return { ok: true, commit_sha: written.commit?.sha || null, content_sha: written.content?.sha || null };
    }
    catch (error) {
      if (!String(error.message).includes('409')) throw error;
      if (attempt === 3) return { ok: false, code: 'MISSION_PERSIST_CONFLICT', retryable: true };
      await sleep(700);
    }
  }
  return { ok: false, code: 'MISSION_PERSIST_CONFLICT', retryable: true };
}

async function ensureWebRequest(request, contract) {
  const jobId = fingerprint(request);
  const requestFile = `factory-requests/mission-${contract.mission_id}-${contract.task_id}-${jobId.slice(0, 10)}.json`;
  const existing = await readRemoteJson(requestFile, false);
  if (!existing.value) await writeRemoteJson(requestFile, request, null, `Mission ${contract.mission_id}: queue ${contract.task_id}`);
  return { job_id: jobId, request_ref: requestFile, production_deploy: false };
}

async function observeWebJob(jobId, timeoutMs, pollMs) {
  const started = Date.now();
  do {
    const remote = await readRemoteJson(`factory-state/jobs/${jobId}.json`, false);
    if (remote.value && ['READY_FOR_REVIEW', 'FAILED', 'FAIL_SAFE', 'WORKSHOP_REQUIRED'].includes(String(remote.value.status || '').toUpperCase())) return remote.value;
    if (timeoutMs <= 0) return null;
    await sleep(pollMs);
  } while (Date.now() - started < timeoutMs);
  return null;
}

async function loadAIRunner(modulePath) {
  if (!modulePath) return null;
  if (!/^scripts\/ai-runners\/[a-zA-Z0-9._/-]+\.mjs$/.test(modulePath)) throw new Error('UNSAFE_AI_RUNNER_MODULE_PATH');
  const absolute = path.resolve(process.cwd(), modulePath);
  const module = await import(pathToFileURL(absolute).href);
  const runner = module.default || module.runAI || module.runner;
  if (typeof runner !== 'function') throw new Error('AI_RUNNER_MODULE_INVALID');
  return runner;
}

const missionFile = flag('mission');
const contractsFile = flag('contracts');
const aiRunnerModule = flag('ai-runner-module');
const timeoutMs = Math.max(0, Number(flag('web-timeout-ms', '0')) || 0);
const pollMs = Math.max(5000, Number(flag('web-poll-ms', '15000')) || 15000);
if (!missionFile || !/^factory-state\/missions\/[a-zA-Z0-9._-]+\.json$/.test(missionFile)) throw new Error('SAFE_MISSION_PATH_REQUIRED');
if (contractsFile && !/^factory-state\/mission-contracts\/[a-zA-Z0-9._-]+\.json$/.test(contractsFile)) throw new Error('UNSAFE_CONTRACTS_PATH');

const remoteMission = await readRemoteJson(missionFile, true);
const sourceOfTruth = await resolveAndValidateSourceOfTruth(remoteMission.value.source_of_truth || {}, {
  resolve_project_head: (context) => readBranchHead(context.canonical_branch || context.baseline_branch)
});
if (!sourceOfTruth.ok) {
  console.log(JSON.stringify({ ok: false, error: sourceOfTruth.code || 'SOURCE_OF_TRUTH_BLOCKED', source_of_truth: sourceOfTruth, production_deploy: false }, null, 2));
  process.exit(1);
}
const config = contractsFile ? (await readRemoteJson(contractsFile, true)).value : {};
const aiRunner = await loadAIRunner(aiRunnerModule);
const approvals = {
  web: { authorized: boolFlag('approve-web'), production_deploy: false },
  automation: { authorized: boolFlag('approve-automation'), production_deploy: false },
  ai: { authorized: boolFlag('approve-ai'), production_deploy: false },
  business: { authorized: boolFlag('approve-business'), production_deploy: false }
};

const result = await superviseMission(remoteMission.value, approvals, {
  max_rounds: Number(flag('max-rounds', '20')) || 20,
  automation_contracts: config.automation_contracts || {},
  business_contracts: config.business_contracts || {},
  ai_contracts: config.ai_contracts || {},
  web: config.web || {},
  ai: { ...(config.ai || {}), ...(aiRunner ? { runner: aiRunner } : {}) },
  dispatch_web: async ({ request, contract }) => ensureWebRequest({ ...request, production_deploy: false }, contract),
  observe_web: async ({ job_id }) => observeWebJob(job_id, timeoutMs, pollMs),
  persist: async (mission, metadata) => persistMission(missionFile, mission, metadata)
});

console.log(JSON.stringify({
  ok: result.ok,
  mission_id: result.mission_id,
  mission_status: result.mission_status,
  completed: result.completed,
  pending_web_tasks: result.pending_web_tasks,
  ready_but_not_executed: result.ready_but_not_executed,
  production_deploy: false,
  automatic_multi_factory_execution: false,
  supervision_required: true,
  source_of_truth: sourceOfTruth
}, null, 2));

if (!result.ok) process.exit(1);
if (!result.completed) process.exitCode = 2;
