import assert from 'node:assert/strict';
import { evaluatePhase1Readiness, phase1ReadinessManifest } from '../src/runtime-readiness.js';
import { createProjectBoundary, authorizeProjectWrite } from '../src/runtime-project-boundary.js';

const readiness = evaluatePhase1Readiness();
assert.equal(readiness.ok, true, `Phase 1 readiness failed: ${readiness.failed_checks.join(', ')}`);
assert.equal(readiness.status, 'ARCHITECTURE_COMPLETE');
assert.equal(readiness.production_deploy, false);
assert.equal(readiness.real_provider_activation_complete, false);

const boundary = createProjectBoundary({ customer_id: 'customer-a', project_id: 'project-a', owner: 'operator-a' }).boundary;
assert.equal(authorizeProjectWrite(boundary, { customer_id: 'customer-a', project_id: 'project-a', actor_id: 'operator-a', path: 'projects/project-a/index.js' }).authorized, true);
const nonOwner = authorizeProjectWrite(boundary, { customer_id: 'customer-a', project_id: 'project-a', actor_id: 'operator-b', path: 'projects/project-a/index.js' });
assert.equal(nonOwner.authorized, false);
assert.equal(nonOwner.code, 'CODE_OWNER_APPROVAL_REQUIRED');
assert.equal(authorizeProjectWrite(boundary, { customer_id: 'customer-a', project_id: 'project-a', actor_id: 'operator-b', owner_override_approved: true, path: 'projects/project-a/index.js' }).authorized, true);

const manifest = phase1ReadinessManifest();
assert.equal(manifest.production_deploy, false);
console.log(JSON.stringify({ ok: true, suite: 'riosystems-phase1-readiness', readiness, manifest }, null, 2));
