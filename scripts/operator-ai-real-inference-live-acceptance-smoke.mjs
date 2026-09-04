import assert from 'node:assert/strict';
import { handleOperatorAiRealInferenceAcceptance, operatorAiRealInferenceAcceptanceManifest } from '../src/operator-ai/live-acceptance-v1.js';

const HEAD='32d468a75e9addb0f67f874bb62e7fc959e629b1';
const env={
  API_TOKEN:'test-token',
  OPENAI_API_KEY:'test-openai-key',
  RIOSYSTEMS_ENVIRONMENT:'staging',
  RIOSYSTEMS_PRODUCTION_DEPLOY:'false',
  RIOSYSTEMS_EXTERNAL_WRITES:'false',
  AURENTARA_OPERATOR_AI_REAL_INFERENCE_ENABLED:'true',
  CF_VERSION_METADATA:{id:'test-version',tag:HEAD,timestamp:'2026-09-04T12:15:00.000Z'}
};
const url='https://worker.invalid/factory/diagnostics/operator-ai-real-inference-acceptance';
const request=(token='test-token',sha=HEAD)=>new Request(url,{method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json','x-aurentara-operator-ai-acceptance-confirmation':'AURENTARA_OPERATOR_AI_REAL_ACCEPTANCE_V1'},body:JSON.stringify({expected_canonical_sha:sha})});

const manifest=operatorAiRealInferenceAcceptanceManifest();
assert.equal(manifest.staging_only,true);
assert.equal(manifest.synthetic_project_only,true);
assert.equal(manifest.max_paid_calls_per_request,1);
assert.equal(manifest.no_retries,true);
assert.equal(manifest.level_4_status,'NOT_ACTIVATED');

const unauthorized=await handleOperatorAiRealInferenceAcceptance(request('wrong'),env);
assert.equal(unauthorized.status,401);

let mismatchFetches=0;
const mismatch=await handleOperatorAiRealInferenceAcceptance(request('test-token','aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'),env,{fetch_impl:async()=>{mismatchFetches++;throw new Error('must not fetch')}});
assert.equal(mismatch.status,409);
assert.equal(mismatchFetches,0);

let calls=0;
const fetch_impl=async (target,init)=>{
  calls++;
  assert.equal(target,'https://api.openai.com/v1/responses');
  const api=JSON.parse(init.body);
  assert.equal(api.model,'gpt-5.6-luna');
  assert.deepEqual(api.tools,[]);
  assert.equal(api.store,false);
  const projection=JSON.parse(api.input);
  assert.equal(projection.project.scope_key,'synthetic-operator-ai:real-inference-acceptance-v1');
  assert.equal(projection.hard_constraints.production_authorized,false);
  const next=projection.deterministic_decision.primary_next_action.code;
  const output={
    answer:'Das synthetische Testprojekt ist im verifizierten Staging-Kontext bereit. Der wichtigste nächste Schritt bleibt die deterministisch priorisierte Aktion.',
    reasoning_summary:'Es wurden nur verifizierte synthetische Projektdaten verwendet und nichts gestartet.',
    recommended_next_action:{code:next,message:'copy'},
    relevant_blockers:projection.deterministic_decision.blockers.map(x=>x.code),
    unknowns:projection.unknowns,
    confidence:'HIGH'
  };
  return new Response(JSON.stringify({output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(output)}]}],usage:{input_tokens:150,output_tokens:70,total_tokens:220}}),{status:200,headers:{'content-type':'application/json'}});
};

const success=await handleOperatorAiRealInferenceAcceptance(request(),env,{fetch_impl});
assert.equal(success.status,200);
const body=await success.json();
assert.equal(body.ok,true);
assert.equal(body.deployed_canonical_sha,HEAD);
assert.equal(body.provider,'openai-api');
assert.equal(body.model,'gpt-5.6-luna');
assert.equal(body.inference_status,'VERIFIED');
assert.equal(body.usage.total_tokens,220);
assert.equal(body.paid_inference_calls,1);
assert.equal(body.tool_calls,0);
assert.equal(body.execution_started,false);
assert.equal(body.level_4_status,'NOT_ACTIVATED');
assert.equal(body.secret_value_exposed,false);
assert.equal(body.production_deploy,false);
assert.equal(body.external_writes,false);
assert.equal(calls,1);

console.log(JSON.stringify({ok:true,schema:'aurentara.operator-ai-real-inference-live-acceptance-smoke.result',mocked_only:true,real_paid_calls:0,canonical_binding:'PASS',single_call_bound:'PASS',production_deploy:false,external_writes:false,level_4:'NOT_ACTIVATED'},null,2));
