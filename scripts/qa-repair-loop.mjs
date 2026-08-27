import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { updateFactoryJob, recordFactoryJobEvent, resolveCandidateRevision } from './factory-job-state.mjs';
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
const loopStartedAt = Date.now();
let previousFailureSignature = '';
let finalUrl = '';

function run(command, args, options = {}) {
  return spawnSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...options });
}

function currentSha() {
  return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
}

function profileNames(profiles = []) {
  return [...new Set(profiles.map((profile) => String(profile?.type || '')).filter(Boolean))];
}

function issueCodes(issues = []) {
  return [...new Set(issues.map((issue) => String(issue?.code || '')).filter(Boolean))];
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
  commit_sha: currentSha(), qa_attempt: 0, max_qa_attempts: maxAttempts,
  __event: { type: 'QA_LOOP_STARTED', stage: 'qa_pipeline', commit_sha: currentSha() }
});

for (let attempt = 1; attempt <= maxAttempts; attempt++) {
  const attemptStartedAt = Date.now();
  await updateFactoryJob(jobId, {
    status: 'PREVIEW_BUILDING', qa_attempt: attempt, commit_sha: currentSha(),
    __event: { type: 'QA_ATTEMPT_STARTED', attempt, stage: 'preview', commit_sha: currentSha() }
  });

  const previewStartedAt = Date.now();
  finalUrl = deployPreview();
  const previewMs = Date.now() - previewStartedAt;

  await updateFactoryJob(jobId, {
    status: 'QA_RUNNING', preview_url: finalUrl, qa_attempt: attempt, commit_sha: currentSha(),
    __event: { type: 'PREVIEW_READY', attempt, stage: 'preview', outcome: 'success', preview_ms: previewMs, preview_url: finalUrl, commit_sha: currentSha() }
  });

  await fs.rm('visual-qa', { recursive: true, force: true });
  const qaStartedAt = Date.now();
  const qa = run('node', ['.factory-runtime/visual-qa.mjs', finalUrl, 'visual-qa'], { stdio: ['ignore', 'inherit', 'inherit'] });
  const qaMs = Date.now() - qaStartedAt;
  const classified = await classifyReport();
  const codes = issueCodes(classified.issues);

  if (qa.status === 0 && classified.report.ok === true) {
    const sha = currentSha();
    await updateFactoryJob(jobId, {
      status: 'READY_FOR_REVIEW', qa_status: 'passed', qa_attempt: attempt, commit_sha: sha,
      preview_url: finalUrl, qa_result: { ok: true, report_version: classified.report.version, failures: [], issues: [] },
      qa_metrics: {
        total_loop_ms: Date.now() - loopStartedAt,
        final_attempt_ms: Date.now() - attemptStartedAt,
        final_preview_ms: previewMs,
        final_qa_ms: qaMs
      },
      production_deploy: false,
      __event: {
        type: 'QA_ATTEMPT_RESULT', attempt, stage: 'qa', outcome: 'passed', preview_ms: previewMs, qa_ms: qaMs,
        total_ms: Date.now() - attemptStartedAt, preview_url: finalUrl, commit_sha: sha, issue_codes: []
      }
    });
    if (process.env.GITHUB_OUTPUT) await fs.appendFile(process.env.GITHUB_OUTPUT, `url=${finalUrl}\nqa_attempt=${attempt}\njob_id=${jobId}\n`);
    console.log(JSON.stringify({ ok: true, status: 'READY_FOR_REVIEW', job_id: jobId, attempt, preview_url: finalUrl }, null, 2));
    process.exit(0);
  }

  const lastError = classified.failures.map((f) => `${f.viewport}:${f.code}: ${f.message}`).join(' | ').slice(0, 1600);
  const retryStopped = attempt >= maxAttempts || classified.signature === previousFailureSignature;
  if (!classified.fixable || retryStopped) {
    await updateFactoryJob(jobId, {
      status: 'FAILED', qa_status: 'failed', qa_attempt: attempt, preview_url: finalUrl,
      commit_sha: currentSha(),
      last_error: lastError || 'visual QA failed', retry_exhausted: retryStopped,
      qa_result: { ok: false, report_version: classified.report.version, failures: classified.failures, issues: classified.issues },
      qa_metrics: {
        total_loop_ms: Date.now() - loopStartedAt,
        final_attempt_ms: Date.now() - attemptStartedAt,
        final_preview_ms: previewMs,
        final_qa_ms: qaMs
      },
      production_deploy: false,
      __event: {
        type: 'QA_ATTEMPT_RESULT', attempt, stage: 'qa', outcome: classified.fixable ? 'retry_stopped' : 'unsafe_failure',
        preview_ms: previewMs, qa_ms: qaMs, total_ms: Date.now() - attemptStartedAt, preview_url: finalUrl,
        commit_sha: currentSha(), issue_codes: codes, repair_profiles: profileNames(classified.repairProfiles)
      }
    });
    throw new Error(!classified.fixable ? `QA_FAILURE_NOT_SAFE_TO_AUTOFIX:${lastError}` : `QA_RETRY_STOPPED:${lastError}`);
  }

  previousFailureSignature = classified.signature;
  await updateFactoryJob(jobId, {
    status: 'FIXING', qa_status: 'failed', qa_attempt: attempt, preview_url: finalUrl,
    last_error: lastError, last_repair_profiles: classified.repairProfiles, production_deploy: false,
    __event: {
      type: 'QA_ATTEMPT_RESULT', attempt, stage: 'qa', outcome: 'repair_planned', preview_ms: previewMs, qa_ms: qaMs,
      total_ms: Date.now() - attemptStartedAt, preview_url: finalUrl, commit_sha: currentSha(), issue_codes: codes,
      repair_profiles: profileNames(classified.repairProfiles)
    }
  });

  const repairStartedAt = Date.now();
  const changed = await applySafeRepair(classified.repairProfiles);
  const repairMs = Date.now() - repairStartedAt;
  if (!changed) {
    await updateFactoryJob(jobId, {
      status: 'FAILED', retry_exhausted: true, last_error: 'safe repair produced no new commit', production_deploy: false,
      __event: { type: 'REPAIR_RESULT', attempt, stage: 'repair', outcome: 'no_change', repair_ms: repairMs, repair_profiles: profileNames(classified.repairProfiles) }
    });
    throw new Error('AUTO_FIX_NO_CHANGE');
  }

  await recordFactoryJobEvent(jobId, {
    type: 'REPAIR_RESULT', attempt, stage: 'repair', outcome: 'committed', repair_ms: repairMs,
    repair_profiles: profileNames(classified.repairProfiles), commit_sha: currentSha()
  }, { commit_sha: currentSha(), production_deploy: false });
}
