/* JARVIS Project Worker Isolation V1.
 * Independently reviews Docker's observed mount/network/process configuration.
 * This is NOT an authorization to run Claude, register targets or grant access.
 * A real in-container cross-project negative test is additionally required.
 */
const clean = value => String(value ?? '').trim();
const ID = /^[A-Z][A-Z0-9_]{2,63}$/;
const SLUG = /^[a-z0-9][a-z0-9._-]{1,90}$/;
const absolute = value => typeof value === 'string' &&
  value.startsWith('/') && !value.includes('..') && !value.includes('//');

export function inspectJarvisProjectWorkerIsolationV1(raw, approved = {}) {
  const failures = [];
  const requireCheck = (yes, reason) => { if (!yes) failures.push(reason); };
  const id = clean(approved.target_id);
  const slug = clean(approved.project_slug);
  const repo = '/opt/jarvis/project-workspaces/' + id;
  const dest = '/workspace/projects/' + slug;
  requireCheck(ID.test(id) && SLUG.test(slug), 'APPROVED_ID_OR_SLUG_INVALID');

  const allowedSupport = Array.isArray(approved.support_mounts) ? approved.support_mounts : [];
  // Support mounts are limited to the existing bridge and its read-only config.
  // An arbitrary caller-supplied support mount cannot approve host-root access.
  const supportAllowlist = new Map([
    ['/home/jarvis/claude-worker/bridge/bridge.py', '/app/bridge.py'],
    ['/home/jarvis/claude-worker/config', '/home/claude/.claude']
  ]);
  requireCheck(allowedSupport.every(m => m && absolute(m.source) &&
    absolute(m.destination) && m.read_only === true &&
    supportAllowlist.get(m.source) === m.destination), 'SUPPORT_MOUNT_POLICY_INVALID');

  const obj = Array.isArray(raw) && raw.length === 1 ? raw[0] : raw;
  requireCheck(obj && typeof obj === 'object' && !Array.isArray(obj), 'INSPECT_OBJECT_REQUIRED');
  const host = obj?.HostConfig || {};
  const net = clean(host.NetworkMode);
  const state = obj?.State || {};
  const configuredUser = clean(obj?.Config?.User);
  requireCheck(['claude','11000','11000:11000'].includes(configuredUser),
    'NON_ROOT_WORKER_IDENTITY_NOT_CONFIGURED');
  requireCheck(state.Running === true && state.Status === 'running', 'CONTAINER_NOT_RUNNING');
  requireCheck(host.Privileged === false, 'PRIVILEGED_CONTAINER');
  requireCheck(!Array.isArray(host.CapAdd) || host.CapAdd.length === 0, 'ADDED_CAPABILITIES');
  requireCheck(!host.PidMode || host.PidMode !== 'host', 'HOST_PID_NAMESPACE');
  requireCheck(!host.IpcMode || host.IpcMode !== 'host', 'HOST_IPC_NAMESPACE');
  requireCheck(net !== 'host' && net !== 'container:host', 'HOST_NETWORK');
  requireCheck(!host.Devices || host.Devices.length === 0, 'HOST_DEVICES');
  requireCheck(Array.isArray(host.SecurityOpt) &&
    host.SecurityOpt.some(x => x === 'no-new-privileges' || x === 'no-new-privileges:true'),
    'NO_NEW_PRIVILEGES_MISSING');
  const portBindings = Object.values(host.PortBindings || {}).flat();
  requireCheck(portBindings.every(x => x && ['127.0.0.1','::1'].includes(x.HostIp)),
    'EXPOSED_PUBLIC_PORT');

  const mounts = obj?.Mounts;
  requireCheck(Array.isArray(mounts), 'MOUNTS_UNAVAILABLE');
  let workspaceCount = 0;
  const observed = new Set();
  for (const m of Array.isArray(mounts) ? mounts : []) {
    const key = clean(m.Source) + ' -> ' + clean(m.Destination);
    if (observed.has(key)) failures.push('DUPLICATE_MOUNT');
    observed.add(key);
    if (m.Type !== 'bind' || !absolute(m.Source) || !absolute(m.Destination)) {
      failures.push('UNKNOWN_OR_UNSAFE_MOUNT');
      continue;
    }
    if (m.Source === repo && m.Destination === dest) {
      workspaceCount++;
      if (m.RW !== true) failures.push('PROJECT_NOT_WRITABLE');
      continue;
    }
    const support = allowedSupport.find(x => x.source === m.Source &&
      x.destination === m.Destination && x.read_only === true);
    if (!support || m.RW !== false) failures.push('UNAPPROVED_MOUNT');
  }
  requireCheck(workspaceCount === 1, 'PROJECT_MOUNT_NOT_EXACTLY_ONCE');
  return Object.freeze({
    schema: 'jarvis.project-worker-isolation-inspection.v1',
    target_id: id,
    project_slug: slug,
    inspected: Boolean(obj && obj.Id),
    configuration_valid: failures.length === 0,
    isolation_verified: false,
    executable: false,
    failures: Object.freeze([...new Set(failures)]),
    next: 'REAL_WORKER_ACCESS_AND_CROSS_PROJECT_NEGATIVE_TEST_REQUIRED'
  });
}
