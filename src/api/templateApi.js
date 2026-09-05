import api from './axiosInstance';

/**
 * Templates: arrangements of modules, owned per user.
 *
 * Same copy-not-reference discipline as blueprints and modules — applying one
 * to a plan copies what it names, so editing the template afterwards never
 * rewrites a project already under way. `version` is what makes that visible.
 */
export async function listTemplates() {
  const { data } = await api.get('/templates');
  return data.templates;
}

export async function createTemplate(payload) {
  const { data } = await api.post('/templates', payload);
  return data.template;
}

export async function getTemplate(id) {
  const { data } = await api.get(`/templates/${id}`);
  return data.template;
}

export async function updateTemplate(id, payload) {
  const { data } = await api.put(`/templates/${id}`, payload);
  return data.template;
}

export async function deleteTemplate(id) {
  await api.delete(`/templates/${id}`);
}
