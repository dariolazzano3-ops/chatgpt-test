/* JARVIS — Working Tree Wave Evidence V1. Node-only trusted pre-acceptance gate. */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { getJarvisWaveRegistryEntryV1 } from './wave-registry-v1.js';

const clean = (v, max = 4000) => String(v ?? '').trim().slice(0, max);
const FORBIDDEN = /wrangler\s+deploy|DROP\s+TABLE|TRUNCATE\s|rm\s+-rf|git\s+push|git\s+merge|--force\b/i;
const HAMYREN_FALSE_FIELD_RE = /\b[a-z0-9_]*hamyren[a-z0-9_]*\s*:\s*false\b/i;
const HAMYREN_FALSE_ASSERT_RE = /\bassert\.(?:equal|strictEqual)\s*\(\s*(?:[A-Za-z_$][\w$]*\.)+(?:hamyren[\w$]*|[\w$]*hamyren[\w$]*)\s*,\s*false\s*(?:,|\))/i;
const HAMYREN_DENY_TOKEN_RE = /['\"`]HAMYREN_DATA_FLOW['\"`]/;
const HAMYREN_NEGATED_PROSE_RE = /(?:\b(?:no|without)\s+hamyren\s+data\s+flow\b|\bnever\b.{0,48}\bhamyren\b)/i;
const HAMYREN_DENY_PROSE_RE = /\bhamyren\b.{0,48}\b(?:block(?:ed)?|den(?:y|ied)|refus(?:e|ed)|forbid(?:den)?)\b/i;
const HAMYREN_DENY_ERROR_RE = /\b[A-Z0-9_]*HAMYREN[A-Z0-9_]*(?:BLOCKED|DENIED|FORBIDDEN|DISABLED)\b/;
const HAMYREN_DENY_GUARD_RE = /(?:\/\^?hamyren[^\n]*\.test\(|toLowerCase\(\)\s*===\s*['\"`]hamyren['\"`])/i;
const HAMYREN_SMOKE_LITERAL_RE = /\b(?:connector_id|provider|capability|source_system)\s*:\s*['\"`]hamyren(?:[.:/][^'\"`]*)?['\"`]/i;
const HAMYREN_FILTER_RETURN_RE = /\bif\b.*hamyren.*\breturn\s+null\b/i;
const SMOKE_FILE_RE = /(?:^|\/)[^/]*smoke\.mjs$/i;
function hasExplicitHamyrenNegativeSmokeContext(context = '') {
  const text = String(context);
  return /assert\.(?:equal|strictEqual)\s*\(\s*[\w$]*hamyren[\w$]*(?:\.[A-Za-z_$][\w$]*)*\s*,\s*(?:false|0)\s*\)/i.test(text)
    || /assert\.(?:equal|strictEqual)\s*\(\s*(?:[A-Za-z_$][\w$]*\.)*reason\s*,\s*['\"`][A-Z0-9_]*HAMYREN[A-Z0-9_]*(?:BLOCKED|DENIED|FORBIDDEN|DISABLED)['\"`]\s*\)/i.test(text);
}
function git(repo, args) { return execFileSync('git', args, { cwd: repo, stdio: ['ignore', 'pipe', 'pipe'], timeout: 120000 }).toString('utf8'); }
function allowedHamyren(line, sourcePath = '', context = '') {
  if (HAMYREN_FALSE_FIELD_RE.test(line) || HAMYREN_FALSE_ASSERT_RE.test(line)
    || HAMYREN_DENY_TOKEN_RE.test(line) || HAMYREN_NEGATED_PROSE_RE.test(line)
    || HAMYREN_DENY_ERROR_RE.test(line)) return true;
  if (HAMYREN_DENY_PROSE_RE.test(line)) return true;
  if (HAMYREN_FILTER_RETURN_RE.test(line)) return true;
  if (HAMYREN_DENY_GUARD_RE.test(line) && HAMYREN_DENY_ERROR_RE.test(context)) return true;
  if (SMOKE_FILE_RE.test(sourcePath) && hasExplicitHamyrenNegativeSmokeContext(context)) return true;
  return SMOKE_FILE_RE.test(sourcePath) && HAMYREN_SMOKE_LITERAL_RE.test(line)
    && /assert\.throws\s*\(/.test(context) && HAMYREN_DENY_ERROR_RE.test(context);
}
function scanLine(line, hits, sourcePath = '', context = '') {
  if (FORBIDDEN.test(line)) hits.push(line.trim().slice(0, 300));
  else if (/hamyren/i.test(line) && !allowedHamyren(line, sourcePath, context)) hits.push(line.trim().slice(0, 300));
}
function statusEntries(repo) {
  const raw = git(repo, ['status', '--porcelain=v1', '-z', '--untracked-files=all']);
  return raw.split('\0').filter(Boolean).map((entry) => ({ status: entry.slice(0, 2), path: entry.slice(3) }));
}
function scanWorkingTree(repo, entries) {
  const hits = [];
  let tracked = '';
  try { tracked = git(repo, ['diff', '--no-ext-diff', '--unified=0', '--']); } catch { return ['WORKING_TREE_DIFF_UNREADABLE']; }
  for (const raw of tracked.split('\n')) if (/^\+(?!\+\+)/.test(raw)) scanLine(raw.slice(1), hits);
  for (const e of entries.filter((x) => x.status === '??')) {
    try {
      const lines = fs.readFileSync(path.join(repo, e.path), 'utf8').split('\n');
      for (let i = 0; i < lines.length; i += 1) {
        const context = lines.slice(Math.max(0, i - 6), Math.min(lines.length, i + 10)).join('\n');
        scanLine(lines[i], hits, e.path, context);
      }
    } catch { hits.push(`UNREADABLE_UNTRACKED:${e.path}`); }
  }
  return hits;
}
function runCheck(repo, check) {
  const command = clean(check?.command, 80);
  const args = Array.isArray(check?.args) ? check.args.map((x) => clean(x, 400)) : [];
  if (command !== 'node') return { command: [command, ...args].join(' '), passed: false, error: 'ONLY_NODE_CHECKS_ALLOWED' };
  try {
    execFileSync(process.execPath, args, { cwd: repo, stdio: ['ignore', 'pipe', 'pipe'], timeout: 120000 });
    return { command: ['node', ...args].join(' '), passed: true };
  } catch (error) {
    return { command: ['node', ...args].join(' '), passed: false, error: clean(error?.stderr?.toString() || error?.message, 400) };
  }
}

export function computeJarvisWorkingTreeWaveEvidenceV1({ repo_dir, target_branch, program, wave_index, verification } = {}) {
  const repo = clean(repo_dir, 400), branch = clean(target_branch, 200);
  const entry = getJarvisWaveRegistryEntryV1(program, wave_index);
  if (!entry) return { sufficient: false, reason: 'WAVE_NOT_REGISTERED' };
  if (!repo || !branch || ['main', 'master'].includes(branch.toLowerCase())) return { sufficient: false, reason: 'UNSAFE_REPO_OR_BRANCH' };
  let current, entries;
  try { current = git(repo, ['rev-parse', '--abbrev-ref', 'HEAD']).trim(); entries = statusEntries(repo); }
  catch { return { sufficient: false, reason: 'GIT_TRUTH_UNAVAILABLE' }; }
  if (current !== branch) return { sufficient: false, reason: 'NOT_ON_TARGET_BRANCH' };
  if (!entries.length) return { sufficient: false, reason: 'NO_WORKING_TREE_CHANGES' };
  if (entries.some((e) => /D|R|C|U/.test(e.status))) return { sufficient: false, reason: 'DESTRUCTIVE_OR_COMPLEX_GIT_STATUS', statuses: entries };
  const allowed = new Set(entry.expected_files);
  const dirty = entries.map((e) => e.path);
  const unexpected = dirty.filter((f) => !allowed.has(f));
  if (unexpected.length) return { sufficient: false, reason: 'UNEXPECTED_WORKING_TREE_FILES', unexpected_files: unexpected, actual_dirty_files: dirty };
  if (!verification || verification.branch_drift === true || clean(verification.branch, 200) !== branch) return { sufficient: false, reason: 'BRIDGE_VERIFICATION_BRANCH_INVALID' };
  if (!verification.syntax_check || verification.syntax_check.passed !== true) return { sufficient: false, reason: 'SYNTAX_CHECK_FAILED_OR_MISSING' };
  const touched = Array.isArray(verification.files_changed) ? verification.files_changed : [];
  if (!touched.length) return { sufficient: false, reason: 'NO_DISPATCH_FILES_CHANGED' };
  const evidenceUnexpected = [...touched, ...(verification.pre_existing_dirty_files || [])].filter((f) => !allowed.has(f));
  if (evidenceUnexpected.length) return { sufficient: false, reason: 'VERIFICATION_OUTSIDE_WAVE_ALLOWLIST', unexpected_files: [...new Set(evidenceUnexpected)] };
  const forbiddenHits = scanWorkingTree(repo, entries);
  if (forbiddenHits.length) return { sufficient: false, reason: 'FORBIDDEN_PATTERN_IN_WORKING_TREE', forbidden_hits: forbiddenHits };
  const checkResults = entry.required_checks.map((c) => runCheck(repo, c));
  const failed = checkResults.filter((c) => !c.passed);
  if (failed.length) return { sufficient: false, reason: 'REQUIRED_CHECK_FAILED', failed_checks: failed.map((x) => x.command), check_results: checkResults };
  return { sufficient: true, reason: null, program: String(program).toUpperCase(), wave_index: Number(wave_index), actual_dirty_files: dirty, expected_files: [...allowed], required_checks: checkResults };
}

export function jarvisWorkingTreeWaveEvidenceManifestV1() {
  return { schema: 'aurentara.jarvis.working-tree-wave-evidence.v1', registry_allowlist_enforced: true, required_checks_executed_by_trusted_process: true, protected_branch_refused: true, destructive_status_refused: true, forbidden_effect_scan: true, production_deploy: false, hamyren_data_flow: false };
}
