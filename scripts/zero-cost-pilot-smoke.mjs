import assert from 'node:assert/strict';
import { createZeroCostPilot, evaluatePilotAction } from '../src/zero-cost-pilot.js';

const created=createZeroCostPilot({customer_id:'baeckerei-mueller',project_id:'digital-system-v1'});
assert.equal(created.ok,true);
const pilot=created.pilot;
assert.equal(evaluatePilotAction(pilot,{type:'compile',estimated_cost:0}).ok,true);
const paid=evaluatePilotAction(pilot,{type:'ai-provider',paid:true,estimated_cost:0.01});
assert.equal(paid.ok,false);
assert.equal(paid.user_action_required,true);
assert.equal(evaluatePilotAction(pilot,{type:'crm-write',external_write:true}).ok,false);
assert.equal(evaluatePilotAction(pilot,{type:'deploy',production:true}).ok,false);
console.log('RIOSYSTEMS_ZERO_COST_PILOT_OK');
