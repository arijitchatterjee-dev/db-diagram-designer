import { useEffect, useMemo, useRef, useState } from 'react';
import { BookmarkSimple, Info, Table, WarningCircle, X } from '@phosphor-icons/react';
import DbmlEditor from '../editor/DbmlEditor';
import ApiTable from './ApiTable';
import { MODULES, MODULE_KEYS, findModule } from '../../engine/modules';
import {
  hydrateCustomModule,
  slugifyKey,
  validateModule,
  shadowWarning,
} from '../../engine/customModules';
import { COMPLEXITY } from '../../engine/estimate';

/**
 * The editor for a module you define yourself.
 *
 * Tables are written in DBML rather than in a form: the app already has an
 * editor for that language with autocomplete and line-accurate errors, and a
 * second way to describe a table would be a worse version of something already
 * built. Everything here is local until Save, so backing out leaves no trace.
 */
export default function ModuleEditorDialog({
  module: initial,
  isNew,
  planModuleKeys = [],
  planCustomModules = [],
  tableOwners,
  savingToLibrary,
  onSave,
  onSaveToLibrary,
  onCancel,
}) {
  const [draft, setDraft] = useState(initial);
  const [keyTouched, setKeyTouched] = useState(!isNew);
  const [entities, setEntities] = useState([]);
  const [parseError, setParseError] = useState(null);
  const nameRef = useRef(null);

  useEffect(() => {
    nameRef.current?.focus();
    const onKey = (e) => e.key === 'Escape' && onCancel();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);

  // Parsing is debounced for the same reason the diagram is: the document is
  // temporarily invalid on most keystrokes, and that is not worth reacting to.
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      const result = await hydrateCustomModule(draft);
      if (cancelled) return;
      setEntities(result.entities);
      setParseError(result.parseError);
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [draft.dbml]);

  const update = (changes) => setDraft((d) => ({ ...d, ...changes }));

  function setName(name) {
    // The key follows the name until you edit it yourself, then it is yours.
    update(keyTouched ? { name } : { name, key: slugifyKey(name) });
  }

  const otherKeys = useMemo(
    () =>
      planCustomModules
        .filter((m) => m.key !== initial.key)
        .map((m) => m.key),
    [planCustomModules, initial.key]
  );

  const problems = validateModule(draft, { existingKeys: otherKeys });
  const shadows = shadowWarning(draft, MODULE_KEYS);

  // A table another selected module already owns. `entitiesFor` keeps the first
  // silently, so saying it here is the only useful moment.
  const clashes = useMemo(() => {
    if (!tableOwners) return [];
    return entities
      .map((entity) => {
        const owners = (tableOwners.get(entity.name) ?? []).filter((key) => key !== draft.key);
        return owners.length ? { table: entity.name, owner: owners[0] } : null;
      })
      .filter(Boolean);
  }, [entities, tableOwners, draft.key]);

  const dependable = [...MODULES, ...planCustomModules.filter((m) => m.key !== draft.key)];

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="dialog dialog--editor" role="dialog" aria-modal="true" aria-labelledby="mod-title">
        <header className="dialog__bar">
          <h2 className="dialog__title" id="mod-title">
            {isNew ? 'New module' : `Edit ${initial.name || initial.key}`}
          </h2>
          <button type="button" className="dialog__close" onClick={onCancel} aria-label="Close">
            <X size={14} weight="bold" />
          </button>
        </header>

        <div className="dialog__scroll">
          <div className="doc__row">
            <div className="field">
              <label htmlFor="mod-name">Name</label>
              <div className="field__wrap">
                <input
                  id="mod-name"
                  ref={nameRef}
                  value={draft.name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Referrals"
                />
              </div>
            </div>
            <div className="field">
              <label htmlFor="mod-key">Key</label>
              <div className="field__wrap">
                <input
                  id="mod-key"
                  value={draft.key}
                  onChange={(e) => {
                    setKeyTouched(true);
                    update({ key: e.target.value });
                  }}
                  placeholder="referrals"
                  spellCheck={false}
                />
              </div>
              <p className="field__hint">Used in folder paths and dependencies.</p>
            </div>
          </div>

          <div className="field">
            <label htmlFor="mod-summary">What it does</label>
            <div className="field__wrap">
              <input
                id="mod-summary"
                value={draft.summary}
                onChange={(e) => update({ summary: e.target.value })}
                placeholder="Refer a friend, both get credit."
              />
            </div>
          </div>

          <div className="field">
            <label htmlFor="mod-complexity">Size</label>
            <p className="field__hint">
              Roughly what it takes to build, which is what the estimate reads. Left
              unset it counts as medium.
            </p>
            <select
              id="mod-complexity"
              className="select"
              value={draft.complexity ?? ''}
              onChange={(e) => update({ complexity: e.target.value })}
            >
              <option value="">Unset (medium)</option>
              {COMPLEXITY.map((level) => (
                <option key={level.value} value={level.value}>
                  {level.label} — about {level.days} {level.days === 1 ? 'day' : 'days'}
                </option>
              ))}
            </select>
          </div>

          {shadows && (
            <p className="wnotice">
              <Info size={14} weight="fill" />
              <span>{shadows}</span>
            </p>
          )}

          <section className="modsec">
            <h3>
              Tables
              <span className="modsec__count">
                {entities.length} {entities.length === 1 ? 'table' : 'tables'}
              </span>
            </h3>
            <p className="doc__hint">
              Written in DBML, the same language as the schema editor. These become real
              tables when you generate the schema.
            </p>

            <div className="modsec__editor">
              <DbmlEditor
                value={draft.dbml}
                onChange={(dbml) => update({ dbml })}
                parseError={parseError}
              />
            </div>

            {clashes.length > 0 && (
              <p className="wnotice wnotice--warn">
                <WarningCircle size={14} weight="fill" />
                <span>
                  {clashes.map((c) => `"${c.table}" is already declared by the ${c.owner} module`).join('; ')}
                  . Whichever comes first in the plan wins, and the other is dropped.
                </span>
              </p>
            )}

            {entities.length > 0 && (
              <p className="modsec__tables">
                {entities.map((entity) => (
                  <span className="chip" key={entity.name}>
                    <Table size={11} weight="bold" />
                    {entity.name}
                    <em>{entity.fields.length}</em>
                  </span>
                ))}
              </p>
            )}
          </section>

          <section className="modsec">
            <h3>
              Endpoints
              <span className="modsec__count">{draft.apis.length}</span>
            </h3>
            <ApiTable
              apis={draft.apis}
              onChange={(index, changes) =>
                update({ apis: draft.apis.map((a, i) => (i === index ? { ...a, ...changes } : a)) })
              }
              onAdd={() =>
                update({ apis: [...draft.apis, { method: 'GET', path: '/api/', purpose: '', auth: true }] })
              }
              onRemove={(index) => update({ apis: draft.apis.filter((_, i) => i !== index) })}
            />
          </section>

          <section className="modsec">
            <h3>Depends on</h3>
            <p className="doc__hint">
              Selecting this module will pull these in automatically.
            </p>
            <div className="depends">
              {draft.dependsOn.map((key) => (
                <span className="chip" key={key}>
                  {findModule(key)?.name ?? planCustomModules.find((m) => m.key === key)?.name ?? key}
                  <button
                    type="button"
                    onClick={() => update({ dependsOn: draft.dependsOn.filter((k) => k !== key) })}
                    aria-label={`Remove dependency ${key}`}
                  >
                    <X size={10} weight="bold" />
                  </button>
                </span>
              ))}
              <select
                className="select select--inline"
                value=""
                onChange={(e) =>
                  e.target.value && update({ dependsOn: [...draft.dependsOn, e.target.value] })
                }
              >
                <option value="">Add a dependency</option>
                {dependable
                  .filter((m) => !draft.dependsOn.includes(m.key))
                  .map((m) => (
                    <option key={m.key} value={m.key}>
                      {m.name}
                    </option>
                  ))}
              </select>
            </div>
          </section>

          {problems.length > 0 && (
            <ul className="modsec__problems">
              {problems.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          )}
        </div>

        <footer className="dialog__actions dialog__actions--split">
          {/* Absent on the library page itself: you are already there. */}
          {onSaveToLibrary ? (
            <button
              type="button"
              className="btn btn--sm"
              onClick={() => onSaveToLibrary(draft)}
              disabled={problems.length > 0 || savingToLibrary}
              title="Keep this module for other projects"
            >
              <BookmarkSimple size={14} weight="bold" />
              {savingToLibrary ? 'Saving' : 'Save to library'}
            </button>
          ) : (
            <span />
          )}

          <div className="dialog__actions">
            <button type="button" className="btn" onClick={onCancel}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => onSave(draft)}
              disabled={problems.length > 0}
            >
              {isNew ? 'Add module' : 'Save changes'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
