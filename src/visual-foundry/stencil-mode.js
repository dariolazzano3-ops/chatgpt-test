const MODES=Object.freeze(['REFERENCE_ONLY','RUNTIME_ONLY','OVERLAY','BLINK','DIFFERENCE']);
const clean=(v,max=2000)=>String(v??'').trim().slice(0,max);
const clone=v=>structuredClone(v);
const clamp=(v,min,max)=>Math.max(min,Math.min(max,Number(v)));

export const STENCIL_MODES=MODES;

export function createStencilContract(input={}){
  const referenceId=clean(input.reference_id,240);
  const referenceHash=clean(input.reference_hash,240);
  const source=clean(input.source,2000);
  const width=Number(input.canvas?.width),height=Number(input.canvas?.height),dpr=Number(input.canvas?.device_pixel_ratio??1);
  if(!referenceId)throw new Error('STENCIL_REFERENCE_ID_REQUIRED');
  if(!referenceHash)throw new Error('STENCIL_REFERENCE_HASH_REQUIRED');
  if(!source)throw new Error('STENCIL_SOURCE_REQUIRED');
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1)throw new Error('STENCIL_CANVAS_INVALID');
  if(!Number.isFinite(dpr)||dpr<=0)throw new Error('STENCIL_DPR_INVALID');
  const opacity=clamp(input.opacity??0.5,0,1);
  return {
    schema:'riosystems.reference-stencil-contract.v1',
    reference_id:referenceId,
    reference_hash:referenceHash,
    reference_version:clean(input.reference_version||'1.0',80),
    source,
    source_type:clean(input.source_type||'BUILD_ASSET',80),
    canvas:{width,height,device_pixel_ratio:dpr},
    mode:MODES.includes(input.mode)?input.mode:'OVERLAY',
    opacity,
    scale_mode:'EXACT_CANVAS',
    truth_class:'VISUAL_BUILD_AID',
    pointer_events:'NONE',
    production_allowed:false,
    public_allowed:false,
    persistent_runtime_write_allowed:false
  };
}

export function validateStencilContract(contract={}){
  const issues=[];
  if(contract.schema!=='riosystems.reference-stencil-contract.v1')issues.push('STENCIL_SCHEMA_INVALID');
  for(const key of ['reference_id','reference_hash','source'])if(!clean(contract[key],2000))issues.push('STENCIL_FIELD_REQUIRED:'+key);
  if(!MODES.includes(contract.mode))issues.push('STENCIL_MODE_INVALID');
  if(contract.scale_mode!=='EXACT_CANVAS')issues.push('STENCIL_SCALE_MODE_INVALID');
  if(contract.truth_class!=='VISUAL_BUILD_AID')issues.push('STENCIL_TRUTH_CLASS_INVALID');
  if(contract.production_allowed!==false)issues.push('STENCIL_PRODUCTION_MUST_BE_FALSE');
  if(contract.public_allowed!==false)issues.push('STENCIL_PUBLIC_MUST_BE_FALSE');
  const c=contract.canvas||{};
  if(!Number.isInteger(Number(c.width))||!Number.isInteger(Number(c.height)))issues.push('STENCIL_CANVAS_INVALID');
  return {ok:issues.length===0,issues};
}

export async function installReferenceStencil(page,contract={}){
  if(!page||typeof page.evaluate!=='function')throw new Error('STENCIL_PAGE_REQUIRED');
  const validation=validateStencilContract(contract);
  if(!validation.ok)throw new Error('STENCIL_CONTRACT_INVALID:'+validation.issues.join(','));
  return page.evaluate((contract)=>{
    document.querySelector('[data-vf-stencil-root]')?.remove();
    document.getElementById('vf-stencil-runtime-visibility')?.remove();

    const root=document.createElement('div');
    root.dataset.vfStencilRoot='true';
    root.dataset.referenceId=contract.reference_id;
    root.dataset.referenceHash=contract.reference_hash;
    root.dataset.mode=contract.mode;
    Object.assign(root.style,{
      position:'fixed',left:'0px',top:'0px',
      width:contract.canvas.width+'px',height:contract.canvas.height+'px',
      zIndex:'2147483646',pointerEvents:'none',overflow:'hidden',
      transformOrigin:'0 0',display:'block'
    });
    const img=document.createElement('img');
    img.dataset.vfStencilImage='true';
    img.alt='';
    img.setAttribute('aria-hidden','true');
    img.src=contract.source;
    Object.assign(img.style,{
      display:'block',width:'100%',height:'100%',objectFit:'fill',
      opacity:String(contract.opacity),pointerEvents:'none',userSelect:'none'
    });
    root.appendChild(img);
    document.body.appendChild(root);

    window.__vfStencilContract=contract;
    return {installed:true,width:root.getBoundingClientRect().width,height:root.getBoundingClientRect().height,mode:contract.mode};
  },clone(contract));
}

export async function setStencilMode(page,mode,options={}){
  if(!MODES.includes(mode))throw new Error('STENCIL_MODE_INVALID');
  return page.evaluate(({mode,opacity})=>{
    const root=document.querySelector('[data-vf-stencil-root]');
    const img=root?.querySelector('[data-vf-stencil-image]');
    if(!root||!img)throw new Error('STENCIL_NOT_INSTALLED');
    document.getElementById('vf-stencil-runtime-visibility')?.remove();
    root.dataset.mode=mode;
    img.style.mixBlendMode='normal';
    img.style.opacity=String(opacity);
    root.style.display='block';
    if(mode==='RUNTIME_ONLY')root.style.display='none';
    if(mode==='REFERENCE_ONLY'){
      const style=document.createElement('style');
      style.id='vf-stencil-runtime-visibility';
      style.textContent='body > *:not([data-vf-stencil-root]){visibility:hidden!important}';
      document.head.appendChild(style);
      img.style.opacity='1';
    }
    if(mode==='OVERLAY')img.style.opacity=String(opacity);
    if(mode==='DIFFERENCE'){img.style.opacity='1';img.style.mixBlendMode='difference';}
    if(mode==='BLINK')img.style.opacity=String(opacity);
    return {mode,display:root.style.display,opacity:img.style.opacity,mix_blend_mode:img.style.mixBlendMode||'normal'};
  },{mode,opacity:clamp(options.opacity??0.5,0,1)});
}

export async function toggleStencilBlinkFrame(page,frame='REFERENCE'){
  if(!['REFERENCE','RUNTIME'].includes(frame))throw new Error('STENCIL_BLINK_FRAME_INVALID');
  return page.evaluate((frame)=>{
    const root=document.querySelector('[data-vf-stencil-root]');
    const img=root?.querySelector('[data-vf-stencil-image]');
    if(!root||!img)throw new Error('STENCIL_NOT_INSTALLED');
    root.style.display=frame==='REFERENCE'?'block':'none';
    img.style.opacity='1';
    root.dataset.blinkFrame=frame;
    return {frame,display:root.style.display};
  },frame);
}

export async function removeReferenceStencil(page){
  if(!page||typeof page.evaluate!=='function')throw new Error('STENCIL_PAGE_REQUIRED');
  return page.evaluate(()=>{
    document.querySelector('[data-vf-stencil-root]')?.remove();
    document.getElementById('vf-stencil-runtime-visibility')?.remove();
    delete window.__vfStencilContract;
    return {removed:!document.querySelector('[data-vf-stencil-root]')};
  });
}
