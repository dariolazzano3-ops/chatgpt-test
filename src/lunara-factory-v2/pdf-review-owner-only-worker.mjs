// LUNARA V2 | Owner-only PDF retrieval.
// Route must be protected by Cloudflare Access (owner allowlist) before public subdomain enable.
const headers={'content-type':'application/json','cache-control':'private,no-store','x-robots-tag':'noindex,nofollow,noarchive','x-content-type-options':'nosniff'};
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers});
export default {async fetch(req,env){
  const uri=new URL(req.url);
  if(req.method==='GET'&&uri.pathname==='/health')return json({service:'lunara-pdf-review',private:true});
  const match=/^\/v1\/pdf\/([A-Za-z0-9][A-Za-z0-9-]{19,99})$/.exec(uri.pathname);
  if(req.method!=='GET'||!match)return json({error:'not_found'},404);
  if(!env.DB||!env.PDFS)return json({error:'not_configured'},503);
  try{
    const row=await env.DB.prepare("SELECT object_key,pdf_bytes,status FROM lunara_pdf_jobs WHERE order_id=?").bind(match[1]).first();
    if(!row||row.status!=='stored'||!row.object_key?.startsWith('sandbox/'))return json({error:'not_found'},404);
    const object=await env.PDFS.get(row.object_key);
    if(!object)return json({error:'not_found'},404);
    const filename='LUNARA_TEST_'+match[1]+'.pdf';
    return new Response(object.body,{headers:{
      'content-type':'application/pdf',
      'content-disposition':'attachment; filename="'+filename+'"',
      'content-length':String(object.size),
      'cache-control':'private,no-store,max-age=0',
      'x-robots-tag':'noindex,nofollow,noarchive',
      'x-content-type-options':'nosniff',
      'content-security-policy':"default-src 'none'; frame-ancestors 'none'; sandbox"
    }});
  }catch{return json({error:'read_failed'},503);}
}};