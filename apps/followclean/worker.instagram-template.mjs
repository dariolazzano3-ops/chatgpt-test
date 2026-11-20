// FollowClean Cloudflare Worker template: inject JSON.stringify(index.html) into __FOLLOWCLEAN_HTML__ at build time.
// Live Instagram data: explicit OAuth consent for Business/Creator accounts only.
// Required Worker secrets: FC_IG_CLIENT_ID, FC_IG_CLIENT_SECRET, FC_IG_SESSION_SECRET (>=32 characters).
const FOLLOWCLEAN_HTML = __FOLLOWCLEAN_HTML__;
const COOKIE_SESSION = '__Host-fc-ig-session';
const COOKIE_OAUTH = '__Host-fc-ig-state';
const API_PREFIX = '/api/instagram/';
const GRAPH_VERSION = 'v27.0';
const MAX_COOKIE_AGE = 30 * 24 * 3600;
const MIN_GRAPH_REFRESH_MS = 60 * 1000;


// Cost gate for potential username-only analyses. This endpoint never starts a paid Actor.
// All counts in public quote requests are UNVERIFIED hypothetical inputs. Never authorize a
// charged operation on the basis of these values or the browser's decision/status.
const FC_BUDGET_POLICY = Object.freeze({
  version: 'v2-lance-free',
  maxApiEurCents: 25,
  conservativeUsdCap: 0.20,
  autoFollowersMax: 1000,
  manualReviewFollowersMax: 5000,
  absoluteFollowingMax: 5000,
  referenceUsdPer1000: 1.50,
  referenceUsdRunFee: 0.001,
  referenceUsdProfileFee: 0.001,
  referenceRuns: 1,
  freeTierResultsLimitPerList: 100,
  bufferPercent: 20,
  extraReserveUsd: 0.01,
  // No provider contract/API key/business permission approved yet. Fail closed.
  executionEnabled: false
});
function validCount(n) { return Number.isSafeInteger(n) && n >= 0 && n <= 1000000000; }
function safeUsd(n) { return Math.ceil(n * 10000) / 10000; }
function estimateFollowCleanBudget(followers, following) {
  const p = FC_BUDGET_POLICY;
  if (!validCount(followers) || !validCount(following)) {
    return {status:'COUNTS_REQUIRED', eligible:false, estimatedUsd:null,
      message:'Verifizierte Follower- und Gefolgt-Zahlen erforderlich.'};
  }
  if (followers > p.manualReviewFollowersMax || following > p.absoluteFollowingMax) {
    return {status:'LARGE_PROFILE', eligible:false, estimatedUsd:null,
      message:'Großes Profil: keine automatische API-Abfrage. Lokalen ZIP-Import verwenden.'};
  }
  // One Actor run requests both relationship types. Include run and profile events.
  // This is only a quote at the documented reference tariff, NOT an executable budget reservation.
  const baseUsd = ((followers + following) / 1000) * p.referenceUsdPer1000 +
    p.referenceUsdRunFee * p.referenceRuns + p.referenceUsdProfileFee;
  const withReserveUsd = safeUsd(baseUsd * (1 + p.bufferPercent / 100) + p.extraReserveUsd);
  const withinBudget = withReserveUsd <= p.conservativeUsdCap;
  if (!withinBudget) {
    return {status:'OVER_BUDGET', eligible:false, estimatedUsd:withReserveUsd,
      message:'Kostenschätzung über unserem vorsichtigen $0,20-Limit. Keine automatische Abfrage.'};
  }
  if (followers > p.autoFollowersMax) {
    return {status:'REVIEW_REQUIRED', eligible:false, estimatedUsd:withReserveUsd,
      message:'Mittleres Profil: zusätzliche serverseitige Vorabprüfung erforderlich.'};
  }
  return {status:'CANDIDATE', eligible:true, estimatedUsd:withReserveUsd,
    message:'Kostenseitig geeignet, aber noch keine Berechtigung zum API-Start.'};
}

/*
 * Opt-in Apify adapter staging.
 * This Worker does not start actors, even if someone adds a token to Cloudflare.
 * A later release needs platform approval, account-ownership verification,
 * durable idempotency, global spend reservation, and an independently checked tariff.
 * Source: lance_api/instagram-followers-following-scraper.
 */
const FC_APIFY_ACTOR = 'cwcr3CoSbucMVwFsF'; // Verified immutable Apify Actor ID
const FC_APIFY_ACTOR_SLUG = 'lance_api/instagram-followers-following-scraper';
const FC_PROVIDER_EXECUTION_ENABLED = false;
function fcNormalizeUsername(value) {
  if (typeof value !== 'string') return null;
  const username = value.replace(/^@/,'').trim().toLowerCase();
  return /^[a-z0-9._]{1,30}$/.test(username) ? username : null;
}
function buildApifyDryRun(username, trustedCounts) {
  const name=fcNormalizeUsername(username);
  if (!name || !trustedCounts || trustedCounts.verifiedByServer !== true)
    return {ok:false,error:'trusted_account_counts_required'};
  if(trustedCounts.followers===0 && trustedCounts.following===0)
    return {ok:false,error:'no_relationships_to_analyze'};
  // Do not bypass actual budget denial just because the free plan has a coverage cap.
  const price=estimateFollowCleanBudget(trustedCounts.followers,trustedCounts.following);
  const maximum=Math.max(trustedCounts.followers,trustedCounts.following);
  if (maximum>FC_BUDGET_POLICY.freeTierResultsLimitPerList)
    return {ok:false,error:'FREE_TIER_LIMIT',quote:price,
      message:'Free-Tarif liest höchstens 100 pro Liste. Kein behauptetes Vollergebnis.'};
  if(price.status!=='CANDIDATE')return {ok:false,error:price.status,quote:price};
  // Apify API: maxItems is a query parameter, NOT maxPaidDatasetItems.
  // One list capped to <resultsLimit>, both directions capped via maxItems.
  const apiQuery={
    maxTotalChargeUsd:FC_BUDGET_POLICY.conservativeUsdCap,
    maxItems:trustedCounts.followers+trustedCounts.following,
    restartOnError:false,
    memory:128,
    timeout:90
  };
  return {
    ok:true,executed:false,provider:'Apify',actor:FC_APIFY_ACTOR,
    endpoint:'/v2/acts/'+FC_APIFY_ACTOR+'/runs',
    input:{profiles:[name],dataToScrape:'both',resultsLimit:Math.max(1,maximum)},
    runOptions:apiQuery,
    quote:price,
    gates:['owner_consent','actor_usage_approval','provider_credentials',
      'durable_idempotency','durable_global_spend_limit','current_tariff_verified']
  };
}

function buildApifyRequestDescription(draft){
  if (!draft || draft.ok!==true || draft.executed!==false ||
    draft.actor!==FC_APIFY_ACTOR || !draft.quote || draft.quote.status!=='CANDIDATE')
    return {ok:false,error:'invalid_draft'};
  const url=new URL('https://api.apify.com'+draft.endpoint);
  for(const [key,value] of Object.entries(draft.runOptions)){
    if(!['maxTotalChargeUsd','maxItems','restartOnError','memory','timeout'].includes(key))
      return {ok:false,error:'unexpected_query_param'};
    url.searchParams.set(key,String(value));
  }
  // Intentionally exclude tokens. Authorization belongs exclusively in a
  // private Worker secret header, never in URL, repo, client or logs.
  return {ok:true,executed:false,method:'POST',url:url.toString(),
    headers:{'Content-Type':'application/json','Authorization':'Bearer [WORKER_SECRET_ONLY]'},
    body:JSON.stringify(draft.input)};
}

