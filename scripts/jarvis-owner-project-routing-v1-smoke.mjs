import assert from 'node:assert/strict';
import { handleJarvisHttpV1 } from '../src/jarvis/http-v1.js';
import { createMemoryJarvisStoreV1 } from '../src/jarvis/memory-store-memory-v1.js';
import { createJarvisSessionV1 } from '../src/jarvis/session-v1.js';
import {
  resolveJarvisAutomaticProjectRouteV1,
  jarvisAutomaticProjectRouteManifestV1
} from '../src/jarvis/project-route-v1.js';

const AUTH = {
  ok: true,
  operator_id: 'jarvis-operator:auto-project-routing@example.invalid',
  email: 'auto-project-routing@example.invalid'
};
const authorize = async () => AUTH;
const SESSION = await createJarvisSessionV1(AUTH);
const OWNER_ID = SESSION.owner_id;
const OWNER_REF = SESSION.owner_ref;

const targetCalls = { count: 0, last: null };
const defaultCalls = { count: 0, last: null };
const projectPreflight = { count: 0 };
const genericPreflight = { count: 0 };
const publisherCalls = { count: 0, last: null };

function fakeBridge(counter, repoDir, branch) {
  return {
    bound: true,
    submit(payload) {
      counter.count += 1;
      counter.last = payload;
      return {
        result: Promise.resolve({
          state: 'COMPLETE',
          exit_code: 0,
          external_effect: false,
          evidence: {
            evidence_id: 'auto-project-routing-evidence-1',
            verification: {
              schema: 'aurentara.jarvis.repo-bound-verification.v1',
              repo_dir: repoDir,
              branch,
              branch_drift: false,
              files_changed: ['src/aurentara-routing-smoke.js'],
              pre_existing_dirty_files: [],
              syntax_check: {
                passed: true,
                checked: 1,
                results: [{ file: 'src/aurentara-routing-smoke.js', passed: true }]
              },
              tool_audit: {
                complete: true,
                compliant: true,
                is_error: false,
                tool_uses: [{ tool: 'Edit' }],
                forbidden_tool_uses: [],
                outside_workspace_targets: [],
                sensitive_targets: [],
                permission_denials: [],
                unknown_specialists: [],
                specialist_fanout_ok: true,
                result: 'AURENTARA automatic project routing smoke verified.'
              }
            }
          }
        })
      };
    }
  };
}

const targetRepo = '/workspace/projects/aurentara-real-lifecycle-v1';
const targetBranch = 'factory/aurentara-real-lifecycle-v1';
const targetBridge = fakeBridge(targetCalls, targetRepo, targetBranch);
const defaultBridge = fakeBridge(defaultCalls, '/workspace/projects/generic', 'factory/generic');

const target = {
  target_id: 'AURENTARA',
  label: 'AURENTARA',
  route_aliases: ['AURENTARA SYSTEMS'],
  program: 'AURENTARA_PROJECT_MISSION_V1',
  target_branch: targetBranch,
  repo_dir: targetRepo,
  bridge_bound: true,
  execution_guidance: 'AURENTARA CONTROLLED PROJECT GUIDANCE',
  bridge: targetBridge,
  workspace_preflight: async () => {
    projectPreflight.count += 1;
    return { ok: true };
  }
};

const route = resolveJarvisAutomaticProjectRouteV1(
  'Implementiere für AURENTARA eine kleine interne Lücke.',
  { AURENTARA: target }
);
assert.equal(route.matched, true);
assert.equal(route.target_id, 'AURENTARA');
assert.equal(route.target, target);

const noRoute = resolveJarvisAutomaticProjectRouteV1(
  'Implementiere einen kleinen internen JARVIS-Fix.',
  { AURENTARA: target }
);
assert.equal(noRoute.matched, false);
assert.equal(noRoute.status, 'NO_MATCH');

const ambiguous = resolveJarvisAutomaticProjectRouteV1(
  'Verbinde AURENTARA mit HAMYREN.',
  {
    AURENTARA: target,
    HAMYREN: { ...target, target_id: 'HAMYREN', label: 'HAMYREN' }
  }
);
assert.equal(ambiguous.matched, false);
assert.equal(ambiguous.status, 'AMBIGUOUS');

