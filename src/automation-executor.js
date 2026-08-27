import { compileAutomationPlan } from './automation-factory.js';

const SAFE = new Set(['input','filter','map','transform','condition','output']);
const clone = (v) => JSON.parse(JSON.stringify(v ?? null));

export function executeSafeAutomation(contract = {}, input = {}) {
  const plan = compileAutomationPlan(contract);
  if (!plan.ok) return plan;
  const trace = [];
  const values = new Map();
  let current = clone(input);

  for (const step of plan.steps) {
    if (!SAFE.has(step.type)) {
      trace.push({ step_id: step.id, type: step.type, status: 'BLOCKED', reason: 'EXTERNAL_SIDE_EFFECT_NOT_AUTHORIZED' });
      return { ok: false, status: 'BLOCKED_EXTERNAL_SIDE_EFFECT', trace, outputs: {}, production_deploy: false };
    }
    try {
      if (step.type === 'input') current = clone(step.config?.value ?? current);
      if (step.type === 'filter') {
        const field = step.config?.field;
        const equals = step.config?.equals;
        if (Array.isArray(current) && field) current = current.filter((item) => item?.[field] === equals);
      }
      if (step.type === 'map') {
        const field = step.config?.field;
        if (Array.isArray(current) && field) current = current.map((item) => item?.[field]);
      }
      if (step.type === 'transform') {
        const mode = step.config?.mode;
        if (mode === 'pick' && current && typeof current === 'object' && !Array.isArray(current)) {
          const fields = Array.isArray(step.config?.fields) ? step.config.fields : [];
          current = Object.fromEntries(fields.filter((f) => Object.hasOwn(current, f)).map((f) => [f, current[f]]));
        } else if (mode === 'set' && current && typeof current === 'object' && !Array.isArray(current)) {
          current = { ...current, [String(step.config?.field || 'value')]: clone(step.config?.value) };
        }
      }
      if (step.type === 'condition') {
        const field = step.config?.field;
        const equals = step.config?.equals;
        const source = current && typeof current === 'object' ? current[field] : current;
        if (source !== equals) {
          trace.push({ step_id: step.id, type: step.type, status: 'SKIPPED_REMAINDER', reason: 'CONDITION_FALSE' });
          return { ok: true, status: 'COMPLETED', trace, outputs: { result: current, condition_matched: false }, production_deploy: false };
        }
      }
      if (step.type === 'output') values.set(step.id, clone(current));
      trace.push({ step_id: step.id, type: step.type, status: 'COMPLETED' });
    } catch (error) {
      trace.push({ step_id: step.id, type: step.type, status: 'FAILED', reason: String(error?.message || error).slice(0,300) });
      return { ok: false, status: 'FAILED', trace, outputs: {}, production_deploy: false };
    }
  }

  return { ok: true, status: 'COMPLETED', trace, outputs: { result: current, named_outputs: Object.fromEntries(values) }, production_deploy: false };
}