// Conservative offline parser for *synthetic test fixtures only* until a verified
// external data source and provenance are available. Never trust public request
// bodies as proof of follower or following membership.
function validateApifyEvidence(username,counts,rows,summary){
  const source=fcNormalizeUsername(username);
  if(!source||!counts||counts.verifiedByServer!==true||
     !validCount(counts.followers)||!validCount(counts.following)||
     !Array.isArray(rows)||rows.length!==counts.followers+counts.following||
     !summary||summary.status!=='SUCCEEDED'||summary.billing?.confirmed!==true)
    return {ok:false,reason:'unverified_or_incomplete'};
  if(rows.length>1200) return {ok:false,reason:'over_test_limit'};
  const coverage=summary.results;
  if(!Array.isArray(coverage))return {ok:false,reason:'missing_coverage'};
  const followerProof=coverage.find(v=>v.relationshipType==='follower'&&fcNormalizeUsername(v.sourceUsername)===source);
  const followingProof=coverage.find(v=>v.relationshipType==='following'&&fcNormalizeUsername(v.sourceUsername)===source);
  if(!followerProof||!followingProof||
    [followerProof,followingProof].some(x=>x.coverageStatus!=='COMPLETE'||
      x.billingConfirmed!==true || x.hasNextPage===true) ||
    followerProof.deliveredCount!==counts.followers||
    followingProof.deliveredCount!==counts.following)
    return {ok:false,reason:'incomplete_coverage'};
  const followers=new Set(),following=new Map();
  for(const record of rows){
    if(!record||fcNormalizeUsername(record.sourceUsername)!==source||
       !['follower','following'].includes(record.relationshipType)||
       !/^[0-9]{1,32}$/.test(String(record.userId||''))||
       !fcNormalizeUsername(record.username))
      return {ok:false,reason:'ambiguous_record'};
    if(record.relationshipType==='follower'){
      if(followers.has(record.userId))return {ok:false,reason:'duplicate_record'};
      followers.add(record.userId);
    }else{
      if(following.has(record.userId))return {ok:false,reason:'duplicate_record'};
      following.set(record.userId,fcNormalizeUsername(record.username));
    }
  }
  if(followers.size!==counts.followers||following.size!==counts.following)
    return {ok:false,reason:'count_discrepancy'};
  const first=[...following].find(([id])=>!followers.has(id));
  return {ok:true,source:'synthetic_offline_evidence_parser',verifiedAgainstCounts:true,
    nonfollower:first?{username:first[1]}:null,
    coverageNote:'COMPLETE describes exposed pagination; Instagram may still omit accounts.'};
}


