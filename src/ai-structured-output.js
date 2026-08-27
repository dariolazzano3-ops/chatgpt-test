const SUPPORTED_TYPES = new Set(['object', 'array', 'string', 'number', 'integer', 'boolean', 'null']);
const SUPPORTED_KEYWORDS = new Set([
  'type', 'properties', 'required', 'additionalProperties', 'items', 'enum', 'const',
  'minLength', 'maxLength', 'minimum', 'maximum', 'minItems', 'maxItems', 'description'
]);

const MAX_SCHEMA_DEPTH = 12;
const MAX_SCHEMA_PROPERTIES = 128;
const MAX_SCHEMA_NODES = 512;
const MAX_VALIDATION_ERRORS = 64;

const isObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

function sameJsonValue(a, b) {
  try { return JSON.stringify(a) === JSON.stringify(b); } catch { return false; }
}

function valueType(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'number' && Number.isInteger(value)) return 'integer';
  return typeof value;
}

function pushError(errors, error) {
  if (errors.length < MAX_VALIDATION_ERRORS) errors.push(error);
}

export function validateStructuredOutputSchema(schema = {}) {
  const errors = [];
  let nodes = 0;
  let properties = 0;

  function walk(node, path, depth) {
    nodes += 1;
    if (nodes > MAX_SCHEMA_NODES) {
      pushError(errors, { code: 'AI_SCHEMA_NODE_LIMIT_EXCEEDED', path });
      return;
    }
    if (depth > MAX_SCHEMA_DEPTH) {
      pushError(errors, { code: 'AI_SCHEMA_DEPTH_LIMIT_EXCEEDED', path });
      return;
    }
    if (!isObject(node)) {
      pushError(errors, { code: 'AI_SCHEMA_NODE_INVALID', path });
      return;
    }

    for (const key of Object.keys(node)) {
      if (!SUPPORTED_KEYWORDS.has(key)) pushError(errors, { code: 'AI_SCHEMA_KEYWORD_UNSUPPORTED', path, keyword: key });
    }

    if (!SUPPORTED_TYPES.has(node.type)) {
      pushError(errors, { code: 'AI_SCHEMA_TYPE_REQUIRED_OR_UNSUPPORTED', path, actual: node.type ?? null });
      return;
    }

    if (hasOwn(node, 'enum') && (!Array.isArray(node.enum) || node.enum.length === 0 || node.enum.length > 100)) {
      pushError(errors, { code: 'AI_SCHEMA_ENUM_INVALID', path });
    }

    if (node.type === 'object') {
      if (node.properties !== undefined && !isObject(node.properties)) {
        pushError(errors, { code: 'AI_SCHEMA_PROPERTIES_INVALID', path });
      }
      const objectProperties = isObject(node.properties) ? node.properties : {};
      properties += Object.keys(objectProperties).length;
      if (properties > MAX_SCHEMA_PROPERTIES) pushError(errors, { code: 'AI_SCHEMA_PROPERTY_LIMIT_EXCEEDED', path });

      if (node.required !== undefined) {
        if (!Array.isArray(node.required) || node.required.some((key) => typeof key !== 'string')) {
          pushError(errors, { code: 'AI_SCHEMA_REQUIRED_INVALID', path });
        } else {
          for (const key of node.required) {
            if (!hasOwn(objectProperties, key)) pushError(errors, { code: 'AI_SCHEMA_REQUIRED_PROPERTY_MISSING', path, property: key });
          }
        }
      }

      if (node.additionalProperties !== undefined && typeof node.additionalProperties !== 'boolean') {
        pushError(errors, { code: 'AI_SCHEMA_ADDITIONAL_PROPERTIES_INVALID', path });
      }

      for (const [key, child] of Object.entries(objectProperties)) walk(child, `${path}.properties.${key}`, depth + 1);
    }

    if (node.type === 'array') {
      if (!isObject(node.items)) pushError(errors, { code: 'AI_SCHEMA_ITEMS_REQUIRED', path });
      else walk(node.items, `${path}.items`, depth + 1);
      for (const key of ['minItems', 'maxItems']) {
        if (node[key] !== undefined && (!Number.isInteger(node[key]) || node[key] < 0)) pushError(errors, { code: 'AI_SCHEMA_ARRAY_LIMIT_INVALID', path, keyword: key });
      }
      if (Number.isInteger(node.minItems) && Number.isInteger(node.maxItems) && node.minItems > node.maxItems) {
        pushError(errors, { code: 'AI_SCHEMA_ARRAY_LIMIT_CONFLICT', path });
      }
    }

    if (node.type === 'string') {
      for (const key of ['minLength', 'maxLength']) {
        if (node[key] !== undefined && (!Number.isInteger(node[key]) || node[key] < 0)) pushError(errors, { code: 'AI_SCHEMA_STRING_LIMIT_INVALID', path, keyword: key });
      }
      if (Number.isInteger(node.minLength) && Number.isInteger(node.maxLength) && node.minLength > node.maxLength) {
        pushError(errors, { code: 'AI_SCHEMA_STRING_LIMIT_CONFLICT', path });
      }
    }

    if (node.type === 'number' || node.type === 'integer') {
      for (const key of ['minimum', 'maximum']) {
        if (node[key] !== undefined && (typeof node[key] !== 'number' || !Number.isFinite(node[key]))) pushError(errors, { code: 'AI_SCHEMA_NUMBER_LIMIT_INVALID', path, keyword: key });
      }
      if (Number.isFinite(node.minimum) && Number.isFinite(node.maximum) && node.minimum > node.maximum) {
        pushError(errors, { code: 'AI_SCHEMA_NUMBER_LIMIT_CONFLICT', path });
      }
    }
  }

  walk(schema, '$', 0);
  return {
    ok: errors.length === 0,
    errors,
    limits: { max_depth: MAX_SCHEMA_DEPTH, max_properties: MAX_SCHEMA_PROPERTIES, max_nodes: MAX_SCHEMA_NODES }
  };
}

