import { createCustomerAiFoundation } from './foundation-v1.js';
import {
  createTrustedCustomerChatRuntime,
  classifyBusinessRisk,
  evaluateTrustedResearch,
  validateResearchCitations,
  trustedResearchRuntimeManifest,
  BUSINESS_RISK_LEVELS,
  RESEARCH_SOURCE_TIERS
} from './trusted-research-v1.js';

export {
  classifyBusinessRisk,
  evaluateTrustedResearch,
  validateResearchCitations,
  trustedResearchRuntimeManifest,
  BUSINESS_RISK_LEVELS,
  RESEARCH_SOURCE_TIERS
};

export function createTrustedBusinessAiRuntime(options = {}) {
  const foundation = options.foundation || createCustomerAiFoundation({ store: options.foundation_store });
  return createTrustedCustomerChatRuntime({ ...options, foundation });
}
