import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CircleNotch,
  FloppyDisk,
  Info,
  Sparkle,
  Table,
  Trash,
  WarningCircle,
} from '@phosphor-icons/react';
import PageHeader from '../components/layout/PageHeader';
import PlanSteps, { PlanStepFoot } from '../components/plan/PlanSteps';
import PresetPicker from '../components/plan/PresetPicker';
import PlanGaps from '../components/plan/PlanGaps';
import ChatPanel from '../components/plan/ChatPanel';
import EditableTitle from '../components/editor/EditableTitle';
import SaveState from '../components/ui/SaveState';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import StackLayer from '../components/plan/StackLayer';
import ApiTable from '../components/plan/ApiTable';
import PlanAnswers from '../components/plan/PlanAnswers';
import PlanModules from '../components/plan/PlanModules';
import PlanChecklists from '../components/plan/PlanChecklists';
import ModuleEditorDialog from '../components/plan/ModuleEditorDialog';
import ModuleLibraryDialog from '../components/plan/ModuleLibraryDialog';
import {
  hydrateCustomModules,
  hydrateCustomModule,
  stripAll,
  blankModule,
} from '../engine/customModules';
import { tableOwners } from '../engine/recommend';
import * as moduleApi from '../api/moduleApi';
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
import AutoTextarea from '../components/common/AutoTextarea';
import { usePlanStore } from '../store/usePlanStore';
import { usePlanArchitecture } from '../hooks/usePlanArchitecture';
import { LAYERING, TOPOLOGY } from '../engine/architecture';
import { defaultAnswersFor, suggestedModulesFor } from '../engine/presets';
import { ANSWERS, ANSWER_KEYS, STATUSES } from '../engine/planOptions';
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
  const startPlan = usePlanStore((s) => s.startPlan);

  const [step, setStep] = useState(0);
  const [chatOpen, setChatOpen] = useState(() => {
    try {
      return localStorage.getItem('schema-designer:chat') === 'open';
    } catch {
      return false;
    }
  });
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

  // Custom modules carry their parsed tables, which the plan never stores.
  // Hydrating once here keeps every engine call downstream synchronous.
  const [hydrated, setHydrated] = useState([]);
  const [editingModule, setEditingModule] = useState(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [library, setLibrary] = useState([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryBusy, setLibraryBusy] = useState(null);

  // Deliberately no reset on unmount: switching to the architecture tab
  // remounts this page, and dropping the store there would discard edits that
  // have not autosaved yet. `loadPlan` resets when the project changes.
  useEffect(() => {
    loadPlan(id);
  }, [id, loadPlan]);

  useEffect(() => {
    try {
      localStorage.setItem('schema-designer:chat', chatOpen ? 'open' : 'closed');
    } catch {
      /* a remembered panel is not worth breaking the page over */
    }
  }, [chatOpen]);

  // Every project has a plan. A project you have just created and a project
  // whose plan you deleted both land here, and an empty document you can start
  // typing into beats a dead end with a button on it.
  useEffect(() => {
    if (!loading && !loadError && project && !plan) startPlan();
  }, [loading, loadError, project, plan, startPlan]);

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
  const entities = useMemo(
    () => entitiesFor(plan?.moduleKeys ?? [], hydrated),
    [plan?.moduleKeys, hydrated]
  );
  const owners = useMemo(
    () => tableOwners(plan?.moduleKeys ?? [], hydrated),
    [plan?.moduleKeys, hydrated]
  );
  const notes = useMemo(() => scaleNotes(plan?.answers ?? {}, stack), [plan?.answers, stack]);
  const apis = plan?.apis ?? [];
  const derivedApis = useMemo(
    () => apisFor(plan?.moduleKeys ?? [], hydrated),
    [plan?.moduleKeys, hydrated]
  );
  const apisStale =
    apis.length > 0 &&
    JSON.stringify(apis.map((a) => `${a.method} ${a.path}`).sort()) !==
      JSON.stringify(derivedApis.map((a) => `${a.method} ${a.path}`).sort());

  const { architecture, archOverrides, build: buildArchitecture } = usePlanArchitecture(
    plan,
    stack,
    hydrated
  );

  function setArchOverride(dimension, choice) {
    patch({ architecture: buildArchitecture({ arch: { ...archOverrides, [dimension]: choice } }) });
  }

  function clearArchOverride(dimension) {
    const next = { ...archOverrides };
    delete next[dimension];
    patch({ architecture: buildArchitecture({ arch: next }) });
  }

  // A preset fills blanks only. Anything you answered or picked yourself is
  // yours, and choosing a different preset later must not quietly undo it.
  function choosePreset(presetKey) {
    const answers = { ...(plan.answers ?? {}) };
    for (const [key, value] of Object.entries(defaultAnswersFor(presetKey))) {
      if (!answers[key]) answers[key] = value;
    }

    const moduleKeys = (plan.moduleKeys ?? []).length
      ? plan.moduleKeys
      : resolveDependencies(suggestedModulesFor(presetKey), hydrated).keys;

    setNotice(null);
    rewrite({ presetKey, answers, moduleKeys });
  }

  const gaps = useMemo(() => {
    const list = [];
    if (!plan?.context?.trim()) {
      list.push({ text: 'No context written, so the plan cannot say what it is for.', step: 0 });
    }
    if (!plan?.goal?.trim()) {
      list.push({ text: 'No version-one scope, so the modules have nothing to follow from.', step: 0 });
    }
    const missing = ANSWER_KEYS.filter((key) => !(plan?.answers ?? {})[key]);
    if (missing.length) {
      list.push({
        text: `${missing.length} unanswered: ${missing.map((k) => ANSWERS[k].label).join(', ')}.`,
        step: 1,
      });
    }
    const undecided = stack.filter((row) => row.undecided);
    if (undecided.length) {
      list.push({ text: `${undecided.length} stack layers still undecided.`, step: 2 });
    }
    if (!(plan?.moduleKeys ?? []).length) {
      list.push({ text: 'No modules selected, so no tables or endpoints follow.', step: 3 });
    }
    if (architecture.layering?.undecided || architecture.topology?.undecided) {
      list.push({ text: 'Layering or topology is still a toss-up.', step: 4 });
    }
    const badPaths = apis.filter((api) => !api.path.startsWith('/')).length;
    if (badPaths) {
      list.push({ text: `${badPaths} endpoint paths do not start with a slash.`, step: 5 });
    }
    return list;
  }, [plan, stack, architecture, apis]);

  const steps = useMemo(() => {
    const openAt = new Set(gaps.map((g) => g.step));
    return [
      { key: 'context', label: 'Context', done: !openAt.has(0) },
      { key: 'constraints', label: 'Constraints', done: !openAt.has(1) },
      { key: 'stack', label: 'Stack', done: !openAt.has(2) },
      {
        key: 'modules',
        label: 'Modules',
        done: !openAt.has(3),
        count: (plan?.moduleKeys ?? []).length || null,
      },
      { key: 'architecture', label: 'Architecture', done: !openAt.has(4) },
      { key: 'apis', label: 'APIs', done: !openAt.has(5), count: apis.length || null },
      { key: 'review', label: 'Review', done: gaps.length === 0 },
    ];
  }, [gaps, plan?.moduleKeys, apis.length]);

  /**
   * Runs an apply, with whatever is on screen saved first.
   *
   * The server writes the patch on top of the *stored* plan. Anything typed
   * but not yet autosaved would be missing from what comes back, so flushing
   * first is what stops an apply quietly reverting the last thing you wrote.
   */
  async function applyProposal(run) {
    if (dirty) await save();
    const next = await run();
    if (next) patch(next);
  }

  function go(next) {
    setStep(next);
    setNotice(null);
    document.querySelector('.doc')?.scrollTo({ top: 0 });
  }

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
    const result = isOn
      ? removeModule(current, key, hydrated)
      : resolveDependencies([...current, key], hydrated);
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

  // The stored plan carries DBML; the engine wants tables. Parsed once here,
  // and again whenever the stored modules change.
  useEffect(() => {
    let cancelled = false;
    hydrateCustomModules(plan?.customModules ?? []).then((next) => {
      if (!cancelled) setHydrated(next);
    });
    return () => {
      cancelled = true;
    };
  }, [plan?.customModules]);

  async function saveModule(draft) {
    const existing = plan.customModules ?? [];
    const isNew = !existing.some((m) => m.key === editingModule?.original);
    const stored = stripAll([draft])[0];

    const next = isNew
      ? [...existing, stored]
      : existing.map((m) => (m.key === editingModule.original ? stored : m));

    // A renamed key has to follow into the selection, or the module silently
    // drops out of the plan it was already part of.
    let keys = plan.moduleKeys ?? [];
    if (isNew) keys = resolveDependencies([...keys, stored.key], await hydrateCustomModules(next)).keys;
    else if (editingModule.original !== stored.key) {
      keys = keys.map((k) => (k === editingModule.original ? stored.key : k));
    }

    patch({ customModules: next, moduleKeys: keys });
    setEditingModule(null);
  }

  function removeCustomModule(key) {
    const remaining = (plan.customModules ?? []).filter((m) => m.key !== key);
    const result = removeModule(plan.moduleKeys ?? [], key, hydrated);
    patch({ customModules: remaining, moduleKeys: result.keys });
  }

  async function openLibrary() {
    setLibraryOpen(true);
    setLibraryLoading(true);
    try {
      setLibrary(await moduleApi.listModules());
    } catch (err) {
      setPageError(apiErrorMessage(err, 'Could not load your module library'));
    } finally {
      setLibraryLoading(false);
    }
  }

  /**
   * Inserting copies. From here the plan's version is its own, and editing the
   * library later never reaches back into it.
   */
  async function insertFromLibrary(definition) {
    setLibraryBusy(definition.key);
    try {
      const copy = {
        key: definition.key,
        name: definition.name,
        summary: definition.summary,
        dbml: definition.dbml,
        apis: definition.apis.map((api) => ({ moduleKey: definition.key, ...api })),
        dependsOn: [...definition.dependsOn],
        blueprintKey: definition.blueprintKey,
        libraryKey: definition.key,
      };
      const next = [...(plan.customModules ?? []).filter((m) => m.key !== copy.key), copy];
      const keys = resolveDependencies(
        [...(plan.moduleKeys ?? []), copy.key],
        await hydrateCustomModules(next)
      ).keys;

      patch({ customModules: next, moduleKeys: keys });
      setLibraryOpen(false);
    } finally {
      setLibraryBusy(null);
    }
  }

  async function saveToLibrary(draft) {
    setLibraryBusy(draft.key);
    setPageError(null);
    try {
      const payload = {
        key: draft.key,
        name: draft.name,
        summary: draft.summary,
        dbml: draft.dbml,
        apis: draft.apis.map(({ method, path, purpose, auth }) => ({ method, path, purpose, auth })),
        dependsOn: draft.dependsOn,
        blueprintKey: draft.blueprintKey,
      };

      const existing = library.length ? library : await moduleApi.listModules();
      const match = existing.find((m) => m.key === draft.key);
      const saved = match
        ? await moduleApi.updateModule(match._id, payload)
        : await moduleApi.createModule(payload);

      setLibrary((list) => [...list.filter((m) => m._id !== saved._id), saved]);
      setEditingModule((current) =>
        current ? { ...current, module: { ...current.module, libraryKey: saved.key } } : current
      );
    } catch (err) {
      setPageError(apiErrorMessage(err, 'Could not save to the library'));
    } finally {
      setLibraryBusy(null);
    }
  }

  async function deleteFromLibrary(definition) {
    try {
      await moduleApi.deleteModule(definition._id);
      setLibrary((list) => list.filter((m) => m._id !== definition._id));
    } catch (err) {
      setPageError(apiErrorMessage(err, 'Could not delete that module'));
    }
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

  // `plan` is null for one frame on a project that has none: the effect above
  // creates it, and effects run after the first paint. The document reads the
  // plan directly, so it must not render before there is one.
  if (loading || (!loadError && !plan)) {
    return (
      <div className="center">
        <CircleNotch size={20} weight="bold" className="spin" />
        <p>Opening plan</p>
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

  const decided = stack.filter((row) => !row.undecided).length;

  return (
    <>
      <PageHeader>
        <EditableTitle value={project?.name ?? ''} onChange={renameProject} />

        <span className="topbar__spacer" />

        <button
          type="button"
          className={`chat__open${chatOpen ? ' is-on' : ''}`}
          onClick={() => setChatOpen((v) => !v)}
          aria-pressed={chatOpen}
        >
          <Sparkle size={13} weight="fill" />
          Ask
        </button>

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
      </PageHeader>

      {(saveError || pageError) && (
        <p className="alert alert--error alert--bar" role="alert">
          <WarningCircle size={15} weight="fill" />
          {saveError || pageError}
        </p>
      )}

      <div className={chatOpen ? 'withchat' : 'withchat withchat--solo'}>
      <main className="doc">
        <PlanSteps steps={steps} current={step} onGo={go} />

        {step === 0 && (
          <>
            <section className="doc__section">
              <div className="doc__head">
                <h2>Start from</h2>
                <p className="doc__hint">
                  A preset only fills blanks. Anything you have already answered or picked
                  yourself is left alone.
                </p>
              </div>
              <PresetPicker value={plan.presetKey} onChoose={choosePreset} />
            </section>

            <section className="doc__section">
              <div className="doc__head">
                <h2>Context</h2>
                <p className="doc__hint">
                  What you are building and who for. This is what every recommendation is
                  reasoned against.
                </p>
              </div>

              <div className="field">
                <label htmlFor="plan-context">The product</label>
                <p className="field__hint">
                  One or two sentences: what it is and who uses it.
                </p>
                <AutoTextarea
                  id="plan-context"
                  value={plan.context}
                  onChange={(e) => patch({ context: e.target.value })}
                  placeholder="A storefront for a small clothing brand, selling to customers in one country."
                />
              </div>

              <div className="field">
                <label htmlFor="plan-goal">Must work in version one</label>
                <p className="field__hint">
                  One per line. This is the scope: anything you leave out becomes a later
                  version.
                </p>
                <AutoTextarea
                  id="plan-goal"
                  value={plan.goal}
                  onChange={(e) => patch({ goal: e.target.value })}
                  placeholder={'Browse and search products\nPay for an order\nTrack a delivery\nAdd products and manage stock'}
                />
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
            </section>
          </>
        )}

        {step === 1 && (
          <section className="doc__section">
            <div className="doc__head">
              <h2>Constraints</h2>
              <p className="doc__hint">
                Change any of these and the stack re-reasons itself straight away.
              </p>
            </div>
            <PlanAnswers answers={plan.answers ?? {}} onAnswer={setAnswer} />
          </section>
        )}

        {step === 2 && (
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
        )}

        {step === 3 && (
          <>
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
                customModules={hydrated}
                entities={entities}
                apiCount={apis.length}
                notice={notice}
                onToggle={(key) =>
                  hydrated.some((m) => m.key === key) && (plan.moduleKeys ?? []).includes(key)
                    ? removeCustomModule(key)
                    : toggleModule(key)
                }
                onNewModule={() => setEditingModule({ module: blankModule(), original: null, isNew: true })}
                onEditModule={(module) =>
                  setEditingModule({ module, original: module.key, isNew: false })
                }
                onOpenLibrary={openLibrary}
              />
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
          </>
        )}

        {step === 4 && (
          <section className="doc__section">
            <div className="doc__head">
              <h2>Architecture</h2>
              <p className="doc__hint">
                How the code is organised, and how it ships. Reasoned from your team size,
                your scale and the {(plan.moduleKeys ?? []).length}{' '}
                {(plan.moduleKeys ?? []).length === 1 ? 'module' : 'modules'} you picked.
              </p>
            </div>

            <StackLayer
              row={architecture.layering}
              label="Layering"
              dimension="layering"
              options={LAYERING}
              onOverride={setArchOverride}
              onClearOverride={clearArchOverride}
            />
            <StackLayer
              row={architecture.topology}
              label="Topology"
              dimension="topology"
              options={TOPOLOGY}
              onOverride={setArchOverride}
              onClearOverride={clearArchOverride}
            />

            <p className="pnote">
              <Info size={14} weight="fill" />
              <span>
                The nine cross-cutting concerns, the folder structure and the decision log
                all follow from these two, and have room to read on the{' '}
                <Link to={`/project/${id}/architecture`}>architecture page</Link>.
              </span>
            </p>
          </section>
        )}

        {step === 5 && (
          <section className="doc__section">
            <div className="doc__head">
              <h2>
                API surface <span className="doc__count">{apis.length}</span>
              </h2>
              <p className="doc__hint">Derived from the modules, then yours to edit.</p>
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
        )}

        {step === 6 && (
          <>
            <section className="doc__section">
              <div className="doc__head">
                <h2>Still open</h2>
                <p className="doc__hint">
                  A plan can ship with gaps. It should not have them by accident.
                </p>
              </div>
              <PlanGaps gaps={gaps} onGo={go} />
            </section>

            <section className="doc__section">
              <div className="doc__head">
                <h2>Schema</h2>
                <p className="doc__hint">
                  The tables your modules imply, written into the diagram on the schema
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
                      ? 'Pick some modules and they turn into tables here.'
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

            {notes.length > 0 && (
              <section className="doc__section">
                <div className="doc__head">
                  <h2>What breaks first</h2>
                  <p className="doc__hint">
                    The ceiling this plan was designed to, not a promise.
                  </p>
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
              <div className="doc__head">
                <h2>Delete</h2>
                <p className="doc__hint">Throw the planning half away.</p>
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

        <PlanStepFoot
          onBack={step > 0 ? () => go(step - 1) : null}
          onNext={step < steps.length - 1 ? () => go(step + 1) : null}
          hint={step === steps.length - 1 && gaps.length > 0 ? `${gaps.length} still open` : null}
        />
      </main>

      {chatOpen && (
        <ChatPanel
          projectId={id}
          onClose={() => setChatOpen(false)}
          onApplied={applyProposal}
        />
      )}
      </div>

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

      {editingModule && (
        <ModuleEditorDialog
          module={editingModule.module}
          isNew={editingModule.isNew}
          planModuleKeys={plan?.moduleKeys ?? []}
          planCustomModules={hydrated}
          tableOwners={owners}
          savingToLibrary={libraryBusy === editingModule.module.key}
          onSave={saveModule}
          onSaveToLibrary={saveToLibrary}
          onCancel={() => setEditingModule(null)}
        />
      )}

      {libraryOpen && (
        <ModuleLibraryDialog
          modules={library}
          loading={libraryLoading}
          alreadyInPlan={(plan?.customModules ?? []).map((m) => m.key)}
          busyKey={libraryBusy}
          onInsert={insertFromLibrary}
          onDelete={deleteFromLibrary}
          onCancel={() => setLibraryOpen(false)}
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
    </>
  );
}
