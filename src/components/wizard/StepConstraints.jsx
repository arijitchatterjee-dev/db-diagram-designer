import { ANSWERS, ANSWER_KEYS } from '../../engine/planOptions';

export default function StepConstraints({ draft, seededKeys, onAnswer }) {
  const answered = ANSWER_KEYS.filter((key) => draft.answers[key]).length;

  return (
    <div className="wstep">
      <header className="wstep__head">
        <h2>Constraints</h2>
        <p>
          Every question here is read by at least one recommendation rule. Leave one
          blank and the layers that depend on it stay undecided rather than guessed.
        </p>
        <p className="wstep__count">
          {answered} of {ANSWER_KEYS.length} answered
        </p>
      </header>

      {ANSWER_KEYS.map((key) => {
        const question = ANSWERS[key];
        const seeded = seededKeys.has(key) && Boolean(draft.answers[key]);

        return (
          <fieldset className="wfield" key={key}>
            <legend>
              {question.label}
              {seeded && <span className="wfield__tag">from preset</span>}
            </legend>
            <p className="wfield__hint">{question.help}</p>

            <div className="choices">
              {question.options.map((option) => (
                <button
                  type="button"
                  key={option.value}
                  className={`choice${draft.answers[key] === option.value ? ' is-active' : ''}`}
                  onClick={() => onAnswer(key, option.value)}
                  aria-pressed={draft.answers[key] === option.value}
                >
                  <span className="choice__name">{option.label}</span>
                  <span className="choice__detail">{option.detail}</span>
                </button>
              ))}
            </div>
          </fieldset>
        );
      })}
    </div>
  );
}
