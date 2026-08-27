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

export function executeNaturalEditPlan({ css="", html="", plan }) {
  if (!plan || plan.mode!=="natural-edit-plan") return { error:"INVALID_NATURAL_EDIT_PLAN" };
  if (plan?.safety?.production_deploy!==false) return { error:"PRODUCTION_MUST_REMAIN_DISABLED" };
  if (plan?.safety?.active_project_only!==true) return { error:"ACTIVE_PROJECT_ONLY_REQUIRED" };
  const priorManagedBody=extractFactoryOverrideBody(css), cleanCss=stripFactoryOverrides(css), analysis=analyzeProject({html,css:cleanCss}), cssOverrides=[], applied=[];
  let nextHtml=String(html||"");
  for (const op of Array.isArray(plan.operations)?plan.operations:[]) {
    const semantic=clean(op.semantic,80), fallbackTarget=clean(op.target,240), target=semantic && !["theme","headline","subheadline"].includes(semantic) ? (op.scope ? fallbackTarget : resolveSemanticSelector(analysis,semantic,fallbackTarget)) : fallbackTarget, action=clean(op.action,120);
    if (!target) continue;
    if (["headline","subheadline","cta"].includes(semantic) && action==="replace_text") {
      const value=clean(op.value, semantic==="subheadline"?260:semantic==="headline"?180:100); const changed=mutateScopedHtml(nextHtml,op.scope,semantic,value); if(changed===nextHtml) continue; nextHtml=changed; applied.push({target,action,value,semantic,scope:op.scope||null});
    } else if (semantic==="rocket" && action==="scale") { const scale=Math.max(.5,Math.min(2.5,safeNumber(op.value,1))); cssOverrides.push(overrideBlock(target,{scale})); applied.push({target,action,value:scale,semantic});
    } else if (semantic==="smoke" && action==="density") { const density=Math.max(.2,Math.min(2.5,safeNumber(op.value,1))); cssOverrides.push(overrideBlock(target,{opacity:Math.min(1,.48*density).toFixed(2),scale:Math.min(2.4,.9+density*.35).toFixed(2)})); applied.push({target,action,value:density,semantic});
    } else if (semantic==="hero_copy" && action==="text_align") { const align=op.value==="center"?"center":"left"; cssOverrides.push(overrideBlock(target,{"text-align":align,"align-items":align==="center"?"center":"flex-start"})); applied.push({target,action,value:align,semantic});
    } else if (semantic==="cards" && action==="border_radius") { const value=clean(op.value,32); cssOverrides.push(overrideBlock(target,{"border-radius":value})); applied.push({target,action,value,semantic,scope:op.scope||null});
    } else if (semantic==="cards" && action==="padding") { const value=clean(op.value,32); cssOverrides.push(overrideBlock(target,{padding:value})); applied.push({target,action,value,semantic,scope:op.scope||null});
    } else if (semantic==="grid" && action==="columns") { const count=Math.max(1,Math.min(4,Math.round(safeNumber(op.value,3)))); cssOverrides.push(overrideBlock(target,{"grid-template-columns":`repeat(${count}, minmax(0, 1fr))`})); cssOverrides.push(mediaBlock("max-width:760px",[overrideBlock(target,{"grid-template-columns":"1fr"})])); applied.push({target,action,value:count,semantic,scope:op.scope||null});
    } else if (semantic==="section" && action==="vertical_spacing") { const value=clean(op.value,32); cssOverrides.push(overrideBlock(target,{"padding-top":value,"padding-bottom":value})); applied.push({target,action,value,semantic});
    } else if (semantic==="navigation" && action==="surface_opacity") { const opacity=Math.max(0,Math.min(1,safeNumber(op.value,.9))); cssOverrides.push(overrideBlock(target,{background:`rgba(6, 9, 18, ${opacity})`,"backdrop-filter":"blur(18px)"})); applied.push({target,action,value:opacity,semantic});
    } else if (target===":root" && action==="accent_color" && /^#[0-9a-f]{3,8}$/i.test(clean(op.value,16))) { const value=clean(op.value,16); cssOverrides.push(overrideBlock(":root",{"--accent":value})); applied.push({target,action,value,semantic:"theme"});
    }
  }
  if (!applied.length) return { error:"NO_EXECUTABLE_NATURAL_EDIT_OPERATIONS", applied:[], analysis };
  const managedBlock=buildManagedOverrideBlock([priorManagedBody,...cssOverrides]), nextCss=managedBlock?`${cleanCss}\n\n${managedBlock}\n`:`${cleanCss}\n`, changedFiles=[]; if(nextHtml!==html) changedFiles.push("index.html"); if(nextCss!==css) changedFiles.push("styles.css");
  return { ok:true, css:nextCss, html:nextHtml, applied, analysis, override_management:{mode:"append-preserve",prior_managed_overrides_preserved:Boolean(priorManagedBody),managed_block:Boolean(managedBlock)}, changed_files:changedFiles };
}
