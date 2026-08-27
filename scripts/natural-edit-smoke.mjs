import { planNaturalEdit } from '../src/edit-planner.js';
import { executeNaturalEditPlan } from '../src/edit-executor.js';
import { analyzeProject } from '../src/project-analyzer.js';

const html = `<!doctype html><html><body><header class="site-header"></header><main><section class="hero"><div class="hero-copy"><h1>Old headline</h1><p>Old supporting text</p><a class="cta" href="#contact">Old CTA</a></div></section><section class="section"><div class="grid"><article class="card">One</article><article class="card">Two</article></div></section></main></body></html>`;
const css = `.hero{min-height:80svh}.hero-copy{display:flex;flex-direction:column}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))}.card{border-radius:8px;padding:16px}.cta{display:inline-block}`;

function run(prompt, currentHtml, currentCss) {
  const analysis = analyzeProject({ html: currentHtml, css: currentCss });
  const plan = planNaturalEdit(prompt, analysis);
  const result = executeNaturalEditPlan({ html: currentHtml, css: currentCss, plan });
  if (!result.ok) throw new Error(`${prompt}: ${result.error}`);
  return result;
}

const first = run('Mach die Cards runder und das Grid auf 3 Spalten', html, css);
if (!first.css.includes('border-radius: 22px')) throw new Error('card radius edit missing');
if (!first.css.includes('repeat(3, minmax(0, 1fr))')) throw new Error('grid columns edit missing');

const second = run('Ändere den Button auf Jetzt starten', first.html, first.css);
if (!second.html.includes('>Jetzt starten</a>')) throw new Error('CTA text edit missing');
if (!second.css.includes('border-radius: 22px')) throw new Error('prior card CSS edit was lost');
if (!second.css.includes('repeat(3, minmax(0, 1fr))')) throw new Error('prior grid CSS edit was lost');

const third = run('Ändere die Subheadline auf Wir bauen schneller.', second.html, second.css);
if (!third.html.includes('<p>Wir bauen schneller</p>')) throw new Error('subheadline edit missing');

const projectHtml = `<!doctype html><html><body><main><section class="hero"><div class="hero-copy"><h1>Factory</h1><a class="button primary" href="#factory-control">Jetzt starten</a><a class="button secondary" href="#factory-flow">Mehr</a></div></section></main></body></html>`;
const projectCss = `.hero{display:grid}.hero-copy{display:flex}.button{display:inline-flex}.primary{background:#fff}.secondary{opacity:.7}`;
const projectAnalysis = analyzeProject({ html: projectHtml, css: projectCss });
if (projectAnalysis.semantic?.cta !== '.primary') throw new Error(`project CTA selector not resolved to .primary: ${projectAnalysis.semantic?.cta}`);
const fourthPlan = planNaturalEdit('Ändere den Button auf V3.1 Test', projectAnalysis);
const fourth = executeNaturalEditPlan({ html: projectHtml, css: projectCss, plan: fourthPlan });
if (!fourth.ok) throw new Error(`resolved CTA edit failed: ${fourth.error}`);
if (!fourth.html.includes('class="button primary" href="#factory-control">V3.1 Test</a>')) throw new Error('resolved .primary CTA text edit missing');
if (!fourth.html.includes('class="button secondary" href="#factory-flow">Mehr</a>')) throw new Error('secondary CTA changed unexpectedly');

console.log('Natural edit smoke: cumulative and project-resolved CTA edits passed');
