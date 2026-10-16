/**
 * Gelato Donatello Event Interest V1
 * PRIVATE PREVIEW TEST-ONLY Worker. No persistence and no notifications.
 * Only deterministic synthetic addresses from the reserved .test TLD accepted.
 * Real customer data MUST remain disabled until a separate privacy and security GO.
 */
const MAX_BYTES = 2048;
const NO_STORE = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store, private", "x-content-type-options": "nosniff", "x-robots-tag": "noindex, nofollow", "referrer-policy": "no-referrer" };
const json = (value, status = 200) => new Response(JSON.stringify(value), {status, headers:NO_STORE});
const fail = (code,status=400)=>json({ok:false,code,mode:"test-only"},status);
const keys = ["name","email","phone","requested_seats","note","test_data_confirmed","marketing_opt_in","privacy_notice_version"];

export function validateSyntheticInterest(data) {
  if(!data || typeof data!=="object" || Array.isArray(data) ||
     Object.keys(data).some(key=>!keys.includes(key))) return "INVALID_FIELDS";
  // Deliberately reject any real person's name, email, telephone or free text.
  if(typeof data.name!=="string" || !/^Test (?:Gast|Person|Kunde)(?: [0-9]{1,2})?$/.test(data.name)) return "ONLY_SYNTHETIC_NAME";
  if(typeof data.email!=="string" || !/^test(?:-[a-z0-9]{1,20})?@example\.test$/.test(data.email)) return "ONLY_SYNTHETIC_EMAIL";
  if(data.phone!==undefined && data.phone!=="" && data.phone!=="000000") return "ONLY_SYNTHETIC_PHONE";
  if(!Number.isInteger(data.requested_seats) || data.requested_seats<1 || data.requested_seats>8) return "INVALID_SEAT_COUNT";
  if(data.note!==undefined && data.note!=="" && (typeof data.note!=="string" ||
      !/^TEST: [a-zA-Z0-9 .,!?-]{0,100}$/.test(data.note))) return "ONLY_SYNTHETIC_NOTE";
  if(data.test_data_confirmed!==true || data.privacy_notice_version!=="demo-v1") return "TEST_CONFIRMATION_REQUIRED";
  if(data.marketing_opt_in!==false && data.marketing_opt_in!==undefined) return "MARKETING_DISABLED";
  return null;
}

export default {
  async fetch(request, env) {
    const pathname = new URL(request.url).pathname;
    if(pathname!=="/api/events-interest" && pathname!=="/api/events-interest/status") {
      if (env?.ASSETS?.fetch) return env.ASSETS.fetch(request);
      return new Response("Not found", {status:404});
    }
    if(pathname==="/api/events-interest/status") {
      if(request.method!=="GET") return fail("METHOD_NOT_ALLOWED",405);
      return json({ok:true,mode:"test-only",real_submissions:false,storage:"disabled",notifications:"not_sent",booking:false,privacy_approval:false});
    }
    if(request.method!=="POST") return fail("METHOD_NOT_ALLOWED",405);
    // Requests come through Cloudflare Access at the private website.
    // Same-origin only, JSON only, and no CORS.
    const origin=request.headers.get("origin");
    if(origin!==new URL(request.url).origin) return fail("ORIGIN_DENIED",403);
    if(request.headers.get("sec-fetch-site")==="cross-site") return fail("CROSS_SITE_DENIED",403);
    if(!/^application\/json(?:;|$)/i.test(request.headers.get("content-type")||"")) return fail("JSON_ONLY",415);
    if(Number(request.headers.get("content-length")||"0")>MAX_BYTES) return fail("PAYLOAD_TOO_LARGE",413);
    let data;
    try {
      const raw=await request.text();
      if(raw.length>MAX_BYTES) return fail("PAYLOAD_TOO_LARGE",413);
      data=JSON.parse(raw);
    }catch{return fail("INVALID_JSON",400);}
    const error=validateSyntheticInterest(data);
    if(error) return fail(error,422);
    // Acknowledge successful *validation*, not a stored or sent enquiry.
    // Never log or retain body, name, email or note.
    const receipt="DEMO-"+crypto.randomUUID().slice(0,8).toUpperCase();
    return json({ok:true,mode:"test-only",receipt,accepted_for_demo:true,stored:false,notified:false,
      booking:false,message:"Synthetic request validated in private preview; no data stored or sent."},200);
  }
};
