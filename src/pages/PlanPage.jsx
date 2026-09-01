import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  CircleNotch,
  Compass,
  FloppyDisk,
  MagicWand,
  Table,
  Trash,
  WarningCircle,
} from '@phosphor-icons/react';
import Navbar from '../components/layout/Navbar';
import ProjectTabs from '../components/layout/ProjectTabs';
import EditableTitle from '../components/editor/EditableTitle';
import SaveState from '../components/ui/SaveState';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import StackLayer from '../components/plan/StackLayer';
import ApiTable from '../components/plan/ApiTable';
import PlanAnswers from '../components/plan/PlanAnswers';
import PlanModules from '../components/plan/PlanModules';
import PlanChecklists from '../components/plan/PlanChecklists';
import GenerateSchemaDialog from '../components/plan/GenerateSchemaDialog';
import ExportMenu from '../components/plan/ExportMenu';
import PlanReasoning from '../components/plan/PlanReasoning';
import PrintableSpec from '../components/plan/PrintableSpec';
import { buildSpec } from '../engine/buildSpec';
import {
  generateDbml,
  generationPlan,
  appendMissingTables,
  isUntouchedSchema,
} from '../engine/generateDbml';
import { usePlanStore } from '../store/usePlanStore';
import { PRESETS, STATUSES } from '../engine/planOptions';
import {
  recommendStack,
  applyOverrides,
  toStackRows,
  scaleNotes,
  resolveDependencies,
  removeModule,
  apisFor,
  entitiesFor,
} from '../engine/recommend';
import * as projectApi from '../api/projectApi';
import * as planApi from '../api/planApi';
import * as blueprintApi from '../api/blueprintApi';
import { apiErrorMessage } from '../api/axiosInstance';

const AUTOSAVE_IDLE_MS = 3000;

