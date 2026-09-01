import { useEffect, useRef, useState } from 'react';
import { Plus, Table, Warning } from '@phosphor-icons/react';

/**
 * The confirmation before writing generated DBML over a schema that already
 * exists.
 *
 * Append is the default and stays the default: losing a hand-drawn schema is
 * unrecoverable, and an extra table is not. Replace is available, but only
 * after the dialog has said in plain numbers what it would destroy.
 */
export default function GenerateSchemaDialog({ plan, busy, onConfirm, onCancel }) {
  const [mode, setMode] = useState('append');
  const cancelRef = useRef(null);

  useEffect(() => {
    cancelRef.current?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape' && !busy) onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [busy, onCancel]);

  const atRisk = plan.unaccounted.length;

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && !busy && onCancel()}>
      <div className="dialog dialog--wide" role="dialog" aria-modal="true" aria-labelledby="gen-title">
        <h2 className="dialog__title" id="gen-title">
          This project already has a schema
        </h2>
        <p className="dialog__body">
          It has {plan.existing.length} {plan.existing.length === 1 ? 'table' : 'tables'}, and the
          plan describes {plan.generated.length}. Choose what happens to what is there.
        </p>

        <div className="genopts">
          <button
            type="button"
            className={`genopt${mode === 'append' ? ' is-active' : ''}`}
            onClick={() => setMode('append')}
            aria-pressed={mode === 'append'}
          >
            <span className="genopt__head">
              <Plus size={14} weight="bold" />
              Append missing tables
              <span className="genopt__tag">Recommended</span>
            </span>
            <span className="genopt__body">
              Adds the {plan.adding.length} {plan.adding.length === 1 ? 'table' : 'tables'} that are
              not there yet. Nothing already in the schema is changed or removed.
            </span>
          </button>

          <button
            type="button"
            className={`genopt${mode === 'replace' ? ' is-active' : ''}${atRisk ? ' is-risky' : ''}`}
            onClick={() => setMode('replace')}
            aria-pressed={mode === 'replace'}
          >
            <span className="genopt__head">
              <Table size={14} weight="bold" />
              Replace everything
            </span>
            <span className="genopt__body">
              Throws the current schema away and writes the {plan.generated.length} tables the plan
              describes. Any layout and positions go with it.
            </span>
          </button>
        </div>

        {mode === 'replace' && atRisk > 0 && (
          <p className="genwarn">
            <Warning size={15} weight="fill" />
            <span>
              {atRisk} {atRisk === 1 ? 'table is' : 'tables are'} in your schema and not in the
              plan, so {atRisk === 1 ? 'it' : 'they'} would be lost:{' '}
              <strong>{plan.unaccounted.join(', ')}</strong>
            </span>
          </p>
        )}

        {mode === 'append' && plan.adding.length === 0 && (
          <p className="dialog__note">
            Every table the plan describes is already there, so appending would change nothing.
          </p>
        )}

        <div className="dialog__actions">
          <button type="button" className="btn" onClick={onCancel} disabled={busy} ref={cancelRef}>
            Cancel
          </button>
          <button
            type="button"
            className={mode === 'replace' && atRisk ? 'btn btn--danger' : 'btn btn--primary'}
            onClick={() => onConfirm(mode)}
            disabled={busy || (mode === 'append' && plan.adding.length === 0)}
          >
            {busy
              ? 'Writing'
              : mode === 'append'
                ? `Append ${plan.adding.length} ${plan.adding.length === 1 ? 'table' : 'tables'}`
                : 'Replace the schema'}
          </button>
        </div>
      </div>
    </div>
  );
}
