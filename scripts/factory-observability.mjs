const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
const repository = process.env.GITHUB_REPOSITORY;
const controlRef = 'factory-control';
const STALE_JOB_MS = 45 * 60 * 1000;

function headers() {
  if (!token) throw new Error('GITHUB_TOKEN_REQUIRED');
  if (!repository || !repository.includes('/')) throw new Error('GITHUB_REPOSITORY_REQUIRED');
  return { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28', 'content-type': 'application/json' };
}

function increment(map, key, amount = 1) { if (key) map[key] = Number(map[key] || 0) + amount; }
function round(value, digits = 1) { const factor = 10 ** digits; return Math.round(Number(value || 0) * factor) / factor; }
function average(total, count) { return count > 0 ? round(total / count) : 0; }
function jobEvents(job) { return Array.isArray(job?.events) ? job.events : []; }

function resilienceState(job, nowMs) {
  const status = String(job?.status || 'UNKNOWN');
  if (['READY_FOR_REVIEW', 'WORKSHOP_REQUIRED', 'FAILED'].includes(status)) return { stale: false, recoverable: false };
  const updatedMs = Date.parse(String(job?.updated_at || job?.created_at || ''));
  const stale = Number.isFinite(updatedMs) && nowMs - updatedMs >= STALE_JOB_MS;
  return { stale, recoverable: stale };
}

export function buildObservabilitySnapshot(jobs = [], options = {}) {
  const statusCounts = {};
  const failureCodes = {};
  const repairProfiles = {};
  const failureKinds = {};
  const recoveryReasons = {};
  let qaAttemptEvents = 0, qaPassedEvents = 0, qaFailedEvents = 0, qaCacheReuses = 0;
  let fulfillmentChecks = 0, fulfillmentFailures = 0, repairEvents = 0;
  let jobsRecoveredByRepair = 0, jobsWithRepair = 0, previewMs = 0, qaMs = 0, repairMs = 0;
  let previewSamples = 0, qaSamples = 0, repairSamples = 0;
  let staleJobs = 0, recoverableJobs = 0, recoveryStarts = 0, recoveredJobs = 0;
  const nowMs = Date.parse(String(options.generated_at || '')) || Date.now();

  for (const job of jobs) {
    increment(statusCounts, String(job?.status || 'UNKNOWN'));
    increment(failureKinds, String(job?.failure_kind || ''));
    increment(recoveryReasons, String(job?.recovery_reason || ''));
    const resilience = resilienceState(job, nowMs);
    if (resilience.stale) staleJobs += 1;
    if (resilience.recoverable) recoverableJobs += 1;
    if (job?.recovery_status === 'recovered') recoveredJobs += 1;

    const events = jobEvents(job);
    const repairs = events.filter((event) => event?.type === 'REPAIR_RESULT' && event?.outcome === 'committed');
    if (repairs.length) { jobsWithRepair += 1; if (job?.status === 'READY_FOR_REVIEW') jobsRecoveredByRepair += 1; }

    for (const event of events) {
      const durations = event?.durations_ms || {};
      if (event?.type === 'RECOVERY_STARTED') recoveryStarts += 1;
      if (event?.type === 'QA_ATTEMPT_RESULT') {
        qaAttemptEvents += 1;
        if (event?.outcome === 'passed') qaPassedEvents += 1; else qaFailedEvents += 1;
        for (const code of event?.issue_codes || []) increment(failureCodes, code);
        if (Number.isFinite(Number(durations.preview_ms))) { previewMs += Number(durations.preview_ms); previewSamples += 1; }
        if (Number.isFinite(Number(durations.qa_ms))) { qaMs += Number(durations.qa_ms); qaSamples += 1; }
      }
      if (event?.type === 'QA_CACHE_REUSED') qaCacheReuses += 1;
      if (event?.type === 'FULFILLMENT_RESULT') {
        fulfillmentChecks += 1;
        if (event?.outcome !== 'passed') fulfillmentFailures += 1;
        for (const code of event?.issue_codes || []) increment(failureCodes, code);
      }
      if (event?.type === 'REPAIR_RESULT' && event?.outcome === 'committed') {
        repairEvents += 1;
        for (const profile of event?.repair_profiles || []) increment(repairProfiles, profile);
        if (Number.isFinite(Number(durations.repair_ms))) { repairMs += Number(durations.repair_ms); repairSamples += 1; }
      }
    }
  }

  const totalJobs = jobs.length;
  const readyJobs = Number(statusCounts.READY_FOR_REVIEW || 0);
  const failedJobs = Number(statusCounts.FAILED || 0);
  const workshopJobs = Number(statusCounts.WORKSHOP_REQUIRED || 0);
  const terminalJobs = readyJobs + failedJobs + workshopJobs;
  return {
    version: 3,
    factory_version: options.factory_version || '3.4',
    generated_at: options.generated_at || new Date().toISOString(),
    production_deploy: false,
    sample: {
      jobs_total: totalJobs, jobs_ready_for_review: readyJobs, jobs_workshop_required: workshopJobs, jobs_failed: failedJobs,
      terminal_success_rate_pct: terminalJobs > 0 ? round((readyJobs / terminalJobs) * 100) : 0,
      jobs_with_auto_repair: jobsWithRepair, jobs_recovered_by_auto_repair: jobsRecoveredByRepair,
      auto_repair_recovery_rate_pct: jobsWithRepair > 0 ? round((jobsRecoveredByRepair / jobsWithRepair) * 100) : 0
    },
    resilience: {
      stale_nonterminal_jobs: staleJobs,
      safely_recoverable_jobs: recoverableJobs,
      recovery_starts: recoveryStarts,
      recovered_jobs: recoveredJobs,
      failure_kinds: Object.fromEntries(Object.entries(failureKinds).sort((a,b) => b[1]-a[1] || a[0].localeCompare(b[0]))),
      recovery_reasons: Object.fromEntries(Object.entries(recoveryReasons).sort((a,b) => b[1]-a[1] || a[0].localeCompare(b[0])))
    },
    qa: { attempt_events: qaAttemptEvents, passed_attempts: qaPassedEvents, nonpassing_attempts: qaFailedEvents, cache_reuses: qaCacheReuses, average_preview_ms: average(previewMs, previewSamples), average_qa_ms: average(qaMs, qaSamples) },
    fulfillment: { checks: fulfillmentChecks, failures: fulfillmentFailures, pass_rate_pct: fulfillmentChecks > 0 ? round(((fulfillmentChecks - fulfillmentFailures) / fulfillmentChecks) * 100) : 0 },
    repair: { committed_repairs: repairEvents, average_repair_ms: average(repairMs, repairSamples), profiles: Object.fromEntries(Object.entries(repairProfiles).sort((a,b) => b[1]-a[1] || a[0].localeCompare(b[0]))) },
    failures: { codes: Object.fromEntries(Object.entries(failureCodes).sort((a,b) => b[1]-a[1] || a[0].localeCompare(b[0]))) },
    statuses: Object.fromEntries(Object.entries(statusCounts).sort((a,b) => b[1]-a[1] || a[0].localeCompare(b[0])))
  };
}

async function github(path, options = {}) {
  const response = await fetch(`https://api.github.com${path}`, { headers: headers(), ...options });
  if (!response.ok) throw new Error(`OBSERVABILITY_GITHUB_${response.status}:${(await response.text()).slice(0,360)}`);
  return response.json();
}

async function readJobs() {
  const files = await github(`/repos/${repository}/contents/factory-state/jobs?ref=${encodeURIComponent(controlRef)}`);
  const jsonFiles = Array.isArray(files) ? files.filter((item) => item.type === 'file' && item.name.endsWith('.json')).slice(0, 200) : [];
  const jobs = [];
  for (const file of jsonFiles) {
    const body = await github(`/repos/${repository}/contents/${file.path}?ref=${encodeURIComponent(controlRef)}`);
    try { jobs.push(JSON.parse(Buffer.from(body.content, 'base64').toString('utf8'))); } catch {}
  }
  return jobs;
}

async function writeSnapshot(snapshot) {
  const path = 'factory-state/observability.json';
  for (let attempt = 1; attempt <= 4; attempt++) {
    let sha = null;
    const existing = await fetch(`https://api.github.com/repos/${repository}/contents/${path}?ref=${encodeURIComponent(controlRef)}`, { headers: headers() });
    if (existing.ok) sha = (await existing.json()).sha;
    else if (existing.status !== 404) throw new Error(`OBSERVABILITY_READ_${existing.status}:${(await existing.text()).slice(0,240)}`);
    const payload = { message: 'Factory: refresh observability snapshot', branch: controlRef, content: Buffer.from(`${JSON.stringify(snapshot, null, 2)}\n`).toString('base64') };
    if (sha) payload.sha = sha;
    const response = await fetch(`https://api.github.com/repos/${repository}/contents/${path}`, { method: 'PUT', headers: headers(), body: JSON.stringify(payload) });
    if (response.ok) return;
    if (response.status !== 409 || attempt === 4) throw new Error(`OBSERVABILITY_WRITE_${response.status}:${(await response.text()).slice(0,360)}`);
  }
}

export async function refreshObservabilitySnapshot() {
  const jobs = await readJobs();
  const snapshot = buildObservabilitySnapshot(jobs);
  await writeSnapshot(snapshot);
  return snapshot;
}

if (process.argv[1]?.endsWith('factory-observability.mjs')) {
  const dryRun = process.argv.includes('--dry-run');
  const jobs = await readJobs();
  const snapshot = buildObservabilitySnapshot(jobs);
  if (!dryRun) await writeSnapshot(snapshot);
  console.log(JSON.stringify(snapshot, null, 2));
}
