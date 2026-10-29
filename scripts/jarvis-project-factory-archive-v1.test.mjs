import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'jarvis-archive-test-'));
process.env.JARVIS_FACTORY_ROOT=dir;
const {archiveRequest}=await import('./jarvis-project-factory-onboard-v1.mjs?test='+crypto.randomUUID());
function paths(n){
 const input=path.join(dir,'inbox');
 const done=path.join(dir,'processed');
 fs.mkdirSync(input,{recursive:true});fs.mkdirSync(done,{recursive:true});
 return [path.join(input,n),path.join(done,n),done];
}
test('archive uses safe rename without overwriting',()=>{
 const [a,b,done]=paths('first.json');
 fs.writeFileSync(a,'original');
 archiveRequest('first.json',done);
 assert.equal(fs.readFileSync(b,'utf8'),'original');
 assert.equal(fs.existsSync(a),false);
});
test('EXDEV: archive uses exclusive copy then unlinks source',()=>{
 const [a,b,done]=paths('cross-device.json');
 fs.writeFileSync(a,'intact-data');
 const original=fs.renameSync;
 fs.renameSync=(src,dst)=>{
  if(src===a && dst===b) {const e=new Error('cross mount');e.code='EXDEV';throw e;}
  return original(src,dst);
 };
 try {
  archiveRequest('cross-device.json',done);
  assert.equal(fs.readFileSync(b,'utf8'),'intact-data');
  assert.equal(fs.existsSync(a),false);
 } finally {fs.renameSync=original;}
});
test('never overwrite a preexisting destination',()=>{
 const [a,b,done]=paths('duplicate.json');
 fs.writeFileSync(a,'new');fs.writeFileSync(b,'keep');
 assert.throws(()=>archiveRequest('duplicate.json',done),/ARCHIVE_ALREADY_EXISTS/);
 assert.equal(fs.readFileSync(a,'utf8'),'new');
 assert.equal(fs.readFileSync(b,'utf8'),'keep');
});
test('cleanup simulated archive fixture',()=>fs.rmSync(dir,{recursive:true,force:true}));
