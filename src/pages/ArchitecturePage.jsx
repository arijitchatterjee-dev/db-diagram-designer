import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Blueprint, CircleNotch, FloppyDisk, WarningCircle } from '@phosphor-icons/react';
import PageHeader from '../components/layout/PageHeader';
import EditableTitle from '../components/editor/EditableTitle';
import SaveState from '../components/ui/SaveState';
import StackLayer from '../components/plan/StackLayer';
import ArchitectureConcerns from '../components/plan/ArchitectureConcerns';
import FolderTree from '../components/plan/FolderTree';
import DecisionLog from '../components/plan/DecisionLog';
import { logIsStale, sortLog } from '../engine/decisions';
import { usePlanStore } from '../store/usePlanStore';
import { usePlanArchitecture } from '../hooks/usePlanArchitecture';
import { LAYERING, TOPOLOGY } from '../engine/architecture';
import { hydrateCustomModules } from '../engine/customModules';
import { recommendStack, applyOverrides } from '../engine/recommend';
import * as projectApi from '../api/projectApi';
import { apiErrorMessage } from '../api/axiosInstance';

const AUTOSAVE_IDLE_MS = 3000;

export default function ArchitecturePage() {
  const { id } = useParams();

  const project = usePlanStore((s) => s.project);
  const plan = usePlanStore((s) => s.plan);
  const loading = usePlanStore((s) => s.loading);
  const loadError = usePlanStore((s) => s.loadError);
  const dirty = usePlanStore((s) => s.dirty);
  const saving = usePlanStore((s) => s.saving);
  const saveError = usePlanStore((s) => s.saveError);
  const lastSavedAt = usePlanStore((s) => s.lastSavedAt);

  const loadPlan = usePlanStore((s) => s.loadPlan);
  const patch = usePlanStore((s) => s.patch);
  const save = usePlanStore((s) => s.save);

  const [pageError, setPageError] = useState(null);
  const [hydrated, setHydrated] = useState([]);

  useEffect(() => {
    loadPlan(id);
  }, [id, loadPlan]);

  useEffect(() => {
    let cancelled = false;
    hydrateCustomModules(plan?.customModules ?? []).then((next) => {
      if (!cancelled) setHydrated(next);
    });
    return () => {
      cancelled = true;
    };
  }, [plan?.customModules]);

  useEffect(() => {
    if (!dirty || saving) return undefined;
    const timer = setTimeout(save, AUTOSAVE_IDLE_MS);
    return () => clearTimeout(timer);
  }, [dirty, saving, plan, save]);

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

  useEffect(() => {
    if (!dirty) return undefined;
    function onBeforeUnload(e) {
      e.preventDefault();
      e.returnValue = '';
    }
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  const answers = plan?.answers ?? {};
  const stored = plan?.architecture ?? {};

  // Same shape as the plan page: answers plus the overrides recorded on the
  // saved rows are the inputs, and everything on screen is derived from them.
  const stackOverrides = useMemo(
    () =>
      Object.fromEntries(
        (plan?.stack ?? []).filter((row) => row.overridden).map((row) => [row.layer, row.choice])
      ),
    [plan?.stack]
  );
  const stack = useMemo(
    () => applyOverrides(recommendStack(answers), stackOverrides, answers),
    [answers, stackOverrides]
  );

  const {
    architecture,
    concerns,
    archOverrides,
    concernOverrides,
    archNotes,
    concernNotes,
    build,
    signature,
    buildFolders,
  } = usePlanArchitecture(plan, stack, hydrated);

  const rewrite = useCallback(
    (changes) => patch({ architecture: build(changes) }),
    [build, patch]
  );

  // Nothing regenerates on its own: an edited tree is somebody's work.
  const folders = plan?.folders ?? { generatedFrom: '', tree: [] };
  const foldersStale = folders.tree.length > 0 && folders.generatedFrom !== signature;

  function regenerateFolders() {
    patch({ folders: buildFolders() });
  }

  const decisions = stored.decisions ?? [];
  const decisionsStale = logIsStale(decisions, { stack, architecture });

  function syncDecisions() {
    rewrite({ decisions });
  }

  function editDecisions(next) {
    patch({ architecture: { ...build({ decisions }), decisions: sortLog(next) } });
  }

  function editFolders(tree) {
    // Editing keeps the signature: the tree still describes these inputs, it is
    // just no longer exactly what the generator would emit.
    patch({ folders: { generatedFrom: folders.generatedFrom || signature, tree } });
  }

  const renameProject = useCallback(
    async (name) => {
      setPageError(null);
      try {
        await projectApi.updateProject(id, { name });
        usePlanStore.setState((s) => ({ project: { ...s.project, name } }));
      } catch (err) {
        setPageError(apiErrorMessage(err, 'Could not rename the project'));
      }
    },
    [id]
  );

  if (loading) {
    return (
      <div className="center">
        <CircleNotch size={20} weight="bold" className="spin" />
        <p>Opening architecture</p>
      </div>
    );
  }

  if (loadError) {
    return (
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
    );
  }

  return (
    <>
      <PageHeader>
        <EditableTitle value={project?.name ?? ''} onChange={renameProject} />

        <span className="topbar__spacer" />

        {plan && <SaveState saving={saving} dirty={dirty} lastSavedAt={lastSavedAt} />}

        {plan && (
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
        )}
      </PageHeader>

      {(saveError || pageError) && (
        <p className="alert alert--error alert--bar" role="alert">
          <WarningCircle size={15} weight="fill" />
          {saveError || pageError}
        </p>
      )}

      <main className="doc">
        {!plan ? (
          <section className="blank">
            <span className="blank__icon">
              <Blueprint size={22} weight="duotone" />
            </span>
            <h2>No plan yet</h2>
            <p>
              Architecture is reasoned from the plan: the constraints you answered and the
              modules you picked. Start a plan and this fills in.
            </p>
            <Link to={`/project/${id}/plan`} className="btn btn--primary">
              Go to the plan
            </Link>
          </section>
        ) : (
          <>
            <section className="doc__section">
              <div className="doc__head">
                <h2>How the code is organised</h2>
                <p className="doc__hint">
                  Reasoned from your team size, your scale and how many modules the plan
                  covers. The folder structure follows from this choice.
                </p>
              </div>
              <StackLayer
                row={architecture.layering}
                label="Layering"
                dimension="layering"
                options={LAYERING}
                onOverride={(dimension, choice) => rewrite({ arch: { ...archOverrides, [dimension]: choice } })}
                onClearOverride={(dimension) => {
                  const next = { ...archOverrides };
                  delete next[dimension];
                  rewrite({ arch: next });
                }}
              />
              <input
                className="concern__note"
                value={archNotes.layering}
                onChange={(e) => rewrite({ notes: { ...archNotes, layering: e.target.value } })}
                placeholder="Your note on this decision"
                aria-label="Note on layering"
              />
            </section>

            <section className="doc__section">
              <div className="doc__head">
                <h2>How it is deployed</h2>
                <p className="doc__hint">
                  The engine is willing to say monolith, and says it more often than it is
                  chosen.
                </p>
              </div>
              <StackLayer
                row={architecture.topology}
                label="Topology"
                dimension="topology"
                options={TOPOLOGY}
                onOverride={(dimension, choice) => rewrite({ arch: { ...archOverrides, [dimension]: choice } })}
                onClearOverride={(dimension) => {
                  const next = { ...archOverrides };
                  delete next[dimension];
                  rewrite({ arch: next });
                }}
              />
              <input
                className="concern__note"
                value={archNotes.topology}
                onChange={(e) => rewrite({ notes: { ...archNotes, topology: e.target.value } })}
                placeholder="Your note on this decision"
                aria-label="Note on topology"
              />
            </section>

            <section className="doc__section">
              <div className="doc__head">
                <h2>
                  Cross-cutting concerns
                  <span className="doc__count">{concerns.filter((c) => !c.undecided).length} of 9</span>
                </h2>
                <p className="doc__hint">
                  The questions every project answers whatever it is built on. Several of
                  these read the stack: what is right beside Postgres is not what is right
                  beside Mongo.
                </p>
              </div>
              <ArchitectureConcerns
                concerns={concerns}
                notes={concernNotes}
                onChoose={(key, choice) => rewrite({ con: { ...concernOverrides, [key]: choice } })}
                onClear={(key) => {
                  const next = { ...concernOverrides };
                  delete next[key];
                  rewrite({ con: next });
                }}
                onNote={(key, note) => rewrite({ cNotes: { ...concernNotes, [key]: note } })}
              />
            </section>

            <section className="doc__section">
              <div className="doc__head">
                <h2>
                  Folder structure
                  {folders.tree.length > 0 && (
                    <span className="doc__count">{folders.tree.length} entries</span>
                  )}
                </h2>
                <p className="doc__hint">
                  Follows the layering choice, not just the framework. Layered puts a
                  feature across four folders; feature modules put it in one. Edit it
                  freely, and it goes into the exports as written.
                </p>
              </div>
              <FolderTree
                nodes={folders.tree}
                stale={foldersStale}
                onChange={editFolders}
                onRegenerate={regenerateFolders}
              />
            </section>

            <section className="doc__section">
              <div className="doc__head">
                <h2>
                  Decision log
                  {decisions.length > 0 && <span className="doc__count">{decisions.length}</span>}
                </h2>
                <p className="doc__hint">
                  Why the project is the way it is. Most of it writes itself from decisions
                  already made and follows them when they change. What you write here is
                  yours, and nothing regenerates it.
                </p>
              </div>
              <DecisionLog
                entries={decisions}
                stale={decisionsStale}
                onChange={editDecisions}
                onSync={syncDecisions}
              />
            </section>
          </>
        )}
      </main>
    </>
  );
}
