import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CircleNotch, WarningCircle } from '@phosphor-icons/react';
import Navbar from '../components/layout/Navbar';
import WizardNav, { WizardFooter } from '../components/wizard/WizardNav';
import StepContext from '../components/wizard/StepContext';
import StepConstraints from '../components/wizard/StepConstraints';
import StepStack from '../components/wizard/StepStack';
import StepModules from '../components/wizard/StepModules';
import StepApis from '../components/wizard/StepApis';
import StepReview from '../components/wizard/StepReview';
import { usePlanStore } from '../store/usePlanStore';
import { ANSWER_KEYS, ANSWERS } from '../engine/planOptions';
import { defaultAnswersFor, suggestedModulesFor } from '../engine/presets';
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

const STEPS = [
  { key: 'context', label: 'Context' },
  { key: 'constraints', label: 'Constraints' },
  { key: 'stack', label: 'Stack' },
  { key: 'modules', label: 'Modules' },
  { key: 'apis', label: 'APIs' },
  { key: 'review', label: 'Review' },
];

const EMPTY_DRAFT = {
  presetKey: 'custom',
  context: '',
  goal: '',
  answers: {},
  moduleKeys: [],
  overrides: {},
};

export default function PlanWizardPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const project = usePlanStore((s) => s.project);
  const plan = usePlanStore((s) => s.plan);
  const loading = usePlanStore((s) => s.loading);
  const loadError = usePlanStore((s) => s.loadError);
  const saveError = usePlanStore((s) => s.saveError);
  const saving = usePlanStore((s) => s.saving);
  const loadPlan = usePlanStore((s) => s.loadPlan);
  const startPlan = usePlanStore((s) => s.startPlan);
  const save = usePlanStore((s) => s.save);
  const reset = usePlanStore((s) => s.reset);

  const [step, setStep] = useState(0);
  const [furthest, setFurthest] = useState(0);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [notice, setNotice] = useState(null);

  // A preset fills blanks only. Anything you set yourself is yours, and a
  // later preset change must not quietly undo it.
  const [touched, setTouched] = useState({ answers: new Set(), modules: false });
  const [seededAnswers, setSeededAnswers] = useState(new Set());

  // Edited endpoints stop tracking the module selection, so edits survive.
  const [editedApis, setEditedApis] = useState(null);
  const [apisBasis, setApisBasis] = useState('');

  const seeded = useRef(false);

  useEffect(() => {
    loadPlan(id);
    return () => reset();
  }, [id, loadPlan, reset]);

  // Re-entering the wizard on an existing plan picks up where it left off
  // rather than starting from nothing.
  useEffect(() => {
    if (seeded.current || loading || !project) return;
    seeded.current = true;
    if (!plan) return;

    setDraft({
      presetKey: plan.presetKey ?? 'custom',
      context: plan.context ?? '',
      goal: plan.goal ?? '',
      answers: { ...(plan.answers ?? {}) },
      moduleKeys: [...(plan.moduleKeys ?? [])],
      overrides: Object.fromEntries(
        (plan.stack ?? []).filter((row) => row.overridden).map((row) => [row.layer, row.choice])
      ),
    });
    setTouched({ answers: new Set(Object.keys(plan.answers ?? {})), modules: true });
    if (plan.apis?.length) {
      setEditedApis(plan.apis);
      setApisBasis((plan.moduleKeys ?? []).join(','));
    }
  }, [loading, project, plan]);

  const recommendations = useMemo(() => recommendStack(draft.answers), [draft.answers]);
  const stack = useMemo(
    () => applyOverrides(recommendations, draft.overrides, draft.answers),
    [recommendations, draft.overrides, draft.answers]
  );
  const derivedApis = useMemo(() => apisFor(draft.moduleKeys), [draft.moduleKeys]);
  const apis = editedApis ?? derivedApis;
  const entities = useMemo(() => entitiesFor(draft.moduleKeys), [draft.moduleKeys]);
  const notes = useMemo(() => scaleNotes(draft.answers, stack), [draft.answers, stack]);
  const apisStale = Boolean(editedApis) && apisBasis !== draft.moduleKeys.join(',');

  const gaps = useMemo(() => {
    const list = [];
    if (!draft.context.trim()) list.push('No context written, so the plan cannot say what it is for.');
    const missing = ANSWER_KEYS.filter((key) => !draft.answers[key]);
    if (missing.length) {
      list.push(
        `${missing.length} unanswered: ${missing.map((k) => ANSWERS[k].label).join(', ')}.`
      );
    }
    const undecided = stack.filter((row) => row.undecided);
    if (undecided.length) list.push(`${undecided.length} stack layers still undecided.`);
    if (!draft.moduleKeys.length) list.push('No modules selected, so no tables or endpoints follow.');
    const badPaths = apis.filter((api) => !api.path.startsWith('/')).length;
    if (badPaths) list.push(`${badPaths} endpoint paths do not start with a slash.`);
    return list;
  }, [draft, stack, apis]);

  function update(changes) {
    setDraft((d) => ({ ...d, ...changes }));
  }

  // Everything is computed before any state is set: nesting a setState inside
  // another one's updater is unreliable, since React may run the updater twice.
  function choosePreset(presetKey) {
    const defaults = defaultAnswersFor(presetKey);
    const answers = { ...draft.answers };
    const nowSeeded = new Set();

    for (const [key, value] of Object.entries(defaults)) {
      if (touched.answers.has(key)) continue;
      answers[key] = value;
      nowSeeded.add(key);
    }

    const moduleKeys = touched.modules
      ? draft.moduleKeys
      : resolveDependencies(suggestedModulesFor(presetKey)).keys;

    setSeededAnswers(nowSeeded);
    setDraft({ ...draft, presetKey, answers, moduleKeys });
    setNotice(null);
  }

  function answer(key, value) {
    setTouched((t) => ({ ...t, answers: new Set(t.answers).add(key) }));
    setSeededAnswers((s) => {
      const next = new Set(s);
      next.delete(key);
      return next;
    });
    setDraft((d) => ({ ...d, answers: { ...d.answers, [key]: value } }));
  }

  function toggleModule(key) {
    const isOn = draft.moduleKeys.includes(key);
    const result = isOn
      ? removeModule(draft.moduleKeys, key)
      : resolveDependencies([...draft.moduleKeys, key]);

    const knockOn = isOn ? result.dropped : result.added;
    setNotice(
      knockOn.length
        ? isOn
          ? `Also removed ${knockOn.map((x) => x.name).join(', ')}, which depended on it.`
          : `Also added ${knockOn.map((x) => x.name).join(', ')}, which it needs.`
        : null
    );

    setTouched((t) => ({ ...t, modules: true }));
    setDraft({ ...draft, moduleKeys: result.keys });
  }

  function editApi(index, changes) {
    const base = editedApis ?? derivedApis;
    if (!editedApis) setApisBasis(draft.moduleKeys.join(','));
    setEditedApis(base.map((api, i) => (i === index ? { ...api, ...changes } : api)));
  }

  function addApi() {
    const base = editedApis ?? derivedApis;
    if (!editedApis) setApisBasis(draft.moduleKeys.join(','));
    setEditedApis([...base, { moduleKey: '', method: 'GET', path: '/api/', purpose: '', auth: true }]);
  }

  function removeApi(index) {
    const base = editedApis ?? derivedApis;
    if (!editedApis) setApisBasis(draft.moduleKeys.join(','));
    setEditedApis(base.filter((_, i) => i !== index));
  }

  function rederiveApis() {
    setEditedApis(null);
    setApisBasis('');
  }

  function go(next) {
    setStep(next);
    setFurthest((f) => Math.max(f, next));
    setNotice(null);
    window.scrollTo({ top: 0 });
  }

  async function finish() {
    startPlan({
      presetKey: draft.presetKey,
      context: draft.context,
      goal: draft.goal,
      answers: draft.answers,
      moduleKeys: draft.moduleKeys,
      stack: toStackRows(stack),
      // Paths that would be rejected by the API are dropped rather than
      // failing the whole save. The review step already flagged them.
      apis: apis.filter((api) => api.path.startsWith('/')),
      scaleNotes: notes,
      aiReasoning: plan?.aiReasoning ?? '',
      status: 'planned',
    });

    const saved = await save();
    if (saved) navigate(`/project/${id}/plan`);
  }

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

  const isLast = step === STEPS.length - 1;

  return (
    <div className="app-shell">
      <Navbar>
        <Link to={`/project/${id}/plan`} className="back" title="Leave the wizard">
          <ArrowLeft size={15} weight="bold" />
        </Link>
        <h1 className="doc-title">{project?.name}</h1>
        <span className="wtag">Planning</span>
      </Navbar>

      {saveError && (
        <p className="alert alert--error alert--bar" role="alert">
          <WarningCircle size={15} weight="fill" />
          {saveError}
        </p>
      )}

      <main className="wizard">
        <WizardNav steps={STEPS} current={step} furthest={furthest} onGo={go} />

        <div className="wizard__body">
          {step === 0 && <StepContext draft={draft} onChange={update} onPreset={choosePreset} />}
          {step === 1 && (
            <StepConstraints draft={draft} seededKeys={seededAnswers} onAnswer={answer} />
          )}
          {step === 2 && (
            <StepStack
              stack={stack}
              onOverride={(layer, choice) =>
                update({ overrides: { ...draft.overrides, [layer]: choice } })
              }
              onClearOverride={(layer) => {
                const next = { ...draft.overrides };
                delete next[layer];
                update({ overrides: next });
              }}
            />
          )}
          {step === 3 && <StepModules draft={draft} notice={notice} onToggle={toggleModule} />}
          {step === 4 && (
            <StepApis
              apis={apis}
              stale={apisStale}
              onChange={editApi}
              onAdd={addApi}
              onRemove={removeApi}
              onRederive={rederiveApis}
            />
          )}
          {step === 5 && (
            <StepReview
              draft={draft}
              stack={stack}
              apis={apis}
              entities={entities}
              notes={notes}
              gaps={gaps}
            />
          )}
        </div>

        <WizardFooter
          onBack={step > 0 ? () => go(step - 1) : null}
          onNext={isLast ? finish : () => go(step + 1)}
          nextLabel={isLast ? (saving ? 'Saving' : 'Create plan') : 'Continue'}
          nextDisabled={saving}
          nextHint={isLast && gaps.length > 0 ? `${gaps.length} things left open` : null}
        />
      </main>
    </div>
  );
}
