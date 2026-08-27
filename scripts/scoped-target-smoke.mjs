import { analyzeProject } from '../src/project-analyzer.js';
import { planNaturalEdit } from '../src/edit-planner.js';
import { executeNaturalEditPlan } from '../src/edit-executor.js';

const html = `<!doctype html><html><body><main>
<section class="hero"><div class="hero-copy"><h1>Hero title</h1><p>Hero copy</p><a class="cta">Hero CTA</a></div></section>
<section class="services"><h2>Services</h2><div class="grid"><article class="card">A</article><article class="card">B</article></div><a class="cta">Services CTA</a></section>
<section class="references"><h2>References</h2><div class="grid"><article class="card">C</article></div></section>
</main></body></html>`;
const css = `.hero{}.hero-copy{}.services{}.references{}.grid{display:grid}.card{border-radius:8px}.cta{}`;

function run(prompt, h=html, c=css) {
  const plan = planNaturalEdit(prompt, analyzeProject({html:h, css:c}));
  const result = executeNaturalEditPlan({html:h, css:c, plan});
  if (!result.ok) throw new Error(`${prompt}: ${result.error}`);
  return result;
}

const hero = run('Ändere den Button im Hero auf Los gehts');
if (!hero.html.includes('>Los gehts</a>')) throw new Error('hero CTA was not changed');
if (!hero.html.includes('>Services CTA</a>')) throw new Error('services CTA changed unexpectedly');

const services = run('Mach nur die Karten im Leistungsbereich runder');
if (!services.css.includes('.services,.service-section .card')) {
  if (!services.css.includes('.services,.service-section')) throw new Error('services card scope missing');
}
if (!services.css.includes('border-radius: 22px')) throw new Error('services cards were not rounded');

const second = run('Mach die zweite Section luftiger');
if (!second.css.includes('section:nth-of-type(2)')) throw new Error('ordinal section selector missing');
if (!second.css.includes('padding-top: 88px')) throw new Error('ordinal section spacing missing');

console.log('Scoped target smoke: section and element targeting passed');
