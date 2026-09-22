#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

function argsOf(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (!argv[i].startsWith('--')) continue;
    out[argv[i].slice(2)] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
  }
  return out;
}
function sha256(file) { return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'); }
function pngSize(buf) {
  if (buf.length < 24 || buf.toString('ascii', 1, 4) !== 'PNG') return null;
  return [buf.readUInt32BE(16), buf.readUInt32BE(20)];
}
function jpegSize(buf) {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xff) { i += 1; continue; }
    const marker = buf[i + 1];
    i += 2;
    if (marker === 0xd8 || marker === 0xd9) continue;
    if (i + 1 >= buf.length) break;
    const len = buf.readUInt16BE(i);
    if (len < 2 || i + len > buf.length) break;
    if ([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)) {
      return [buf.readUInt16BE(i + 5), buf.readUInt16BE(i + 3)];
    }
    i += len;
  }
  return null;
}
function imageSize(file) {
  const buf = fs.readFileSync(file);
  return pngSize(buf) || jpegSize(buf) || null;
}

const a = argsOf(process.argv.slice(2));
if (!a.feature || (!a.mobile && !a.desktop) || !a.out) {
  console.error('Usage: node scripts/reference-to-ui-init-v1.mjs --feature <id> [--mobile <image>] [--desktop <image>] --out <contract.json>');
  process.exit(2);
}
const root = process.cwd();
const rel = (p) => path.relative(root, path.resolve(p)).replaceAll(path.sep, '/');
const references = {};
for (const kind of ['mobile','desktop']) {
  const supplied = a[kind];
  if (!supplied) continue;
  const abs = path.resolve(supplied);
  if (!fs.existsSync(abs)) throw new Error(`${kind} reference not found: ${abs}`);
  references[kind] = { path: rel(abs), sha256: sha256(abs), source_pixels: imageSize(abs) };
}
const contract = {
  schema: 'ysrio.reference-to-ui.visual-contract.v1',
  feature: String(a.feature),
  created_from: 'reference-to-ui-init-v1',
  principle: 'Reference defines visual intent; live UI defines structure, state and behavior. Never use a full reference screenshot as the live UI.',
  references,
  static_art: {},
  semantic_zones: [],
  required_live_structure: {},
  interaction_rule: 'One semantic id must drive every live representation of the same concept.',
  responsive_rule: 'Relationships derive from real component geometry, not hard-coded viewport pixels.',
  forbidden: [
    'full-reference-screenshot-as-live-ui',
    'baked-live-text-or-status-inside-static-art',
    'rectangular-reference-backplate',
    'hard-coded-viewport-connector-endpoints',
    'fabricated-runtime-status'
  ],
  acceptance: {
    requires_structural_proof: true,
    requires_browser_interaction_proof: true,
    requires_visual_review: true,
    requires_private_deploy_after_local_acceptance: true
  }
};
const out = path.resolve(a.out);
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(contract, null, 2) + '\n');
console.log(`REFERENCE_TO_UI_INIT_V1: PASS feature=${contract.feature} references=${Object.keys(references).join(',')} out=${rel(out)}`);
for (const [kind, ref] of Object.entries(references)) console.log(`${kind}: ${ref.source_pixels?.join('x') || 'unknown-size'} sha256=${ref.sha256}`);
