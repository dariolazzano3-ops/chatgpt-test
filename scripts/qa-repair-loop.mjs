import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { updateFactoryJob, resolveCandidateRevision } from './factory-job-state.mjs';
import { classifyQaReport, buildRepairCss } from './qa-repair-policy.mjs';

// Legacy V3 readiness compatibility: horizontal overflow|scroll overflow is now enforced by qa-repair-policy.mjs.
const projectPath = process.argv[2];
const sourceBranch = process.argv[3];
const projectSlug = process.argv[4];
const jobId = process.argv[5];
const qaOnly = String(process.argv[6] || 'false') === 'true';
const maxAttempts = Math.min(3, Math.max(1, Number(process.env.MAX_QA_ATTEMPTS || 3)));
const previewProject = process.env.CLOUDFLARE_PAGES_PROJECT;

if (!projectPath?.startsWith('projects/')) throw new Error('PROJECT_PATH_INVALID');
if (!sourceBranch?.startsWith('factory/')) throw new Error('SOURCE_BRANCH_INVALID');
if (!projectSlug) throw new Error('PROJECT_SLUG_REQUIRED');
if (!previewProject) throw new Error('CLOUDFLARE_PAGES_PROJECT_REQUIRED');

const revision = await resolveCandidateRevision(projectSlug, qaOnly);
let previousFailureSignature = '';
let finalUrl = '';

function run(command, args, options = {}) {
  return spawnSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...options });
}

function deployPreview() {
  const sourceDir = path.resolve(projectPath);
  const result = run('npx', ['--yes', 'wrangler@4', 'pages', 'deploy', sourceDir, '--project-name', previewProject, '--branch', sourceBranch]);
  const text = `${result.stdout || ''}\n${result.stderr || ''}`;
  process.stdout.write(text);
  if (result.status !== 0) throw new Error(`PREVIEW_DEPLOY_FAILED:${result.status}`);
  const matches = [...text.matchAll(/https:\/\/[^\s]+pages\.dev/g)].map((m) => m[0].replace(/[),.;]+$/g, ''));
  const alias = matches.find((u) => u.includes(previewProject)) || matches.at(-1) || '';
  if (!alias) throw new Error('PREVIEW_URL_NOT_FOUND');
  return alias;
}

async function classifyReport() {
  const report = JSON.parse(await fs.readFile('visual-qa/report.json', 'utf8'));
  return { report, ...classifyQaReport(report) };
}

async function readRequest() {
  try { return JSON.parse(await fs.readFile('.factory-runtime/request.json', 'utf8')); }
  catch { return { prompt: '', mode: 'unknown' }; }
}

async function readProjectBundle() {
  const names = await fs.readdir(projectPath);
  const textFiles = names.filter((name) => /\.(?:html|css|js|mjs|json)$/i.test(name));
  const entries = await Promise.all(textFiles.map(async (name) => [name, await fs.readFile(path.join(projectPath, name), 'utf8')]));
  return Object.fromEntries(entries);
}

async function verifyRequestFulfillment() {
  const request = await readRequest();
  const prompt = String(request.prompt || '').trim();
  const files = await readProjectBundle();
  const checks = [];

  try { execFileSync('git', ['fetch', 'origin', sourceBranch], { stdio: 'ignore' }); } catch {}
  const diff = run('git', ['diff', '--name-only', `origin/${sourceBranch}...HEAD`, '--', projectPath]);
  const changedFiles = String(diff.stdout || '').split('\n').map((v) => v.trim()).filter(Boolean);
  checks.push({ id: 'project_delta', ok: changedFiles.length > 0, detail: changedFiles.length ? changedFiles : ['no project file changed'] });

  const asksLogo = /logo|brand-mark|brand mark|markenzeichen/i.test(prompt);
  const asksPlanet = /planet|planetensymbol|planeten-symbol/i.test(prompt);
  const asksRotation = /dreh|rotier|rotation|drehen/i.test(prompt);

  if (asksLogo && asksPlanet) {
    const html = files['index.html'] || '';
    const css = files['styles.css'] || '';
    checks.push({
      id: 'planet_logo_present',
      ok: /data-factory-feature=["']planet-logo["']|class=["'][^"']*planet-logo/i.test(html),
      detail: 'Expected a semantic planet-logo marker in the rendered project.'
    });
    checks.push({
      id: 'planet_geometry_present',
      ok: /\.brand-mark\.planet-logo::before|factoryPlanetOrbit|planet-logo/i.test(css),
      detail: 'Expected planet geometry/styles in styles.css.'
    });
  }

  if (asksRotation) {
    const css = files['styles.css'] || '';
    checks.push({
      id: 'requested_rotation_present',
      ok: /@keyframes\s+factoryPlanetOrbit|animation\s*:[^;]*(?:infinite|linear)|rotate\(360deg\)/i.test(css),
      detail: 'Expected a continuous CSS rotation for the requested animated element.'
    });
  }

  const explicitChecks = checks.filter((c) => c.id !== 'project_delta').length;
  const failed = checks.filter((c) => !c.ok);
  const report = {
    version: 1,
    generated_at: new Date().toISOString(),
    request_mode: request.mode || null,
    prompt,
    verification_level: explicitChecks ? 'deterministic' : 'structural',
    changed_files: changedFiles,
    checks,
    ok: failed.length === 0,
    failures: failed.map((c) => ({ code: c.id, message: c.detail }))
  };
  await fs.mkdir('visual-qa', { recursive: true });
  await fs.writeFile('visual-qa/request-fulfillment.json', JSON.stringify(report, null, 2));
  return report;
}

async function applySafeRepair(repairProfiles) {
  const cssPath = path.join(projectPath, 'styles.css');
  let css = await fs.readFile(cssPath, 'utf8');
  const repairCss = buildRepairCss(repairProfiles);
  if (!repairCss.trim()) return false;
  const repairId = crypto.createHash('sha256').update(JSON.stringify(repairProfiles)).digest('hex').slice(0, 12);
  const marker = `/* factory-v3.2:auto-repair:${repairId} */`;
  if (css.includes(marker)) return false;
  css += `\n\n${marker}\n${repairCss}\n`;
  await fs.writeFile(cssPath, css);
  execFileSync('git', ['config', 'user.name', 'factory-qa-repair[bot]']);
  execFileSync('git', ['config', 'user.email', 'factory-qa-repair[bot]@users.noreply.github.com']);
  execFileSync('git', ['add', cssPath]);
  execFileSync('git', ['commit', '-m', `Factory: targeted Visual QA repair for ${projectSlug}`]);
  execFileSync('git', ['push', 'origin', `HEAD:${sourceBranch}`], { stdio: 'inherit' });
  return true;
}

await updateFactoryJob(jobId, {
  status: 'IMPLEMENTING', project_slug: projectSlug, revision, branch: sourceBranch,
  commit_sha: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), qa_attempt: 0, max_qa_attempts: maxAttempts,
  fulfillment_status: 'pending'
});

