const clone = (value) => structuredClone(value ?? null);
const clean = (value, max = 240) => String(value ?? '').trim().slice(0, max);

function validRuntime(runtime = {}) {
  return runtime?.schema === 'riosystems.operator-runtime.v1'
    && clean(runtime.operator_id, 160)
    && Number.isInteger(runtime.revision)
    && runtime.revision >= 1;
}

export function createMemoryOperatorRuntimeStore(seed = []) {
  const records = new Map();
  for (const runtime of Array.isArray(seed) ? seed : []) {
    if (!validRuntime(runtime)) throw new Error('INVALID_RUNTIME_SEED');
    records.set(runtime.operator_id, clone(runtime));
  }

  return {
    kind: 'memory',
    async load(operatorId) {
      const key = clean(operatorId, 160);
      return records.has(key) ? clone(records.get(key)) : null;
    },
    async create(runtime) {
      if (!validRuntime(runtime)) return { ok: false, error: 'VALID_OPERATOR_RUNTIME_REQUIRED' };
      if (records.has(runtime.operator_id)) return { ok: false, error: 'OPERATOR_RUNTIME_ALREADY_EXISTS' };
      records.set(runtime.operator_id, clone(runtime));
      return { ok: true, runtime: clone(runtime) };
    },
    async compareAndSwap(runtime, expectedRevision) {
      if (!validRuntime(runtime)) return { ok: false, error: 'VALID_OPERATOR_RUNTIME_REQUIRED' };
      const current = records.get(runtime.operator_id);
      if (!current) return { ok: false, error: 'OPERATOR_RUNTIME_NOT_FOUND' };
      const expected = Number(expectedRevision);
      if (!Number.isInteger(expected)) return { ok: false, error: 'STORE_EXPECTED_REVISION_REQUIRED' };
      if (current.revision !== expected) {
        return { ok: false, error: 'STORE_REVISION_CONFLICT', expected_revision: expected, actual_revision: current.revision };
      }
      if (runtime.revision !== expected + 1) {
        return { ok: false, error: 'STORE_NEXT_REVISION_INVALID', expected_next_revision: expected + 1, actual_next_revision: runtime.revision };
      }
      records.set(runtime.operator_id, clone(runtime));
      return { ok: true, runtime: clone(runtime) };
    },
    async replaceForTest(runtime) {
      if (!validRuntime(runtime)) return { ok: false, error: 'VALID_OPERATOR_RUNTIME_REQUIRED' };
      records.set(runtime.operator_id, clone(runtime));
      return { ok: true, runtime: clone(runtime) };
    },
    async count() {
      return records.size;
    }
  };
}

export function operatorRuntimeStoreManifest() {
  return {
    schema: 'riosystems.operator-runtime-store.v1',
    reference_adapter: 'memory',
    compare_and_swap: true,
    external_storage_required: false,
    provider_calls: false,
    production_deploy: false
  };
}
