import fs from 'node:fs';

const failures = [];
const passes = [];
const read = (path) => fs.existsSync(path) ? fs.readFileSync(path, 'utf8') : (failures.push(`missing ${path}`), '');
const need = (label, text, expected) => text.includes(expected) ? passes.push(label) : failures.push(`${label}: expected ${JSON.stringify(expected)}`);

const analyzer = read('src/project-analyzer.js');
const clarifier = read('src/edit-clarifier.js');
const planner = read('src/edit-planner.js');
const executor = read('src/edit-executor.js');
const evolver = read('src/evolver.js');
const pkg = read('package.json');

need('Project analyzer extracts text anchors', analyzer, 'text_anchors');
need('Project analyzer resolves natural text references', analyzer, 'resolveTextReference');
need('Clarifier uses project context', clarifier, 'project_context_used');
need('Clarifier exposes reference resolution', clarifier, 'reference_resolution');
need('Planner emits resolved project reference', planner, 'resolved_reference');
need('Planner supports contextual emphasis', planner, 'context_emphasis');
need('Executor safely handles resolved reference', executor, 'semantic==="resolved_reference"');
need('Evolver analyzes source project before branching', evolver, 'const projectAnalysis = analyzeProject');
need('Evolver returns clarification before branch mutation', evolver, 'EVOLVE_NEEDS_CLARIFICATION');
need('Evolver reports V3.5 plan version', evolver, 'version: "3.5"');
need('V3.5 keeps production disabled', evolver, 'production_deployed: false');
need('Package runtime version advanced', pkg, '"version": "1.9.0-alpha.1"');
need('Package executes V3.5 readiness', pkg, 'node scripts/factory-v35-readiness.mjs');
need('Package executes intent-resolution smoke', pkg, 'node scripts/intent-resolution-smoke.mjs');

const result = { version:'LEAN V3.5', ready:failures.length===0, checks_passed:passes.length, checks_failed:failures.length, passes, failures };
console.log(JSON.stringify(result, null, 2));
if (failures.length) process.exit(1);
