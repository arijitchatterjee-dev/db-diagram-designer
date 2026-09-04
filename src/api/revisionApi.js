import api from './axiosInstance';

/**
 * The plan's history.
 *
 * Deliberate changes only: a revision is written when a proposal is applied or
 * when you checkpoint on purpose. Autosave writes none, which is what keeps
 * the list readable rather than one entry per keystroke.
 */
export async function listRevisions(projectId) {
  const { data } = await api.get(`/projects/${projectId}/revisions`);
  return data.revisions;
}

export async function getRevision(projectId, revisionId) {
  const { data } = await api.get(`/projects/${projectId}/revisions/${revisionId}`);
  return data.revision;
}

export async function createRevision(projectId, summary = '') {
  const { data } = await api.post(`/projects/${projectId}/revisions`, { summary });
  return data.revision;
}

export async function restoreRevision(projectId, revisionId) {
  const { data } = await api.post(`/projects/${projectId}/revisions/${revisionId}/restore`);
  return data.plan;
}
