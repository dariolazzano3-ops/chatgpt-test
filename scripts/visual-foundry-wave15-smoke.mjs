import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { compareTypography, createFontRecord, validateFontRecord } from '../src/visual-foundry/typography-contract.js';

const reference=createFontRecord({font_id:'inter-heading',family:'Inter',source:'operator-font-package',weight:'700',size:42,line_height:48,letter_spacing:-0.4,license:'licensed',fallback:'Arial',loaded:true,role:'heading',fidelity_importance:'HIGH',metrics:{ascent:.9,descent:.2}});
const runtime=createFontRecord({font_id:'inter-heading-runtime',family:'Inter',source:'runtime',weight:'700',size:42,line_height:48,letter_spacing:-0.4,license:'licensed',fallback:'Arial',loaded:true,role:'heading',fidelity_importance:'HIGH'});
assert.equal(validateFontRecord(reference).ok,true);

const pass=compareTypography({reference_id:'ref',implementation_commit:'c15',viewport:{width:1440,height:1100,device_pixel_ratio:1},reference_fonts:[reference],runtime_fonts:[runtime]});
assert.equal(pass.status,'PASS');
assert.equal(pass.typography_score,1);
assert.equal(pass.font_substitution_count,0);

const fallback=createFontRecord({family:'Arial',source:'system',weight:'700',size:42,line_height:48,letter_spacing:-0.4,license:'system',fallback:'sans-serif',loaded:true,role:'heading',fidelity_importance:'HIGH'});
const substitution=compareTypography({reference_id:'ref',implementation_commit:'c15',viewport:{width:1440,height:1100,device_pixel_ratio:1},reference_fonts:[reference],runtime_fonts:[fallback]});
assert.equal(substitution.status,'FAIL');
assert.equal(substitution.font_substitution_count,1);
assert.ok(substitution.deltas.some(d=>d.difference==='FONT_SUBSTITUTION_DELTA'&&d.blocking===true));
assert.equal(substitution.font_difference_cannot_be_hidden_by_layout,true);

const unlicensed=createFontRecord({...reference,font_id:'mystery',family:'Mystery',source:'reference',license:'unknown',role:'body',loaded:true});
const licenseBlocked=compareTypography({reference_id:'ref',implementation_commit:'c15',viewport:{width:1440,height:1100,device_pixel_ratio:1},reference_fonts:[unlicensed],runtime_fonts:[unlicensed]});
assert.equal(licenseBlocked.status,'FAIL');
assert.equal(licenseBlocked.font_license_blocker_count,1);

const metricsOff=createFontRecord({...runtime,size:46});
const metricFail=compareTypography({reference_id:'ref',implementation_commit:'c15',viewport:{width:1440,height:1100,device_pixel_ratio:1},reference_fonts:[reference],runtime_fonts:[metricsOff]});
assert.ok(metricFail.deltas.some(d=>d.evidence?.code==='FONT_METRIC_DELTA'));

const evidence={ok:true,suite:'visual-foundry-wave15-smoke',font_record:'PASS',font_substitution_delta:'PASS',font_license_blocker:'PASS',font_metrics:'PASS',layout_cannot_hide_font_difference:true,production_deploy:false,external_writes:false};
await mkdir('artifacts/visual-foundry/wave15',{recursive:true});
await writeFile('artifacts/visual-foundry/wave15/evidence.json',JSON.stringify({evidence,pass,substitution,licenseBlocked,metricFail},null,2));
console.log(JSON.stringify(evidence,null,2));
