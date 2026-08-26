import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  }
  return value;
}

function fingerprint(requestPath) {
  const parsed = JSON.parse(fs.readFileSync(requestPath, 'utf8'));
  const canonical = JSON.stringify(stable(parsed));
  return crypto.createHash('sha256').update(canonical).digest('hex');
}

function readLedger(ledgerPath) {
  if (!fs.existsSync(ledgerPath)) return { version: 1, requests: {} };
  const parsed = JSON.parse(fs.readFileSync(ledgerPath, 'utf8'));
  if (!parsed.requests || typeof parsed.requests !== 'object') parsed.requests = {};
  return parsed;
}

function emit(name, value) {
  if (!process.env.GITHUB_OUTPUT) return;
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${String(value ?? '')}\n`);
}

const [command, requestPath, ledgerPath = 'factory-state/request-ledger.json', metadataPath] = process.argv.slice(2);
if (!command || !requestPath) throw new Error('USAGE: request-idempotency.mjs <check|record> <request.json> [ledger.json] [metadata.json]');

const key = fingerprint(requestPath);
const ledger = readLedger(ledgerPath);

if (command === 'check') {
  const hit = ledger.requests[key] || null;
  const result = { key, duplicate: Boolean(hit), prior: hit };
  console.log(JSON.stringify(result, null, 2));
  emit('request_key', key);
  emit('duplicate', hit ? 'true' : 'false');
  emit('existing_preview_url', hit?.preview_url || '');
  emit('existing_project_path', hit?.project_path || '');
  emit('existing_branch', hit?.branch || '');
  emit('existing_pr_url', hit?.pr_url || '');
  process.exit(0);
}

if (command === 'record') {
  if (!metadataPath) throw new Error('METADATA_PATH_REQUIRED');
  const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
  ledger.version = 1;
  ledger.requests[key] = {
    request_key: key,
    completed_at: new Date().toISOString(),
    mode: metadata.mode || null,
    project_path: metadata.project_path || null,
    branch: metadata.branch || null,
    pr_url: metadata.pr_url || null,
    preview_url: metadata.preview_url || null,
    qa_only: metadata.qa_only === true,
    production_deployed: false
  };
  fs.mkdirSync(path.dirname(ledgerPath), { recursive: true });
  fs.writeFileSync(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`);
  console.log(JSON.stringify(ledger.requests[key], null, 2));
  process.exit(0);
}

throw new Error(`UNKNOWN_COMMAND:${command}`);
