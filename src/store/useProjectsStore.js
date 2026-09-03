import { create } from 'zustand';
import * as projectApi from '../api/projectApi';
import { apiErrorMessage } from '../api/axiosInstance';

/**
 * The project list, shared by the dashboard and the sidebar.
 *
 * Both need it, and both mount at once, so it lives here rather than being
 * fetched twice. The dashboard is what mutates it; the sidebar only reads.
 */
export const useProjectsStore = create((set, get) => ({
  projects: [],
  loading: false,
  loaded: false,
  error: null,

  async load({ force = false } = {}) {
    const state = get();
    if (!force && (state.loaded || state.loading)) return;

    set({ loading: true, error: null });
    try {
      set({ projects: await projectApi.listProjects(), loading: false, loaded: true });
    } catch (err) {
      set({ loading: false, error: apiErrorMessage(err, 'Could not load your projects') });
    }
  },

  // Local edits rather than a refetch: the caller already has the new row, and
  // the sidebar should not flicker because a name changed.
  upsert(project) {
    set((s) => {
      const exists = s.projects.some((p) => p._id === project._id);
      return {
        projects: exists
          ? s.projects.map((p) => (p._id === project._id ? { ...p, ...project } : p))
          : [project, ...s.projects],
      };
    });
  },

  remove(projectId) {
    set((s) => ({ projects: s.projects.filter((p) => p._id !== projectId) }));
  },

  setProjects(projects) {
    set({ projects, loaded: true });
  },
}));
