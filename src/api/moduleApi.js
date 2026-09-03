import api from './axiosInstance';

/**
 * The reusable module library, owned per user.
 *
 * Same copy-not-reference discipline as blueprints: inserting one into a plan
 * copies it, and editing it here never rewrites a project already under way.
 * `version` is what makes that drift visible.
 */
export async function listModules() {
  const { data } = await api.get('/modules');
  return data.modules;
}

export async function createModule(payload) {
  const { data } = await api.post('/modules', payload);
  return data.module;
}

export async function getModule(id) {
  const { data } = await api.get(`/modules/${id}`);
  return data.module;
}

export async function updateModule(id, payload) {
  const { data } = await api.put(`/modules/${id}`, payload);
  return data.module;
}

export async function deleteModule(id) {
  await api.delete(`/modules/${id}`);
}
