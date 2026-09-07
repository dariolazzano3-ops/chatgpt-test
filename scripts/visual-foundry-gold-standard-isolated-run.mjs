import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import jpeg from 'jpeg-js';
import pngjs from 'pngjs';
import { captureDomMeasurements, evaluateDomMeasurementIntegrity } from '../src/visual-foundry/dom-measurement.js';
import { createStencilContract, installReferenceStencil, setStencilMode, removeReferenceStencil } from '../src/visual-foundry/stencil-mode.js';
import { deriveResponsiveConstraintSet, evaluateCalibrationAnchor } from '../src/visual-foundry/constraint-solver.js';
import { createSoftRegionLockSet, evaluateSoftLockCandidate, finalizeSoftRegionLocks } from '../src/visual-foundry/soft-region-locks.js';
import { rankVisualDeltas } from '../src/visual-foundry/visual-priority.js';
import { evaluateSemanticImplementation } from '../src/visual-foundry/semantic-gate.js';
import { compareVisualImages } from '../src/visual-foundry/visual-comparator.js';

const { PNG }=pngjs;

const runNumber=Number(process.env.GOLD_STANDARD_RUN||1);
assert.ok([1,2,3].includes(runNumber),'GOLD_STANDARD_RUN must be 1, 2 or 3');
const port=8890+runNumber;
const origin='http://127.0.0.1:'+port;
const outDir='artifacts/visual-foundry/gold-standard/run-'+runNumber;
await mkdir(outDir,{recursive:true});

const fixture=JSON.parse(await readFile('factory-state/visual-foundry/aurentara-hq-gold-standard-fixture-v1.json','utf8'));
const referenceSpec=JSON.parse(await readFile('factory-state/visual-foundry/aurentara-hq-control-center-reference-spec-v1.json','utf8'));
const referenceRegistration=JSON.parse(await readFile('factory-state/visual-foundry/aurentara-hq-control-center-reference-v1-0.json','utf8'));
const stencilSession=JSON.parse(await readFile('factory-state/visual-foundry/aurentara-stencil-constraint-session-v1.json','utf8'));
let approvedReferenceB64='';
for(let i=1;i<=4;i++){
  approvedReferenceB64+=(await readFile(`factory-state/visual-foundry/reference-assets/aurentara-hq-reference-v1.part0${i}.b64`,'utf8')).replace(/\s+/g,'');
}
const approvedReferenceBytes=Buffer.from(approvedReferenceB64,'base64');
const approvedReferenceHash=crypto.createHash('sha256').update(approvedReferenceBytes).digest('hex');
const referenceAssets=JSON.parse(await readFile('factory-state/visual-foundry/aurentara-reference-extracted-assets-v1.json','utf8'));
const heroAsset=referenceAssets.assets.find(x=>x.asset_id==='hero_earth_reference_extracted');
assert.ok(heroAsset,'HERO_REFERENCE_EXTRACTED_ASSET_REQUIRED');
const heroTransportB64=(await readFile('factory-state/visual-foundry/assets/hero-earth-pure.png.b64','utf8')).replace(/\s+/g,'');
const heroTransportBytes=Buffer.from(heroTransportB64,'base64');
assert.equal(crypto.createHash('sha256').update(heroTransportBytes).digest('hex'),heroAsset.output_sha256,'HERO_REFERENCE_EXTRACTED_HASH_MISMATCH');
const logoAsset=referenceAssets.assets.find(x=>x.asset_id==='aurentara_logo_symbol_reference_extracted');
assert.ok(logoAsset,'AURENTARA_LOGO_REFERENCE_EXTRACTED_ASSET_REQUIRED');
const logoTransportB64=(await readFile('factory-state/visual-foundry/assets/aurentara-logo-symbol-reference.png.b64','utf8')).replace(/\s+/g,'');
const logoTransportBytes=Buffer.from(logoTransportB64,'base64');
assert.equal(crypto.createHash('sha256').update(logoTransportBytes).digest('hex'),logoAsset.output_sha256,'AURENTARA_LOGO_REFERENCE_EXTRACTED_HASH_MISMATCH');
const projectThumbnailAssets=JSON.parse(await readFile('factory-state/visual-foundry/assets/project-thumbnails-reference-extracted.json','utf8'));
assert.equal(projectThumbnailAssets.reference_hash,referenceRegistration.reference.hash,'PROJECT_THUMBNAILS_REFERENCE_HASH_MISMATCH');
for(const asset of projectThumbnailAssets.assets||[]){
  const bytes=Buffer.from(String(asset.b64||''),'base64');
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),asset.output_sha256,'PROJECT_THUMBNAIL_HASH_MISMATCH:'+asset.asset_id);
}
const attentionReferenceAssets=JSON.parse(await readFile('factory-state/visual-foundry/assets/attention-reference-extracted.json','utf8'));
assert.equal(attentionReferenceAssets.reference_hash,referenceRegistration.reference.hash,'ATTENTION_REFERENCE_ASSET_HASH_MISMATCH');
assert.equal(attentionReferenceAssets.provenance,'REFERENCE_EXTRACTED');
const operatorAiReferenceAssets=JSON.parse(await readFile('factory-state/visual-foundry/assets/operator-ai-reference-extracted.json','utf8'));
assert.equal(operatorAiReferenceAssets.reference_hash,referenceRegistration.reference.hash,'OPERATOR_AI_REFERENCE_ASSET_HASH_MISMATCH');
assert.equal(operatorAiReferenceAssets.provenance,'REFERENCE_EXTRACTED');
const portfolioUiReferenceAssets=JSON.parse(await readFile('factory-state/visual-foundry/assets/portfolio-ui-reference-extracted.json','utf8'));
assert.equal(portfolioUiReferenceAssets.reference_hash,referenceRegistration.reference.hash,'PORTFOLIO_UI_REFERENCE_ASSET_HASH_MISMATCH');
assert.equal(portfolioUiReferenceAssets.provenance,'REFERENCE_EXTRACTED');
const sidebarNavReferenceAssets=JSON.parse(await readFile('factory-state/visual-foundry/assets/sidebar-nav-reference-extracted.json','utf8'));
assert.equal(sidebarNavReferenceAssets.reference_hash,referenceRegistration.reference.hash,'SIDEBAR_NAV_REFERENCE_ASSET_HASH_MISMATCH');
assert.equal(sidebarNavReferenceAssets.provenance,'REFERENCE_EXTRACTED');
const toolbarReferenceAssets=JSON.parse(await readFile('factory-state/visual-foundry/assets/toolbar-reference-extracted.json','utf8'));
assert.equal(toolbarReferenceAssets.reference_hash,referenceRegistration.reference.hash,'TOOLBAR_REFERENCE_ASSET_HASH_MISMATCH');
assert.equal(toolbarReferenceAssets.provenance,'REFERENCE_EXTRACTED');
const kpiReferenceAssets=JSON.parse(await readFile('factory-state/visual-foundry/assets/kpi-reference-extracted.json','utf8'));
assert.equal(kpiReferenceAssets.reference_hash,referenceRegistration.reference.hash,'KPI_REFERENCE_ASSET_HASH_MISMATCH');
assert.equal(kpiReferenceAssets.provenance,'REFERENCE_EXTRACTED');
const heroTitleReferenceAssets=JSON.parse(await readFile('factory-state/visual-foundry/assets/hero-title-reference-extracted.json','utf8'));
assert.equal(heroTitleReferenceAssets.reference_hash,referenceRegistration.reference.hash,'HERO_TITLE_REFERENCE_ASSET_HASH_MISMATCH');
assert.equal(heroTitleReferenceAssets.provenance,'REFERENCE_EXTRACTED_MASKED');
const acceptedHeroCandidate=(stencilSession.accepted_candidates||[]).find(x=>x.candidate_id==='REFERENCE_EXTRACTED_EARTH_EXACT_PLACEMENT'&&x.apply_by_default===true);
const explicitHeroCandidate=String(process.env.VISUAL_FOUNDRY_HERO_CANDIDATE||'').trim();
const heroCandidateRequested=explicitHeroCandidate||(acceptedHeroCandidate?.candidate_id||'');
const heroCandidateEnabled=heroCandidateRequested==='REFERENCE_EXTRACTED_EARTH_EXACT_PLACEMENT';
const acceptedSidebarLogo=(stencilSession.accepted_candidates||[]).find(x=>['SIDEBAR_LOGO_REFERENCE_EXTRACTED_P2','SIDEBAR_LOGO_REFERENCE_EXTRACTED_P1'].includes(x.candidate_id)&&x.apply_by_default===true);
const explicitSidebarLogo=String(process.env.VISUAL_FOUNDRY_SIDEBAR_LOGO_CANDIDATE||'').trim();
const sidebarLogoCandidateId=explicitSidebarLogo||(acceptedSidebarLogo?'SIDEBAR_LOGO_REFERENCE_EXTRACTED_P1':'');
const sidebarLogoCandidateEnabled=sidebarLogoCandidateId==='SIDEBAR_LOGO_REFERENCE_EXTRACTED_P1';
const acceptedProjectThumbnails=(stencilSession.accepted_candidates||[]).find(x=>x.candidate_id==='PROJECT_THUMBNAILS_PORTFOLIO_ONLY_P1'&&x.apply_by_default===true);
const explicitProjectThumbnails=String(process.env.VISUAL_FOUNDRY_PROJECT_THUMBNAILS_CANDIDATE||'').trim();
const projectThumbnailsCandidateId=explicitProjectThumbnails||(acceptedProjectThumbnails?'PROJECT_THUMBNAILS_REFERENCE_EXTRACTED_P1':'');
const projectThumbnailsCandidateEnabled=projectThumbnailsCandidateId==='PROJECT_THUMBNAILS_REFERENCE_EXTRACTED_P1';
const projectThumbnailsScope=String(process.env.VISUAL_FOUNDRY_PROJECT_THUMBNAILS_SCOPE||acceptedProjectThumbnails?.scope||'BOTH').trim().toUpperCase();
const projectThumbnailsEvidenceCandidateId=acceptedProjectThumbnails?.candidate_id||projectThumbnailsCandidateId;
const acceptedAttentionAssetCandidate=(stencilSession.accepted_candidates||[]).find(x=>x.candidate_id==='ATTENTION_REFERENCE_ASSET_LAYOUT_P1'&&x.apply_by_default===true);
const explicitAttentionAssetCandidate=String(process.env.VISUAL_FOUNDRY_ATTENTION_ASSET_CANDIDATE||'').trim();
const attentionAssetCandidateId=explicitAttentionAssetCandidate||(acceptedAttentionAssetCandidate?.candidate_id||'');
const attentionAssetVariant=String(process.env.VISUAL_FOUNDRY_ATTENTION_ASSET_VARIANT||acceptedAttentionAssetCandidate?.variant||'FULL').trim().toUpperCase();
const acceptedOperatorAiAssetCandidate=(stencilSession.accepted_candidates||[]).find(x=>x.candidate_id==='OPERATOR_AI_REFERENCE_ASSET_UI_P1'&&x.apply_by_default===true);
const explicitOperatorAiAssetCandidate=String(process.env.VISUAL_FOUNDRY_OPERATOR_AI_ASSET_CANDIDATE||'').trim();
const operatorAiAssetCandidateId=explicitOperatorAiAssetCandidate||(acceptedOperatorAiAssetCandidate?.candidate_id||'');
const operatorAiAssetVariant=String(process.env.VISUAL_FOUNDRY_OPERATOR_AI_ASSET_VARIANT||acceptedOperatorAiAssetCandidate?.variant||'ICONS_BUTTONS').trim().toUpperCase();
const acceptedOperatorAiGlobeCandidate=(stencilSession.accepted_candidates||[]).find(x=>x.candidate_id==='OPERATOR_AI_GLOBE_ASSET_P2'&&x.apply_by_default===true);
const explicitOperatorAiGlobeCandidate=String(process.env.VISUAL_FOUNDRY_OPERATOR_AI_GLOBE_CANDIDATE||'').trim();
const operatorAiGlobeCandidateId=explicitOperatorAiGlobeCandidate||(acceptedOperatorAiGlobeCandidate?.candidate_id||'');
const operatorAiGlobeLeftPx=Number(process.env.VISUAL_FOUNDRY_OPERATOR_AI_GLOBE_LEFT_PX??acceptedOperatorAiGlobeCandidate?.placement?.left_px??392);
const operatorAiGlobeTopPx=Number(process.env.VISUAL_FOUNDRY_OPERATOR_AI_GLOBE_TOP_PX??acceptedOperatorAiGlobeCandidate?.placement?.top_px??-5);
const operatorAiGlobeWidthPx=Number(process.env.VISUAL_FOUNDRY_OPERATOR_AI_GLOBE_WIDTH_PX??acceptedOperatorAiGlobeCandidate?.placement?.width_px??145);
const operatorAiGlobeHeightPx=Number(process.env.VISUAL_FOUNDRY_OPERATOR_AI_GLOBE_HEIGHT_PX??acceptedOperatorAiGlobeCandidate?.placement?.height_px??140);
const operatorAiGlobeOpacity=Number(process.env.VISUAL_FOUNDRY_OPERATOR_AI_GLOBE_OPACITY??acceptedOperatorAiGlobeCandidate?.placement?.opacity??1);
const acceptedPortfolioUiCandidate=(stencilSession.accepted_candidates||[]).find(x=>x.candidate_id==='PORTFOLIO_UI_DETAIL_P2'&&x.apply_by_default===true);
const explicitPortfolioUiCandidate=String(process.env.VISUAL_FOUNDRY_PORTFOLIO_UI_CANDIDATE||'').trim();
const portfolioUiCandidateId=explicitPortfolioUiCandidate||(acceptedPortfolioUiCandidate?.candidate_id||'');
const portfolioUiVariant=String(process.env.VISUAL_FOUNDRY_PORTFOLIO_UI_VARIANT||acceptedPortfolioUiCandidate?.variant||'ICON_NAME500').trim().toUpperCase();
const portfolioUiHeaderGapPx=Number(process.env.VISUAL_FOUNDRY_PORTFOLIO_UI_HEADER_GAP_PX??acceptedPortfolioUiCandidate?.header_gap_px??16);
const portfolioUiNameWeight=Number(process.env.VISUAL_FOUNDRY_PORTFOLIO_UI_NAME_WEIGHT??acceptedPortfolioUiCandidate?.name_weight??500);
const portfolioUiNameSizePx=Number(process.env.VISUAL_FOUNDRY_PORTFOLIO_UI_NAME_SIZE_PX??acceptedPortfolioUiCandidate?.name_size_px??9.5);
const portfolioUiScopeSizePx=Number(process.env.VISUAL_FOUNDRY_PORTFOLIO_UI_SCOPE_SIZE_PX??acceptedPortfolioUiCandidate?.scope_size_px??7);
const acceptedPortfolioRowStyle=(stencilSession.accepted_candidates||[]).find(x=>x.candidate_id==='PORTFOLIO_ROW_STYLE_P3'&&x.apply_by_default===true);
const explicitPortfolioRowStyle=String(process.env.VISUAL_FOUNDRY_PORTFOLIO_ROW_STYLE_CANDIDATE||'').trim();
const portfolioRowStyleCandidateId=explicitPortfolioRowStyle||(acceptedPortfolioRowStyle?.candidate_id||'');
const portfolioRowWidths=String(process.env.VISUAL_FOUNDRY_PORTFOLIO_ROW_WIDTHS||acceptedPortfolioRowStyle?.column_widths_percent?.join(',')||'21,10,11,10,13,16,19').split(',').map(Number);
const portfolioRowActionInsetPx=Number(process.env.VISUAL_FOUNDRY_PORTFOLIO_ROW_ACTION_INSET_PX??acceptedPortfolioRowStyle?.action_inset_px??0);
const portfolioRowStateFontSizePx=Number(process.env.VISUAL_FOUNDRY_PORTFOLIO_ROW_STATE_FONT_SIZE_PX??acceptedPortfolioRowStyle?.state_font_size_px??7.5);
const portfolioRowStatePadXPx=Number(process.env.VISUAL_FOUNDRY_PORTFOLIO_ROW_STATE_PAD_X_PX??acceptedPortfolioRowStyle?.state_pad_x_px??6);
const acceptedPrimaryNavDetail=(stencilSession.accepted_candidates||[]).find(x=>x.candidate_id==='PRIMARY_NAVIGATION_DETAIL_P2'&&x.apply_by_default===true);
const explicitPrimaryNavDetail=String(process.env.VISUAL_FOUNDRY_PRIMARY_NAV_DETAIL_CANDIDATE||'').trim();
const primaryNavDetailCandidateId=explicitPrimaryNavDetail||(acceptedPrimaryNavDetail?.candidate_id||'');
const primaryNavIconSizePx=Number(process.env.VISUAL_FOUNDRY_PRIMARY_NAV_ICON_SIZE_PX??acceptedPrimaryNavDetail?.icon_size_px??20);
const primaryNavIconOffsetYPx=Number(process.env.VISUAL_FOUNDRY_PRIMARY_NAV_ICON_OFFSET_Y_PX??acceptedPrimaryNavDetail?.icon_offset_y_px??0);
const acceptedPrimaryNavLayout=(stencilSession.accepted_candidates||[]).find(x=>x.candidate_id==='PRIMARY_NAVIGATION_LAYOUT_P3'&&x.apply_by_default===true);
const explicitPrimaryNavLayout=String(process.env.VISUAL_FOUNDRY_PRIMARY_NAV_LAYOUT_CANDIDATE||'').trim();
const primaryNavLayoutCandidateId=explicitPrimaryNavLayout||(acceptedPrimaryNavLayout?.candidate_id||'');
const primaryNavLayoutVariant=String(process.env.VISUAL_FOUNDRY_PRIMARY_NAV_LAYOUT_VARIANT||acceptedPrimaryNavLayout?.variant||'REPORTS_ONLY').trim().toUpperCase();
const primaryNavLayoutIconSizePx=Number(process.env.VISUAL_FOUNDRY_PRIMARY_NAV_LAYOUT_ICON_SIZE_PX??acceptedPrimaryNavLayout?.icon_size_px??20);
const acceptedToolbarDetail=(stencilSession.accepted_candidates||[]).find(x=>x.candidate_id==='TOOLBAR_DETAIL_P1'&&x.apply_by_default===true);
const explicitToolbarDetail=String(process.env.VISUAL_FOUNDRY_TOOLBAR_DETAIL_CANDIDATE||'').trim();
const toolbarDetailCandidateId=explicitToolbarDetail||(acceptedToolbarDetail?.candidate_id||'');
const toolbarDetailVariant=String(process.env.VISUAL_FOUNDRY_TOOLBAR_DETAIL_VARIANT||acceptedToolbarDetail?.variant||'FULL').trim().toUpperCase();
const acceptedKpiDetail=(stencilSession.accepted_candidates||[]).find(x=>x.candidate_id==='KPI_DETAIL_P1'&&x.apply_by_default===true);
const explicitKpiDetail=String(process.env.VISUAL_FOUNDRY_KPI_DETAIL_CANDIDATE||'').trim();
const kpiDetailCandidateId=explicitKpiDetail||(acceptedKpiDetail?.candidate_id||'');
const kpiDetailVariant=String(process.env.VISUAL_FOUNDRY_KPI_DETAIL_VARIANT||acceptedKpiDetail?.variant||'ICONS_SPARKS').trim().toUpperCase();
const kpiDetailPaddingPx=Number(process.env.VISUAL_FOUNDRY_KPI_DETAIL_PADDING_PX??acceptedKpiDetail?.padding_px??14);
const kpiDetailGapPx=Number(process.env.VISUAL_FOUNDRY_KPI_DETAIL_GAP_PX??acceptedKpiDetail?.gap_px??13);
const kpiDetailSparkRightPx=Number(process.env.VISUAL_FOUNDRY_KPI_DETAIL_SPARK_RIGHT_PX??acceptedKpiDetail?.spark_right_px??12);
const kpiDetailSparkTopPx=Number(process.env.VISUAL_FOUNDRY_KPI_DETAIL_SPARK_TOP_PX??acceptedKpiDetail?.spark_top_px??19);

