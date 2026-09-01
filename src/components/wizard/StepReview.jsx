import { Warning } from '@phosphor-icons/react';
import { labelFor, LAYERS, PRESETS, ANSWERS, ANSWER_KEYS } from '../../engine/planOptions';
import { findModule } from '../../engine/modules';

function answerLabel(key, value) {
  return ANSWERS[key].options.find((o) => o.value === value)?.label ?? value;
}

export default function StepReview({ draft, stack, apis, entities, notes, gaps }) {
  const decided = stack.filter((row) => !row.undecided);

  return (
    <div className="wstep">
      <header className="wstep__head">
        <h2>Review</h2>
        <p>Everything the plan will contain. All of it stays editable afterwards.</p>
      </header>

      {gaps.length > 0 && (
        <div className="wnotice wnotice--warn">
          <Warning size={14} weight="fill" />
          <div>
            <strong>Worth going back for</strong>
            <ul className="wgaps">
              {gaps.map((gap) => (
                <li key={gap}>{gap}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <section className="rev">
        <h3>Context</h3>
        <p className="rev__prose">{draft.context || <em>Nothing written yet.</em>}</p>
        <h3>Goal</h3>
        <p className="rev__prose">{draft.goal || <em>Nothing written yet.</em>}</p>
        <p className="rev__meta">Starting from the {labelFor(PRESETS, draft.presetKey)} preset.</p>
      </section>

      <section className="rev">
        <h3>Answers</h3>
        <dl className="rev__pairs">
          {ANSWER_KEYS.filter((key) => draft.answers[key]).map((key) => (
            <div key={key}>
              <dt>{ANSWERS[key].label}</dt>
              <dd>{answerLabel(key, draft.answers[key])}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="rev">
        <h3>Stack</h3>
        <dl className="rev__pairs">
          {decided.map((row) => (
            <div key={row.layer}>
              <dt>{labelFor(LAYERS, row.layer)}</dt>
              <dd>
                {row.name}
                {row.overridden && <span className="badge badge--override">Your choice</span>}
                {row.tossUp && <span className="badge badge--toss">Toss-up</span>}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="rev">
        <h3>
          Modules <span className="rev__count">{draft.moduleKeys.length}</span>
        </h3>
        <p className="rev__chips">
          {draft.moduleKeys.map((key) => (
            <span className="chip" key={key}>
              {findModule(key)?.name ?? key}
            </span>
          ))}
        </p>
        <p className="rev__meta">
          {entities.length} {entities.length === 1 ? 'table' : 'tables'} and {apis.length}{' '}
          endpoints follow from this selection.
        </p>
      </section>

      {notes.length > 0 && (
        <section className="rev">
          <h3>What breaks first</h3>
          <ul className="rev__notes">
            {notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
