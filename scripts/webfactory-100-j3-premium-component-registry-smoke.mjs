import assert from 'node:assert/strict';
import {
  PREMIUM_COMPONENT_IDS,
  premiumComponentRegistry,
  getPremiumComponentContract,
  validatePremiumComponentPayload,
  selectPremiumComponent,
  premiumComponentRegistryManifest
} from '../src/web-factory/premium-component-registry-v1.js';

const required=[
  'Navigation','Hero','TrustStrip','ServiceGrid','ProductGrid','Menu','PriceList','FeatureGrid','Gallery',
  'ImageMosaic','Story','About','Team','Location','OpeningHours','Contact','CTA','FAQ','Testimonials',
  'Stats','Footer','Legal','RestaurantMenu','GelateriaFlavorGrid','BakeryProductGrid','PricingBoard',
  'BookingCTA','LocationCard','OpeningHoursCard','ContactActions'
];
for(const id of required)assert.ok(PREMIUM_COMPONENT_IDS.includes(id));

const registry=premiumComponentRegistry();
assert.equal(registry.duplicate_render_engine,false);
assert.equal(registry.existing_renderers_reused,true);
assert.equal(registry.component_count,PREMIUM_COMPONENT_IDS.length);

for(const id of PREMIUM_COMPONENT_IDS){
  const c=getPremiumComponentContract(id);
  assert.ok(c);
  assert.equal(c.schema,'riosystems.premium-web-component.v1');
  assert.equal(c.semantic_contract.semantic_div_soup_allowed,false);
  assert.equal(c.responsive_contract.horizontal_overflow_allowed,false);
  assert.equal(c.responsive_contract.content_clipping_allowed,false);
  assert.equal(c.a11y_contract.keyboard_required,true);
  assert.equal(c.a11y_contract.visible_focus_required,true);
  assert.equal(c.a11y_contract.axe_critical_allowed,0);
  assert.equal(c.a11y_contract.axe_serious_allowed,0);
  assert.equal(c.content_requirements.fabricated_facts_allowed,false);
  assert.equal(c.asset_requirements.unknown_rights_allowed,false);
  assert.ok(c.visual_variants.length>0);
  assert.ok(c.motion_variants.length>0);
}

const hero=validatePremiumComponentPayload('Hero',{
  content:{headline:'Eis mit bestätigter Herkunft',primary_cta:{label:'Besuchen',href:'#location'}},
  facts:[{field:'business_name',value:'Gelato Donatello',state:'CONFIRMED'}],
  visual_variant:'editorial',
  motion_variant:'subtle-reveal'
});
assert.equal(hero.ok,true);

const fakeHero=validatePremiumComponentPayload('Hero',{
  content:{headline:'Bestes Eis Deutschlands',primary_cta:{label:'Besuchen',href:'#location'}},
  facts:[{field:'award',value:'Bestes Eis Deutschlands',state:'PROHIBITED'}]
});
assert.equal(fakeHero.ok,false);
assert.ok(fakeHero.issues.some(i=>i.code==='UNVERIFIED_FACT_BLOCKED'));

const testimonial=validatePremiumComponentPayload('Testimonials',{
  content:{items:[{quote:'Fantastisch',name:'Test',verified:false}]}
});
assert.equal(testimonial.ok,false);
assert.ok(testimonial.issues.some(i=>i.code==='UNVERIFIED_TESTIMONIAL_BLOCKED'));

const galleryMissing=validatePremiumComponentPayload('Gallery',{content:{items:[{alt:'Eis'}]}});
assert.equal(galleryMissing.ok,false);
assert.ok(galleryMissing.issues.some(i=>i.code==='REQUIRED_ASSET_MISSING'));

const galleryUnsafe=validatePremiumComponentPayload('Gallery',{
  content:{items:[{alt:'Eis'}]},
  assets:[{asset_id:'photo-1',kind:'image',rights_status:'unknown'}]
});
assert.equal(galleryUnsafe.ok,false);
assert.ok(galleryUnsafe.issues.some(i=>i.code==='ASSET_RIGHTS_BLOCKED'));

const gallerySafe=validatePremiumComponentPayload('Gallery',{
  content:{items:[{alt:'Eis'}]},
  assets:[{asset_id:'photo-1',kind:'image',rights_status:'generated'}],
  visual_variant:'masonry',
  motion_variant:'image-reveal'
});
assert.equal(gallerySafe.ok,true);

assert.equal(selectPremiumComponent({industry:'gelateria',intent:'Eissorten zeigen'}).component_id,'GelateriaFlavorGrid');
assert.equal(selectPremiumComponent({industry:'bakery',intent:'products'}).component_id,'BakeryProductGrid');
assert.equal(selectPremiumComponent({industry:'restaurant',intent:'reservation booking'}).component_id,'BookingCTA');
assert.equal(selectPremiumComponent({component_id:'Hero'}).reason,'explicit_valid_component');
assert.equal(selectPremiumComponent({intent:'unknown neutral block'}).component_id,'FeatureGrid');

const manifest=premiumComponentRegistryManifest();
assert.equal(manifest.duplicate_component_engine,false);
assert.equal(manifest.fabricated_facts_allowed,false);
assert.equal(manifest.unknown_rights_assets_allowed,false);
assert.deepEqual(manifest.per_component_contracts,['semantic','responsive','a11y','content','asset','visual_variants','motion_variants']);

console.log(JSON.stringify({
  ok:true,
  suite:'webfactory-100-j3-premium-component-registry',
  component_count:PREMIUM_COMPONENT_IDS.length,
  local_business_components:PREMIUM_COMPONENT_IDS.filter(id=>getPremiumComponentContract(id).category==='local_business'),
  fabricated_facts_allowed:false,
  unknown_rights_assets_allowed:false,
  duplicate_component_engine:false,
  production_deploy:false
},null,2));
