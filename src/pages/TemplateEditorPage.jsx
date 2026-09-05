import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CaretDown,
  CaretUp,
  CircleNotch,
  Cube,
  DotsSixVertical,
  FloppyDisk,
  MagnifyingGlass,
  Plus,
  Trash,
  WarningCircle,
  X,
} from '@phosphor-icons/react';
import PageHeader from '../components/layout/PageHeader';
import SaveState from '../components/ui/SaveState';
import { MODULES } from '../engine/modules';
import {
  addModule,
  addPhase,
  assignedKeys,
  blankTemplate,
  moveModule,
  movePhase,
  nudgeModule,
  removeModule,
  removePhase,
  renamePhase,
  slugifyKey,
  validateTemplate,
} from '../engine/templates';
import * as templateApi from '../api/templateApi';
import * as moduleApi from '../api/moduleApi';
import { apiErrorMessage } from '../api/axiosInstance';

/**
 * Arranging a template.
 *
 * Two columns: everything available on the left, the phases you are building on
 * the right. A module moves by dragging, or — because dragging is unusable by
 * keyboard and awkward on a touchscreen — by the buttons on each row, which do
 * exactly the same thing.
 */
export default function TemplateEditorPage({ isNew = false }) {
  // Undefined on the new-template route, which is why `isNew` comes from the
  // route rather than from a sentinel value in here.
  const { id } = useParams();
  const navigate = useNavigate();

  const [draft, setDraft] = useState(() => blankTemplate());
  const [library, setLibrary] = useState([]);
  const [otherKeys, setOtherKeys] = useState([]);
  const [keyTouched, setKeyTouched] = useState(!isNew);

  const [loading, setLoading] = useState(!isNew);
  const [loadError, setLoadError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState(null);

  const [query, setQuery] = useState('');
  // What is being dragged, and where it would land. Held in a ref for the drag
  // handlers and in state for the drop indicator, because a ref does not
  // re-render and the indicator has to.
  const dragging = useRef(null);
  const [dropTarget, setDropTarget] = useState(null);

  const update = useCallback((next) => {
    setDraft(next);
    setDirty(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    moduleApi
      .listModules()
      .then((list) => !cancelled && setLibrary(list))
      .catch(() => {
        /* The built-in catalogue is enough to arrange with. */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    templateApi
      .listTemplates()
      .then((list) => {
        if (cancelled) return;
        setOtherKeys(list.filter((t) => t._id !== id).map((t) => t.key));
      })
      .catch(() => {
        /* Only used to warn about a duplicate key before saving. */
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (isNew) return undefined;
    let cancelled = false;
    templateApi
      .getTemplate(id)
      .then((template) => !cancelled && setDraft(template))
      .catch((err) => !cancelled && setLoadError(apiErrorMessage(err, 'Could not load this template')))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [id, isNew]);

  // Every module you could place: the built-in catalogue plus your own library.
  const catalogue = useMemo(() => {
    const byKey = new Map();
    for (const module of MODULES) {
      byKey.set(module.key, { key: module.key, name: module.name, summary: module.summary, own: false });
    }
    // Yours wins on a clash, matching how a plan resolves the same collision.
    for (const module of library) {
      byKey.set(module.key, { key: module.key, name: module.name, summary: module.summary, own: true });
    }
    return [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [library]);

  const lookup = useMemo(() => new Map(catalogue.map((m) => [m.key, m])), [catalogue]);
  const placed = useMemo(() => new Set(assignedKeys(draft)), [draft]);

  const unplaced = useMemo(() => {
    const q = query.trim().toLowerCase();
    return catalogue
      .filter((module) => !placed.has(module.key))
      .filter(
        (module) =>
          !q ||
          module.name.toLowerCase().includes(q) ||
          module.key.toLowerCase().includes(q) ||
          (module.summary || '').toLowerCase().includes(q)
      );
  }, [catalogue, placed, query]);

  const problems = validateTemplate(draft, { existingKeys: otherKeys });

  function setName(name) {
    // The key follows the name until you edit it yourself, then it is yours.
    update(keyTouched ? { ...draft, name } : { ...draft, name, key: slugifyKey(name) });
  }

  async function save() {
    if (problems.length || saving) return;

    setSaving(true);
    setSaveError(null);
    const payload = {
      key: draft.key,
      name: draft.name,
      summary: draft.summary,
      phases: draft.phases.map((phase) => ({
        id: phase.id,
        name: phase.name,
        moduleKeys: phase.moduleKeys,
      })),
    };

    try {
      const saved = isNew
        ? await templateApi.createTemplate(payload)
        : await templateApi.updateTemplate(id, payload);

      setDraft(saved);
      setDirty(false);
      setLastSavedAt(new Date().toISOString());
      // Once it exists the key is its identity, so it stops trailing the name.
      // Navigating from /new to /:id reuses this component rather than
      // remounting it, so this has to be said rather than assumed.
      setKeyTouched(true);
      // Replaced rather than pushed: Back should go to the list, not to the
      // empty form this template was created from.
      if (isNew) navigate(`/templates/${saved._id}`, { replace: true });
    } catch (err) {
      setSaveError(apiErrorMessage(err, 'Could not save the template'));
    } finally {
      setSaving(false);
    }
  }

  // --- dragging -----------------------------------------------------------

  function onDragStart(key) {
    dragging.current = key;
  }

  function onDragEnd() {
    dragging.current = null;
    setDropTarget(null);
  }

  function onDropInto(phaseId, index) {
    const key = dragging.current;
    onDragEnd();
    if (!key) return;

    update(placed.has(key) ? moveModule(draft, key, phaseId, index) : addModule(draft, phaseId, key));
  }

  function onDropOutside() {
    const key = dragging.current;
    onDragEnd();
    if (key && placed.has(key)) update(removeModule(draft, key));
  }

  if (loading) {
    return (
      <div className="center">
        <CircleNotch size={20} weight="bold" className="spin" />
        <p>Opening template</p>
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
        <Link to="/templates" className="btn">
          <ArrowLeft size={15} weight="bold" />
          Back to templates
        </Link>
      </div>
    );
  }

  return (
    <>
      <PageHeader>
        <Link to="/templates" className="back" title="Back to templates">
          <ArrowLeft size={15} weight="bold" />
        </Link>

        <h1 className="topbar__title">{isNew ? 'New template' : draft.name || 'Template'}</h1>

        <span className="topbar__spacer" />

        <SaveState saving={saving} dirty={dirty} lastSavedAt={lastSavedAt} />

        <button
          type="button"
          className="btn btn--primary btn--sm"
          onClick={save}
          disabled={saving || problems.length > 0 || (!dirty && !isNew)}
          title={problems.length ? problems[0] : 'Save'}
        >
          <FloppyDisk size={14} weight="bold" />
          Save
        </button>
      </PageHeader>

      <main className="tpl">
        {saveError && (
          <p className="alert alert--error" role="alert">
            <WarningCircle size={15} weight="fill" />
            {saveError}
          </p>
        )}

        <div className="tpl__meta">
          <div className="field">
            <label htmlFor="tpl-name">Name</label>
            <div className="field__wrap">
              <input
                id="tpl-name"
                value={draft.name}
                onChange={(e) => setName(e.target.value)}
                placeholder="SaaS starter"
                autoFocus={isNew}
              />
            </div>
          </div>

          <div className="field">
            <label htmlFor="tpl-key">Key</label>
            <div className="field__wrap">
              <input
                id="tpl-key"
                value={draft.key}
                onChange={(e) => {
                  setKeyTouched(true);
                  update({ ...draft, key: e.target.value });
                }}
                placeholder="saas-starter"
                spellCheck={false}
              />
            </div>
          </div>

          <div className="field">
            <label htmlFor="tpl-summary">What it is for</label>
            <div className="field__wrap">
              <input
                id="tpl-summary"
                value={draft.summary}
                onChange={(e) => update({ ...draft, summary: e.target.value })}
                placeholder="Every internal tool starts here."
              />
            </div>
          </div>
        </div>

        <div className="tpl__cols">
          <section
            className="tpl__pool"
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDropOutside}
            aria-label="Modules not yet placed"
          >
            <header className="tpl__poolhead">
              <h2>
                Available
                <span className="topbar__count">{unplaced.length}</span>
              </h2>
              <div className="search search--tight">
                <MagnifyingGlass size={13} weight="bold" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Filter"
                  aria-label="Filter modules"
                />
                {query && (
                  <button type="button" onClick={() => setQuery('')} aria-label="Clear filter">
                    <X size={11} weight="bold" />
                  </button>
                )}
              </div>
            </header>

            <p className="tpl__hint">
              Drag a module into a phase, or use its <strong>+</strong> button. Dragging one
              back here takes it out again.
            </p>

            {unplaced.length === 0 ? (
              <p className="tpl__empty">
                {query ? 'Nothing matches that.' : 'Every module is placed.'}
              </p>
            ) : (
              <ul className="tpl__poollist">
                {unplaced.map((module) => (
                  <li
                    key={module.key}
                    className="tmod tmod--pool"
                    draggable
                    onDragStart={() => onDragStart(module.key)}
                    onDragEnd={onDragEnd}
                  >
                    <span className="tmod__grip" aria-hidden="true">
                      <DotsSixVertical size={13} weight="bold" />
                    </span>
                    <span className="tmod__text">
                      <span className="tmod__name">
                        {module.name}
                        {module.own && <em className="tmod__own">yours</em>}
                      </span>
                      <span className="tmod__key">{module.key}</span>
                    </span>
                    {draft.phases.length > 0 && (
                      <button
                        type="button"
                        className="tmod__add"
                        onClick={() =>
                          update(addModule(draft, draft.phases[draft.phases.length - 1].id, module.key))
                        }
                        title={`Add to ${draft.phases[draft.phases.length - 1].name}`}
                        aria-label={`Add ${module.name} to ${draft.phases[draft.phases.length - 1].name}`}
                      >
                        <Plus size={12} weight="bold" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="tpl__phases" aria-label="Phases">
            {draft.phases.map((phase, phaseIndex) => (
              <article className="tphase" key={phase.id}>
                <header className="tphase__head">
                  <span className="tphase__no" aria-hidden="true">
                    {phaseIndex + 1}
                  </span>
                  <input
                    className="tphase__name"
                    value={phase.name}
                    onChange={(e) => update(renamePhase(draft, phase.id, e.target.value))}
                    aria-label={`Phase ${phaseIndex + 1} name`}
                    placeholder="Phase name"
                  />
                  <span className="tphase__count">
                    {phase.moduleKeys.length}
                    {phase.moduleKeys.length === 1 ? ' module' : ' modules'}
                  </span>

                  <span className="tphase__tools">
                    <button
                      type="button"
                      onClick={() => update(movePhase(draft, phase.id, -1))}
                      disabled={phaseIndex === 0}
                      aria-label={`Move ${phase.name} earlier`}
                      title="Move earlier"
                    >
                      <CaretUp size={12} weight="bold" />
                    </button>
                    <button
                      type="button"
                      onClick={() => update(movePhase(draft, phase.id, 1))}
                      disabled={phaseIndex === draft.phases.length - 1}
                      aria-label={`Move ${phase.name} later`}
                      title="Move later"
                    >
                      <CaretDown size={12} weight="bold" />
                    </button>
                    <button
                      type="button"
                      onClick={() => update(removePhase(draft, phase.id))}
                      aria-label={`Remove ${phase.name}`}
                      title="Remove phase — its modules go back to Available"
                    >
                      <Trash size={12} weight="bold" />
                    </button>
                  </span>
                </header>

                <ul
                  className="tphase__list"
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDropTarget({ phaseId: phase.id, index: phase.moduleKeys.length });
                  }}
                  onDrop={(e) => {
                    e.stopPropagation();
                    onDropInto(phase.id, phase.moduleKeys.length);
                  }}
                >
                  {phase.moduleKeys.length === 0 && (
                    <li className="tphase__empty">Drop modules here.</li>
                  )}

                  {phase.moduleKeys.map((key, index) => {
                    const module = lookup.get(key);
                    const isTarget =
                      dropTarget?.phaseId === phase.id && dropTarget?.index === index;

                    return (
                      <li
                        key={key}
                        className={`tmod${isTarget ? ' is-target' : ''}`}
                        draggable
                        onDragStart={() => onDragStart(key)}
                        onDragEnd={onDragEnd}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setDropTarget({ phaseId: phase.id, index });
                        }}
                        onDrop={(e) => {
                          e.stopPropagation();
                          onDropInto(phase.id, index);
                        }}
                      >
                        <span className="tmod__grip" aria-hidden="true">
                          <DotsSixVertical size={13} weight="bold" />
                        </span>
                        <span className="tmod__no" aria-hidden="true">
                          {index + 1}
                        </span>
                        <span className="tmod__text">
                          <span className="tmod__name">
                            {module?.name ?? key}
                            {module?.own && <em className="tmod__own">yours</em>}
                            {!module && <em className="tmod__missing">not in your catalogue</em>}
                          </span>
                          <span className="tmod__key">{key}</span>
                        </span>

                        {/* The keyboard and touch path for what dragging does. */}
                        <span className="tmod__tools">
                          <button
                            type="button"
                            onClick={() => update(nudgeModule(draft, key, -1))}
                            disabled={index === 0}
                            aria-label={`Move ${module?.name ?? key} earlier`}
                            title="Move earlier"
                          >
                            <CaretUp size={11} weight="bold" />
                          </button>
                          <button
                            type="button"
                            onClick={() => update(nudgeModule(draft, key, 1))}
                            disabled={index === phase.moduleKeys.length - 1}
                            aria-label={`Move ${module?.name ?? key} later`}
                            title="Move later"
                          >
                            <CaretDown size={11} weight="bold" />
                          </button>
                          <select
                            className="tmod__phase"
                            value={phase.id}
                            onChange={(e) => update(moveModule(draft, key, e.target.value, 0))}
                            aria-label={`Phase for ${module?.name ?? key}`}
                            title="Move to another phase"
                          >
                            {draft.phases.map((p, i) => (
                              <option key={p.id} value={p.id}>
                                {i + 1}. {p.name || 'Unnamed'}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => update(removeModule(draft, key))}
                            aria-label={`Remove ${module?.name ?? key}`}
                            title="Back to Available"
                          >
                            <X size={11} weight="bold" />
                          </button>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </article>
            ))}

            <button type="button" className="btn btn--sm tpl__addphase" onClick={() => update(addPhase(draft))}>
              <Plus size={14} weight="bold" />
              Add a phase
            </button>

            {problems.length > 0 && (
              <ul className="modsec__problems">
                {problems.map((problem) => (
                  <li key={problem}>{problem}</li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </main>
    </>
  );
}
