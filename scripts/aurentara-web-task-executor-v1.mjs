import fs from 'node:fs/promises';
import path from 'node:path';

const clean=(v,max=8000)=>String(v??'').trim().slice(0,max);
const MANAGED_START='/* AURENTARA Web Execution Bridge V1: START */';
const MANAGED_END='/* AURENTARA Web Execution Bridge V1: END */';

function stripManaged(css=''){
  const re=/\/\* AURENTARA Web Execution Bridge V1: START \*\/[\s\S]*?\/\* AURENTARA Web Execution Bridge V1: END \*\//g;
  return String(css).replace(re,'').trimEnd();
}
function escapeHtml(v=''){return String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}
function extractNamed(raw,names,max=200){
  const m=new RegExp('(?:'+names.join('|')+')\\s*(?:[:=]|auf|zu)\\s*["„“\']?([^\\n"„“\']{2,'+max+'})','i').exec(raw);
  return m?.[1]?.replace(/[.!]+$/,'').trim()||'';
}
function planInstruction(instruction=''){
  const raw=clean(instruction),t=raw.toLowerCase(),ops=[];
  const logo=/logo|wordmark|markenzeichen/.test(t), header=/header|kopf|navigation|navbar/.test(t);
  const depth=/3d|dreidimensional|tiefe|plastisch|räumlich|premium.*logo|logo.*premium/.test(t);
  if(logo&&depth)ops.push({type:'logo_depth_3d',scope:header?'header':'brand',asset_unchanged:true});
  const headline=extractNamed(raw,['headline','überschrift','ueberschrift'],220);
  if(headline)ops.push({type:'headline_text',value:headline});
  const cta=extractNamed(raw,['cta','button(?:text)?','knopf'],120);
  if(cta)ops.push({type:'cta_text',value:cta});
  const color=raw.match(/#[0-9a-f]{3,8}\b/i)?.[0];
  if(color&&/(akzent|accent|farbe|color)/i.test(raw))ops.push({type:'accent_color',value:color});
  if(/mobile|mobil|handy|smartphone/.test(t)&&/(verbesser|fix|optimier|sauber|responsive)/.test(t))ops.push({type:'mobile_safety'});
  return {raw,ops,supported:ops.length>0};
}
function bridgeCss(ops=[]){
  const blocks=[];
  if(ops.some(x=>x.type==='logo_depth_3d')){
    blocks.push(`.site-header__brand{perspective:900px;isolation:isolate}
.site-header__logo{
  transform:translate3d(0,0,0);
  transform-origin:50% 54%;
  filter:
    drop-shadow(0 1px 0 rgba(255,255,255,.72))
    drop-shadow(0 2px 0 rgba(92,63,38,.18))
    drop-shadow(0 5px 7px rgba(67,45,26,.18))
    drop-shadow(0 12px 22px rgba(67,45,26,.10));
  transition:transform .28s ease,filter .28s ease;
  will-change:transform;
}
@media (hover:hover) and (pointer:fine){
  .site-header__brand:hover .site-header__logo{
    transform:translate3d(0,-1px,5px) rotateX(1.2deg) rotateY(-1.1deg);
    filter:
      drop-shadow(0 1px 0 rgba(255,255,255,.82))
      drop-shadow(0 3px 0 rgba(92,63,38,.20))
      drop-shadow(0 7px 10px rgba(67,45,26,.20))
      drop-shadow(0 16px 28px rgba(67,45,26,.12));
  }
}
@media (prefers-reduced-motion:reduce){.site-header__logo{transition:none}}`);
  }
  for(const op of ops){
    if(op.type==='accent_color')blocks.push(`:root{--accent:${op.value}}`);
    if(op.type==='mobile_safety')blocks.push(`@media(max-width:820px){
  html,body{max-width:100%;overflow-x:clip}
  img,svg,video{max-width:100%;height:auto}
  .site-header__bar{min-width:0}
  .site-header__brand{min-width:0}
}`);
  }
  return blocks.join('\n\n');
}
function updateText(html,ops=[]){
  let next=html;
  for(const op of ops){
    if(op.type==='headline_text'&&/<h1\b[^>]*>[\s\S]*?<\/h1>/i.test(next)){
      next=next.replace(/(<h1\b[^>]*>)[\s\S]*?(<\/h1>)/i,`$1${escapeHtml(op.value)}$2`);
    }
    if(op.type==='cta_text'){
      const re=/(<a\b[^>]*class=["'][^"']*(?:button|cta)[^"']*["'][^>]*>)[\s\S]*?(<\/a>)/i;
      if(re.test(next))next=next.replace(re,`$1${escapeHtml(op.value)}$2`);
    }
  }
  return next;
}

export async function executeAurentaraWebTaskV1({repo_root='.',binding,instruction}={}){
  if(!binding||typeof binding!=='object')return{ok:false,error:'PROJECT_BINDING_REQUIRED'};
  const projectPath=clean(binding.project_path,500);
  if(!/^projects\/[a-z0-9._/-]+$/i.test(projectPath))return{ok:false,error:'PROJECT_PATH_INVALID'};
  const plan=planInstruction(instruction);
  if(!plan.supported)return{ok:false,error:'WEB_TASK_REQUIRES_ADVANCED_BUILDER',workshop_required:true,plan,production_deploy:false};

  const root=path.resolve(repo_root,projectPath);
  const styleRel=clean(binding.style_file||'styles.css',300);
  const entryRel=clean(binding.entry_file||'index.html',300);
  const stylePath=path.resolve(root,styleRel),entryPath=path.resolve(root,entryRel);
  if(!stylePath.startsWith(root+path.sep)||!entryPath.startsWith(root+path.sep))return{ok:false,error:'PROJECT_FILE_ESCAPE_REJECTED'};

  let css=await fs.readFile(stylePath,'utf8');
  let html=await fs.readFile(entryPath,'utf8');
  const beforeCss=css,beforeHtml=html;
  const additions=bridgeCss(plan.ops);
  if(additions){
    css=stripManaged(css)+'\n\n'+MANAGED_START+'\n'+additions+'\n'+MANAGED_END+'\n';
  }
  html=updateText(html,plan.ops);

  const changed=[];
  if(css!==beforeCss){await fs.writeFile(stylePath,css);changed.push(path.posix.join(projectPath,styleRel))}
  if(html!==beforeHtml){await fs.writeFile(entryPath,html);changed.push(path.posix.join(projectPath,entryRel))}
  if(!changed.length)return{ok:false,error:'WEB_TASK_NO_VERIFIED_CHANGE',workshop_required:true,plan,production_deploy:false};

  return{
    ok:true,
    schema:'aurentara.web-task-execution.v1',
    plan,
    changed_files:changed,
    asset_files_modified:false,
    project_path:projectPath,
    production_deploy:false,
    public_deploy:false,
    dns_change:false,
    billing:false,
    automatic_merge:false
  };
}

if(import.meta.url===new URL('file://'+process.argv[1]).href){
  const [bindingPath,instruction='']=process.argv.slice(2);
  if(!bindingPath)throw new Error('BINDING_FILE_REQUIRED');
  const binding=JSON.parse(await fs.readFile(bindingPath,'utf8'));
  const result=await executeAurentaraWebTaskV1({repo_root:process.cwd(),binding,instruction});
  console.log(JSON.stringify(result,null,2));
  if(!result.ok)process.exit(2);
}
