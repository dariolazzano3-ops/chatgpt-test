import { runWave0Baseline } from '../src/visual-foundry/baseline.js';

const args = Object.fromEntries(process.argv.slice(2).map((arg) => {
  const [key, ...rest] = arg.replace(/^--/, '').split('=');
  return [key, rest.join('=') || true];
}));

function viewport(value) {
  const match = String(value || '1440x1100').match(/^(\d+)x(\d+)(?:@(\d+(?:\.\d+)?))?$/);
  if (!match) throw new Error('VIEWPORT_ARGUMENT_INVALID');
  return { width: Number(match[1]), height: Number(match[2]), device_pixel_ratio: Number(match[3] || 1) };
}

if (!args.url || !args.reference) {
  console.error('Usage: node scripts/visual-foundry-wave0.mjs --url=http://... --reference=/path/reference.png [--out=artifacts/visual-foundry/wave0] [--viewport=1440x1100@1]');
  process.exit(2);
}

const evidence = await runWave0Baseline({
  project_id: args.project || '',
  reference_id: args['reference-id'] || '',
  reference_version: args['reference-version'] || '',
  reference_status: args['reference-status'] || 'APPROVED',
  reference_path: args.reference,
  runtime_url: args.url,
  commit_sha: args.commit || process.env.GITHUB_SHA || '',
  output_dir: args.out || 'artifacts/visual-foundry/wave0',
  viewport: viewport(args.viewport),
  locale: args.locale || 'en-US',
  timezone: args.timezone || 'UTC'
});

console.log(JSON.stringify(evidence, null, 2));
