import { planNaturalEdit } from '../src/edit-planner.js';
import { executeNaturalEditPlan } from '../src/edit-executor.js';
import { analyzeProject } from '../src/project-analyzer.js';

const html = `<!doctype html><html><body><main>
<section class="hero"><div class="hero-copy"><h1>Old title</h1><p>Old copy</p><a class="cta">Old CTA</a></div></section>
<section class="services"><h2>Services</h2><div class="grid"><article class="card">A</article><article class="card">B</article></div><a class="cta">Services CTA</a></section>
</main></body></html>`;
const css = `.hero-copy{display:flex}.services{}.grid{display:grid}.card{border-radius:8px;padding:16px}.cta{}`;

function run(prompt, h=html, c=css) {
  const plan = planNaturalEdit(prompt, analyzeProject({ html:h, css:c }));
  const result = executeNaturalEditPlan({ html:h, css:c, plan });
  if (!result.ok) throw new Error(`${prompt}: ${result.error}`);
  return { plan, result };
}

const hero = run('Ändere im Hero die Headline auf LEAN V3 und den Button auf Demo starten');
if (hero.plan.operations.filter((op) => op.action === 'replace_text').length !== 2) throw new Error('compound hero text plan missing operations');
if (!hero.result.html.includes('<h1>LEAN V3</h1>')) throw new Error('compound headline edit missing');
if (!hero.result.html.includes('>Demo starten</a>')) throw new Error('compound CTA edit missing');
if (!hero.result.html.includes('>Services CTA</a>')) throw new Error('compound hero edit leaked into services');

const services = run('Mach im Leistungsbereich die Karten runder und das Grid auf 3 Spalten');
if (!services.result.css.includes('border-radius: 22px')) throw new Error('compound scoped card edit missing');
if (!services.result.css.includes('repeat(3, minmax(0, 1fr))')) throw new Error('compound scoped grid edit missing');
if (!services.result.css.includes(':is(#factory-services,.services,.service-section)')) throw new Error('compound services scope missing');

console.log('Compound edit smoke: multi-operation scoped edits passed');
