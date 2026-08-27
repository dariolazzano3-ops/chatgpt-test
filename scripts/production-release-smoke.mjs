import { validateProductionRelease } from './production-release-gate.mjs';

const sha = 'a'.repeat(40);
const state = {
  version: 1,
  active: true,
  project_slug: 'alpha',
  source_path: 'projects/alpha',
  branch: 'factory/alpha-edit-abc123',
  edit_revision: 4,
  pull_request: 42,
  preview_url: 'https://alpha.preview.pages.dev',
  production_deploy: false,
  release_readiness: {
    preview_ready: true,
    production_ready: false,
    production_approved: false,
    blockers: ['manual_production_approval_required'],
    evidence: { project_sha: sha, visual_qa: { ok: true, viewports: ['desktop', 'mobile'] } }
  }
};

const args = { state, projectSlug: 'alpha', editRevision: 4, confirmation: 'DEPLOY alpha REV 4', currentSha: sha };
const approved = validateProductionRelease(args);
if (!approved.ok) throw new Error(`valid approval blocked: ${approved.blockers.join(',')}`);

const stale = validateProductionRelease({ ...args, editRevision: 3, confirmation: 'DEPLOY alpha REV 3' });
if (stale.ok || !stale.blockers.includes('active_project_revision_mismatch')) throw new Error('stale revision was not blocked');

const wrongConfirmation = validateProductionRelease({ ...args, confirmation: 'yes' });
if (wrongConfirmation.ok || !wrongConfirmation.blockers.includes('explicit_confirmation_mismatch')) throw new Error('weak confirmation was not blocked');

const qaBroken = structuredClone(state);
qaBroken.release_readiness.evidence.visual_qa.ok = false;
const qaResult = validateProductionRelease({ ...args, state: qaBroken });
if (qaResult.ok || !qaResult.blockers.includes('visual_qa_not_green')) throw new Error('failed QA was not blocked');

const movedBranch = validateProductionRelease({ ...args, currentSha: 'b'.repeat(40) });
if (movedBranch.ok || !movedBranch.blockers.includes('qa_project_sha_mismatch')) throw new Error('post-QA branch mutation was not blocked');

console.log('Production release smoke: approval, revision, QA and exact commit gates passed');
