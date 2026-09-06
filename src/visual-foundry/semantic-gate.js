const clone=v=>structuredClone(v);

function summarize(items){
  const critical=items.filter(x=>x.severity==='CRITICAL');
  const high=items.filter(x=>x.severity==='HIGH');
  return {critical_count:critical.length,high_count:high.length,blocking_count:critical.length+high.length};
}

export async function evaluateSemanticImplementation(page,input={}){
  if(!page||typeof page.evaluate!=='function')throw new Error('SEMANTIC_GATE_PAGE_REQUIRED');
  const allowStencil=input.allow_stencil===true;
  const maxStructuralAbsoluteRatio=Number(input.max_structural_absolute_ratio??0.35);
  const report=await page.evaluate(({allowStencil,maxStructuralAbsoluteRatio})=>{
    const issues=[];
    const push=(code,severity,evidence={})=>issues.push({code,severity,evidence});
    const visible=el=>{const s=getComputedStyle(el),r=el.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0;};

    const h1=[...document.querySelectorAll('h1')].filter(visible);
    if(h1.length!==1)push('SEMANTIC_H1_COUNT','CRITICAL',{count:h1.length});

    const headings=[...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].filter(visible);
    let previous=null;
    for(const h of headings){
      const level=Number(h.tagName.slice(1));
      if(previous!==null&&level>previous+1)push('SEMANTIC_HEADING_LEVEL_JUMP','HIGH',{from:previous,to:level,text:(h.textContent||'').trim().slice(0,80)});
      previous=level;
    }

    const main=[...document.querySelectorAll('main,[role="main"]')].filter(visible);
    if(main.length<1)push('SEMANTIC_MAIN_LANDMARK_MISSING','HIGH',{});

    for(const button of [...document.querySelectorAll('button')].filter(visible)){
      const name=(button.getAttribute('aria-label')||button.textContent||'').trim();
      if(!name)push('ACCESSIBLE_BUTTON_NAME_MISSING','CRITICAL',{html:button.outerHTML.slice(0,180)});
    }
    for(const link of [...document.querySelectorAll('a')].filter(visible)){
      const name=(link.getAttribute('aria-label')||link.textContent||'').trim();
      if(!link.getAttribute('href'))push('SEMANTIC_LINK_HREF_MISSING','HIGH',{text:name.slice(0,80)});
      if(!name)push('ACCESSIBLE_LINK_NAME_MISSING','CRITICAL',{href:link.getAttribute('href')});
    }

    const positiveTab=[...document.querySelectorAll('[tabindex]')].filter(el=>Number(el.getAttribute('tabindex'))>0);
    if(positiveTab.length)push('ACCESSIBILITY_POSITIVE_TABINDEX','HIGH',{count:positiveTab.length});

    const fakeButtons=[...document.querySelectorAll('[onclick]')].filter(el=>!el.matches('button,a,input,select,textarea,[role="button"]'));
    if(fakeButtons.length)push('SEMANTIC_FAKE_INTERACTIVE_ELEMENT','HIGH',{count:fakeButtons.length});

    const stencil=document.querySelector('[data-vf-stencil-root]');
    if(stencil&&!allowStencil)push('STENCIL_LEAK_IN_FINAL_IMPLEMENTATION','CRITICAL',{});

    const viewportArea=Math.max(1,innerWidth*innerHeight);
    const candidates=[...document.querySelectorAll('img,*')].filter((el,i,arr)=>arr.indexOf(el)===i&&visible(el));
    let screenshotHackCount=0;
    for(const el of candidates){
      if(el.closest('[data-vf-stencil-root]'))continue;
      const r=el.getBoundingClientRect(),s=getComputedStyle(el);
      const ratio=(r.width*r.height)/viewportArea;
      const hasRaster=el.tagName==='IMG'||(s.backgroundImage&&s.backgroundImage!=='none');
      const overlayLike=['fixed','absolute'].includes(s.position)&&s.pointerEvents==='none';
      if(ratio>=.9&&hasRaster&&overlayLike)screenshotHackCount++;
    }
    if(screenshotHackCount)push('SCREENSHOT_AS_IMPLEMENTATION_HACK','CRITICAL',{count:screenshotHackCount});

    const structural=[...document.querySelectorAll('[data-visual-id]')].filter(visible);
    const absolute=structural.filter(el=>['absolute','fixed'].includes(getComputedStyle(el).position));
    const absoluteRatio=structural.length?absolute.length/structural.length:0;
    if(absoluteRatio>maxStructuralAbsoluteRatio)push('EXCESSIVE_STRUCTURAL_ABSOLUTE_POSITIONING','HIGH',{absolute_ratio:absoluteRatio,absolute_count:absolute.length,structural_count:structural.length,threshold:maxStructuralAbsoluteRatio});

    const duplicateIds=[...document.querySelectorAll('[id]')].map(x=>x.id).filter((id,i,a)=>id&&a.indexOf(id)!==i);
    if(duplicateIds.length)push('DOM_DUPLICATE_IDS','HIGH',{ids:[...new Set(duplicateIds)].slice(0,20)});

    return {
      issues,
      facts:{
        h1_count:h1.length,heading_count:headings.length,main_landmark_count:main.length,
        structural_visual_id_count:structural.length,structural_absolute_ratio:absoluteRatio,
        stencil_present:!!stencil,screenshot_hack_count:screenshotHackCount
      }
    };
  },{allowStencil,maxStructuralAbsoluteRatio});

  const summary=summarize(report.issues);
  return {
    schema:'riosystems.semantic-implementation-gate.v1',
    status:summary.blocking_count?'FAIL':'PASS',
    ...summary,
    issues:clone(report.issues),
    facts:clone(report.facts),
    pixel_score_can_override:false,
    visual_pass_requires_semantic_pass:true
  };
}
