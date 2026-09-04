import { ArrowUUpLeft, Check, Scales, Warning, X } from '@phosphor-icons/react';
import { candidatesForLayer } from '../../engine/catalog';
import { labelFor, LAYERS } from '../../engine/planOptions';

/**
 * One layer of the recommended stack, with the rules that produced it.
 *
 * Shared by the plan document and the architecture page so reasoning reads the same
 * in both places, and there is one implementation of the override control
 * rather than two that drift.
 */
export default function StackLayer({
  row,
  onOverride,
  onClearOverride,
  // Architecture rows are the same shape but not stack layers, so the label,
  // the options and the key passed back are overridable. Left alone, this
  // behaves exactly as it did for the stack.
  label,
  options,
  dimension,
}) {
  const key = dimension ?? row.layer;
  const choices = options ?? candidatesForLayer(row.layer);

  return (
    <section className={`layer${row.undecided ? ' is-undecided' : ''}`}>
      <div className="layer__head">
        <span className="layer__name">{label ?? labelFor(LAYERS, row.layer)}</span>

        {row.undecided ? (
          <span className="layer__choice layer__choice--none">Undecided</span>
        ) : (
          <>
            <span className="layer__choice">{row.name}</span>
            {row.overridden && <span className="badge--override">Your choice</span>}
            {row.tossUp && (
              <span className="badge--toss" title="Two candidates scored within a point">
                <Scales size={11} weight="bold" />
                Toss-up
              </span>
            )}
          </>
        )}

        <span className="layer__spacer" />

        {row.overridden && row.enginePick && (
          <button
            type="button"
            className="linkish"
            onClick={() => onClearOverride(key)}
            title={`Go back to ${row.enginePick.name}`}
          >
            <ArrowUUpLeft size={12} weight="bold" />
            Use {row.enginePick.name}
          </button>
        )}
      </div>

      {row.undecided ? (
        <p className="layer__empty">
          Nothing in your answers points either way here. Fill in the questions this
          layer depends on, or pick one yourself.
        </p>
      ) : (
        <>
          {row.tossUp && (
            <p className="layer__toss">
              Genuinely close. Either would be defensible, so this one is a preference
              rather than a recommendation.
            </p>
          )}

          <ul className="reasons">
            {row.reasons.map((reason) => (
              <li key={reason} className="reasons__for">
                <Check size={13} weight="bold" />
                {reason}
              </li>
            ))}
            {row.concerns.map((concern) => (
              <li key={concern} className="reasons__against">
                <Warning size={13} weight="bold" />
                {concern}
              </li>
            ))}
          </ul>

          {row.breaksAt && (
            <p className="layer__breaks">
              <strong>Breaks at</strong> {row.breaksAt}
            </p>
          )}

          {row.alternatives?.length > 0 && (
            <ul className="alts">
              {row.alternatives.map((alt) => (
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
      )}

      <label className="layer__pick">
        <span>Use instead</span>
        <select
          className="select select--inline"
          value={row.overridden ? row.choice : ''}
          onChange={(e) =>
            e.target.value ? onOverride(key, e.target.value) : onClearOverride(key)
          }
        >
          <option value="">{row.undecided ? 'Pick one' : `Recommended: ${row.name}`}</option>
          {choices.map((candidate) => (
            <option key={candidate.key} value={candidate.key}>
              {candidate.name}
            </option>
          ))}
        </select>
      </label>
    </section>
  );
}
