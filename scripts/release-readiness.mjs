import fs from 'node:fs';

function clean(value, max = 500) { return String(value || '').trim().slice(0, max); }
function truthy(value) { return String(value || '').toLowerCase() === 'true'; }

const [projectPathArg, branchArg, prUrlArg, previewUrlArg, qaReusedArg, reportPathArg, outPathArg] = process.argv.slice(2);
const project_path = clean(projectPathArg, 240);
const branch = clean(branchArg, 240);
const pr_url = clean(prUrlArg, 500);
const preview_url = clean(previewUrlArg, 500);
const qa_reused = truthy(qaReusedArg);
const report_path = clean(reportPathArg || 'visual-qa/report.json', 300);
const out_path = clean(outPathArg || 'release-readiness.json', 300);
const production_approved = truthy(process.env.PRODUCTION_APPROVED);

const blockers = [];
const evidence = {
  project_path_valid: project_path.startsWith('projects/'),
  branch_isolated: branch.startsWith('factory/'),
  pull_request_present: /^https:\/\/github\.com\//i.test(pr_url),
  preview_https: /^https:\/\//i.test(preview_url),
  visual_qa: null,
  qa_source: qa_reused ? 'cached_prior_success' : 'fresh_report'
};

if (!evidence.project_path_valid) blockers.push('invalid_project_path');
if (!evidence.branch_isolated) blockers.push('branch_isolation_missing');
if (!evidence.pull_request_present) blockers.push('pull_request_missing');
if (!evidence.preview_https) blockers.push('preview_url_missing_or_invalid');

if (qa_reused) {
  evidence.visual_qa = { ok: true, reused: true, report_path: null };
} else if (!fs.existsSync(report_path)) {
  evidence.visual_qa = { ok: false, reused: false, report_path };
  blockers.push('visual_qa_report_missing');
} else {
  try {
    const report = JSON.parse(fs.readFileSync(report_path, 'utf8'));
    const results = Array.isArray(report.results) ? report.results : [];
    const viewports = results.map((item) => item?.viewport?.name).filter(Boolean);
    const failed = results.flatMap((item) => Array.isArray(item?.failures) ? item.failures : []);
    const completeViewports = viewports.includes('desktop') && viewports.includes('mobile');
    const qaOk = report.ok === true && failed.length === 0 && completeViewports;
    evidence.visual_qa = {
      ok: qaOk,
      reused: false,
      report_version: report.version ?? null,
      generated_at: report.generated_at ?? null,
      viewports,
      failures: failed,
      report_path
    };
    if (!qaOk) blockers.push('visual_qa_not_ready');
  } catch (error) {
    evidence.visual_qa = { ok: false, reused: false, report_path, parse_error: clean(error.message, 200) };
    blockers.push('visual_qa_report_invalid');
  }
}

const preview_blockers = blockers.slice();
const preview_ready = preview_blockers.length === 0;
const production_blockers = [...preview_blockers];
if (!production_approved) production_blockers.push('manual_production_approval_required');
const production_ready = preview_ready && production_approved;

const result = {
  version: 1,
  gate: 'factory-v3-release-readiness',
  generated_at: new Date().toISOString(),
  project_path,
  branch,
  pr_url,
  preview_url,
  preview_ready,
  production_ready,
  production_deploy: false,
  production_approved,
  status: !preview_ready ? 'PREVIEW_BLOCKED' : production_ready ? 'PRODUCTION_APPROVED_NOT_DEPLOYED' : 'PREVIEW_READY_AWAITING_PRODUCTION_APPROVAL',
  evidence,
  blockers: production_blockers,
  feedback: {
    current_stage: preview_ready ? 'preview_review' : 'fix_required',
    next_action: preview_ready ? (production_approved ? 'explicit_production_deploy_step_required' : 'review_preview_and_request_manual_approval') : 'resolve_blockers_and_rerun_qa',
    safe_to_continue_editing: true
  }
};

fs.writeFileSync(out_path, JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));

if (process.env.GITHUB_OUTPUT) {
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `preview_ready=${preview_ready}\n`);
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `production_ready=${production_ready}\n`);
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `status=${result.status}\n`);
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `blockers=${production_blockers.join(',')}\n`);
}

if (!preview_ready) process.exit(1);