const store = createMemoryJarvisStoreV1();
let background = null;
const ctx = { waitUntil(promise) { background = promise; } };
const response = await handleJarvisHttpV1(
  new Request('https://example.invalid/jarvis/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      correlation_id: '77777777-7777-4777-8777-777777777777',
      message: 'Implementiere für AURENTARA MARKER-AUTO-PROJECT-ROUTING als kleinen internen Bugfix.'
    })
  }),
  {},
  ctx,
  {
    authorize,
    memory_store: store,
    claude_bridge: defaultBridge,
    owner_chat_workspace_preflight: async () => {
      genericPreflight.count += 1;
      return { ok: false, error: 'GENERIC_PREFLIGHT_MUST_NOT_RUN' };
    },
    automatic_project_targets: { AURENTARA: target },
    owner_chat_trusted_publisher: {
      async publishVerifiedOwnerChatJob(request) {
        publisherCalls.count += 1;
        publisherCalls.last = request;
        return {
          ok: true,
          published: true,
          push: true,
          merge: false,
          deploy: false,
          deploy_state: 'NOT_REQUESTED_PROJECT_SCOPE',
          commit: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
        };
      }
    }
  }
);

assert.equal(response.status, 200);
const body = await response.json();
assert.equal(body.chat_work_classification, 'ACTIONABLE_WORK');
assert.equal(body.project_routing.matched, true);
assert.equal(body.project_routing.target_id, 'AURENTARA');
assert.equal(body.project_routing.program, 'AURENTARA_PROJECT_MISSION_V1');
assert.equal(body.owner_chat_job.program, 'AURENTARA_PROJECT_MISSION_V1');
assert.equal(body.owner_chat_job.project_target_id, 'AURENTARA');
assert.ok(background, 'owner project job must be scheduled in the background');
await background;

assert.equal(targetCalls.count, 1);
assert.equal(defaultCalls.count, 0);
assert.equal(projectPreflight.count, 1);
assert.equal(genericPreflight.count, 0);
assert.match(targetCalls.last.task, /AURENTARA CONTROLLED PROJECT GUIDANCE/);
assert.match(targetCalls.last.task, /Engineering Mission \[AURENTARA_PROJECT_MISSION_V1\]/);

assert.equal(publisherCalls.count, 1);
assert.equal(publisherCalls.last.repo_dir, targetRepo);
assert.equal(publisherCalls.last.target_branch, targetBranch);
assert.equal(publisherCalls.last.private_deploy_allowed, false);

const audit = await store.readAudit({ owner_id: OWNER_ID, owner_ref: OWNER_REF, limit: 100 });
const notification = audit.find((row) =>
  row.request_id === body.request_id
  && row.intent?.intent_type === 'OWNER_CHAT_JOB_NOTIFICATION'
);
assert.ok(notification);
assert.equal(notification.result.status, 'COMPLETED');
assert.equal(notification.result.job_status, 'COMPLETE');
assert.equal(notification.result.program, 'AURENTARA_PROJECT_MISSION_V1');
assert.equal(notification.result.project_target_id, 'AURENTARA');
assert.equal(notification.result.finalization.deploy_state, 'NOT_REQUESTED_PROJECT_SCOPE');

const memory = await store.loadMemory({ owner_id: OWNER_ID, owner_ref: OWNER_REF });
const resultMemory = memory.find((entry) => entry.memory_id === 'jarvis:owner-job-result:' + body.request_id);
assert.ok(resultMemory);
assert.equal(resultMemory.value.program, 'AURENTARA_PROJECT_MISSION_V1');
assert.equal(resultMemory.value.project_target_id, 'AURENTARA');

const manifest = jarvisAutomaticProjectRouteManifestV1();
assert.equal(manifest.server_configured_targets_only, true);
assert.equal(manifest.ambiguous_route_fails_closed, true);
console.log('JARVIS Owner Automatic Project Routing V1 smoke: PASS');
