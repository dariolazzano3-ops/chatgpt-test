import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { updateFactoryJob, resolveCandidateRevision } from './factory-job-state.mjs';

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
  const result = spawnSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...options });
  return result;
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
  const failures = (report.results || []).flatMap((r) => (r.failures || []).map((message) => ({ viewport: r.viewport?.name || 'unknown', message })));
  const fixable = failures.length > 0 && failures.every((f) => /horizontal overflow|scroll overflow/i.test(f.message));
  const signature = JSON.stringify(failures.map((f) => `${f.viewport}:${f.message.replace(/\d+(?:\.\d+)?px/g, '<px>')}`).sort());
  return { report, failures, fixable, signature };
}

async function applySafeRepair() {
  const cssPath = path.join(projectPath, 'styles.css');
  let css = await fs.readFile(cssPath, 'utf8');
  const marker = '/* factory-v3.1:auto-fix-horizontal-overflow */';
  if (css.includes(marker)) return false;
  css += `\n\n${marker}\nhtml, body { max-width: 100%; overflow-x: clip; }\nimg, video, canvas, svg { max-width: 100%; }\n`;
  await fs.writeFile(cssPath, css);
  execFileSync('git', ['config', 'user.name', 'factory-qa-repair[bot]']);
  execFileSync('git', ['config', 'user.email', 'factory-qa-repair[bot]@users.noreply.github.com']);
  execFileSync('git', ['add', cssPath]);
  execFileSync('git', ['commit', '-m', `Factory: auto-fix visual QA overflow for ${projectSlug}`]);
  execFileSync('git', ['push', 'origin', `HEAD:${sourceBranch}`], { stdio: 'inherit' });
  return true;
}

await updateFactoryJob(jobId, {
  status: 'IMPLEMENTING', project_slug: projectSlug, revision, branch: sourceBranch,
  commit_sha: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), qa_attempt: 0, max_qa_attempts: maxAttempts
});

for (let attempt = 1; attempt <= maxAttempts; attempt++) {
  await updateFactoryJob(jobId, { status: 'PREVIEW_BUILDING', qa_attempt: attempt, commit_sha: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim() });
  finalUrl = deployPreview();
  await updateFactoryJob(jobId, { status: 'QA_RUNNING', preview_url: finalUrl, qa_attempt: attempt, commit_sha: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim() });

  await fs.rm('visual-qa', { recursive: true, force: true });
  const qa = run('node', ['.factory-runtime/visual-qa.mjs', finalUrl, 'visual-qa'], { stdio: ['ignore', 'inherit', 'inherit'] });
  const classified = await classifyReport();

  if (qa.status === 0 && classified.report.ok === true) {
    const sha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
    await updateFactoryJob(jobId, {
      status: 'READY_FOR_REVIEW', qa_status: 'passed', qa_attempt: attempt, commit_sha: sha,
      preview_url: finalUrl, qa_result: { ok: true, report_version: classified.report.version, failures: [] },
      production_deploy: false
    });
    if (process.env.GITHUB_OUTPUT) await fs.appendFile(process.env.GITHUB_OUTPUT, `url=${finalUrl}\nqa_attempt=${attempt}\njob_id=${jobId}\n`);
    console.log(JSON.stringify({ ok: true, status: 'READY_FOR_REVIEW', job_id: jobId, attempt, preview_url: finalUrl }, null, 2));
    process.exit(0);
  }

  const lastError = classified.failures.map((f) => `${f.viewport}: ${f.message}`).join(' | ').slice(0, 1200);
  if (!classified.fixable || attempt >= maxAttempts || classified.signature === previousFailureSignature) {
    await updateFactoryJob(jobId, {
      status: 'FAILED', qa_status: 'failed', qa_attempt: attempt, preview_url: finalUrl,
      commit_sha: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
      last_error: lastError || 'visual QA failed', retry_exhausted: attempt >= maxAttempts || classified.signature === previousFailureSignature,
      qa_result: { ok: false, report_version: classified.report.version, failures: classified.failures }, production_deploy: false
    });
    throw new Error(!classified.fixable ? `QA_FAILURE_NOT_SAFE_TO_AUTOFIX:${lastError}` : `QA_RETRY_STOPPED:${lastError}`);
  }

  previousFailureSignature = classified.signature;
  await updateFactoryJob(jobId, { status: 'FIXING', qa_status: 'failed', qa_attempt: attempt, preview_url: finalUrl, last_error: lastError, production_deploy: false });
  const changed = await applySafeRepair();
  if (!changed) {
    await updateFactoryJob(jobId, { status: 'FAILED', retry_exhausted: true, last_error: 'safe repair produced no new commit', production_deploy: false });
    throw new Error('AUTO_FIX_NO_CHANGE');
  }
}
