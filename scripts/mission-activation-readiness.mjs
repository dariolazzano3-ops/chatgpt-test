import fs from 'node:fs';
import { evaluateMissionActivation } from '../src/mission-activation-gate.js';

const flag = (name, fallback = null) => { const index = process.argv.indexOf(`--${name}`); return index >= 0 ? process.argv[index + 1] : fallback; };
const boolFlag = (name) => String(flag(name, 'false')).toLowerCase() === 'true';
const csv = (value) => String(value || '').split(',').map((item) => item.trim()).filter(Boolean);

const packageFile = flag('package');
if (!packageFile || !/^factory-state\/mission-packages\/[a-zA-Z0-9._-]+\.json$/.test(packageFile)) throw new Error('SAFE_MISSION_PACKAGE_PATH_REQUIRED');
if (!fs.existsSync(packageFile)) throw new Error(`MISSION_PACKAGE_FILE_NOT_FOUND:${packageFile}`);

const manifest = JSON.parse(fs.readFileSync(packageFile, 'utf8'));
const missionFile = manifest.mission_file;
const contractsFile = manifest.contracts_file;
if (!missionFile || !contractsFile || !fs.existsSync(missionFile) || !fs.existsSync(contractsFile)) throw new Error('MISSION_PACKAGE_REFERENCES_MISSING');
const mission = JSON.parse(fs.readFileSync(missionFile, 'utf8'));
const contracts = JSON.parse(fs.readFileSync(contractsFile, 'utf8'));
const pkg = { ...manifest, mission, contracts };

const activation = {
  adapter_approvals: {
    web: { authorized: boolFlag('approve-web') },
    automation: { authorized: boolFlag('approve-automation') },
    ai: { authorized: boolFlag('approve-ai') },
    business: { authorized: boolFlag('approve-business') }
  },
  ai: {
    runner_configured: boolFlag('ai-runner-configured'),
    credentials_configured: boolFlag('ai-credentials-configured'),
    cost_approved: boolFlag('ai-cost-approved')
  },
  automation: {
    transport_configured: boolFlag('automation-transport-configured'),
    policy_authorized: boolFlag('automation-policy-authorized'),
    allowed_hosts: csv(flag('automation-allowed-hosts', ''))
  },
  business: {
    target_adapter_configured: boolFlag('business-target-configured'),
    external_write_approved: boolFlag('business-write-approved')
  },
  production_deploy: false
};

const result = evaluateMissionActivation(pkg, activation);
if (!result.ok) throw new Error(result.error || 'MISSION_ACTIVATION_EVALUATION_FAILED');
console.log(JSON.stringify(result, null, 2));
process.exitCode = result.user_action_required ? 2 : 0;
