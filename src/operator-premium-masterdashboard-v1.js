export { normalizePremiumProjectLifecycle, derivePremiumProjectProgress, derivePremiumNextBestAction, buildPremiumProjectViewModel } from './operator-premium-masterdashboard-viewmodel-v1.js';
import { PREMIUM_MASTERDASHBOARD_STYLE } from './operator-premium-masterdashboard-ui-style-v1.js';
import { PREMIUM_MASTERDASHBOARD_SCRIPT_1 } from './operator-premium-masterdashboard-ui-script-1-v1.js';
import { PREMIUM_MASTERDASHBOARD_SCRIPT_2 } from './operator-premium-masterdashboard-ui-script-2-v1.js';
import { PREMIUM_MASTERDASHBOARD_SCRIPT_3 } from './operator-premium-masterdashboard-ui-script-3-v1.js';

const ADDON = PREMIUM_MASTERDASHBOARD_STYLE + PREMIUM_MASTERDASHBOARD_SCRIPT_1 + PREMIUM_MASTERDASHBOARD_SCRIPT_2 + PREMIUM_MASTERDASHBOARD_SCRIPT_3;

export function injectPremiumMasterdashboard(html=''){if(!html||html.includes('aurentara-premium-masterdashboard-v1-script'))return html;return html.includes('</body>')?html.replace('</body>',ADDON+'</body>'):html+ADDON}
export async function applyPremiumMasterdashboard(response){if(!(response instanceof Response)||response.status!==200||!(response.headers.get('content-type')||'').includes('text/html'))return response;const html=await response.text(),h=new Headers(response.headers);h.delete('content-length');h.set('x-aurentara-premium-masterdashboard','v1');return new Response(injectPremiumMasterdashboard(html),{status:response.status,statusText:response.statusText,headers:h})}
export function premiumMasterdashboardManifest(){return{schema:'aurentara.project-ferrari-premium-masterdashboard.v1',existing_operator_route_reused:true,existing_project_runtime_reused:true,existing_source_registry_reused:true,existing_project_knowledge_reused:true,existing_preview_engine_reused:true,existing_approval_engine_reused:true,existing_audit_events_reused:true,lifecycle_view_model:['PHASE','HEALTH','ENVIRONMENT'],project_navigation:['OVERVIEW','SOURCES','KNOWLEDGE','IMPLEMENTATION','PREVIEW','APPROVALS','ACTIVITY'],deterministic_next_best_action:true,fake_progress_forbidden:true,source_gallery_grid:true,source_batch_image_purpose:true,responsive_mobile:true,production_deploy:false,external_writes:false,duplicate_runtime_truth:false}}
