const clean = (value, max = 2000) => String(value ?? '').trim().slice(0, max);
const clone = (value) => structuredClone(value ?? null);

export const PROJECT_SOURCE_BUCKET = 'project-source-intake-private';
export const PROJECT_SOURCE_UPLOAD_LIMITS = Object.freeze({
  max_files_per_request: 12,
  max_total_bytes: 50 * 1024 * 1024,
  max_file_bytes: 20 * 1024 * 1024,
  max_image_bytes: 15 * 1024 * 1024,
  max_text_bytes: 2 * 1024 * 1024
});

export const PROJECT_SOURCE_STORAGE_MIME_TYPES = Object.freeze([
  'text/plain',
  'text/markdown',
  'text/csv',
  'application/json',
  'text/html',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif'
]);

const MIME_SET = new Set(PROJECT_SOURCE_STORAGE_MIME_TYPES);
const IMAGE_MIME = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
const TEXT_MIME = new Set(['text/plain', 'text/markdown', 'text/csv', 'application/json', 'text/html']);

function requiredIdentity(input = {}) {
  const operatorId = clean(input.operator_id, 320);
  const customerId = clean(input.customer_id, 320);
  const projectId = clean(input.project_id, 320);
  const scopeKey = clean(input.scope_key, 640);
  if (!operatorId || !customerId || !projectId || !scopeKey) return { ok: false, error: 'PROJECT_SOURCE_STORAGE_SCOPE_REQUIRED' };
  return { ok: true, identity: { operator_id: operatorId, customer_id: customerId, project_id: projectId, scope_key: scopeKey } };
}

async function sha256Hex(value) {
  const bytes = value instanceof Uint8Array ? value : new TextEncoder().encode(String(value));
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function identitySegment(label, value) {
  const text = clean(value, 640);
  const slug = text.normalize('NFKC').toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 42) || label;
  const digest = (await sha256Hex(text)).slice(0, 16);
  return `${label}-${slug}-${digest}`;
}

export function safeProjectSourceFilename(value = 'upload.bin') {
  const basename = clean(value, 500).replaceAll('\\', '/').split('/').pop() || 'upload.bin';
  const normalized = basename.normalize('NFKC').replace(/[\u0000-\u001f\u007f]/g, '').replace(/[^A-Za-z0-9._ -]+/g, '_').replace(/\s+/g, '-').replace(/^\.+/, '').slice(0, 140);
  return normalized || 'upload.bin';
}

export function validateProjectSourceUploadDescriptor(input = {}) {
  const mimeType = clean(input.mime_type || input.type, 180).toLowerCase();
  const size = Number(input.size ?? input.byte_length ?? 0);
  if (!MIME_SET.has(mimeType)) return { ok: false, error: 'PROJECT_SOURCE_UPLOAD_MIME_UNSUPPORTED', mime_type: mimeType || null };
  if (!Number.isInteger(size) || size < 1) return { ok: false, error: 'PROJECT_SOURCE_UPLOAD_SIZE_REQUIRED' };
  const limit = IMAGE_MIME.has(mimeType)
    ? PROJECT_SOURCE_UPLOAD_LIMITS.max_image_bytes
    : TEXT_MIME.has(mimeType)
      ? PROJECT_SOURCE_UPLOAD_LIMITS.max_text_bytes
      : PROJECT_SOURCE_UPLOAD_LIMITS.max_file_bytes;
  if (size > limit) return { ok: false, error: 'PROJECT_SOURCE_UPLOAD_TOO_LARGE', limit_bytes: limit, actual_bytes: size };
  const originalName = clean(input.filename || input.name, 500) || 'upload.bin';
  return {
    ok: true,
    filename: safeProjectSourceFilename(originalName),
    original_filename: originalName,
    filename_was_sanitized: safeProjectSourceFilename(originalName) !== originalName,
    mime_type: mimeType,
    size,
    kind: IMAGE_MIME.has(mimeType) ? 'image' : 'file'
  };
}

export function projectSourceStorageConfig(env = {}) {
  const url = clean(env.RIOSYSTEMS_OPERATOR_RUNTIME_SUPABASE_URL, 2000).replace(/\/+$/, '');
  const serviceRole = clean(env.RIOSYSTEMS_OPERATOR_RUNTIME_SUPABASE_SERVICE_ROLE_KEY, 12000);
  return {
    ok: Boolean(url && serviceRole),
    url: url || null,
    service_role_present: Boolean(serviceRole),
    bucket: PROJECT_SOURCE_BUCKET,
    private_bucket_required: true,
    public_access: false,
    browser_secret_exposure: false,
    variable_cost_eur: 0,
    production_deploy: false
  };
}

export async function projectSourceStoragePrefix(identity = {}) {
  const checked = requiredIdentity(identity);
  if (!checked.ok) return checked;
  const i = checked.identity;
  const segments = await Promise.all([
    identitySegment('operator', i.operator_id),
    identitySegment('customer', i.customer_id),
    identitySegment('project', i.project_id),
    identitySegment('scope', i.scope_key)
  ]);
  return { ok: true, prefix: `${segments.join('/')}/`, identity: i };
}

