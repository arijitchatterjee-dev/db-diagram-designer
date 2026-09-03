import { useEffect, useState } from 'react';
import { Info, Table, Trash, TreeStructure, X } from '@phosphor-icons/react';

/**
 * Insert a module you saved earlier into this plan.
 *
 * Inserting copies. From that moment the plan's version is its own, and editing
 * the library later never reaches back into a project already under way. That
 * is the same rule blueprints follow, for the same reason.
 */
export default function ModuleLibraryDialog({
  modules,
  loading,
  alreadyInPlan = [],
  busyKey,
  onInsert,
  onDelete,
  onCancel,
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(null);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onCancel();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const inPlan = new Set(alreadyInPlan);

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="dialog dialog--wide" role="dialog" aria-modal="true" aria-labelledby="lib-title">
        <header className="dialog__bar">
          <h2 className="dialog__title" id="lib-title">
            Module library
          </h2>
          <button type="button" className="dialog__close" onClick={onCancel} aria-label="Close">
            <X size={14} weight="bold" />
          </button>
        </header>

        <div className="dialog__scroll">
          {loading && <p className="doc__hint">Loading your modules</p>}

          {!loading && modules.length === 0 && (
            <p className="wnotice">
              <Info size={14} weight="fill" />
              <span>
                Nothing saved yet. Build a module in this plan and use <strong>Save to
                library</strong> to keep it for the next project.
              </span>
            </p>
          )}

          <ul className="library">
            {modules.map((module) => {
              const already = inPlan.has(module.key);
              return (
                <li key={module._id} className="library__row">
                  <div className="library__body">
                    <p className="library__name">
                      {module.name}
                      <span className="library__key">{module.key}</span>
                      <span className="library__version">v{module.version}</span>
                    </p>
                    {module.summary && <p className="library__summary">{module.summary}</p>}
                    <p className="library__meta">
                      <span>
                        <TreeStructure size={11} weight="bold" />
                        {module.apis.length} endpoints
                      </span>
                      {module.dbml.trim() && (
                        <span>
                          <Table size={11} weight="bold" />
                          has tables
                        </span>
                      )}
                      {module.dependsOn.length > 0 && <span>needs {module.dependsOn.join(', ')}</span>}
                    </p>
                  </div>

                  <div className="library__actions">
                    <button
                      type="button"
                      className="btn btn--sm btn--primary"
                      onClick={() => onInsert(module)}
                      disabled={already || busyKey === module.key}
                      title={already ? 'Already in this plan' : 'Copy it into this plan'}
                    >
                      {already ? 'In this plan' : 'Insert'}
                    </button>
                    <button
                      type="button"
                      className="cl__detach"
                      onClick={() => setConfirmingDelete(module)}
                      aria-label={`Delete ${module.name} from the library`}
                    >
                      <Trash size={13} weight="bold" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>

          {confirmingDelete && (
            <p className="wnotice wnotice--warn">
              <Trash size={14} weight="fill" />
              <span>
                Delete <strong>{confirmingDelete.name}</strong> from the library? Plans that
                already copied it keep their copy.
              </span>
              <button
                type="button"
                className="linkish"
                onClick={() => {
                  onDelete(confirmingDelete);
                  setConfirmingDelete(null);
                }}
              >
                Delete it
              </button>
              <button type="button" className="linkish" onClick={() => setConfirmingDelete(null)}>
                Keep it
              </button>
            </p>
          )}
        </div>

        <footer className="dialog__actions">
          <button type="button" className="btn" onClick={onCancel}>
            Done
          </button>
        </footer>
      </div>
    </div>
  );
}
