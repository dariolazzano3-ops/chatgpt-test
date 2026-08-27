import { analyzeProject, resolveSemanticSelector } from "./project-analyzer.js";

function clean(value, max = 4000) { return String(value || "").trim().slice(0, max); }
function safeNumber(value, fallback = 1) { const n = Number(value); return Number.isFinite(n) ? n : fallback; }
function escapeHtml(value = "") { return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
function overrideBlock(selector, declarations = {}) { const body = Object.entries(declarations).filter(([,v]) => v !== null && v !== undefined && v !== "").map(([k,v]) => `  ${k}: ${v};`).join("\n"); return body ? `${selector} {\n${body}\n}` : ""; }
function mediaBlock(query, blocks = []) { const body = blocks.filter(Boolean).map((b) => b.split("\n").map((l) => `  ${l}`).join("\n")).join("\n\n"); return body ? `@media(${query}) {\n${body}\n}` : ""; }
const MANAGED_START = "/* Project Factory V3 Overrides: START */";
const MANAGED_END = "/* Project Factory V3 Overrides: END */";
const LEGACY_MARKER = "/* Project Factory V3 Natural Edit Overrides */";
function extractFactoryOverrideBody(css = "") { const m = String(css||"").match(/\/\* Project Factory V3 Overrides: START \*\/([\s\S]*?)\/\* Project Factory V3 Overrides: END \*\//); return m?.[1]?.trim() || ""; }
function stripFactoryOverrides(css = "") { let next=String(css||""); next=next.replace(/\/\* Project Factory V3 Overrides: START \*\/[\s\S]*?\/\* Project Factory V3 Overrides: END \*\//g,""); const i=next.indexOf(LEGACY_MARKER); if(i!==-1) next=next.slice(0,i); return next.trimEnd(); }
function buildManagedOverrideBlock(blocks=[]) { const body=blocks.filter(Boolean).join("\n\n").trim(); return body ? `${MANAGED_START}\n${body}\n${MANAGED_END}` : ""; }
function replaceFirstText(fragment, kind, value) {
  const escaped = escapeHtml(value);
  if (kind === "headline") return /<h1\b[^>]*>[\s\S]*?<\/h1>/i.test(fragment) ? fragment.replace(/(<h1\b[^>]*>)[\s\S]*?(<\/h1>)/i, `$1${escaped}$2`) : fragment;
  if (kind === "subheadline") {
    const lead=/(<(?:p|span)\b[^>]*class=["'][^"']*(?:hero-text|hero-lead|lead|subtitle|subheadline)[^"']*["'][^>]*>)[\s\S]*?(<\/(?:p|span)>)/i;
    if (lead.test(fragment)) return fragment.replace(lead, `$1${escaped}$2`);
    return /(<h1\b[^>]*>[\s\S]*?<\/h1>[\s\S]*?<p\b[^>]*>)[\s\S]*?(<\/p>)/i.test(fragment) ? fragment.replace(/(<h1\b[^>]*>[\s\S]*?<\/h1>[\s\S]*?<p\b[^>]*>)[\s\S]*?(<\/p>)/i, `$1${escaped}$2`) : fragment;
  }
  const cta=/(<a\b[^>]*class=["'][^"']*(?:cta|btn-primary|button-primary|hero-cta|primary)[^"']*["'][^>]*>)[\s\S]*?(<\/a>)/i;
  if (cta.test(fragment)) return fragment.replace(cta, `$1${escaped}$2`);
  return /(<button\b[^>]*>)[\s\S]*?(<\/button>)/i.test(fragment) ? fragment.replace(/(<button\b[^>]*>)[\s\S]*?(<\/button>)/i, `$1${escaped}$2`) : fragment;
}
function scopedSectionRegex(scope) {
  if (!scope) return null;
  if (scope.kind === "ordinal-section") return { ordinal: scope.index };
  const patterns={hero:"hero",services:"(?:services|service|factory-services)",references:"(?:references|projects|cases|factory-references)",faq:"(?:faq|factory-faq)",contact:"(?:contact)"};
  return patterns[scope.name] ? new RegExp(`<section\\b[^>]*(?:id|class)=["'][^"']*${patterns[scope.name]}[^"']*["'][^>]*>[\\s\\S]*?<\\/section>`,"i") : null;
}
function mutateScopedHtml(html, scope, kind, value) {
  if (!scope) return replaceFirstText(html, kind, value);
  if (scope.kind === "ordinal-section") {
    let count=0;
    return html.replace(/<section\b[^>]*>[\s\S]*?<\/section>/gi,(section)=>{ count++; if(count!==scope.index) return section; return replaceFirstText(section,kind,value); });
  }
  const regex=scopedSectionRegex(scope); if(!regex || regex.ordinal) return html;
  const match=html.match(regex); if(!match) return html;
  const next=replaceFirstText(match[0],kind,value); return next===match[0] ? html : html.replace(match[0],next);
}
function ensureMobileQuickNav(html = "") {
  if (/data-factory-mobile-quick-nav=["']true["']/i.test(html)) return html;
  const markup = `\n<nav class="factory-mobile-quick-nav" data-factory-mobile-quick-nav="true" aria-label="Mobile Schnellzugriffe">\n  <button type="button" data-factory-target="#request-form" aria-label="Chat mit RIO"><span aria-hidden="true">✦</span><small>RIO</small></button>\n  <button type="button" data-factory-target=".status-panel" aria-label="Aktueller Status"><span aria-hidden="true">◎</span><small>Status</small></button>\n  <button type="button" data-factory-target=".preview-panel" aria-label="Preview"><span aria-hidden="true">↗</span><small>Preview</small></button>\n  <button type="button" data-factory-target="#step-workshop" aria-label="Werkstatt"><span aria-hidden="true">◇</span><small>Werkstatt</small></button>\n</nav>\n<script data-factory-mobile-quick-nav-script="true">\n(()=>{const nav=document.querySelector('[data-factory-mobile-quick-nav="true"]');if(!nav)return;let toast=null;const showToast=()=>{if(!toast){toast=document.createElement('div');toast.className='factory-mobile-quick-nav-toast';toast.setAttribute('role','status');document.body.appendChild(toast)}toast.textContent='Bereich momentan nicht verfügbar';toast.classList.add('show');setTimeout(()=>toast?.classList.remove('show'),1800)};nav.addEventListener('click',e=>{const button=e.target.closest('button[data-factory-target]');if(!button)return;const target=document.querySelector(button.dataset.factoryTarget);if(!target){showToast();return}target.scrollIntoView({behavior:'smooth',block:'start'});});})();\n</script>\n`;
  return /<\/body>/i.test(html) ? html.replace(/<\/body>/i, `${markup}</body>`) : `${html}${markup}`;
}

export function executeNaturalEditPlan({ css="", html="", plan }) {
  if (!plan || plan.mode!=="natural-edit-plan") return { error:"INVALID_NATURAL_EDIT_PLAN" };
  if (plan?.safety?.production_deploy!==false) return { error:"PRODUCTION_MUST_REMAIN_DISABLED" };
  if (plan?.safety?.active_project_only!==true) return { error:"ACTIVE_PROJECT_ONLY_REQUIRED" };
  const priorManagedBody=extractFactoryOverrideBody(css), cleanCss=stripFactoryOverrides(css), analysis=analyzeProject({html,css:cleanCss}), cssOverrides=[], applied=[];
  let nextHtml=String(html||"");
  for (const op of Array.isArray(plan.operations)?plan.operations:[]) {
    const semantic=clean(op.semantic,80), fallbackTarget=clean(op.target,240), target=semantic && !["theme","headline","subheadline","resolved_reference","mobile_quick_nav"].includes(semantic) ? (op.scope ? fallbackTarget : resolveSemanticSelector(analysis,semantic,fallbackTarget)) : fallbackTarget, action=clean(op.action,120);
    if (!target) continue;
    if (semantic==="mobile_quick_nav" && action==="ensure_mobile_quick_nav") {
      const changed=ensureMobileQuickNav(nextHtml); if(changed===nextHtml) continue; nextHtml=changed;
      cssOverrides.push(mediaBlock("max-width:768px",[
        overrideBlock("body",{"padding-bottom":"76px"}),
        overrideBlock(".factory-mobile-quick-nav",{position:"fixed",left:"10px",right:"10px",bottom:"10px",height:"60px",display:"grid","grid-template-columns":"repeat(4,minmax(0,1fr))",gap:"6px",padding:"6px","z-index":"9999","border-radius":"16px",border:"1px solid rgba(112,255,214,.38)",background:"rgba(7,18,25,.92)","backdrop-filter":"blur(16px)","box-shadow":"0 -8px 30px rgba(0,0,0,.28)"}),
        overrideBlock(".factory-mobile-quick-nav button",{border:"0",background:"transparent",color:"inherit","min-width":"44px","min-height":"44px",display:"flex","flex-direction":"column","align-items":"center","justify-content":"center",gap:"2px","border-radius":"10px",cursor:"pointer"}),
        overrideBlock(".factory-mobile-quick-nav button:focus-visible",{outline:"2px solid currentColor","outline-offset":"2px"}),
        overrideBlock(".factory-mobile-quick-nav small",{"font-size":"10px","font-weight":"700"}),
        overrideBlock(".factory-mobile-quick-nav-toast",{position:"fixed",left:"50%",bottom:"84px",transform:"translateX(-50%) translateY(8px)",opacity:"0",padding:"8px 12px","border-radius":"999px",background:"rgba(7,18,25,.96)",border:"1px solid rgba(112,255,214,.38)","z-index":"10000",transition:"opacity .18s ease, transform .18s ease","pointer-events":"none"}),
        overrideBlock(".factory-mobile-quick-nav-toast.show",{opacity:"1",transform:"translateX(-50%) translateY(0)"})
      ]));
      cssOverrides.push(mediaBlock("min-width:769px",[overrideBlock(".factory-mobile-quick-nav,.factory-mobile-quick-nav-toast",{display:"none !important"})]));
      applied.push({target:"body",action,semantic,value:op.value||null});
    } else if (["headline","subheadline","cta"].includes(semantic) && action==="replace_text") {
      const value=clean(op.value, semantic==="subheadline"?260:semantic==="headline"?180:100); const changed=mutateScopedHtml(nextHtml,op.scope,semantic,value); if(changed===nextHtml) continue; nextHtml=changed; applied.push({target,action,value,semantic,scope:op.scope||null});
    } else if (semantic==="rocket" && action==="scale") { const scale=Math.max(.5,Math.min(2.5,safeNumber(op.value,1))); cssOverrides.push(overrideBlock(target,{scale})); applied.push({target,action,value:scale,semantic});
    } else if (semantic==="smoke" && action==="density") { const density=Math.max(.2,Math.min(2.5,safeNumber(op.value,1))); cssOverrides.push(overrideBlock(target,{opacity:Math.min(1,.48*density).toFixed(2),scale:Math.min(2.4,.9+density*.35).toFixed(2)})); applied.push({target,action,value:density,semantic});
    } else if (semantic==="hero_copy" && action==="text_align") { const align=op.value==="center"?"center":"left"; cssOverrides.push(overrideBlock(target,{"text-align":align,"align-items":align==="center"?"center":"flex-start"})); applied.push({target,action,value:align,semantic});
    } else if (semantic==="cards" && action==="border_radius") { const value=clean(op.value,32); cssOverrides.push(overrideBlock(target,{"border-radius":value})); applied.push({target,action,value,semantic,scope:op.scope||null});
    } else if (semantic==="cards" && action==="padding") { const value=clean(op.value,32); cssOverrides.push(overrideBlock(target,{padding:value})); applied.push({target,action,value,semantic,scope:op.scope||null});
    } else if (semantic==="grid" && action==="columns") { const count=Math.max(1,Math.min(4,Math.round(safeNumber(op.value,3)))); cssOverrides.push(overrideBlock(target,{"grid-template-columns":`repeat(${count}, minmax(0, 1fr))`})); cssOverrides.push(mediaBlock("max-width:760px",[overrideBlock(target,{"grid-template-columns":"1fr"})])); applied.push({target,action,value:count,semantic,scope:op.scope||null});
    } else if (semantic==="section" && action==="vertical_spacing") { const value=clean(op.value,32); cssOverrides.push(overrideBlock(target,{"padding-top":value,"padding-bottom":value})); applied.push({target,action,value,semantic});
    } else if (semantic==="navigation" && action==="surface_opacity") { const opacity=Math.max(0,Math.min(1,safeNumber(op.value,.9))); cssOverrides.push(overrideBlock(target,{background:`rgba(6, 9, 18, ${opacity})`,"backdrop-filter":"blur(18px)"})); applied.push({target,action,value:opacity,semantic});
    } else if (semantic==="resolved_reference" && action==="context_emphasis") { cssOverrides.push(overrideBlock(target,{display:"inline-flex","align-items":"center",gap:"0.35em",padding:"0.28em 0.68em","border-radius":"999px",border:"1px solid color-mix(in srgb, currentColor 42%, transparent)",background:"linear-gradient(135deg, color-mix(in srgb, currentColor 10%, transparent), transparent)","letter-spacing":"0.08em","box-shadow":"inset 0 0 24px color-mix(in srgb, currentColor 7%, transparent)"})); applied.push({target,action,value:"futuristic",semantic});
    } else if (target===":root" && action==="accent_color" && /^#[0-9a-f]{3,8}$/i.test(clean(op.value,16))) { const value=clean(op.value,16); cssOverrides.push(overrideBlock(":root",{"--accent":value})); applied.push({target,action,value,semantic:"theme"});
    }
  }
  if (!applied.length) return { error:"NO_EXECUTABLE_NATURAL_EDIT_OPERATIONS", applied:[], analysis };
  const managedBlock=buildManagedOverrideBlock([priorManagedBody,...cssOverrides]), nextCss=managedBlock?`${cleanCss}\n\n${managedBlock}\n`:`${cleanCss}\n`, changedFiles=[]; if(nextHtml!==html) changedFiles.push("index.html"); if(nextCss!==css) changedFiles.push("styles.css");
  return { ok:true, css:nextCss, html:nextHtml, applied, analysis, override_management:{mode:"append-preserve",prior_managed_overrides_preserved:Boolean(priorManagedBody),managed_block:Boolean(managedBlock)}, changed_files:changedFiles };
}
