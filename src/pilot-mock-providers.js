const mockRunner = async ({ task_id, capability, payload }) => ({ ok: true, simulated: true, task_id, capability, output: { accepted: true, payload: payload ?? null }, external_side_effect: false, cost_units: 0 });

export function createZeroCostMockProviders() {
  return [
    { id: 'mock-web', capability: 'web.build', enabled: true, external: false, paid: false, estimated_cost_units: 0, priority: 1, runner: mockRunner },
    { id: 'mock-automation', capability: 'automation.run', enabled: true, external: false, paid: false, estimated_cost_units: 0, priority: 1, runner: mockRunner },
    { id: 'mock-ai', capability: 'ai.generate', enabled: true, external: false, paid: false, estimated_cost_units: 0, priority: 1, runner: mockRunner },
    { id: 'mock-business', capability: 'business.configure', enabled: true, external: false, paid: false, estimated_cost_units: 0, priority: 1, runner: mockRunner }
  ];
}

export function zeroCostMockProviderManifest() {
  return { version: 'riosystems.pilot.mock-providers.v1', capabilities: ['web.build','automation.run','ai.generate','business.configure'], paid: false, external: false, cost_units: 0, production_deploy: false };
}
