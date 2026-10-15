const {webkit,devices}=require('playwright');
const {mkdirSync}=require('node:fs');
const {join}=require('node:path');
const assert=require('node:assert/strict');
const folder=process.env.GITHUB_WORKSPACE?join(process.env.GITHUB_WORKSPACE,'.site-qa','gelato-v106'):join(process.cwd(),'.site-qa','gelato-v106');
const base=process.env.QA_URL||'http://127.0.0.1:18066/';
(async()=>{
 mkdirSync(folder,{recursive:true});
 const browser=await webkit.launch({headless:true});
 for(const [name,config] of [['safari-iphone',{...devices['iPhone 13']}],['safari-desktop',{viewport:{width:1440,height:900}}]]){
  const page=await browser.newPage(config);
  const errors=[];
  page.on('pageerror',e=>errors.push(String(e.message)));
  const response=await page.goto(base,{waitUntil:'domcontentloaded',timeout:30000});
  assert.equal(response.status(),200);
  const original=page.locator('#standort .v103-location__map-static img');
  await original.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1350);
  const s=await page.evaluate(()=>{
   const c=document.querySelector('.v88-caffe-photo');
   const loc=document.querySelector('.v102-location');
   const footer=document.querySelector('#site-footer');
   const surface=document.querySelector('[data-location-reveal]');
   const img=document.querySelector('#standort .v103-location__map-static img');
   return {coffee:getComputedStyle(c).backgroundColor,location:getComputedStyle(loc).backgroundColor,footer:getComputedStyle(footer).backgroundColor,
   gap:loc.getBoundingClientRect().top-c.getBoundingClientRect().bottom,
   width:document.documentElement.scrollWidth,viewport:innerWidth,
   image:img.currentSrc.split('/').pop(),natural:[img.naturalWidth,img.naturalHeight],
   imageFilter:getComputedStyle(img).filter,overlay:getComputedStyle(surface,'::after').opacity,revealed:surface.classList.contains('is-revealed'),
   route:document.querySelector('.v102-location__route')?.getAttribute('href'),
   call:document.querySelector('.v102-location__call')?.getAttribute('href')};
  });
  assert.deepEqual(s.natural,[1448,1086]);
  assert.equal(s.image,'gelato-donatello-original-location-v105.jpg');
  assert.equal(s.imageFilter,'none');
  assert.equal(s.coffee,s.location);
  assert.equal(s.location,s.footer);
  assert.ok(Math.abs(s.gap)<=1);
  assert.ok(s.width<=s.viewport);
  assert.ok(s.revealed);
  assert.ok(Number(s.overlay)<.02);
  assert.match(s.route,/google\.com\/maps\/dir/);
  assert.match(s.call,/^tel:/);
  assert.deepEqual(errors,[]);
  await page.addStyleTag({content:'#site-header,.skip-link{visibility:hidden!important}html{scroll-behavior:auto!important}'});
  await page.locator('#standort').screenshot({path:join(folder,name+'.png'),animations:'disabled'});
  console.log(name,'PASS',JSON.stringify(s));
  await page.close();
 }
 for(const [name,options] of [['safari-reduced-motion',{...devices['iPhone 13'],reducedMotion:'reduce'}],['safari-no-js',{...devices['iPhone 13'],javaScriptEnabled:false}]]){
  const page=await browser.newPage(options);
  await page.goto(base,{waitUntil:'domcontentloaded'});
  const obj=await page.evaluate(()=>{
   const surface=document.querySelector('[data-location-reveal]'),img=document.querySelector('#standort img');
   return {ready:document.body.classList.contains('location-reveal-ready'),image:img.naturalWidth,overlay:getComputedStyle(surface,'::after').content};
  });
  assert.equal(obj.image,1448);assert.ok(!obj.ready);assert.equal(obj.overlay,'none');
  console.log(name,'PASS',JSON.stringify(obj));
  await page.close();
 }
 await browser.close();
})().catch(e=>{console.error(e.stack);process.exitCode=1});
