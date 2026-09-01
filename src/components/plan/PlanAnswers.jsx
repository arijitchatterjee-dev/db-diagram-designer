import { ANSWERS, ANSWER_KEYS } from '../../engine/planOptions';

/**
 * The answers, inline and editable. Changing one here re-runs the engine
 * immediately, which is the point: you can see what a constraint was actually
 * buying you by taking it away.
 */
export default function PlanAnswers({ answers, onAnswer }) {
  const missing = ANSWER_KEYS.filter((key) => !answers[key]);

  return (
    <>
      <div className="answers">
        {ANSWER_KEYS.map((key) => (
          <label className="answers__row" key={key}>
            <span className="answers__label">{ANSWERS[key].label}</span>
            <select
              className="select select--inline"
              value={answers[key] ?? ''}
              onChange={(e) => onAnswer(key, e.target.value)}
            >
              <option value="">Not answered</option>
              {ANSWERS[key].options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>

      {missing.length > 0 && (
        <p className="doc__hint doc__hint--tight">
          {missing.length} unanswered, so the layers that depend on{' '}
          {missing.length === 1 ? 'it' : 'them'} stay undecided rather than guessed.
        </p>
      )}
    </>
  );
}
