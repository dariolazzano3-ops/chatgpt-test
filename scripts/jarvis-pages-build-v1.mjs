import fs from 'node:fs';
import path from 'node:path';
import { build } from 'esbuild';

const outdir = path.resolve('.jarvis-pages-dist');
fs.rmSync(outdir, { recursive: true, force: true });
fs.mkdirSync(outdir, { recursive: true });

await build({
  entryPoints: ['src/jarvis/pages-worker-v1.js'],
  outfile: path.join(outdir, '_worker.js'),
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  minify: false,
  sourcemap: false,
  legalComments: 'none',
  logLevel: 'warning'
});

fs.writeFileSync(
  path.join(outdir, 'README.txt'),
  'JARVIS private Pages runtime. Access must be enabled before deployment.\n',
  'utf8'
);

const worker = fs.readFileSync(path.join(outdir, '_worker.js'), 'utf8');
if (!worker.includes('jarvis.pages-worker.v1')) throw new Error('JARVIS_PAGES_BUNDLE_MANIFEST_MISSING');
if (worker.includes('RIOSYSTEMS_OPERATOR_EMAIL')) throw new Error('JARVIS_PAGES_BUNDLE_RIOSYSTEMS_IDENTITY_FALLBACK');
if (worker.includes('RIOSYSTEMS_ENVIRONMENT')) throw new Error('JARVIS_PAGES_BUNDLE_RIOSYSTEMS_ENV_FALLBACK');

console.log('JARVIS Pages V1 build: PASS');