export function validateStructuredOutput(value, schema = {}) {
  const schemaValidation = validateStructuredOutputSchema(schema);
  if (!schemaValidation.ok) return { ok: false, kind: 'schema_invalid', errors: schemaValidation.errors };

  const errors = [];

  function validate(current, node, path) {
    const actual = valueType(current);
    const typeMatches = node.type === 'number' ? typeof current === 'number' && Number.isFinite(current)
      : node.type === 'integer' ? Number.isInteger(current)
      : node.type === 'object' ? isObject(current)
      : node.type === 'array' ? Array.isArray(current)
      : node.type === 'null' ? current === null
      : typeof current === node.type;

    if (!typeMatches) {
      pushError(errors, { code: 'AI_OUTPUT_TYPE_MISMATCH', path, expected: node.type, actual });
      return;
    }

    if (hasOwn(node, 'const') && !sameJsonValue(current, node.const)) pushError(errors, { code: 'AI_OUTPUT_CONST_MISMATCH', path });
    if (Array.isArray(node.enum) && !node.enum.some((item) => sameJsonValue(item, current))) pushError(errors, { code: 'AI_OUTPUT_ENUM_MISMATCH', path });

    if (node.type === 'object') {
      const properties = isObject(node.properties) ? node.properties : {};
      for (const key of node.required || []) {
        if (!hasOwn(current, key)) pushError(errors, { code: 'AI_OUTPUT_REQUIRED_PROPERTY_MISSING', path: `${path}.${key}` });
      }
      if (node.additionalProperties === false) {
        for (const key of Object.keys(current)) {
          if (!hasOwn(properties, key)) pushError(errors, { code: 'AI_OUTPUT_ADDITIONAL_PROPERTY', path: `${path}.${key}` });
        }
      }
      for (const [key, childSchema] of Object.entries(properties)) {
        if (hasOwn(current, key)) validate(current[key], childSchema, `${path}.${key}`);
      }
    }

    if (node.type === 'array') {
      if (Number.isInteger(node.minItems) && current.length < node.minItems) pushError(errors, { code: 'AI_OUTPUT_MIN_ITEMS', path, expected: node.minItems, actual: current.length });
      if (Number.isInteger(node.maxItems) && current.length > node.maxItems) pushError(errors, { code: 'AI_OUTPUT_MAX_ITEMS', path, expected: node.maxItems, actual: current.length });
      current.forEach((item, index) => validate(item, node.items, `${path}[${index}]`));
    }

    if (node.type === 'string') {
      if (Number.isInteger(node.minLength) && current.length < node.minLength) pushError(errors, { code: 'AI_OUTPUT_MIN_LENGTH', path, expected: node.minLength, actual: current.length });
      if (Number.isInteger(node.maxLength) && current.length > node.maxLength) pushError(errors, { code: 'AI_OUTPUT_MAX_LENGTH', path, expected: node.maxLength, actual: current.length });
    }

    if (node.type === 'number' || node.type === 'integer') {
      if (Number.isFinite(node.minimum) && current < node.minimum) pushError(errors, { code: 'AI_OUTPUT_MINIMUM', path, expected: node.minimum, actual: current });
      if (Number.isFinite(node.maximum) && current > node.maximum) pushError(errors, { code: 'AI_OUTPUT_MAXIMUM', path, expected: node.maximum, actual: current });
    }
  }

  validate(value, schema, '$');
  return { ok: errors.length === 0, kind: errors.length ? 'output_invalid' : 'valid', errors };
}

export function parseAndValidateStructuredOutput(raw, schema = {}) {
  if (typeof raw !== 'string') return { ok: false, kind: 'parse_error', errors: [{ code: 'AI_OUTPUT_RAW_TEXT_REQUIRED', path: '$' }] };
  let value;
  try { value = JSON.parse(raw); }
  catch { return { ok: false, kind: 'parse_error', errors: [{ code: 'AI_OUTPUT_JSON_PARSE_FAILED', path: '$' }] }; }
  const validation = validateStructuredOutput(value, schema);
  return validation.ok ? { ...validation, value } : validation;
}
