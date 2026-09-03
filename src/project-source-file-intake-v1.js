const TEXT_MIME = new Map([
  ['text/plain', 'PLAIN_TEXT'],
  ['text/markdown', 'MARKDOWN'],
  ['text/csv', 'CSV'],
  ['application/json', 'JSON'],
  ['text/html', 'HTML_TEXT']
]);
const REGISTER_ONLY_MIME = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
]);
const IMAGE_MIME = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml']);
const MAX_TEXT_BYTES = 2_000_000;
const MAX_FILE_BYTES = 20_000_000;
const MAX_IMAGE_BYTES = 15_000_000;
const clean = (value, max = 2000) => String(value ?? '').trim().slice(0, max);

function bytes(value = '') {
  return new TextEncoder().encode(String(value)).byteLength;
}

function safeJson(value) {
  try { return { ok: true, value: JSON.parse(value) }; } catch { return { ok: false, error: 'INVALID_JSON' }; }
}

export function prepareProjectFileIntake(input = {}) {
  const mimeType = clean(input.mime_type, 160).toLowerCase();
  const sizeBytes = Number(input.size_bytes || 0);
  const storageRef = clean(input.storage_ref, 2000) || null;
  if (!mimeType) return { ok: false, error: 'FILE_MIME_REQUIRED' };
  if (!Number.isFinite(sizeBytes) || sizeBytes < 0 || sizeBytes > MAX_FILE_BYTES) return { ok: false, error: 'FILE_SIZE_LIMIT_EXCEEDED', max_bytes: MAX_FILE_BYTES };
  if (input.binary_data != null || input.bytes != null || input.base64 != null) return { ok: false, error: 'BINARY_DATA_NOT_ALLOWED_IN_RUNTIME_JSON' };

  if (TEXT_MIME.has(mimeType)) {
    const content = String(input.text_content ?? '');
    if (!content && !storageRef) return { ok: false, error: 'TEXT_CONTENT_OR_STORAGE_REF_REQUIRED' };
    if (content && bytes(content) > MAX_TEXT_BYTES) return { ok: false, error: 'TEXT_EXTRACTION_LIMIT_EXCEEDED', max_bytes: MAX_TEXT_BYTES };
    if (mimeType === 'application/json' && content) {
      const parsed = safeJson(content);
      if (!parsed.ok) return parsed;
    }
    return {
      ok: true,
      schema: 'aurentara.project-file-intake.v1',
      mime_type: mimeType,
      parser: TEXT_MIME.get(mimeType),
      extraction_status: content ? 'EXTRACTED' : 'REGISTERED_STORAGE_ONLY',
      extracted_text: content ? clean(content, MAX_TEXT_BYTES) : null,
      storage_ref: storageRef,
      readiness_satisfying: false,
      verification_status: 'UNVERIFIED',
      paid_provider_calls: 0,
      variable_cost_eur: 0,
      production_deploy: false
    };
  }

  if (REGISTER_ONLY_MIME.has(mimeType)) {
    return {
      ok: true,
      schema: 'aurentara.project-file-intake.v1',
      mime_type: mimeType,
      parser: null,
      extraction_status: 'REGISTERED_NOT_PARSED',
      extracted_text: null,
      storage_ref: storageRef,
      readiness_satisfying: false,
      verification_status: 'UNVERIFIED',
      parser_reason: 'V1 does not claim PDF/DOCX/XLSX extraction without a vetted parser.',
      paid_provider_calls: 0,
      variable_cost_eur: 0,
      production_deploy: false
    };
  }

  return { ok: false, error: 'FILE_MIME_NOT_SUPPORTED', mime_type: mimeType };
}

export function prepareProjectImageIntake(input = {}) {
  const mimeType = clean(input.mime_type, 160).toLowerCase();
  const sizeBytes = Number(input.size_bytes || 0);
  if (!IMAGE_MIME.has(mimeType)) return { ok: false, error: 'IMAGE_MIME_NOT_SUPPORTED', mime_type: mimeType || null };
  if (!Number.isFinite(sizeBytes) || sizeBytes < 0 || sizeBytes > MAX_IMAGE_BYTES) return { ok: false, error: 'IMAGE_SIZE_LIMIT_EXCEEDED', max_bytes: MAX_IMAGE_BYTES };
  if (input.binary_data != null || input.bytes != null || input.base64 != null) return { ok: false, error: 'BINARY_DATA_NOT_ALLOWED_IN_RUNTIME_JSON' };
  return {
    ok: true,
    schema: 'aurentara.project-image-intake.v1',
    mime_type: mimeType,
    size_bytes: sizeBytes,
    storage_ref: clean(input.storage_ref, 2000) || null,
    original_url: clean(input.original_url, 2000) || null,
    dimensions: input.dimensions && typeof input.dimensions === 'object' ? structuredClone(input.dimensions) : null,
    extraction_status: 'ASSET_REGISTERED',
    binary_persisted_in_runtime_json: false,
    paid_provider_calls: 0,
    variable_cost_eur: 0,
    production_deploy: false
  };
}

export function projectAssetStoragePlan(input = {}) {
  const storageRef = clean(input.storage_ref, 2000) || null;
  if (storageRef) {
    return {
      ok: true,
      status: 'EXISTING_STORAGE_REFERENCE',
      storage_ref: storageRef,
      external_infrastructure_change_required: false,
      external_write_performed: false,
      production_deploy: false
    };
  }
  return {
    ok: true,
    status: 'PRIVATE_STORAGE_REQUIRED_BEFORE_BINARY_PERSISTENCE',
    preferred_provider: 'EXISTING_OPERATOR_SUPABASE_STORAGE',
    new_provider_allowed: false,
    external_infrastructure_change_required: true,
    external_write_performed: false,
    operator_gate: 'SUPABASE_PRIVATE_STORAGE_SETUP_OR_EXISTING_BUCKET_CONFIRMATION_REQUIRED',
    expected_variable_cost_eur: 0,
    production_deploy: false
  };
}

export function projectFileIntakeManifest() {
  return {
    schema: 'aurentara.project-file-intake.v1',
    deterministic_text_mime_types: [...TEXT_MIME.keys()],
    register_only_mime_types: [...REGISTER_ONLY_MIME],
    image_mime_types: [...IMAGE_MIME],
    max_text_bytes: MAX_TEXT_BYTES,
    max_file_bytes: MAX_FILE_BYTES,
    max_image_bytes: MAX_IMAGE_BYTES,
    binary_data_in_runtime_json: false,
    paid_provider_calls: 0,
    variable_cost_eur: 0,
    production_deploy: false
  };
}
