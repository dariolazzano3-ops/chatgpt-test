import { compileMissionPackage } from '../src/mission-compiler.js';
import { commitJsonFilesAtomically } from '../src/github-atomic-json-commit.js';

const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
const repository = process.env.GITHUB_REPOSITORY;
const controlRef = 'factory-control';
const flag = (name, fallback = null) => { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] : fallback; };
const fullSha = (value) => /^[0-9a-f]{40}$/i.test(String(value || '').trim());

if (!token) throw new Error('GITHUB_TOKEN_REQUIRED');
if (!repository?.includes('/')) throw new Error('GITHUB_REPOSITORY_REQUIRED');

const prompt = flag('prompt');
const project = flag('project');
const projectName = flag('project-name');
const canonicalBranch = flag('canonical-branch', controlRef);
const baselineBranch = flag('baseline-branch', canonicalBranch);
const projectHead = flag('project-head');
const expectedParentSha = flag('expected-parent-sha', projectHead);
const controlHead = flag('control-head');
if (!prompt) throw new Error('MISSION_PROMPT_REQUIRED');
if (!fullSha(projectHead) || !fullSha(expectedParentSha)) throw new Error('BOUND_SOURCE_REVISION_REQUIRED');
if (!fullSha(controlHead)) throw new Error('CONTROL_BRANCH_HEAD_REQUIRED');

const compiled = compileMissionPackage({ prompt, project, project_name: projectName, canonical_branch: canonicalBranch, baseline_branch: baselineBranch, project_head: projectHead, expected_parent_sha: expectedParentSha });
if (!compiled.ok) throw new Error(compiled.error || 'MISSION_COMPILATION_FAILED');
const pkg = compiled.package;
const missionFile = `factory-state/missions/${pkg.mission.mission_id}.json`;
const contractsFile = `factory-state/mission-contracts/${pkg.mission.mission_id}.json`;
const manifestFile = `factory-state/mission-packages/${pkg.mission.mission_id}.json`;

const packageManifest = {
  package_version: pkg.package_version,
  compiler_version: pkg.compiler_version,
  mission_id: pkg.mission.mission_id,
  mission_file: missionFile,
  contracts_file: contractsFile,
  approvals: pkg.approvals,
  activation_requirements: pkg.activation_requirements,
  safeguards: pkg.safeguards,
  source_of_truth: pkg.source_of_truth,
  atomic_persistence: true
};
const committed = await commitJsonFilesAtomically({
  repository,
  branch: controlRef,
  token,
  expected_parent_sha: controlHead,
  message: `Mission ${pkg.mission.mission_id}: persist bound mission package atomically`,
  files: [
    { path: missionFile, value: pkg.mission },
    { path: contractsFile, value: pkg.contracts },
    { path: manifestFile, value: packageManifest }
  ]
});
if (!committed.ok) throw new Error(committed.code || 'MISSION_ATOMIC_PERSIST_FAILED');

console.log(JSON.stringify({
  ok: true,
  mission_id: pkg.mission.mission_id,
  mission_status: pkg.mission.status,
  mission_file: missionFile,
  contracts_file: contractsFile,
  package_manifest_file: manifestFile,
  task_count: pkg.mission.tasks.length,
  required_approval_engines: pkg.approvals.required_engines,
  activation_requirements: pkg.activation_requirements,
  source_of_truth: pkg.source_of_truth,
  commit_sha: committed.commit_sha,
  atomic_persistence: true,
  production_deploy: false,
  automatic_multi_factory_execution: false
}, null, 2));
