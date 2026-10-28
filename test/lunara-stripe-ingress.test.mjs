import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import ingress from '../src/lunara-factory-v2/stripe-test-ingress.mjs';

globalThis.crypto ||= webcrypto;

const ORDER_ID = '00000000-0000-4000-8000-000000000028';
const SESSION_ID = 'cs_test_synthetic_ingress_06';
const SECRET = 'whsec_synthetic_not_a_real_stripe_secret';

function makeDb(status='pending_payment') {
  const row = {order_id:ORDER_ID, stripe_session_id:SESSION_ID, product:'story_pdf', status};
  let successfulPaidClaims=0;
  const diagnostics=new Map();
  return {
    row, diagnostics,
    get successfulPaidClaims(){return successfulPaidClaims;},
    prepare(sql) {
      return {
        bind(...values) {
          return {
            async first() {
              assert.match(sql,/^SELECT stripe_session_id,status,product FROM lunara_orders/);
              return values[0]===ORDER_ID ? {...row} : null;
            },
            async run() {
              if(sql.startsWith('UPDATE lunara_orders')) {
                if(values[0]===row.order_id && values[1]===row.stripe_session_id && row.status==='pending_payment') {
                  row.status='paid'; successfulPaidClaims++;
                  return {meta:{changes:1}};
                }
                return {meta:{changes:0}};
              }
              if(sql.includes('INSERT INTO lunara_webhook_diagnostic')) {
                diagnostics.set(values[0],(diagnostics.get(values[0])||0)+1);
                return {meta:{changes:1}};
              }
              throw new Error('Unexpected D1 write in checkout test');
            }
          };
        }
      };
    }
  };
}

function makeEvent(overrides={}) {
  const session={
    id:SESSION_ID,object:'checkout.session',livemode:false,mode:'payment',
    payment_status:'paid',client_reference_id:ORDER_ID,amount_total:1290,currency:'eur',
    ...overrides.session
  };
  return {
    id:'evt_synthetic_06',type:'checkout.session.completed',livemode:false,
    data:{object:session},...Object.fromEntries(Object.entries(overrides).filter(([k])=>k!=='session'))
  };
}

async function signature(raw, secret=SECRET, timestamp=Math.floor(Date.now()/1000)) {
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const bytes=new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(timestamp+'.'+raw)));
  return 't='+timestamp+',v1='+[...bytes].map(x=>x.toString(16).padStart(2,'0')).join('');
}
function environment(db=makeDb()) {return {DB:db,STRIPE_WEBHOOK_SECRET:SECRET};}
async function deliver(env, event=makeEvent(), options={}) {
  const raw=options.raw??JSON.stringify(event);
  const headers = options.header===false ? {} : {'stripe-signature':options.header??await signature(raw,options.secret??SECRET,options.timestamp)};
  const request=new Request('https://test.invalid'+(options.path??'/stripe'),{method:options.method??'POST',headers,body:options.method==='GET'?undefined:raw});
  const response=await ingress.fetch(request,env);
  return {status:response.status,body:await response.json()};
}

