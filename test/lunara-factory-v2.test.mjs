import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import worker, {verifyStripeSignature} from '../src/lunara-factory-v2/worker.mjs';
globalThis.crypto ||= webcrypto;

async function stripeHeader(raw,secret, timestamp=Math.floor(Date.now()/1000)) {
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const bytes=new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(String(timestamp)+'.'+raw)));
  const hex=[...bytes].map(x=>x.toString(16).padStart(2,'0')).join('');
  return 't='+timestamp+',v1='+hex;
}

test('valid signed Stripe webhook HMAC accepted', async () => {
  const raw='{"type":"checkout.session.completed"}',secret='test-secret',header=await stripeHeader(raw,secret);
  assert.equal(await verifyStripeSignature(raw,header,secret),true);
});
test('Stripe tampered payload rejected',async()=>{
  const secret='test-secret',header=await stripeHeader('{"paid":true}',secret);
  assert.equal(await verifyStripeSignature('{"paid":false}',header,secret),false);
});
test('Stripe old timestamp rejected',async()=>{
  const raw='{}',secret='test-secret',header=await stripeHeader(raw,secret,Math.floor(Date.now()/1000)-4000);
  assert.equal(await verifyStripeSignature(raw,header,secret),false);
});
test('health reports fail-closed staging flags',async()=>{
  const response=await worker.fetch(new Request('https://lunara.invalid/health'),{});
  assert.equal(response.status,200);
  assert.deepEqual(await response.json(),{name:'lunara-factory-v2',mode:'private-staging',checkout:false,make:false});
});
test('checkout unavailable by default',async()=>{
  const response=await worker.fetch(new Request('https://lunara.invalid/api/checkout',{method:'POST'}),{});
  assert.equal(response.status,423);
});
test('retired alternative webhook rejects even without configuration',async()=>{
  const response=await worker.fetch(new Request('https://lunara.invalid/api/webhooks/stripe',{method:'POST',body:'{}'}),{});
  assert.equal(response.status,410);
  assert.deepEqual(await response.json(),{error:'payment_route_retired',fulfillment:false});
});
test('retired webhook cannot claim or dispatch even with valid signature and enabled flags',async()=>{
  const secret='synthetic-only';
  const raw=JSON.stringify({type:'checkout.session.completed',livemode:false,data:{object:{
    id:'cs_test_synthetic',object:'checkout.session',livemode:false,mode:'payment',payment_status:'paid',
    amount_total:1290,currency:'eur',client_reference_id:'00000000-0000-4000-8000-000000000028'
  }}});
  const header=await stripeHeader(raw,secret);
  let dbCalls=0, networkCalls=0;
  const previousFetch=globalThis.fetch;
  globalThis.fetch=async()=>{networkCalls++;throw Error('Unexpected outbound request');};
  const env={DB:{prepare(){dbCalls++;throw Error('Unexpected D1 access');}},
    STRIPE_WEBHOOK_SECRET:secret,STRIPE_SECRET_KEY:'sk_test_synthetic',MAKE_DISPATCH_ENABLED:'true',
    MAKE_WEBHOOK_URL:'https://hook.make.com/synthetic',MAKE_WEBHOOK_API_KEY:'synthetic'};
  try {
    const replies=await Promise.all(Array.from({length:16},()=>worker.fetch(new Request(
      'https://lunara.invalid/api/webhooks/stripe',{method:'POST',body:raw,headers:{'stripe-signature':header}}
    ),env)));
    assert.ok(replies.every(r=>r.status===410));
    assert.equal(dbCalls,0);assert.equal(networkCalls,0);
  } finally {globalThis.fetch=previousFetch;}
});
test('success URLs and alternate webhook methods never access D1',async()=>{
  const env={DB:{prepare(){throw Error('Success-page bypass');}}};
  for(const path of ['/success?session_id=cs_test_synthetic','/?test_checkout=completed','/api/webhooks/stripe?paid=true']) {
    const response=await worker.fetch(new Request('https://lunara.invalid'+path),env);
    assert.ok([404,410].includes(response.status));
  }
});
test('admin endpoint rejects missing token without returning customer data',async()=>{
  const response=await worker.fetch(new Request('https://lunara.invalid/api/admin/orders/11111111-1111-1111-1111-111111111111/status'),{});
  assert.equal(response.status,401);
});