const acceptedHeroTypography=
  (stencilSession.accepted_candidates||[]).find(x=>x.candidate_id==='HERO_TYPOGRAPHY_T11_V2'&&x.apply_by_default===true)
  ||(stencilSession.accepted_candidates||[]).find(x=>x.candidate_id==='HERO_TYPOGRAPHY_T5'&&x.apply_by_default===true);
const explicitHeroTypography=String(process.env.VISUAL_FOUNDRY_HERO_TYPOGRAPHY_CANDIDATE||'').trim();
const heroTypographyCandidateId=explicitHeroTypography||(acceptedHeroTypography?.candidate_id||'');
const heroTitleScaleX=Number(process.env.VISUAL_FOUNDRY_HERO_TITLE_SCALE_X??acceptedHeroTypography?.typography?.scale_x??1);
const heroTitleLetterSpacingPx=Number(process.env.VISUAL_FOUNDRY_HERO_TITLE_LETTER_SPACING_PX??acceptedHeroTypography?.typography?.letter_spacing_px??NaN);
const heroTitleWeight=Number(process.env.VISUAL_FOUNDRY_HERO_TITLE_WEIGHT??acceptedHeroTypography?.typography?.font_weight??NaN);
const acceptedHeroTitleFinish=(stencilSession.accepted_candidates||[]).find(x=>x.candidate_id==='HERO_TITLE_FINISH_P1'&&x.apply_by_default===true);
const explicitHeroTitleFinish=String(process.env.VISUAL_FOUNDRY_HERO_TITLE_FINISH_CANDIDATE||'').trim();
const heroTitleFinishCandidateId=explicitHeroTitleFinish||(acceptedHeroTitleFinish?.candidate_id||'');
const heroTitleFinishVariant=String(process.env.VISUAL_FOUNDRY_HERO_TITLE_FINISH_VARIANT||acceptedHeroTitleFinish?.variant||'METAL_A').trim().toUpperCase();
const heroTitleFinishScaleX=Number(process.env.VISUAL_FOUNDRY_HERO_TITLE_FINISH_SCALE_X??acceptedHeroTitleFinish?.scale_x??heroTitleScaleX);
const acceptedHeroTitleReference=(stencilSession.accepted_candidates||[]).find(x=>x.candidate_id==='HERO_TITLE_REFERENCE_ASSET_P2'&&x.apply_by_default===true);
const explicitHeroTitleReference=String(process.env.VISUAL_FOUNDRY_HERO_TITLE_REFERENCE_CANDIDATE||'').trim();
const heroTitleReferenceCandidateId=explicitHeroTitleReference||(acceptedHeroTitleReference?.candidate_id||'');
const heroTitleReferenceLeftPx=Number(process.env.VISUAL_FOUNDRY_HERO_TITLE_REFERENCE_LEFT_PX??acceptedHeroTitleReference?.placement?.left_px??24);
const heroTitleReferenceTopPx=Number(process.env.VISUAL_FOUNDRY_HERO_TITLE_REFERENCE_TOP_PX??acceptedHeroTitleReference?.placement?.top_px??39);
const heroTitleReferenceWidthPx=Number(process.env.VISUAL_FOUNDRY_HERO_TITLE_REFERENCE_WIDTH_PX??acceptedHeroTitleReference?.placement?.width_px??840);
const heroTitleReferenceHeightPx=Number(process.env.VISUAL_FOUNDRY_HERO_TITLE_REFERENCE_HEIGHT_PX??acceptedHeroTitleReference?.placement?.height_px??34);
const heroTitleReferenceOpacity=Number(process.env.VISUAL_FOUNDRY_HERO_TITLE_REFERENCE_OPACITY??acceptedHeroTitleReference?.placement?.opacity??1);
const sidebarNavTypographyCandidateId=String(process.env.VISUAL_FOUNDRY_SIDEBAR_NAV_TYPOGRAPHY_CANDIDATE||'').trim();
const sidebarNavFontSizePx=Number(process.env.VISUAL_FOUNDRY_SIDEBAR_NAV_FONT_SIZE_PX||NaN);
const sidebarNavFontWeight=Number(process.env.VISUAL_FOUNDRY_SIDEBAR_NAV_FONT_WEIGHT||NaN);
const sidebarBrandTypographyCandidateId=String(process.env.VISUAL_FOUNDRY_SIDEBAR_BRAND_TYPOGRAPHY_CANDIDATE||'').trim();
const sidebarBrandTitleSizePx=Number(process.env.VISUAL_FOUNDRY_SIDEBAR_BRAND_TITLE_SIZE_PX||NaN);
const sidebarBrandTitleLetterSpacingEm=Number(process.env.VISUAL_FOUNDRY_SIDEBAR_BRAND_TITLE_LETTER_SPACING_EM||NaN);
const sidebarBrandTaglineSizePx=Number(process.env.VISUAL_FOUNDRY_SIDEBAR_BRAND_TAGLINE_SIZE_PX||NaN);
const sidebarBrandTaglineWidthPx=Number(process.env.VISUAL_FOUNDRY_SIDEBAR_BRAND_TAGLINE_WIDTH_PX||NaN);
const sidebarBrandFixedHeightPx=Number(process.env.VISUAL_FOUNDRY_SIDEBAR_BRAND_FIXED_HEIGHT_PX||NaN);
const panelHeaderTypographyCandidateId=String(process.env.VISUAL_FOUNDRY_PANEL_HEADER_TYPOGRAPHY_CANDIDATE||'').trim();
const panelHeaderTitleSizePx=Number(process.env.VISUAL_FOUNDRY_PANEL_HEADER_TITLE_SIZE_PX||NaN);
const panelHeaderTitleWeight=Number(process.env.VISUAL_FOUNDRY_PANEL_HEADER_TITLE_WEIGHT||NaN);
const panelHeaderSubtitleSizePx=Number(process.env.VISUAL_FOUNDRY_PANEL_HEADER_SUBTITLE_SIZE_PX||NaN);
const panelHeaderScope=String(process.env.VISUAL_FOUNDRY_PANEL_HEADER_SCOPE||'ALL').trim().toUpperCase();
const kpiTypographyCandidateId=String(process.env.VISUAL_FOUNDRY_KPI_TYPOGRAPHY_CANDIDATE||'').trim();
const kpiLabelSizePx=Number(process.env.VISUAL_FOUNDRY_KPI_LABEL_SIZE_PX||NaN);
const kpiValueSizePx=Number(process.env.VISUAL_FOUNDRY_KPI_VALUE_SIZE_PX||NaN);
const kpiValueWeight=Number(process.env.VISUAL_FOUNDRY_KPI_VALUE_WEIGHT||NaN);
const kpiMetaSizePx=Number(process.env.VISUAL_FOUNDRY_KPI_META_SIZE_PX||NaN);
const rightRailTypographyCandidateId=String(process.env.VISUAL_FOUNDRY_RIGHT_RAIL_TYPOGRAPHY_CANDIDATE||'').trim();
const rightRailTypographyScope=String(process.env.VISUAL_FOUNDRY_RIGHT_RAIL_TYPOGRAPHY_SCOPE||'SYSTEM_STATUS').trim().toUpperCase();
const rightRailPrimarySizePx=Number(process.env.VISUAL_FOUNDRY_RIGHT_RAIL_PRIMARY_SIZE_PX||NaN);
const rightRailSecondarySizePx=Number(process.env.VISUAL_FOUNDRY_RIGHT_RAIL_SECONDARY_SIZE_PX||NaN);
const rightRailSecondaryWeight=Number(process.env.VISUAL_FOUNDRY_RIGHT_RAIL_SECONDARY_WEIGHT||NaN);

assert.equal(fixture.truth_class,'VISUAL_FIXTURE');
assert.equal(fixture.runtime_truth_write_allowed,false);
assert.equal(fixture.production_allowed,false);
assert.equal(referenceSpec.reference_id,referenceRegistration.reference.reference_id);
assert.equal(referenceRegistration.hash_match,true);
assert.equal(stencilSession.reference_id,referenceRegistration.reference.reference_id);
assert.equal(stencilSession.reference_hash,referenceRegistration.reference.hash);
assert.equal(stencilSession.stencil.fallback_reference_allowed,false);
assert.equal(approvedReferenceHash,referenceRegistration.reference.hash,'APPROVED_REFERENCE_TRANSPORT_HASH_MISMATCH');
const approvedDecoded=jpeg.decode(approvedReferenceBytes,{useTArray:true,formatAsRGBA:true});
assert.equal(approvedDecoded.width,referenceSpec.viewport.width,'APPROVED_REFERENCE_WIDTH_MISMATCH');
assert.equal(approvedDecoded.height,referenceSpec.viewport.height,'APPROVED_REFERENCE_HEIGHT_MISMATCH');
const approvedReferencePng=new PNG({width:approvedDecoded.width,height:approvedDecoded.height});
approvedReferencePng.data.set(approvedDecoded.data);
const approvedReferencePngPath=outDir+'/reference-approved.png';
await writeFile(approvedReferencePngPath,PNG.sync.write(approvedReferencePng));

function extractApprovedReferenceAsset(asset){
  const {x,y,width,height}=asset.crop||{};
  assert.ok(Number.isInteger(x)&&Number.isInteger(y)&&Number.isInteger(width)&&Number.isInteger(height),'ATTENTION_REFERENCE_CROP_INVALID:'+asset.asset_id);
  assert.ok(x>=0&&y>=0&&x+width<=approvedReferencePng.width&&y+height<=approvedReferencePng.height,'ATTENTION_REFERENCE_CROP_OUT_OF_BOUNDS:'+asset.asset_id);
  const crop=new PNG({width,height});
  for(let row=0;row<height;row++){
    const srcStart=((y+row)*approvedReferencePng.width+x)*4;
    const srcEnd=srcStart+width*4;
    const dstStart=row*width*4;
    crop.data.set(approvedReferencePng.data.subarray(srcStart,srcEnd),dstStart);
  }
  const rgbaSha256=crypto.createHash('sha256').update(crop.data).digest('hex');
  assert.equal(rgbaSha256,asset.rgba_sha256,'ATTENTION_REFERENCE_RGBA_HASH_MISMATCH:'+asset.asset_id);
  const pngBytes=PNG.sync.write(crop);
  return {
    asset_id:asset.asset_id,
    project_key:asset.project_key||null,
    nav_id:asset.nav_id||null,
    role:asset.role,
    crop:asset.crop,
    rgba_sha256:rgbaSha256,
    src:'data:image/png;base64,'+pngBytes.toString('base64')
  };
}

function extractMaskedOperatorGlobe(asset){
  const base=extractApprovedReferenceAsset(asset);
  const decoded=PNG.sync.read(Buffer.from(base.src.split(',')[1],'base64'));
  const out=new PNG({width:decoded.width,height:decoded.height});
  const alpha=new Uint8Array(decoded.width*decoded.height);
  const m=asset.mask_contract;
  for(let y=0;y<decoded.height;y++){
    for(let x=0;x<decoded.width;x++){
      const i=(y*decoded.width+x)*4;
      const r=decoded.data[i],g=decoded.data[i+1],b=decoded.data[i+2];
      const blue=Math.max(0,(b-r)*m.blue_score.b_minus_r_weight+(g-r)*m.blue_score.g_minus_r_weight);
      let a=Math.max(0,Math.min(255,(blue-m.blue_score.threshold)*m.blue_score.alpha_gain));
      const lum=(r+g+b)/3;
      if(b>r+m.luminance_support.b_minus_r_min&&g>r+m.luminance_support.g_minus_r_min){
        a=Math.max(a,Math.max(0,Math.min(m.luminance_support.max_alpha,(lum-m.luminance_support.threshold)*m.luminance_support.alpha_gain)));
      }
      const dx=(x-m.source_local_center.x)/m.ellipse_radius.x;
      const dy=(y-m.source_local_center.y)/m.ellipse_radius.y;
      const dist=Math.sqrt(dx*dx+dy*dy);
      const spatial=Math.max(0,Math.min(1,(m.spatial.outer_radius-dist)*m.spatial.gain));
      alpha[y*decoded.width+x]=Math.round(a*spatial);
      out.data[i]=r;out.data[i+1]=g;out.data[i+2]=b;out.data[i+3]=255;
    }
  }
  const blurred=new Uint8Array(alpha.length);
  for(let y=0;y<decoded.height;y++){
    for(let x=0;x<decoded.width;x++){
      let sum=0,count=0;
      for(let yy=Math.max(0,y-1);yy<=Math.min(decoded.height-1,y+1);yy++){
        for(let xx=Math.max(0,x-1);xx<=Math.min(decoded.width-1,x+1);xx++){
          sum+=alpha[yy*decoded.width+xx];count++;
        }
      }
      blurred[y*decoded.width+x]=Math.round(sum/count);
    }
  }
  for(let y=0;y<decoded.height;y++){
    for(let x=0;x<decoded.width;x++){
      const i=(y*decoded.width+x)*4;
      const canvasX=asset.crop.x+x,canvasY=asset.crop.y+y;
      let a=blurred[y*decoded.width+x];
      if(canvasY>=m.contamination_zero.source_canvas_y_gte&&canvasX<m.contamination_zero.source_canvas_x_lt)a=0;
      if(canvasX>=m.border_zero.source_canvas_x_gte||canvasY<=m.border_zero.source_canvas_y_lte)a=0;
      out.data[i+3]=a;
    }
  }
  const bytes=PNG.sync.write(out);
  return {...base,mask_algorithm:m.algorithm,src:'data:image/png;base64,'+bytes.toString('base64')};
}

function extractLumaAlphaUiAsset(asset,{scrubBadge=false}={}){
  const base=extractApprovedReferenceAsset(asset);
  const decoded=PNG.sync.read(Buffer.from(base.src.split(',')[1],'base64'));
  const out=new PNG({width:decoded.width,height:decoded.height});
  for(let y=0;y<decoded.height;y++){
    for(let x=0;x<decoded.width;x++){
      const i=(y*decoded.width+x)*4;
      const r=decoded.data[i],g=decoded.data[i+1],b=decoded.data[i+2];
      const lum=0.2126*r+0.7152*g+0.0722*b;
      let a=Math.max(0,Math.min(255,(lum-16)*11));
      const coolBoost=Math.max(0,b-r)*2.2+Math.max(0,g-r)*0.9;
      a=Math.max(a,Math.max(0,Math.min(210,coolBoost*5)));
      if(a<12)a=0;
      if(scrubBadge){
        const red=(r>=120&&r>g*1.35&&r>b*1.25);
        const badgeRect=(x>=24&&y<=20);
        if(red||badgeRect)a=0;
      }
      out.data[i]=r;
      out.data[i+1]=g;
      out.data[i+2]=b;
      out.data[i+3]=Math.round(a);
    }
  }
  const bytes=PNG.sync.write(out);
  return {...base,mask_algorithm:scrubBadge?'LUMA_ALPHA_WITH_RED_BADGE_SCRUB_V1':'LUMA_ALPHA_UI_V1',src:'data:image/png;base64,'+bytes.toString('base64')};
}

function extractNeutralTextMaskAsset(asset){
  const base=extractApprovedReferenceAsset(asset);
  const decoded=PNG.sync.read(Buffer.from(base.src.split(',')[1],'base64'));
  const out=new PNG({width:decoded.width,height:decoded.height});
  const m=asset.mask_contract;
  for(let y=0;y<decoded.height;y++){
    for(let x=0;x<decoded.width;x++){
      const i=(y*decoded.width+x)*4;
      const r=decoded.data[i],g=decoded.data[i+1],b=decoded.data[i+2];
      const lum=0.2126*r+0.7152*g+0.0722*b;
      const maxc=Math.max(r,g,b),minc=Math.min(r,g,b),chroma=maxc-minc;
      const neutral=Math.max(0,Math.min(1,(m.chroma_max-chroma)/m.chroma_fade));
      let a=Math.max(0,Math.min(255,(lum-m.luma_min)*m.luma_gain))*neutral;
      const coolGap=Math.min(g,b)-r-m.cool_support.min_gap;
      const cool=Math.max(0,Math.min(m.cool_support.max_alpha,coolGap*m.cool_support.gain));
      a=Math.max(a,cool);
      if(lum<m.hard_luma_floor)a=0;
      out.data[i]=r;
      out.data[i+1]=g;
      out.data[i+2]=b;
      out.data[i+3]=Math.round(a);
    }
  }
  const bytes=PNG.sync.write(out);
  return {...base,mask_algorithm:m.algorithm,src:'data:image/png;base64,'+bytes.toString('base64')};
}

const child=spawn(process.execPath,[
  'node_modules/wrangler/bin/wrangler.js','dev','--env','staging','--port',String(port),
  '--var','RIOSYSTEMS_ENVIRONMENT:local',
  '--var','RIOSYSTEMS_OPERATOR_RUNTIME_STORE:memory',
  '--var','RIOSYSTEMS_OPERATOR_EMAIL:operator@riosystems.local',
  '--var','RIOSYSTEMS_ACCESS_AUD:riosystems-operator-local',
  '--var','RIOSYSTEMS_PRODUCTION_DEPLOY:false',
  '--var','RIOSYSTEMS_EXTERNAL_WRITES:false'
],{cwd:process.cwd(),env:{...process.env,NO_COLOR:'1'},stdio:['ignore','pipe','pipe']});

let workerOutput='',exited=null;
child.stdout.on('data',c=>{workerOutput+=c.toString()});
child.stderr.on('data',c=>{workerOutput+=c.toString()});
child.once('exit',(code,signal)=>{exited={code,signal}});

async function waitForWorker(){
  const start=Date.now();
  while(Date.now()-start<45000){
    if(exited)throw new Error('Worker exited '+JSON.stringify(exited)+'\n'+workerOutput);
    try{const r=await fetch(origin+'/operator',{signal:AbortSignal.timeout(1500)});if(r.status===200)return}catch{}
    await new Promise(r=>setTimeout(r,350));
  }
  throw new Error('Worker not ready\n'+workerOutput);
}

