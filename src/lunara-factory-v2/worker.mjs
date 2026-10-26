// LUNARA FACTORY V2 | isolated staging adapter. No automatic deployment.
// Never expose Stripe secrets or Make credentials to the browser.
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type':'application/json','Cache-Control':'no-store' } });
const enabled = (env, key) => env[key] === 'true';
const clean = (value, length = 120) => typeof value === 'string' ? value.trim().slice(0,length) : '';
const equals = (a,b) => {
  if (!a || !b || a.length !== b.length) return false;
  let difference=0; for(let i=0;i<a.length;i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
};
export async function verifyStripeSignature(payload, signature, secret, now = Date.now()) {
  if (!signature || !secret) return false;
  const parts = signature.split(',').map(x => x.trim());
  const timeString=parts.find(x=>x.startsWith('t='))?.slice(2);
  const time=Number(timeString);
  if (!Number.isSafeInteger(time) || Math.abs(Math.floor(now/1000)-time)>300) return false;
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const bytes=new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(timeString+'.'+payload)));
  const digest=[...bytes].map(x=>x.toString(16).padStart(2,'0')).join('');
  return parts.filter(x=>x.startsWith('v1=')).some(x=>equals(x.slice(3).toLowerCase(),digest));
}
function validate(input) {
  if (!input || Array.isArray(input) || typeof input !== 'object') return null;
  const product=clean(input.product,40), email=clean(input.email,254).toLowerCase();
  const child=clean(input.child_name,80), age=Number(input.child_age);
  if (!['story_pdf','story_audio'].includes(product) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !child || !Number.isInteger(age) || age<2 || age>12 || input.consent_to_processing!==true) return null;
  return {product,email,child_name:child,child_age:age,first_name:clean(input.first_name,80),
    plush_toy:clean(input.plush_toy,80),plush_toy_name:clean(input.plush_toy_name,80),
    hobby:clean(input.hobby,120),calming:clean(input.calming,120),dreamworld:clean(input.dreamworld,100)};
}
async function makeDispatch(env, orderId) {
  if (!enabled(env,'MAKE_DISPATCH_ENABLED')) return 'disabled';
  if (!env.DB || !env.MAKE_WEBHOOK_URL || !env.MAKE_WEBHOOK_API_KEY) return 'not_configured';
  let endpoint;
  try {endpoint=new URL(env.MAKE_WEBHOOK_URL);} catch{return 'invalid_make_url';}
  if (endpoint.protocol!=='https:' || !/^hook(?:\.[a-z0-9-]+)?\.make\.com$/.test(endpoint.hostname) || endpoint.username || endpoint.password) return 'invalid_make_url';
  const update=await env.DB.prepare("UPDATE lunara_orders SET status='dispatching',updated_at=CURRENT_TIMESTAMP WHERE order_id=? AND status='paid'").bind(orderId).run();
  if (!update.meta?.changes) return 'not_dispatchable';
  const record=await env.DB.prepare('SELECT payload_json FROM lunara_orders WHERE order_id=?').bind(orderId).first();
  let status='manual_review';
  try {
    const input=JSON.parse(record.payload_json);
    const response=await fetch(endpoint.href,{method:'POST',redirect:'error',headers:{'Content-Type':'application/json','x-make-apikey':env.MAKE_WEBHOOK_API_KEY},
      body:JSON.stringify({schema:'lunara.order.paid.v2',order_id:orderId,product:input.product,email:input.email,customer_first_name:input.first_name,
        child_name:input.child_name,child_age:input.child_age,plush_toy:input.plush_toy,plush_toy_name:input.plush_toy_name,
        hobby:input.hobby,calming:input.calming,dreamworld:input.dreamworld})});
    if(response.ok) status='dispatched'; // Accepted by Make, NOT confirmed PDF delivery.
  } catch { /* Unknown remote result. Never retry automatically. */ }
  await env.DB.prepare("UPDATE lunara_orders SET status=?,updated_at=CURRENT_TIMESTAMP WHERE order_id=? AND status='dispatching'").bind(status,orderId).run();
  return status;
}
export default {
  async fetch(request,env) {
    const u=new URL(request.url);
    if(request.method==='GET' && u.pathname==='/health') return json({name:'lunara-factory-v2',mode:'private-staging',checkout:enabled(env,'CHECKOUT_ENABLED'),make:enabled(env,'MAKE_DISPATCH_ENABLED')});
    if(request.method==='POST' && u.pathname==='/api/checkout') {
      if(!enabled(env,'CHECKOUT_ENABLED')) return json({error:'checkout_disabled'},423);
      if(!env.DB || !env.STRIPE_SECRET_KEY || !env.PUBLIC_SITE_URL || !env.STRIPE_PRICE_PDF) return json({error:'not_configured'},503);
      if(!request.headers.get('content-type')?.startsWith('application/json')) return json({error:'json_required'},415);
      const expected=new URL(env.PUBLIC_SITE_URL);
      if(expected.protocol!=='https:' || request.headers.get('origin')!==expected.origin) return json({error:'origin_denied'},403);
      const raw=await request.text();
      if(raw.length>12000) return json({error:'too_large'},413);
      let body; try {body=JSON.parse(raw);}catch{return json({error:'invalid_json'},400);}
      const data=validate(body);
      if(!data) return json({error:'invalid_order'},422);
      if(data.product==='story_audio' && !enabled(env,'AUDIO_ENABLED')) return json({error:'audio_disabled'},423);
      if(!env.STRIPE_SECRET_KEY.startsWith('sk_test_') && !enabled(env,'ALLOW_LIVE_PAYMENT')) return json({error:'live_payment_blocked'},423);
      const price=data.product==='story_pdf'?env.STRIPE_PRICE_PDF:env.STRIPE_PRICE_AUDIO;
      if(!/^price_[A-Za-z0-9]+$/.test(price||'')) return json({error:'invalid_price'},503);
      const id=crypto.randomUUID();
      await env.DB.prepare("INSERT INTO lunara_orders(order_id,product,payload_json,status) VALUES(?,?,?,'pending_payment')").bind(id,data.product,JSON.stringify(data)).run();
      const bodyParams=new URLSearchParams({mode:'payment',client_reference_id:id,customer_email:data.email,
        'line_items[0][price]':price,'line_items[0][quantity]':'1','metadata[lunara_order_id]':id,
        success_url:expected.origin+'/success?session_id={CHECKOUT_SESSION_ID}',cancel_url:expected.origin+'/checkout?cancelled=1'});
      try {
        const response=await fetch('https://api.stripe.com/v1/checkout/sessions',{method:'POST',headers:{authorization:'Bearer '+env.STRIPE_SECRET_KEY,'content-type':'application/x-www-form-urlencoded','Idempotency-Key':'lunara-'+id},body:bodyParams});
        if(!response.ok) throw Error('stripe_response');
        const session=await response.json();
        if(typeof session.id!=='string' || typeof session.url!=='string' || !session.url.startsWith('https://checkout.stripe.com/')) throw Error('stripe_payload');
        await env.DB.prepare('UPDATE lunara_orders SET stripe_session_id=?,updated_at=CURRENT_TIMESTAMP WHERE order_id=?').bind(session.id,id).run();
        return json({checkout_url:session.url});
      } catch {return json({error:'checkout_unavailable'},502);}
    }
    if(request.method==='POST' && u.pathname==='/api/webhooks/stripe') {
      if(!env.DB || !env.STRIPE_WEBHOOK_SECRET) return json({error:'not_configured'},503);
      const raw=await request.text();
      if(raw.length>100000) return json({error:'too_large'},413);
      if(!await verifyStripeSignature(raw,request.headers.get('stripe-signature'),env.STRIPE_WEBHOOK_SECRET)) return json({error:'invalid_signature'},400);
      let event; try{event=JSON.parse(raw);}catch{return json({error:'invalid_json'},400);}
      if(!['checkout.session.completed','checkout.session.async_payment_succeeded'].includes(event.type)) return json({ok:true,ignored:true});
      const s=event.data?.object;
      if(s?.payment_status!=='paid'||s?.mode!=='payment') return json({ok:true,waiting_for_payment:true});
      const id=s.client_reference_id;
      if(typeof id!=='string') return json({error:'missing_order'},400);
      const row=await env.DB.prepare('SELECT stripe_session_id,status FROM lunara_orders WHERE order_id=?').bind(id).first();
      if(!row || row.stripe_session_id!==s.id) return json({error:'unrecognized_session'},409);
      await env.DB.prepare("UPDATE lunara_orders SET status='paid',paid_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE order_id=? AND status='pending_payment'").bind(id).run();
      return json({ok:true,dispatch:await makeDispatch(env,id)});
    }
    if(u.pathname.startsWith('/api/admin/orders/')) {
      const token=request.headers.get('authorization')||'';
      if(!env.ADMIN_TOKEN || !equals(token,'Bearer '+env.ADMIN_TOKEN)) return json({error:'unauthorized'},401);
      const match=u.pathname.match(/^\/api\/admin\/orders\/([a-f0-9-]{36})\/(status|dispatch)$/);
      if(!match) return json({error:'invalid_path'},400);
      if(!env.DB) return json({error:'not_configured'},503);
      const id=match[1];
      if(request.method==='GET' && match[2]==='status') {
        const order=await env.DB.prepare('SELECT order_id,product,status,created_at,paid_at,updated_at FROM lunara_orders WHERE order_id=?').bind(id).first();
        return order?json(order):json({error:'not_found'},404);
      }
      if(request.method==='POST' && match[2]==='dispatch') {
        const order=await env.DB.prepare('SELECT status FROM lunara_orders WHERE order_id=?').bind(id).first();
        if(!order || order.status!=='paid') return json({error:'not_dispatchable'},409);
        return json({dispatch:await makeDispatch(env,id)});
      }
    }
    return json({error:'not_found'},404);
  }
};
