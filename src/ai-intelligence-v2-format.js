const isObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

function push(errors, error) {
  if (errors.length < 64) errors.push(error);
}

function validFormat(value, format) {
  if (typeof value !== 'string') return true;
  if (format === 'email') return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  if (format === 'date-time') return Number.isFinite(Date.parse(value)) && /T/.test(value);
  if (format === 'date') return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`));
  if (format === 'uri') {
    try { const parsed = new URL(value); return Boolean(parsed.protocol && parsed.hostname); } catch { return false; }
  }
  if (format === 'uuid') return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  return false;
}

export function validateFormatConstraints(value, schema = {}) {
  const errors = [];
  function walk(current, node, path, depth) {
    if (depth > 12 || !isObject(node)) return;
    if (node.type === 'string' && typeof current === 'string') {
      if (node.pattern !== undefined) {
        try {
          if (!(new RegExp(String(node.pattern))).test(current)) push(errors, { code: 'AI_V2_OUTPUT_PATTERN_MISMATCH', path, pattern: String(node.pattern) });
        } catch {
          push(errors, { code: 'AI_V2_SCHEMA_PATTERN_INVALID', path });
        }
      }
      if (node.format !== undefined && !validFormat(current, String(node.format))) {
        push(errors, { code: 'AI_V2_OUTPUT_FORMAT_MISMATCH', path, format: String(node.format) });
      }
    }
    if (node.type === 'object' && isObject(current)) {
      const props = isObject(node.properties) ? node.properties : {};
      for (const [key, child] of Object.entries(props)) {
        if (Object.prototype.hasOwnProperty.call(current, key)) walk(current[key], child, `${path}.${key}`, depth + 1);
      }
    }
    if (node.type === 'array' && Array.isArray(current) && isObject(node.items)) {
      current.forEach((item, index) => walk(item, node.items, `${path}[${index}]`, depth + 1));
    }
  }
  walk(value, schema, '$', 0);
  return { ok: errors.length === 0, errors };
}

export function validateV2SchemaExtensions(schema = {}) {
  const errors = [];
  const supportedFormats = new Set(['email', 'date-time', 'date', 'uri', 'uuid']);
  function walk(node, path, depth) {
    if (depth > 12 || !isObject(node)) return;
    if (node.pattern !== undefined) {
      try { new RegExp(String(node.pattern)); } catch { push(errors, { code: 'AI_V2_SCHEMA_PATTERN_INVALID', path }); }
    }
    if (node.format !== undefined && !supportedFormats.has(String(node.format))) push(errors, { code: 'AI_V2_SCHEMA_FORMAT_UNSUPPORTED', path, format: String(node.format) });
    if (node.type === 'object' && isObject(node.properties)) for (const [key, child] of Object.entries(node.properties)) walk(child, `${path}.properties.${key}`, depth + 1);
    if (node.type === 'array' && isObject(node.items)) walk(node.items, `${path}.items`, depth + 1);
  }
  walk(schema, '$', 0);
  return { ok: errors.length === 0, errors, supported_formats: [...supportedFormats] };
}