/* FC_APIFY_SMARTSCAN_V2_START */
// Paid calls are deliberately NOT implemented here. This is a read-only contract,
// intended for a restricted Apify token and durable global D1 budget gate.
const FC_V2_ACTORS = Object.freeze({
  following:'LFWuGJErve4ycMo6l',
  checker:'5DvofmvZ6Tzdo4b56'
});
const FC_V2_MAX_USD=0.20;
const FC_V2_BATCH=10;
const FC_V2_FREE_FOLLOWING_CAP=20; // pilot observation; do not promise pagination.
function fcV2Plan(username){
  const account=fcNormalizeUsername(username);
  if(!account || account!=='ysrrioo')
    return {ok:false,executed:false,reason:'pilot_account_not_authorized'};
  return {
    ok:true,executed:false,account,verificationRequired:true,
    billing:{maxTotalUsd:FC_V2_MAX_USD,guaranteedAcrossRuns:false,
      globalReservationRequired:true,globalBudgetDatabase:'FC_APIFY_BUDGET_DB'},
    following:{
      actor:FC_V2_ACTORS.following,
      input:{usernames:[account],listType:'following',maxPerProfile:FC_V2_FREE_FOLLOWING_CAP,onlyNew:false},
      runOptions:{maxTotalChargeUsd:0.05,restartOnError:false,timeout:120}
    },
    checker:{
      actor:FC_V2_ACTORS.checker,
      inputTemplate:{account,usernames:'TEN_VERIFIED_FOLLOWING_NAMES',addSummaryRow:true},
      runOptions:{maxTotalChargeUsd:0.05,restartOnError:false,timeout:120}
    },
    constraints:['owner_authorization','restricted_token_permissions','free_tier_pagination_limit',
      'global_spend_reservation','trusted_following_provenance','negative_second_source_verification']
  };
}
function fcV2ReadFollowing(account,rows){
  const source=fcNormalizeUsername(account);
  if(!source||!Array.isArray(rows)||rows.length>FC_V2_FREE_FOLLOWING_CAP+4)
    return {ok:false,reason:'bad_or_oversized_following_dataset'};
  const seen=new Set(),names=[];
  for(const row of rows){
    if(!row||typeof row!=='object')return {ok:false,reason:'invalid_row'};
    // Summary/error/partial rows never become candidates.
    if(row.error || row.type==='SUMMARY' || row.listType==='summary')continue;
    const value=fcNormalizeUsername(row.username);
    if(fcNormalizeUsername(row.sourceUsername)!==source||
      row.listType!=='following'||!value)
      return {ok:false,reason:'source_or_list_mismatch'};
    if(seen.has(value))return {ok:false,reason:'duplicate'};
    seen.add(value);names.push(value);
  }
  return {ok:true,account:source,candidates:names,coverage:
    names.length===FC_V2_FREE_FOLLOWING_CAP?'BOUNDED_SAMPLE':'NOT_PROVEN',
    note:'Only the returned candidates are usable. No next-page cursor is established.'};
}
function fcV2MakeCheckerBatch(account,following,offset=0){
  const source=fcNormalizeUsername(account);
  if(!source||following?.ok!==true||following.account!==source||
    !Array.isArray(following.candidates)||!Number.isSafeInteger(offset)||offset<0||
    offset>=following.candidates.length||offset%FC_V2_BATCH!==0)
    return {ok:false,reason:'invalid_or_untrusted_batch'};
  const users=following.candidates.slice(offset,offset+FC_V2_BATCH);
  if(!users.length||users.length>FC_V2_BATCH||users.some(x=>fcNormalizeUsername(x)!==x))
    return {ok:false,reason:'invalid_candidates'};
  return {ok:true,executed:false,actor:FC_V2_ACTORS.checker,
    input:{account:source,usernames:users,addSummaryRow:true},
    runOptions:{maxTotalChargeUsd:0.05,restartOnError:false,timeout:120},
    requested:users,offset,nextOffset:offset+users.length};
}
function fcV2ReviewChecks(batch,rows){
  if(batch?.ok!==true||!Array.isArray(batch.requested)||!Array.isArray(rows)||
    rows.length>batch.requested.length+2)return {ok:false,reason:'untrusted_checker_response'};
  const allowed=new Set(batch.requested),result=new Map();
  for(const row of rows){
    if(!row||typeof row!=='object')return {ok:false,reason:'invalid_checker_row'};
    if(row.type==='SUMMARY'||row.username===undefined&&row.follows===undefined)continue;
    const name=fcNormalizeUsername(row.username);
    if(!name||!allowed.has(name)||result.has(name))
      return {ok:false,reason:'unexpected_or_duplicate_checker_row'};
    const account=fcNormalizeUsername(row.account);
    const valid=!row.error&&account===batch.input.account&&
      (row.follows===true||row.follows===false);
    result.set(name,valid?(row.follows?'MUTUAL':'UNVERIFIED_NEGATIVE'):'UNKNOWN');
  }
  return {ok:true,executed:false,confirmedNonfollowers:[],
    results:batch.requested.map(username=>({username,
      status:result.get(username)||'UNKNOWN'})),
    reason:'A checker-negative needs independent evidence before claiming confirmed nonfollower.'};
}
/* FC_APIFY_SMARTSCAN_V2_END */
/* FC_APIFY_V2_LEDGER_START */
// Durable budget ledger + batch orchestration for Smart Scan V2. Still NOT wired to any
// Actor start: nothing in this block performs a network request. Requires the migration
// sql/fc_apify_budget_v2_pilot.sql. Every failure mode answers "do not start a paid run".
const FC_V2_SCOPE='pilot-ysrrioo-v1';
const FC_V2_RUN_CAP_MICROS=50000;
const FC_V2_TOTAL_MICROS=200000;
async function fcV2RunKey(scope,kind,account,usernames){
  const a=fcNormalizeUsername(account);
  if(typeof scope!=='string'||!a||(kind!=='following'&&kind!=='checker')||!Array.isArray(usernames)||
    usernames.some(x=>fcNormalizeUsername(x)!==x))return null;
  if(kind==='checker'&&(!usernames.length||usernames.length>FC_V2_BATCH))return null;
  // Order-independent: the same candidates can never be billed twice under another order.
  const text=JSON.stringify(['fc-v2',scope,kind,a,[...new Set(usernames)].sort()]);
  const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));
  return [...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,'0')).join('');
}
async function fcV2Reserve(db,runKey,kind,now=Date.now()){
  if(!db||typeof runKey!=='string'||!/^[0-9a-f]{64}$/.test(runKey)||
    (kind!=='following'&&kind!=='checker'))return {ok:false,mayStart:false,reason:'invalid_reservation'};
  try{
    const res=await db.prepare('INSERT INTO fc_apify_v2_runs (run_key,scope,kind,cap_usd_micros,state,created_ts,updated_ts) VALUES (?1,?2,?3,?4,\'reserved\',?5,?5) ON CONFLICT(run_key) DO NOTHING')
      .bind(runKey,FC_V2_SCOPE,kind,FC_V2_RUN_CAP_MICROS,now).run();
    if(res?.meta?.changes===1)return {ok:true,mayStart:true,runKey,capUsd:FC_V2_RUN_CAP_MICROS/1e6};
    const row=await db.prepare('SELECT state FROM fc_apify_v2_runs WHERE run_key=?1').bind(runKey).first();
    // Same work already reserved/billed once: never start it a second time, never retry.
    return {ok:false,mayStart:false,reason:'duplicate_run',existingState:row?.state||'unknown'};
  }catch(e){
    const exceeded=String(e?.message||e).includes('followclean_v2_total_budget_exceeded');
    return {ok:false,mayStart:false,reason:exceeded?'total_budget_exceeded':'ledger_unavailable'};
  }
}
async function fcV2Advance(db,runKey,state,detail={},now=Date.now()){
  if(!db||!['submitted','settled','failed'].includes(state))return {ok:false,reason:'invalid_transition'};
  const actual=detail.actualUsd===undefined?null:Math.ceil(detail.actualUsd*1e6);
  if(actual!==null&&(!Number.isSafeInteger(actual)||actual<0))return {ok:false,reason:'invalid_cost'};
  if(state==='settled'&&actual===null)return {ok:false,reason:'settle_requires_cost'};
  const runId=typeof detail.providerRunId==='string'&&/^[A-Za-z0-9]{1,40}$/.test(detail.providerRunId)?detail.providerRunId:null;
  if(state==='submitted'&&runId===null)return {ok:false,reason:'submit_requires_run_id'};
  try{
    // MAX() keeps reported cost monotonic even if provider polls arrive out of order.
    // The D1 trigger tr_fc_apify_v2_update independently enforces the same rules.
    const res=await db.prepare('UPDATE fc_apify_v2_runs SET state=?2, actual_usd_micros=CASE WHEN ?3 IS NULL THEN actual_usd_micros ELSE MAX(COALESCE(actual_usd_micros,0),?3) END, provider_run_id=COALESCE(provider_run_id,?4), updated_ts=MAX(updated_ts,?5) WHERE run_key=?1 AND scope=?6 AND state IN (\'reserved\',\'submitted\')')
      .bind(runKey,state,actual,runId,now,FC_V2_SCOPE).run();
    return res?.meta?.changes===1?{ok:true}:{ok:false,reason:'no_advanceable_run'};
  }catch{return {ok:false,reason:'transition_rejected'};}
}
// Late provider bill for a run that already ended (failed or settled). Apify can charge a
// run that failed, timed out or was aborted, and usage can be finalised after the run ends.
// The state stays terminal; only the reported cost may rise. Because every row counts with
// MAX(reserve, cost), a late bill can only shrink the remaining budget, never free any.
async function fcV2RecordLateCost(db,runKey,actualUsd,detail={},now=Date.now()){
  const actual=typeof actualUsd==='number'?Math.ceil(actualUsd*1e6):NaN;
  if(!db||typeof runKey!=='string'||!Number.isSafeInteger(actual)||actual<0)return {ok:false,reason:'invalid_cost'};
  const runId=typeof detail.providerRunId==='string'&&/^[A-Za-z0-9]{1,40}$/.test(detail.providerRunId)?detail.providerRunId:null;
  try{
    const res=await db.prepare('UPDATE fc_apify_v2_runs SET actual_usd_micros=MAX(COALESCE(actual_usd_micros,0),?2), provider_run_id=COALESCE(provider_run_id,?3), updated_ts=MAX(updated_ts,?4) WHERE run_key=?1 AND scope=?5 AND state IN (\'failed\',\'settled\')')
      .bind(runKey,actual,runId,now,FC_V2_SCOPE).run();
    if(res?.meta?.changes!==1)return {ok:false,reason:'no_finished_run'};
    const budget=await fcV2BudgetStatus(db);
    return {ok:true,overBudget:budget.overBudget??null,remainingUsd:budget.remainingUsd??0,startableRuns:budget.startableRuns};
  }catch{return {ok:false,reason:'late_cost_rejected'};}
}
async function fcV2BudgetStatus(db){
  try{
    const row=await db.prepare('SELECT COUNT(*) AS runs, COALESCE(SUM(MAX(cap_usd_micros,COALESCE(actual_usd_micros,0))),0) AS committed, COALESCE(SUM(COALESCE(actual_usd_micros,0)),0) AS reported FROM fc_apify_v2_runs WHERE scope=?1')
      .bind(FC_V2_SCOPE).first();
    const committed=Number(row.committed);
    if(!Number.isSafeInteger(committed))throw Error('bad');
    return {ok:true,scope:FC_V2_SCOPE,runs:Number(row.runs),totalUsd:FC_V2_TOTAL_MICROS/1e6,
      committedUsd:committed/1e6,providerReportedUsd:Number(row.reported)/1e6,
      remainingUsd:Math.max(0,FC_V2_TOTAL_MICROS-committed)/1e6,
      // D1 can refuse new runs but cannot undo provider charges: surface an overrun loudly.
      overBudget:committed>FC_V2_TOTAL_MICROS,
      startableRuns:Math.max(0,Math.floor((FC_V2_TOTAL_MICROS-committed)/FC_V2_RUN_CAP_MICROS))};
  }catch{return {ok:false,reason:'ledger_unavailable',startableRuns:0,overBudget:null};}
}
// Evidence = an independent, owner-authorized and COMPLETE follower list (e.g. the local
// Instagram export). Without it, no checker answer can ever become a confirmed nonfollower.
function fcV2Classify(checkStatus,username,evidence){
  const trusted=evidence&&evidence.authorized===true&&evidence.complete===true&&
    evidence.followers instanceof Set;
  if(checkStatus==='MUTUAL')
    return trusted&&!evidence.followers.has(username)?'UNKNOWN':'MUTUAL';
  if(checkStatus==='UNVERIFIED_NEGATIVE'){
    if(!trusted)return 'UNVERIFIED_NEGATIVE';
    return evidence.followers.has(username)?'UNKNOWN':'CONFIRMED_NONFOLLOWER';
  }
  return 'UNKNOWN';
}
// Pure decision step. state.checked: {username:status} for every candidate already billed;
// state.shown: usernames whose confirmed hit the user has already seen.
function fcV2NextStep(account,following,state={},evidence=null,limit=FC_V2_FREE_FOLLOWING_CAP){
  const source=fcNormalizeUsername(account);
  if(!source||following?.ok!==true||following.account!==source||!Array.isArray(following.candidates)||
    !Number.isSafeInteger(limit)||limit<1||following.candidates.length>limit||
    following.candidates.some(u=>fcNormalizeUsername(u)!==u)||
    new Set(following.candidates).size!==following.candidates.length)
    return {ok:false,action:'STOP_ERROR',reason:'untrusted_following'};
  const checked=state.checked&&typeof state.checked==='object'?state.checked:{};
  const shown=new Set(Array.isArray(state.shown)?state.shown:[]);
  const all=following.candidates;
  for(let offset=0;offset<all.length;offset+=FC_V2_BATCH){
    const group=all.slice(offset,offset+FC_V2_BATCH);
    // Only names that were never billed are sent; a partly billed group resumes with the rest.
    const open=group.filter(u=>!Object.hasOwn(checked,u));
    if(open.length)
      return {ok:true,action:'CHECK_BATCH',executed:false,offset,
        batch:{ok:true,executed:false,actor:FC_V2_ACTORS.checker,
          input:{account:source,usernames:open,addSummaryRow:true},
          runOptions:{maxTotalChargeUsd:0.05,restartOnError:false,timeout:120},
          requested:open,offset,nextOffset:offset+group.length}};
    for(const username of group){
      if(shown.has(username))continue;
      if(fcV2Classify(checked[username],username,evidence)==='CONFIRMED_NONFOLLOWER')
        return {ok:true,action:'STOP_CONFIRMED',hit:{username,status:'CONFIRMED_NONFOLLOWER',
          profileUrl:'https://www.instagram.com/'+username+'/'},checkedCount:offset+group.length};
    }
  }
  const tally={CONFIRMED_NONFOLLOWER:0,MUTUAL:0,UNVERIFIED_NEGATIVE:0,UNKNOWN:0};
  for(const u of all)tally[fcV2Classify(checked[u],u,evidence)]++;
  return {ok:true,action:'SAMPLE_EXHAUSTED',checkedCount:all.length,tally,coverage:'BOUNDED_SAMPLE',
    note:'Only the returned sample was examined. No statement about accounts beyond it.'};
}
/* FC_APIFY_V2_LEDGER_END */
/* FC_EXPORT_CHECKER_V1_START */
// Export + optional checker. The user's complete Instagram export is the primary source and
// the only basis for "does not follow back" (true for the moment of the export). The checker
// is an optional freshness hint for those export results, ten accounts per run.
// DRY RUN ONLY: nothing in this block performs a network request or starts an Actor.
const FC_EC_MAX_LIST=20000;
function fcEcNames(list){
  if(!Array.isArray(list)||list.length>FC_EC_MAX_LIST)return null;
  const out=[],seen=new Set();
  for(const raw of list){
    const name=fcNormalizeUsername(raw);
    if(!name)return null;
    if(!seen.has(name)){seen.add(name);out.push(name);}
  }
  return out;
}
// data: {account, following[], followers[], complete, authorized}. "complete" must come from
// the export parser (all follower parts read); "authorized" means the owner supplied it.
function fcEcDeriveCandidates(data){
  const account=fcNormalizeUsername(data?.account);
  if(!account)return {ok:false,reason:'invalid_account'};
  if(data.authorized!==true)return {ok:false,reason:'export_not_owner_authorized'};
  // An incomplete follower list proves nothing, so it yields no candidates at all.
  if(data.complete!==true)return {ok:false,reason:'export_incomplete'};
  const following=fcEcNames(data.following),followers=fcEcNames(data.followers);
  if(!following||!followers)return {ok:false,reason:'invalid_or_oversized_export'};
  const followerSet=new Set(followers);
  const candidates=following.filter(u=>u!==account&&!followerSet.has(u));
  return {ok:true,account,source:'EXPORT',asOf:'EXPORT_TIME',candidates,
    counts:{following:following.length,followers:followers.length,nonFollowersAtExport:candidates.length,
      checkerRunsForAll:Math.ceil(candidates.length/FC_V2_BATCH)},
    evidence:{authorized:true,complete:true,followers:followerSet}};
}
function fcEcNextStep(plan,state={}){
  if(plan?.ok!==true||plan.source!=='EXPORT')return {ok:false,action:'STOP_ERROR',reason:'no_export_plan'};
  if(!plan.candidates.length)return {ok:true,action:'NOTHING_TO_CHECK',checkedCount:0};
  const step=fcV2NextStep(plan.account,{ok:true,account:plan.account,candidates:plan.candidates},
    state,plan.evidence,FC_EC_MAX_LIST);
  if(step.action==='SAMPLE_EXHAUSTED')
    return {ok:true,action:'ALL_CHECKED',checkedCount:step.checkedCount,report:fcEcReport(plan,state)};
  if(step.action==='STOP_CONFIRMED')step.hit.meaning='EXPORT_AND_LIVE_CHECK_AGREE';
  return step;
}
// One line per export result. Wording is deliberately modest: the export is a fact about the
// export moment, the checker is a single third-party answer about now.
function fcEcReport(plan,state={}){
  if(plan?.ok!==true)return {ok:false,reason:'no_export_plan'};
  const checked=state.checked&&typeof state.checked==='object'?state.checked:{};
  const rows=plan.candidates.map(username=>{
    const base={username,exportStatus:'NONFOLLOWER_AT_EXPORT'};
    if(!Object.hasOwn(checked,username))return {...base,liveCheck:'NOT_CHECKED',label:'EXPORT_ONLY'};
    const status=fcV2Classify(checked[username],username,plan.evidence);
    if(status==='CONFIRMED_NONFOLLOWER')return {...base,liveCheck:'AGREES',label:'EXPORT_AND_LIVE_CHECK_AGREE'};
    // Checker says "follows back": the export is older, so this may be a real change. Never a hit.
    if(checked[username]==='MUTUAL')return {...base,liveCheck:'CONFLICT_FOLLOW_BACK_REPORTED',label:'UNCONFIRMED'};
    return {...base,liveCheck:'NO_USABLE_ANSWER',label:'UNCONFIRMED'};
  });
  const count=label=>rows.filter(r=>r.label===label).length;
  return {ok:true,asOf:'EXPORT_TIME',rows,
    summary:{exportOnly:count('EXPORT_ONLY'),agree:count('EXPORT_AND_LIVE_CHECK_AGREE'),unconfirmed:count('UNCONFIRMED')},
    disclaimer:'Export results describe the moment of the export. A live check is one additional third-party answer, not proof of the current state.'};
}
// Server side of the dry run: validates one batch of at most ten export candidates.
async function fcEcDryRunBatch(account,usernames){
  const source=fcNormalizeUsername(account);
  if(!source||source!=='ysrrioo')return {ok:false,executed:false,reason:'pilot_account_not_authorized'};
  if(!Array.isArray(usernames)||!usernames.length||usernames.length>FC_V2_BATCH)
    return {ok:false,executed:false,reason:'batch_must_have_1_to_10_names'};
  const names=usernames.map(fcNormalizeUsername);
  if(names.some(n=>!n)||new Set(names).size!==names.length||names.includes(source))
    return {ok:false,executed:false,reason:'invalid_or_duplicate_names'};
  return {ok:true,executed:false,actor:FC_V2_ACTORS.checker,
    input:{account:source,usernames:names,addSummaryRow:true},
    runOptions:{maxTotalChargeUsd:0.05,restartOnError:false,timeout:120},
    requested:names,runKey:await fcV2RunKey(FC_V2_SCOPE,'checker',source,names)};
}
/* FC_EXPORT_CHECKER_V1_END */

