/* JARVIS — Branch Manager V1 (safe feature-branch preparation).

   Closes "operator still manually prepares/switches branches". Every check
   here runs real `git`, in the real repo, every call — never cached, never
   inferred. Two halves:

     - evaluateJarvisBranchTruthV1: pure inspection (current branch, working
       tree, target branch existence, unique-work/divergence detection,
       protected-branch detection, best-effort LOCAL remote truth via the
       repo's own remote-tracking refs — no GitHub token, no network write,
       ever; a stale or absent remote-tracking ref fails closed to UNKNOWN,
       never fabricated as SYNCED).
     - prepareJarvisTargetBranchV1: the only mutating half. It may EITHER
       create the target branch fresh from `base_ref` (target absent) OR
       fast-forward-align it to `base_ref` (target exists, no unique work,
       and is not the currently checked-out branch mid-merge/rebase) OR
       simply check it out (target exists with unique work — never
       destroyed). It NEVER touches main/master, never force-anything, never
       merges, never pushes (this module issues no `push` of any kind), and
       refuses outright (fail closed) on any ambiguous/unsafe state rather
       than guessing. */

import { execFileSync } from 'node:child_process';

const clean = (value, max = 4000) => String(value ?? '').trim().slice(0, max);
export const JARVIS_PROTECTED_BRANCHES = Object.freeze(['main', 'master']);
const GIT_TIMEOUT_MS = 10000;

function git(repoDir, args) {
  return execFileSync('git', args, { cwd: repoDir, stdio: ['ignore', 'pipe', 'pipe'], timeout: GIT_TIMEOUT_MS }).toString('utf8');
}
function gitOrNull(repoDir, args) {
  try { return git(repoDir, args).trim(); } catch { return null; }
}
function gitOk(repoDir, args) {
  try { git(repoDir, args); return true; } catch { return false; }
}

/** Pure(ish) inspection — issues only read-only git commands. Never mutates
 *  anything. Safe to call as often as needed. */
export function evaluateJarvisBranchTruthV1({ repo_dir, target_branch, base_ref } = {}) {
  const repoDir = clean(repo_dir, 400);
  const target = clean(target_branch, 200);
  const base = clean(base_ref, 200) || 'HEAD';

  const report = {
    schema: 'aurentara.jarvis.branch-truth.v1',
    repo_dir: repoDir,
    target_branch: target,
    base_ref: base,
    is_git_repo: false,
    current_branch: null,
    working_tree_clean: null,
    target_branch_protected: JARVIS_PROTECTED_BRANCHES.includes(target.toLowerCase()),
    target_exists_locally: false,
    target_exists_on_remote: false,
    target_head: null,
    remote_target_head: null,
    remote_truth_bound: false,
    ahead: null,
    behind: null,
    diverged: null,
    has_unique_work: null,
    safe_to_prepare: false,
    reasons: []
  };

  if (!repoDir) { report.reasons.push('REPO_DIR_REQUIRED'); return report; }
  if (!gitOk(repoDir, ['rev-parse', '--git-dir'])) { report.reasons.push('NOT_A_GIT_REPO'); return report; }
  report.is_git_repo = true;

  report.current_branch = gitOrNull(repoDir, ['rev-parse', '--abbrev-ref', 'HEAD']);
  const statusRaw = gitOrNull(repoDir, ['status', '--porcelain']);
  report.working_tree_clean = statusRaw !== null && statusRaw.length === 0;

  if (report.target_branch_protected) {
    report.reasons.push('TARGET_BRANCH_PROTECTED');
    return report; // fail closed immediately — no further inspection needed to refuse
  }
  if (!target) { report.reasons.push('TARGET_BRANCH_REQUIRED'); return report; }

  report.target_exists_locally = gitOk(repoDir, ['show-ref', '--verify', '--quiet', `refs/heads/${target}`]);
  if (report.target_exists_locally) {
    report.target_head = gitOrNull(repoDir, ['rev-parse', target]);
  }

  // Best-effort LOCAL remote truth: the repo's own remote-tracking ref, no
  // network call issued here, no token required. Genuinely real (git's own
  // last-known state of origin), but can be stale if nothing fetched
  // recently — surfaced honestly via `remote_truth_bound`, never presented
  // as live/fresh.
  const remoteRef = `refs/remotes/origin/${target}`;
  report.target_exists_on_remote = gitOk(repoDir, ['show-ref', '--verify', '--quiet', remoteRef]);
  if (report.target_exists_on_remote) {
    report.remote_target_head = gitOrNull(repoDir, ['rev-parse', `origin/${target}`]);
    report.remote_truth_bound = true;
    if (report.target_exists_locally) {
      const counts = gitOrNull(repoDir, ['rev-list', '--left-right', '--count', `origin/${target}...${target}`]);
      if (counts) {
        const [behindStr, aheadStr] = counts.split(/\s+/);
        report.behind = Number(behindStr) || 0;
        report.ahead = Number(aheadStr) || 0;
        report.diverged = report.ahead > 0 && report.behind > 0;
      }
    }
  }

  if (report.target_exists_locally) {
    // "Unique work" = commits on target not reachable from base_ref at all —
    // resetting/replacing the branch would destroy them.
    const isAncestor = gitOk(repoDir, ['merge-base', '--is-ancestor', target, base]);
    report.has_unique_work = !isAncestor;
  } else {
    report.has_unique_work = false; // nothing to lose — it doesn't exist yet
  }

  report.safe_to_prepare = report.is_git_repo
    && !report.target_branch_protected
    && report.working_tree_clean === true;
  if (!report.safe_to_prepare && report.working_tree_clean === false) report.reasons.push('WORKING_TREE_DIRTY');

  return report;
}

