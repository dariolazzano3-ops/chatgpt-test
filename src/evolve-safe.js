import { evolveProject } from './evolver.js';

export async function evolveProjectSafely(request, env, body = {}) {
  const result = await evolveProject(request, env, body);

  if (!result?.ok) return result;

  if (!Array.isArray(result.updates) || result.updates.length === 0) {
    return {
      ...result,
      ok: false,
      error: result.error || 'EVOLVE_NO_VERIFIED_UPDATES',
      status: Number(result.status) >= 400 ? result.status : 422
    };
  }

  return result;
}