async function fcApifyReadOnlyPreflight(env) {
  const token=typeof env.FC_APIFY_TOKEN==='string'?env.FC_APIFY_TOKEN:'';
  if(token.length<24)return {ok:false,tokenConfigured:false,runStarted:false,reason:'token_not_configured'};
  const headers={Authorization:'Bearer '+token,Accept:'application/json'};
  const timeout=()=>AbortSignal.timeout(10000);
  async function get(path) {
    try {
      const response=await fetch('https://api.apify.com'+path,{headers,signal:timeout()});
      let data=null;try{data=await response.json();}catch{}
      return {status:response.status,data};
    } catch(e) {
      return {status:0,error:e?.name==='TimeoutError'?'timeout':'network_error'};
    }
  }
  // GET-only checks. These never call an Actor, create a run, or incur Actor event charges.
  const identity=await get('/v2/users/me');
  const actors=[];
  for(const [kind,id] of Object.entries(FC_V2_ACTORS)) {
    const response=await get('/v2/acts/'+encodeURIComponent(id));
    const pricing=response.data?.data?.pricingInfo||response.data?.pricingInfo||{};
    const model=String(pricing.pricingModel||'').toUpperCase();
    const minimum=Number(pricing.minimalMaxTotalChargeUsd);
    actors.push({kind,actorId:id,httpStatus:response.status,
      pricingModel:model||'UNKNOWN',
      minimumMaxTotalChargeUsd:Number.isFinite(minimum)?minimum:null,
      supportsEnforceableFiveCentCap:model==='PAY_PER_EVENT'&&Number.isFinite(minimum)&&minimum<=0.05});
  }
  return {ok:identity.status===200&&actors.every(a=>a.httpStatus===200),
    tokenConfigured:true,tokenAuthenticationHttp:identity.status,
    actors,runPermission:'NOT_CHECKED',runStarted:false,
    note:'Read-only preflight; a successful GET does not prove Actor run permission.'};
}

