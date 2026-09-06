#!/usr/bin/env node
import assert from 'node:assert/strict';
import path from 'node:path';
import { readFile, rm, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { materializePremiumStaticWebV1SourcePackage, runWebOperatingSystemV2 } from '../src/web-factory/index.js';

const repoRoot=path.resolve(fileURLToPath(new URL('..',import.meta.url)));
const project=JSON.parse(await readFile(new URL('../projects/gelato-donatello-website-v1/project-jaguar-dogfood-v1.json',import.meta.url),'utf8'));
const out=path.resolve(repoRoot,process.env.JAGUAR_GELATO_SOURCE_ROOT||'.jaguar-preview/gelato-source');

const build=runWebOperatingSystemV2({
  mission:project.mission,
  quality_level:'PREMIUM',
  content:project.mission.existing_content,
  assets:[],
  trust_evidence:{available:[]},
  local_business_data:{},
  premium_evidence:{human_review:{state:'CHANGES_REQUIRED',approved:false},assets:[]}
},{now:'2026-09-07T00:00:00.000Z',build_duration_ms:1});

assert.equal(build.ok,true);
assert.equal(build.build_profile.profile_id,'PREMIUM_STATIC_WEB_V1');
assert.equal(build.production_deploy,false);
assert.equal(build.integrations.external_side_effects,false);
assert.equal(build.premium_standard.launch_readiness.public_launch_ready,false);

const html=Object.entries(build.artifact.files).filter(([f])=>f.endsWith('.html')).map(([,v])=>String(v)).join('\n');
for(const forbidden of project.forbidden_unverified_render_values) assert.equal(html.includes(forbidden),false,`unverified value leaked: ${forbidden}`);
assert.equal(/href=["']tel:/i.test(html),false);
assert.equal(/href=["']mailto:/i.test(html),false);
assert.equal(/action=["']https?:/i.test(html),false);

await rm(out,{recursive:true,force:true});
await mkdir(out,{recursive:true});
await materializePremiumStaticWebV1SourcePackage(build.build_profile,out);
const evidence={
  schema:'aurentara.project-jaguar.gelato-preview-materialization.v1',
  project_id:project.project_ref.project_id,
  scope_key:project.project_ref.scope_key,
  build_profile:build.build_profile.profile_id,
  source_root:out,
  source_files:build.build_profile.source_package.manifest.file_count,
  confirmed_fact_guard:'PASS',
  unverified_fact_leakage:0,
  external_contact_actions:0,
  production_deploy:false,
  public_launch:false,
  dns_changes:false,
  billing:false
};
await writeFile(path.join(out,'jaguar-preview-evidence.json'),JSON.stringify(evidence,null,2)+'\n','utf8');
console.log(JSON.stringify({...evidence,source_root:out},null,2));
