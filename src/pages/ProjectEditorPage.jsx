import { useEffect, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import Navbar from '../components/layout/Navbar';
import DbmlEditor from '../components/editor/DbmlEditor';
import DiagramCanvas from '../components/editor/DiagramCanvas';
import { useProjectStore } from '../store/useProjectStore';

const PARSE_DEBOUNCE_MS = 400;
const AUTOSAVE_IDLE_MS = 3000;

export default function ProjectEditorPage() {
  const { id } = useParams();

  const project = useProjectStore((s) => s.project);
  const loading = useProjectStore((s) => s.loading);
  const loadError = useProjectStore((s) => s.loadError);
  const dbml = useProjectStore((s) => s.dbml);
  const layout = useProjectStore((s) => s.layout);
  const parseError = useProjectStore((s) => s.parseError);
  const dirty = useProjectStore((s) => s.dirty);
  const saving = useProjectStore((s) => s.saving);
  const saveError = useProjectStore((s) => s.saveError);
  const lastSavedAt = useProjectStore((s) => s.lastSavedAt);
  const nodes = useProjectStore((s) => s.nodes);
  const edges = useProjectStore((s) => s.edges);

  const setDbml = useProjectStore((s) => s.setDbml);
  const syncDiagram = useProjectStore((s) => s.syncDiagram);
  const save = useProjectStore((s) => s.save);
  const loadProject = useProjectStore((s) => s.loadProject);
  const reset = useProjectStore((s) => s.reset);

  useEffect(() => {
    loadProject(id);
    return () => reset();
  }, [id, loadProject, reset]);

  // Debounced re-parse: typing stays smooth, the diagram catches up on pauses.
  const firstParse = useRef(true);
  useEffect(() => {
    if (firstParse.current) {
      firstParse.current = false;
      return undefined;
    }
    const timer = setTimeout(syncDiagram, PARSE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [dbml, syncDiagram]);

  // Autosave once editing has been idle for a moment.
  useEffect(() => {
    if (!dirty || saving) return undefined;
    const timer = setTimeout(save, AUTOSAVE_IDLE_MS);
    return () => clearTimeout(timer);
  }, [dirty, saving, dbml, layout, save]);

  // Ctrl/Cmd+S saves without waiting for the autosave timer.
  useEffect(() => {
    function onKeyDown(e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        save();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [save]);

  // Last line of defence against closing the tab mid-edit.
  useEffect(() => {
    if (!dirty) return undefined;
    function onBeforeUnload(e) {
      e.preventDefault();
      e.returnValue = '';
    }
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  if (loading) {
    return (
      <div className="app-shell">
        <Navbar />
        <div className="page-center muted">Loading project…</div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="app-shell">
        <Navbar />
        <div className="page-center">
          <div className="alert alert--error">{loadError}</div>
          <Link to="/" className="btn btn--ghost">
            Back to projects
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <Navbar>
        <span className="editor-title">{project?.name}</span>
        <span className="editor-stats">
          {nodes.length} {nodes.length === 1 ? 'table' : 'tables'} · {edges.length}{' '}
          {edges.length === 1 ? 'relation' : 'relations'}
        </span>
        <span className={`save-state${dirty ? ' is-dirty' : ''}`}>
          {saving
            ? 'Saving…'
            : dirty
              ? 'Unsaved changes'
              : lastSavedAt
                ? 'All changes saved'
                : 'Saved'}
        </span>
        <button
          type="button"
          className="btn btn--primary btn--sm"
          onClick={save}
          disabled={saving || !dirty}
        >
          Save
        </button>
      </Navbar>

      {saveError && <div className="alert alert--error alert--bar">{saveError}</div>}

      <div className="split">
        <section className="split__left">
          <DbmlEditor value={dbml} onChange={setDbml} parseError={parseError} />
        </section>
        <section className="split__right">
          <DiagramCanvas />
        </section>
      </div>
    </div>
  );
}
