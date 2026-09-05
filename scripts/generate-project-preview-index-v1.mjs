#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root=path.resolve(process.cwd(),'projects');
const out=path.resolve(process.cwd(),'src/generated-project-preview-index-v1.js');
const MAX_FILE_BYTES=500_000;
const MAX_TOTAL_BYTES=2_000_000;

const clean=v=>String(v??'').trim();
const safeToken=v=>{const s=clean(v);return s&&/^[a-z0-9._:+-]+$/i.test(s)&&!s.includes('..')?s:null};

function walk(dir){
  const out=[];
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    const full=path.join(dir,entry.name);
    if(entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}
function relative(file){return path.relative(process.cwd(),file).split(path.sep).join('/')}
function rankHtml(file,projectDir){
  const rel=path.relative(projectDir,file).split(path.sep).join('/').toLowerCase();
  const base=path.basename(rel);
  if(base.includes('preview')) return 0;
  if(rel==='index.html') return 1;
  if(base==='index.html') return 2;
  if(base==='404.html') return 99;
  return 10;
}
function readJson(file){
  try{return JSON.parse(fs.readFileSync(file,'utf8'))}catch{return null}
}
function inlineLocalStyles(projectDir,html){
  let out=html;
  let stylesInlined=0;
  const tags=[...html.matchAll(/<link\b[^>]*>/gi)].map(m=>m[0]);
  for(const tag of tags){
    const rel=tag.match(/\brel\s*=\s*["']([^"']+)["']/i)?.[1]||'';
    const href=tag.match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1]||'';
    if(!/\bstylesheet\b/i.test(rel)||!href||/^(?:https?:|\/\/|data:|\/)/i.test(href)) continue;
    const local=href.replace(/^\.\//,'').split(/[?#]/)[0];
    if(!local||local.includes('..')) continue;
    const cssPath=path.resolve(projectDir,local);
    if(!cssPath.startsWith(projectDir+path.sep)||!fs.existsSync(cssPath)||!fs.statSync(cssPath).isFile()) continue;
    const css=fs.readFileSync(cssPath,'utf8').replace(/<\/style/gi,'<\\/style');
    out=out.replace(tag,`<style data-aurentara-preview-bundled-css="${local.replace(/"/g,'&quot;')}">\n${css}\n</style>`);
    stylesInlined+=1;
  }
  return {html:out,styles_inlined:stylesInlined};
}

const entries=[];
let total=0;
if(fs.existsSync(root)){
  for(const dirent of fs.readdirSync(root,{withFileTypes:true}).filter(x=>x.isDirectory()).sort((a,b)=>a.name.localeCompare(b.name))){
    const projectDir=path.join(root,dirent.name);
    const htmlFiles=walk(projectDir).filter(f=>/\.html?$/i.test(f)&&path.basename(f).toLowerCase()!=='404.html').sort((a,b)=>rankHtml(a,projectDir)-rankHtml(b,projectDir)||a.localeCompare(b));
    if(!htmlFiles.length) continue;
    const chosen=htmlFiles[0];
    const rawHtml=fs.readFileSync(chosen,'utf8');
    const bundled=inlineLocalStyles(projectDir,rawHtml);
    const html=bundled.html;
    const htmlBytes=Buffer.byteLength(html);
    if(htmlBytes>MAX_FILE_BYTES) continue;
    if(total+htmlBytes>MAX_TOTAL_BYTES) continue;
    total+=htmlBytes;
    const meta=readJson(path.join(projectDir,'project.json'))||{};
    const inferredProjectId=safeToken(dirent.name);
    const projectId=safeToken(meta.project_id)||inferredProjectId;
    const customerId=safeToken(meta.customer_id);
    const scopeKey=clean(meta.scope_key)||((customerId&&projectId)?customerId+':'+projectId:null);
    const sourcePath=relative(chosen);
    entries.push({
      project_id:projectId,
      customer_id:customerId,
      scope_key:scopeKey||null,
      name:clean(meta.name)||dirent.name,
      source_path:sourcePath,
      styles_inlined:bundled.styles_inlined,
      content_sha256:crypto.createHash('sha256').update(html).digest('hex'),
      html
    });
  }
}
const byScope={};
const byProject={};
for(const entry of entries){
  if(entry.scope_key) byScope[entry.scope_key]=entry;
  if(entry.project_id) byProject[entry.project_id]=entry;
}
const payload={
  schema:'aurentara.generated-project-preview-index.v1',
  deterministic:true,
  project_count:entries.length,
  total_html_bytes:total,
  by_scope:byScope,
  by_project:byProject
};
const source='export const GENERATED_PROJECT_PREVIEW_INDEX = Object.freeze('+JSON.stringify(payload,null,2)+');\n';
fs.writeFileSync(out,source);
console.log(JSON.stringify({ok:true,project_count:entries.length,total_html_bytes:total,projects:entries.map(x=>({project_id:x.project_id,scope_key:x.scope_key,source_path:x.source_path,styles_inlined:x.styles_inlined}))},null,2));
