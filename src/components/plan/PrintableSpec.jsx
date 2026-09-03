import { specSections } from '../../engine/buildSpec';
import { labelFor, PRESETS } from '../../engine/planOptions';
import { findArchitecture } from '../../engine/architecture';
import { findConcern, findConcernOption } from '../../engine/concerns';
import { renderTreeText } from '../../engine/folders';

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

      {(plan.architecture?.layering?.choice || plan.architecture?.topology?.choice) && (
        <section>
          <h2>Architecture</h2>
          {[
            ['layering', 'Layering'],
            ['topology', 'Deployment'],
          ].map(([dimension, label]) => {
            const row = plan.architecture[dimension];
            if (!row?.choice) return null;
            const candidate = findArchitecture(dimension, row.choice);
            return (
              <div className="printable__layer" key={dimension}>
                <h3>
                  {label}: {candidate?.name ?? row.choice}
                  {row.overridden && <em> (chosen over the recommendation)</em>}
                </h3>
                <ul>
                  {(row.reasons ?? []).map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              </div>
            );
          })}

          {(plan.architecture.concerns ?? []).filter((c) => c.choice).length > 0 && (
            <table className="printable__table">
              <thead>
                <tr>
                  <th>Concern</th>
                  <th>Decision</th>
                  <th>Why</th>
                </tr>
              </thead>
              <tbody>
                {plan.architecture.concerns
                  .filter((concern) => concern.choice)
                  .map((concern) => (
                    <tr key={concern.key}>
                      <td>{findConcern(concern.key)?.label ?? concern.key}</td>
                      <td>{findConcernOption(concern.key, concern.choice)?.name ?? concern.choice}</td>
                      <td>{concern.reason || concern.note || 'Your own call.'}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      {(plan.folders?.tree ?? []).length > 0 && (
        <section>
          <h2>Folder structure</h2>
          <pre className="printable__tree">{renderTreeText(plan.folders.tree)}</pre>
        </section>
      )}

      {(plan.architecture?.decisions ?? []).length > 0 && (
        <section>
          <h2>Decision log</h2>
          {plan.architecture.decisions.map((entry) => (
            <div className="printable__layer" key={entry.id}>
              <h3>
                {entry.title}
                {entry.date && <em> ({entry.date})</em>}
              </h3>
              {entry.choice && (
                <p>
                  <strong>Decided:</strong> {entry.choice}
                </p>
              )}
              {entry.context && <p>{entry.context}</p>}
              {(entry.rejected ?? []).length > 0 && (
                <ul>
                  {entry.rejected.map((item) => (
                    <li key={item}>Set aside: {item}</li>
                  ))}
                </ul>
              )}
              {entry.consequence && (
                <p>
                  <strong>Costs later:</strong> {entry.consequence}
                </p>
              )}
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
