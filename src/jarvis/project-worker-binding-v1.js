import { createJarvisAcceptedWorkPublisherV1 } from './accepted-work-publisher-v1.js';

// Server configuration only; never accept endpoint/token overrides from chat.
export function resolveProjectWorkerBindingV1(env, targetId, required = false) {
  if (!/^[A-Z][A-Z0-9_]{1,63}$/.test(targetId)) {
    return { ok: false, error: 'PROJECT_WORKER_ID_INVALID' };
  }
  const prefix = 'JARVIS_PROJECT_' + targetId + '_BRIDGE_';
  const url = env[prefix + 'URL'];
  const token = env[prefix + 'TOKEN'];
  if (url === undefined && token === undefined) return required
    ? { ok: false, error: 'PROJECT_ISOLATED_WORKER_REQUIRED' }
    : { ok: true, isolated: false, env };
  if (typeof url !== 'string' || !url || typeof token !== 'string' || !token.trim()) {
    return { ok: false, error: 'PROJECT_WORKER_CONFIG_INCOMPLETE' };
  }
  let parsed;
  try { parsed = new URL(url); } catch { return { ok: false, error: 'PROJECT_WORKER_URL_INVALID' }; }
  if (parsed.protocol !== 'http:' || !['127.0.0.1', '[::1]'].includes(parsed.hostname)
      || !parsed.port || parsed.username || parsed.password || parsed.search || parsed.hash
      || parsed.pathname !== '/') {
    return { ok: false, error: 'PROJECT_WORKER_LOOPBACK_URL_REQUIRED' };
  }
  return {
    ok: true, isolated: true,
    env: { ...env, JARVIS_BRIDGE_URL: parsed.origin, JARVIS_BRIDGE_TOKEN: token }
  };
}

export function createProjectLocalPublisherV1(target, deps) {
  const publisher = createJarvisAcceptedWorkPublisherV1({
    owner_chat_push_enabled: false, owner_chat_private_deploy_enabled: false
  }, deps);
  return {
    async publishVerifiedOwnerChatJob(request = {}) {
      const files = request.verification?.files_changed;
      const prefix = 'projects/' + target.bridge_project + '/';
      if (request.repo_dir !== target.repo_dir || request.target_branch !== target.target_branch
          || !Array.isArray(files) || !files.length
          || files.some(file => typeof file !== 'string' || !file.startsWith(prefix)
            || file.includes('\\') || file.split('/').some(part => ['..', '.', '.git'].includes(part)))) {
        return { ok: false, error: 'PROJECT_LOCAL_PUBLISHER_SCOPE_MISMATCH' };
      }
      return publisher.publishVerifiedOwnerChatJob(request);
    }
  };
}
