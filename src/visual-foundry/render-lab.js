import crypto from 'node:crypto';
import os from 'node:os';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import pngjs from 'pngjs';

const { PNG } = pngjs;

function normalizeViewport(input={}) {
  const width=Number(input.width||1440);
  const height=Number(input.height||1100);
  const deviceScaleFactor=Number(input.device_pixel_ratio??input.deviceScaleFactor??1);
  if(!Number.isInteger(width)||width<320||width>4096) throw new Error('RENDER_VIEWPORT_WIDTH_INVALID');
  if(!Number.isInteger(height)||height<320||height>4096) throw new Error('RENDER_VIEWPORT_HEIGHT_INVALID');
  if(!Number.isFinite(deviceScaleFactor)||deviceScaleFactor<1||deviceScaleFactor>4) throw new Error('RENDER_DPR_INVALID');
  return {width,height,deviceScaleFactor};
}

function pngDimensions(buffer){
  if(buffer.length<24||buffer.subarray(0,8).toString('hex')!=='89504e470d0a1a0a') throw new Error('RENDER_SCREENSHOT_PNG_INVALID');
  return {width:buffer.readUInt32BE(16),height:buffer.readUInt32BE(20)};
}

function sha256(buffer){return crypto.createHash('sha256').update(buffer).digest('hex');}

export async function runPinnedRender(input={}) {
  const url=String(input.url||'');
  if(!/^https?:\/\//i.test(url)) throw new Error('RENDER_URL_INVALID');
  const outputPath=path.resolve(String(input.output_path||''));
  if(!input.output_path) throw new Error('RENDER_OUTPUT_PATH_REQUIRED');
  await fs.mkdir(path.dirname(outputPath),{recursive:true});

  const viewport=normalizeViewport(input.viewport);
  const locale=String(input.locale||'en-US');
  const timezone=String(input.timezone||'UTC');
  const masks=Array.isArray(input.mask_selectors)?input.mask_selectors.map(String).filter(Boolean).slice(0,100):[];

  const browser=await chromium.launch({headless:true});
  try{
    const browserVersion=browser.version();
    const context=await browser.newContext({
      viewport:{width:viewport.width,height:viewport.height},
      deviceScaleFactor:viewport.deviceScaleFactor,
      locale,
      timezoneId:timezone,
      reducedMotion:'reduce',
      serviceWorkers:'block',
      offline:false
    });
    const page=await context.newPage();
    const consoleErrors=[];
    const pageErrors=[];
    page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});
    page.on('pageerror',e=>pageErrors.push(String(e?.message||e)));

    const response=await page.goto(url,{waitUntil:'networkidle',timeout:Number(input.timeout_ms||60000)});
    if(!response||response.status()<200||response.status()>=400) throw new Error('RENDER_HTTP_'+(response?.status()||0));

    await page.addStyleTag({content:`
      *,*::before,*::after{
        animation-delay:0s!important;
        animation-duration:0s!important;
        animation-iteration-count:1!important;
        transition-delay:0s!important;
        transition-duration:0s!important;
        scroll-behavior:auto!important;
        caret-color:transparent!important;
      }
      [data-visual-foundry-masked="true"]{
        color:transparent!important;
        text-shadow:none!important;
      }
    `});

    for(const selector of masks){
      await page.locator(selector).evaluateAll((els)=>els.forEach((el)=>{
        el.setAttribute('data-visual-foundry-masked','true');
        if(el.childElementCount===0) el.textContent='[VISUAL_MASK]';
      })).catch(()=>{});
    }

    await page.evaluate(async()=>{if(document.fonts?.ready)await document.fonts.ready;});
    const environment=await page.evaluate(()=>({
      locale:navigator.language,
      timezone:Intl.DateTimeFormat().resolvedOptions().timeZone,
      reduced_motion:matchMedia('(prefers-reduced-motion: reduce)').matches,
      inner_width:window.innerWidth,
      inner_height:window.innerHeight,
      device_pixel_ratio:window.devicePixelRatio,
      font_manifest:[...document.fonts].map(f=>({
        family:f.family,
        style:f.style,
        weight:f.weight,
        stretch:f.stretch,
        status:f.status
      })).sort((a,b)=>(a.family+a.weight+a.style).localeCompare(b.family+b.weight+b.style))
    }));

    await page.screenshot({path:outputPath,fullPage:input.full_page!==false,animations:'disabled'});
    const screenshot=await fs.readFile(outputPath);
    const dimensions=pngDimensions(screenshot);
    const decoded=PNG.sync.read(screenshot);
    const screenshotPixelHash=sha256(decoded.data);

    await context.close();
    return {
      schema:'riosystems.pinned-render-evidence.v1',
      browser:'chromium',
      browser_version:browserVersion,
      playwright_package:'1.55.0',
      os:{platform:process.platform,release:os.release(),arch:process.arch},
      viewport:{width:viewport.width,height:viewport.height},
      device_pixel_ratio:viewport.deviceScaleFactor,
      locale,
      timezone,
      reduced_motion:true,
      animation_policy:'DISABLED_AND_FROZEN',
      service_workers:'BLOCKED',
      network_state:'ONLINE',
      mask_selectors:masks,
      font_manifest:environment.font_manifest,
      runtime_environment:environment,
      screenshot_path:outputPath,
      screenshot_dimensions:dimensions,
      screenshot_hash:sha256(screenshot),
      screenshot_pixel_hash:screenshotPixelHash,
      commit_sha:String(input.commit_sha||process.env.GITHUB_SHA||''),
      render_timestamp:new Date().toISOString(),
      console_errors:consoleErrors.slice(0,20),
      page_errors:pageErrors.slice(0,20),
      production_deploy:false,
      external_writes:false
    };
  }finally{
    await browser.close();
  }
}
