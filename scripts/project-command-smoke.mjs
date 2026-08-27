import assert from 'node:assert/strict';
import fs from 'node:fs';
import { validateCommandState, commandSnapshot, applyCommand, buildWorkerHandoff } from '../src/project-command.js';

const state = JSON.parse(fs.readFileSync(new URL('../config/project-command.json', import.meta.url), 'utf8'));
assert.equal(validateCommandState(state).ok, true);
const snapshot = commandSnapshot(state);
assert.equal(snapshot.ok, true);
assert.equal(snapshot.production_deploy, false);
assert.ok(snapshot.workers.some((worker) => worker.id === 'ai-factory' && worker.status === 'DONE'));

const held = applyCommand(state, { worker_id:'project-v', action:'HOLD', next_action:'await command' });
assert.equal(held.ok, true);
assert.equal(held.state.workers['project-v'].status, 'HOLD');
assert.equal(held.state.production_deploy, false);
const resumed = applyCommand(held.state, { worker_id:'project-v', action:'GO', next_action:'continue approved block' });
assert.equal(resumed.ok, true);
assert.equal(resumed.state.workers['project-v'].status, 'RUNNING');

const handoff = buildWorkerHandoff(state, 'ai-factory');
assert.equal(handoff.ok, true);
assert.equal(handoff.human_go_required, true);
assert.equal(handoff.automatic_dispatch, false);
assert.equal(handoff.production_deploy, false);

const invalid = structuredClone(state);
invalid.production_deploy = true;
assert.equal(validateCommandState(invalid).ok, false);
console.log('Project Command v1 smoke: OK');
