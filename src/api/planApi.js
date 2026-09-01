import api from './axiosInstance';

/**
 * The planning half of a project. Kept off `/projects/:id` on purpose: the
 * diagram editor loads that on every open and has no use for a plan.
 *
 * `plan` is null for a project that has never been planned, which is not an
 * error — it is what puts the wizard on screen instead of the document.
 */
export async function getPlan(projectId) {
  const { data } = await api.get(`/projects/${projectId}/plan`);
  return { project: data.project, plan: data.plan };
}

export async function updatePlan(projectId, payload) {
  const { data } = await api.put(`/projects/${projectId}/plan`, payload);
  return data.plan;
}

export async function deletePlan(projectId) {
  await api.delete(`/projects/${projectId}/plan`);
}

/**
 * Optional prose about a plan the rules engine already produced.
 *
 * The plan is sent in the body rather than read from the database, so what
 * gets explained is what is on screen, including edits not yet saved. A 503
 * means the server has no API key configured, which is a normal state and not
 * an error worth shouting about.
 */
export async function explainPlan(projectId, plan) {
  const { data } = await api.post(`/projects/${projectId}/plan/reasoning`, { plan });
  return data;
}
