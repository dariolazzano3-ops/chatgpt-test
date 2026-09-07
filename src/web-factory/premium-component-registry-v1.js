const arr=(v)=>Array.isArray(v)?v:[];
const text=(v,max=500)=>String(v??'').replace(/\s+/g,' ').trim().slice(0,max);
const clone=(v)=>v==null?v:structuredClone(v);

export const PREMIUM_COMPONENT_IDS=Object.freeze([
  'Header','Navigation','Hero','TrustStrip','ServiceGrid','ProductGrid','Menu','PriceList','FeatureGrid',
  'Gallery','ImageMosaic','Story','About','Team','Location','OpeningHours','Contact','CTA','FAQ',
  'Testimonials','Stats','Footer','Legal','RestaurantMenu','GelateriaFlavorGrid','BakeryProductGrid',
  'PricingBoard','BookingCTA','LocationCard','OpeningHoursCard','ContactActions'
]);

const EXISTING_RENDERERS=new Set(['Header','Navigation','Hero','FeatureGrid','Gallery','About','Contact','CTA','FAQ','Testimonials','Stats','Footer','Legal']);

const DEFAULT_VISUAL_VARIANTS=Object.freeze(['default','editorial','contained']);
const DEFAULT_MOTION_VARIANTS=Object.freeze(['none','subtle-reveal']);
const SAFE_FACT_STATES=new Set(['CONFIRMED','APPROVED','DERIVED_SAFE']);

const SPECIAL=Object.freeze({
  Header:{semantic_role:'banner',content_required:['brand_name'],asset_requirements:[],visual_variants:['solid','transparent','overlay'],motion_variants:['none','sticky-transition']},
  Navigation:{semantic_role:'navigation',content_required:['items'],asset_requirements:[],visual_variants:['standard','compact','transparent','sticky'],motion_variants:['none','drawer','dropdown']},
  Hero:{semantic_role:'region',content_required:['headline','primary_cta'],asset_requirements:[],visual_variants:['centered','split','visual-heavy','minimal','editorial'],motion_variants:['none','subtle-reveal','text-reveal','media-reveal']},
  TrustStrip:{semantic_role:'region',content_required:['items'],asset_requirements:[],visual_variants:['logos','badges','facts'],motion_variants:['none','marquee-controlled']},
  ServiceGrid:{semantic_role:'region',content_required:['services'],asset_requirements:[],visual_variants:['cards','editorial-list','icon-grid'],motion_variants:['none','stagger-reveal']},
  ProductGrid:{semantic_role:'region',content_required:['products'],asset_requirements:[],visual_variants:['cards','catalog','editorial'],motion_variants:['none','stagger-reveal']},
  Menu:{semantic_role:'region',content_required:['items'],asset_requirements:[],visual_variants:['list','grouped','editorial'],motion_variants:['none','section-reveal']},
  PriceList:{semantic_role:'region',content_required:['prices'],asset_requirements:[],visual_variants:['table','list','cards'],motion_variants:['none','section-reveal']},
  FeatureGrid:{semantic_role:'region',content_required:['features'],asset_requirements:[],visual_variants:['cards','icons','editorial'],motion_variants:['none','stagger-reveal']},
  Gallery:{semantic_role:'region',content_required:['items'],asset_requirements:['image'],visual_variants:['grid','masonry','carousel'],motion_variants:['none','image-reveal']},
  ImageMosaic:{semantic_role:'region',content_required:['items'],asset_requirements:['image'],visual_variants:['mosaic','editorial','asymmetric'],motion_variants:['none','image-reveal','parallax-controlled']},
  Story:{semantic_role:'article',content_required:['headline','body'],asset_requirements:[],visual_variants:['editorial','split','timeline'],motion_variants:['none','text-reveal']},
  About:{semantic_role:'region',content_required:['headline','body'],asset_requirements:[],visual_variants:['split','editorial','minimal'],motion_variants:['none','subtle-reveal']},
  Team:{semantic_role:'region',content_required:['members'],asset_requirements:[],visual_variants:['cards','editorial','compact'],motion_variants:['none','stagger-reveal']},
  Location:{semantic_role:'region',content_required:['location'],asset_requirements:[],visual_variants:['map-supporting','editorial','compact'],motion_variants:['none','subtle-reveal']},
  OpeningHours:{semantic_role:'region',content_required:['opening_hours'],asset_requirements:[],visual_variants:['list','card','compact'],motion_variants:['none']},
  Contact:{semantic_role:'region',content_required:['contact'],asset_requirements:[],visual_variants:['split','card','form-supporting'],motion_variants:['none','subtle-reveal']},
  CTA:{semantic_role:'region',content_required:['label','href'],asset_requirements:[],visual_variants:['primary','secondary','inline','sticky'],motion_variants:['none','hover','subtle-reveal']},
  FAQ:{semantic_role:'region',content_required:['items'],asset_requirements:[],visual_variants:['accordion','list','two-column'],motion_variants:['none','accordion']},
  Testimonials:{semantic_role:'region',content_required:['items'],asset_requirements:[],visual_variants:['cards','quotes','carousel'],motion_variants:['none','carousel-controlled']},
  Stats:{semantic_role:'region',content_required:['items'],asset_requirements:[],visual_variants:['row','grid','editorial'],motion_variants:['none','count-up-reduced-motion-safe']},
  Footer:{semantic_role:'contentinfo',content_required:['brand_name'],asset_requirements:[],visual_variants:['compact','columns','editorial'],motion_variants:['none']},
  Legal:{semantic_role:'main',content_required:['legal_content'],asset_requirements:[],visual_variants:['document','compact'],motion_variants:['none']},
  RestaurantMenu:{semantic_role:'region',content_required:['menu_groups'],asset_requirements:[],visual_variants:['grouped','editorial','compact'],motion_variants:['none','section-reveal']},
  GelateriaFlavorGrid:{semantic_role:'region',content_required:['flavors'],asset_requirements:[],visual_variants:['flavor-cards','compact-grid','editorial'],motion_variants:['none','stagger-reveal']},
  BakeryProductGrid:{semantic_role:'region',content_required:['products'],asset_requirements:[],visual_variants:['product-cards','catalog','editorial'],motion_variants:['none','stagger-reveal']},
  PricingBoard:{semantic_role:'region',content_required:['prices'],asset_requirements:[],visual_variants:['board','table','cards'],motion_variants:['none','section-reveal']},
  BookingCTA:{semantic_role:'region',content_required:['label','href'],asset_requirements:[],visual_variants:['primary','sticky','inline'],motion_variants:['none','hover']},
  LocationCard:{semantic_role:'region',content_required:['location'],asset_requirements:[],visual_variants:['card','split','compact'],motion_variants:['none','subtle-reveal']},
  OpeningHoursCard:{semantic_role:'region',content_required:['opening_hours'],asset_requirements:[],visual_variants:['card','compact'],motion_variants:['none']},
  ContactActions:{semantic_role:'region',content_required:['actions'],asset_requirements:[],visual_variants:['buttons','stack','compact'],motion_variants:['none','hover']}
});