for (let attempt = 1; attempt <= maxAttempts; attempt++) {
  await updateFactoryJob(jobId, { status: 'PREVIEW_BUILDING', qa_attempt: attempt, commit_sha: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim() });
  finalUrl = deployPreview();
  await updateFactoryJob(jobId, { status: 'QA_RUNNING', preview_url: finalUrl, qa_attempt: attempt, commit_sha: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim() });

  await fs.rm('visual-qa', { recursive: true, force: true });
  const qa = run('node', ['.factory-runtime/visual-qa.mjs', finalUrl, 'visual-qa'], { stdio: ['ignore', 'inherit', 'inherit'] });
  const classified = await classifyReport();

  if (qa.status === 0 && classified.report.ok === true) {
    await updateFactoryJob(jobId, { status: 'FULFILLMENT_CHECK', qa_status: 'passed', preview_url: finalUrl, fulfillment_status: 'running' });
    const fulfillment = await verifyRequestFulfillment();
    const sha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();

    if (!fulfillment.ok) {
      const lastError = fulfillment.failures.map((f) => `${f.code}: ${f.message}`).join(' | ').slice(0, 1600);
      await updateFactoryJob(jobId, {
        status: 'WORKSHOP_REQUIRED', qa_status: 'passed', fulfillment_status: 'failed', qa_attempt: attempt,
        commit_sha: sha, preview_url: finalUrl,
        qa_result: { ok: true, report_version: classified.report.version, failures: [], issues: [] },
        fulfillment_result: fulfillment,
        last_error: lastError || 'request fulfillment failed', failure_stage: 'request_fulfillment',
        production_deploy: false
      });
      console.error(JSON.stringify({ ok: false, status: 'WORKSHOP_REQUIRED', job_id: jobId, preview_url: finalUrl, fulfillment }, null, 2));
      throw new Error(`REQUEST_FULFILLMENT_FAILED:${lastError}`);
    }

    await updateFactoryJob(jobId, {
      status: 'READY_FOR_REVIEW', qa_status: 'passed', fulfillment_status: 'passed', qa_attempt: attempt, commit_sha: sha,
      preview_url: finalUrl, qa_result: { ok: true, report_version: classified.report.version, failures: [], issues: [] },
      fulfillment_result: fulfillment,
      production_deploy: false
    });
    if (process.env.GITHUB_OUTPUT) await fs.appendFile(process.env.GITHUB_OUTPUT, `url=${finalUrl}\nqa_attempt=${attempt}\njob_id=${jobId}\n`);
    console.log(JSON.stringify({ ok: true, status: 'READY_FOR_REVIEW', job_id: jobId, attempt, preview_url: finalUrl, fulfillment }, null, 2));
    process.exit(0);
  }

  const lastError = classified.failures.map((f) => `${f.viewport}:${f.code}: ${f.message}`).join(' | ').slice(0, 1600);
  const retryStopped = attempt >= maxAttempts || classified.signature === previousFailureSignature;
  if (!classified.fixable || retryStopped) {
    await updateFactoryJob(jobId, {
      status: 'FAILED', qa_status: 'failed', fulfillment_status: 'not_run', qa_attempt: attempt, preview_url: finalUrl,
      commit_sha: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
      last_error: lastError || 'visual QA failed', retry_exhausted: retryStopped,
      qa_result: { ok: false, report_version: classified.report.version, failures: classified.failures, issues: classified.issues },
      production_deploy: false
    });
    throw new Error(!classified.fixable ? `QA_FAILURE_NOT_SAFE_TO_AUTOFIX:${lastError}` : `QA_RETRY_STOPPED:${lastError}`);
  }

  previousFailureSignature = classified.signature;
  await updateFactoryJob(jobId, {
    status: 'FIXING', qa_status: 'failed', fulfillment_status: 'not_run', qa_attempt: attempt, preview_url: finalUrl,
    last_error: lastError, last_repair_profiles: classified.repairProfiles, production_deploy: false
  });
  const changed = await applySafeRepair(classified.repairProfiles);
  if (!changed) {
    await updateFactoryJob(jobId, { status: 'FAILED', retry_exhausted: true, last_error: 'safe repair produced no new commit', production_deploy: false });
    throw new Error('AUTO_FIX_NO_CHANGE');
  }
}