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
 if(!/^application\/json(?:;|$)/i.test(req.headers.get('content-type')||''))return json({error:'json_only'},415);
 const body=await req.text();if(body.length>50000)return json({error:'too_large'},413);
 let payload;try{payload=JSON.parse(body)}catch{return json({error:'bad_json'},400)}
 if(payload?.schema!=='lunara.story.qa.v1'||payload?.mode!=='sandbox'||payload.qa_pass!==true)return json({error:'qa_or_schema_invalid'},422);
 const name=String(payload.child_name||'').trim(),title=String(payload.story_title||'').trim(),story=String(payload.story_text||payload.story_body_continuous||'').trim(),ending=String(payload.ending_text||'').trim();
 if(name.length<2||name.length>45||title.length<7||title.length>200||story.length<300||story.length>42000||ending.length>1500)return json({error:'content_invalid'},422);
 // Synthetic-only restriction: no real-child data or real-order dispatch in this staging endpoint.
 if(payload.synthetic!==true)return json({error:'synthetic_only'},403);
 const key=await hash(bearer);
 try{
  const reserve=await env.DB.prepare("UPDATE lunara_story_import_tokens SET claimed_at=CURRENT_TIMESTAMP WHERE story_id=? AND token_hash=? AND claimed_at IS NULL AND expires_at>unixepoch()")
    .bind(parts[1],key).run();
  if(reserve.meta?.changes!==1)return json({error:'expired_or_replayed'},409);
  await env.DB.prepare("INSERT INTO lunara_story_previews(story_id,child_name,story_title,story_text,source,qa_pass,is_synthetic,expires_at) VALUES(?,?,?,?,?,1,1,unixepoch()+30*86400)")
    .bind(parts[1],name,title,story+(ending?'\n\n'+ending:''),'make_qa_original',).run();
  return json({ok:true,stored:true,story_id:parts[1],characters:story.length},201);
 }catch{return json({error:'staging_import_failed'},503)}
}};
