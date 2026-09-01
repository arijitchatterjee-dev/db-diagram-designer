import { specSections } from '../../engine/buildSpec';
import { labelFor, PRESETS } from '../../engine/planOptions';

/**
 * The plan as a document rather than an editor.
 *
 * Hidden on screen and shown only by the print stylesheet, which is what makes
 * "save as PDF" produce a readable page instead of a photograph of a form full
 * of dropdowns.
 */
export default function PrintableSpec({ projectName, plan, stack, selectedModules, apis }) {
  const sections = specSections({ plan, stack, selectedModules });
  const printedAt = new Date().toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <article className="printable" aria-hidden="true">
      <header className="printable__head">
        <h1>{projectName}</h1>
        <p className="printable__meta">
          {labelFor(PRESETS, plan.presetKey)} · {plan.status} · {printedAt}
        </p>
      </header>

      <section>
        <h2>What it is</h2>
        <p>{plan.context || 'Not written yet.'}</p>
        {plan.goal && (
          <p>
            <strong>Done looks like:</strong> {plan.goal}
          </p>
        )}
      </section>

      {sections.answers.length > 0 && (
        <section>
          <h2>Constraints</h2>
          <dl className="printable__pairs">
            {sections.answers.map((answer) => (
              <div key={answer.label}>
                <dt>{answer.label}</dt>
                <dd>{answer.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {sections.stack.length > 0 && (
        <section>
          <h2>Stack</h2>
          {sections.stack.map((row) => (
            <div className="printable__layer" key={row.layer}>
              <h3>
                {row.layer}: {row.name}
                {row.overridden && <em> (chosen over the recommendation)</em>}
                {row.tossUp && <em> (a close call)</em>}
              </h3>
              <ul>
                {row.reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}

      {(plan.scaleNotes ?? []).length > 0 && (
        <section>
          <h2>What breaks first</h2>
          <ul>
            {plan.scaleNotes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </section>
      )}

      {sections.modules.length > 0 && (
        <section>
          <h2>Modules</h2>
          <ul className="printable__modules">
            {sections.modules.map((module) => (
              <li key={module.name}>
                <strong>{module.name}</strong> {module.summary}
                {module.tables.length > 0 && (
                  <span className="printable__tables"> Tables: {module.tables.join(', ')}</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {sections.checklists.length > 0 && (
        <section>
          <h2>Checklists</h2>
          {sections.checklists.map((checklist) => (
            <div className="printable__layer" key={checklist.key}>
              <h3>
                {checklist.key} ({checklist.done} of {checklist.items.length} done)
              </h3>
              <ul className="printable__checks">
                {checklist.items.map((item) => (
                  <li key={`${item.category}-${item.item}`}>
                    <span className="printable__box">{item.done ? '✓' : '☐'}</span>
                    {item.category}: {item.item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}

      {apis.length > 0 && (
        <section>
          <h2>API surface</h2>
          <table className="printable__table">
            <thead>
              <tr>
                <th>Method</th>
                <th>Path</th>
                <th>Purpose</th>
                <th>Auth</th>
              </tr>
            </thead>
            <tbody>
              {apis.map((api, index) => (
                <tr key={`${api.method}-${api.path}-${index}`}>
                  <td>{api.method}</td>
                  <td className="printable__mono">{api.path}</td>
                  <td>{api.purpose}</td>
                  <td>{api.auth ? 'yes' : 'public'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </article>
  );
}