async function handleAnalysisBudget(request, env, url) {
  const endpoint=url.pathname.slice('/api/analysis/'.length);
  if (endpoint==='policy' && request.method==='GET') {
    return json({policy:FC_BUDGET_POLICY, apiProvider:'apify_standby',
      currencyNote:'Referenzpreis in USD, keine garantierte EUR-Umrechnung; vor Echtgeldbetrieb Wechselkurs und Providergebühren prüfen.'});
  }
  if (endpoint==='provider/preflight' && request.method==='GET') {
    return json(await fcApifyReadOnlyPreflight(env));
  }
  if (endpoint==='provider/status' && request.method==='GET') {
    const budgetLedger=env.FC_APIFY_BUDGET_DB
      ? await fcV2BudgetStatus(env.FC_APIFY_BUDGET_DB)
      : {ok:false,reason:'budget_database_not_bound',startableRuns:0,overBudget:null};
    return json({provider:'Apify', actor:FC_APIFY_ACTOR, actorName:FC_APIFY_ACTOR_SLUG,
      configured:typeof env.FC_APIFY_TOKEN==='string'&&env.FC_APIFY_TOKEN.length>24,
      budgetDatabaseBound:!!env.FC_APIFY_BUDGET_DB,
      budgetDatabaseReady:budgetLedger.ok===true,
      budgetLedger,
      executionEnabled:FC_PROVIDER_EXECUTION_ENABLED, mode:'standby',
      acceptedAccounts:'owner-authorized test accounts only',
      analysisAvailable:false,
      note:'Kein Live-Scan, keine Bezahl-Anfrage und kein nicht verifizierter Nicht-Rückfolger.'});
  }
  if (endpoint==='provider/export-check/plan' && request.method==='POST') {
    if(request.headers.get('Origin')!==url.origin) return json({error:'origin_not_allowed'},403);
    if(!(request.headers.get('content-type')||'').toLowerCase().startsWith('application/json'))
      return json({error:'json_required'},415);
    if(Number(request.headers.get('content-length')||0)>1024)return json({error:'body_too_large'},413);
    let params;
    const raw=await request.text();
    if(raw.length>1024)return json({error:'body_too_large'},413);
    try{params=JSON.parse(raw);}catch{return json({error:'invalid_body'},400);}
    const batch=await fcEcDryRunBatch(params?.account,params?.usernames);
    // Read-only look at the ledger. Before the migration this honestly reports "unavailable".
    const ledger=batch.ok?await fcV2BudgetStatus(env.FC_APIFY_BUDGET_DB):null;
    return json({batch,ledger,mode:'DRY_RUN_ONLY',executionEnabled:false,actorRunsStarted:0,
      permissionStatus:'NOT_VERIFIED',pricingStatus:'NOT_VERIFIED',
      note:'Export bleibt die Grundlage. Eine Aktualitätsprüfung wäre nur ein zusätzlicher Hinweis.'},batch.ok?200:403);
  }
  if (endpoint==='provider/v2/plan' && request.method==='POST') {
    if(request.headers.get('Origin')!==url.origin) return json({error:'origin_not_allowed'},403);
    if(!(request.headers.get('content-type')||'').toLowerCase().startsWith('application/json'))
      return json({error:'json_required'},415);
    if(Number(request.headers.get('content-length')||0)>256)return json({error:'body_too_large'},413);
    let params;
    try{const raw=await request.text();if(raw.length>256)throw Error('too_large');params=JSON.parse(raw);}
    catch{return json({error:'invalid_body'},400);}
    const plan=fcV2Plan(params?.username);
    return json({plan,mode:'DRY_RUN_ONLY',executionEnabled:false,actorRunsStarted:0,
      permissionStatus:'NOT_VERIFIED',dataCoverage:'NOT_VERIFIED'},plan.ok?200:403);
  }
  if (endpoint==='provider/plan' && request.method==='POST') {
    if (request.headers.get('Origin')!==url.origin) return json({error:'origin_not_allowed'},403);
    if (!(request.headers.get('content-type')||'').toLowerCase().startsWith('application/json'))
      return json({error:'json_required'},415);
    if(Number(request.headers.get('content-length')||0)>256) return json({error:'body_too_large'},413);
    let input;
    try{
      const raw=await request.text();
      if(raw.length>256)return json({error:'body_too_large'},413);
      input=JSON.parse(raw);
    }catch{return json({error:'invalid_body'},400);}
    const username=fcNormalizeUsername(input?.username);
    if(!username)return json({error:'invalid_username'},400);
    // The username is never sent to Apify; public inputs cannot attest ownership.
    return json({username,provider:'Apify',executionEnabled:false,available:false,
      state:'AWAITING_VERIFIED_COUNTS_AND_PROVIDER_APPROVAL',
      message:'Test-Anbindung vorbereitet. Echte Analyse benötigt erlaubten Zugriff und geprüfte Daten.'});
  }
  if (endpoint==='start' && request.method==='POST') {
    return json({ok:false,error:'paid_provider_not_enabled',
      message:'Eine kostenpflichtige Instagram-Abfrage ist bewusst deaktiviert. ZIP-Analyse bleibt kostenlos.'},503);
  }
  if (endpoint==='quote' && request.method==='POST') {
    // Same-origin check limits cross-site use; no API token or secrets can be extracted here.
    if(request.headers.get('Origin')!==url.origin) return json({error:'origin_not_allowed'},403);
    if(!(request.headers.get('content-type')||'').toLowerCase().startsWith('application/json'))
      return json({error:'json_required'},415);
    if(Number(request.headers.get('content-length')||0)>512) return json({error:'body_too_large'},413);
    let input;
    try {
      const body=await request.text();
      if(body.length>512) return json({error:'body_too_large'},413);
      input=JSON.parse(body);
      if(!input || typeof input!=='object' || Array.isArray(input)) throw new Error('invalid');
    } catch {return json({error:'invalid_body'},400);}
    const quote=estimateFollowCleanBudget(input.followers,input.following);
    return json({estimateOnly:true, trustedCounts:false, quote, executionEnabled:false},200);
  }
  return json({error:'not_found'},404);
}

