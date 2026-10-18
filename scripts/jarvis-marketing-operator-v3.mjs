#!/usr/bin/env node
/**
 * JARVIS/Bridge task entrypoint for Universal Marketing Factory V3.
 *
 * Designed for the existing JARVIS program's bounded workspace execution.
 * This is NOT automatically installed in the JARVIS remote operator service.
 * No network, platform publishing, ads, production or secret handling.
 */
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { runJarvisMarketingTaskV3,jarvisMarketingCapabilityV3 } from '../src/marketing-factory/jarvis-marketing-task-v3.mjs';

const repoRoot=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const workspace=resolve(process.env.MARKETING_FACTORY_PRIVATE_ROOT||'/home/jarvis/marketing-factory-v2/job-state');
const python=resolve(process.env.MARKETING_FACTORY_PYTHON||'/home/jarvis/marketing-factory-v2/.venv/bin/python');
const ffmpeg=resolve(process.env.MARKETING_FACTORY_FFMPEG||'/home/jarvis/marketing-factory-v2/.venv/bin/ffmpeg');
const renderer=join(repoRoot,'scripts','marketing-video-compositor-v2.py');
const artworkRoot=resolve(workspace,'approved-artwork');
function args(){
 const [task,brandId,day,artworkPath]=process.argv.slice(2);
 if(task==='capabilities')return {task};
 if(!['status','plan_day','plan_week','render_private'].includes(task))throw Error('TASK_NOT_ALLOWED');
 if(!brandId||!day)throw Error('BRAND_AND_DAY_REQUIRED');
 return {task,brandId,day,...(task==='render_private'?{artworkPath,ownerConfirmedArtwork:process.env.MARKETING_FACTORY_ARTWORK_RIGHTS_CONFIRMED==='yes'}:{})};
}
try {
 const req=args();
 const result=req.task==='capabilities'
   ? jarvisMarketingCapabilityV3()
   : await runJarvisMarketingTaskV3(req,{repoRoot,privateWorkspace:workspace,
      artworkRoot,pythonBin:python,ffmpegBin:ffmpeg,rendererScript:renderer});
 process.stdout.write(JSON.stringify(result,null,2)+'\n');
 process.exitCode=result.ok===false?3:0;
} catch(error){
 process.stderr.write('MARKETING_OPERATOR_FAILED: '+String(error?.message||error).slice(0,300)+'\n');
 process.exitCode=1;
}
