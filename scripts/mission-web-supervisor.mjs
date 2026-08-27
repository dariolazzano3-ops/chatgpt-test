import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { prepareMissionTaskDispatch, reconcileMissionTaskFromWebJob } from '../src/mission-execution-bridge.js';

const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
const repository = process.env.GITHUB_REPOSITORY;
const controlRef = 'factory-control';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const headers = () => ({ authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28', 'content-type': 'application/json' });
const stable = (value) => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])])) : value;
const fingerprint = (value) => crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
const flag = (name, fallback = null) => { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] : fallback; };

if (!token) throw new Error('GITHUB_TOKEN_REQUIRED');
if (!repository?.includes('/')) throw new Error('GITHUB_REPOSITORY_REQUIRED');

async function readRemoteJson(file, required = true) {
  const response = await fetch(`https://api.github.com/repos/${repository}/contents/${file}?ref=${encodeURIComponent(controlRef)}`, { headers: headers() });
  if (response.status === 404 && !required) return { sha: null, value: null };
  if (!response.ok) throw new Error(`REMOTE_READ_FAILED_${response.status}:${file}`);
  const body = await response.json();
  return { sha: body.sha, value: JSON.parse(Buffer.from(body.content, 'base64').toString('utf8')) };
}

async function writeRemoteJson(file, value, sha, message) {
  const payload = { message, branch: controlRef, content: Buffer.from(`${JSON.stringify(value, null, 2)}\n`).toString('base64') };
  if (sha) payload.sha = sha;
  const response = await fetch(`https://api.github.com/repos/${repository}/contents/${file}`, { method: 'PUT', headers: headers(), body: JSON.stringify(payload) });
  if (!response.ok) throw new Error(`REMOTE_WRITE_FAILED_${response.status}:${file}:${(await response.text()).slice(0,240)}`);
  return response.json();
}

async function persistMission(file, mission, message) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const current = await readRemoteJson(file, false);
    try { return await writeRemoteJson(file, mission, current.sha, message); }
    catch (error) { if (!String(error.message).includes('409') || attempt === 3) throw error; await sleep(700); }
  }
}

async function waitForJob(jobId, timeoutMs, pollMs) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const remote = await readRemoteJson(`factory-state/jobs/${jobId}.json`, false);
    const job = remote.value;
    if (job && ['READY_FOR_REVIEW', 'FAILED', 'WORKSHOP_REQUIRED'].includes(String(job.status))) return job;
    await sleep(pollMs);
  }
  return null;
}

const missionFile = flag('mission');
const taskId = flag('task');
const projectSlug = flag('project-slug');
const projectName = flag('project-name');
const sourceUrl = flag('source-url');
const timeoutMs = Math.max(60_000, Number(flag('timeout-ms', '1200000')) || 1200000);
const pollMs = Math.max(5_000, Number(flag('poll-ms', '15000')) || 15000);
if (!missionFile || !taskId) throw new Error('MISSION_AND_TASK_REQUIRED');
if (!/^factory-state\/missions\/[a-zA-Z0-9._-]+\.json$/.test(missionFile)) throw new Error('UNSAFE_MISSION_PATH');

const remoteMission = await readRemoteJson(missionFile, true);
const prepared = prepareMissionTaskDispatch(remoteMission.value, taskId, { authorized: true, production_deploy: false }, { project_slug: projectSlug, project_name: projectName, source_url: sourceUrl });
if (!prepared.ok) throw new Error(prepared.error);

const request = { ...prepared.factory_request, mission_id: prepared.contract.mission_id, mission_task_id: taskId, production_deploy: false };
const jobId = fingerprint(request);
request.mission_job_id = jobId;
const requestFile = `factory-requests/mission-${prepared.contract.mission_id}-${taskId}-${jobId.slice(0,10)}.json`;
const mission = prepared.mission;
const task = mission.tasks.find((item) => item.task_id === taskId);
task.external_job_id = jobId;
task.inputs = { ...(task.inputs || {}), factory_request_file: requestFile };
await persistMission(missionFile, mission, `Mission ${prepared.contract.mission_id}: dispatch ${taskId}`);

const existing = await readRemoteJson(requestFile, false);
if (!existing.value) await writeRemoteJson(requestFile, request, null, `Mission ${prepared.contract.mission_id}: queue ${taskId}`);

const job = await waitForJob(jobId, timeoutMs, pollMs);
if (!job) {
  console.log(JSON.stringify({ ok: false, pending: true, mission_id: prepared.contract.mission_id, task_id: taskId, job_id: jobId, request_file: requestFile, production_deploy: false }, null, 2));
  process.exit(2);
}

for (let attempt = 0; attempt < 4; attempt++) {
  const latest = await readRemoteJson(missionFile, true);
  const reconciled = reconcileMissionTaskFromWebJob(latest.value, taskId, job);
  if (!reconciled.ok) throw new Error(reconciled.error);
  if (reconciled.pending) throw new Error('TERMINAL_JOB_RECONCILED_AS_PENDING');
  try {
    await writeRemoteJson(missionFile, reconciled.mission, latest.sha, `Mission ${prepared.contract.mission_id}: reconcile ${taskId}`);
    console.log(JSON.stringify({ ok: true, mission_id: prepared.contract.mission_id, mission_status: reconciled.mission.status, task_id: taskId, task_status: reconciled.mission.tasks.find((item) => item.task_id === taskId)?.state || null, job_id: jobId, job_status: job.status, preview_url: job.preview_url || null, production_deploy: false }, null, 2));
    process.exit(0);
  } catch (error) {
    if (!String(error.message).includes('409') || attempt === 3) throw error;
    await sleep(700);
  }
}
