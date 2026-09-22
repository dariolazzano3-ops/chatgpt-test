import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = process.cwd();
const contractPath = path.join(root, 'reference/jarvis-anatomy-final/VISUAL_CONTRACT_V1.json');
const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
const uiPath = path.join(root, 'src/jarvis/command-center-ui/jarvis-command-center.jsx');
const ui = fs.readFileSync(uiPath, 'utf8');
const errors = [];
const sha = (p) => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, p))).digest('hex');

for (const [name, ref] of Object.entries(contract.references)) {
  if (!fs.existsSync(path.join(root, ref.path))) errors.push(`missing reference ${name}: ${ref.path}`);
  else if (sha(ref.path) !== ref.sha256) errors.push(`reference hash mismatch ${name}`);
}
for (const [name, art] of Object.entries(contract.static_art)) {
  if (!fs.existsSync(path.join(root, art.path))) errors.push(`missing static art ${name}: ${art.path}`);
  else if (sha(art.path) !== art.sha256) errors.push(`static art hash mismatch ${name}`);
}
if (contract.semantic_zones.length !== contract.acceptance.semantic_zone_count) errors.push('semantic zone count contract mismatch');
for (const zone of contract.semantic_zones) {
  if (!ui.includes(`key: "${zone}"`)) errors.push(`zone missing from ANATOMY_ZONES: ${zone}`);
}
for (const required of [
  'function AnatomyConnectors',
  'new ResizeObserver(recompute)',
  'window.addEventListener("resize", recompute)',
  'data-zone={zone.key}',
  'data-zone={line.key}',
  '<img className="an-figure-img an-figure-img-desktop"',
  '<img className="an-figure-img an-figure-img-mobile"'
]) {
  if (!ui.includes(required)) errors.push(`required integration marker missing: ${required}`);
}
for (const forbidden of ['an-figure-photo-plate', 'background-image:var(--an-ref']) {
  if (ui.includes(forbidden)) errors.push(`forbidden pasted-backplate marker present: ${forbidden}`);
}
if (errors.length) {
  console.error('JARVIS REFERENCE CONTRACT V1: FAIL\n - ' + errors.join('\n - '));
  process.exit(1);
}
console.log(`JARVIS REFERENCE CONTRACT V1: PASS (${contract.semantic_zones.length} semantic zones, locked references + isolated body art)`);
