import { ArrowClockwise, Lock, LockOpen, Plus, Trash } from '@phosphor-icons/react';
import { HTTP_METHODS } from '../../engine/planOptions';
import { findModule } from '../../engine/modules';

/** The editable endpoint list. */
export default function ApiTable({ apis, stale, onChange, onAdd, onRemove, onRederive }) {
  return (
    <>
      {stale && (
        <p className="wnotice wnotice--warn">
          <ArrowClockwise size={14} weight="fill" />
          <span>
            The module selection changed after you edited this list, so it no longer
            matches. Rebuilding replaces every row, including your edits.
          </span>
          <button type="button" className="linkish" onClick={onRederive}>
            Rebuild from modules
          </button>
        </p>
      )}

      <div className="apis">
        <div className="apis__head" aria-hidden="true">
          <span>Method</span>
          <span>Path</span>
          <span>Purpose</span>
          <span>Auth</span>
          <span />
        </div>

        {apis.length === 0 && (
          <p className="apis__empty">
            No endpoints yet. Pick some modules, or add a row by hand.
          </p>
        )}

        {apis.map((api, index) => (
          <div className="apis__row" key={`${api.method}-${api.path}-${index}`}>
            <select
              className="select select--inline"
              value={api.method}
              onChange={(e) => onChange(index, { method: e.target.value })}
              aria-label="Method"
            >
              {HTTP_METHODS.map((method) => (
                <option key={method} value={method}>
                  {method}
                </option>
              ))}
            </select>

            <input
              value={api.path}
              onChange={(e) => onChange(index, { path: e.target.value })}
              className={api.path.startsWith('/') ? undefined : 'is-invalid'}
              aria-label="Path"
              spellCheck={false}
            />

            <input
              value={api.purpose ?? ''}
              onChange={(e) => onChange(index, { purpose: e.target.value })}
              placeholder={findModule(api.moduleKey)?.name ?? 'What it does'}
              aria-label="Purpose"
            />

            <button
              type="button"
              className={`authtoggle${api.auth ? ' is-on' : ''}`}
              onClick={() => onChange(index, { auth: !api.auth })}
              title={api.auth ? 'Requires a session' : 'Public'}
              aria-pressed={api.auth}
            >
              {api.auth ? <Lock size={12} weight="fill" /> : <LockOpen size={12} weight="bold" />}
              {api.auth ? 'Auth' : 'Public'}
            </button>

            <button
              type="button"
              className="apis__remove"
              onClick={() => onRemove(index)}
              aria-label={`Remove ${api.method} ${api.path}`}
            >
              <Trash size={13} weight="bold" />
            </button>
          </div>
        ))}
      </div>

      <button type="button" className="btn btn--sm" onClick={onAdd}>
        <Plus size={14} weight="bold" />
        Add an endpoint
      </button>
    </>
  );
}
