// LUNARA V2: narrow sandbox PDF upload ingress.
// Authentication: short-lived, single-use 256-bit token; its SHA-256 lives in D1.
// Only PUT /v1/upload/<order_id>; no public download routes, no customer data logs.
const headers={'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','x-robots-tag':'noindex,nofollow,noarchive'};
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers});
const idPattern=/^[A-Za-z0-9][A-Za-z0-9-]{19,99}$/;
const tokenPattern=/^[A-Za-z0-9_-]{38,128}$/;
async function digest(token) {
 const bytes=new TextEncoder().encode(token);
 const hash=await crypto.subtle.digest('SHA-256',bytes);
 return Array.from(new Uint8Array(hash),x=>x.toString(16).padStart(2,'0')).join('');
}
export default {
 async fetch(req,env){
  const u=new URL(req.url);
  if(req.method==='GET'&&u.pathname==='/health')
    return json({service:'lunara-v2-pdf-upload',status:'sandbox-only',readable:false,payments:false});
  // Claim must happen before any expensive generation: exactly one run per order.
  const claimMatch=/^\/v1\/claim\/([^/]+)$/.exec(u.pathname);
  if(req.method==='POST'&&claimMatch&&idPattern.test(claimMatch[1])){
    if(!env.DB)return json({error:'not_configured'},503);
    const token=req.headers.get('X-Lunara-Upload-Token')||'';
    if(!tokenPattern.test(token))return json({error:'unauthorized'},403);
    const hash=await digest(token);
    try{
      const claim=await env.DB.prepare(
        "INSERT OR IGNORE INTO lunara_production_claims(order_id) SELECT order_id FROM lunara_pdf_jobs WHERE order_id=? AND status='reserved' AND upload_token_hash=? AND upload_expires_at>unixepoch()"
      ).bind(claimMatch[1],hash).run();
      if(claim.meta?.changes!==1)return json({error:'already_claimed_or_expired'},409);
      return json({ok:true,claimed:true,order_id:claimMatch[1]},201);
    }catch{return json({error:'claim_unavailable'},503);}
  }
  const match=/^\/v1\/upload\/([^/]+)$/.exec(u.pathname);
  if(req.method!=='PUT'||!match||!idPattern.test(match[1]))return json({error:'not_found'},404);
  if(!env.DB||!env.PDFS)return json({error:'not_configured'},503);
  const orderId=match[1];
  const bearer=req.headers.get('X-Lunara-Upload-Token')||'';
  if(!tokenPattern.test(bearer))return json({error:'unauthorized'},403);
  if((req.headers.get('content-type')||'').split(';')[0].trim().toLowerCase()!=='application/pdf')
     return json({error:'pdf_required'},415);
  const declared=Number(req.headers.get('content-length')||0);
  if(declared>2_000_000)return json({error:'file_too_large'},413);
  let buffer;
  try{buffer=await req.arrayBuffer();}catch{return json({error:'invalid_upload'},400);}
  if(buffer.byteLength<50||buffer.byteLength>2_000_000)return json({error:'invalid_pdf_length'},413);
  const bytes=new Uint8Array(buffer);
  const prefix=new TextDecoder().decode(bytes.slice(0,5));
  if(prefix!=='%PDF-')return json({error:'invalid_pdf_header'},422);
  const tokenHash=await digest(bearer);
  // Atomically acquire the job before R2 writes. A duplicate claim cannot upload.
  let row;
  try{
    const selected=await env.DB.prepare(
      "SELECT status,object_key FROM lunara_pdf_jobs WHERE order_id=? AND upload_token_hash=? AND upload_expires_at>unixepoch()"
    ).bind(orderId,tokenHash).first();
    if(!selected||selected.status!=='reserved')return json({error:'invalid_or_used_token'},409);
    const validClaim=await env.DB.prepare("SELECT order_id FROM lunara_production_claims WHERE order_id=?").bind(orderId).first();
    if(!validClaim)return json({error:'production_not_claimed'},409);
    if(!selected.object_key||!selected.object_key.startsWith('sandbox/')||!selected.object_key.endsWith('.pdf'))
      return json({error:'invalid_object_key'},409);
    const claim=await env.DB.prepare(
      "UPDATE lunara_pdf_jobs SET status='uploading',upload_token_hash=NULL,upload_expires_at=NULL,updated_at=CURRENT_TIMESTAMP WHERE order_id=? AND status='reserved' AND upload_token_hash=? AND upload_expires_at>unixepoch()"
    ).bind(orderId,tokenHash).run();
    if(claim.meta?.changes!==1)return json({error:'already_claimed'},409);
    row=selected;
  }catch{return json({error:'reservation_unavailable'},503);}
  try{
    await env.PDFS.put(row.object_key,bytes,{
      httpMetadata:{contentType:'application/pdf',cacheControl:'private,no-store'},
      customMetadata:{project:'lunara-v2',stage:'sandbox',order_id:orderId}
    });
    const recorded=await env.DB.prepare(
      "UPDATE lunara_pdf_jobs SET status='stored',pdf_bytes=?,stored_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE order_id=? AND status='uploading'"
    ).bind(bytes.byteLength,orderId).run();
    if(recorded.meta?.changes!==1)return json({error:'storage_record_update_failed'},503);
    return json({ok:true,order_id:orderId,stored:true,bytes:bytes.byteLength},201);
  }catch {
    try{await env.DB.prepare("UPDATE lunara_pdf_jobs SET status='failed',updated_at=CURRENT_TIMESTAMP WHERE order_id=? AND status='uploading'").bind(orderId).run();}catch{}
    return json({error:'storage_failed_manual_review'},503);
  }
 }
};