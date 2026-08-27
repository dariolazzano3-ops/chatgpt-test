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

console.log('Natural edit smoke: cumulative multi-element edits passed');
