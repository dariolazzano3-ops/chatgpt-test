const CAPABILITIES = {
  web_generate: { domain: "web", engine: "generate", status: "available", risk: "bounded", description: "Create a new website or web app." },
  web_rebuild: { domain: "web", engine: "rebuild", status: "available", risk: "bounded", description: "Analyze and independently rebuild a public website." },
  web_evolve: { domain: "web", engine: "evolve", status: "available", risk: "bounded", description: "Modify an existing web project through the controlled Factory pipeline." },
  app_build: { domain: "app", engine: null, status: "planned", risk: "bounded", description: "Build application and internal-tool projects." },
  automation_build: { domain: "automation", engine: "automation", status: "available", risk: "integration", description: "Build workflows, API integrations and business automations." },
  ai_system_build: { domain: "ai", engine: "ai", status: "available", risk: "integration", description: "Build assistants, agents and knowledge systems." },
  business_system_build: { domain: "business", engine: "business", status: "available", risk: "bounded", description: "Build bounded CRM, lead, offer and operational business-system configurations." }
};
function text(value) { return String(value || "").trim().toLowerCase(); }
function hit(value, words) { return words.some((word) => value.includes(word)); }
export function listCapabilities() { return Object.entries(CAPABILITIES).map(([id, capability]) => ({ id, ...capability })); }
export function routeCapability(input = {}) {
  const prompt = text(input.prompt || input.request || input.goal); const explicit = text(input.capability); const project = text(input.project || input.project_slug);
  if (explicit && CAPABILITIES[explicit]) return { ok: true, capability: explicit, ...CAPABILITIES[explicit], confidence: 1, reason: "explicit_capability" };
  if (!prompt) return { ok: false, error: "ROUTING_PROMPT_REQUIRED", candidates: [] };
  const scores = new Map(); const add=(id,score,reason)=>{ const current=scores.get(id)||{score:0,reasons:[]}; current.score+=score; current.reasons.push(reason); scores.set(id,current); };
  if (hit(prompt,["website","webseite","landingpage","landing page","homepage","html","css","web app","webapp"])) add(project?"web_evolve":"web_generate",5,"web_language");
  if (hit(prompt,["ändere","aendere","bearbeite","verbessere","evolve","update","anpassen","mach den","mach die"])&&project) add("web_evolve",5,"existing_project_change");
  if (hit(prompt,["rebuild","rekonstruiere","nachbauen","bestehende website analysieren"])) add("web_rebuild",6,"rebuild_intent");
  if (hit(prompt,["app","dashboard","internes tool","internal tool","software tool"])) add("app_build",4,"app_language");
  if (hit(prompt,["automation","automatisiere","automatisch","automatisiert","workflow","api verbinden","integration","webhook","datenfluss","lead flow","lead-flow","eingehende leads","eingehender lead","verbinde eingehende","connect leads"])) add("automation_build",5,"automation_language");
  if (hit(prompt,["ki","ai ","agent","assistent","assistant","rag","wissenssystem","knowledge base"])) add("ai_system_build",5,"ai_language");
  if (hit(prompt,["crm","leads","lead-system","angebotssystem","kundenprozess","business system","vertrieb","sales pipeline"])) add("business_system_build",5,"business_language");
  const ranked=[...scores.entries()].map(([id,value])=>({id,...CAPABILITIES[id],...value})).sort((a,b)=>b.score-a.score); if(!ranked.length) return {ok:false,error:"CAPABILITY_UNRESOLVED",candidates:[]};
  const top=ranked[0],second=ranked[1]; const confidence=second?Math.max(.5,Math.min(.99,top.score/(top.score+second.score))):.95; const multi_domain=ranked.filter((item)=>item.score>=Math.max(4,top.score-1)).map((item)=>item.id);
  if(multi_domain.length>1&&!project) return {ok:true,capability:"multi_capability",status:"planned",confidence,candidates:ranked.slice(0,4),required_capabilities:multi_domain,reason:"compound_request_requires_orchestration",production_deploy:false};
  return {ok:true,capability:top.id,domain:top.domain,engine:top.engine,status:top.status,risk:top.risk,confidence,reason:top.reasons[0],candidates:ranked.slice(0,3),production_deploy:false};
}
export function capabilityRegistry(){ return {version:"4.10",architecture:"multi_factory_capability_registry",capabilities:listCapabilities(),principles:{core_routes_work:true,domain_engines_remain_modular:true,unavailable_capabilities_are_never_faked:true,compound_requests_require_orchestration:true,production_requires_explicit_approval:true}}; }
