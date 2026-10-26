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
test('webhook does not process without configured DB and signing secret',async()=>{
  const response=await worker.fetch(new Request('https://lunara.invalid/api/webhooks/stripe',{method:'POST',body:'{}'}),{});
  assert.equal(response.status,503);
});
test('admin endpoint rejects missing token without returning customer data',async()=>{
  const response=await worker.fetch(new Request('https://lunara.invalid/api/admin/orders/11111111-1111-1111-1111-111111111111/status'),{});
  assert.equal(response.status,401);
});