function storageRef(path) {
  return `supabase://${PROJECT_SOURCE_BUCKET}/${path}`;
}

export function parseProjectSourceStorageRef(value = '') {
  const raw = clean(value, 4000);
  const prefix = `supabase://${PROJECT_SOURCE_BUCKET}/`;
  if (!raw.startsWith(prefix)) return { ok: false, error: 'PROJECT_SOURCE_STORAGE_REF_INVALID' };
  const objectPath = raw.slice(prefix.length);
  if (!objectPath || objectPath.startsWith('/') || objectPath.includes('..') || objectPath.includes('\\')) return { ok: false, error: 'PROJECT_SOURCE_STORAGE_REF_INVALID' };
  return { ok: true, bucket: PROJECT_SOURCE_BUCKET, object_path: objectPath, storage_ref: raw };
}

export async function assertProjectSourceStorageRefBound(value, identity = {}) {
  const parsed = parseProjectSourceStorageRef(value);
  if (!parsed.ok) return parsed;
  const bound = await projectSourceStoragePrefix(identity);
  if (!bound.ok) return bound;
  if (!parsed.object_path.startsWith(bound.prefix)) return { ok: false, error: 'PROJECT_SOURCE_STORAGE_CROSS_SCOPE_REJECTED' };
  return { ok: true, ...parsed, identity: bound.identity };
}

async function bytesFor(file) {
  if (file instanceof Uint8Array) return file;
  if (file instanceof ArrayBuffer) return new Uint8Array(file);
  if (typeof file?.arrayBuffer === 'function') return new Uint8Array(await file.arrayBuffer());
  if (typeof file === 'string') return new TextEncoder().encode(file);
  return null;
}

function endpointPath(path) {
  return path.split('/').map((segment) => encodeURIComponent(segment)).join('/');
}

function safeStorageError(status, payload = null) {
  return {
    ok: false,
    error: status === 409 ? 'PROJECT_SOURCE_STORAGE_OBJECT_EXISTS' : 'PROJECT_SOURCE_STORAGE_REQUEST_FAILED',
    status,
    storage_error: clean(payload?.error || payload?.message || '', 240) || null,
    secret_exposed: false,
    production_deploy: false
  };
}

