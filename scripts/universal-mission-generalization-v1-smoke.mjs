#!/usr/bin/env node
import assert from 'node:assert/strict';
import { runUniversalMission, assertMissionProjectIsolation } from '../src/universal-mission-run.js';

function safeInput(overrides = {}) {
  return {
    country: 'DE',
    language: 'de',
    budget_policy: { variable_cost_ceiling_eur: 0, paid_overflow: false },
    approval_policy: { external_writes_require_approval: true, production_requires_explicit_approval: true },
    data_policy: { synthetic_only: true, real_customer_data: false },
    environment: 'staging',
    production_authorized: false,
    ...overrides
  };
}

const aiService = runUniversalMission(safeInput({
  customer_id: 'synthetic-customer-consulting',
  project_id: 'consulting-ai-ops-v1',
  business_name: 'Synthetic Beratung Nord',
  industry: 'professional-services',
  mission_text: 'Strukturiere Kundenanfragen einer Beratungsfirma im CRM, klassifiziere und fasse sie mit KI zusammen und automatisiere die Nachverfolgung sowie Follow-ups.',
  business_goals: ['schnellere Anfragebearbeitung', 'konsistente Qualifizierung'],
  requested_outcomes: ['CRM', 'KI-Assistent', 'automatisierte Nachverfolgung']
}), { fail_once_capability: 'ai_assistance' });

assert.equal(aiService.ok, true);
assert.equal(aiService.delivery.final_delivery_status, 'SIMULATED_HANDOFF_READY');
assert.equal(aiService.quality.status, 'PASS');
assert.equal(aiService.execution.variable_cost_eur, 0);
assert.deepEqual(aiService.execution.real_providers_involved, []);
const aiCaps = new Set(aiService.plan.selected_capabilities.map((item) => item.capability));
assert.deepEqual([...aiCaps].sort(), ['ai_assistance','automation_followup','business_crm'].sort());
assert.equal(aiCaps.has('web_presence'), false);
assert.equal(aiCaps.has('growth_gtm'), false);
assert.equal(aiCaps.has('analytics'), false);
const aiResult = aiService.execution.results.find((item) => item.capability === 'ai_assistance');
assert.ok(aiResult);
assert.equal(aiResult.retries.length, 1);
assert.equal(aiResult.provider, 'deterministic-ai-fixture');
assert.equal(aiService.command_center.retries, 1);
assert.ok(aiService.execution.results.every((item) => item.output.synthetic === true));
assert.ok(aiService.execution.results.every((item) => item.output.external_provider_invoked === false));
assert.ok(aiService.execution.results.every((item) => item.output.external_write_performed === false));

const localStudio = runUniversalMission(safeInput({
  customer_id: 'synthetic-customer-yoga',
  project_id: 'yoga-local-growth-v1',
  business_name: 'Synthetic Yoga Studio',
  industry: 'wellness',
  mission_text: 'Modernisiere die Website eines lokalen Yoga-Studios, verbessere SEO und lokale Sichtbarkeit und messe die Website-Ergebnisse.',
  business_goals: ['mehr lokale Sichtbarkeit', 'messbare Website-Ergebnisse'],
  requested_outcomes: ['Website', 'Local SEO', 'Analytics']
}));

assert.equal(localStudio.ok, true);
assert.equal(localStudio.delivery.final_delivery_status, 'SIMULATED_HANDOFF_READY');
assert.equal(localStudio.quality.status, 'PASS');
assert.equal(localStudio.execution.variable_cost_eur, 0);
const studioCaps = new Set(localStudio.plan.selected_capabilities.map((item) => item.capability));
assert.deepEqual([...studioCaps].sort(), ['analytics','growth_gtm','web_presence'].sort());
assert.equal(studioCaps.has('business_crm'), false);
assert.equal(studioCaps.has('automation_followup'), false);
assert.equal(studioCaps.has('ai_assistance'), false);
const analyticsTask = localStudio.plan.selected_capabilities.find((item) => item.capability === 'analytics');
assert.deepEqual(analyticsTask.dependencies, ['web_presence']);

const isolationAiStudio = assertMissionProjectIsolation(aiService, localStudio);
assert.equal(isolationAiStudio.ok, true);
assert.deepEqual(isolationAiStudio.overlap, []);

const noFreeFallback = runUniversalMission(safeInput({
  customer_id: 'synthetic-customer-failclosed',
  project_id: 'growth-no-fallback-v1',
  business_name: 'Synthetic Regional Cafe',
  industry: 'hospitality',
  mission_text: 'Plane Local SEO und regionale Sichtbarkeit für ein Café.',
  requested_outcomes: ['Local SEO']
}), { fail_once_capability: 'growth_gtm' });

assert.equal(noFreeFallback.ok, false);
assert.equal(noFreeFallback.execution.ok, false);
assert.equal(noFreeFallback.execution.error, 'NO_ZERO_COST_FALLBACK');
assert.equal(noFreeFallback.quality.status, 'BLOCK');
assert.equal(noFreeFallback.delivery.final_delivery_status, 'BLOCKED');
assert.equal(noFreeFallback.command_center.current_stage, 'BLOCKED');
assert.equal(noFreeFallback.command_center.costs.variable_eur, 0);
assert.equal(noFreeFallback.command_center.technical_details.production_deploy, false);
assert.equal(noFreeFallback.delivery.execution_evidence.real_provider_calls, 0);
assert.equal(noFreeFallback.delivery.execution_evidence.external_writes, 0);
assert.equal(noFreeFallback.delivery.execution_evidence.variable_cost_eur, 0);

const isolationFailure = assertMissionProjectIsolation(aiService, noFreeFallback);
assert.equal(isolationFailure.ok, true);
assert.deepEqual(isolationFailure.overlap, []);

console.log(JSON.stringify({
  ok: true,
  suite: 'universal-mission-generalization-v1',
  generalization_runs: [
    {
      project_id: aiService.mission.project_id,
      capabilities: aiService.delivery.selected_capabilities,
      status: aiService.delivery.final_delivery_status,
      fallback_verified: 'cloudflare-workers-ai-free -> deterministic-ai-fixture'
    },
    {
      project_id: localStudio.mission.project_id,
      capabilities: localStudio.delivery.selected_capabilities,
      status: localStudio.delivery.final_delivery_status,
      topology: 'growth+web+analytics_without_crm_or_ai'
    }
  ],
  failure_recovery: {
    recoverable_ai_failure: 'PASS_AFTER_ZERO_COST_FALLBACK',
    no_free_fallback: noFreeFallback.execution.error,
    final_status: noFreeFallback.delivery.final_delivery_status
  },
  isolation: 'PASS',
  safety: {
    synthetic_only: true,
    variable_cost_eur: 0,
    real_provider_calls: 0,
    external_writes: 0,
    production_deploy: false
  }
}, null, 2));
