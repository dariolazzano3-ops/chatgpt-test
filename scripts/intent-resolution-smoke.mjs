import assert from 'node:assert/strict';
import { analyzeProject, resolveTextReference } from '../src/project-analyzer.js';
import { analyzeEditIntent } from '../src/edit-clarifier.js';
import { planNaturalEdit } from '../src/edit-planner.js';
import { executeNaturalEditPlan } from '../src/edit-executor.js';

const html = `<!doctype html><html><body><section class="intro"><span id="factory-version-hero">LEAN VERSION 3.4</span><strong id="active-project-name">RIOSYSTEMS DASHBOARD</strong></section></body></html>`;
const css = `.intro{display:flex}#factory-version-hero{font-size:12px}`;
const prompt = 'da wo aktuell lean version 3.4 steht mach das als cooles abgespacetes muster';

const analysis = analyzeProject({ html, css });
assert.equal(analysis.version, 2);
assert.equal(analysis.capabilities.has_text_anchors, true);
const resolved = resolveTextReference(prompt, analysis);
assert.equal(resolved.matched, true);
assert.equal(resolved.unique, true);
assert.equal(resolved.best.selector, '#factory-version-hero');

const clarification = analyzeEditIntent(prompt, analysis);
assert.equal(clarification.needs_clarification, false);
assert.equal(clarification.project_context_used, true);
assert.equal(clarification.reference_resolution.best.selector, '#factory-version-hero');

const plan = planNaturalEdit(prompt, analysis);
assert.equal(plan.project_aware, true);
assert.equal(plan.resolved_reference.selector, '#factory-version-hero');
assert.equal(plan.operations.some((op) => op.action === 'context_emphasis'), true);
const result = executeNaturalEditPlan({ html, css, plan });
assert.equal(result.ok, true);
assert.equal(result.css.includes('#factory-version-hero'), true);
assert.equal(result.css.includes('Project Factory V3 Overrides'), true);

console.log(JSON.stringify({ ok:true, resolved:resolved.best.selector, plan_version:plan.version, operations:plan.operations.length }, null, 2));