function configured(env) {
  return typeof env.FC_IG_CLIENT_ID === 'string' && !!env.FC_IG_CLIENT_ID &&
    typeof env.FC_IG_CLIENT_SECRET === 'string' && !!env.FC_IG_CLIENT_SECRET &&
    typeof env.FC_IG_SESSION_SECRET === 'string' && env.FC_IG_SESSION_SECRET.length >= 32;
}
function headers(contentType) {
  return {'Content-Type': contentType, 'Cache-Control': 'private, no-store, max-age=0',
    'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer'};
}
function json(data, code = 200, cookies = []) {
  const h = new Headers(headers('application/json; charset=utf-8'));
  for (const cookie of cookies) h.append('Set-Cookie', cookie);
  return new Response(JSON.stringify(data), {status: code, headers: h});
}
function cookie(request, key) {
  const raw = request.headers.get('Cookie') || '';
  const item = raw.split(';').map(v => v.trim()).find(v => v.startsWith(key + '='));
  return item ? item.slice(key.length + 1) : null;
}
function cookieValue(name, value, age) {
  return name + '=' + value + '; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=' + age;
}
function clearCookie(name) { return cookieValue(name, '', 0); }
function toB64Url(bytes) {
  let string = '';
  for (const x of bytes) string += String.fromCharCode(x);
  return btoa(string).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromB64Url(raw) {
  if (!/^[A-Za-z0-9_-]{1,4000}$/.test(raw)) throw new Error('Bad session cookie');
  const padded = raw.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - raw.length % 4) % 4);
  return Uint8Array.from(atob(padded), c => c.charCodeAt(0));
}
async function keyFor(env) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(env.FC_IG_SESSION_SECRET));
  return crypto.subtle.importKey('raw', hash, 'AES-GCM', false, ['encrypt', 'decrypt']);
}
async function seal(payload, env) {
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({name: 'AES-GCM', iv: nonce}, await keyFor(env),
    new TextEncoder().encode(JSON.stringify(payload)));
  return toB64Url(nonce) + '.' + toB64Url(new Uint8Array(encrypted));
}
async function unseal(token, env) {
  try {
    if (!token || token.length > 3800) return null;
    const [left, right, extra] = token.split('.');
    if (!left || !right || extra) return null;
    const nonce = fromB64Url(left);
    if (nonce.length !== 12) return null;
    const plaintext = await crypto.subtle.decrypt({name: 'AES-GCM', iv: nonce},
      await keyFor(env), fromB64Url(right));
    const payload = JSON.parse(new TextDecoder().decode(plaintext));
    return payload && typeof payload === 'object' && payload.expiresAt > Date.now() && typeof payload.token === 'string'
      ? payload : null;
  } catch { return null; }
}
async function graphProfile(token) {
  const endpoint = new URL('https://graph.instagram.com/' + GRAPH_VERSION + '/me');
  endpoint.searchParams.set('fields', 'id,username,followers_count,follows_count');
  const res = await fetch(endpoint, {headers: {'Authorization': 'Bearer ' + token, 'Accept': 'application/json'},
    signal: AbortSignal.timeout(10000)});
  if (!res.ok) throw new Error('Instagram API response ' + res.status);
  const user = await res.json();
  const followers = user.followers_count;
  const following = user.follows_count;
  if (!/^[a-z0-9._]{1,30}$/.test(String(user.username || '').toLowerCase()) ||
    !Number.isSafeInteger(followers) || followers < 0 ||
    !Number.isSafeInteger(following) || following < 0) throw new Error('Invalid Instagram API profile');
  return {username: user.username.toLowerCase(), followers, following, fetchedAt: new Date().toISOString()};
}
async function exchangeToken(code, callbackUrl, env) {
  const form = new URLSearchParams({
    client_id: env.FC_IG_CLIENT_ID, client_secret: env.FC_IG_CLIENT_SECRET,
    grant_type: 'authorization_code', redirect_uri: callbackUrl, code
  });
  const shortResponse = await fetch('https://api.instagram.com/oauth/access_token', {
    method: 'POST', headers: {'Content-Type': 'application/x-www-form-urlencoded'},
    body: form, signal: AbortSignal.timeout(10000)
  });
  if (!shortResponse.ok) throw new Error('Instagram authorization rejected');
  const short = await shortResponse.json();
  if (typeof short.access_token !== 'string' || !short.access_token) throw new Error('No authorization token');
  const longUrl = new URL('https://graph.instagram.com/access_token');
  longUrl.searchParams.set('grant_type', 'ig_exchange_token');
  longUrl.searchParams.set('client_secret', env.FC_IG_CLIENT_SECRET);
  longUrl.searchParams.set('access_token', short.access_token);
  const longResponse = await fetch(longUrl, {signal: AbortSignal.timeout(10000)});
  if (!longResponse.ok) throw new Error('Instagram token exchange failed');
  const long = await longResponse.json();
  if (typeof long.access_token !== 'string' || !long.access_token || !Number.isFinite(Number(long.expires_in)))
    throw new Error('Invalid Instagram token response');
  return {token: long.access_token, expiresAt: Date.now() + Number(long.expires_in) * 1000 - 60000};
}
function finishPage(success, cookies = []) {
  const title = success ? 'Instagram verbunden' : 'Instagram-Verbindung nicht abgeschlossen';
  const info = success ? 'Du kannst zu deinem FollowClean-Tab zurückkehren. Deine ZIP-Daten bleiben dort.' :
    'Die Verbindung wurde nicht eingerichtet. FollowClean funktioniert weiterhin mit deinem lokalen ZIP-Export.';
  const code = success ? 'connected' : 'error';
  const body = '<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'+
    '<meta name="robots" content="noindex,nofollow"><title>' + title + ' · FollowClean</title>'+
    '<style>body{font:16px system-ui;background:#f6f8ff;color:#243452;display:grid;place-items:center;min-height:90vh;padding:20px}main{max-width:460px;background:white;padding:32px;border-radius:22px;box-shadow:0 15px 50px #304e7122}a{color:#205fae;font-weight:700}</style></head>'+
    '<body><main><h1>' + title + '</h1><p>' + info + '</p><p><a href="/">Zurück zu FollowClean</a></p></main>'+
    '<script>try{if(window.opener)window.opener.postMessage({type:"followclean:instagram:' + code + '"},location.origin)}catch(e){}</script></body></html>';
  const h = new Headers(headers('text/html; charset=utf-8'));
  for (const v of cookies) h.append('Set-Cookie', v);
  return new Response(body, {headers: h});
}
function redirect(location, cookies = []) {
  const h = new Headers(headers('text/plain; charset=utf-8'));
  h.set('Location', location);
  for (const v of cookies) h.append('Set-Cookie', v);
  return new Response('', {status: 302, headers: h});
}
async function handleApi(request, env, url) {
  const endpoint = url.pathname.slice(API_PREFIX.length);
  if (endpoint === 'status' && request.method === 'GET') {
    return json({available: configured(env), provider: 'instagram', accountTypes: ['BUSINESS', 'CREATOR']});
  }
  if (!configured(env)) return json({available: false, connected: false,
    error: 'meta_setup_required'}, 503);
  if (endpoint === 'connect' && request.method === 'GET') {
    const nonce = toB64Url(crypto.getRandomValues(new Uint8Array(24)));
    const callbackUrl = url.origin + API_PREFIX + 'callback';
    const authorizeUrl = new URL('https://www.instagram.com/oauth/authorize');
    authorizeUrl.searchParams.set('client_id', env.FC_IG_CLIENT_ID);
    authorizeUrl.searchParams.set('redirect_uri', callbackUrl);
    authorizeUrl.searchParams.set('response_type', 'code');
    authorizeUrl.searchParams.set('scope', 'instagram_business_basic');
    authorizeUrl.searchParams.set('enable_fb_login', '0');
    authorizeUrl.searchParams.set('state', nonce);
    return redirect(authorizeUrl.toString(), [cookieValue(COOKIE_OAUTH, nonce, 600)]);
  }
  if (endpoint === 'callback' && request.method === 'GET') {
    const supplied = url.searchParams.get('state') || '';
    const expected = cookie(request, COOKIE_OAUTH);
    const removeState = clearCookie(COOKIE_OAUTH);
    const code = url.searchParams.get('code') || '';
    if (url.searchParams.has('error') || !code || code.length > 2048 || !expected || supplied !== expected)
      return finishPage(false, [removeState]);
    try {
      const tokenData = await exchangeToken(code.replace(/#_$/, ''), url.origin + API_PREFIX + 'callback', env);
      const sample = await graphProfile(tokenData.token);
      const session = {token: tokenData.token, expiresAt: tokenData.expiresAt, account: sample.username,
        sample, sampleAt: Date.now()};
      const sealed = await seal(session, env);
      return finishPage(true, [removeState, cookieValue(COOKIE_SESSION, sealed, MAX_COOKIE_AGE)]);
    } catch {
      return finishPage(false, [removeState]);
    }
  }
  if (endpoint === 'summary' && request.method === 'GET') {
    const session = await unseal(cookie(request, COOKIE_SESSION), env);
    if (!session) return json({available: true, connected: false});
    if (session.sample && Date.now() - session.sampleAt < MIN_GRAPH_REFRESH_MS)
      return json({available: true, connected: true, ...session.sample});
    try {
      const sample = await graphProfile(session.token);
      if (sample.username !== session.account) return json({available: true, connected: false,
        error: 'account_changed'}, 409, [clearCookie(COOKIE_SESSION)]);
      const sealed = await seal({...session, sample, sampleAt: Date.now()}, env);
      return json({available: true, connected: true, ...sample}, 200,
        [cookieValue(COOKIE_SESSION, sealed, Math.min(MAX_COOKIE_AGE,
          Math.max(0, Math.floor((session.expiresAt - Date.now()) / 1000))))]);
    } catch {
      return json({available: true, connected: true, error: 'instagram_temporarily_unavailable'}, 502);
    }
  }
  if (endpoint === 'disconnect' && request.method === 'POST') {
    const origin = request.headers.get('Origin');
    const sameSite = request.headers.get('Sec-Fetch-Site');
    if (origin !== url.origin || (sameSite && sameSite !== 'same-origin'))
      return json({error: 'origin_not_allowed'}, 403);
    return json({available: true, connected: false}, 200, [clearCookie(COOKIE_SESSION)]);
  }
  return json({error: 'not_found'}, 404);
}


/* FC_PREMIUM_V1_START */
// Premium unlock (Stripe TEST mode only) + free username scan gate.
// Webhook: Stripe-Signature HMAC-SHA256 over "t.body" with FC_STRIPE_WEBHOOK_SECRET (whsec_...),
// 300 s tolerance, constant-time compare. Live-mode events are rejected. Orders are idempotent
// (session id PK, event id UNIQUE, INSERT OR IGNORE). Premium tokens are HMAC-signed with
// FC_IG_SESSION_SECRET (domain-separated) and re-checked against the order table on verify.
const FC_PREMIUM_PATH = '/api/premium/';
const FC_SCAN_PATH = '/api/scan/free';
const FC_STRIPE_TOLERANCE_S = 300;
const FC_PREMIUM_TOKEN_S = 365 * 86400;
const FC_RATE = {scanIp: 10, scanName: 5, statusIp: 120};
const fcEnc = new TextEncoder();
function fcHex(buf) { return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join(''); }
async function fcHmacHex(key, msg) {
  const k = await crypto.subtle.importKey('raw', fcEnc.encode(key), {name: 'HMAC', hash: 'SHA-256'}, false, ['sign']);
  return fcHex(await crypto.subtle.sign('HMAC', k, fcEnc.encode(msg)));
}
function fcSafeEq(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
function fcValidRef(v) { return typeof v === 'string' && /^fc_[a-f0-9]{32}$/.test(v); }
async function fcStripeVerify(header, body, secret, nowS) {
  if (typeof secret !== 'string' || !/^whsec_[A-Za-z0-9]{16,}$/.test(secret)) return {ok: false, reason: 'not_configured'};
  if (typeof header !== 'string' || !header || header.length > 4096) return {ok: false, reason: 'missing_signature'};
  let t = null; const v1 = [];
  for (const part of header.split(',')) {
    const i = part.indexOf('='); if (i < 1) continue;
    const k = part.slice(0, i).trim(), v = part.slice(i + 1).trim();
    if (k === 't' && /^\d{1,12}$/.test(v)) t = Number(v);
    else if (k === 'v1' && /^[a-f0-9]{64}$/.test(v)) v1.push(v);
  }
  if (t === null || !v1.length) return {ok: false, reason: 'malformed_signature'};
  if (Math.abs(nowS - t) > FC_STRIPE_TOLERANCE_S) return {ok: false, reason: 'timestamp_out_of_tolerance'};
  const expected = await fcHmacHex(secret, t + '.' + body);
  return v1.some(s => fcSafeEq(s, expected)) ? {ok: true} : {ok: false, reason: 'bad_signature'};
}
function fcStripeOrder(ev, env) {
  if (!ev || typeof ev !== 'object' || typeof ev.id !== 'string' || !/^evt_[A-Za-z0-9_]{1,250}$/.test(ev.id))
    return {ok: false, reason: 'invalid_event'};
  if (ev.livemode !== false) return {ok: false, reason: 'live_mode_rejected'};
  if (ev.type !== 'checkout.session.completed' && ev.type !== 'checkout.session.async_payment_succeeded')
    return {ok: true, ignored: 'event_type'};
  const s = ev.data && ev.data.object;
  if (!s || s.object !== 'checkout.session' || typeof s.id !== 'string' || !/^cs_test_[A-Za-z0-9_]{1,240}$/.test(s.id) || s.livemode !== false)
    return {ok: false, reason: 'invalid_session'};
  if (s.payment_status !== 'paid' && s.payment_status !== 'no_payment_required') return {ok: true, ignored: 'not_paid'};
  // Product binding is mandatory: only the configured FollowClean TEST payment link, one-time EUR payment, max 1.00 EUR.
  if (!fcStripeLinkId(env) || s.payment_link !== env.FC_STRIPE_PAYMENT_LINK_ID) return {ok: true, ignored: 'foreign_payment_link'};
  if (s.mode !== 'payment') return {ok: true, ignored: 'unexpected_mode'};
  if (s.currency !== 'eur' || !Number.isSafeInteger(s.amount_total) || s.amount_total < 0 || s.amount_total > 100)
    return {ok: true, ignored: 'unexpected_amount'};
  if (!fcValidRef(s.client_reference_id)) return {ok: true, ignored: 'no_claim_reference'};
  return {ok: true, order: {eventId: ev.id, sessionId: s.id, ref: s.client_reference_id,
    amount: Number.isSafeInteger(s.amount_total) && s.amount_total >= 0 ? s.amount_total : null,
    currency: typeof s.currency === 'string' ? s.currency.slice(0, 8) : null}};
}
function fcStripeLinkId(env) {
  return typeof env.FC_STRIPE_PAYMENT_LINK_ID === 'string' && /^plink_[A-Za-z0-9]{8,64}$/.test(env.FC_STRIPE_PAYMENT_LINK_ID) ? env.FC_STRIPE_PAYMENT_LINK_ID : null;
}
function fcUnlockConfigured(env) {
  return !!env.FC_APIFY_BUDGET_DB && !!fcPremiumKey(env) && !!fcStripeLinkId(env) &&
    typeof env.FC_STRIPE_WEBHOOK_SECRET === 'string' && /^whsec_[A-Za-z0-9]{16,}$/.test(env.FC_STRIPE_WEBHOOK_SECRET);
}
function fcPremiumKey(env) {
  return typeof env.FC_IG_SESSION_SECRET === 'string' && env.FC_IG_SESSION_SECRET.length >= 32 ? env.FC_IG_SESSION_SECRET : null;
}
async function fcPremiumToken(ref, env, nowS) {
  const key = fcPremiumKey(env); if (!key) return null;
  const exp = nowS + FC_PREMIUM_TOKEN_S;
  return 'fcp1.' + ref + '.' + exp + '.' + await fcHmacHex(key, 'fc-premium-v1|' + ref + '|' + exp);
}
async function fcPremiumParse(token, env, nowS) {
  const key = fcPremiumKey(env);
  if (!key || typeof token !== 'string' || token.length > 200) return null;
  const m = /^fcp1\.(fc_[a-f0-9]{32})\.(\d{10})\.([a-f0-9]{64})$/.exec(token); if (!m) return null;
  const exp = Number(m[2]); if (exp <= nowS) return null;
  return fcSafeEq(m[3], await fcHmacHex(key, 'fc-premium-v1|' + m[1] + '|' + exp)) ? m[1] : null;
}
async function fcOrderForRef(db, ref) {
  return db.prepare('SELECT session_id FROM fc_premium_orders_v1 WHERE claim_ref = ? LIMIT 1').bind(ref).first();
}
async function fcRateHit(db, bucket, limit, nowS) {
  const win = nowS - (nowS % 3600);
  await db.prepare('INSERT INTO fc_rate_limit_v1(bucket, window_start, hits) VALUES(?, ?, 1) ' +
    'ON CONFLICT(bucket, window_start) DO UPDATE SET hits = hits + 1').bind(bucket, win).run();
  const row = await db.prepare('SELECT hits FROM fc_rate_limit_v1 WHERE bucket = ? AND window_start = ?').bind(bucket, win).first();
  if (Math.random() < 0.02) await db.prepare('DELETE FROM fc_rate_limit_v1 WHERE window_start < ?').bind(win - 7200).run();
  return !!row && row.hits <= limit;
}
async function fcIpBucket(request, env, kind) {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  return kind + ':' + (await fcHmacHex(fcPremiumKey(env) || 'fc-no-secret', 'fc-ip-v1|' + ip)).slice(0, 24);
}
function fcSameOrigin(request, url) {
  const origin = request.headers.get('Origin'), site = request.headers.get('Sec-Fetch-Site');
  return origin === url.origin && (!site || site === 'same-origin');
}
async function fcReadSmallBody(request, max) {
  const text = await request.text();
  return text.length > max ? null : text;
}
// Free username scan. Real provider execution stays OFF: a result is only ever reported
// when a verified provider adapter exists. Until then the honest answer is NO_RELIABLE_LIVE_RESULT.
async function fcFreeScan(request, env, url) {
  if (request.method !== 'POST') return json({error: 'method_not_allowed'}, 405);
  if (!fcSameOrigin(request, url)) return json({error: 'origin_not_allowed'}, 403);
  const text = await fcReadSmallBody(request, 512);
  if (text === null) return json({error: 'body_too_large'}, 413);
  let body; try { body = JSON.parse(text); } catch { return json({error: 'invalid_json'}, 400); }
  const username = fcNormalizeUsername(body && body.username);
  if (!username) return json({error: 'invalid_username'}, 400);
  const nowS = Math.floor(Date.now() / 1000), db = env.FC_APIFY_BUDGET_DB;
  let rateLimit = 'unavailable';
  if (db) {
    try {
      const okIp = await fcRateHit(db, await fcIpBucket(request, env, 'scan'), FC_RATE.scanIp, nowS);
      const okName = await fcRateHit(db, 'scanname:' + username, FC_RATE.scanName, nowS);
      if (!okIp || !okName) return json({error: 'rate_limited', retryAfterS: 3600 - (nowS % 3600)}, 429);
      rateLimit = 'ok';
    } catch { rateLimit = 'unavailable'; }
  }
  // Paid execution requires: verified provider, D1 rate limit, budget ledger. None is proven yet.
  const reason = !FC_PROVIDER_EXECUTION_ENABLED ? 'provider_not_verified'
    : rateLimit !== 'ok' ? 'rate_limit_unavailable' : 'provider_adapter_not_implemented';
  return json({username, status: 'NO_RELIABLE_LIVE_RESULT', reason, live: false,
    checked: 0, batches: 0, hit: null, checkedAt: new Date(nowS * 1000).toISOString(),
    costUsd: 0, rateLimit, executionEnabled: FC_PROVIDER_EXECUTION_ENABLED});
}
async function fcHandlePremium(request, env, url) {
  const endpoint = url.pathname.slice(FC_PREMIUM_PATH.length);
  const nowS = Math.floor(Date.now() / 1000), db = env.FC_APIFY_BUDGET_DB;
  if (endpoint === 'config' && request.method === 'GET') {
    const unlockConfigured = fcUnlockConfigured(env);
    // The paywall may only replace the free ZIP access once a verified free live hit exists.
    const premiumGate = FC_PROVIDER_EXECUTION_ENABLED && unlockConfigured && env.FC_PREMIUM_GATE === 'on';
    return json({checkout: 'https://buy.stripe.com/test_28E3cu73K8VO9SIdGD8EM00', testMode: true,
      unlockConfigured, liveScan: FC_PROVIDER_EXECUTION_ENABLED, premiumGate});
  }
  if (endpoint === 'webhook' && request.method === 'POST') {
    const text = await fcReadSmallBody(request, 65536);
    if (text === null) return json({error: 'body_too_large'}, 413);
    const sig = await fcStripeVerify(request.headers.get('Stripe-Signature'), text, env.FC_STRIPE_WEBHOOK_SECRET, nowS);
    if (!sig.ok) return json({error: sig.reason}, sig.reason === 'not_configured' ? 503 : 400);
    if (!fcStripeLinkId(env)) return json({error: 'not_configured'}, 503);
    let ev; try { ev = JSON.parse(text); } catch { return json({error: 'invalid_json'}, 400); }
    const parsed = fcStripeOrder(ev, env);
    if (!parsed.ok) return json({error: parsed.reason}, 400);
    if (parsed.ignored) return json({received: true, ignored: parsed.ignored});
    if (!db) return json({error: 'premium_store_unavailable'}, 503);
    try {
      const o = parsed.order;
      const r = await db.prepare('INSERT OR IGNORE INTO fc_premium_orders_v1(session_id, event_id, claim_ref, amount_total, currency, livemode, created_ts) VALUES(?, ?, ?, ?, ?, 0, ?)')
        .bind(o.sessionId, o.eventId, o.ref, o.amount, o.currency, nowS).run();
      return json({received: true, recorded: !!(r && r.meta && r.meta.changes)});
    } catch { return json({error: 'premium_store_unavailable'}, 503); }
  }
  if (endpoint === 'status' && request.method === 'GET') {
    const ref = url.searchParams.get('ref');
    if (!fcValidRef(ref)) return json({error: 'invalid_ref'}, 400);
    if (!fcUnlockConfigured(env)) return json({premium: false, error: 'premium_unlock_not_configured'}, 503);
    try {
      if (!await fcRateHit(db, await fcIpBucket(request, env, 'status'), FC_RATE.statusIp, nowS)) return json({error: 'rate_limited'}, 429);
      if (!await fcOrderForRef(db, ref)) return json({premium: false, pending: true});
      return json({premium: true, token: await fcPremiumToken(ref, env, nowS)});
    } catch { return json({premium: false, error: 'premium_store_unavailable'}, 503); }
  }
  if (endpoint === 'verify' && request.method === 'POST') {
    if (!fcSameOrigin(request, url)) return json({error: 'origin_not_allowed'}, 403);
    const text = await fcReadSmallBody(request, 512);
    if (text === null) return json({error: 'body_too_large'}, 413);
    let body; try { body = JSON.parse(text); } catch { return json({error: 'invalid_json'}, 400); }
    const ref = await fcPremiumParse(body && body.token, env, nowS);
    if (!ref) return json({premium: false, error: 'invalid_token'}, 401);
    if (!db) return json({premium: false, error: 'premium_store_unavailable'}, 503);
    try { return (await fcOrderForRef(db, ref)) ? json({premium: true}) : json({premium: false, error: 'order_not_found'}, 401); }
    catch { return json({premium: false, error: 'premium_store_unavailable'}, 503); }
  }
  return json({error: 'not_found'}, 404);
}
/* FC_PREMIUM_V1_END */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === FC_SCAN_PATH) return fcFreeScan(request, env, url);
    if (url.pathname.startsWith(FC_PREMIUM_PATH)) return fcHandlePremium(request, env, url);
    if (url.pathname.startsWith('/api/analysis/')) return handleAnalysisBudget(request, env, url);
    if (url.pathname.startsWith(API_PREFIX)) return handleApi(request, env, url);
    if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Method not allowed', {status:405});
    if (url.pathname === '/robots.txt') return new Response('User-agent: *\nDisallow: /\n', {headers: headers('text/plain; charset=utf-8')});
    if (url.pathname !== '/' && url.pathname !== '/index.html') return new Response('Not found', {status:404});
    return new Response(request.method === 'HEAD' ? null : FOLLOWCLEAN_HTML,
      {headers: {...headers('text/html; charset=utf-8'), 'X-FollowClean-Release': 'followclean-v19-premium-conversion-candidate'}});
  }
};