import assert from 'node:assert/strict';
import { executeSafeAutomation } from '../src/automation-executor.js';

const safe = executeSafeAutomation({ goal:'Process qualified leads', steps:[
  { id:'in', type:'input' },
  { id:'qualified', type:'filter', config:{ field:'qualified', equals:true } },
  { id:'emails', type:'map', config:{ field:'email' } },
  { id:'out', type:'output' }
]}, [{email:'a@example.test',qualified:true},{email:'b@example.test',qualified:false}]);
assert.equal(safe.ok, true);
assert.equal(safe.status, 'COMPLETED');
assert.deepEqual(safe.outputs.result, ['a@example.test']);
assert.equal(safe.production_deploy, false);

const blocked = executeSafeAutomation({ goal:'Send lead', steps:[
  { id:'in', type:'input' }, { id:'send', type:'webhook', config:{ url:'https://example.test/hook' } }
]}, { id:1 });
assert.equal(blocked.ok, false);
assert.equal(blocked.status, 'BLOCKED_EXTERNAL_SIDE_EFFECT');
assert.equal(blocked.trace.at(-1).status, 'BLOCKED');
assert.equal(blocked.production_deploy, false);

const conditional = executeSafeAutomation({ goal:'Gate data', steps:[
  { id:'in', type:'input' }, { id:'gate', type:'condition', config:{ field:'approved', equals:true } }, { id:'out', type:'output' }
]}, { approved:false, value:7 });
assert.equal(conditional.ok, true);
assert.equal(conditional.outputs.condition_matched, false);
console.log('automation-executor-smoke: ok');
