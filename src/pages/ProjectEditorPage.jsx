import { useEffect, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle,
  CircleNotch,
  FloppyDisk,
  Table,
  TreeStructure,
  WarningCircle,
} from '@phosphor-icons/react';
import Navbar from '../components/layout/Navbar';
import DbmlEditor from '../components/editor/DbmlEditor';
import DiagramCanvas from '../components/editor/DiagramCanvas';
import SplitPane from '../components/editor/SplitPane';
import { useProjectStore } from '../store/useProjectStore';

const PARSE_DEBOUNCE_MS = 400;
const AUTOSAVE_IDLE_MS = 3000;

function SaveState({ saving, dirty, lastSavedAt }) {
  if (saving) {
    return (
      <span className="state state--busy">
        <CircleNotch size={13} weight="bold" className="spin" />
        Saving
      </span>
    );
  }
  if (dirty) {
    return (
      <span className="state state--dirty">
        <span className="state__dot" aria-hidden="true" />
        Unsaved
      </span>
    );
  }
  return (
    <span className="state">
      <CheckCircle size={13} weight="fill" />
      {lastSavedAt ? 'Saved' : 'Up to date'}
    </span>
  );
}

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
        <div className="center">
          <CircleNotch size={20} weight="bold" className="spin" />
          <p>Opening project</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="app-shell">
        <Navbar />
        <div className="center">
          <span className="blank__icon">
            <WarningCircle size={20} weight="fill" />
          </span>
          <h2>{loadError}</h2>
          <Link to="/" className="btn">
            <ArrowLeft size={15} weight="bold" />
            Back to projects
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <Navbar>
        <Link to="/" className="back" title="Back to projects">
          <ArrowLeft size={15} weight="bold" />
        </Link>

        <h1 className="doc-title" title={project?.name}>
          {project?.name}
        </h1>

        <span className="doc-stats">
          <span title="Tables">
            <Table size={12} weight="bold" />
            {nodes.length}
          </span>
          <span title="Relationships">
            <TreeStructure size={12} weight="bold" />
            {edges.length}
          </span>
        </span>

        <span className="navbar__spacer" />

        <SaveState saving={saving} dirty={dirty} lastSavedAt={lastSavedAt} />

        <button
          type="button"
          className="btn btn--primary btn--sm"
          onClick={save}
          disabled={saving || !dirty}
          title="Save (Ctrl+S)"
        >
          <FloppyDisk size={14} weight="bold" />
          Save
        </button>
      </Navbar>

      {saveError && (
        <p className="alert alert--error alert--bar" role="alert">
          <WarningCircle size={15} weight="fill" />
          {saveError}
        </p>
      )}

      <SplitPane
        left={<DbmlEditor value={dbml} onChange={setDbml} parseError={parseError} />}
        right={<DiagramCanvas />}
      />
    </div>
  );
}
