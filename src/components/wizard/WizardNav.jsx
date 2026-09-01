import { ArrowLeft, ArrowRight, Check } from '@phosphor-icons/react';

/**
 * Steps are clickable in both directions. The wizard is a first pass, not a
 * gate: going back to change an answer and watching the recommendations move
 * is the point of the thing.
 */
export default function WizardNav({ steps, current, furthest, onGo }) {
  return (
    <ol className="wsteps">
      {steps.map((step, index) => {
        const state = index === current ? 'is-current' : index <= furthest ? 'is-done' : 'is-ahead';
        return (
          <li key={step.key} className={`wsteps__item ${state}`}>
            <button
              type="button"
              onClick={() => onGo(index)}
              disabled={index > furthest}
              aria-current={index === current ? 'step' : undefined}
            >
              <span className="wsteps__mark">
                {index < current ? <Check size={11} weight="bold" /> : index + 1}
              </span>
              <span className="wsteps__label">{step.label}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

export function WizardFooter({ onBack, onNext, backLabel, nextLabel, nextDisabled, nextHint }) {
  return (
    <footer className="wfoot">
      {onBack ? (
        <button type="button" className="btn" onClick={onBack}>
          <ArrowLeft size={15} weight="bold" />
          {backLabel ?? 'Back'}
        </button>
      ) : (
        <span />
      )}

      <div className="wfoot__right">
        {nextHint && <span className="wfoot__hint">{nextHint}</span>}
        <button type="button" className="btn btn--primary" onClick={onNext} disabled={nextDisabled}>
          {nextLabel ?? 'Continue'}
          <ArrowRight size={15} weight="bold" />
        </button>
      </div>
    </footer>
  );
}
