import { ArrowLeft, ArrowRight, Check } from '@phosphor-icons/react';

/**
 * The plan's step rail.
 *
 * Unlike the wizard this replaced, no step is ever locked. This is a document
 * you are editing, not a form you are being walked through, so the marks report
 * what is filled in rather than how far you were allowed to get.
 */
export default function PlanSteps({ steps, current, onGo }) {
  return (
    <nav className="psteps" aria-label="Plan sections">
      <ol>
        {steps.map((step, index) => {
          const state = index === current ? 'is-current' : step.done ? 'is-done' : '';
          return (
            <li key={step.key} className={`psteps__item ${state}`}>
              <button
                type="button"
                onClick={() => onGo(index)}
                aria-current={index === current ? 'step' : undefined}
              >
                <span className="psteps__mark">
                  {step.done && index !== current ? <Check size={11} weight="bold" /> : index + 1}
                </span>
                <span className="psteps__label">{step.label}</span>
                {step.count && <span className="psteps__count">{step.count}</span>}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function PlanStepFoot({ onBack, onNext, nextLabel, hint }) {
  return (
    <footer className="pfoot">
      {onBack ? (
        <button type="button" className="btn" onClick={onBack}>
          <ArrowLeft size={15} weight="bold" />
          Back
        </button>
      ) : (
        <span />
      )}

      <div className="pfoot__right">
        {hint && <span className="pfoot__hint">{hint}</span>}
        {onNext && (
          <button type="button" className="btn btn--primary" onClick={onNext}>
            {nextLabel ?? 'Continue'}
            <ArrowRight size={15} weight="bold" />
          </button>
        )}
      </div>
    </footer>
  );
}
