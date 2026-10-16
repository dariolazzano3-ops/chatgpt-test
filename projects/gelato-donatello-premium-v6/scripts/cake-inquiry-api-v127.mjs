import eventWorker from './event-interest-api-v126.mjs';
import { FLAVORS } from '../assets/js/components/hero-flavors.js';

const BASE='/api/cakes-interest', LIMIT=4096;
const HEADERS={'content-type':'application/json; charset=utf-8','cache-control':'no-store, private','x-content-type-options':'nosniff','x-robots-tag':'noindex, nofollow','referrer-policy':'no-referrer'};
const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:HEADERS});
const reject=(code,status=422)=>reply({ok:false,mode:'test-only',code},status);
const sizes={
  'Klassische Eistorte':['18 cm','20 cm','24 cm','26 cm'],
  'Spaghetti-Eistorte':['18 cm','20 cm','24 cm','26 cm'],
  'Eisbombe':['40 Kugeln','60 Kugeln']
};
const creations=[
'Donatello Classico','Schoko Royale','Erdbeer Traum','Dolce Vita','Nocciola Gold','Cookie Cream',
'Fruchtzauber','Caramella','Pistacchio Amore','Cioccolato Deluxe','Bella Bianca','Beerenliebe',
'Oreo Eleganza','Haselnuss Harmonie','Sommertraum','Fragola Speciale','Karamell Genuss','Sicilia',
'Festa Donatello','Spaghetti Classico','Spaghetti Fragola','Spaghetti Speciale','Eisbombe Classica','Eisbombe Grande'
].map((x,i)=>'Nr. '+String(i+1).padStart(2,'0')+' · '+x);
const decos=['TEST: Schokolade und Beeren','TEST: Fruechte','TEST: Zahl 7','TEST: Ohne Dekoration'];
const notes=['','TEST: Keine weiteren Wuensche','TEST: Weitere Farben','TEST: Ohne Sahne'];
const allowedFields=['variante','kreation','groesse','eissorten','dekoration','wunschdatum','bemerkungen','name','email','phone','website','test_data_confirmed','marketing_opt_in','privacy_notice_version'];
const flavorNames=new Set(FLAVORS.map(x=>x.name));
const isValidDate=value=>{
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
  const date=new Date(value+'T12:00:00Z');
  if(!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==value)return false;
  const now=new Date(),midnight=Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate());
  return date.getTime()>=midnight && date.getTime()<=midnight+366*86400000;
};
export function validateCakeInquiry(d){
  if(!d||typeof d!=='object'||Array.isArray(d)||Object.keys(d).some(x=>!allowedFields.includes(x)))return 'INVALID_FIELDS';
  if(!Object.hasOwn(sizes,d.variante)||!sizes[d.variante].includes(d.groesse))return 'TYPE_SIZE_MISMATCH';
  if(d.kreation!=='Eigene Idee / noch unsicher'&&!creations.includes(d.kreation))return 'INVALID_CREATION';
  const i=creations.indexOf(d.kreation);
  if(i!==-1){
    const kind=i<19?'Klassische Eistorte':i<22?'Spaghetti-Eistorte':'Eisbombe';
    if(d.variante!==kind)return 'CREATION_TYPE_MISMATCH';
  }
  if(!Array.isArray(d.eissorten)||d.eissorten.some(x=>typeof x!=='string'||!flavorNames.has(x)))return 'INVALID_FLAVORS';
  if(d.variante==='Eisbombe'?(d.eissorten.length<1||d.eissorten.length>6):(d.eissorten.length!==2))return 'WRONG_FLAVOR_COUNT';
  if(new Set(d.eissorten).size!==d.eissorten.length)return 'DUPLICATE_FLAVORS';
  if(!decos.includes(d.dekoration)||!notes.includes(d.bemerkungen))return 'ONLY_SYNTHETIC_WISHES';
  if(!isValidDate(d.wunschdatum))return 'INVALID_DATE';
  if(typeof d.name!=='string'||!/^Test (Gast|Person|Kunde)( [0-9]{1,2})?$/.test(d.name))return 'ONLY_SYNTHETIC_NAME';
  if(typeof d.email!=='string'||!/^test(-[a-z0-9]{1,20})?@example\.test$/.test(d.email))return 'ONLY_SYNTHETIC_EMAIL';
  if(d.phone!==''&&d.phone!=='000000')return 'ONLY_SYNTHETIC_PHONE';
  if(d.website!=='')return 'HONEYPOT';
  if(d.test_data_confirmed!==true||d.privacy_notice_version!=='demo-v1')return 'TEST_CONFIRMATION_REQUIRED';
  if(d.marketing_opt_in!==false)return 'MARKETING_DISABLED';
  return null;
}
async function cakeHandler(request){
  const pathname=new URL(request.url).pathname;
  if(pathname===BASE+'/status'){
    if(request.method!=='GET')return reject('METHOD_NOT_ALLOWED',405);
    return reply({ok:true,mode:'test-only',real_submissions:false,storage:'disabled',notifications:'not_sent',booking:false,privacy_approval:false,spam_protection:'strict_synthetic_allowlist_and_honeypot'});
  }
  if(request.method!=='POST')return reject('METHOD_NOT_ALLOWED',405);
  if(request.headers.get('origin')!==new URL(request.url).origin||request.headers.get('sec-fetch-site')==='cross-site')return reject('ORIGIN_DENIED',403);
  if(!/^application\/json(?:;|$)/i.test(request.headers.get('content-type')||''))return reject('JSON_ONLY',415);
  if(Number(request.headers.get('content-length')||'0')>LIMIT)return reject('PAYLOAD_TOO_LARGE',413);
  let data;
  try{
    const raw=await request.text();
    if(new TextEncoder().encode(raw).byteLength>LIMIT)return reject('PAYLOAD_TOO_LARGE',413);
    data=JSON.parse(raw);
  }catch{return reject('INVALID_JSON',400);}
  const validation=validateCakeInquiry(data);
  if(validation)return reject(validation);
  return reply({ok:true,mode:'test-only',receipt:'DEMO-CAKE-'+crypto.randomUUID().slice(0,8).toUpperCase(),stored:false,notified:false,booking:false});
}
export default {
  async fetch(request,env,ctx) {
    const pathname=new URL(request.url).pathname;
    if(pathname===BASE||pathname===BASE+'/status')return cakeHandler(request);
    return eventWorker.fetch(request,env,ctx);
  }
};
