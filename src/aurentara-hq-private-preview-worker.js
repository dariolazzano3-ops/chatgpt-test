const clean=(value,max=500)=>String(value??'').trim().slice(0,max);

function decodeJwtPayload(token=''){
  try{
    const parts=String(token).split('.');
    if(parts.length<2)return {};
    const raw=parts[1].replace(/-/g,'+').replace(/_/g,'/');
    const pad=raw+'='.repeat((4-raw.length%4)%4);
    return JSON.parse(atob(pad));
  }catch{return {};}
}

function accessIdentity(request,env={}){
  const jwt=clean(request.headers.get('cf-access-jwt-assertion'),6000);
  if(!jwt)return {ok:false,status:401,error:'CLOUDFLARE_ACCESS_REQUIRED'};
  const payload=decodeJwtPayload(jwt);
  const email=clean(
    request.headers.get('cf-access-authenticated-user-email')||
    payload.email||
    payload.sub,
    320
  ).toLowerCase();
  const expected=clean(env.HQ_PREVIEW_OPERATOR_EMAIL,320).toLowerCase();
  if(!email||!expected||email!==expected)return {ok:false,status:403,error:'HQ_PREVIEW_IDENTITY_NOT_ALLOWED'};
  return {ok:true,email};
}

function json(body,status=200){
  return new Response(JSON.stringify(body,null,2),{
    status,
    headers:{
      'content-type':'application/json; charset=utf-8',
      'cache-control':'no-store',
      'x-content-type-options':'nosniff',
      'x-robots-tag':'noindex, nofollow'
    }
  });
}

export default{
  async fetch(request,env){
    const auth=accessIdentity(request,env);
    if(!auth.ok)return json({
      ok:false,
      error:auth.error,
      private_preview:true,
      production_deploy:false,
      public_launch:false,
      external_writes:false
    },auth.status);

    const url=new URL(request.url);
    if(url.pathname==='/health'){
      return json({
        ok:true,
        private_preview:true,
        exact_feature_head:clean(env.HQ_PREVIEW_FEATURE_HEAD,80),
        production_deploy:false,
        public_launch:false,
        external_writes:false
      });
    }

    const assetUrl=new URL(request.url);
    if(assetUrl.pathname==='/'||assetUrl.pathname==='/index.html')assetUrl.pathname='/index.html';
    const response=await env.ASSETS.fetch(new Request(assetUrl.toString(),request));
    if(response.status===404&&url.pathname!=='/'){
      const fallback=new URL(request.url);
      fallback.pathname='/index.html';
      return env.ASSETS.fetch(new Request(fallback.toString(),request));
    }
    const headers=new Headers(response.headers);
    headers.set('cache-control','no-store, no-cache, must-revalidate');
    headers.set('pragma','no-cache');
    headers.set('x-robots-tag','noindex, nofollow');
    headers.set('x-content-type-options','nosniff');
    headers.set('referrer-policy','no-referrer');
    headers.set('permissions-policy','camera=(), microphone=(), geolocation=(), payment=()');
    return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
  }
};
