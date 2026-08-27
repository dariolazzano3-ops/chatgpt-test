import fs from 'node:fs';

export function validateProductionRelease({ state, projectSlug, editRevision, confirmation }) {
  const blockers = [];
  const expectedSlug = String(projectSlug || '').trim();
  const expectedRevision = Number(editRevision);
  const expectedConfirmation = `DEPLOY ${expectedSlug} REV ${expectedRevision}`;

  if (!state || typeof state !== 'object' || Array.isArray(state)) blockers.push('active_state_invalid');
  if (!expectedSlug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(expectedSlug)) blockers.push('project_slug_invalid');
  if (!Number.isInteger(expectedRevision) || expectedRevision < 0) blockers.push('edit_revision_invalid');
  if (String(confirmation || '').trim() !== expectedConfirmation) blockers.push('explicit_confirmation_mismatch');

  if (state && typeof state === 'object') {
    if (state.active !== true) blockers.push('active_project_required');
    if (state.project_slug !== expectedSlug) blockers.push('active_project_slug_mismatch');
    if (state.edit_revision !== expectedRevision) blockers.push('active_project_revision_mismatch');
    if (state.source_path !== `projects/${expectedSlug}`) blockers.push('project_path_mismatch');
    if (!String(state.branch || '').startsWith('factory/')) blockers.push('factory_branch_required');
    if (!String(state.preview_url || '').startsWith('https://')) blockers.push('https_preview_required');
    if (state.production_deploy !== false) blockers.push('editing_state_must_not_be_production');

    const readiness = state.release_readiness;
    if (!readiness || typeof readiness !== 'object') blockers.push('release_readiness_missing');
    else {
      if (readiness.preview_ready !== true) blockers.push('preview_not_ready');
      if (readiness.production_ready !== false) blockers.push('production_state_must_await_manual_approval');
      if (readiness.production_approved !== false) blockers.push('production_must_not_be_preapproved');
      if (readiness.evidence?.visual_qa?.ok !== true) blockers.push('visual_qa_not_green');
      const viewports = readiness.evidence?.visual_qa?.viewports || [];
      if (!Array.isArray(viewports) || !viewports.includes('desktop') || !viewports.includes('mobile')) blockers.push('visual_qa_viewports_incomplete');
      const allowedBlockers = ['manual_production_approval_required'];
      const currentBlockers = Array.isArray(readiness.blockers) ? readiness.blockers : [];
      if (currentBlockers.some((item) => !allowedBlockers.includes(item))) blockers.push('unresolved_release_blockers');
      if (!currentBlockers.includes('manual_production_approval_required')) blockers.push('manual_approval_gate_missing');
    }
  }

  return {
    ok: blockers.length === 0,
    status: blockers.length === 0 ? 'PRODUCTION_RELEASE_APPROVAL_VALID' : 'PRODUCTION_RELEASE_BLOCKED',
    blockers,
    expected_confirmation: expectedConfirmation,
    project_slug: expectedSlug,
    edit_revision: expectedRevision,
    project_path: state?.source_path || null,
    branch: state?.branch || null,
    preview_url: state?.preview_url || null,
    pull_request: state?.pull_request || null,
    production_deploy: false
  };
}

if (process.argv[1]?.endsWith('production-release-gate.mjs') && process.argv[2]) {
  const [statePath, projectSlug, editRevision, confirmation] = process.argv.slice(2);
  const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  const result = validateProductionRelease({ state, projectSlug, editRevision, confirmation });
  console.log(JSON.stringify(result, null, 2));
  if (process.env.GITHUB_OUTPUT) {
    const lines = [
      `ok=${result.ok ? 'true' : 'false'}`,
      `project_slug=${result.project_slug || ''}`,
      `edit_revision=${result.edit_revision}`,
      `project_path=${result.project_path || ''}`,
      `branch=${result.branch || ''}`,
      `preview_url=${result.preview_url || ''}`,
      `pull_request=${result.pull_request || ''}`
    ];
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `${lines.join('\n')}\n`);
  }
  if (!result.ok) process.exit(1);
}
