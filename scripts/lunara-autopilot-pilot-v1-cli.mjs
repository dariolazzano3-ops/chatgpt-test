#!/usr/bin/env node
/**
 * Run from an authorized, isolated JARVIS checkout.
 * PLAN and STATUS do not contact providers, spend, schedule, or publish.
 */
import {existsSync} from 'node:fs';
import {makeDailyPlan,checkReadiness} from '../src/marketing-factory/lunara-autopilot-pilot-v1.mjs';
const cmd=process.argv[2]||'status';
const date=process.argv[3]||new Date().toISOString().slice(0,10);
if(cmd==='plan'){
 const index=Number(process.argv[4]||'0');
 console.log(JSON.stringify(makeDailyPlan(date,index),null,2));
}else if(cmd==='status'){
 const requiredPath=(name)=>Boolean(process.env[name] && existsSync(process.env[name]));
 const result=checkReadiness({
   runwayApiKeyPresent:Boolean(process.env.RUNWAYML_API_SECRET),
   runwayBalanceApproved:process.env.LUNARA_RUNWAY_FUNDED==='yes',
   bufferApiKeyPresent:Boolean(process.env.BUFFER_API_TOKEN),
   shopUrlVerified:process.env.LUNARA_SHOP_VERIFIED==='yes',
   originalLogoConfirmed:requiredPath('LUNARA_ORIGINAL_LOGO_PATH'),
   realProductPreviewConfirmed:requiredPath('LUNARA_PDF_PREVIEW_PATH'),
   mediaUsageRightsConfirmed:process.env.LUNARA_MEDIA_RIGHTS_CONFIRMED==='yes',
   germanVoiceConfirmed:requiredPath('LUNARA_GERMAN_VOICE_FILE'),
   bufferVideoWriteTestPassed:process.env.LUNARA_BUFFER_VIDEO_WRITE_TESTED==='yes',
   providerWriteAllowed:process.env.LUNARA_BUFFER_WRITE_APPROVED==='yes'
 });
 console.log(JSON.stringify({plan:makeDailyPlan(date),...result},null,2));
 if(result.stage!=='PILOT_READY')process.exitCode=2;
}else{
 console.error('Allowed offline commands: status [YYYY-MM-DD], plan [YYYY-MM-DD] [dayIndex]');
 process.exitCode=2;
}
