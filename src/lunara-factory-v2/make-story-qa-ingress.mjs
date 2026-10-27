// LUNARA V2 | Test-only ingress for already QA-approved original Make stories.
// This endpoint never runs AI, charges a card, or sends mail.
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','x-robots-tag':'noindex,nofollow,noarchive'}});
const slug=/^[a-z0-9][a-z0-9-]{7,99}$/;
const tokenPattern=/^[a-zA-Z0-9_-]{43,128}$/;
async function hash(input){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(input));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('');}
export default {async fetch(req,env){
 const uri=new URL(req.url);
 if(req.method==='GET'&&uri.pathname==='/health')return json({service:'lunara-story-import',stage:'synthetic-only',qa_required:true});
 const parts=uri.pathname.match(/^\/v1\/import\/([a-z0-9-]{8,100})$/);
 if(req.method!=='POST'||!parts||!slug.test(parts[1]))return json({error:'not_found'},404);
 if(!env.DB)return json({error:'not_configured'},503);
 const bearer=req.headers.get('X-Lunara-Story-Token')||'';
 if(!tokenPattern.test(bearer))return json({error:'unauthorized'},403);
 const contentType=req.headers.get('content-type')||'';
 if(Number(req.headers.get('content-length')||'0')>50000)return json({error:'too_large'},413);
 let payload;
 if(/^multipart\/form-data;/i.test(contentType)){
   try{const form=await req.formData();payload=Object.fromEntries([...form.entries()].filter(([k,v])=>typeof v==='string'));}catch{return json({error:'bad_form'},400)}
 } else if(/^application\/json(?:;|$)/i.test(contentType)){
   const body=await req.text();if(body.length>50000)return json({error:'too_large'},413);
   try{payload=JSON.parse(body)}catch{return json({error:'bad_json'},400)}
 } else return json({error:'json_or_form_required'},415);
 if(payload?.schema!=='lunara.story.qa.v1'||payload?.mode!=='sandbox'||String(payload.qa_pass)!=='true')return json({error:'qa_or_schema_invalid'},422);
 const name=String(payload.child_name||'').trim(),title=String(payload.story_title||'').trim(),story=String(payload.story_text||payload.story_body_continuous||'').trim(),ending=String(payload.ending_text||'').trim();
 if(name.length<2||name.length>45||title.length<7||title.length>200||story.length<300||story.length>42000||ending.length>1500)return json({error:'content_invalid'},422);
 // Synthetic-only restriction: no real-child data or real-order dispatch in this staging endpoint.
 if(String(payload.synthetic)!=='true')return json({error:'synthetic_only'},403);
 const key=await hash(bearer);
 const sourceType=payload.source==='synthetic_transport_test'?'synthetic_transport_test':'make_qa_original';
 const fullText=story+(ending?'\n\n'+ending:'');
 try{
  // The unique story_id is the concurrency guard. No token is consumed on a failed insert.
  const inserted=await env.DB.prepare("INSERT OR IGNORE INTO lunara_story_previews(story_id,child_name,story_title,story_text,source,qa_pass,is_synthetic,expires_at) SELECT ?,?,?,?,?,1,1,unixepoch()+30*86400 WHERE EXISTS (SELECT 1 FROM lunara_story_import_tokens WHERE story_id=? AND token_hash=? AND claimed_at IS NULL AND expires_at>unixepoch())")
    .bind(parts[1],name,title,fullText,sourceType,parts[1],key).run();
  if(inserted.meta?.changes!==1)return json({error:'expired_replayed_or_exists'},409);
  await env.DB.prepare("UPDATE lunara_story_import_tokens SET claimed_at=CURRENT_TIMESTAMP WHERE story_id=? AND token_hash=? AND claimed_at IS NULL")
    .bind(parts[1],key).run();
  return json({ok:true,stored:true,story_id:parts[1],characters:fullText.length},201);
 }catch{return json({error:'staging_import_failed'},503)}
}};
