const clean=(v,max=240)=>String(v??'').trim().slice(0,max);
const clone=v=>structuredClone(v);
const round=(v,d=6)=>{const f=10**d;return Math.round(Number(v)*f)/f};

export const CONSTRAINT_STRATEGIES=Object.freeze(['FIXED_RAIL','FLUID_FILL','GRID_FRACTION','RELATIVE_BOX']);

function bounds(input={}){
  const x=Number(input.x),y=Number(input.y),width=Number(input.width),height=Number(input.height);
  if(![x,y,width,height].every(Number.isFinite)||width<=0||height<=0)throw new Error('CONSTRAINT_BOUNDS_INVALID');
  return {x,y,width,height};
}

function inferStrategy(item,parent){
  const role=clean(item.role,80).toUpperCase();
  const ratio=item.bounds.width/parent.width;
  if(['SIDEBAR','NAV_RAIL','RIGHT_RAIL_FIXED'].includes(role))return 'FIXED_RAIL';
  if(item.group_id)return 'GRID_FRACTION';
  if(ratio>=0.82)return 'FLUID_FILL';
  return 'RELATIVE_BOX';
}

export function deriveResponsiveConstraintSet(input={}){
  const canvas={width:Number(input.canvas?.width),height:Number(input.canvas?.height)};
  if(!Number.isFinite(canvas.width)||!Number.isFinite(canvas.height)||canvas.width<=0||canvas.height<=0)throw new Error('CONSTRAINT_CANVAS_INVALID');
  const items=(input.elements||[]).map(item=>{
    const id=clean(item.id,180);
    if(!id)throw new Error('CONSTRAINT_ELEMENT_ID_REQUIRED');
    const b=bounds(item.bounds);
    const parent=bounds(item.parent_bounds||{x:0,y:0,width:canvas.width,height:canvas.height});
    const strategy=clean(item.strategy,80)||inferStrategy({...item,bounds:b},parent);
    if(!CONSTRAINT_STRATEGIES.includes(strategy))throw new Error('CONSTRAINT_STRATEGY_INVALID:'+strategy);
    const relative={
      x:round((b.x-parent.x)/parent.width),
      y:round((b.y-parent.y)/parent.height),
      width:round(b.width/parent.width),
      height:round(b.height/parent.height),
      right:round((parent.x+parent.width-(b.x+b.width))/parent.width),
      bottom:round((parent.y+parent.height-(b.y+b.height))/parent.height)
    };
    const fixedWidth=strategy==='FIXED_RAIL'?b.width:null;
    return {
      id,role:clean(item.role||'REGION',80),group_id:item.group_id?clean(item.group_id,120):null,
      strategy,
      calibration_anchor:{viewport:clone(canvas),bounds:b},
      parent_bounds:parent,
      relative,
      constraints:{
        width_px:fixedWidth,
        min_width_px:strategy==='FIXED_RAIL'?round(b.width*.9):null,
        max_width_px:strategy==='FIXED_RAIL'?round(b.width*1.1):null,
        preserve_left_ratio:strategy!=='FIXED_RAIL',
        preserve_width_ratio:strategy!=='FIXED_RAIL',
        responsive_absolute_positioning_required:false
      }
    };
  });

  const groups={};
  for(const item of items.filter(x=>x.group_id)){
    const list=groups[item.group_id]||(groups[item.group_id]=[]);
    list.push(item);
  }
  const grid_groups=Object.entries(groups).map(([group_id,list])=>{
    const total=list.reduce((s,x)=>s+x.calibration_anchor.bounds.width,0);
    return {
      group_id,
      columns:list.map(x=>({id:x.id,fraction:round(x.calibration_anchor.bounds.width/total),anchor_width_px:x.calibration_anchor.bounds.width})),
      css_strategy:'GRID_FRACTIONS'
    };
  });

  return {
    schema:'riosystems.responsive-constraint-set.v1',
    calibration_canvas:canvas,
    elements:items,
    grid_groups,
    exact_anchor_required:true,
    responsive_constraint_required:true,
    absolute_pixel_layout_as_final_strategy:false
  };
}

export function projectConstraintAtParent(constraint={},parent={}){
  const width=Number(parent.width),height=Number(parent.height),x=Number(parent.x??0),y=Number(parent.y??0);
  if(![width,height,x,y].every(Number.isFinite)||width<=0||height<=0)throw new Error('CONSTRAINT_PARENT_INVALID');
  const r=constraint.relative||{};
  if(constraint.strategy==='FIXED_RAIL'){
    const w=Number(constraint.constraints.width_px);
    return {x,y:y+round(r.y*height),width:w,height:round(r.height*height)};
  }
  return {
    x:round(x+r.x*width),y:round(y+r.y*height),
    width:round(r.width*width),height:round(r.height*height)
  };
}

export function evaluateCalibrationAnchor(constraintSet={},actual=[]){
  const actualMap=new Map((actual||[]).map(x=>[x.id,x.bounds]));
  const checks=[];
  for(const item of constraintSet.elements||[]){
    const a=actualMap.get(item.id);
    const e=item.calibration_anchor.bounds;
    if(!a){checks.push({id:item.id,pass:false,reason:'MISSING'});continue;}
    const diffs={x:Math.abs(a.x-e.x),y:Math.abs(a.y-e.y),width:Math.abs(a.width-e.width),height:Math.abs(a.height-e.height)};
    const tolerance=Number(item.tolerance_px??1);
    checks.push({id:item.id,pass:Object.values(diffs).every(v=>v<=tolerance),diffs,tolerance});
  }
  return {schema:'riosystems.constraint-anchor-acceptance.v1',status:checks.every(x=>x.pass)?'PASS':'FAIL',checks};
}