function baseContract(id){
  const special=SPECIAL[id]||{};
  return {
    component_id:id,
    schema:'riosystems.premium-web-component.v1',
    category:['RestaurantMenu','GelateriaFlavorGrid','BakeryProductGrid','PricingBoard','BookingCTA','LocationCard','OpeningHoursCard','ContactActions'].includes(id)?'local_business':'core',
    semantic_contract:{
      landmark:special.semantic_role||'region',
      heading_required:!['Header','Navigation','Footer'].includes(id),
      native_elements_preferred:true,
      semantic_div_soup_allowed:false
    },
    responsive_contract:{
      mobile:'single-column-or-purposeful-compact',
      tablet:'component-specific-adaptive',
      desktop:'reference-contract-driven',
      horizontal_overflow_allowed:false,
      content_clipping_allowed:false
    },
    a11y_contract:{
      keyboard_required:true,
      visible_focus_required:true,
      labels_required:true,
      reduced_motion_required:true,
      touch_target_min_px:44,
      axe_critical_allowed:0,
      axe_serious_allowed:0
    },
    content_requirements:{
      required:[...(special.content_required||[])],
      fabricated_facts_allowed:false,
      prohibited_fact_rendering_allowed:false
    },
    asset_requirements:{
      required_types:[...(special.asset_requirements||[])],
      rights_states_allowed:['owned','licensed','public_domain','generated'],
      unknown_rights_allowed:false,
      responsive_variants_required:special.asset_requirements?.includes('image')===true
    },
    visual_variants:[...(special.visual_variants||DEFAULT_VISUAL_VARIANTS)],
    motion_variants:[...(special.motion_variants||DEFAULT_MOTION_VARIANTS)],
    renderer_binding:EXISTING_RENDERERS.has(id)?'existing-webfactory-renderer':'premium-component-registry-extension',
    design_tokens_required:true,
    project_facts_only:true
  };
}

const REGISTRY=Object.freeze(Object.fromEntries(PREMIUM_COMPONENT_IDS.map(id=>[id,Object.freeze(baseContract(id))])));

export function premiumComponentRegistry(){
  return {
    schema:'riosystems.premium-component-registry.v1',
    version:'1.0.0',
    extends:'riosystems.component-system.v2',
    component_count:PREMIUM_COMPONENT_IDS.length,
    components:clone(REGISTRY),
    duplicate_render_engine:false,
    existing_renderers_reused:true,
    project_scoped_content_required:true,
    production_deploy:false
  };
}

export function getPremiumComponentContract(componentId){
  const id=text(componentId,120);
  return REGISTRY[id]?clone(REGISTRY[id]):null;
}

