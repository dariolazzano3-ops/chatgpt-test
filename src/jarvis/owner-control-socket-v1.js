import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { handleJarvisStandaloneWorkerV1 } from './standalone-worker-v1.js';

export const JARVIS_OWNER_CONTROL_DEFAULT_SOCKET = '/opt/jarvis/owner-deploy-queue/owner-control.sock';
export const JARVIS_OWNER_CONTROL_MAX_BODY_BYTES = 16 * 1024;

const clean = (value, max = 4000) => String(value ?? '').trim().slice(0, max);

function jsonNode(res, status, body) {
  const raw = Buffer.from(JSON.stringify(body));
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': String(raw.length),
    'cache-control': 'no-store'
  });
  res.end(raw);
}

async function readBoundedJson(req, maxBytes = JARVIS_OWNER_CONTROL_MAX_BODY_BYTES) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > maxBytes) {
      const error = new Error('OWNER_CONTROL_BODY_TOO_LARGE');
      error.code = 'OWNER_CONTROL_BODY_TOO_LARGE';
      throw error;
    }
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    const error = new Error('OWNER_CONTROL_JSON_INVALID');
    error.code = 'OWNER_CONTROL_JSON_INVALID';
    throw error;
  }
}

function safeOwnerEmail(value) {
  const email = clean(value, 320).toLowerCase();
  if (!email || !email.includes('@') || email.startsWith('@') || email.endsWith('@')) return '';
  return email;
}

async function writeWebResponse(response, res) {
  const headers = {};
  for (const [key, value] of response.headers) {
    if (key.toLowerCase() === 'set-cookie') continue;
    headers[key] = value;
  }
  res.writeHead(response.status, headers);
  if (!response.body) {
    res.end();
    return;
  }
  res.end(Buffer.from(await response.arrayBuffer()));
}

export function jarvisOwnerControlSocketManifestV1() {
  return {
    schema: 'aurentara.jarvis.owner-control-socket.v1',
    transport: 'UNIX_SOCKET_ONLY',
    default_socket: JARVIS_OWNER_CONTROL_DEFAULT_SOCKET,
    public_tcp_listener: false,
    cloudflare_access_path_modified: false,
    owner_identity_source: 'SERVER_SIDE_OPERATOR_EMAIL_ONLY',
    client_identity_override: false,
    allowed_routes: ['GET /v1/status', 'GET /v1/runtime-truth', 'POST /v1/chat'],
    socket_mode: '0660',
    parent_world_access_required: false,
    production_deploy: false,
    dns_actions: false,
    billing_actions: false,
    secrets_returned: false
  };
}

export function createJarvisOwnerControlSocketServerV1({
  runtime_options,
  owner_email,
  env = process.env,
  worker_handler = handleJarvisStandaloneWorkerV1,
  max_body_bytes = JARVIS_OWNER_CONTROL_MAX_BODY_BYTES
} = {}) {
  const fixedOwnerEmail = safeOwnerEmail(owner_email);
  if (!fixedOwnerEmail) {
    return { ok: false, error: 'JARVIS_OWNER_CONTROL_OWNER_EMAIL_INVALID', server: null };
  }
  if (!runtime_options || typeof runtime_options !== 'object') {
    return { ok: false, error: 'JARVIS_OWNER_CONTROL_RUNTIME_OPTIONS_REQUIRED', server: null };
  }

  const localRuntimeOptions = {
    ...runtime_options,
    authorize: async () => ({
      ok: true,
      status: 200,
      email: fixedOwnerEmail,
      operator_id: `jarvis-owner-control:${fixedOwnerEmail}`
    })
  };

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || '/', 'http://owner-control.local');
      let targetPath = '';
      let method = req.method || 'GET';
      let body;

      if (method === 'GET' && url.pathname === '/v1/status') {
        targetPath = '/api/status';
      } else if (method === 'GET' && url.pathname === '/v1/runtime-truth') {
        targetPath = '/api/runtime-truth';
      } else if (method === 'POST' && url.pathname === '/v1/chat') {
        targetPath = '/api/chat';
        const incoming = await readBoundedJson(req, max_body_bytes);
        const message = clean(incoming.message, 4000);
        if (!message) {
          jsonNode(res, 400, { ok: false, error: 'JARVIS_OWNER_CONTROL_MESSAGE_REQUIRED' });
          return;
        }
        const correlationId = clean(incoming.correlation_id || incoming.request_id, 80);
        body = JSON.stringify({
          message,
          ...(correlationId ? { correlation_id: correlationId } : {})
        });
      } else {
        jsonNode(res, 404, { ok: false, error: 'JARVIS_OWNER_CONTROL_ROUTE_NOT_ALLOWED' });
        return;
      }

      const request = new Request(`http://owner-control.local${targetPath}`, {
        method,
        headers: body ? { 'content-type': 'application/json' } : undefined,
        body
      });
      const response = await worker_handler(request, env, {}, localRuntimeOptions);
      if (!response) {
        jsonNode(res, 500, { ok: false, error: 'JARVIS_OWNER_CONTROL_RUNTIME_NO_RESPONSE' });
        return;
      }
      await writeWebResponse(response, res);
    } catch (error) {
      const code = clean(error?.code || error?.message, 120);
      const status = code === 'OWNER_CONTROL_BODY_TOO_LARGE' ? 413
        : code === 'OWNER_CONTROL_JSON_INVALID' ? 400
        : 500;
      jsonNode(res, status, {
        ok: false,
        error: status === 500 ? 'JARVIS_OWNER_CONTROL_INTERNAL_ERROR' : code
      });
    }
  });

  return {
    ok: true,
    server,
    owner_email_bound: true,
    manifest: jarvisOwnerControlSocketManifestV1()
  };
}

