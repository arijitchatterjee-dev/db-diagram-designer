import { create } from 'zustand';
import * as planApi from '../api/planApi';
import { apiErrorMessage } from '../api/axiosInstance';

const initialState = {
  // Project identity only — never the dbml. The plan routes deliberately
  // return just enough to title the page.
  project: null,
  plan: null,
  loading: false,
  loadError: null,

  dirty: false,
  saving: false,
  saveError: null,
  lastSavedAt: null,
};

// The shape a brand new plan starts from, matching the server's own defaults so
// the first save is a no-op difference rather than a surprise.
export const EMPTY_PLAN = {
  presetKey: 'custom',
  context: '',
  goal: '',
  answers: {},
  stack: [],
  apis: [],
  scaleNotes: [],
  aiReasoning: '',
  status: 'draft',
};

export const usePlanStore = create((set, get) => ({
  ...initialState,

  reset() {
    set({ ...initialState });
  },

  /**
   * Loads a project's plan, and does nothing if it is already loaded.
   *
   * Moving between the plan and architecture tabs remounts a page and calls
   * this again. Refetching there would discard edits that have not autosaved
   * yet, so a plan already in memory for this project is kept. A different
   * project, or `force`, reloads from scratch.
   */
  async loadPlan(projectId, { force = false } = {}) {
    const state = get();
    if (!force && state.project?._id === projectId && !state.loading) return;

    set({ ...initialState, loading: true });
    try {
      const { project, plan } = await planApi.getPlan(projectId);
      set({ project, plan, loading: false });
    } catch (err) {
      set({ loading: false, loadError: apiErrorMessage(err, 'Could not load this plan') });
    }
  },

  /**
   * Starts a plan in memory without touching the server. Nothing is persisted
   * until a save, so opening a project and backing out leaves no trace.
   */
  startPlan(seed = {}) {
    set({ plan: { ...EMPTY_PLAN, ...seed }, dirty: true });
  },

  patch(changes) {
    set((s) => ({
      plan: { ...(s.plan ?? EMPTY_PLAN), ...changes },
      dirty: true,
    }));
  },

  setAnswer(key, value) {
    set((s) => {
      const plan = s.plan ?? EMPTY_PLAN;
      return {
        plan: { ...plan, answers: { ...plan.answers, [key]: value } },
        dirty: true,
      };
    });
  },

  async save() {
    const { project, plan, saving } = get();
    if (!project || !plan || saving) return null;

    set({ saving: true, saveError: null });
    try {
      // Sent whole rather than as a diff: the endpoint is a partial update, so
      // sending everything is what makes the saved plan match what is on screen.
      const saved = await planApi.updatePlan(project._id, plan);
      set({
        plan: saved,
        saving: false,
        dirty: false,
        lastSavedAt: new Date().toISOString(),
      });
      return saved;
    } catch (err) {
      set({ saving: false, saveError: apiErrorMessage(err, 'Could not save the plan') });
      return null;
    }
  },

  async removePlan() {
    const { project } = get();
    if (!project) return false;

    try {
      await planApi.deletePlan(project._id);
      set({ plan: null, dirty: false, saveError: null });
      return true;
    } catch (err) {
      set({ saveError: apiErrorMessage(err, 'Could not delete the plan') });
      return false;
    }
  },
}));
