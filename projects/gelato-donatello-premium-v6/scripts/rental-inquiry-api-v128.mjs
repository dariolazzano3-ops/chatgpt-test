import cakeWorker from './cake-inquiry-api-v127.mjs';
import { FLAVORS } from '../assets/js/components/hero-flavors.js';

const PATH='/api/rental-interest',MAX_BYTES=3072;
const HEADERS={'content-type':'application/json; charset=utf-8','cache-control':'no-store, private','x-content-type-options':'nosniff','referrer-policy':'no-referrer','x-robots-tag':'noindex, nofollow'};
const respond=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:HEADERS});
const deny=(code,status=422)=>respond({ok:false,mode:'test-only',code},status);
const allowedKeys=['anlass','datum','ort','gaeste','eissorten','name','email','telefon','website','test_data_confirmed','marketing_opt_in','privacy_notice_version'];
const occasions=['Hochzeit','Geburtstag','Firmenevent','Anderer Anlass'];
const venues=['TEST: Musterort','TEST: Musterhalle','TEST: Firmenstandort'];
const flavors=new Set(FLAVORS.map(x=>x.name));
const validDate=value=>{
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
 const d=new Date(value+'T12:00:00Z');
 if(!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==value)return false;
 const now=new Date(),day=Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate());
 return d.getTime()>=day&&d.getTime()<=day+366*86400000;
};
export function validateRentalInterest(d){
 if(!d||typeof d!=='object'||Array.isArray(d)||Object.keys(d).some(k=>!allowedKeys.includes(k)))return 'INVALID_FIELDS';
 if(!occasions.includes(d.anlass))return 'INVALID_OCCASION';
 if(!validDate(d.datum))return 'INVALID_DATE';
 if(!venues.includes(d.ort))return 'ONLY_SYNTHETIC_VENUE';
 if(!Number.isInteger(d.gaeste)||d.gaeste<1||d.gaeste>1000)return 'INVALID_GUEST_COUNT';
 if(!Array.isArray(d.eissorten)||d.eissorten.length<1||d.eissorten.length>4||d.eissorten.some(f=>typeof f!=='string'||!flavors.has(f)))return 'INVALID_FLAVORS';
 if(new Set(d.eissorten).size!==d.eissorten.length)return 'DUPLICATE_FLAVORS';
 if(typeof d.name!=='string'||!/^Test (Gast|Person|Kunde)( [0-9]{1,2})?$/.test(d.name))return 'ONLY_SYNTHETIC_NAME';
 if(typeof d.email!=='string'||!/^test(-[a-z0-9]{1,20})?@example\.test$/.test(d.email))return 'ONLY_SYNTHETIC_EMAIL';
 if(d.telefon!==''&&d.telefon!=='000000')return 'ONLY_SYNTHETIC_PHONE';
 if(d.website!=='')return 'HONEYPOT';
 if(d.test_data_confirmed!==true||d.privacy_notice_version!=='demo-v1')return 'TEST_CONFIRMATION_REQUIRED';
 if(d.marketing_opt_in!==false)return 'MARKETING_DISABLED';
 return null;
}
async function handleRental(request){
 const url=new URL(request.url),pathname=url.pathname;
 if(pathname===PATH+'/status'){
  if(request.method!=='GET')return deny('METHOD_NOT_ALLOWED',405);
  return respond({ok:true,mode:'test-only',real_submissions:false,storage:'disabled',notifications:'not_sent',booking:false,privacy_approval:false,spam_protection:'synthetic_allowlist_and_honeypot'});
 }
 if(request.method!=='POST')return deny('METHOD_NOT_ALLOWED',405);
 if(request.headers.get('origin')!==url.origin||request.headers.get('sec-fetch-site')==='cross-site')return deny('ORIGIN_DENIED',403);
 if(!/^application\/json(?:;|$)/i.test(request.headers.get('content-type')||''))return deny('JSON_ONLY',415);
 if(Number(request.headers.get('content-length')||'0')>MAX_BYTES)return deny('PAYLOAD_TOO_LARGE',413);
 let d;
 try{
  const raw=await request.text();
  if(new TextEncoder().encode(raw).byteLength>MAX_BYTES)return deny('PAYLOAD_TOO_LARGE',413);
  d=JSON.parse(raw);
 }catch{return deny('INVALID_JSON',400);}
 const issue=validateRentalInterest(d);
 if(issue)return deny(issue);
 // Never store, log, email, book or charge. Receipt merely proves server-side validation.
 return respond({ok:true,mode:'test-only',receipt:'DEMO-RENT-'+crypto.randomUUID().slice(0,8).toUpperCase(),stored:false,notified:false,booking:false});
}
export default {
 async fetch(request,env,ctx) {
  const p=new URL(request.url).pathname;
  if(p===PATH||p===PATH+'/status')return handleRental(request);
  return cakeWorker.fetch(request,env,ctx);
 }
};