export default function PlanPage() {
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
  const removePlan = usePlanStore((s) => s.removePlan);
  const reset = usePlanStore((s) => s.reset);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [pageError, setPageError] = useState(null);
  const [notice, setNotice] = useState(null);

  const [blueprints, setBlueprints] = useState([]);
  const [selectedModules, setSelectedModules] = useState([]);
  const [busyKey, setBusyKey] = useState(null);

  const [schemaPlan, setSchemaPlan] = useState(null);
  const [writingSchema, setWritingSchema] = useState(false);
  const navigate = useNavigate();

  const [explaining, setExplaining] = useState(false);
  const [aiUnavailable, setAiUnavailable] = useState(false);
  const [aiError, setAiError] = useState(null);

  useEffect(() => {
    loadPlan(id);
    return () => reset();
  }, [id, loadPlan, reset]);

  useEffect(() => {
    setSelectedModules(project?.selectedModules ?? []);
  }, [project]);

  useEffect(() => {
    let cancelled = false;
    blueprintApi
      .listBlueprints()
      .then((list) => !cancelled && setBlueprints(list))
      .catch(() => {
        // Checklists are an optional half of the page. Failing to load them
        // should not take the plan down with it.
        if (!cancelled) setBlueprints([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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

  // `answers` plus the overrides recorded on the saved rows are the real
  // inputs; the stack is derived from them every render so the reasoning on
  // screen always matches the answers on screen.
  const overrides = useMemo(
    () =>
      Object.fromEntries(
        (plan?.stack ?? []).filter((row) => row.overridden).map((row) => [row.layer, row.choice])
      ),
    [plan?.stack]
  );
  const stack = useMemo(
    () => applyOverrides(recommendStack(plan?.answers ?? {}), overrides, plan?.answers ?? {}),
    [plan?.answers, overrides]
  );
  const entities = useMemo(() => entitiesFor(plan?.moduleKeys ?? []), [plan?.moduleKeys]);
  const notes = useMemo(() => scaleNotes(plan?.answers ?? {}, stack), [plan?.answers, stack]);
  const apis = plan?.apis ?? [];
  const derivedApis = useMemo(() => apisFor(plan?.moduleKeys ?? []), [plan?.moduleKeys]);
  const apisStale =
    apis.length > 0 &&
    JSON.stringify(apis.map((a) => `${a.method} ${a.path}`).sort()) !==
      JSON.stringify(derivedApis.map((a) => `${a.method} ${a.path}`).sort());

  // Recomputes everything downstream of the answers in one write, so a saved
  // plan never holds a stack that disagrees with its own inputs.
  // `overrides` is derived from the stack rows, never stored beside them, so it
  // is passed in rather than patched: writing it onto the plan would send a
  // field the API does not have.
  const rewrite = useCallback(
    (changes, nextOverrides = overrides) => {
      const answers = changes.answers ?? plan?.answers ?? {};
      const nextStack = applyOverrides(recommendStack(answers), nextOverrides, answers);
      patch({
        ...changes,
        stack: toStackRows(nextStack),
        scaleNotes: scaleNotes(answers, nextStack),
      });
    },
    [plan?.answers, overrides, patch]
  );

  function setAnswer(key, value) {
    const answers = { ...(plan.answers ?? {}) };
    if (value) answers[key] = value;
    else delete answers[key];
    rewrite({ answers });
  }

  function setOverride(layer, choice) {
    rewrite({}, { ...overrides, [layer]: choice });
  }

  function clearOverride(layer) {
    const next = { ...overrides };
    delete next[layer];
    rewrite({}, next);
  }

  function toggleModule(key) {
    const current = plan.moduleKeys ?? [];
    const isOn = current.includes(key);
    const result = isOn ? removeModule(current, key) : resolveDependencies([...current, key]);
    const knockOn = isOn ? result.dropped : result.added;

    setNotice(
      knockOn.length
        ? isOn
          ? `Also removed ${knockOn.map((x) => x.name).join(', ')}, which depended on it.`
          : `Also added ${knockOn.map((x) => x.name).join(', ')}, which it needs.`
        : null
    );
    patch({ moduleKeys: result.keys });
  }

  const editApi = (index, changes) =>
    patch({ apis: apis.map((api, i) => (i === index ? { ...api, ...changes } : api)) });
  const addApi = () =>
    patch({ apis: [...apis, { moduleKey: '', method: 'GET', path: '/api/', purpose: '', auth: true }] });
  const removeApi = (index) => patch({ apis: apis.filter((_, i) => i !== index) });
  const rederiveApis = () => patch({ apis: derivedApis });

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

  async function attachBlueprints(keys) {
    setPageError(null);
    for (const key of keys) {
      setBusyKey(key);
      try {
        const updated = await blueprintApi.attachModule(id, key);
        setSelectedModules(updated.selectedModules);
      } catch (err) {
        setPageError(apiErrorMessage(err, `Could not attach the ${key} checklist`));
        break;
      }
    }
    setBusyKey(null);
  }

  async function detachBlueprint(key) {
    setBusyKey(key);
    try {
      const updated = await blueprintApi.detachModule(id, key);
      setSelectedModules(updated.selectedModules);
    } catch (err) {
      setPageError(apiErrorMessage(err, 'Could not remove the checklist'));
    } finally {
      setBusyKey(null);
    }
  }

  // Ticked locally first so a checkbox never lags a round trip, and put back
  // if the request fails.
  async function toggleChecklistItem(blueprintKey, index, done) {
    const before = selectedModules;
    setSelectedModules((mods) =>
      mods.map((module) =>
        module.blueprintKey !== blueprintKey
          ? module
          : {
              ...module,
              checklist: module.checklist.map((item, i) => (i === index ? { ...item, done } : item)),
            }
      )
    );

    try {
      await blueprintApi.setChecklistItem(id, blueprintKey, index, done);
    } catch (err) {
      setSelectedModules(before);
      setPageError(apiErrorMessage(err, 'Could not save that tick'));
    }
  }

  /**
   * Writes the generated schema and opens it.
   *
   * The current DBML has to be fetched first: the plan payload deliberately
   * does not carry it, and deciding what to overwrite without looking at what
   * is there would be exactly the wrong way round.
   */
  async function startSchemaHandoff() {
    setPageError(null);
    setWritingSchema(true);
    try {
      // Save first, so the schema is generated from the plan as it stands.
      if (dirty) await save();

      const current = await projectApi.getProject(id);
      if (isUntouchedSchema(current.dbml)) {
        await writeSchema(generateDbml(entities, { title: project?.name }));
        return;
      }
      setSchemaPlan(generationPlan(current.dbml, entities));
    } catch (err) {
      setPageError(apiErrorMessage(err, 'Could not read the current schema'));
    } finally {
      setWritingSchema(false);
    }
  }

  async function writeSchema(dbml) {
    await projectApi.updateProject(id, { dbml });
    navigate(`/project/${id}`);
  }

  async function confirmSchemaWrite(mode) {
    setWritingSchema(true);
    setPageError(null);
    try {
      const current = await projectApi.getProject(id);
      const dbml =
        mode === 'append'
          ? appendMissingTables(current.dbml, entities)
          : generateDbml(entities, { title: project?.name });
      await writeSchema(dbml);
    } catch (err) {
      setPageError(apiErrorMessage(err, 'Could not write the schema'));
      setWritingSchema(false);
      setSchemaPlan(null);
    }
  }

  // Built on demand rather than on every render: the prompt is ten thousand
  // characters, and nothing on screen needs it until it is asked for.
  const specInput = () => ({
    projectName: project?.name ?? 'Untitled',
    plan,
    stack,
    entities,
    selectedModules,
  });
  const buildPrompt = () => buildSpec({ ...specInput(), mode: 'prompt' });
  const buildDocument = () => buildSpec({ ...specInput(), mode: 'document' });

  /**
   * Sends the plan as it stands on screen, so what gets explained is what you
   * are looking at rather than what was last saved. The result is cached into
   * the plan, so reopening the page costs nothing.
   */
  async function explain() {
    setExplaining(true);
    setAiError(null);
    try {
      const { reasoning } = await planApi.explainPlan(id, {
        context: plan.context,
        goal: plan.goal,
        answers: plan.answers,
        stack: toStackRows(stack),
        scaleNotes: notes,
        moduleKeys: plan.moduleKeys,
      });
      patch({ aiReasoning: reasoning });
    } catch (err) {
      // 503 is the documented "no key configured" answer, not a failure.
      if (err?.response?.status === 503) setAiUnavailable(true);
      else setAiError(apiErrorMessage(err, 'Could not get an explanation'));
    } finally {
      setExplaining(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    const ok = await removePlan();
    setDeleting(false);
    if (ok) setConfirmDelete(false);
  }

  if (loading) {
    return (
      <div className="app-shell">
        <Navbar />
        <div className="center">
          <CircleNotch size={20} weight="bold" className="spin" />
          <p>Opening plan</p>
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

  const decided = stack.filter((row) => !row.undecided).length;

  return (
    <div className="app-shell">
      <Navbar>
        <Link to="/" className="back" title="Back to projects">
          <ArrowLeft size={15} weight="bold" />
        </Link>

        <EditableTitle value={project?.name ?? ''} onChange={renameProject} />

        <ProjectTabs projectId={id} />

        <span className="navbar__spacer" />

        {plan && <SaveState saving={saving} dirty={dirty} lastSavedAt={lastSavedAt} />}

        {plan && (
          <ExportMenu
            projectName={project?.name ?? 'plan'}
            buildPrompt={buildPrompt}
            buildDocument={buildDocument}
          />
        )}

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
      </Navbar>

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
              <Compass size={22} weight="duotone" />
            </span>
            <h2>No plan yet</h2>
            <p>
              Describe what you are building and the tool works out a stack, a database
              and the modules that follow from it. The schema on the other tab stays as
              it is either way.
            </p>
            <Link to={`/project/${id}/plan/wizard`} className="btn btn--primary">
              Start planning
              <ArrowRight size={15} weight="bold" />
            </Link>
          </section>
        ) : (
          <>
            <section className="doc__section">
              <div className="doc__head">
                <h2>Context</h2>
                <p className="doc__hint">
                  What you are building and who for. This is what every recommendation is
                  reasoned against.
                </p>
              </div>

              <div className="field">
                <label htmlFor="plan-context">What is it</label>
                <textarea
                  id="plan-context"
                  rows={4}
                  value={plan.context}
                  onChange={(e) => patch({ context: e.target.value })}
                  placeholder="A storefront for a small clothing brand, selling to customers in one country."
                />
              </div>

              <div className="field">
                <label htmlFor="plan-goal">What does done look like</label>
                <textarea
                  id="plan-goal"
                  rows={3}
                  value={plan.goal}
                  onChange={(e) => patch({ goal: e.target.value })}
                  placeholder="Customers can browse, pay and track an order. I can manage stock."
                />
              </div>

              <div className="doc__row">
                <div className="field">
                  <label htmlFor="plan-preset">Project type</label>
                  <select
                    id="plan-preset"
                    className="select"
                    value={plan.presetKey}
                    onChange={(e) => patch({ presetKey: e.target.value })}
                  >
                    {PRESETS.map((preset) => (
                      <option key={preset.value} value={preset.value}>
                        {preset.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label htmlFor="plan-status">Status</label>
                  <select
                    id="plan-status"
                    className="select"
                    value={plan.status}
                    onChange={(e) => patch({ status: e.target.value })}
                  >
                    {STATUSES.map((status) => (
                      <option key={status.value} value={status.value}>
                        {status.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </section>

            <section className="doc__section">
              <div className="doc__head">
                <h2>Constraints</h2>
                <p className="doc__hint">
                  Change any of these and the stack below re-reasons itself straight away.
                </p>
              </div>
              <PlanAnswers answers={plan.answers ?? {}} onAnswer={setAnswer} />
            </section>

            <section className="doc__section">
              <div className="doc__head">
                <h2>
                  Stack <span className="doc__count">{decided} of {stack.length} decided</span>
                </h2>
                <p className="doc__hint">
                  Every reason here is a rule that matched your answers. Overriding one
                  keeps it overridden when the answers change.
                </p>
              </div>
              {stack.map((row) => (
                <StackLayer
                  key={row.layer}
                  row={row}
                  onOverride={setOverride}
                  onClearOverride={clearOverride}
                />
              ))}
            </section>

            <section className="doc__section">
              <div className="doc__head">
                <h2>
                  Modules <span className="doc__count">{(plan.moduleKeys ?? []).length}</span>
                </h2>
                <p className="doc__hint">
                  What the product is made of. Dependencies are resolved for you in both
                  directions.
                </p>
              </div>
              <PlanModules
                moduleKeys={plan.moduleKeys ?? []}
                entities={entities}
                apiCount={apis.length}
                notice={notice}
                onToggle={toggleModule}
              />
            </section>

            <section className="doc__section">
              <div className="doc__head">
                <h2>Schema</h2>
                <p className="doc__hint">
                  The tables your modules imply, written into the diagram on the other
                  tab. A starting point: the obvious foreign keys are there, the
                  interesting columns are still yours.
                </p>
              </div>

              <div className="handoff">
                <div>
                  <p className="handoff__count">
                    {entities.length} {entities.length === 1 ? 'table' : 'tables'} ready to
                    generate
                  </p>
                  <p className="doc__hint">
                    {entities.length === 0
                      ? 'Pick some modules above and they turn into tables here.'
                      : 'Existing tables are never overwritten without asking first.'}
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={startSchemaHandoff}
                  disabled={entities.length === 0 || writingSchema}
                >
                  {writingSchema ? (
                    <CircleNotch size={14} weight="bold" className="spin" />
                  ) : (
                    <Table size={14} weight="bold" />
                  )}
                  {writingSchema ? 'Working' : 'Design DB'}
                </button>
              </div>
            </section>

            <section className="doc__section">
              <div className="doc__head">
                <h2>Module checklists</h2>
                <p className="doc__hint">
                  Copied from your blueprints when attached, so editing a blueprint later
                  never rewrites work already under way.
                </p>
              </div>
              <PlanChecklists
                blueprints={blueprints}
                selectedModules={selectedModules}
                moduleKeys={plan.moduleKeys ?? []}
                busyKey={busyKey}
                onAttach={attachBlueprints}
                onDetach={detachBlueprint}
                onToggle={toggleChecklistItem}
              />
            </section>

            <section className="doc__section">
              <div className="doc__head">
                <h2>
                  API surface <span className="doc__count">{apis.length}</span>
                </h2>
                <p className="doc__hint">
                  Derived from the modules, then yours to edit.
                </p>
              </div>
              <ApiTable
                apis={apis}
                stale={apisStale}
                onChange={editApi}
                onAdd={addApi}
                onRemove={removeApi}
                onRederive={rederiveApis}
              />
            </section>

            {notes.length > 0 && (
              <section className="doc__section">
                <div className="doc__head">
                  <h2>What breaks first</h2>
                  <p className="doc__hint">The ceiling this plan was designed to, not a promise.</p>
                </div>
                <ul className="rev__notes">
                  {notes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              </section>
            )}

            <section className="doc__section">
              <div className="doc__head">
                <h2>Deeper reasoning</h2>
              </div>
              <PlanReasoning
                reasoning={plan.aiReasoning}
                busy={explaining}
                unavailable={aiUnavailable}
                error={aiError}
                onExplain={explain}
                onClear={() => patch({ aiReasoning: '' })}
              />
            </section>

            <section className="doc__section doc__section--quiet">
              <div className="doc__danger">
                <div>
                  <p className="doc__danger-title">Run the wizard again</p>
                  <p className="doc__hint">
                    Walks the six steps with everything here already filled in.
                  </p>
                </div>
                <Link to={`/project/${id}/plan/wizard`} className="btn btn--sm">
                  <MagicWand size={14} weight="bold" />
                  Redo wizard
                </Link>
              </div>

              <div className="doc__danger doc__danger--red">
                <div>
                  <p className="doc__danger-title">Delete this plan</p>
                  <p className="doc__hint">
                    Removes the planning half only. The schema, its layout and its notes
                    are untouched.
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn--danger btn--sm"
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash size={14} weight="bold" />
                  Delete plan
                </button>
              </div>
            </section>
          </>
        )}
      </main>

      {/* Screen-hidden, and what the print stylesheet actually prints. */}
      {plan && (
        <PrintableSpec
          projectName={project?.name ?? 'Untitled'}
          plan={plan}
          stack={stack}
          selectedModules={selectedModules}
          apis={apis}
        />
      )}

      {schemaPlan && (
        <GenerateSchemaDialog
          plan={schemaPlan}
          busy={writingSchema}
          onConfirm={confirmSchemaWrite}
          onCancel={() => setSchemaPlan(null)}
        />
      )}

      <ConfirmDialog
        open={confirmDelete}
        busy={deleting}
        title="Delete this plan?"
        body="The plan and its decisions go for good. The schema on the other tab is not affected."
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
