import api from './axiosInstance';

/**
 * Reusable module checklists, owned per user.
 *
 * Attaching a blueprint to a project copies its checklist. Editing a blueprint
 * afterwards never reaches back into projects that already attached it — that
 * is what `version` records, and why re-attaching is the explicit way to move
 * a project onto a newer version.
 */
export async function listBlueprints() {
  const { data } = await api.get('/blueprints');
  return data.blueprints;
}

export async function createBlueprint(payload) {
  const { data } = await api.post('/blueprints', payload);
  return data.blueprint;
}

export async function getBlueprint(id) {
  const { data } = await api.get(`/blueprints/${id}`);
  return data.blueprint;
}

export async function updateBlueprint(id, payload) {
  const { data } = await api.put(`/blueprints/${id}`, payload);
  return data.blueprint;
}

export async function deleteBlueprint(id) {
  await api.delete(`/blueprints/${id}`);
}

// --- a project's attached modules ---

export async function attachModule(projectId, blueprintKey) {
  const { data } = await api.post(`/projects/${projectId}/modules`, { blueprintKey });
  return data.project;
}

export async function detachModule(projectId, blueprintKey) {
  const { data } = await api.delete(`/projects/${projectId}/modules/${blueprintKey}`);
  return data.project;
}

export async function setChecklistItem(projectId, blueprintKey, index, done) {
  const { data } = await api.patch(
    `/projects/${projectId}/modules/${blueprintKey}/checklist/${index}`,
    { done }
  );
  return data.project;
}
