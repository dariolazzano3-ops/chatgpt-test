import fs from 'node:fs';
import path from 'node:path';

const statePath = path.resolve('factory-state/active-project.json');

if (!fs.existsSync(statePath)) {
  console.error('Missing factory-state/active-project.json');
  process.exit(1);
}

let state;
try {
  state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
} catch (error) {
  console.error(`Invalid active project JSON: ${error.message}`);
  process.exit(1);
}

const requiredStrings = [
  'project_name',
  'project_slug',
  'source_path',
  'branch',
  'preview_url',
  'mode',
  'updated_at'
];

for (const key of requiredStrings) {
  if (typeof state[key] !== 'string' || !state[key].trim()) {
    console.error(`Active project state requires non-empty string: ${key}`);
    process.exit(1);
  }
}

if (state.version !== 1) {
  console.error('Unsupported active project state version');
  process.exit(1);
}

if (typeof state.active !== 'boolean') {
  console.error('active must be a boolean');
  process.exit(1);
}

if (!/^[-a-z0-9]+$/.test(state.project_slug)) {
  console.error('Invalid project_slug');
  process.exit(1);
}

if (state.source_path !== `projects/${state.project_slug}`) {
  console.error('source_path must match project_slug');
  process.exit(1);
}

if (!state.branch.startsWith('factory/')) {
  console.error('Active editing branch must be a factory/* branch');
  process.exit(1);
}

if (!Number.isInteger(state.pull_request) || state.pull_request < 1) {
  console.error('pull_request must be a positive integer');
  process.exit(1);
}

let preview;
try {
  preview = new URL(state.preview_url);
} catch {
  console.error('preview_url must be a valid URL');
  process.exit(1);
}

if (preview.protocol !== 'https:') {
  console.error('preview_url must use HTTPS');
  process.exit(1);
}

if (state.mode !== 'editing') {
  console.error('Active project mode must be editing');
  process.exit(1);
}

if (state.production_deploy !== false) {
  console.error('Editing mode must keep production_deploy false');
  process.exit(1);
}

if (Number.isNaN(Date.parse(state.updated_at))) {
  console.error('updated_at must be an ISO-compatible timestamp');
  process.exit(1);
}

console.log(`Active Factory project: ${state.project_name} (${state.project_slug})`);
console.log(`Branch: ${state.branch}`);
console.log(`Preview: ${state.preview_url}`);