test('signed paid test event performs exactly one atomic D1 claim',async()=>{
  const db=makeDb(),env=environment(db);
  const result=await deliver(env);
  assert.equal(result.status,200);assert.equal(result.body.recorded,true);
  assert.equal(result.body.fulfillment,false);
  assert.equal(db.row.status,'paid');assert.equal(db.successfulPaidClaims,1);
});
test('same signed event replay does not claim twice or dispatch',async()=>{
  const db=makeDb(),env=environment(db);
  await deliver(env);const again=await deliver(env);
  assert.equal(again.status,200);assert.equal(again.body.duplicate,true);
  assert.equal(again.body.fulfillment,false);assert.equal(db.successfulPaidClaims,1);
});
test('concurrent callbacks claim at most once',async()=>{
  const db=makeDb(),env=environment(db);
  const results=await Promise.all(Array.from({length:16},()=>deliver(env)));
  assert.equal(results.filter(x=>x.body.recorded===true).length,1);
  assert.equal(db.successfulPaidClaims,1);
  assert.ok(results.every(x=>x.status===200));
});
test('wrong amount cannot change order',async()=>{
  const db=makeDb();const r=await deliver(environment(db),makeEvent({session:{amount_total:1}}));
  assert.equal(r.status,409);assert.equal(r.body.error,'payment_mismatch');assert.equal(db.successfulPaidClaims,0);
});
test('wrong currency cannot change order',async()=>{
  const db=makeDb();const r=await deliver(environment(db),makeEvent({session:{currency:'usd'}}));
  assert.equal(r.status,409);assert.equal(db.successfulPaidClaims,0);
});
test('unknown order cannot change order',async()=>{
  const db=makeDb();const r=await deliver(environment(db),makeEvent({session:{client_reference_id:'11111111-1111-4111-8111-111111111111'}}));
  assert.equal(r.status,409);assert.equal(r.body.error,'unknown_checkout');assert.equal(db.successfulPaidClaims,0);
});
test('wrong Stripe Checkout session cannot change order',async()=>{
  const db=makeDb();const r=await deliver(environment(db),makeEvent({session:{id:'cs_test_wrong'}}));
  assert.equal(r.status,409);assert.equal(db.successfulPaidClaims,0);
});
test('unpaid event cannot change order',async()=>{
  const db=makeDb();const r=await deliver(environment(db),makeEvent({session:{payment_status:'unpaid'}}));
  assert.equal(r.status,200);assert.equal(r.body.unpaid,true);assert.equal(db.successfulPaidClaims,0);
});
test('signed live-mode event cannot change test order',async()=>{
  const db=makeDb();const r=await deliver(environment(db),makeEvent({livemode:true}));
  assert.equal(r.status,403);assert.equal(db.successfulPaidClaims,0);
});
test('signed live-mode Checkout Session cannot change order',async()=>{
  const db=makeDb();const r=await deliver(environment(db),makeEvent({session:{livemode:true}}));
  assert.equal(r.body.unpaid,true);assert.equal(db.successfulPaidClaims,0);
});
test('expired signed event cannot change order',async()=>{
  const db=makeDb();const r=await deliver(environment(db),makeEvent(),{timestamp:Math.floor(Date.now()/1000)-301});
  assert.equal(r.status,400);assert.equal(r.body.error,'invalid_signature');assert.equal(db.successfulPaidClaims,0);
});
test('modified original bytes fail signature',async()=>{
  const db=makeDb();const original=JSON.stringify(makeEvent());
  const signedHeader=await signature(original);
  const modified=original.replace('"amount_total":1290','"amount_total":9999');
  const r=await deliver(environment(db),null,{raw:modified,header:signedHeader});
  assert.equal(r.status,400);assert.equal(db.successfulPaidClaims,0);
});
test('wrong signature key cannot change order',async()=>{
  const db=makeDb();const r=await deliver(environment(db),makeEvent(),{secret:'whsec_wrong'});
  assert.equal(r.status,400);assert.equal(db.successfulPaidClaims,0);
});
test('invalid/missing signature cannot change order',async()=>{
  const db=makeDb();const r=await deliver(environment(db),makeEvent(),{header:false});
  assert.equal(r.status,400);assert.equal(db.successfulPaidClaims,0);
});
test('a success-page request never records payment',async()=>{
  const db=makeDb();const r=await deliver(environment(db),makeEvent(),{path:'/?test_checkout=completed'});
  assert.equal(r.status,404);assert.equal(db.successfulPaidClaims,0);
});
test('async payment success follows same gate and does not create second claim',async()=>{
  const db=makeDb(),env=environment(db);
  const asyncPaid=makeEvent({type:'checkout.session.async_payment_succeeded'});
  const first=await deliver(env,asyncPaid);const second=await deliver(env,makeEvent());
  assert.equal(first.body.recorded,true);assert.equal(second.body.duplicate,true);assert.equal(db.successfulPaidClaims,1);
});
test('unrelated signed event is ignored without a claim',async()=>{
  const db=makeDb();const r=await deliver(environment(db),makeEvent({type:'charge.succeeded'}));
  assert.equal(r.status,200);assert.equal(r.body.ignored,true);assert.equal(db.successfulPaidClaims,0);
});
test('no database or secret is always fail-closed',async()=>{
  const db=makeDb();const r=await deliver({DB:db},makeEvent());
  assert.equal(r.status,503);assert.equal(db.successfulPaidClaims,0);
});
test('non-pending orders cannot be re-claimed',async()=>{
  const db=makeDb('dispatching');const r=await deliver(environment(db),makeEvent());
  assert.equal(r.body.duplicate,true);assert.equal(db.successfulPaidClaims,0);
});
