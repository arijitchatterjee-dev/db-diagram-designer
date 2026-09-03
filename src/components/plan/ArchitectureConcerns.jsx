import { ArrowUUpLeft, Check, Warning, X } from '@phosphor-icons/react';
import { CONCERNS } from '../../engine/concerns';

/**
 * One decision per cross-cutting concern, with the rule that produced it.
 *
 * Deliberately not free text. A structured choice is what reaches the AI
 * handoff prompt and the exported spec as something an agent can act on,
 * rather than a paragraph it has to interpret.
 */
export default function ArchitectureConcerns({ concerns, notes, onChoose, onClear, onNote }) {
  const byKey = new Map(concerns.map((concern) => [concern.key, concern]));

  return (
    <div className="concerns">
      {CONCERNS.map((definition) => {
        const decided = byKey.get(definition.key);
        const options = definition.options;

        return (
          <section className="concern" key={definition.key}>
            <div className="concern__head">
              <div className="concern__title">
                <h3>{definition.label}</h3>
                <p className="concern__help">{definition.help}</p>
              </div>

              <div className="concern__pick">
                {decided?.overridden && <span className="badge--override">Your choice</span>}
                <select
                  className="select select--inline"
                  value={decided?.overridden ? decided.choice : ''}
                  onChange={(e) =>
                    e.target.value ? onChoose(definition.key, e.target.value) : onClear(definition.key)
                  }
                  aria-label={definition.label}
                >
                  <option value="">
                    {decided && !decided.undecided ? `Recommended: ${decided.name}` : 'Pick one'}
                  </option>
                  {options.map((option) => (
                    <option key={option.key} value={option.key}>
                      {option.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {decided && !decided.undecided ? (
              <>
                <p className="concern__choice">
                  {decided.name}
                  {decided.overridden && decided.enginePick && (
                    <button
                      type="button"
                      className="linkish"
                      onClick={() => onClear(definition.key)}
                      title={`Go back to ${decided.enginePick.name}`}
                    >
                      <ArrowUUpLeft size={11} weight="bold" />
                      Use {decided.enginePick.name}
                    </button>
                  )}
                </p>

                {decided.reason ? (
                  <ul className="reasons">
                    <li className="reasons__for">
                      <Check size={13} weight="bold" />
                      {decided.reason}
                    </li>
                    {(decided.concerns ?? []).map((objection) => (
                      <li className="reasons__against" key={objection}>
                        <Warning size={13} weight="bold" />
                        {objection}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="concern__yours">
                    Your own call, so the engine has no rule to quote for it.
                  </p>
                )}

                {(decided.alternatives ?? []).length > 0 && (
                  <ul className="alts">
                    {decided.alternatives.map((alt) => (
                      <li key={alt.choice} className={alt.ruledOut ? 'is-out' : undefined}>
                        <span className="alts__name">
                          {alt.ruledOut && <X size={11} weight="bold" />}
                          {alt.name}
                        </span>
                        <span className="alts__text">{alt.ruledOut ? alt.tradeoff : alt.why}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            ) : (
              <p className="concern__empty">
                Nothing in your answers points either way here. Pick one, or fill in the
                questions on the plan.
              </p>
            )}

            <input
              className="concern__note"
              value={notes[definition.key] ?? ''}
              onChange={(e) => onNote(definition.key, e.target.value)}
              placeholder="Your note on this decision"
              aria-label={`Note on ${definition.label}`}
            />
          </section>
        );
      })}
    </div>
  );
}
