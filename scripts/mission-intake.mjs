import { compileMissionPackage } from '../src/mission-compiler.js';

const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
const repository = process.env.GITHUB_REPOSITORY;
const controlRef = 'factory-control';
const headers = () => ({ authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28', 'content-type': 'application/json' });
const flag = (name, fallback = null) => { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] : fallback; };

if (!token) throw new Error('GITHUB_TOKEN_REQUIRED');
if (!repository?.includes('/')) throw new Error('GITHUB_REPOSITORY_REQUIRED');

async function readRemote(file) {
  const response = await fetch(`https://api.github.com/repos/${repository}/contents/${file}?ref=${encodeURIComponent(controlRef)}`, { headers: headers() });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`REMOTE_READ_FAILED_${response.status}:${file}`);
  return response.json();
}

async function writeRemoteJson(file, value, message) {
  const existing = await readRemote(file);
  const payload = { message, branch: controlRef, content: Buffer.from(`${JSON.stringify(value, null, 2)}\n`).toString('base64') };
  if (existing?.sha) payload.sha = existing.sha;
  const response = await fetch(`https://api.github.com/repos/${repository}/contents/${file}`, { method: 'PUT', headers: headers(), body: JSON.stringify(payload) });
  if (!response.ok) throw new Error(`REMOTE_WRITE_FAILED_${response.status}:${file}:${(await response.text()).slice(0, 240)}`);
  return response.json();
}

const prompt = flag('prompt');
const project = flag('project');
const projectName = flag('project-name');
if (!prompt) throw new Error('MISSION_PROMPT_REQUIRED');

const compiled = compileMissionPackage({ prompt, project, project_name: projectName });
if (!compiled.ok) throw new Error(compiled.error || 'MISSION_COMPILATION_FAILED');
const pkg = compiled.package;
const missionFile = `factory-state/missions/${pkg.mission.mission_id}.json`;
const contractsFile = `factory-state/mission-contracts/${pkg.mission.mission_id}.json`;
const manifestFile = `factory-state/mission-packages/${pkg.mission.mission_id}.json`;

await writeRemoteJson(missionFile, pkg.mission, `Mission ${pkg.mission.mission_id}: create from high-level prompt`);
await writeRemoteJson(contractsFile, pkg.contracts, `Mission ${pkg.mission.mission_id}: compile factory contracts`);
await writeRemoteJson(manifestFile, {
  package_version: pkg.package_version,
  compiler_version: pkg.compiler_version,
  mission_id: pkg.mission.mission_id,
  mission_file: missionFile,
  contracts_file: contractsFile,
  approvals: pkg.approvals,
  activation_requirements: pkg.activation_requirements,
  safeguards: pkg.safeguards
}, `Mission ${pkg.mission.mission_id}: persist mission package manifest`);

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
  production_deploy: false,
  automatic_multi_factory_execution: false
}, null, 2));