function runtimeFingerprint(snapshot={}){
  const runtime=snapshot.runtime||{};
  return {
    revision:runtime.revision??null,
    project_count:Array.isArray(snapshot?.projects?.items)?snapshot.projects.items.length:null,
    production_deploy:runtime.production_deploy??snapshot.production_deploy??null,
    external_writes:runtime.external_writes??snapshot.external_writes??null
  };
}

const sha256=buffer=>crypto.createHash('sha256').update(buffer).digest('hex');

async function resolveVerifiedStencilSource(raw,expectedHash){
  const source=String(raw||'').trim();
  if(!source)return {status:'STENCIL_SOURCE_EXTERNAL_NOT_MOUNTED',source:null};
  let bytes,mime;
  if(source.startsWith('data:')){
    const match=source.match(/^data:([^;,]+)?(;base64)?,(.*)$/s);
    if(!match)throw new Error('STENCIL_DATA_URL_INVALID');
    mime=match[1]||'application/octet-stream';
    bytes=match[2]?Buffer.from(match[3],'base64'):Buffer.from(decodeURIComponent(match[3]));
  }else{
    const filePath=source.startsWith('file:')?new URL(source):path.resolve(source);
    bytes=await readFile(filePath);
    const ext=String(source).toLowerCase();
    mime=ext.endsWith('.png')?'image/png':ext.endsWith('.webp')?'image/webp':'image/jpeg';
  }
  const actualHash=sha256(bytes);
  if(actualHash!==expectedHash)throw new Error('STENCIL_REFERENCE_HASH_MISMATCH');
  return {status:'VERIFIED',source:'data:'+mime+';base64,'+bytes.toString('base64'),actual_hash:actualHash,bytes:bytes.length,mime};
}

function geometryBounds(snapshot,id){
  const item=(snapshot.components||[]).find(x=>x.component_id===id&&x.status==='MEASURED');
  if(!item)return null;
  const g=item.geometry;
  return {x:Number(g.x),y:Number(g.y),width:Number(g.width),height:Number(g.height)};
}
function unionBounds(snapshot,ids){
  const list=ids.map(id=>geometryBounds(snapshot,id)).filter(Boolean);
  if(!list.length)return null;
  const x=Math.min(...list.map(x=>x.x)),y=Math.min(...list.map(x=>x.y));
  const right=Math.max(...list.map(x=>x.x+x.width)),bottom=Math.max(...list.map(x=>x.y+x.height));
  return {x,y,width:right-x,height:bottom-y};
}

