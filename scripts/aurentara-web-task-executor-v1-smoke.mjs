import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { executeAurentaraWebTaskV1 } from './aurentara-web-task-executor-v1.mjs';

const dir=await fs.mkdtemp(path.join(os.tmpdir(),'aurentara-web-task-'));
const project='projects/example';
await fs.mkdir(path.join(dir,project,'assets/css'),{recursive:true});
await fs.writeFile(path.join(dir,project,'index.html'),'<!doctype html><header><a class="site-header__brand"><img class="site-header__logo" src="logo.webp"></a></header><main><h1>Alt</h1><a class="button">Los</a></main>');
await fs.writeFile(path.join(dir,project,'assets/css/style.css'),'.site-header__logo{width:220px}\n');
const binding={project_path:project,style_file:'assets/css/style.css',entry_file:'index.html'};

const result=await executeAurentaraWebTaskV1({repo_root:dir,binding,instruction:'Logo im Header hochwertiger und dreidimensionaler wirken lassen, ohne das Logo selbst zu verändern.'});
assert.equal(result.ok,true);
assert.deepEqual(result.changed_files,[project+'/assets/css/style.css']);
assert.equal(result.asset_files_modified,false);
const css=await fs.readFile(path.join(dir,project,'assets/css/style.css'),'utf8');
assert.match(css,/AURENTARA Web Execution Bridge V1/);
assert.match(css,/drop-shadow/);
const html=await fs.readFile(path.join(dir,project,'index.html'),'utf8');
assert.match(html,/src="logo\.webp"/);

const unsupported=await executeAurentaraWebTaskV1({repo_root:dir,binding,instruction:'Erfinde irgendeine komplett neue Anwendung.'});
assert.equal(unsupported.ok,false);
assert.equal(unsupported.workshop_required,true);

await fs.rm(dir,{recursive:true,force:true});
console.log(JSON.stringify({ok:true,suite:'aurentara-web-task-executor-v1',logo_asset_unchanged:true,unsupported_fail_safe:true,production_deploy:false},null,2));