export async function startJarvisOwnerControlSocketV1({
  runtime_options,
  owner_email,
  env = process.env,
  socket_path = JARVIS_OWNER_CONTROL_DEFAULT_SOCKET,
  worker_handler = handleJarvisStandaloneWorkerV1,
  fs_api = fs
} = {}) {
  const parent = path.dirname(socket_path);
  let parentStat;
  try {
    parentStat = await fs_api.stat(parent);
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return {
        ok: true,
        enabled: false,
        reason: 'JARVIS_OWNER_CONTROL_SAFE_PARENT_NOT_PRESENT',
        socket_path
      };
    }
    return { ok: false, enabled: false, error: 'JARVIS_OWNER_CONTROL_PARENT_STAT_FAILED', socket_path };
  }

  const uid = typeof process.getuid === 'function' ? process.getuid() : null;
  const mode = parentStat.mode & 0o777;
  if (!parentStat.isDirectory()) {
    return {
      ok: false,
      enabled: false,
      error: 'JARVIS_OWNER_CONTROL_PARENT_NOT_DIRECTORY',
      socket_path
    };
  }
  if (uid !== null && parentStat.uid !== uid) {
    return {
      ok: true,
      enabled: false,
      reason: 'JARVIS_OWNER_CONTROL_RUNTIME_UID_NOT_PARENT_OWNER',
      socket_path
    };
  }
  if ((mode & 0o007) !== 0 || (mode & 0o030) !== 0o030) {
    return {
      ok: false,
      enabled: false,
      error: 'JARVIS_OWNER_CONTROL_PARENT_PERMISSIONS_UNSAFE',
      socket_path
    };
  }

  try {
    const stale = await fs_api.lstat(socket_path);
    if (!stale.isSocket()) {
      return { ok: false, enabled: false, error: 'JARVIS_OWNER_CONTROL_SOCKET_PATH_OCCUPIED', socket_path };
    }
    await fs_api.unlink(socket_path);
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      return { ok: false, enabled: false, error: 'JARVIS_OWNER_CONTROL_STALE_SOCKET_CLEANUP_FAILED', socket_path };
    }
  }

  const created = createJarvisOwnerControlSocketServerV1({
    runtime_options,
    owner_email,
    env,
    worker_handler
  });
  if (!created.ok) return { ...created, enabled: false, socket_path };

  try {
    await new Promise((resolve, reject) => {
      created.server.once('error', reject);
      created.server.listen(socket_path, resolve);
    });
    const socketUid = uid === null ? parentStat.uid : uid;
    await fs_api.chown(socket_path, socketUid, parentStat.gid);
    await fs_api.chmod(socket_path, 0o660);
    const socketStat = await fs_api.lstat(socket_path);
    const socketMode = socketStat.mode & 0o777;
    if (!socketStat.isSocket() || socketMode !== 0o660 || socketStat.gid !== parentStat.gid) {
      await new Promise((resolve) => created.server.close(resolve));
      return { ok: false, enabled: false, error: 'JARVIS_OWNER_CONTROL_SOCKET_PERMISSION_VERIFY_FAILED', socket_path };
    }
  } catch (error) {
    try { await new Promise((resolve) => created.server.close(resolve)); } catch {}
    return {
      ok: false,
      enabled: false,
      error: 'JARVIS_OWNER_CONTROL_SOCKET_LISTEN_FAILED',
      reason: clean(error?.message, 240),
      socket_path
    };
  }

  created.server.on('close', () => {
    fs_api.unlink(socket_path).catch(() => {});
  });

  return {
    ok: true,
    enabled: true,
    server: created.server,
    socket_path,
    socket_mode: '0660',
    socket_gid: parentStat.gid,
    owner_email_bound: true,
    public_tcp_listener: false
  };
}
