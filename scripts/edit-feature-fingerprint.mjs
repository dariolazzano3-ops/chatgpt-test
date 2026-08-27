function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function featureId(type, value) {
  return `regression_fingerprint_${type}_${String(value).replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '').toLowerCase()}`;
}

function aliasesFor(value) {
  const raw = String(value || '').toLowerCase();
  const tokens = raw
    .replace(/^\/api\//, '')
    .split(/[^a-z0-9äöüß]+/i)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !['api', 'html', 'panel', 'form', 'button', 'link'].includes(token));
  return unique([raw, ...tokens]);
}

export function explicitFeatureRemovalRequested(prompt, aliases = []) {
  const text = String(prompt || '');
  const destructive = /\b(entfern(?:e|en|t)|lösch(?:e|en|t)|remove|delete|abschaff(?:en|e)|deaktivier(?:en|e)|ersetze\s+vollständig|replace\s+completely)\b/i.test(text);
  if (!destructive) return false;
  const lower = text.toLowerCase();
  return aliases.some((alias) => alias && lower.includes(String(alias).toLowerCase()));
}

function addFeature(map, type, value, source) {
  const key = `${type}:${value}`;
  if (!map.has(key)) {
    map.set(key, {
      key,
      type,
      value,
      aliases: aliasesFor(value),
      sources: []
    });
  }
  map.get(key).sources.push(source);
}

export function extractProjectFeatureFingerprint(files = {}) {
  const features = new Map();

  for (const [name, sourceValue] of Object.entries(files)) {
    const source = String(sourceValue || '');
    if (/\.html?$/i.test(name)) {
      for (const match of source.matchAll(/<(form|button|a|input|select|textarea)\b[^>]*\bid=["']([^"']+)["']/gi)) {
        addFeature(features, 'interactive_id', match[2], name);
      }
      for (const match of source.matchAll(/\bdata-factory-feature=["']([^"']+)["']/gi)) {
        addFeature(features, 'feature_marker', match[1], name);
      }
      for (const match of source.matchAll(/\bclass=["'][^"']*\b([a-z0-9_-]+-panel)\b[^"']*["']/gi)) {
        addFeature(features, 'panel', match[1], name);
      }
    }

    if (/\.(?:js|mjs|cjs)$/i.test(name) || /worker/i.test(name)) {
      for (const match of source.matchAll(/["'`](\/api\/[a-z0-9_./:-]+)["'`]/gi)) {
        addFeature(features, 'api_route', match[1].replace(/[),.;]+$/g, ''), name);
      }
    }
  }

  return [...features.values()]
    .map((feature) => ({ ...feature, sources: unique(feature.sources) }))
    .sort((a, b) => a.key.localeCompare(b.key));
}

export function buildEditFeatureRegressionChecks(request, baselineFiles = {}, candidateFiles = {}) {
  if (String(request?.mode || '').toLowerCase() !== 'edit') return [];

  const prompt = String(request?.prompt || '');
  const baseline = extractProjectFeatureFingerprint(baselineFiles);
  const candidateKeys = new Set(extractProjectFeatureFingerprint(candidateFiles).map((feature) => feature.key));

  return baseline
    .filter((feature) => !explicitFeatureRemovalRequested(prompt, feature.aliases))
    .map((feature) => ({
      id: featureId(feature.type, feature.value),
      ok: candidateKeys.has(feature.key),
      detail: `EDIT regression: existing ${feature.type} '${feature.value}' disappeared.`,
      fingerprint: { type: feature.type, value: feature.value, sources: feature.sources }
    }));
}

export function summarizeProjectFeatureFingerprint(files = {}) {
  const features = extractProjectFeatureFingerprint(files);
  const byType = {};
  for (const feature of features) byType[feature.type] = (byType[feature.type] || 0) + 1;
  return { version: 1, total: features.length, by_type: byType, features };
}
