const PHASES=['INTAKE','KNOWLEDGE','BUILD','QA','APPROVAL','LIVE'];
const LABELS={INTAKE:'Intake',KNOWLEDGE:'Projektwissen',BUILD:'Umsetzung',QA:'QA',APPROVAL:'Freigabe',LIVE:'Live'};
const u=v=>String(v??'').trim().toUpperCase();
const n=v=>Number.isFinite(Number(v))?Number(v):0;

export function normalizePremiumProjectLifecycle(project={},context={}){
  const k=context.knowledge_review||{},raw=[project.state,project.mission_status,project.status,context.status].map(u).join(' '),env=u(project.environment||context.environment||'DRAFT');
  const environment=env.includes('PROD')?'PRODUCTION':env.includes('STAG')?'STAGING':'DRAFT';
  let phase='INTAKE';
  if(environment==='PRODUCTION'||raw.includes('LIVE'))phase='LIVE';
  else if(raw.includes('APPROVAL')||raw.includes('HUMAN_QUALITY')||n(project.open_approval_count)>0)phase='APPROVAL';
  else if(raw.includes('QA')||raw.includes('QUALITY')||raw.includes('DELIVERY_READY'))phase='QA';
  else if(u(k.status)==='APPROVED')phase='BUILD';
  else if(['IN_REVIEW','CHANGES_PENDING','STAGED'].includes(u(k.status))||n(context.source_count)>0||n(context.fact_count)>0)phase='KNOWLEDGE';
  const blockers=n(project.blocker_count)+n(context.blocker_count),attention=n(project.open_approval_count)+n(context.open_input_count)+n(context.conflict_count||k.conflict_count);
  const health=blockers>0||raw.includes('BLOCKED')||raw.includes('FAILED')?'BLOCKED':attention>0||['IN_REVIEW','CHANGES_PENDING','STAGED'].includes(u(k.status))?'NEEDS_ATTENTION':'HEALTHY';
  return{phase,phase_label:LABELS[phase],health,environment};
}
export function derivePremiumProjectProgress(project={},context={}){
  const l=normalizePremiumProjectLifecycle(project,context),explicit=n(project.progress_percent);
  if(explicit>0&&explicit<=100)return{percent:explicit,label:`${Math.round(explicit)} %`,deterministic_source:'EXISTING_PROJECT_GATE_PROJECTION'};
  const i=Math.max(0,PHASES.indexOf(l.phase));return{percent:null,label:`Phase ${i+1} von ${PHASES.length}`,deterministic_source:'PHASE_FALLBACK_NO_FAKE_PERCENT'};
}
export function derivePremiumNextBestAction(project={},context={}){
  const k=context.knowledge_review||{},conf=n(context.conflict_count||k.conflict_count),inputs=n(context.open_input_count),preview=context.preview||project.project_preview_access||{};
  if(conf>0)return{code:'REVIEW_KNOWLEDGE',label:`${conf} Angaben prüfen`,target:'knowledge',priority:1};
  if(inputs>0)return{code:'ANSWER_INPUTS',label:`${inputs} Kundenangabe${inputs===1?'':'n'} beantworten`,target:'approvals',priority:2};
  if(u(k.status)==='STAGED')return{code:'PUBLISH_KNOWLEDGE',label:'Projektwissen bereitstellen',target:'knowledge',priority:3};
  if(['IN_REVIEW','CHANGES_PENDING'].includes(u(k.status))&&k.catch_net?.clear===true)return{code:'STAGE_KNOWLEDGE',label:'Geprüfte Informationen übernehmen',target:'knowledge',priority:4};
  if(n(project.open_approval_count)>0&&preview.available===true)return{code:'REVIEW_PREVIEW',label:'Preview abnehmen',target:'preview',priority:5};
  if(preview.available===true)return{code:'OPEN_PREVIEW',label:'Preview öffnen',target:'preview',priority:6};
  return{code:'OPEN_PROJECT',label:'Projekt öffnen',target:'overview',priority:99};
}
export function buildPremiumProjectViewModel(project={},context={}){const l=normalizePremiumProjectLifecycle(project,context);return{...l,progress:derivePremiumProjectProgress(project,context),next_action:derivePremiumNextBestAction(project,context),attention_count:n(project.blocker_count)+n(project.open_approval_count)+n(context.conflict_count)+n(context.open_input_count),production_deploy:false,external_writes:false}}
