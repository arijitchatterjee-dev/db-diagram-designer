import { useState } from 'react';
import {
  ArrowClockwise,
  Cpu,
  PencilSimple,
  Plus,
  Trash,
  User,
  X,
} from '@phosphor-icons/react';
import { blankDecision, validateDecision } from '../../engine/decisions';

/**
 * Why the project is the way it is.
 *
 * Most entries write themselves from decisions already made, and follow those
 * decisions when they change. Entries you write are yours: nothing regenerates
 * or removes them, which is why only those are editable here.
 */
export default function DecisionLog({ entries, stale, onChange, onSync }) {
  const [editing, setEditing] = useState(null);

  const problems = editing ? validateDecision(editing) : [];

  function commit() {
    if (problems.length) return;
    const exists = entries.some((entry) => entry.id === editing.id);
    onChange(
      exists ? entries.map((entry) => (entry.id === editing.id ? editing : entry)) : [editing, ...entries]
    );
    setEditing(null);
  }

  return (
    <>
      {stale && (
        <p className="wnotice wnotice--warn">
          <ArrowClockwise size={14} weight="fill" />
          <span>
            Decisions have changed since the log was last updated. Your own entries are not
            affected.
          </span>
          <button type="button" className="linkish" onClick={onSync}>
            Update from the plan
          </button>
        </p>
      )}

      {editing && (
        <div className="adr adr--editing">
          <div className="adr__form">
            <div className="field">
              <label htmlFor="adr-title">Title</label>
              <div className="field__wrap">
                <input
                  id="adr-title"
                  value={editing.title}
                  autoFocus
                  onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                  placeholder="Use UUIDs for public ids"
                />
              </div>
            </div>

            <div className="field">
              <label htmlFor="adr-choice">What was decided</label>
              <div className="field__wrap">
                <input
                  id="adr-choice"
                  value={editing.choice}
                  onChange={(e) => setEditing({ ...editing, choice: e.target.value })}
                  placeholder="UUID v7 in every public URL"
                />
              </div>
            </div>

            <div className="field">
              <label htmlFor="adr-context">Why it came up</label>
              <textarea
                id="adr-context"
                rows={2}
                value={editing.context}
                onChange={(e) => setEditing({ ...editing, context: e.target.value })}
                placeholder="Sequential ids leak how many orders exist."
              />
            </div>

            <div className="doc__row">
              <div className="field">
                <label htmlFor="adr-rejected">What was set aside</label>
                <div className="field__wrap">
                  <input
                    id="adr-rejected"
                    value={editing.rejected.join('; ')}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        rejected: e.target.value.split(';').map((s) => s.trim()).filter(Boolean),
                      })
                    }
                    placeholder="Sequential integers: leaks volume"
                  />
                </div>
                <p className="field__hint">Separate several with a semicolon.</p>
              </div>

              <div className="field">
                <label htmlFor="adr-consequence">What it costs later</label>
                <div className="field__wrap">
                  <input
                    id="adr-consequence"
                    value={editing.consequence}
                    onChange={(e) => setEditing({ ...editing, consequence: e.target.value })}
                    placeholder="Slightly larger indexes."
                  />
                </div>
              </div>
            </div>

            {problems.length > 0 && (
              <ul className="modsec__problems">
                {problems.map((problem) => (
                  <li key={problem}>{problem}</li>
                ))}
              </ul>
            )}

            <div className="adr__formactions">
              <button type="button" className="btn btn--sm" onClick={() => setEditing(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn--sm btn--primary"
                onClick={commit}
                disabled={problems.length > 0}
              >
                Save entry
              </button>
            </div>
          </div>
        </div>
      )}

      {entries.length === 0 && !editing && (
        <p className="doc__hint">
          Nothing logged yet. Decide a stack and an architecture and most of this fills
          itself in.
        </p>
      )}

      <ol className="adrs">
        {entries.map((entry) => {
          const isMine = entry.source !== 'engine';
          return (
            <li className="adr" key={entry.id}>
              <div className="adr__head">
                <span className={`adr__source${isMine ? ' is-mine' : ''}`} title={isMine ? 'You wrote this' : 'Follows a decision in the plan'}>
                  {isMine ? <User size={10} weight="fill" /> : <Cpu size={10} weight="fill" />}
                  {isMine ? 'Yours' : 'From the plan'}
                </span>
                <h4>{entry.title}</h4>
                <time dateTime={entry.date}>{entry.date}</time>

                {isMine && (
                  <span className="adr__actions">
                    <button
                      type="button"
                      onClick={() => setEditing(entry)}
                      aria-label={`Edit ${entry.title}`}
                    >
                      <PencilSimple size={11} weight="bold" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onChange(entries.filter((e) => e.id !== entry.id))}
                      aria-label={`Delete ${entry.title}`}
                    >
                      <Trash size={11} weight="bold" />
                    </button>
                  </span>
                )}
              </div>

              {entry.choice && (
                <p className="adr__choice">
                  <strong>Decided</strong> {entry.choice}
                </p>
              )}
              {entry.context && <p className="adr__context">{entry.context}</p>}

              {entry.rejected.length > 0 && (
                <ul className="adr__rejected">
                  {entry.rejected.map((item) => (
                    <li key={item}>
                      <X size={10} weight="bold" />
                      {item}
                    </li>
                  ))}
                </ul>
              )}

              {entry.consequence && (
                <p className="adr__consequence">
                  <strong>Costs later</strong> {entry.consequence}
                </p>
              )}
            </li>
          );
        })}
      </ol>

      <div className="ftree__foot">
        <button
          type="button"
          className="btn btn--sm"
          onClick={() => setEditing(blankDecision())}
          disabled={Boolean(editing)}
        >
          <Plus size={14} weight="bold" />
          Log a decision
        </button>
        {!stale && entries.length > 0 && (
          <button type="button" className="linkish" onClick={onSync}>
            <ArrowClockwise size={12} weight="bold" />
            Update from the plan
          </button>
        )}
      </div>
    </>
  );
}
