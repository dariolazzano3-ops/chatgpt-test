import { integrationCatalogManifest } from './integration-catalog.js';
import { integrationRuntimeManifest } from './integration-runtime.js';
import { factoryIntegrationBridgeManifest } from './factory-integration-bridge.js';
import { phase3ReadinessManifest } from './phase3-readiness.js';

export function evaluatePhase4Readiness() {
  const phase3 = phase3ReadinessManifest();
  const catalog = integrationCatalogManifest();
  const runtime = integrationRuntimeManifest();
  const bridge = factoryIntegrationBridgeManifest();
  const checks = {
    phase3_complete_contract: phase3.production_deploy === false,
    integration_catalog: catalog.version === 'riosystems.integrations.v1',
    credential_reference_only: catalog.credential_reference_only === true,
    health_aware_selection: catalog.health_aware_selection === true,
    supervised_real_execution: runtime.real_execution_supported_with_injected_runner === true,
    dry_run_default: runtime.safety?.includes('dry_run_default') === true,
    host_allowlist: runtime.safety?.includes('host_allowlist') === true,
    external_write_approval: runtime.safety?.includes('external_write_approval') === true,
    factory_bridge: bridge.supports_supervised_real_integrations === true && bridge.engines?.length === 4,
    no_implicit_external_execution: runtime.implicit_external_execution === false,
    production_disabled: [phase3, catalog, runtime, bridge].every((item) => item.production_deploy === false)
  };
  const blockers = Object.entries(checks).filter(([, value]) => value !== true).map(([key]) => key);
  return { ok: true, phase: 4, status: blockers.length ? 'INCOMPLETE' : 'ARCHITECTURE_COMPLETE', ready: blockers.length === 0, checks, blockers, production_deploy: false };
}

export function phase4ReadinessManifest() {
  return {
    version: 'riosystems.phase4.readiness.v1',
    scope: ['integration_catalog','credential_refs','health_routing','supervised_runtime','factory_bridge'],
    real_credentials_required_for_architecture_completion: false,
    production_deploy: false
  };
}
