import { create } from 'zustand';
import { applyNodeChanges } from 'reactflow';
import * as projectApi from '../api/projectApi';
import { parseDbml } from '../utils/dbmlParser';
import { buildGraph } from '../utils/buildGraph';
import { apiErrorMessage } from '../api/axiosInstance';

const initialState = {
  project: null,
  loading: false,
  loadError: null,

  dbml: '',
  layout: {},

  nodes: [],
  edges: [],

  // Null while the current text parses cleanly; otherwise { message, line }.
  // The diagram keeps rendering the last good parse either way.
  parseError: null,
  // Text behind the diagram currently on screen — lets us skip redundant parses.
  lastParsedDbml: null,

  dirty: false,
  saving: false,
  saveError: null,
  lastSavedAt: null,
};

export const useProjectStore = create((set, get) => ({
  ...initialState,

  reset() {
    set({ ...initialState });
  },

  async loadProject(id) {
    set({ ...initialState, loading: true });
    try {
      const project = await projectApi.getProject(id);
      set({
        project,
        dbml: project.dbml || '',
        layout: project.layout || {},
        loading: false,
      });
      get().syncDiagram();
    } catch (err) {
      set({ loading: false, loadError: apiErrorMessage(err, 'Could not load this project') });
    }
  },

  setDbml(dbml) {
    set({ dbml, dirty: true });
  },

  setName(name) {
    set((s) => ({ project: s.project ? { ...s.project, name } : s.project, dirty: true }));
  },

  /**
   * Re-parses the current DBML and rebuilds the diagram. Called on a debounce
   * from the editor, so it runs on pauses in typing rather than per keystroke.
   */
  async syncDiagram() {
    const parsedText = get().dbml;

    // Already rendering exactly this text. Clear any stale error (the user may
    // have typed something broken and then undone it) and skip the work.
    if (parsedText === get().lastParsedDbml) {
      if (get().parseError) set({ parseError: null });
      return;
    }

    const result = await parseDbml(parsedText);

    // The parser loads lazily, so a slow first parse could resolve after the
    // user has typed more. Drop any result that no longer matches the editor.
    if (get().dbml !== parsedText) return;

    if (!result.ok) {
      // Mid-typing text is often temporarily invalid. Surface the error but
      // leave the last good nodes/edges on screen.
      set({ parseError: result.error });
      return;
    }

    const { layout, nodes } = get();
    const previousPositions = {};
    nodes.forEach((node) => {
      previousPositions[node.id] = node.position;
    });

    const { nodes: nextNodes, edges: nextEdges } = buildGraph(
      result.schema,
      layout,
      previousPositions
    );

    set({
      nodes: nextNodes,
      edges: nextEdges,
      parseError: null,
      lastParsedDbml: parsedText,
    });
  },

  onNodesChange(changes) {
    set((s) => ({ nodes: applyNodeChanges(changes, s.nodes) }));
  },

  // Dragging is the only thing that writes into `layout` — that map is purely
  // the record of positions the user chose by hand.
  onNodeDragStop(_event, node) {
    set((s) => ({
      layout: { ...s.layout, [node.id]: { x: node.position.x, y: node.position.y } },
      dirty: true,
    }));
  },

  async autoLayoutAll() {
    const parsedText = get().dbml;
    const result = await parseDbml(parsedText);
    if (!result.ok) return;

    // Clearing `layout` drops every manual position, so buildGraph falls back
    // to a fresh dagre pass for the whole graph.
    const { nodes, edges } = buildGraph(result.schema, {}, {});
    set({
      nodes,
      edges,
      layout: {},
      dirty: true,
      parseError: null,
      lastParsedDbml: parsedText,
    });
  },

  async save() {
    const { project, dbml, layout, saving } = get();
    if (!project || saving) return;

    set({ saving: true, saveError: null });
    try {
      const updated = await projectApi.updateProject(project._id, {
        name: project.name,
        description: project.description,
        dbml,
        layout,
      });
      set({
        project: updated,
        saving: false,
        dirty: false,
        lastSavedAt: new Date().toISOString(),
      });
    } catch (err) {
      set({ saving: false, saveError: apiErrorMessage(err, 'Could not save') });
    }
  },
}));