function hasValue(value){
  if(Array.isArray(value)) return value.length>0;
  if(value&&typeof value==='object') return Object.keys(value).length>0;
  return value!==undefined&&value!==null&&String(value).trim()!=='';
}

export function validatePremiumComponentPayload(componentId,payload={}){
  const contract=getPremiumComponentContract(componentId);
  if(!contract)return{ok:false,status:'UNKNOWN_PREMIUM_COMPONENT',component_id:text(componentId,120),issues:[{code:'UNKNOWN_COMPONENT'}],production_deploy:false};
  const issues=[];
  const content=payload.content&&typeof payload.content==='object'?payload.content:payload;
  for(const key of contract.content_requirements.required){
    if(!hasValue(content?.[key]))issues.push({code:'REQUIRED_CONTENT_MISSING',field:key});
  }
  for(const fact of arr(payload.facts)){
    const state=text(fact?.state||fact?.status||'UNKNOWN',80).toUpperCase();
    if(!SAFE_FACT_STATES.has(state))issues.push({code:'UNVERIFIED_FACT_BLOCKED',field:text(fact?.field||fact?.key,160),state});
  }
  if(componentId==='Testimonials'){
    for(const item of arr(content?.items)){
      if(item?.verified!==true)issues.push({code:'UNVERIFIED_TESTIMONIAL_BLOCKED'});
    }
  }
  for(const asset of arr(payload.assets)){
    const rights=text(asset?.rights_status||asset?.license_status||'unknown',80).toLowerCase();
    if(!contract.asset_requirements.rights_states_allowed.includes(rights))issues.push({code:'ASSET_RIGHTS_BLOCKED',asset_id:text(asset?.asset_id||asset?.id,160),rights});
  }
  for(const requiredType of contract.asset_requirements.required_types){
    if(!arr(payload.assets).some(asset=>text(asset?.kind||asset?.type,80).toLowerCase().includes(requiredType)))issues.push({code:'REQUIRED_ASSET_MISSING',asset_type:requiredType});
  }
  const visualVariant=text(payload.visual_variant||contract.visual_variants[0],120);
  if(!contract.visual_variants.includes(visualVariant))issues.push({code:'VISUAL_VARIANT_UNSUPPORTED',variant:visualVariant});
  const motionVariant=text(payload.motion_variant||contract.motion_variants[0],120);
  if(!contract.motion_variants.includes(motionVariant))issues.push({code:'MOTION_VARIANT_UNSUPPORTED',variant:motionVariant});
  return{
    ok:issues.length===0,
    status:issues.length?'PREMIUM_COMPONENT_BLOCKED':'PREMIUM_COMPONENT_VALID',
    component_id:componentId,
    visual_variant:visualVariant,
    motion_variant:motionVariant,
    issues,
    contract,
    production_deploy:false
  };
}

export function selectPremiumComponent(input={}){
  const intent=text(input.intent||input.component_intent,240).toLowerCase();
  const industry=text(input.industry,160).toLowerCase();
  const explicit=text(input.component_id,120);
  if(explicit&&REGISTRY[explicit])return{ok:true,status:'COMPONENT_SELECTED',component_id:explicit,reason:'explicit_valid_component',contract:getPremiumComponentContract(explicit)};
  const pairs=[
    [/flavou?r|eissorte|gelato|gelateria/,'GelateriaFlavorGrid'],
    [/bakery|bäck|bread|pastry/,'BakeryProductGrid'],
    [/restaurant.*menu|speisekarte/,'RestaurantMenu'],
    [/opening|öffnungs/,'OpeningHoursCard'],
    [/location|standort|adresse/,'LocationCard'],
    [/booking|reservation|reserv/,'BookingCTA'],
    [/price|preis/,'PricingBoard'],
    [/contact.*action|phone|telefon|whatsapp/,'ContactActions'],
    [/gallery|galerie/,'Gallery'],
    [/faq/,'FAQ'],
    [/team/,'Team'],
    [/hero/,'Hero']
  ];
  for(const [pattern,id] of pairs){
    if(pattern.test(intent+' '+industry))return{ok:true,status:'COMPONENT_SELECTED',component_id:id,reason:'deterministic_intent_match',contract:getPremiumComponentContract(id)};
  }
  return{ok:true,status:'COMPONENT_SELECTED',component_id:'FeatureGrid',reason:'safe_default',contract:getPremiumComponentContract('FeatureGrid')};
}

export function premiumComponentRegistryManifest(){
  return{
    schema:'riosystems.premium-component-registry-manifest.v1',
    registry:'riosystems.premium-component-registry.v1',
    extends:'riosystems.component-system.v2',
    required_components:[...PREMIUM_COMPONENT_IDS],
    per_component_contracts:['semantic','responsive','a11y','content','asset','visual_variants','motion_variants'],
    fabricated_facts_allowed:false,
    unknown_rights_assets_allowed:false,
    duplicate_component_engine:false,
    production_deploy:false
  };
}
