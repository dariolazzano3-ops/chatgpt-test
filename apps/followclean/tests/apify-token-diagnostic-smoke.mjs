// FollowClean Apify secret diagnostic synthetic test.
// No actual token, API call, Instagram account or billable Actor run.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const template=await readFile(new URL('../worker.instagram-template.mjs',import.meta.url),'utf8');
const code=template.replace('const FOLLOWCLEAN_HTML = __FOLLOWCLEAN_HTML__;',"const FOLLOWCLEAN_HTML = '';")+
  '\nexport {fcVerifyApifyTokenOnce};';
const {fcVerifyApifyTokenOnce}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
let state='pending',writes=0,queries=0,stored={};
const db={
  prepare(sql){
    return {
      bind(...args){
        return {async run(){
          if(sql.includes("state='running' WHERE test_id=? AND state='pending'")){
            const changes=state==='pending'?1:0;
            if(changes)state='running';
            return {success:true,meta:{changes}};
          }
          if(sql.includes('SET state=?, checked_at=')){
            stored={state:args[0],userAuth:args[1],actorRuns:args[2],error:args[3]};
            state=args[0];writes++;
            return {success:true,meta:{changes:1}};
          }
          throw new Error('Unexpected SQL');
        }};
      }
    };
  }
};
const original=globalThis.fetch;
try{
  globalThis.fetch=async(url,options)=>{
    queries++;
    assert.equal(options.method,'GET');
    assert.equal(options.headers.Authorization,'Bearer TEST_TOKEN_NOT_REAL');
    assert.equal(new URL(url).searchParams.has('token'),false);
    return new Response(null,{status:url.includes('/users/me')?403:200});
  };
  const env={FC_APIFY_BUDGET_DB:db,FC_APIFY_TOKEN:'TEST_TOKEN_NOT_REAL'};
  await fcVerifyApifyTokenOnce(env);
  await fcVerifyApifyTokenOnce(env);
  assert.equal(queries,2);
  assert.equal(writes,1);
  assert.deepEqual(stored,{state:'complete',userAuth:403,actorRuns:200,error:null});
  console.log('PASS: one-shot Apify token diagnostic, no replay, secret stays server-side, no POST');
}finally{globalThis.fetch=original}
