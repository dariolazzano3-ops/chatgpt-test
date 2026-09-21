export const JARVIS_REPO_BOUND_PROTECTED_BRANCHES = Object.freeze(['main', 'master']);
export const JARVIS_TRUSTED_CANDIDATE_RECOVERY_STATE = 'TRUSTED_CANDIDATE_RECOVERED';
export const JARVIS_LEGACY_BRIDGE_HTTP_VERIFICATION_SCHEMA = 'aurentara.jarvis.bridge-http-verification.v1';

export function isLegacyBridgeHttpEvidenceV1(verification) {
  return Boolean(verification)
    && typeof verification === 'object'
    && verification.schema === JARVIS_LEGACY_BRIDGE_HTTP_VERIFICATION_SCHEMA;
}

export function jarvisRepoBoundContractManifestV1() {
  return {
    schema: 'aurentara.jarvis.repo-bound-contract.v1',
    protected_branches: [...JARVIS_REPO_BOUND_PROTECTED_BRANCHES],
    trusted_candidate_recovery_state: JARVIS_TRUSTED_CANDIDATE_RECOVERY_STATE,
    legacy_bridge_http_verification_schema: JARVIS_LEGACY_BRIDGE_HTTP_VERIFICATION_SCHEMA,
    node_runtime_required: false
  };
}
