function round(value,digits=3){const f=10**digits;return Math.round(Number(value||0)*f)/f;}

export async function captureDomMeasurements(page,input={}) {
  if(!page||typeof page.evaluate!=='function') throw new Error('DOM_MEASUREMENT_PAGE_REQUIRED');
  const requested=Array.isArray(input.component_ids)?[...new Set(input.component_ids.map(String).filter(Boolean))]:[];

  return page.evaluate(({requested})=>{
    const round=(value,digits=3)=>{const f=10**digits;return Math.round(Number(value||0)*f)/f;};
    const parseBox=(style,prefix)=>({
      top:round(parseFloat(style[prefix+'Top'])||0),
      right:round(parseFloat(style[prefix+'Right'])||0),
      bottom:round(parseFloat(style[prefix+'Bottom'])||0),
      left:round(parseFloat(style[prefix+'Left'])||0)
    });
    const all=[...document.querySelectorAll('[data-visual-id]')];
    const seen=new Set(),duplicates=[];
    for(const el of all){
      const id=String(el.getAttribute('data-visual-id')||'').trim();
      if(!id)continue;
      if(seen.has(id))duplicates.push(id); else seen.add(id);
    }
    const ids=requested.length?requested:[...seen].sort();
    const components=ids.map(component_id=>{
      const matches=[...document.querySelectorAll('[data-visual-id]')].filter(el=>el.getAttribute('data-visual-id')===component_id);
      if(matches.length!==1)return {component_id,status:matches.length===0?'MISSING':'DUPLICATE',match_count:matches.length};
      const el=matches[0],r=el.getBoundingClientRect(),s=getComputedStyle(el);
      return {
        component_id,status:'MEASURED',
        geometry:{x:round(r.x),y:round(r.y),width:round(r.width),height:round(r.height),top:round(r.top),right:round(r.right),bottom:round(r.bottom),left:round(r.left)},
        padding:parseBox(s,'padding'),
        margin:parseBox(s,'margin'),
        typography:{font_family:s.fontFamily,font_size:round(parseFloat(s.fontSize)||0),font_weight:s.fontWeight,line_height:s.lineHeight==='normal'?'normal':round(parseFloat(s.lineHeight)||0),letter_spacing:s.letterSpacing==='normal'?'normal':round(parseFloat(s.letterSpacing)||0)},
        appearance:{border_radius:s.borderRadius,color:s.color,background_color:s.backgroundColor,opacity:round(parseFloat(s.opacity)||1),box_shadow:s.boxShadow},
        layout:{display:s.display,position:s.position,overflow_x:s.overflowX,overflow_y:s.overflowY,grid_template_columns:s.gridTemplateColumns,grid_template_rows:s.gridTemplateRows,column_gap:s.columnGap,row_gap:s.rowGap,flex_direction:s.flexDirection,flex_wrap:s.flexWrap,justify_content:s.justifyContent,align_items:s.alignItems}
      };
    });
    return {
      schema:'riosystems.dom-measurement-snapshot.v1',
      viewport:{width:window.innerWidth,height:window.innerHeight,device_pixel_ratio:window.devicePixelRatio},
      component_count:components.length,
      measured_count:components.filter(x=>x.status==='MEASURED').length,
      missing_count:components.filter(x=>x.status==='MISSING').length,
      duplicate_ids:[...new Set(duplicates)].sort(),
      components,
      stable_selector_contract:'data-visual-id',
      fragile_nth_child_core_contract:false
    };
  },{requested});
}

export function evaluateDomMeasurementIntegrity(snapshot={}) {
  const blocking=[];
  if(snapshot.schema!=='riosystems.dom-measurement-snapshot.v1')blocking.push({code:'DOM_MEASUREMENT_SCHEMA_INVALID'});
  if(Array.isArray(snapshot.duplicate_ids)&&snapshot.duplicate_ids.length)blocking.push({code:'VISUAL_ID_DUPLICATE',ids:snapshot.duplicate_ids});
  for(const component of snapshot.components||[]){
    if(component.status==='MISSING')blocking.push({code:'VISUAL_COMPONENT_MISSING',component_id:component.component_id});
    if(component.status==='DUPLICATE')blocking.push({code:'VISUAL_COMPONENT_DUPLICATE',component_id:component.component_id});
  }
  return {ok:blocking.length===0,status:blocking.length?'FAIL':'PASS',blocking};
}

export function toGeometryMeasurements(snapshot={}){
  return (snapshot.components||[]).filter(x=>x.status==='MEASURED').map(c=>({
    component_id:c.component_id,
    x:round(c.geometry.x),y:round(c.geometry.y),width:round(c.geometry.width),height:round(c.geometry.height)
  }));
}
