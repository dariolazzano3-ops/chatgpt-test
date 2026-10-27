// LUNARA V2 Stripe Test Webhook Ingress
// Stripe-only endpoint. Does not accept live mode or trigger Make/fulfillment.
const resp=(o,status=200)=>new Response(JSON.stringify(o),{status,headers:{'content-type':'application/json','cache-control':'no-store','x-robots-tag':'noindex,nofollow','x-content-type-options':'nosniff'}});
function timingEqual(x,y){ if(x.length!==y.length)return false;let diff=0;for(let i=0;i<x.length;i++)diff|=x.charCodeAt(i)^y.charCodeAt(i);return diff===0; }
export async function signed(body,header,secret,now=Date.now()) {
  if(!secret||!header)return false;
  const ts=header.split(',').map(v=>v.trim()).find(v=>/^t=\d+$/.test(v));
  if(!ts)return false;
  const sec=Number(ts.slice(2));
  if(!Number.isSafeInteger(sec)||Math.abs(Math.floor(now/1000)-sec)>300)return false;
  const k=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const h=await crypto.subtle.sign('HMAC',k,new TextEncoder().encode(sec+'.'+body));
  const digest=[...new Uint8Array(h)].map(b=>b.toString(16).padStart(2,'0')).join('');
  return header.split(',').some(v=>{const s=v.trim();return /^v1=[0-9a-f]{64}$/i.test(s)&&timingEqual(s.slice(3).toLowerCase(),digest);});
}
async function handleStripe(request,env){
    const path=new URL(request.url).pathname;
    if(request.method==='GET'&&path==='/health')return resp({service:'lunara-stripe-ingress',mode:'test-only',fulfillment:false});
    if(request.method!=='POST'||path!=='/stripe')return resp({error:'not_found'},404);
    if(!env.DB||!env.STRIPE_WEBHOOK_SECRET)return resp({error:'not_configured'},503);
    const raw=await request.text();if(raw.length>100000)return resp({error:'too_large'},413);
    if(!await signed(raw,request.headers.get('stripe-signature'),env.STRIPE_WEBHOOK_SECRET))return resp({error:'invalid_signature'},400);
    let event;try{event=JSON.parse(raw);}catch{return resp({error:'invalid_json'},400);}
    if(event?.livemode!==false)return resp({error:'test_events_only'},403);
    if(!['checkout.session.completed','checkout.session.async_payment_succeeded'].includes(event.type))return resp({ok:true,ignored:true});
    const s=event.data?.object;
    if(s?.object!=='checkout.session'||s?.livemode!==false||s?.mode!=='payment'||s?.payment_status!=='paid')return resp({ok:true,unpaid:true});
    if(typeof s.client_reference_id!=='string'||!s.client_reference_id.match(/^[0-9a-f-]{36}$/i)||typeof s.id!=='string')return resp({error:'invalid_session'},400);
    const row=await env.DB.prepare('SELECT stripe_session_id,status,product FROM lunara_orders WHERE order_id=?').bind(s.client_reference_id).first();
    if(!row||row.stripe_session_id!==s.id)return resp({error:'unknown_checkout'},409);
    const allowedAmount=row.product==='story_pdf'?1290:null;
    if(allowedAmount===null||s.amount_total!==allowedAmount||s.currency!=='eur')return resp({error:'payment_mismatch'},409);
    if(row.status!=='pending_payment')return resp({ok:true,duplicate:true,fulfillment:false});
    const written=await env.DB.prepare("UPDATE lunara_orders SET status='paid',paid_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE order_id=? AND stripe_session_id=? AND status='pending_payment'").bind(s.client_reference_id,s.id).run();
    return resp({ok:true,recorded:!!written.meta?.changes,fulfillment:false});
}

// Diagnostic counters for Stripe's test webhook only. No payloads, signatures, IPs or personal data stored.
const reasons=new Set(['not_configured','too_large','invalid_signature','invalid_json','test_events_only','unpaid','invalid_session','unknown_checkout','payment_mismatch','duplicate','recorded','ignored','not_found','other']);
export default {
 async fetch(request,env){
  const response=await handleStripe(request,env);
  if(request.method==='POST' && new URL(request.url).pathname==='/stripe' &&
      request.headers.has('stripe-signature') && env.DB){
   try{
    const data=await response.clone().json();
    const kind= data.error || (data.recorded?'recorded':data.duplicate?'duplicate':data.ignored?'ignored':'other');
    const reason=reasons.has(kind)?kind:'other';
    await env.DB.prepare(
       "INSERT INTO lunara_webhook_diagnostic(reason,count,last_seen) VALUES(?,1,CURRENT_TIMESTAMP) ON CONFLICT(reason) DO UPDATE SET count=count+1,last_seen=CURRENT_TIMESTAMP"
    ).bind(reason).run();
   }catch { /* Diagnostics must never alter Stripe HTTP acknowledgement. */ }
  }
  return response;
 }
};
