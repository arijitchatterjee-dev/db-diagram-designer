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
  // Free-floating annotations: [{ id, x, y, text }]. Not part of the DBML —
  // the language has no syntax for them — so they travel beside it.
  notes: [],

  nodes: [],
  edges: [],
  // TableGroup membership. Not nodes: the canvas derives each backdrop from
  // where its member tables currently sit.
  groups: [],

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

/**
 * Drops saved positions for tables the schema no longer has, so deleting or
 * renaming tables doesn't leave the layout map growing forever.
 *
 * Only safe when the diagram on screen was built from exactly the text being
 * saved: if the current text hasn't parsed yet, `nodes` describes an older
 * schema and pruning against it would throw away live positions.
 */
function pruneLayout({ dbml, lastParsedDbml, layout, nodes }) {
  if (dbml !== lastParsedDbml) return layout;

  const live = new Set(nodes.map((node) => node.id));
  const kept = {};
  for (const [key, position] of Object.entries(layout)) {
    if (live.has(key)) kept[key] = position;
  }
  return kept;
}

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
        notes: project.notes || [],
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

  /**
   * Swaps the whole document out — used by the SQL importer. The saved layout
   * goes with it: positions were chosen for tables that no longer exist, and
   * keeping them would drop an imported table onto an unrelated spot.
   */
  replaceDbml(dbml) {
    set({ dbml, layout: {}, nodes: [], edges: [], groups: [], dirty: true });
    get().syncDiagram();
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

    const { nodes: nextNodes, edges: nextEdges, groups } = buildGraph(
      result.schema,
      layout,
      previousPositions
    );

    set({
      nodes: nextNodes,
      edges: nextEdges,
      groups,
      parseError: null,
      lastParsedDbml: parsedText,
    });
  },

  onNodesChange(changes) {
    set((s) => ({ nodes: applyNodeChanges(changes, s.nodes) }));
  },

  // Dragging is the only thing that writes into `layout` — that map is purely
  // the record of positions the user chose by hand. Notes keep their position
  // on themselves instead, so they take the other branch.
  onNodeDragStop(_event, node) {
    if (node.type === 'note') {
      get().moveNote(node.id, node.position);
      return;
    }
    set((s) => ({
      layout: { ...s.layout, [node.id]: { x: node.position.x, y: node.position.y } },
      dirty: true,
    }));
  },

  addNote(position) {
    const id =
      globalThis.crypto?.randomUUID?.() ?? `n${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    set((s) => ({
      notes: [...s.notes, { id, x: position.x, y: position.y, text: '' }],
      dirty: true,
    }));
    return id;
  },

  // Called on every drag frame as well as on drop, so it deliberately does not
  // touch `dirty` — onNodeDragStop marks the change once the drag ends.
  dragNote(id, position) {
    set((s) => ({
      notes: s.notes.map((note) =>
        note.id === id ? { ...note, x: position.x, y: position.y } : note
      ),
    }));
  },

  moveNote(id, position) {
    set((s) => ({
      notes: s.notes.map((note) =>
        note.id === id ? { ...note, x: position.x, y: position.y } : note
      ),
      dirty: true,
    }));
  },

  setNoteText(id, text) {
    set((s) => ({
      notes: s.notes.map((note) => (note.id === id ? { ...note, text } : note)),
      dirty: true,
    }));
  },

  removeNote(id) {
    set((s) => ({ notes: s.notes.filter((note) => note.id !== id), dirty: true }));
  },

  async autoLayoutAll() {
    const parsedText = get().dbml;
    const result = await parseDbml(parsedText);
    if (!result.ok) return;

    // Clearing `layout` drops every manual position, so buildGraph falls back
    // to a fresh dagre pass for the whole graph.
    const { nodes, edges, groups } = buildGraph(result.schema, {}, {});
    set({
      nodes,
      edges,
      groups,
      layout: {},
      dirty: true,
      parseError: null,
      lastParsedDbml: parsedText,
    });
  },

  async save() {
    const { project, dbml, notes, saving } = get();
    if (!project || saving) return;

    const pruned = pruneLayout(get());

    set({ saving: true, saveError: null });
    try {
      const updated = await projectApi.updateProject(project._id, {
        name: project.name,
        description: project.description,
        dbml,
        layout: pruned,
        notes,
      });
      set({
        project: updated,
        layout: pruned,
        saving: false,
        dirty: false,
        lastSavedAt: new Date().toISOString(),
      });
    } catch (err) {
      set({ saving: false, saveError: apiErrorMessage(err, 'Could not save') });
    }
  },
}));
