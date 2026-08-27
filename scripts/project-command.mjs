#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { applyCommand, buildWorkerHandoff, commandSnapshot, validateCommandState } from '../src/project-command.js';

const DEFAULT_STATE = path.resolve('config/project-command.json');

function readState(file = DEFAULT_STATE) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeState(file, state) {
  const tmp = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  fs.renameSync(tmp, file);
}

function usage() {
  console.error('Usage: node scripts/project-command.mjs <status|handoff|apply> [args]');
  console.error('  status [state-file]');
  console.error('  handoff <worker-id> [state-file]');
  console.error('  apply <worker-id> <GO|HOLD|COMPLETE|BLOCK|WAIT|READY> [next-action] [state-file]');
  process.exit(2);
}

const [, , command, ...args] = process.argv;
if (!command) usage();

if (command === 'status') {
  const file = args[0] ? path.resolve(args[0]) : DEFAULT_STATE;
  const state = readState(file);
  const result = commandSnapshot(state);
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.ok ? 0 : 1);
}

if (command === 'handoff') {
  const workerId = args[0];
  if (!workerId) usage();
  const file = args[1] ? path.resolve(args[1]) : DEFAULT_STATE;
  const result = buildWorkerHandoff(readState(file), workerId);
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.ok ? 0 : 1);
}

if (command === 'apply') {
  const workerId = args[0];
  const action = args[1];
  if (!workerId || !action) usage();
  const nextAction = args[2] || undefined;
  const file = args[3] ? path.resolve(args[3]) : DEFAULT_STATE;
  const state = readState(file);
  const checked = validateCommandState(state);
  if (!checked.ok) {
    console.error(JSON.stringify(checked, null, 2));
    process.exit(1);
  }
  const result = applyCommand(state, { worker_id: workerId, action, next_action: nextAction });
  if (!result.ok) {
    console.error(JSON.stringify(result, null, 2));
    process.exit(1);
  }
  writeState(file, result.state);
  console.log(JSON.stringify({ ok: true, event: result.event, state_file: file }, null, 2));
  process.exit(0);
}

usage();
