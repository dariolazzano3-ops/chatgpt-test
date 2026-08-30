import assert from 'node:assert/strict';
import { AI_INTELLIGENCE_V2_SAFETY, AI_TASK_RECIPES, aiIntelligenceV2Manifest, createTaskTypeRegistry } from '../src/ai-intelligence-v2.js';

const manifest = aiIntelligenceV2Manifest();
const required = [
  'task_compiler','task_discovery','canonical_task_graph','extensible_task_registry','model_capability_matrix','intelligent_routing',
  'prompt_compiler','context_assembly','context_budgeting','context_quality','structured_output','semantic_validation','evaluators',
  'golden_sets','regression_evaluation','cost_engine','budget_gates','cost_quality_optimizer','latency_aware','grounding',
  'prompt_injection_defense','pii_minimization','memory_contract','knowledge_distillation','document_understanding','vision','multimodal',
  'bounded_agents','planner_executor_split','human_review','brand_voice','content_consistency','localization','failure_recovery',
  'circuit_breaker','rate_limit_handling','concurrency_control','timeouts','quality_analytics','model_performance_history','distillation_path'
];
for (const key of required) assert.equal(Boolean(manifest[key]), true, `missing manifest capability ${key}`);
assert.equal(manifest.extends, 'riosystems-ai-factory-v1');
assert.equal(manifest.rebuild_v1, false);
assert.equal(manifest.cross_factory.length, 3);
assert.equal(Object.keys(AI_TASK_RECIPES).length >= 14, true);
assert.equal(createTaskTypeRegistry().list().length >= 16, true);
for (const [key, value] of Object.entries(AI_INTELLIGENCE_V2_SAFETY)) {
  if (key === 'variable_development_cost_ceiling_eur') assert.equal(value, 0);
  else assert.equal(value, false, `${key} must remain false`);
}
console.log(JSON.stringify({ readiness: 'autonomous-ai-intelligence-v2:ready', required_capabilities: required.length, task_types: createTaskTypeRegistry().list().length, recipes: Object.keys(AI_TASK_RECIPES).length, production: false, variable_cost_ceiling_eur: 0 }, null, 2));
