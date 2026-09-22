#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const arg = process.argv[2];
if (!arg) { console.error('Usage: node scripts/reference-to-ui-contract-validate-v1.mjs <contract.json>'); process.exit(2); }
const root = process.cwd();
const file = path.resolve(arg);
const c = JSON.parse(fs.readFileSync(file, 'utf8'));
const errors=[];
if (c.schema !== 'ysrio.reference-to-ui.visual-contract.v1') errors.push(`unsupported schema: ${c.schema}`);
if (!c.feature) errors.push('feature missing');
const sha = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const verifyGroup = (group,label) => {
  for (const [name,spec] of Object.entries(group || {})) {
    if (!spec?.path) { errors.push(`${label}.${name}.path missing`); continue; }
    const abs=path.resolve(root,spec.path);
    if (!fs.existsSync(abs)) { errors.push(`${label}.${name} missing: ${spec.path}`); continue; }
    if (spec.sha256 && sha(abs)!==spec.sha256) errors.push(`${label}.${name} sha256 mismatch`);
  }
};
verifyGroup(c.references,'references');
verifyGroup(c.static_art,'static_art');
if (!Array.isArray(c.semantic_zones)) errors.push('semantic_zones must be an array');
else if (new Set(c.semantic_zones).size !== c.semantic_zones.length) errors.push('semantic_zones contains duplicates');
if (!Array.isArray(c.forbidden) || !c.forbidden.includes('full-reference-screenshot-as-live-ui')) errors.push('forbidden full-reference-screenshot rule missing');
if (!c.acceptance?.requires_browser_interaction_proof) errors.push('browser interaction proof gate missing');
if (!c.acceptance?.requires_visual_review) errors.push('visual review gate missing');
if (errors.length) { console.error('REFERENCE_TO_UI_CONTRACT_VALIDATE_V1: FAIL\n - '+errors.join('\n - ')); process.exit(1); }
console.log(`REFERENCE_TO_UI_CONTRACT_VALIDATE_V1: PASS feature=${c.feature} refs=${Object.keys(c.references||{}).length} zones=${c.semantic_zones.length}`);