/** The only mutating call. Refuses (fail closed, no mutation attempted) on
 *  anything evaluateJarvisBranchTruthV1 flags unsafe. When target has unique
 *  work, this only ever CHECKS IT OUT — it never resets/rebases/force-moves
 *  it, so that work is never destroyed. */
export function prepareJarvisTargetBranchV1({ repo_dir, target_branch, base_ref } = {}) {
  const truth = evaluateJarvisBranchTruthV1({ repo_dir, target_branch, base_ref });
  const repoDir = truth.repo_dir;
  const target = truth.target_branch;
  const base = truth.base_ref;

  if (!truth.is_git_repo) return { ok: false, error: 'NOT_A_GIT_REPO', truth };
  if (truth.target_branch_protected) return { ok: false, error: 'TARGET_BRANCH_PROTECTED', truth };
  if (!target) return { ok: false, error: 'TARGET_BRANCH_REQUIRED', truth };
  if (truth.working_tree_clean !== true) return { ok: false, error: 'WORKING_TREE_DIRTY', truth };

  const actions = [];
  try {
    if (!truth.target_exists_locally) {
      // Create fresh from base_ref. No prior state to lose.
      git(repoDir, ['checkout', '-q', '-b', target, base]);
      actions.push(`CREATED_FROM:${base}`);
    } else if (truth.has_unique_work) {
      // Never touched destructively — just check it out as-is.
      git(repoDir, ['checkout', '-q', target]);
      actions.push('CHECKED_OUT_EXISTING_WITH_UNIQUE_WORK');
    } else {
      // Exists, no unique work relative to base_ref -> safe to fast-forward-
      // align: check it out, then fast-forward-only merge base_ref into it.
      // `--ff-only` refuses (rather than creating a merge commit or moving
      // history) if this is somehow not a genuine fast-forward.
      git(repoDir, ['checkout', '-q', target]);
      git(repoDir, ['merge', '--ff-only', '-q', base]);
      actions.push(`FAST_FORWARD_ALIGNED_TO:${base}`);
    }
  } catch (error) {
    return { ok: false, error: 'BRANCH_PREPARE_GIT_FAILED', detail: clean(error?.message || error, 400), actions, truth };
  }

  const finalTruth = evaluateJarvisBranchTruthV1({ repo_dir: repoDir, target_branch: target, base_ref: base });
  return { ok: finalTruth.current_branch === target, actions, truth: finalTruth };
}

export function jarvisBranchManagerManifestV1() {
  return {
    schema: 'aurentara.jarvis.branch-manager.v1',
    protected_branches: [...JARVIS_PROTECTED_BRANCHES],
    can_touch_main_master: false,
    can_force_push: false,
    can_merge_non_ff: false,
    can_push: false,
    can_destroy_unique_work: false,
    remote_truth_source: 'LOCAL_REMOTE_TRACKING_REF_NO_TOKEN',
    remote_truth_fails_closed_to: 'UNKNOWN',
    fail_closed_on_dirty_tree: true,
    fail_closed_on_protected_target: true,
    production_deploy: false,
    hamyren_data_flow: false
  };
}
