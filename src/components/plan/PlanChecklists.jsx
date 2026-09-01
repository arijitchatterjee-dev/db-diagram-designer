import { useMemo } from 'react';
import { ArrowClockwise, Info, Plus, Trash } from '@phosphor-icons/react';
import { blueprintKeysFor } from '../../engine/recommend';

const CATEGORY_ORDER = [
  'Core flows',
  'Security',
  'Authorization',
  'Data',
  'Performance',
  'Common miss',
];

/**
 * Checklists attached to this project.
 *
 * Each is a copy taken when it was attached, so editing the blueprint later
 * never rewrites work already under way. When the source has moved on, the
 * version is shown and updating is an explicit choice.
 */
export default function PlanChecklists({
  blueprints,
  selectedModules,
  moduleKeys,
  busyKey,
  onAttach,
  onDetach,
  onToggle,
}) {
  const byKey = useMemo(
    () => new Map(blueprints.map((blueprint) => [blueprint.key, blueprint])),
    [blueprints]
  );
  const attachedKeys = new Set(selectedModules.map((module) => module.blueprintKey));

  // Checklists the chosen modules imply but that are not attached yet.
  const implied = blueprintKeysFor(moduleKeys).filter(
    (key) => byKey.has(key) && !attachedKeys.has(key)
  );
  const impliedMissing = blueprintKeysFor(moduleKeys).filter((key) => !byKey.has(key));

  const total = selectedModules.reduce((sum, m) => sum + m.checklist.length, 0);
  const done = selectedModules.reduce(
    (sum, m) => sum + m.checklist.filter((item) => item.done).length,
    0
  );

  if (blueprints.length === 0) {
    return (
      <p className="wnotice">
        <Info size={14} weight="fill" />
        <span>
          No module blueprints on this account yet. They are seeded per account with{' '}
          <code>node src/utils/seedBlueprints.js &lt;your user id&gt;</code> in{' '}
          <code>server/</code>, which creates the starter Authentication and Generic CRUD
          checklists.
        </span>
      </p>
    );
  }

  return (
    <>
      {total > 0 && (
        <p className="checkbar">
          <span
            className="checkbar__fill"
            style={{ width: `${Math.round((done / total) * 100)}%` }}
          />
          <span className="checkbar__label">
            {done} of {total} done
          </span>
        </p>
      )}

      {implied.length > 0 && (
        <p className="wnotice">
          <Info size={14} weight="fill" />
          <span>
            Your modules imply {implied.length} checklist
            {implied.length === 1 ? '' : 's'} you have not attached.
          </span>
          <button type="button" className="linkish" onClick={() => onAttach(implied)}>
            <Plus size={12} weight="bold" />
            Attach {implied.join(', ')}
          </button>
        </p>
      )}

      {impliedMissing.length > 0 && (
        <p className="wnotice">
          <Info size={14} weight="fill" />
          <span>
            Your modules also reference {impliedMissing.join(', ')}, which does not exist
            on this account yet.
          </span>
        </p>
      )}

      {selectedModules.length === 0 && (
        <p className="doc__hint">Nothing attached yet. Add a checklist below.</p>
      )}

      {selectedModules.map((module) => {
        const source = byKey.get(module.blueprintKey);
        const behind = source && source.version > module.blueprintVersion;
        const moduleDone = module.checklist.filter((i) => i.done).length;

        return (
          <section className="cl" key={module.blueprintKey}>
            <header className="cl__head">
              <h4>{source?.name ?? module.blueprintKey}</h4>
              <span className="cl__count">
                {moduleDone}/{module.checklist.length}
              </span>
              {behind && (
                <button
                  type="button"
                  className="linkish"
                  onClick={() => onAttach([module.blueprintKey])}
                  disabled={busyKey === module.blueprintKey}
                  title={`Blueprint is at version ${source.version}, this copy is version ${module.blueprintVersion}`}
                >
                  <ArrowClockwise size={12} weight="bold" />
                  Update to v{source.version}
                </button>
              )}
              <span className="layer__spacer" />
              <button
                type="button"
                className="cl__detach"
                onClick={() => onDetach(module.blueprintKey)}
                disabled={busyKey === module.blueprintKey}
                aria-label={`Remove the ${module.blueprintKey} checklist`}
              >
                <Trash size={13} weight="bold" />
              </button>
            </header>

            {CATEGORY_ORDER.filter((category) =>
              module.checklist.some((item) => item.category === category)
            ).map((category) => (
              <div className="cl__group" key={category}>
                <h5>{category}</h5>
                <ul>
                  {module.checklist.map((item, index) =>
                    item.category !== category ? null : (
                      <li key={`${item.category}-${item.item}`}>
                        <label className={item.done ? 'is-done' : undefined}>
                          <input
                            type="checkbox"
                            checked={item.done}
                            onChange={(e) =>
                              onToggle(module.blueprintKey, index, e.target.checked)
                            }
                          />
                          <span>{item.item}</span>
                        </label>
                      </li>
                    )
                  )}
                </ul>
              </div>
            ))}
          </section>
        );
      })}

      <div className="cl__add">
        <span>Add a checklist</span>
        <select
          className="select select--inline"
          value=""
          onChange={(e) => e.target.value && onAttach([e.target.value])}
        >
          <option value="">Choose a blueprint</option>
          {blueprints
            .filter((blueprint) => !attachedKeys.has(blueprint.key))
            .map((blueprint) => (
              <option key={blueprint.key} value={blueprint.key}>
                {blueprint.name} (v{blueprint.version})
              </option>
            ))}
        </select>
      </div>
    </>
  );
}
