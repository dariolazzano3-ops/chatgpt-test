import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'factory-release-readiness-'));
const reportPath = path.join(dir, 'report.json');
const outPath = path.join(dir, 'release.json');
fs.writeFileSync(reportPath, JSON.stringify({
  version: 4,
  ok: true,
  generated_at: new Date().toISOString(),
  results: [
    { viewport: { name: 'desktop' }, failures: [] },
    { viewport: { name: 'mobile' }, failures: [] }
  ]
}));

const run = spawnSync(process.execPath, [
  'scripts/release-readiness.mjs',
  'projects/demo',
  'factory/demo-edit-123',
  'https://github.com/example/repo/pull/1',
  'https://demo.pages.dev',
  'false',
  reportPath,
  outPath
], { encoding: 'utf8' });
if (run.status !== 0) throw new Error(`release readiness unexpectedly failed: ${run.stderr || run.stdout}`);
const result = JSON.parse(fs.readFileSync(outPath, 'utf8'));
if (result.preview_ready !== true) throw new Error('preview should be ready');
if (result.production_ready !== false) throw new Error('production must remain blocked');
if (result.production_deploy !== false) throw new Error('production deploy must remain false');
if (!result.blockers.includes('manual_production_approval_required')) throw new Error('manual approval blocker missing');
if (result.evidence?.visual_qa?.ok !== true) throw new Error('visual QA evidence missing');

const badReport = path.join(dir, 'bad-report.json');
fs.writeFileSync(badReport, JSON.stringify({ version: 4, ok: false, results: [{ viewport: { name: 'desktop' }, failures: ['overflow'] }] }));
const bad = spawnSync(process.execPath, [
  'scripts/release-readiness.mjs',
  'projects/demo',
  'factory/demo-edit-123',
  'https://github.com/example/repo/pull/1',
  'https://demo.pages.dev',
  'false',
  badReport,
  path.join(dir, 'bad-release.json')
], { encoding: 'utf8' });
if (bad.status === 0) throw new Error('failed visual QA must block preview readiness');

console.log('Release readiness smoke: preview gate and production approval blocker passed');