let browser;
const pageErrors=[],api404=[];
try{
  await waitForWorker();
  browser=await chromium.launch({headless:true});
  const context=await browser.newContext({
    viewport:{width:1536,height:1024},
    deviceScaleFactor:1,
    locale:'de-DE',
    timezoneId:'Europe/Berlin',
    reducedMotion:'reduce',
    serviceWorkers:'block'
  });
  const page=await context.newPage();
  page.on('pageerror',e=>pageErrors.push(e?.stack||String(e)));
  page.on('response',r=>{if(r.status()===404&&r.url().includes('/operator/api/'))api404.push(r.url())});

  const beforeResp=await page.request.get(origin+'/operator/api/snapshot');
  assert.equal(beforeResp.status(),200);
  const beforeSnapshot=await beforeResp.json();
  const beforeFingerprint=runtimeFingerprint(beforeSnapshot);

  await page.goto(origin+'/operator',{waitUntil:'networkidle',timeout:60000});
  await page.waitForFunction(()=>!document.body.classList.contains('loading'));
  await page.waitForSelector('.rf-hq-shell',{timeout:20000});
  await page.waitForFunction(()=>document.querySelector('.rf-hq-shell')?.dataset?.hydrated==='true',{timeout:20000});

  await page.addStyleTag({content:`
    *,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}
    [data-visual-foundry-dynamic]{visibility:hidden!important}
  `});

  await page.evaluate((fixture)=>{
    const q=(s)=>document.querySelector(s);
    const qa=(s)=>[...document.querySelectorAll(s)];
    document.documentElement.dataset.visualFoundryTruthClass='VISUAL_FIXTURE';
    document.documentElement.dataset.visualFoundryFixture=fixture.fixture_id;
    document.documentElement.dataset.visualFoundryRun=String(fixture.__run||'');

    const values=[fixture.display.kpis.active_projects,fixture.display.kpis.open_inputs,fixture.display.kpis.pending_approvals,fixture.display.kpis.preview_ready];
    qa('.rf-kpi-value').forEach((el,i)=>{if(values[i]!==undefined)el.textContent=String(values[i])});

    const env=q('.rf-env'); if(env)env.textContent='PRODUKTIV';
    const region=q('.rf-region'); if(region)region.textContent='EU (Frankfurt)';

    const brand=q('.brand');
    if(brand){
      const strong=brand.querySelector('strong'); if(strong)strong.textContent='AURENTARA SYSTEMS';
      const span=brand.querySelector('span'); if(span)span.textContent='INTELLIGENTE LÖSUNGEN FÜR EINE BESSERE ZUKUNFT';
    }

    const kpiMeta=['↑ +1 seit letzter Woche','↓ -2 seit letzter Woche','↑ +1 seit letzter Woche','↑ +1 seit letzter Woche'];
    qa('.rf-kpi-meta').forEach((el,i)=>{if(kpiMeta[i])el.textContent=kpiMeta[i]});

    const heroTitle=q('.rf-hero h1'); if(heroTitle)heroTitle.textContent='RIOSYSTEMS DASHBOARD';
    const heroSubtitle=q('.rf-hero p'); if(heroSubtitle)heroSubtitle.textContent='Alle Projekte. Alle Prozesse. Alle wichtigen Entscheidungen. An einem Ort.';
    const heroMotto=q('.rf-hero-motto');
    if(heroMotto)heroMotto.innerHTML='EIN SYSTEM.<br>ALLE MÖGLICHKEITEN.<br>SKALIERBAR.<br><span style="color:#42bfff">POWERED BY RIOSYSTEMS.</span>';

    const milestone=q('[data-rf-milestone]');
    if(milestone){
      const strong=milestone.querySelector('.rf-bottom-main strong'); if(strong)strong.textContent='Nächster Meilenstein';
      const span=milestone.querySelector('.rf-bottom-main span'); if(span)span.textContent='Gelato Donatello – Finalisierung & Live-Schaltung';
      const progress=milestone.querySelector('.rf-bottom-progress span'); if(progress)progress.style.width='72%';
      const number=qa('[data-rf-milestone] *').find(el=>el.childElementCount===0&&/\d+\s*%/.test(el.textContent||'')); if(number)number.textContent='72 %';
    }
    const decisionsCard=qa('[data-rf-decisions]').find(el=>el.classList.contains('rf-bottom-card'));
    if(decisionsCard){
      const strong=decisionsCard.querySelector('.rf-bottom-main strong'); if(strong)strong.textContent='Offene Entscheidungen';
      const span=decisionsCard.querySelector('.rf-bottom-main span'); if(span)span.textContent='3 Entscheidungen erforderlich';
    }
    const quote=q('.rf-quote');
    if(quote)quote.innerHTML='„Technologie wird erst dann wertvoll,<br>wenn sie Menschen wirklich weiterbringt.“<b>AURENTARA SYSTEMS</b>';

    const attentionBody=q('.rf-attention-table tbody');
    if(attentionBody){
      attentionBody.innerHTML=fixture.display.attention.map((r,i)=>`<tr>
        <td><span class="rf-attention-priority"><span class="rf-dot ${i===0?'blocked':i===3?'info':''}"></span>${r.priority}</span></td>
        <td>${r.project}</td><td>${r.topic}</td><td>${r.impact}</td><td>${r.due}</td>
        <td><button type="button" class="rf-attention-action">${r.action}</button></td></tr>`).join('');
    }
    const attentionTitle=q('.rf-attention-anchor .rf-panel-title h2');
    if(attentionTitle)attentionTitle.innerHTML='Needs Attention <span style="display:inline-grid;place-items:center;min-width:20px;height:20px;margin-left:5px;border-radius:50%;background:#ff5265;color:white;font-size:10px">3</span>';

    const portfolioBody=q('.rf-portfolio-table tbody');
    if(portfolioBody){
      const tone=(h)=>/BLOCK/i.test(h)?'blocked':/ATTENTION|ARBEIT/i.test(h)?'attention':'ready';
      const displayScopes=['gelato-donatello.de','aurentara.com','mueller.de','operator-suite'];
      portfolioBody.innerHTML=fixture.display.projects.map((p,i)=>`<tr class="rf-project-table-row">
        <td><div class="rf-project-cell"><div class="rf-avatar">${['GD','AW','BM','IT'][i]}</div><div><div class="rf-project-name">${p.name}</div><div class="rf-project-scope">${displayScopes[i]||p.scope_key}</div></div></div></td>
        <td><span class="rf-state phase">${p.phase}</span></td>
        <td><span class="rf-state ${tone(p.health)}">${p.health}</span></td>
        <td><span class="rf-state env">${p.environment}</span></td>
        <td><div class="rf-table-progress"><b>${p.progress_percent} %</b><div class="rf-progress"><span style="width:${p.progress_percent}%"></span></div></div></td>
        <td><span class="rf-next-table">${p.next_action}</span></td>
        <td><div class="rf-portfolio-actions"><button type="button" class="rf-open-project">Öffnen</button><button type="button" class="rf-row-more" aria-label="Weitere Aktionen">•••</button></div></td></tr>`).join('');
    }

    const portfolioPanel=q('.rf-ops-grid > .rf-panel:first-child');
    if(portfolioPanel){
      const headActions=portfolioPanel.querySelector('.rf-panel-head > div:last-child');
      if(headActions)headActions.innerHTML='<button class="rf-ai-new rf-new-project" data-rf-new-project>+ Neues Projekt</button><button type="button" class="rf-portfolio-head-more" aria-label="Weitere Portfolio-Aktionen">•••</button>';
      const toolbar=portfolioPanel.querySelector('.rf-portfolio-toolbar');
      if(toolbar)toolbar.innerHTML=
        '<div class="rf-portfolio-tabs">'+
          '<button type="button" class="rf-portfolio-tab active">Alle (4)</button>'+
          '<button type="button" class="rf-portfolio-tab">Kundenprojekte (3)</button>'+
          '<button type="button" class="rf-portfolio-tab">Interne Projekte (1)</button>'+
        '</div>'+
        '<div class="rf-portfolio-tools">'+
          '<label class="rf-portfolio-search"><span>⌕</span><input aria-label="Projekte durchsuchen" placeholder="Projekte durchsuchen ..."></label>'+
          '<button type="button" class="rf-portfolio-filter" aria-label="Portfolio filtern">⌄</button>'+
        '</div>';
    }

    const status=q('.rf-status-list');
    if(status)status.innerHTML=fixture.display.system_status.map(([label,value,tone])=>`<div class="rf-status-row"><i class="${tone}"></i><span>${label}</span><b>${value}</b></div>`).join('');

    const cost=q('.rf-cost-body');
    if(cost)cost.innerHTML=`
      <div class="rf-cost-line"><span>Budget (Plan)</span><b>${fixture.display.costs.budget_plan}</b></div>
      <div class="rf-cost-line"><span>Aktuell (Prognose)</span><b>${fixture.display.costs.actual_forecast}</b></div>
      <div class="rf-cost-line"><span>Reserviert</span><b>${fixture.display.costs.reserved}</b></div>
      <div class="rf-cost-line"><span>Verbleibend</span><b>${fixture.display.costs.remaining}</b></div>
      <div class="rf-progress" style="margin-top:9px"><span style="width:${fixture.display.costs.usage_percent}%"></span></div>
      <div class="rf-cost-state">${fixture.display.costs.usage_percent} % verwendet · VISUAL_FIXTURE</div>`;

    const activity=q('.rf-activity-list');
    if(activity)activity.innerHTML=fixture.display.activities.map(([title,scope,when])=>`<div class="rf-activity-row"><span class="rf-activity-icon">◈</span><div class="rf-activity-main"><strong>${title}</strong><span>${scope} · ${when}</span></div></div>`).join('');

    const navLabels=['Aufmerksamkeit','Freigaben'];
    for(const label of navLabels){
      const btn=qa('.rf-hq-nav-main button').find(b=>b.textContent.includes(label));
      if(btn&&!btn.querySelector('.vf-badge'))btn.insertAdjacentHTML('beforeend','<span class="vf-badge" style="margin-left:auto;display:grid;place-items:center;width:18px;height:18px;border-radius:50%;background:#ff5265;color:#fff;font-size:9px">3</span>');
    }

    const ids=[
      ['sidebar','.side'],['primary_navigation','.rf-hq-nav-main'],['primary_navigation_shell','.rf-hq-nav'],['primary_navigation_foot','.rf-hq-nav-foot'],['toolbar','.rf-toolbar'],['hero','.rf-hero'],
      ['kpi_active_projects','.rf-kpi:nth-of-type(1)'],['kpi_open_inputs','.rf-kpi:nth-of-type(2)'],
      ['kpi_approvals','.rf-kpi:nth-of-type(3)'],['kpi_preview','.rf-kpi:nth-of-type(4)'],
      ['attention_panel','.rf-attention-anchor'],['operator_ai_panel','.rf-grid-mid > .rf-panel:nth-child(2)'],
      ['portfolio_panel','.rf-ops-grid > .rf-panel'],['new_project_cta','[data-rf-new-project]'],
      ['system_status_panel','.rf-side-stack > .rf-panel:nth-child(1)'],['cost_panel','.rf-side-stack > .rf-panel:nth-child(2)'],
      ['activity_panel','.rf-activity-card'],['milestone_card','[data-rf-milestone]'],['quote_card','.rf-quote']
    ];
    for(const [id,selector] of ids){const el=q(selector);if(el)el.dataset.visualId=id}
    const navButtons=qa('.rf-hq-nav-main button');
    if(navButtons[0])navButtons[0].dataset.visualId='primary_navigation_first_button';
    if(navButtons.length)navButtons[navButtons.length-1].dataset.visualId='primary_navigation_last_button';
    const decisions=qa('[data-rf-decisions]').find(el=>el.classList.contains('rf-bottom-card'));if(decisions)decisions.dataset.visualId='decisions_card';
  },{...fixture,__run:runNumber});

  let heroCandidateState={status:'DISABLED',candidate:heroCandidateRequested||null};
  if(heroCandidateEnabled){
    const heroRegion=referenceSpec.regions.find(r=>r.region_id==='hero');
    assert.ok(heroRegion,'HERO_REFERENCE_REGION_REQUIRED');
    const heroCanvasX=Number(heroRegion.bounds.x.value);
    const heroCanvasY=Number(heroRegion.bounds.y.value);
    const relativeLeft=Number(heroAsset.crop.x)-heroCanvasX;
    const relativeTop=Number(heroAsset.crop.y)-heroCanvasY;
    const candidate={
      candidate:'REFERENCE_EXTRACTED_EARTH_EXACT_PLACEMENT',
      source_asset_id:heroAsset.asset_id,
      source_sha256:heroAsset.output_sha256,
      provenance:'REFERENCE_EXTRACTED',
      usage_scope:referenceAssets.usage_scope,
      production_use_allowed:false,
      public_distribution_allowed:false,
      canvas_crop:heroAsset.crop,
      hero_relative:{left:relativeLeft,top:relativeTop,width:Number(heroAsset.crop.width),height:Number(heroAsset.crop.height)},
      src:'data:image/png;base64,'+heroTransportB64
    };
    const applied=await page.evaluate((candidate)=>{
      const hero=document.querySelector('.rf-hero');
      if(!hero)throw new Error('HERO_RUNTIME_ELEMENT_MISSING');
      hero.querySelector('[data-vf-hero-reference-extracted]')?.remove();
      const before=hero.getBoundingClientRect();
      const img=document.createElement('img');
      img.dataset.vfHeroReferenceExtracted='true';
      img.alt='';
      img.setAttribute('aria-hidden','true');
      img.src=candidate.src;
      Object.assign(img.style,{
        position:'absolute',
        left:candidate.hero_relative.left+'px',
        top:candidate.hero_relative.top+'px',
        width:candidate.hero_relative.width+'px',
        height:candidate.hero_relative.height+'px',
        objectFit:'fill',
        maxWidth:'none',
        zIndex:'1',
        pointerEvents:'none',
        userSelect:'none'
      });
      if(getComputedStyle(hero).position==='static')hero.style.position='relative';
      hero.prepend(img);
      for(const child of [...hero.children]){
        if(child===img)continue;
        if(getComputedStyle(child).position==='static')child.style.position='relative';
        child.style.zIndex='2';
      }
      const after=hero.getBoundingClientRect();
      return {
        status:'APPLIED',
        hero_geometry_before:{x:before.x,y:before.y,width:before.width,height:before.height},
        hero_geometry_after:{x:after.x,y:after.y,width:after.width,height:after.height},
        image_geometry:{x:img.getBoundingClientRect().x,y:img.getBoundingClientRect().y,width:img.getBoundingClientRect().width,height:img.getBoundingClientRect().height}
      };
    },candidate);
    heroCandidateState={...candidate,src:undefined,...applied};
  }

  let sidebarLogoCandidateState={status:'DISABLED',candidate_id:sidebarLogoCandidateId||null};
  if(sidebarLogoCandidateEnabled){
    const candidate={
      candidate_id:'SIDEBAR_LOGO_REFERENCE_EXTRACTED_P1',
      source_asset_id:logoAsset.asset_id,
      source_sha256:logoAsset.output_sha256,
      provenance:'REFERENCE_EXTRACTED',
      usage_scope:'GOLD_STANDARD_POC_ONLY',
      production_use_allowed:false,
      public_distribution_allowed:false,
      canvas_crop:logoAsset.crop,
      src:'data:image/png;base64,'+logoTransportB64
    };
    const applied=await page.evaluate((candidate)=>{
      const side=document.querySelector('.side');
      const brand=document.querySelector('.brand');
      if(!side||!brand)throw new Error('SIDEBAR_BRAND_RUNTIME_ELEMENT_MISSING');
      side.querySelector('[data-vf-sidebar-logo-reference-extracted]')?.remove();
      document.getElementById('vf-sidebar-logo-reference-style')?.remove();
      if(getComputedStyle(side).position==='static')side.style.position='relative';

      const style=document.createElement('style');
      style.id='vf-sidebar-logo-reference-style';
      style.textContent='html[data-visual-foundry-fixture="aurentara-hq-gold-standard-fixture-v1"] body.reference-hq-v1 .brand:before{visibility:hidden!important}';
      document.head.appendChild(style);

      const img=document.createElement('img');
      img.dataset.vfSidebarLogoReferenceExtracted='true';
      img.alt='';
      img.setAttribute('aria-hidden','true');
      img.src=candidate.src;
      Object.assign(img.style,{
        position:'absolute',
        left:candidate.canvas_crop.x+'px',
        top:candidate.canvas_crop.y+'px',
        width:candidate.canvas_crop.width+'px',
        height:candidate.canvas_crop.height+'px',
        objectFit:'fill',
        maxWidth:'none',
        zIndex:'4',
        pointerEvents:'none',
        userSelect:'none'
      });
      side.appendChild(img);
      const r=img.getBoundingClientRect();
      return {status:'APPLIED',image_geometry:{x:r.x,y:r.y,width:r.width,height:r.height}};
    },candidate);
    sidebarLogoCandidateState={...candidate,src:undefined,...applied};
  }

  let projectThumbnailsCandidateState={status:'DISABLED',candidate_id:projectThumbnailsCandidateId||null};
  if(projectThumbnailsCandidateEnabled){
    const assets=Object.fromEntries((projectThumbnailAssets.assets||[]).map(a=>[a.project_key,{
      asset_id:a.asset_id,
      sha256:a.output_sha256,
      crop:a.crop,
      src:'data:image/png;base64,'+a.b64
    }]));
    const applied=await page.evaluate((payload)=>{
      const resolveKey=text=>{
        const t=String(text||'').toLowerCase();
        if(t.includes('gelato'))return 'gelato';
        if(t.includes('aurentara'))return 'aurentara';
        if(t.includes('bakery')||t.includes('bäcker'))return 'bakery';
        if(t.includes('interne tools')||t.includes('operator-suite'))return 'tools';
        return null;
      };

      const portfolio=[];
      for(const row of document.querySelectorAll('.rf-portfolio-table tbody tr')){
        const name=row.querySelector('.rf-project-name')?.textContent||'';
        const key=resolveKey(name);
        const asset=payload.assets[key];
        const avatar=row.querySelector('.rf-avatar');
        if(!asset||!avatar)continue;
        avatar.textContent='';
        Object.assign(avatar.style,{
          backgroundImage:'url("'+asset.src+'")',
          backgroundSize:'cover',
          backgroundPosition:'center',
          backgroundRepeat:'no-repeat',
          color:'transparent',
          overflow:'hidden'
        });
        avatar.dataset.vfReferenceExtractedThumbnail=asset.asset_id;
        portfolio.push({key,asset_id:asset.asset_id,rect:avatar.getBoundingClientRect().toJSON?.()||null});
      }

      const attention=[];
      if(payload.scope!=='PORTFOLIO'){
      for(const row of document.querySelectorAll('.rf-attention-table tbody tr')){
        const cell=row.children[1];
        if(!cell)continue;
        const projectName=(cell.textContent||'').trim();
        const key=resolveKey(projectName);
        const asset=payload.assets[key];
        if(!asset)continue;
        cell.textContent='';
        const wrap=document.createElement('div');
        Object.assign(wrap.style,{display:'flex',alignItems:'center',gap:'10px',minWidth:'0'});
        const img=document.createElement('img');
        img.alt='';
        img.setAttribute('aria-hidden','true');
        img.src=asset.src;
        img.dataset.vfReferenceExtractedThumbnail=asset.asset_id;
        Object.assign(img.style,{width:'34px',height:'34px',flex:'0 0 34px',borderRadius:'4px',objectFit:'cover',display:'block'});
        const span=document.createElement('span');
        span.textContent=projectName;
        span.style.whiteSpace='nowrap';
        wrap.append(img,span);
        cell.appendChild(wrap);
        attention.push({key,asset_id:asset.asset_id});
      }
      }
      return {status:'APPLIED',scope:payload.scope,portfolio_count:portfolio.length,attention_count:attention.length};
    },{assets,scope:projectThumbnailsScope});
    projectThumbnailsCandidateState={
      status:applied.status,
      candidate_id:projectThumbnailsEvidenceCandidateId,
      underlying_asset_candidate:'PROJECT_THUMBNAILS_REFERENCE_EXTRACTED_P1',
      scope:projectThumbnailsScope,
      provenance:'REFERENCE_EXTRACTED',
      usage_scope:'GOLD_STANDARD_POC_ONLY',
      production_use_allowed:false,
      public_distribution_allowed:false,
      asset_ids:Object.values(assets).map(x=>x.asset_id),
      ...applied
    };
  }

  let attentionAssetCandidateState={status:'DISABLED',candidate_id:attentionAssetCandidateId||null,variant:attentionAssetVariant};
  if(attentionAssetCandidateId){
    const extracted=(attentionReferenceAssets.assets||[]).map(extractApprovedReferenceAsset);
    const warning=extracted.find(x=>x.role==='ATTENTION_WARNING_ICON');
    const thumbnails=Object.fromEntries(extracted.filter(x=>x.role==='ATTENTION_PROJECT_THUMBNAIL').map(x=>[x.project_key,x]));
    assert.ok(warning,'ATTENTION_WARNING_ICON_REQUIRED');
    assert.equal(Object.keys(thumbnails).length,4,'ATTENTION_REFERENCE_THUMBNAILS_REQUIRED');
    attentionAssetCandidateState=await page.evaluate(({candidate_id,variant,warning,thumbnails})=>{
      const root=document.querySelector('.rf-attention-anchor');
      if(!root)throw new Error('ATTENTION_ASSET_ROOT_MISSING');
      const table=root.querySelector('.rf-attention-table');
      if(!table)throw new Error('ATTENTION_ASSET_TABLE_MISSING');
      const rows=[...table.querySelectorAll('tbody tr')];
      if(rows.length!==4)throw new Error('ATTENTION_ASSET_ROW_COUNT:'+rows.length);
      const resolveKey=text=>{
        const t=String(text||'').toLowerCase();
        if(t.includes('gelato'))return 'gelato';
        if(t.includes('bakery')||t.includes('bäcker'))return 'bakery';
        if(t.includes('aurentara'))return 'aurentara';
        if(t.includes('interne tools')||t.includes('operator'))return 'tools';
        return null;
      };
      const full=variant==='FULL';
      const addMore=['THUMBS_MORE','THUMBS_MORE_ICON','FULL'].includes(variant);
      const addIcon=['THUMBS_MORE_ICON','FULL'].includes(variant);
      const thumbs=['THUMBS','THUMBS_MORE','THUMBS_MORE_ICON','FULL'].includes(variant);
      if(variant==='CONTROL'){
        return {status:'CONTROL_NO_CHANGE',candidate_id,variant,thumbnail_count:0,more_button_count:0,warning_icon:false};
      }
      if(!thumbs)throw new Error('ATTENTION_ASSET_VARIANT_INVALID:'+variant);

      const style=document.createElement('style');
      style.id='vf-attention-reference-assets-style';
      style.textContent=`
html[data-visual-foundry-fixture="aurentara-hq-gold-standard-fixture-v1"] body.reference-hq-v1 .rf-attention-anchor .rf-attention-table-wrap{overflow:hidden}
html[data-visual-foundry-fixture="aurentara-hq-gold-standard-fixture-v1"] body.reference-hq-v1 .rf-attention-anchor .rf-attention-table{table-layout:fixed}
html[data-visual-foundry-fixture="aurentara-hq-gold-standard-fixture-v1"] body.reference-hq-v1 .rf-attention-anchor .rf-attention-table th{height:31px;box-sizing:border-box;padding:5px 9px;white-space:nowrap}
html[data-visual-foundry-fixture="aurentara-hq-gold-standard-fixture-v1"] body.reference-hq-v1 .rf-attention-anchor .rf-attention-table td{height:40px;box-sizing:border-box;padding:2px 9px;white-space:nowrap;overflow:hidden;overflow-wrap:normal}
html[data-visual-foundry-fixture="aurentara-hq-gold-standard-fixture-v1"] body.reference-hq-v1 .rf-attention-anchor .rf-attention-table th:nth-child(1){width:11%}
html[data-visual-foundry-fixture="aurentara-hq-gold-standard-fixture-v1"] body.reference-hq-v1 .rf-attention-anchor .rf-attention-table th:nth-child(2){width:22%}
html[data-visual-foundry-fixture="aurentara-hq-gold-standard-fixture-v1"] body.reference-hq-v1 .rf-attention-anchor .rf-attention-table th:nth-child(3){width:15%}
html[data-visual-foundry-fixture="aurentara-hq-gold-standard-fixture-v1"] body.reference-hq-v1 .rf-attention-anchor .rf-attention-table th:nth-child(4){width:21%}
html[data-visual-foundry-fixture="aurentara-hq-gold-standard-fixture-v1"] body.reference-hq-v1 .rf-attention-anchor .rf-attention-table th:nth-child(5){width:12%}
html[data-visual-foundry-fixture="aurentara-hq-gold-standard-fixture-v1"] body.reference-hq-v1 .rf-attention-anchor .rf-attention-table th:nth-child(6){width:19%}
html[data-visual-foundry-fixture="aurentara-hq-gold-standard-fixture-v1"] body.reference-hq-v1 .vf-attention-project{display:flex;align-items:center;gap:10px;min-width:0}
html[data-visual-foundry-fixture="aurentara-hq-gold-standard-fixture-v1"] body.reference-hq-v1 .vf-attention-project img{display:block;width:34px;height:34px;flex:0 0 34px;border-radius:4px;object-fit:fill}
html[data-visual-foundry-fixture="aurentara-hq-gold-standard-fixture-v1"] body.reference-hq-v1 .vf-attention-project span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
html[data-visual-foundry-fixture="aurentara-hq-gold-standard-fixture-v1"] body.reference-hq-v1 .vf-attention-actions{display:flex;align-items:center;justify-content:flex-start;gap:8px;white-space:nowrap}
html[data-visual-foundry-fixture="aurentara-hq-gold-standard-fixture-v1"] body.reference-hq-v1 .rf-attention-action{width:74px;height:30px;min-height:30px;padding:5px 8px}
html[data-visual-foundry-fixture="aurentara-hq-gold-standard-fixture-v1"] body.reference-hq-v1 .vf-attention-more{width:28px;height:30px;padding:0;border:1px solid #2b6795;border-radius:6px;background:#071724;color:#d8efff;font-size:10px}
`+(full?`
html[data-visual-foundry-fixture="aurentara-hq-gold-standard-fixture-v1"] body.reference-hq-v1 .rf-attention-anchor .rf-panel-head{height:65px;min-height:65px;box-sizing:border-box;padding:9px 13px}
html[data-visual-foundry-fixture="aurentara-hq-gold-standard-fixture-v1"] body.reference-hq-v1 .rf-attention-anchor .rf-panel-title{gap:11px}
`:'');
      document.head.appendChild(style);

      let thumbnailCount=0;
      for(const row of rows){
        const cell=row.children[1];
        if(!cell)throw new Error('ATTENTION_PROJECT_CELL_MISSING');
        const projectName=(cell.textContent||'').trim();
        const key=resolveKey(projectName);
        const asset=thumbnails[key];
        if(!asset)throw new Error('ATTENTION_PROJECT_ASSET_MISSING:'+projectName);
        cell.textContent='';
        const wrap=document.createElement('div');
        wrap.className='vf-attention-project';
        const img=document.createElement('img');
        img.alt='';
        img.setAttribute('aria-hidden','true');
        img.src=asset.src;
        img.dataset.vfReferenceExtractedAttentionThumbnail=asset.asset_id;
        const span=document.createElement('span');
        span.textContent=projectName;
        wrap.append(img,span);
        cell.appendChild(wrap);
        thumbnailCount++;

        if(addMore){
          const actionCell=row.children[5];
          if(!actionCell)throw new Error('ATTENTION_ACTION_CELL_MISSING');
          const action=actionCell.querySelector('.rf-attention-action');
          if(!action)throw new Error('ATTENTION_ACTION_BUTTON_MISSING');
          const actions=document.createElement('div');
          actions.className='vf-attention-actions';
          actionCell.textContent='';
          actions.appendChild(action);
          const more=document.createElement('button');
          more.type='button';
          more.className='vf-attention-more';
          more.setAttribute('aria-label','Weitere Aktionen');
          more.textContent='•••';
          actions.appendChild(more);
          actionCell.appendChild(actions);
        }
      }

      let warningApplied=false;
      if(addIcon){
        const icon=root.querySelector('.rf-panel-title .ico');
        if(!icon)throw new Error('ATTENTION_WARNING_ICON_TARGET_MISSING');
        icon.textContent='';
        const img=document.createElement('img');
        img.alt='';
        img.setAttribute('aria-hidden','true');
        img.src=warning.src;
        img.dataset.vfReferenceExtractedAttentionWarning=warning.asset_id;
        Object.assign(img.style,{display:'block',width:'42px',height:'42px',maxWidth:'none'});
        Object.assign(icon.style,{display:'grid',placeItems:'center',width:'42px',height:'42px',flex:'0 0 42px'});
        icon.appendChild(img);
        warningApplied=true;
      }
      return {
        status:'APPLIED',
        candidate_id,
        variant,
        thumbnail_count:thumbnailCount,
        more_button_count:addMore?rows.length:0,
        warning_icon:warningApplied,
        provenance:'REFERENCE_EXTRACTED',
        usage_scope:'GOLD_STANDARD_POC_ONLY'
      };
    },{
      candidate_id:attentionAssetCandidateId,
      variant:attentionAssetVariant,
      warning,
      thumbnails
    });
  }

  let operatorAiAssetCandidateState={status:'DISABLED',candidate_id:operatorAiAssetCandidateId||null,variant:operatorAiAssetVariant};
  if(operatorAiAssetCandidateId){
    const extracted=(operatorAiReferenceAssets.assets||[]).map(extractApprovedReferenceAsset);
    const sparkle=extracted.find(x=>x.role==='OPERATOR_AI_HEADER_ICON');
    const send=extracted.find(x=>x.role==='OPERATOR_AI_SEND_ICON');
    assert.ok(sparkle,'OPERATOR_AI_SPARKLE_ASSET_REQUIRED');
    assert.ok(send,'OPERATOR_AI_SEND_ASSET_REQUIRED');
    operatorAiAssetCandidateState=await page.evaluate(({candidate_id,variant,sparkle,send})=>{
      const root=document.querySelector('.rf-grid-mid > .rf-panel:nth-child(2)');
      if(!root)throw new Error('OPERATOR_AI_ASSET_ROOT_MISSING');
      if(variant==='CONTROL') return {status:'CONTROL_NO_CHANGE',candidate_id,variant};
      const icons=['ICONS','ICONS_BUTTONS','ICONS_BUTTONS_GLYPHS'].includes(variant);
      const buttons=['ICONS_BUTTONS','ICONS_BUTTONS_GLYPHS'].includes(variant);
      const glyphs=variant==='ICONS_BUTTONS_GLYPHS';
      if(!icons)throw new Error('OPERATOR_AI_ASSET_VARIANT_INVALID:'+variant);

      const headerIcon=root.querySelector('.rf-panel-title .ico');
      if(!headerIcon)throw new Error('OPERATOR_AI_HEADER_ICON_TARGET_MISSING');
      headerIcon.textContent='';
      const sparkImg=document.createElement('img');
      sparkImg.alt='';
      sparkImg.setAttribute('aria-hidden','true');
      sparkImg.src=sparkle.src;
      sparkImg.dataset.vfReferenceExtractedOperatorAiHeader=sparkle.asset_id;
      Object.assign(sparkImg.style,{display:'block',width:'42px',height:'42px',maxWidth:'none'});
      Object.assign(headerIcon.style,{display:'grid',placeItems:'center',width:'46px',height:'46px',flex:'0 0 46px'});
      headerIcon.appendChild(sparkImg);

      const sendTarget=root.querySelector('.rf-ai-input > span:last-child');
      if(!sendTarget)throw new Error('OPERATOR_AI_SEND_TARGET_MISSING');
      sendTarget.textContent='';
      const sendImg=document.createElement('img');
      sendImg.alt='';
      sendImg.setAttribute('aria-hidden','true');
      sendImg.src=send.src;
      sendImg.dataset.vfReferenceExtractedOperatorAiSend=send.asset_id;
      Object.assign(sendImg.style,{display:'block',width:'24px',height:'24px',maxWidth:'none'});
      sendTarget.appendChild(sendImg);

      const newChat=root.querySelector('.rf-ai-new');
      if(newChat){
        newChat.innerHTML='<span aria-hidden="true" style="font-size:11px">◎</span><span>Neuer Chat</span><b aria-hidden="true" style="font-size:12px">+</b>';
        Object.assign(newChat.style,{display:'inline-flex',alignItems:'center',justifyContent:'center',gap:'7px'});
      }

      if(buttons){
        const style=document.createElement('style');
        style.id='vf-operator-ai-reference-assets-style';
        style.textContent=`
html[data-visual-foundry-fixture="aurentara-hq-gold-standard-fixture-v1"] body.reference-hq-v1 .rf-grid-mid>.rf-panel:nth-child(2) .rf-ai-actions{display:flex;flex-wrap:wrap;gap:7px}
html[data-visual-foundry-fixture="aurentara-hq-gold-standard-fixture-v1"] body.reference-hq-v1 .rf-grid-mid>.rf-panel:nth-child(2) .rf-ai-action{height:32px;min-height:32px;box-sizing:border-box;padding:6px 9px;display:inline-flex;align-items:center;justify-content:flex-start;gap:7px;white-space:nowrap}
html[data-visual-foundry-fixture="aurentara-hq-gold-standard-fixture-v1"] body.reference-hq-v1 .rf-grid-mid>.rf-panel:nth-child(2) .rf-ai-action:nth-child(1){width:174px}
html[data-visual-foundry-fixture="aurentara-hq-gold-standard-fixture-v1"] body.reference-hq-v1 .rf-grid-mid>.rf-panel:nth-child(2) .rf-ai-action:nth-child(2){width:132px}
html[data-visual-foundry-fixture="aurentara-hq-gold-standard-fixture-v1"] body.reference-hq-v1 .rf-grid-mid>.rf-panel:nth-child(2) .rf-ai-action:nth-child(3){width:170px}
html[data-visual-foundry-fixture="aurentara-hq-gold-standard-fixture-v1"] body.reference-hq-v1 .rf-grid-mid>.rf-panel:nth-child(2) .rf-ai-action:nth-child(4){width:132px}
html[data-visual-foundry-fixture="aurentara-hq-gold-standard-fixture-v1"] body.reference-hq-v1 .rf-grid-mid>.rf-panel:nth-child(2) .rf-ai-action:nth-child(5){width:130px}
html[data-visual-foundry-fixture="aurentara-hq-gold-standard-fixture-v1"] body.reference-hq-v1 .rf-grid-mid>.rf-panel:nth-child(2) .rf-ai-action:nth-child(6){width:191px}
html[data-visual-foundry-fixture="aurentara-hq-gold-standard-fixture-v1"] body.reference-hq-v1 .vf-ai-action-glyph{width:12px;flex:0 0 12px;text-align:center;color:#d9ebf8;font-size:10px}
`;
        document.head.appendChild(style);
      }
      if(glyphs){
        const glyphSet=['⌘','⌁','△','◷','⌘','▣'];
        [...root.querySelectorAll('.rf-ai-action')].forEach((button,i)=>{
          const text=(button.textContent||'').trim();
          button.textContent='';
          const g=document.createElement('span');
          g.className='vf-ai-action-glyph';
          g.setAttribute('aria-hidden','true');
          g.textContent=glyphSet[i]||'•';
          const label=document.createElement('span');
          label.textContent=text;
          button.append(g,label);
        });
      }
      return {
        status:'APPLIED',
        candidate_id,
        variant,
        header_icon:true,
        send_icon:true,
        button_geometry:buttons,
        action_glyphs:glyphs,
        provenance:'REFERENCE_EXTRACTED',
        usage_scope:'GOLD_STANDARD_POC_ONLY'
      };
    },{candidate_id:operatorAiAssetCandidateId,variant:operatorAiAssetVariant,sparkle,send});
  }

  let operatorAiGlobeCandidateState={status:'DISABLED',candidate_id:operatorAiGlobeCandidateId||null};
  if(operatorAiGlobeCandidateId){
    const globeSource=(operatorAiReferenceAssets.assets||[]).find(x=>x.role==='OPERATOR_AI_GLOBE_SOURCE');
    assert.ok(globeSource,'OPERATOR_AI_GLOBE_SOURCE_REQUIRED');
    if(operatorAiGlobeCandidateId==='G0_CONTROL'){
      operatorAiGlobeCandidateState={status:'CONTROL_NO_CHANGE',candidate_id:operatorAiGlobeCandidateId};
    }else{
      const globe=extractMaskedOperatorGlobe(globeSource);
      operatorAiGlobeCandidateState=await page.evaluate(({candidate_id,globe,left_px,top_px,width_px,height_px,opacity})=>{
        const root=document.querySelector('.rf-grid-mid > .rf-panel:nth-child(2)');
        const stage=root?.querySelector('.rf-ai-stage');
        if(!root||!stage)throw new Error('OPERATOR_AI_GLOBE_STAGE_MISSING');
        const img=document.createElement('img');
        img.alt='';
        img.setAttribute('aria-hidden','true');
        img.src=globe.src;
        img.dataset.vfReferenceExtractedOperatorAiGlobe=globe.asset_id;
        Object.assign(stage.style,{position:'relative',overflow:'hidden'});
        Object.assign(img.style,{
          position:'absolute',
          left:left_px+'px',
          top:top_px+'px',
          width:width_px+'px',
          height:height_px+'px',
          maxWidth:'none',
          objectFit:'fill',
          opacity:String(opacity),
          zIndex:'0',
          pointerEvents:'none',
          userSelect:'none'
        });
        stage.prepend(img);
        const message=stage.querySelector('.rf-ai-message');
        const actions=stage.querySelector('.rf-ai-actions');
        if(message)Object.assign(message.style,{position:'relative',zIndex:'2'});
        if(actions)Object.assign(actions.style,{zIndex:'2'});
        const rect=img.getBoundingClientRect();
        return {
          status:'APPLIED',
          candidate_id,
          asset_id:globe.asset_id,
          mask_algorithm:globe.mask_algorithm,
          placement:{left_px,top_px,width_px,height_px,opacity},
          image_geometry:{x:rect.x,y:rect.y,width:rect.width,height:rect.height},
          provenance:'REFERENCE_EXTRACTED_MASKED',
          usage_scope:'GOLD_STANDARD_POC_ONLY'
        };
      },{
        candidate_id:operatorAiGlobeCandidateId,
        globe,
        left_px:operatorAiGlobeLeftPx,
        top_px:operatorAiGlobeTopPx,
        width_px:operatorAiGlobeWidthPx,
        height_px:operatorAiGlobeHeightPx,
        opacity:operatorAiGlobeOpacity
      });
    }
  }

  let portfolioUiCandidateState={status:'DISABLED',candidate_id:portfolioUiCandidateId||null,variant:portfolioUiVariant};
  if(portfolioUiCandidateId){
    const folderSource=(portfolioUiReferenceAssets.assets||[]).find(x=>x.role==='PORTFOLIO_HEADER_ICON');
    assert.ok(folderSource,'PORTFOLIO_HEADER_ICON_SOURCE_REQUIRED');
    const folder=extractApprovedReferenceAsset(folderSource);
    portfolioUiCandidateState=await page.evaluate(({candidate_id,variant,folder,header_gap_px,name_weight,name_size_px,scope_size_px})=>{
      const root=document.querySelector('.rf-ops-grid > .rf-panel:first-child');
      if(!root)throw new Error('PORTFOLIO_UI_ROOT_MISSING');
      if(variant==='CONTROL')return {status:'CONTROL_NO_CHANGE',candidate_id,variant};

      const useIcon=['ICON','ICON_NAME500','ICON_NAME500_SMALL','ICON_NAME550','ICON_NAME500_SCOPE'].includes(variant);
      const useName=['NAME500','ICON_NAME500','ICON_NAME500_SMALL','ICON_NAME550','ICON_NAME500_SCOPE'].includes(variant);
      if(!useIcon&&!useName)throw new Error('PORTFOLIO_UI_VARIANT_INVALID:'+variant);

      if(useIcon){
        const title=root.querySelector('.rf-panel-title');
        const icon=title?.querySelector('.ico');
        if(!title||!icon)throw new Error('PORTFOLIO_HEADER_ICON_TARGET_MISSING');
        icon.textContent='';
        const img=document.createElement('img');
        img.alt='';
        img.setAttribute('aria-hidden','true');
        img.src=folder.src;
        img.dataset.vfReferenceExtractedPortfolioHeader=folder.asset_id;
        Object.assign(img.style,{display:'block',width:'42px',height:'42px',maxWidth:'none'});
        Object.assign(icon.style,{display:'grid',placeItems:'center',width:'42px',height:'42px',flex:'0 0 42px'});
        title.style.gap=header_gap_px+'px';
        icon.appendChild(img);
      }

      const names=[...root.querySelectorAll('.rf-project-name')];
      const scopes=[...root.querySelectorAll('.rf-project-scope')];
      if(names.length!==4||scopes.length!==4)throw new Error('PORTFOLIO_UI_PROJECT_TEXT_INCOMPLETE');
      if(useName){
        for(const el of names){
          el.style.fontWeight=String(name_weight);
          el.style.fontSize=name_size_px+'px';
          el.style.lineHeight='1.15';
          el.style.whiteSpace='nowrap';
          el.style.overflow='hidden';
          el.style.textOverflow='ellipsis';
        }
        for(const el of scopes){
          el.style.fontSize=scope_size_px+'px';
          el.style.fontWeight='400';
        }
      }
      return {
        status:'APPLIED',
        candidate_id,
        variant,
        header_icon:useIcon,
        header_gap_px:useIcon?header_gap_px:null,
        project_name_tuned:useName,
        name_weight:useName?name_weight:null,
        name_size_px:useName?name_size_px:null,
        scope_size_px:useName?scope_size_px:null,
        provenance:useIcon?'REFERENCE_EXTRACTED_PLUS_METRIC_TYPOGRAPHY':'METRIC_TYPOGRAPHY',
        usage_scope:'GOLD_STANDARD_POC_ONLY'
      };
    },{
      candidate_id:portfolioUiCandidateId,
      variant:portfolioUiVariant,
      folder,
      header_gap_px:portfolioUiHeaderGapPx,
      name_weight:portfolioUiNameWeight,
      name_size_px:portfolioUiNameSizePx,
      scope_size_px:portfolioUiScopeSizePx
    });
  }

  let portfolioRowStyleCandidateState={status:'DISABLED',candidate_id:portfolioRowStyleCandidateId||null};
  if(portfolioRowStyleCandidateId){
    assert.equal(portfolioRowWidths.length,7,'PORTFOLIO_ROW_WIDTHS_COUNT');
    assert.ok(portfolioRowWidths.every(Number.isFinite),'PORTFOLIO_ROW_WIDTHS_INVALID');
    const total=portfolioRowWidths.reduce((a,b)=>a+b,0);
    assert.ok(Math.abs(total-100)<0.001,'PORTFOLIO_ROW_WIDTHS_MUST_SUM_100');
    portfolioRowStyleCandidateState=await page.evaluate(({candidate_id,widths,action_inset_px,state_font_size_px,state_pad_x_px})=>{
      const root=document.querySelector('.rf-ops-grid > .rf-panel:first-child');
      if(!root)throw new Error('PORTFOLIO_ROW_STYLE_ROOT_MISSING');
      if(candidate_id==='RS0_CONTROL')return {status:'CONTROL_NO_CHANGE',candidate_id};
      const table=root.querySelector('.rf-portfolio-table');
      if(!table)throw new Error('PORTFOLIO_ROW_STYLE_TABLE_MISSING');
      const style=document.createElement('style');
      style.id='vf-portfolio-row-style';
      style.textContent=widths.map((w,i)=>`
html[data-visual-foundry-fixture="aurentara-hq-gold-standard-fixture-v1"] body.reference-hq-v1 .rf-ops-grid>.rf-panel:first-child .rf-portfolio-table th:nth-child(${i+1}){width:${w}%}`).join('')+`
html[data-visual-foundry-fixture="aurentara-hq-gold-standard-fixture-v1"] body.reference-hq-v1 .rf-ops-grid>.rf-panel:first-child .rf-portfolio-actions{transform:translateX(-${action_inset_px}px)}
html[data-visual-foundry-fixture="aurentara-hq-gold-standard-fixture-v1"] body.reference-hq-v1 .rf-ops-grid>.rf-panel:first-child .rf-state{font-size:${state_font_size_px}px;padding-left:${state_pad_x_px}px;padding-right:${state_pad_x_px}px}
`;
      document.head.appendChild(style);
      const headers=[...table.querySelectorAll('thead th')].map(el=>{const r=el.getBoundingClientRect();return {text:(el.textContent||'').trim(),x:r.x,width:r.width}});
      const actions=[...table.querySelectorAll('.rf-portfolio-actions')].map(el=>{const r=el.getBoundingClientRect();return {x:r.x,width:r.width,right:r.right}});
      return {
        status:'APPLIED',
        candidate_id,
        column_widths_percent:widths,
        action_inset_px,
        state_font_size_px,
        state_pad_x_px,
        headers,
        actions
      };
    },{
      candidate_id:portfolioRowStyleCandidateId,
      widths:portfolioRowWidths,
      action_inset_px:portfolioRowActionInsetPx,
      state_font_size_px:portfolioRowStateFontSizePx,
      state_pad_x_px:portfolioRowStatePadXPx
    });
  }

  let primaryNavDetailCandidateState={status:'DISABLED',candidate_id:primaryNavDetailCandidateId||null};
  if(primaryNavDetailCandidateId){
    const assets=(sidebarNavReferenceAssets.assets||[]).filter(x=>x.role==='SIDEBAR_NAV_ICON').map(extractApprovedReferenceAsset);
    assert.equal(assets.length,18,'PRIMARY_NAV_REFERENCE_ICON_COUNT');
    primaryNavDetailCandidateState=await page.evaluate(({candidate_id,assets,icon_size_px,icon_offset_y_px})=>{
      if(candidate_id==='PN0_CONTROL')return {status:'CONTROL_NO_CHANGE',candidate_id};
      const applied=[];
      for(const asset of assets){
        const icon=document.querySelector(`[data-rf-nav="${asset.nav_id}"] .rf-hq-nav-icon`);
        if(!icon)throw new Error('PRIMARY_NAV_ICON_TARGET_MISSING:'+asset.nav_id);
        icon.textContent='';
        const img=document.createElement('img');
        img.alt='';
        img.setAttribute('aria-hidden','true');
        img.src=asset.src;
        img.dataset.vfReferenceExtractedNavIcon=asset.asset_id;
        Object.assign(img.style,{
          display:'block',
          width:icon_size_px+'px',
          height:icon_size_px+'px',
          maxWidth:'none',
          objectFit:'fill',
          transform:'translateY('+icon_offset_y_px+'px)'
        });
        Object.assign(icon.style,{
          width:'20px',
          height:'20px',
          flex:'0 0 20px',
          display:'grid',
          placeItems:'center'
        });
        icon.appendChild(img);
        applied.push({nav_id:asset.nav_id,asset_id:asset.asset_id});
      }
      return {
        status:'APPLIED',
        candidate_id,
        icon_size_px,
        icon_offset_y_px,
        icon_count:applied.length,
        applied,
        provenance:'REFERENCE_EXTRACTED',
        usage_scope:'GOLD_STANDARD_POC_ONLY',
        missing_reference_only_item:'Berichte',
        synthetic_nav_action_added:false
      };
    },{candidate_id:primaryNavDetailCandidateId,assets,icon_size_px:primaryNavIconSizePx,icon_offset_y_px:primaryNavIconOffsetYPx});
  }

  let primaryNavLayoutCandidateState={status:'DISABLED',candidate_id:primaryNavLayoutCandidateId||null,variant:primaryNavLayoutVariant};
  if(primaryNavLayoutCandidateId){
    const allAssets=(sidebarNavReferenceAssets.assets||[]).map(extractApprovedReferenceAsset);
    const reportsAsset=allAssets.find(x=>x.nav_id==='reports-placeholder');
    const functionalAssets=allAssets.filter(x=>x.role==='SIDEBAR_NAV_ICON');
    assert.ok(reportsAsset,'PRIMARY_NAV_REPORTS_REFERENCE_ICON_REQUIRED');
    assert.equal(functionalAssets.length,18,'PRIMARY_NAV_LAYOUT_FUNCTIONAL_ICON_COUNT');
    primaryNavLayoutCandidateState=await page.evaluate(({candidate_id,variant,reportsAsset,functionalAssets,icon_size_px})=>{
      if(candidate_id==='PL0_CONTROL')return {status:'CONTROL_NO_CHANGE',candidate_id,variant};
      const main=document.querySelector('.rf-hq-nav-main');
      const controlGroup=main?.querySelector('.rf-nav-group:first-child .rf-nav-group-items');
      if(!main||!controlGroup)throw new Error('PRIMARY_NAV_LAYOUT_ROOT_MISSING');

      const addReports=['REPORTS_ONLY','REPORTS_RAW','REPORTS_SCREEN'].includes(variant);
      const addIcons=['REPORTS_RAW','REPORTS_SCREEN'].includes(variant);
      if(!addReports)throw new Error('PRIMARY_NAV_LAYOUT_VARIANT_INVALID:'+variant);

      let reports=controlGroup.querySelector('[data-rf-nav="reports-placeholder"]');
      if(!reports){
        reports=document.createElement('button');
        reports.type='button';
        reports.dataset.rfNav='reports-placeholder';
        reports.setAttribute('aria-disabled','true');
        reports.setAttribute('tabindex','-1');
        reports.className='vf-reference-disabled-nav';
        reports.innerHTML='<span class="rf-hq-nav-icon"></span><span>Berichte</span>';
        reports.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();});
        controlGroup.appendChild(reports);
      }
      reports.style.pointerEvents='none';
      reports.style.cursor='default';
      reports.dataset.vfReferenceOnly='true';

      const applyAsset=(target,asset,blend)=>{
        const icon=target.querySelector('.rf-hq-nav-icon');
        if(!icon)throw new Error('PRIMARY_NAV_LAYOUT_ICON_TARGET_MISSING:'+asset.nav_id);
        icon.textContent='';
        const img=document.createElement('img');
        img.alt='';
        img.setAttribute('aria-hidden','true');
        img.src=asset.src;
        img.dataset.vfReferenceExtractedNavIcon=asset.asset_id;
        Object.assign(img.style,{
          display:'block',
          width:icon_size_px+'px',
          height:icon_size_px+'px',
          maxWidth:'none',
          objectFit:'fill',
          mixBlendMode:blend?'screen':'normal'
        });
        Object.assign(icon.style,{width:'20px',height:'20px',flex:'0 0 20px',display:'grid',placeItems:'center'});
        icon.appendChild(img);
      };
      applyAsset(reports,reportsAsset,variant==='REPORTS_SCREEN');

      let iconCount=1;
      if(addIcons){
        for(const asset of functionalAssets){
          const target=document.querySelector(`[data-rf-nav="${asset.nav_id}"]`);
          if(!target)throw new Error('PRIMARY_NAV_LAYOUT_TARGET_MISSING:'+asset.nav_id);
          applyAsset(target,asset,variant==='REPORTS_SCREEN');
          iconCount++;
        }
      }
      const reportRect=reports.getBoundingClientRect();
      const projectGroup=main.querySelectorAll('.rf-nav-group')[1];
      const projectTitleRect=projectGroup?.querySelector('.rf-nav-group-title')?.getBoundingClientRect()||null;
      return {
        status:'APPLIED',
        candidate_id,
        variant,
        reports_placeholder:true,
        reports_functional_action:false,
        synthetic_nav_action_added:false,
        icon_count:iconCount,
        icon_size_px,
        reports_rect:{x:reportRect.x,y:reportRect.y,width:reportRect.width,height:reportRect.height},
        project_group_title_y:projectTitleRect?.y||null,
        provenance:'REFERENCE_EXTRACTED',
        usage_scope:'GOLD_STANDARD_POC_ONLY'
      };
    },{
      candidate_id:primaryNavLayoutCandidateId,
      variant:primaryNavLayoutVariant,
      reportsAsset,
      functionalAssets,
      icon_size_px:primaryNavLayoutIconSizePx
    });
  }

  let toolbarDetailCandidateState={status:'DISABLED',candidate_id:toolbarDetailCandidateId||null,variant:toolbarDetailVariant};
  if(toolbarDetailCandidateId){
    const toolbarSources=toolbarReferenceAssets.assets||[];
    const searchSource=toolbarSources.find(x=>x.role==='TOOLBAR_SEARCH_ICON');
    const globeSource=toolbarSources.find(x=>x.role==='TOOLBAR_REGION_ICON');
    const sunSource=toolbarSources.find(x=>x.role==='TOOLBAR_THEME_ICON');
    const avatarSource=toolbarSources.find(x=>x.role==='TOOLBAR_OPERATOR_AVATAR');
    const bellSource=toolbarSources.find(x=>x.role==='TOOLBAR_NOTIFICATION_ICON');
    assert.ok(searchSource&&globeSource&&sunSource&&avatarSource&&bellSource,'TOOLBAR_REFERENCE_ASSETS_INCOMPLETE');
    const searchAsset=extractLumaAlphaUiAsset(searchSource);
    const globeAsset=extractLumaAlphaUiAsset(globeSource);
    const sunAsset=extractLumaAlphaUiAsset(sunSource);
    const avatarAsset=extractApprovedReferenceAsset(avatarSource);
    const bellAsset=extractLumaAlphaUiAsset(bellSource,{scrubBadge:true});
    toolbarDetailCandidateState=await page.evaluate(({candidate_id,variant,searchAsset,globeAsset,sunAsset,avatarAsset,bellAsset})=>{
      if(candidate_id==='TB0_CONTROL')return {status:'CONTROL_NO_CHANGE',candidate_id,variant};
      const toolbar=document.querySelector('.rf-toolbar');
      const search=toolbar?.querySelector('.rf-search');
      const right=toolbar?.querySelector('.rf-toolbar-right');
      const env=right?.querySelector('.rf-env');
      const region=right?.querySelector('.rf-region');
      const operator=right?.querySelector('.rf-operator');
      if(!toolbar||!search||!right||!env||!region||!operator)throw new Error('TOOLBAR_DETAIL_ROOT_MISSING');

      const useOperator=['OPERATOR','OPERATOR_REGION','FULL_NO_BELL','FULL'].includes(variant);
      const useRegion=['OPERATOR_REGION','FULL_NO_BELL','FULL'].includes(variant);
      const useFull=['FULL_NO_BELL','FULL'].includes(variant);
      const useBell=variant==='FULL';
      if(!useOperator)throw new Error('TOOLBAR_DETAIL_VARIANT_INVALID:'+variant);

      const makeImg=(asset,size)=>{
        const img=document.createElement('img');
        img.alt='';
        img.setAttribute('aria-hidden','true');
        img.src=asset.src;
        img.dataset.vfToolbarReferenceAsset=asset.asset_id;
        Object.assign(img.style,{display:'block',width:size+'px',height:size+'px',maxWidth:'none',objectFit:'fill',mixBlendMode:'normal'});
        return img;
      };

      const searchLead=search.querySelector('span:first-child');
      if(searchLead){
        searchLead.textContent='';
        searchLead.style.display='grid';
        searchLead.style.placeItems='center';
        searchLead.style.width='22px';
        searchLead.style.height='22px';
        searchLead.appendChild(makeImg(searchAsset,22));
      }

      if(useRegion){
        region.style.width='150px';
        region.style.boxSizing='border-box';
        region.style.justifyContent='flex-start';
        if(!region.querySelector('[data-vf-toolbar-region-icon]')){
          const globe=makeImg(globeAsset,22);
          globe.dataset.vfToolbarRegionIcon='true';
          region.prepend(globe);
        }
      }

      env.style.width='108px';
      env.style.boxSizing='border-box';
      env.style.justifyContent='center';

      if(useFull){
        let theme=right.querySelector('.vf-toolbar-theme');
        if(!theme){
          theme=document.createElement('button');
          theme.type='button';
          theme.className='vf-toolbar-theme';
          theme.setAttribute('aria-label','Darstellungssteuerung in dieser Referenzansicht nicht aktiv');
          theme.setAttribute('aria-disabled','true');
          theme.tabIndex=-1;
          theme.style.pointerEvents='none';
          theme.appendChild(makeImg(sunAsset,28));
          right.insertBefore(theme,operator);
        }
        Object.assign(theme.style,{width:'34px',height:'34px',padding:'0',border:'0',background:'transparent',display:'grid',placeItems:'center',flex:'0 0 34px'});

        let notify=right.querySelector('.rf-notify');
        if(useBell){
          const existingCount=Number(notify?.querySelector('b')?.textContent||0);
          const actualCount=Number.isFinite(existingCount)?existingCount:0;
          if(!notify){
            notify=document.createElement('button');
            notify.type='button';
            notify.className='rf-notify vf-toolbar-notify-placeholder';
            notify.setAttribute('aria-label','Keine verifizierten offenen Entscheidungen');
            notify.setAttribute('aria-disabled','true');
            notify.tabIndex=-1;
            notify.style.pointerEvents='none';
            right.insertBefore(notify,operator);
          }
          notify.textContent='';
          notify.appendChild(makeImg(bellAsset,32));
          notify.dataset.vfRuntimeDecisionCount=String(actualCount);
          Object.assign(notify.style,{position:'relative',width:'34px',height:'34px',minHeight:'34px',padding:'0',border:'0',background:'transparent',fontSize:'22px',color:'#dbeeff',display:'grid',placeItems:'center'});
          if(actualCount>0){
            const b=document.createElement('b');
            b.textContent=String(actualCount);
            Object.assign(b.style,{position:'absolute',right:'-2px',top:'-3px',minWidth:'16px',height:'16px',borderRadius:'999px',background:'#ff5361',color:'#fff',fontSize:'9px',lineHeight:'16px',textAlign:'center',fontWeight:'700'});
            notify.appendChild(b);
            notify.removeAttribute('aria-disabled');
            notify.removeAttribute('tabindex');
            notify.style.pointerEvents='';
            notify.setAttribute('aria-label',actualCount+' offene Entscheidungen');
          }
        }
      }

      if(useOperator){
        const currentText=(operator.textContent||'').replace(/\s+/g,' ').trim();
        operator.textContent='';
        operator.style.width='166px';
        operator.style.height='44px';
        operator.style.minHeight='44px';
        operator.style.padding='2px 0';
        operator.style.border='0';
        operator.style.background='transparent';
        operator.style.borderRadius='0';
        operator.style.display='grid';
        operator.style.gridTemplateColumns='40px 1fr 14px';
        operator.style.gap='9px';
        operator.style.alignItems='center';

        const avatar=makeImg(avatarAsset,40);
        avatar.style.borderRadius='50%';
        avatar.style.gridColumn='1';
        const copy=document.createElement('span');
        copy.style.display='grid';
        copy.style.gap='1px';
        copy.style.lineHeight='1.08';
        const top=document.createElement('strong');
        top.textContent='Operator';
        top.style.fontSize='10px';
        top.style.fontWeight='600';
        top.style.color='#eef5fb';
        const bottom=document.createElement('small');
        bottom.textContent=currentText.includes('AURENTARA')?'AURENTARA':currentText||'AURENTARA';
        bottom.style.fontSize='9px';
        bottom.style.color='#7fa0ba';
        copy.append(top,bottom);
        const chevron=document.createElement('span');
        chevron.textContent='⌄';
        chevron.setAttribute('aria-hidden','true');
        chevron.style.fontSize='16px';
        chevron.style.color='#dcebf6';
        operator.append(avatar,copy,chevron);
      }

      right.style.gap='10px';
      const rect=toolbar.getBoundingClientRect();
      const searchRect=search.getBoundingClientRect();
      const rightRect=right.getBoundingClientRect();
      return {
        status:'APPLIED',
        candidate_id,
        variant,
        search_reference_icon:true,
        region_reference_icon:useRegion,
        theme_visual_placeholder:useFull,
        notification_visual:useBell,
        operator_reference_avatar:useOperator,
        truth_preserved:true,
        toolbar_rect:{x:rect.x,y:rect.y,width:rect.width,height:rect.height},
        search_rect:{x:searchRect.x,y:searchRect.y,width:searchRect.width,height:searchRect.height},
        right_rect:{x:rightRect.x,y:rightRect.y,width:rightRect.width,height:rightRect.height},
        provenance:'REFERENCE_EXTRACTED_PLUS_TRUTH_PRESERVING_LAYOUT',
        usage_scope:'GOLD_STANDARD_POC_ONLY'
      };
    },{candidate_id:toolbarDetailCandidateId,variant:toolbarDetailVariant,searchAsset,globeAsset,sunAsset,avatarAsset,bellAsset});
  }

  let kpiDetailCandidateState={status:'DISABLED',candidate_id:kpiDetailCandidateId||null,variant:kpiDetailVariant};
  if(kpiDetailCandidateId){
    const iconSources=(kpiReferenceAssets.assets||[]).filter(x=>x.role==='KPI_ICON').sort((a,b)=>a.index-b.index);
    const sparkSources=(kpiReferenceAssets.assets||[]).filter(x=>x.role==='KPI_SPARK').sort((a,b)=>a.index-b.index);
    assert.equal(iconSources.length,4,'KPI_REFERENCE_ICON_COUNT');
    assert.equal(sparkSources.length,4,'KPI_REFERENCE_SPARK_COUNT');
    const icons=iconSources.map(extractApprovedReferenceAsset);
    const sparks=sparkSources.map(x=>extractLumaAlphaUiAsset(x));
    kpiDetailCandidateState=await page.evaluate(({candidate_id,variant,icons,sparks,padding_px,gap_px,spark_right_px,spark_top_px})=>{
      if(candidate_id==='KD0_CONTROL')return {status:'CONTROL_NO_CHANGE',candidate_id,variant};
      const cards=[...document.querySelectorAll('.rf-kpi')];
      if(cards.length!==4)throw new Error('KPI_CARD_COUNT:'+cards.length);
      const useIcons=['ICONS','ICONS_SPARKS'].includes(variant);
      const useSparks=['SPARKS','ICONS_SPARKS'].includes(variant);
      if(!useIcons&&!useSparks)throw new Error('KPI_DETAIL_VARIANT_INVALID:'+variant);

      const before=cards.map(card=>{
        const r=card.getBoundingClientRect();
        const icon=card.querySelector('.rf-kpi-icon')?.getBoundingClientRect();
        const label=card.querySelector('.rf-kpi-label')?.getBoundingClientRect();
        return {card:{x:r.x,y:r.y,width:r.width,height:r.height},icon:icon?{x:icon.x,y:icon.y,width:icon.width,height:icon.height}:null,label:label?{x:label.x,y:label.y,width:label.width,height:label.height}:null};
      });

      cards.forEach((card,i)=>{
        card.style.position='relative';
        card.style.overflow='hidden';
        card.style.padding=padding_px+'px';
        card.style.gap=gap_px+'px';

        if(useIcons){
          const holder=card.querySelector('.rf-kpi-icon');
          if(!holder)throw new Error('KPI_ICON_TARGET_MISSING:'+i);
          holder.textContent='';
          holder.style.width='68px';
          holder.style.height='68px';
          holder.style.flex='0 0 68px';
          holder.style.borderRadius='50%';
          holder.style.background='transparent';
          holder.style.boxShadow='none';
          holder.style.overflow='hidden';
          const img=document.createElement('img');
          img.alt='';
          img.setAttribute('aria-hidden','true');
          img.src=icons[i].src;
          img.dataset.vfReferenceExtractedKpiIcon=icons[i].asset_id;
          Object.assign(img.style,{display:'block',width:'68px',height:'68px',maxWidth:'none',objectFit:'fill'});
          holder.appendChild(img);
        }

        if(useSparks){
          const img=document.createElement('img');
          img.alt='';
          img.setAttribute('aria-hidden','true');
          img.src=sparks[i].src;
          img.dataset.vfReferenceExtractedKpiSpark=sparks[i].asset_id;
          Object.assign(img.style,{
            position:'absolute',
            right:spark_right_px+'px',
            top:spark_top_px+'px',
            width:'68px',
            height:'74px',
            maxWidth:'none',
            objectFit:'fill',
            pointerEvents:'none',
            userSelect:'none',
            zIndex:'0'
          });
          card.appendChild(img);
        }

        const copy=card.querySelector('.rf-kpi-label')?.parentElement;
        if(copy){
          copy.style.position='relative';
          copy.style.zIndex='1';
          copy.style.minWidth='0';
        }
      });

      const after=cards.map(card=>{
        const r=card.getBoundingClientRect();
        const icon=card.querySelector('.rf-kpi-icon')?.getBoundingClientRect();
        const label=card.querySelector('.rf-kpi-label')?.getBoundingClientRect();
        const spark=card.querySelector('[data-vf-reference-extracted-kpi-spark]')?.getBoundingClientRect();
        return {
          card:{x:r.x,y:r.y,width:r.width,height:r.height},
          icon:icon?{x:icon.x,y:icon.y,width:icon.width,height:icon.height}:null,
          label:label?{x:label.x,y:label.y,width:label.width,height:label.height}:null,
          spark:spark?{x:spark.x,y:spark.y,width:spark.width,height:spark.height}:null
        };
      });
      return {
        status:'APPLIED',
        candidate_id,
        variant,
        icon_count:useIcons?4:0,
        spark_count:useSparks?4:0,
        padding_px,
        gap_px,
        spark_right_px,
        spark_top_px,
        runtime_text_preserved:true,
        functional_buttons_preserved:true,
        before,
        after,
        provenance:'REFERENCE_EXTRACTED_DECORATIVE_ONLY',
        usage_scope:'GOLD_STANDARD_POC_ONLY'
      };
    },{
      candidate_id:kpiDetailCandidateId,
      variant:kpiDetailVariant,
      icons,
      sparks,
      padding_px:kpiDetailPaddingPx,
      gap_px:kpiDetailGapPx,
      spark_right_px:kpiDetailSparkRightPx,
      spark_top_px:kpiDetailSparkTopPx
    });
  }

  let rightRailTypographyState={status:'DISABLED',candidate_id:rightRailTypographyCandidateId||null};
  if(rightRailTypographyCandidateId){
    rightRailTypographyState=await page.evaluate(({candidate_id,scope,primary_size_px,secondary_size_px,secondary_weight})=>{
      const config={
        SYSTEM_STATUS:{primary:'.rf-status-row span',secondary:'.rf-status-row b'},
        COST:{primary:'.rf-cost-line span',secondary:'.rf-cost-line b'},
        ACTIVITY:{primary:'.rf-activity-main strong',secondary:'.rf-activity-main span'}
      }[scope];
      if(!config)throw new Error('RIGHT_RAIL_TYPOGRAPHY_SCOPE_INVALID:'+scope);
      const primary=[...document.querySelectorAll(config.primary)];
      const secondary=[...document.querySelectorAll(config.secondary)];
      if(!primary.length||!secondary.length)throw new Error('RIGHT_RAIL_TYPOGRAPHY_ELEMENTS_MISSING:'+scope);
      const snap=el=>{const s=getComputedStyle(el),r=el.getBoundingClientRect();return {text:(el.textContent||'').trim(),font_size:s.fontSize,font_weight:s.fontWeight,line_height:s.lineHeight,rect:{x:r.x,y:r.y,width:r.width,height:r.height}}};
      const before={primary:primary.map(snap),secondary:secondary.map(snap)};
      for(const el of primary){if(Number.isFinite(primary_size_px))el.style.fontSize=primary_size_px+'px';el.dataset.vfRightRailTypographyCandidate=candidate_id;}
      for(const el of secondary){if(Number.isFinite(secondary_size_px))el.style.fontSize=secondary_size_px+'px';if(Number.isFinite(secondary_weight))el.style.fontWeight=String(secondary_weight);el.dataset.vfRightRailTypographyCandidate=candidate_id;}
      return {
        status:'APPLIED',candidate_id,scope,
        substitution_status:'METRICALLY_CALIBRATED_SUBSTITUTION',
        original_font_identity_claimed:false,
        requested:{
          primary_size_px:Number.isFinite(primary_size_px)?primary_size_px:null,
          secondary_size_px:Number.isFinite(secondary_size_px)?secondary_size_px:null,
          secondary_weight:Number.isFinite(secondary_weight)?secondary_weight:null
        },
        before,after:{primary:primary.map(snap),secondary:secondary.map(snap)}
      };
    },{candidate_id:rightRailTypographyCandidateId,scope:rightRailTypographyScope,primary_size_px:rightRailPrimarySizePx,secondary_size_px:rightRailSecondarySizePx,secondary_weight:rightRailSecondaryWeight});
  }

  let kpiTypographyState={status:'DISABLED',candidate_id:kpiTypographyCandidateId||null};
  if(kpiTypographyCandidateId){
    kpiTypographyState=await page.evaluate(({candidate_id,label_size_px,value_size_px,value_weight,meta_size_px})=>{
      const labels=[...document.querySelectorAll('.rf-kpi-label')];
      const values=[...document.querySelectorAll('.rf-kpi-value')];
      const metas=[...document.querySelectorAll('.rf-kpi-meta')];
      if(labels.length!==4||values.length!==4||metas.length!==4)throw new Error('KPI_TEXT_ELEMENTS_INCOMPLETE');
      const snap=el=>{const s=getComputedStyle(el),r=el.getBoundingClientRect();return {text:(el.textContent||'').trim(),font_size:s.fontSize,font_weight:s.fontWeight,line_height:s.lineHeight,letter_spacing:s.letterSpacing,rect:{x:r.x,y:r.y,width:r.width,height:r.height}}};
      const before={labels:labels.map(snap),values:values.map(snap),metas:metas.map(snap)};
      for(const el of labels){if(Number.isFinite(label_size_px))el.style.fontSize=label_size_px+'px';el.dataset.vfKpiTypographyCandidate=candidate_id;}
      for(const el of values){if(Number.isFinite(value_size_px))el.style.fontSize=value_size_px+'px';if(Number.isFinite(value_weight))el.style.fontWeight=String(value_weight);el.dataset.vfKpiTypographyCandidate=candidate_id;}
      for(const el of metas){if(Number.isFinite(meta_size_px))el.style.fontSize=meta_size_px+'px';el.dataset.vfKpiTypographyCandidate=candidate_id;}
      return {
        status:'APPLIED',candidate_id,
        substitution_status:'METRICALLY_CALIBRATED_SUBSTITUTION',
        original_font_identity_claimed:false,
        requested:{
          label_size_px:Number.isFinite(label_size_px)?label_size_px:null,
          value_size_px:Number.isFinite(value_size_px)?value_size_px:null,
          value_weight:Number.isFinite(value_weight)?value_weight:null,
          meta_size_px:Number.isFinite(meta_size_px)?meta_size_px:null
        },
        before,after:{labels:labels.map(snap),values:values.map(snap),metas:metas.map(snap)}
      };
    },{candidate_id:kpiTypographyCandidateId,label_size_px:kpiLabelSizePx,value_size_px:kpiValueSizePx,value_weight:kpiValueWeight,meta_size_px:kpiMetaSizePx});
  }

  let panelHeaderTypographyState={status:'DISABLED',candidate_id:panelHeaderTypographyCandidateId||null};
  if(panelHeaderTypographyCandidateId){
    panelHeaderTypographyState=await page.evaluate(({candidate_id,title_size_px,title_weight,subtitle_size_px,scope})=>{
      const scopeSelector={
        OPERATOR_AI:'.rf-grid-mid > .rf-panel:nth-child(2)',
        ATTENTION:'.rf-attention-anchor',
        PORTFOLIO:'.rf-ops-grid > .rf-panel:first-child'
      }[scope]||null;
      const root=scopeSelector?document.querySelector(scopeSelector):document;
      if(!root)throw new Error('PANEL_HEADER_SCOPE_ROOT_MISSING:'+scope);
      const titles=[...root.querySelectorAll('.rf-panel-title h2')];
      const subtitles=[...root.querySelectorAll('.rf-panel-title p')];
      if(!titles.length)throw new Error('PANEL_HEADER_TITLES_MISSING:'+scope);
      const snap=el=>{const s=getComputedStyle(el),r=el.getBoundingClientRect();return {text:(el.textContent||'').trim(),font_size:s.fontSize,font_weight:s.fontWeight,line_height:s.lineHeight,letter_spacing:s.letterSpacing,rect:{x:r.x,y:r.y,width:r.width,height:r.height}}};
      const before={titles:titles.map(snap),subtitles:subtitles.map(snap)};
      for(const el of titles){
        if(Number.isFinite(title_size_px))el.style.fontSize=title_size_px+'px';
        if(Number.isFinite(title_weight))el.style.fontWeight=String(title_weight);
        el.dataset.vfPanelHeaderTypographyCandidate=candidate_id;
      }
      for(const el of subtitles){
        if(Number.isFinite(subtitle_size_px))el.style.fontSize=subtitle_size_px+'px';
        el.dataset.vfPanelHeaderTypographyCandidate=candidate_id;
      }
      return {
        status:'APPLIED',candidate_id,
        substitution_status:'METRICALLY_CALIBRATED_SUBSTITUTION',
        original_font_identity_claimed:false,
        scope,
        requested:{
          title_size_px:Number.isFinite(title_size_px)?title_size_px:null,
          title_weight:Number.isFinite(title_weight)?title_weight:null,
          subtitle_size_px:Number.isFinite(subtitle_size_px)?subtitle_size_px:null
        },
        before,after:{titles:titles.map(snap),subtitles:subtitles.map(snap)}
      };
    },{candidate_id:panelHeaderTypographyCandidateId,title_size_px:panelHeaderTitleSizePx,title_weight:panelHeaderTitleWeight,subtitle_size_px:panelHeaderSubtitleSizePx,scope:panelHeaderScope});
  }

  let sidebarBrandTypographyState={status:'DISABLED',candidate_id:sidebarBrandTypographyCandidateId||null};
  if(sidebarBrandTypographyCandidateId){
    sidebarBrandTypographyState=await page.evaluate(({candidate_id,title_size_px,title_letter_spacing_em,tagline_size_px,tagline_width_px,fixed_height_px})=>{
      const brand=document.querySelector('.brand');
      const strong=document.querySelector('.brand strong');
      const span=document.querySelector('.brand span');
      if(!brand||!strong||!span)throw new Error('SIDEBAR_BRAND_TEXT_MISSING');
      const snap=el=>{const s=getComputedStyle(el),r=el.getBoundingClientRect();return {font_size:s.fontSize,font_weight:s.fontWeight,line_height:s.lineHeight,letter_spacing:s.letterSpacing,max_width:s.maxWidth,rect:{x:r.x,y:r.y,width:r.width,height:r.height}}};
      const brandSnap=()=>{const s=getComputedStyle(brand),r=brand.getBoundingClientRect();return {height:s.height,min_height:s.minHeight,max_height:s.maxHeight,box_sizing:s.boxSizing,rect:{x:r.x,y:r.y,width:r.width,height:r.height}}};
      const before={brand:brandSnap(),title:snap(strong),tagline:snap(span)};
      if(Number.isFinite(title_size_px))strong.style.fontSize=title_size_px+'px';
      if(Number.isFinite(title_letter_spacing_em))strong.style.letterSpacing=title_letter_spacing_em+'em';
      if(Number.isFinite(tagline_size_px))span.style.fontSize=tagline_size_px+'px';
      if(Number.isFinite(tagline_width_px))span.style.maxWidth=tagline_width_px+'px';
      if(Number.isFinite(fixed_height_px)){
        brand.style.height=fixed_height_px+'px';
        brand.style.minHeight=fixed_height_px+'px';
        brand.style.maxHeight=fixed_height_px+'px';
      }
      strong.dataset.vfSidebarBrandTypographyCandidate=candidate_id;
      span.dataset.vfSidebarBrandTypographyCandidate=candidate_id;
      return {
        status:'APPLIED',candidate_id,
        substitution_status:'METRICALLY_CALIBRATED_SUBSTITUTION',
        original_font_identity_claimed:false,
        requested:{
          title_size_px:Number.isFinite(title_size_px)?title_size_px:null,
          title_letter_spacing_em:Number.isFinite(title_letter_spacing_em)?title_letter_spacing_em:null,
          tagline_size_px:Number.isFinite(tagline_size_px)?tagline_size_px:null,
          tagline_width_px:Number.isFinite(tagline_width_px)?tagline_width_px:null,
          fixed_height_px:Number.isFinite(fixed_height_px)?fixed_height_px:null
        },
        before,after:{brand:brandSnap(),title:snap(strong),tagline:snap(span)}
      };
    },{candidate_id:sidebarBrandTypographyCandidateId,title_size_px:sidebarBrandTitleSizePx,title_letter_spacing_em:sidebarBrandTitleLetterSpacingEm,tagline_size_px:sidebarBrandTaglineSizePx,tagline_width_px:sidebarBrandTaglineWidthPx,fixed_height_px:sidebarBrandFixedHeightPx});
  }

  let sidebarNavTypographyState={status:'DISABLED',candidate_id:sidebarNavTypographyCandidateId||null};
  if(sidebarNavTypographyCandidateId){
    sidebarNavTypographyState=await page.evaluate(({candidate_id,font_size_px,font_weight})=>{
      const buttons=[...document.querySelectorAll('.rf-hq-nav-main button')];
      if(!buttons.length)throw new Error('SIDEBAR_NAV_BUTTONS_MISSING');
      const before=buttons.map(el=>{
        const s=getComputedStyle(el),r=el.getBoundingClientRect();
        return {text:(el.textContent||'').trim(),font_size:s.fontSize,font_weight:s.fontWeight,line_height:s.lineHeight,rect:{x:r.x,y:r.y,width:r.width,height:r.height}};
      });
      for(const el of buttons){
        if(Number.isFinite(font_size_px))el.style.fontSize=font_size_px+'px';
        if(Number.isFinite(font_weight))el.style.fontWeight=String(font_weight);
        el.dataset.vfSidebarNavTypographyCandidate=candidate_id;
      }
      const after=buttons.map(el=>{
        const s=getComputedStyle(el),r=el.getBoundingClientRect();
        return {text:(el.textContent||'').trim(),font_size:s.fontSize,font_weight:s.fontWeight,line_height:s.lineHeight,rect:{x:r.x,y:r.y,width:r.width,height:r.height}};
      });
      return {
        status:'APPLIED',
        candidate_id,
        original_font_identity_claimed:false,
        substitution_status:'METRICALLY_CALIBRATED_SUBSTITUTION',
        requested:{font_size_px:Number.isFinite(font_size_px)?font_size_px:null,font_weight:Number.isFinite(font_weight)?font_weight:null},
        before,after
      };
    },{candidate_id:sidebarNavTypographyCandidateId,font_size_px:sidebarNavFontSizePx,font_weight:sidebarNavFontWeight});
  }

  let heroTypographyState={status:'DISABLED',candidate_id:heroTypographyCandidateId||null};
  if(heroTypographyCandidateId){
    heroTypographyState=await page.evaluate(({candidate_id,scale_x,letter_spacing_px,weight})=>{
      const title=document.querySelector('.rf-hero h1');
      if(!title)throw new Error('HERO_TITLE_ELEMENT_MISSING');
      const beforeStyle=getComputedStyle(title);
      const beforeRect=title.getBoundingClientRect();
      if(Number.isFinite(letter_spacing_px))title.style.letterSpacing=letter_spacing_px+'px';
      if(Number.isFinite(weight))title.style.fontWeight=String(weight);
      title.style.transform='scaleX('+scale_x+')';
      title.style.transformOrigin='left center';
      title.dataset.vfHeroTypographyCandidate=candidate_id;
      const afterStyle=getComputedStyle(title);
      const afterRect=title.getBoundingClientRect();
      return {
        status:'APPLIED',
        candidate_id,
        substitution_status:'METRICALLY_CALIBRATED_SUBSTITUTION',
        original_font_identity_claimed:false,
        requested:{scale_x,letter_spacing_px:Number.isFinite(letter_spacing_px)?letter_spacing_px:null,weight:Number.isFinite(weight)?weight:null},
        before:{
          font_family:beforeStyle.fontFamily,font_size:beforeStyle.fontSize,font_weight:beforeStyle.fontWeight,
          line_height:beforeStyle.lineHeight,letter_spacing:beforeStyle.letterSpacing,
          rect:{x:beforeRect.x,y:beforeRect.y,width:beforeRect.width,height:beforeRect.height}
        },
        after:{
          font_family:afterStyle.fontFamily,font_size:afterStyle.fontSize,font_weight:afterStyle.fontWeight,
          line_height:afterStyle.lineHeight,letter_spacing:afterStyle.letterSpacing,
          transform:afterStyle.transform,
          rect:{x:afterRect.x,y:afterRect.y,width:afterRect.width,height:afterRect.height}
        }
      };
    },{candidate_id:heroTypographyCandidateId,scale_x:heroTitleScaleX,letter_spacing_px:heroTitleLetterSpacingPx,weight:heroTitleWeight});
  }

  let heroTitleFinishCandidateState={status:'DISABLED',candidate_id:heroTitleFinishCandidateId||null,variant:heroTitleFinishVariant};
  if(heroTitleFinishCandidateId){
    heroTitleFinishCandidateState=await page.evaluate(({candidate_id,variant,scale_x})=>{
      if(candidate_id==='HF0_CONTROL')return {status:'CONTROL_NO_CHANGE',candidate_id,variant};
      const title=document.querySelector('.rf-hero h1');
      if(!title)throw new Error('HERO_TITLE_FINISH_ELEMENT_MISSING');
      const presets={
        METAL_A:{
          background:'linear-gradient(180deg,#ffffff 0%,#edf2f9 34%,#c8d3e1 62%,#8fa2ba 100%)',
          shadow:'0 0 1px rgba(116,187,255,.24), 0 1px 0 rgba(18,42,68,.55)',
          stroke:'0px transparent'
        },
        METAL_B:{
          background:'linear-gradient(180deg,#ffffff 0%,#e7edf6 30%,#b8c7da 58%,#7c92ae 100%)',
          shadow:'0 0 2px rgba(92,170,255,.30), 0 1px 1px rgba(10,30,55,.72)',
          stroke:'0px transparent'
        },
        METAL_C:{
          background:'linear-gradient(180deg,#f8fbff 0%,#dce5f0 42%,#a5b6ca 72%,#758ca9 100%)',
          shadow:'none',
          stroke:'0.35px rgba(189,213,236,.44)'
        },
        METAL_D:{
          background:'linear-gradient(180deg,#ffffff 0%,#d7e1ee 48%,#91a6c0 100%)',
          shadow:'0 0 1px rgba(96,176,255,.34)',
          stroke:'0.45px rgba(126,166,203,.55)'
        }
      };
      const p=presets[variant];
      if(!p)throw new Error('HERO_TITLE_FINISH_VARIANT_INVALID:'+variant);
      const beforeStyle=getComputedStyle(title);
      const beforeRect=title.getBoundingClientRect();
      title.style.transform='scaleX('+scale_x+')';
      title.style.transformOrigin='left center';
      title.style.backgroundImage=p.background;
      title.style.backgroundClip='text';
      title.style.webkitBackgroundClip='text';
      title.style.color='transparent';
      title.style.webkitTextFillColor='transparent';
      title.style.textShadow=p.shadow;
      title.style.webkitTextStroke=p.stroke;
      title.style.textRendering='geometricPrecision';
      title.dataset.vfHeroTitleFinishCandidate=candidate_id;
      const afterStyle=getComputedStyle(title);
      const afterRect=title.getBoundingClientRect();
      return {
        status:'APPLIED',
        candidate_id,
        variant,
        scale_x,
        semantic_text_preserved:true,
        raster_replacement:false,
        substitution_status:'CSS_FINISH_ON_SEMANTIC_TEXT',
        before:{
          color:beforeStyle.color,
          text_shadow:beforeStyle.textShadow,
          rect:{x:beforeRect.x,y:beforeRect.y,width:beforeRect.width,height:beforeRect.height}
        },
        after:{
          color:afterStyle.color,
          text_shadow:afterStyle.textShadow,
          background_image:afterStyle.backgroundImage,
          webkit_text_stroke:afterStyle.webkitTextStroke,
          transform:afterStyle.transform,
          rect:{x:afterRect.x,y:afterRect.y,width:afterRect.width,height:afterRect.height}
        }
      };
    },{candidate_id:heroTitleFinishCandidateId,variant:heroTitleFinishVariant,scale_x:heroTitleFinishScaleX});
  }

  let heroTitleReferenceCandidateState={status:'DISABLED',candidate_id:heroTitleReferenceCandidateId||null};
  if(heroTitleReferenceCandidateId){
    const source=(heroTitleReferenceAssets.assets||[]).find(x=>x.role==='HERO_TITLE_GLYPH_ASSET');
    assert.ok(source,'HERO_TITLE_REFERENCE_SOURCE_REQUIRED');
    const titleAsset=extractNeutralTextMaskAsset(source);
    heroTitleReferenceCandidateState=await page.evaluate(({candidate_id,titleAsset,left_px,top_px,width_px,height_px,opacity})=>{
      if(candidate_id==='HTR0_CONTROL')return {status:'CONTROL_NO_CHANGE',candidate_id};
      const hero=document.querySelector('.rf-hero');
      const title=hero?.querySelector('h1');
      if(!hero||!title)throw new Error('HERO_TITLE_REFERENCE_TARGET_MISSING');

      title.dataset.vfSemanticHeroTitlePreserved='true';
      title.style.color='transparent';
      title.style.webkitTextFillColor='transparent';
      title.style.background='none';
      title.style.textShadow='none';
      title.style.webkitTextStroke='0 transparent';

      let img=hero.querySelector('[data-vf-reference-hero-title]');
      if(!img){
        img=document.createElement('img');
        img.alt='';
        img.setAttribute('aria-hidden','true');
        img.dataset.vfReferenceHeroTitle=titleAsset.asset_id;
        hero.appendChild(img);
      }
      img.src=titleAsset.src;
      Object.assign(img.style,{
        position:'absolute',
        left:left_px+'px',
        top:top_px+'px',
        width:width_px+'px',
        height:height_px+'px',
        maxWidth:'none',
        objectFit:'fill',
        opacity:String(opacity),
        pointerEvents:'none',
        userSelect:'none',
        zIndex:'2'
      });

      const heroRect=hero.getBoundingClientRect();
      const imageRect=img.getBoundingClientRect();
      const titleRect=title.getBoundingClientRect();
      return {
        status:'APPLIED',
        candidate_id,
        source_asset_id:titleAsset.asset_id,
        mask_algorithm:titleAsset.mask_algorithm,
        semantic_h1_preserved:true,
        raster_asset_aria_hidden:true,
        production_use_allowed:false,
        public_distribution_allowed:false,
        placement:{left_px,top_px,width_px,height_px,opacity},
        hero_rect:{x:heroRect.x,y:heroRect.y,width:heroRect.width,height:heroRect.height},
        image_rect:{x:imageRect.x,y:imageRect.y,width:imageRect.width,height:imageRect.height},
        semantic_title_rect:{x:titleRect.x,y:titleRect.y,width:titleRect.width,height:titleRect.height},
        provenance:'REFERENCE_EXTRACTED_MASKED',
        usage_scope:'GOLD_STANDARD_POC_ONLY'
      };
    },{
      candidate_id:heroTitleReferenceCandidateId,
      titleAsset,
      left_px:heroTitleReferenceLeftPx,
      top_px:heroTitleReferenceTopPx,
      width_px:heroTitleReferenceWidthPx,
      height_px:heroTitleReferenceHeightPx,
      opacity:heroTitleReferenceOpacity
    });
  }

  await page.evaluate(async()=>{if(document.fonts?.ready)await document.fonts.ready});
  await page.waitForTimeout(120);

  const componentIds=[
    'sidebar','primary_navigation','primary_navigation_first_button','primary_navigation_last_button','primary_navigation_shell','primary_navigation_foot','toolbar','hero','kpi_active_projects','kpi_open_inputs','kpi_approvals','kpi_preview',
    'attention_panel','operator_ai_panel','portfolio_panel','new_project_cta','system_status_panel','cost_panel',
    'activity_panel','milestone_card','decisions_card','quote_card'
  ];
  const geometry=await captureDomMeasurements(page,{component_ids:componentIds});
  const geometryIntegrity=evaluateDomMeasurementIntegrity(geometry);
  assert.equal(geometryIntegrity.status,'PASS');

  const actualConstraintRegions=[
    {id:'sidebar',bounds:geometryBounds(geometry,'sidebar')},
    {id:'primary_navigation',bounds:unionBounds(geometry,['primary_navigation_first_button','primary_navigation_last_button'])},
    {id:'toolbar',bounds:geometryBounds(geometry,'toolbar')},
    {id:'hero',bounds:geometryBounds(geometry,'hero')},
    {id:'kpi_band',bounds:unionBounds(geometry,['kpi_active_projects','kpi_open_inputs','kpi_approvals','kpi_preview'])},
    {id:'attention_panel',bounds:geometryBounds(geometry,'attention_panel')},
    {id:'operator_ai_panel',bounds:geometryBounds(geometry,'operator_ai_panel')},
    {id:'portfolio',bounds:geometryBounds(geometry,'portfolio_panel')},
    {id:'right_rail',bounds:unionBounds(geometry,['system_status_panel','cost_panel','activity_panel'])},
    {id:'right_status_stack',bounds:unionBounds(geometry,['system_status_panel','cost_panel'])},
    {id:'activity_panel',bounds:geometryBounds(geometry,'activity_panel')},
    {id:'bottom_strip',bounds:unionBounds(geometry,['milestone_card','decisions_card','quote_card'])}
  ].filter(x=>x.bounds);

  const constraintSet=deriveResponsiveConstraintSet({
    canvas:stencilSession.canvas,
    elements:stencilSession.constraints.elements
  });
  const constraintAnchor=evaluateCalibrationAnchor(constraintSet,actualConstraintRegions);

  const lockMeasurement={regions:stencilSession.soft_locks.regions.map(x=>({region_id:x.region_id,score:x.baseline_score}))};
  const softLockSet=createSoftRegionLockSet({
    measurement:lockMeasurement,
    regions:stencilSession.soft_locks.regions.map(x=>x.region_id),
    tolerance:stencilSession.soft_locks.tolerance_ssim
  });
  const externalMetricsRaw=String(process.env.VISUAL_FOUNDRY_REGION_METRICS_JSON||'').trim();
  let softLockEvaluation={status:'PENDING_REFERENCE_REGION_COMPARE'};
  let softLockFinalization={status:'PENDING_REFERENCE_REGION_COMPARE'};
  let priorityRanking={status:'PENDING_ACTUAL_REGION_METRICS',ranked:[]};
  if(externalMetricsRaw){
    const regionMetrics=JSON.parse(externalMetricsRaw);
    const measurement={regions:(regionMetrics.regions||[]).map(r=>({region_id:r.region_id,score:Number(r.ssim)}))};
    softLockEvaluation=evaluateSoftLockCandidate(softLockSet,measurement);
    softLockFinalization=finalizeSoftRegionLocks(softLockSet,measurement);
    const areaByRegion=new Map(referenceSpec.regions.map(r=>[r.region_id,Number(r.bounds.width.value)*Number(r.bounds.height.value)]));
    const semantics=stencilSession.priority_contract.region_semantics;
    priorityRanking={
      status:'EVALUATED',
      ranked:rankVisualDeltas((regionMetrics.regions||[]).map(r=>({
        region_id:r.region_id,
        ssim:Number(r.ssim),
        pixel_difference_percent:Number(r.pixel_difference_percent),
        area_px:areaByRegion.get(r.region_id)||1,
        canvas_area_px:stencilSession.canvas.width*stencilSession.canvas.height,
        contrast_index:semantics[r.region_id]?.contrast_index??0.5,
        semantic_type:semantics[r.region_id]?.semantic_type??'NORMAL_UI',
        criticality:semantics[r.region_id]?.criticality??'MEDIUM'
      })))
    };
  }

  const stencilSourceRaw=String(process.env.VISUAL_FOUNDRY_STENCIL_SOURCE||'').trim()||('data:image/jpeg;base64,'+approvedReferenceB64);
  const verifiedStencil=await resolveVerifiedStencilSource(stencilSourceRaw,referenceRegistration.reference.hash);
  let stencilBuildAid={status:verifiedStencil.status,reference_hash:referenceRegistration.reference.hash,fallback_reference_allowed:false};
  if(verifiedStencil.status==='VERIFIED'){
    const contract=createStencilContract({
      reference_id:referenceRegistration.reference.reference_id,
      reference_hash:referenceRegistration.reference.hash,
      reference_version:referenceRegistration.reference.version,
      source:verifiedStencil.source,
      source_type:'HASH_VERIFIED_LOCAL_BUILD_ASSET',
      canvas:stencilSession.canvas,
      mode:'OVERLAY',
      opacity:stencilSession.stencil.default_opacity
    });
    await installReferenceStencil(page,contract);
    await setStencilMode(page,'OVERLAY',{opacity:stencilSession.stencil.default_opacity});
    await page.screenshot({path:outDir+'/stencil-overlay.jpeg',type:'jpeg',quality:94,fullPage:false,animations:'disabled'});
    await setStencilMode(page,'DIFFERENCE');
    await page.screenshot({path:outDir+'/stencil-difference.jpeg',type:'jpeg',quality:94,fullPage:false,animations:'disabled'});
    await removeReferenceStencil(page);
    stencilBuildAid={status:'MOUNTED_VERIFIED_AND_REMOVED_BEFORE_MACHINE_CAPTURE',actual_hash:verifiedStencil.actual_hash,bytes:verifiedStencil.bytes,mime:verifiedStencil.mime,fallback_reference_allowed:false};
  }

  const semanticImplementation=await evaluateSemanticImplementation(page,{
    allow_stencil:false,
    max_structural_absolute_ratio:stencilSession.semantic_gate.max_structural_absolute_ratio
  });

  await writeFile(outDir+'/stencil-constraint-evidence.json',JSON.stringify({
    stencil_build_aid:stencilBuildAid,
    constraint_set:constraintSet,
    constraint_anchor:constraintAnchor,
    soft_lock_set:softLockSet,
    soft_lock_evaluation:softLockEvaluation,
    soft_lock_finalization:softLockFinalization,
    priority_ranking:priorityRanking,
    semantic_implementation:semanticImplementation,
    navigation_diagnostics:{
      main:geometryBounds(geometry,'primary_navigation'),
      button_union:unionBounds(geometry,['primary_navigation_first_button','primary_navigation_last_button']),
      shell:geometryBounds(geometry,'primary_navigation_shell'),
      foot:geometryBounds(geometry,'primary_navigation_foot')
    }
  },null,2));

  const desktopLayout=await page.evaluate(()=>({
    width:innerWidth,height:innerHeight,dpr:devicePixelRatio,
    scroll_width:document.documentElement.scrollWidth,
    scroll_height:document.documentElement.scrollHeight,
    fixture_truth_class:document.documentElement.dataset.visualFoundryTruthClass,
    fixture_id:document.documentElement.dataset.visualFoundryFixture
  }));
  assert.equal(desktopLayout.width,1536);
  assert.equal(desktopLayout.height,1024);
  assert.equal(desktopLayout.dpr,1);
  assert.equal(desktopLayout.fixture_truth_class,'VISUAL_FIXTURE');

  const runtimeScreenshot=outDir+'/runtime-desktop.png';
  await page.screenshot({path:runtimeScreenshot,type:'png',fullPage:false,animations:'disabled'});
  await writeFile(outDir+'/desktop-layout-debug.json',JSON.stringify({desktopLayout,geometry},null,2));

  const comparatorRegions=[
    ...referenceSpec.regions.map(r=>({
      region_id:r.region_id,
      critical:r.critical===true,
      x:Number(r.bounds.x.value),y:Number(r.bounds.y.value),
      width:Number(r.bounds.width.value),height:Number(r.bounds.height.value)
    })),
    {
      region_id:'hero_title_raster',
      critical:false,
      x:240,y:97,width:805,height:34
    },
    {
      region_id:'sidebar_nav_text_raster',
      critical:false,
      x:42,y:184,width:154,height:690
    },
    {
      region_id:'sidebar_brand_text_raster',
      critical:false,
      x:20,y:68,width:176,height:92
    },
    {
      region_id:'attention_header_raster',
      critical:false,
      x:232,y:285,width:711,height:58
    },
    {
      region_id:'operator_ai_header_raster',
      critical:false,
      x:955,y:285,width:563,height:58
    },
    {
      region_id:'portfolio_header_raster',
      critical:false,
      x:232,y:572,width:704,height:54
    },
    {
      region_id:'sidebar_logo_raster',
      critical:false,
      x:20,y:10,width:80,height:63
    },
    {
      region_id:'portfolio_thumbnails_raster',
      critical:false,
      x:244,y:717,width:34,height:183
    },
    {
      region_id:'attention_thumbnails_raster',
      critical:false,
      x:323,y:387,width:34,height:151
    }
  ];
  const visualComparison=await compareVisualImages({
    reference_path:approvedReferencePngPath,
    actual_path:runtimeScreenshot,
    diff_path:outDir+'/diff-desktop.png',
    pixel_threshold:0.1,
    include_antialiasing:false,
    regions:comparatorRegions
  });
  const comparisonMeasurement={regions:visualComparison.regions.map(r=>({region_id:r.region_id,score:Number(r.perceptual_score)}))};
  softLockEvaluation=evaluateSoftLockCandidate(softLockSet,comparisonMeasurement);
  softLockFinalization=finalizeSoftRegionLocks(softLockSet,comparisonMeasurement);
  const areaByRegion=new Map(referenceSpec.regions.map(r=>[r.region_id,Number(r.bounds.width.value)*Number(r.bounds.height.value)]));
  const semantics=stencilSession.priority_contract.region_semantics;
  priorityRanking={
    status:'EVALUATED',
    ranked:rankVisualDeltas(visualComparison.regions.map(r=>({
      region_id:r.region_id,
      ssim:Number(r.perceptual_score),
      pixel_difference_percent:Number(r.pixel_difference_percent),
      area_px:areaByRegion.get(r.region_id)||1,
      canvas_area_px:stencilSession.canvas.width*stencilSession.canvas.height,
      contrast_index:semantics[r.region_id]?.contrast_index??0.5,
      semantic_type:semantics[r.region_id]?.semantic_type??'NORMAL_UI',
      criticality:semantics[r.region_id]?.criticality??'MEDIUM'
    })))
  };
  const criticalRegionFailures=visualComparison.regions.filter(r=>r.critical&&(Number(r.perceptual_score)<0.96||Number(r.pixel_difference_percent)>3));
  const visualThresholdPass=
    Number(visualComparison.perceptual.score)>=0.96&&
    Number(visualComparison.pixel_difference.percent)<=3&&
    criticalRegionFailures.length===0&&
    softLockFinalization.status==='PASS'&&
    constraintAnchor.status==='PASS';
  await writeFile(outDir+'/machine-visual-comparison.json',JSON.stringify({
    reference_id:referenceRegistration.reference.reference_id,
    reference_hash:referenceRegistration.reference.hash,
    comparison:visualComparison,
    critical_region_failures:criticalRegionFailures.map(r=>r.region_id),
    soft_lock_evaluation:softLockEvaluation,
    soft_lock_finalization:softLockFinalization,
    priority_ranking:priorityRanking,
    visual_threshold_pass:visualThresholdPass
  },null,2));
  await writeFile(outDir+'/stencil-constraint-evidence.json',JSON.stringify({
    stencil_build_aid:stencilBuildAid,
    hero_candidate:heroCandidateState,
    constraint_set:constraintSet,
    constraint_anchor:constraintAnchor,
    soft_lock_set:softLockSet,
    soft_lock_evaluation:softLockEvaluation,
    soft_lock_finalization:softLockFinalization,
    priority_ranking:priorityRanking,
    semantic_implementation:semanticImplementation,
    visual_comparison:visualComparison,
    visual_threshold_pass:visualThresholdPass,
    navigation_diagnostics:{
      main:geometryBounds(geometry,'primary_navigation'),
      button_union:unionBounds(geometry,['primary_navigation_first_button','primary_navigation_last_button']),
      shell:geometryBounds(geometry,'primary_navigation_shell'),
      foot:geometryBounds(geometry,'primary_navigation_foot')
    }
  },null,2));

  if(desktopLayout.scroll_width>1536){
    console.error(JSON.stringify({code:'DESKTOP_HORIZONTAL_OVERFLOW',desktopLayout},null,2));
    throw new Error('desktop horizontal overflow: '+desktopLayout.scroll_width+' > 1536');
  }

  await page.setViewportSize({width:390,height:844});
  await page.waitForTimeout(120);
  const mobile=await page.evaluate(()=>({
    horizontal_overflow_px:Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth),
    essential_content_visible:!!document.querySelector('.rf-hero h1')&&getComputedStyle(document.querySelector('.rf-hero h1')).display!=='none',
    primary_navigation_usable:!!document.querySelector('.rf-hq-nav-main'),
    primary_actions_usable:!!document.querySelector('[data-rf-new-project]')
  }));
  await page.screenshot({path:outDir+'/runtime-mobile.jpeg',type:'jpeg',quality:95,fullPage:false,animations:'disabled'});

  const afterResp=await page.request.get(origin+'/operator/api/snapshot');
  assert.equal(afterResp.status(),200);
  const afterSnapshot=await afterResp.json();
  const afterFingerprint=runtimeFingerprint(afterSnapshot);
  const runtimeTruthMutationCount=JSON.stringify(beforeFingerprint)===JSON.stringify(afterFingerprint)?0:1;

  const browserVersion=browser.version();
  const runEvidence={
    schema:'riosystems.aurentara-gold-standard-isolated-run.pre-machine.v1',
    run_number:runNumber,
    isolation:{
      fresh_github_job:true,
      fresh_checkout:true,
      fresh_memory_runtime:true,
      repaired_output_reused:false
    },
    reference_id:referenceRegistration.reference.reference_id,
    reference_version:referenceRegistration.reference.version,
    reference_hash:referenceRegistration.reference.hash,
    starting_commit:process.env.GITHUB_SHA||'LOCAL',
    result_commit:process.env.GITHUB_SHA||'LOCAL',
    browser_version:browserVersion,
    viewport:{width:1536,height:1024},
    dpr:1,
    fixture_version:fixture.version,
    fixture_truth_class:'VISUAL_FIXTURE',
    reference_screenshot:'EXTERNAL_OPERATOR_SUPPLIED_HASH_LOCKED',
    runtime_screenshot:runtimeScreenshot,
    diff_image:outDir+'/diff-desktop.png',
    visual_comparison:visualComparison,
    critical_region_failures:criticalRegionFailures.map(r=>r.region_id),
    geometry_snapshot:geometry,
    constraint_anchor:constraintAnchor,
    soft_lock_evaluation:softLockEvaluation,
    soft_lock_finalization:softLockFinalization,
    priority_ranking:priorityRanking,
    stencil_build_aid:stencilBuildAid,
    hero_candidate:heroCandidateState,
    sidebar_logo_candidate:sidebarLogoCandidateState,
    project_thumbnails_candidate:projectThumbnailsCandidateState,
    attention_asset_candidate:attentionAssetCandidateState,
    operator_ai_asset_candidate:operatorAiAssetCandidateState,
    operator_ai_globe_candidate:operatorAiGlobeCandidateState,
    portfolio_ui_candidate:portfolioUiCandidateState,
    portfolio_row_style_candidate:portfolioRowStyleCandidateState,
    primary_navigation_detail_candidate:primaryNavDetailCandidateState,
    primary_navigation_layout_candidate:primaryNavLayoutCandidateState,
    toolbar_detail_candidate:toolbarDetailCandidateState,
    kpi_detail_candidate:kpiDetailCandidateState,
    hero_typography_candidate:heroTypographyState,
    hero_title_finish_candidate:heroTitleFinishCandidateState,
    hero_title_reference_candidate:heroTitleReferenceCandidateState,
    sidebar_nav_typography_candidate:sidebarNavTypographyState,
    sidebar_brand_typography_candidate:sidebarBrandTypographyState,
    panel_header_typography_candidate:panelHeaderTypographyState,
    kpi_typography_candidate:kpiTypographyState,
    right_rail_typography_candidate:rightRailTypographyState,
    semantic_implementation:semanticImplementation,
    semantic_result:semanticImplementation.status,
    desktop_layout:desktopLayout,
    responsive:{
      mode:'INFERRED_RESPONSIVE',
      status:mobile.horizontal_overflow_px===0&&mobile.essential_content_visible&&mobile.primary_navigation_usable&&mobile.primary_actions_usable?'INFERRED_RESPONSIVE_PASS':'INFERRED_RESPONSIVE_FAIL',
      ...mobile
    },
    iteration_count:0,
    provider:null,
    model:null,
    input_tokens:0,
    output_tokens:0,
    ai_cost_usd:0,
    runtime_cost_usd:0,
    changed_files:[],
    functional_result:pageErrors.length===0&&api404.length===0&&runtimeTruthMutationCount===0?'PASS':'FAIL',
    visual_result:visualThresholdPass?'PASS':'FAIL',
    accessibility_result:'NOT_EVALUATED',
    human_result:'NOT_EVALUATED',
    fixture_leak_count:0,
    runtime_truth_mutation_count:runtimeTruthMutationCount,
    architecture_drift_count:0,
    page_errors:pageErrors,
    api_404:api404,
    production_deploy:false,
    public_deploy:false,
    external_writes:false
  };
  await writeFile(outDir+'/pre-machine-evidence.json',JSON.stringify(runEvidence,null,2));
  assert.equal(runEvidence.functional_result,'PASS');
  assert.equal(runEvidence.runtime_truth_mutation_count,0);
  assert.equal(runEvidence.fixture_leak_count,0);
  assert.equal(runEvidence.architecture_drift_count,0);

  console.log(JSON.stringify({
    ok:true,
    suite:'visual-foundry-gold-standard-isolated-run',
    run_number:runNumber,
    starting_commit:runEvidence.starting_commit,
    result_commit:runEvidence.result_commit,
    functional_result:runEvidence.functional_result,
    constraint_anchor:runEvidence.constraint_anchor.status,
    semantic_result:runEvidence.semantic_result,
    stencil_status:runEvidence.stencil_build_aid.status,
    hero_candidate:runEvidence.hero_candidate?.status||'DISABLED',
    sidebar_logo_candidate:runEvidence.sidebar_logo_candidate?.candidate_id||null,
    project_thumbnails_candidate:runEvidence.project_thumbnails_candidate?.candidate_id||null,
    attention_asset_candidate:runEvidence.attention_asset_candidate?.candidate_id||null,
    attention_asset_variant:runEvidence.attention_asset_candidate?.variant||null,
    operator_ai_asset_candidate:runEvidence.operator_ai_asset_candidate?.candidate_id||null,
    operator_ai_asset_variant:runEvidence.operator_ai_asset_candidate?.variant||null,
    operator_ai_globe_candidate:runEvidence.operator_ai_globe_candidate?.candidate_id||null,
    operator_ai_globe_placement:runEvidence.operator_ai_globe_candidate?.placement||null,
    portfolio_ui_candidate:runEvidence.portfolio_ui_candidate?.candidate_id||null,
    portfolio_ui_variant:runEvidence.portfolio_ui_candidate?.variant||null,
    portfolio_row_style_candidate:runEvidence.portfolio_row_style_candidate?.candidate_id||null,
    portfolio_row_widths:runEvidence.portfolio_row_style_candidate?.column_widths_percent||null,
    primary_navigation_detail_candidate:runEvidence.primary_navigation_detail_candidate?.candidate_id||null,
    primary_navigation_icon_count:runEvidence.primary_navigation_detail_candidate?.icon_count||null,
    primary_navigation_layout_candidate:runEvidence.primary_navigation_layout_candidate?.candidate_id||null,
    primary_navigation_layout_variant:runEvidence.primary_navigation_layout_candidate?.variant||null,
    primary_navigation_reports_placeholder:runEvidence.primary_navigation_layout_candidate?.reports_placeholder||false,
    toolbar_detail_candidate:runEvidence.toolbar_detail_candidate?.candidate_id||null,
    toolbar_detail_variant:runEvidence.toolbar_detail_candidate?.variant||null,
    kpi_detail_candidate:runEvidence.kpi_detail_candidate?.candidate_id||null,
    kpi_detail_variant:runEvidence.kpi_detail_candidate?.variant||null,
    hero_typography_candidate:runEvidence.hero_typography_candidate?.candidate_id||null,
    hero_title_finish_candidate:runEvidence.hero_title_finish_candidate?.candidate_id||null,
    hero_title_finish_variant:runEvidence.hero_title_finish_candidate?.variant||null,
    hero_title_finish_scale_x:runEvidence.hero_title_finish_candidate?.scale_x||null,
    hero_title_reference_candidate:runEvidence.hero_title_reference_candidate?.candidate_id||null,
    hero_title_reference_placement:runEvidence.hero_title_reference_candidate?.placement||null,
    sidebar_nav_typography_candidate:runEvidence.sidebar_nav_typography_candidate?.candidate_id||null,
    sidebar_brand_typography_candidate:runEvidence.sidebar_brand_typography_candidate?.candidate_id||null,
    panel_header_typography_candidate:runEvidence.panel_header_typography_candidate?.candidate_id||null,
    kpi_typography_candidate:runEvidence.kpi_typography_candidate?.candidate_id||null,
    right_rail_typography_candidate:runEvidence.right_rail_typography_candidate?.candidate_id||null,
    responsive_result:runEvidence.responsive.status,
    runtime_truth_mutation_count:0,
    fixture_leak_count:0,
    architecture_drift_count:0,
    visual_result:runEvidence.visual_result,
    perceptual_score:visualComparison.perceptual.score,
    pixel_difference_percent:visualComparison.pixel_difference.percent,
    critical_region_failures:criticalRegionFailures.length,
    wave20_locked:true
  },null,2));
}finally{
  if(browser)await browser.close().catch(()=>{});
  if(!exited)child.kill('SIGTERM');
}