export function createProjectSourceStorageClient(env = {}, options = {}) {
  const config = projectSourceStorageConfig(env);
  if (!config.ok) throw new Error('PROJECT_SOURCE_STORAGE_NOT_CONFIGURED');
  const serviceRole = clean(env.RIOSYSTEMS_OPERATOR_RUNTIME_SUPABASE_SERVICE_ROLE_KEY, 12000);
  const fetcher = options.fetcher || fetch;

  async function storageFetch(path, init = {}) {
    const headers = new Headers(init.headers || {});
    headers.set('authorization', `Bearer ${serviceRole}`);
    headers.set('apikey', serviceRole);
    const response = await fetcher(`${config.url}/storage/v1/${path}`, { ...init, headers });
    return response;
  }

  async function removeBound(storageReference, identity) {
    const bound = await assertProjectSourceStorageRefBound(storageReference, identity);
    if (!bound.ok) return bound;
    const response = await storageFetch(`object/${encodeURIComponent(PROJECT_SOURCE_BUCKET)}`, {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prefixes: [bound.object_path] })
    });
    if (!response.ok && response.status !== 404) {
      let payload = null;
      try { payload = await response.clone().json(); } catch {}
      return safeStorageError(response.status, payload);
    }
    return { ok: true, deleted: true, storage_ref: bound.storage_ref, object_path: bound.object_path, production_deploy: false, variable_cost_eur: 0 };
  }

  return {
    kind: 'supabase-private-project-source-storage',
    bucket: PROJECT_SOURCE_BUCKET,

    async upload(file, identity = {}, input = {}) {
      const checkedIdentity = requiredIdentity(identity);
      if (!checkedIdentity.ok) return checkedIdentity;
      const bytes = await bytesFor(file);
      if (!bytes) return { ok: false, error: 'PROJECT_SOURCE_UPLOAD_BINARY_REQUIRED' };
      const descriptor = validateProjectSourceUploadDescriptor({
        filename: input.filename || file?.name,
        mime_type: input.mime_type || file?.type,
        size: bytes.byteLength
      });
      if (!descriptor.ok) return descriptor;
      const bound = await projectSourceStoragePrefix(checkedIdentity.identity);
      if (!bound.ok) return bound;
      const sourceId = clean(input.source_id, 180).replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 100) || `src_${crypto.randomUUID()}`;
      const versionId = clean(input.version_id, 100).replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 80) || `${Date.now()}_${crypto.randomUUID()}`;
      const objectPath = `${bound.prefix}${sourceId}/${versionId}/${descriptor.filename}`;
      const contentHash = await sha256Hex(bytes);
      const response = await storageFetch(`object/${encodeURIComponent(PROJECT_SOURCE_BUCKET)}/${endpointPath(objectPath)}`, {
        method: 'POST',
        headers: { 'content-type': descriptor.mime_type, 'x-upsert': 'false', 'cache-control': 'no-store' },
        body: bytes
      });
      if (!response.ok) {
        let payload = null;
        try { payload = await response.clone().json(); } catch {}
        return safeStorageError(response.status, payload);
      }
      return {
        ok: true,
        source_id: sourceId,
        storage_ref: storageRef(objectPath),
        object_path: objectPath,
        filename: descriptor.filename,
        original_filename: descriptor.original_filename,
        filename_was_sanitized: descriptor.filename_was_sanitized,
        mime_type: descriptor.mime_type,
        size: descriptor.size,
        content_hash: `sha256:${contentHash}`,
        kind: descriptor.kind,
        private: true,
        public_url: null,
        binary_returned: false,
        variable_cost_eur: 0,
        paid_provider_calls: 0,
        production_deploy: false
      };
    },

    async uploadMany(files = [], identity = {}, input = {}) {
      const items = Array.isArray(files) ? files : [];
      if (!items.length) return { ok: false, error: 'PROJECT_SOURCE_UPLOAD_FILES_REQUIRED' };
      if (items.length > PROJECT_SOURCE_UPLOAD_LIMITS.max_files_per_request) return { ok: false, error: 'PROJECT_SOURCE_UPLOAD_FILE_COUNT_EXCEEDED', max_files: PROJECT_SOURCE_UPLOAD_LIMITS.max_files_per_request };
      const total = items.reduce((sum, item) => sum + Number(item?.size || 0), 0);
      if (total > PROJECT_SOURCE_UPLOAD_LIMITS.max_total_bytes) return { ok: false, error: 'PROJECT_SOURCE_UPLOAD_TOTAL_TOO_LARGE', limit_bytes: PROJECT_SOURCE_UPLOAD_LIMITS.max_total_bytes, actual_bytes: total };
      const uploaded = [];
      for (const file of items) {
        const result = await this.upload(file, identity, { ...input, source_id: null });
        if (!result.ok) {
          for (const prior of uploaded.reverse()) await removeBound(prior.storage_ref, identity).catch(() => null);
          return { ...result, rolled_back_uploads: uploaded.length, production_deploy: false };
        }
        uploaded.push(result);
      }
      return { ok: true, items: uploaded, count: uploaded.length, total_bytes: total, variable_cost_eur: 0, paid_provider_calls: 0, production_deploy: false };
    },

    async download(storageReference, identity = {}) {
      const bound = await assertProjectSourceStorageRefBound(storageReference, identity);
      if (!bound.ok) return bound;
      const response = await storageFetch(`object/authenticated/${encodeURIComponent(PROJECT_SOURCE_BUCKET)}/${endpointPath(bound.object_path)}`, { method: 'GET', headers: { 'cache-control': 'no-store' } });
      if (!response.ok) return safeStorageError(response.status);
      return {
        ok: true,
        response,
        storage_ref: bound.storage_ref,
        content_type: clean(response.headers.get('content-type'), 180) || 'application/octet-stream',
        content_length: Number(response.headers.get('content-length') || 0) || null,
        public_url: null,
        production_deploy: false
      };
    },

    async remove(storageReference, identity = {}) {
      return removeBound(storageReference, identity);
    },

    async replace(file, oldStorageReference, identity = {}, input = {}) {
      const oldBound = await assertProjectSourceStorageRefBound(oldStorageReference, identity);
      if (!oldBound.ok) return oldBound;
      const uploaded = await this.upload(file, identity, input);
      if (!uploaded.ok) return uploaded;
      return {
        ok: true,
        ...uploaded,
        replaces_storage_ref: oldBound.storage_ref,
        previous_object_retained_for_traceability: true,
        blind_overwrite: false,
        production_deploy: false
      };
    }
  };
}

export function projectSourceStorageManifest() {
  return {
    schema: 'aurentara.project-source-storage-supabase.v1',
    bucket: PROJECT_SOURCE_BUCKET,
    bucket_public: false,
    browser_service_role_exposed: false,
    direct_anon_access: false,
    direct_authenticated_access: false,
    access_path: 'cloudflare_access_operator_worker_only',
    project_bound_paths: true,
    arbitrary_client_paths: false,
    blind_overwrite: false,
    runtime_binary_storage: false,
    max_file_bytes: PROJECT_SOURCE_UPLOAD_LIMITS.max_file_bytes,
    max_files_per_request: PROJECT_SOURCE_UPLOAD_LIMITS.max_files_per_request,
    allowed_mime_types: clone(PROJECT_SOURCE_STORAGE_MIME_TYPES),
    paid_provider_calls: 0,
    variable_cost_eur: 0,
    production_deploy: false
  };
}
