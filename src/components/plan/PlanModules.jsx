import { BookmarkSimple, Info, PencilSimple, Plus, Table, TreeStructure, WarningCircle, X } from '@phosphor-icons/react';
import { MODULES, findModule } from '../../engine/modules';

/**
 * The modules a plan covers, built-in and your own together.
 *
 * A custom module is marked as yours and is editable in place; a built-in is
 * catalogue content and is not. Both behave identically everywhere else.
 */
export default function PlanModules({
  moduleKeys,
  customModules = [],
  entities,
  apiCount,
  notice,
  onToggle,
  onNewModule,
  onEditModule,
  onOpenLibrary,
}) {
  const selected = new Set(moduleKeys);
  const customByKey = new Map(customModules.map((module) => [module.key, module]));

  // Built-ins not already selected, minus any a custom module has shadowed.
  const available = MODULES.filter((module) => !selected.has(module.key) && !customByKey.has(module.key));
  const unusedCustom = customModules.filter((module) => !selected.has(module.key));

  const broken = customModules.filter((module) => module.parseError && selected.has(module.key));

  return (
    <>
      {notice && (
        <p className="wnotice">
          <Info size={14} weight="fill" />
          <span>{notice}</span>
        </p>
      )}

      {broken.length > 0 && (
        <p className="wnotice wnotice--warn">
          <WarningCircle size={14} weight="fill" />
          <span>
            {broken.map((m) => m.name || m.key).join(', ')} {broken.length === 1 ? 'has' : 'have'}{' '}
            DBML that does not parse, so {broken.length === 1 ? 'its tables are' : 'their tables are'}{' '}
            not counted. Everything else in the plan is unaffected.
          </span>
        </p>
      )}

      {moduleKeys.length === 0 ? (
        <p className="doc__hint">No modules yet, so nothing implies a table or an endpoint.</p>
      ) : (
        <ul className="modchips">
          {moduleKeys.map((key) => {
            const custom = customByKey.get(key);
            const module = custom ?? findModule(key);
            if (!module) return null;

            const neededBy = [...MODULES, ...customModules].filter(
              (other) => selected.has(other.key) && (other.dependsOn ?? []).includes(key)
            );
            const tableCount = custom ? custom.entities?.length ?? 0 : module.entities.length;

            return (
              <li key={key}>
                <span className={`modchip${custom ? ' is-custom' : ''}`}>
                  {custom && (
                    <span className="modchip__mine" title="A module you defined">
                      <BookmarkSimple size={10} weight="fill" />
                    </span>
                  )}
                  <span className="modchip__name">{module.name}</span>
                  <span className="modchip__meta">
                    {tableCount > 0 && (
                      <span title="Tables">
                        <Table size={10} weight="bold" />
                        {tableCount}
                      </span>
                    )}
                    <span title="Endpoints">
                      <TreeStructure size={10} weight="bold" />
                      {(module.apis ?? []).length}
                    </span>
                  </span>

                  {custom && (
                    <button
                      type="button"
                      onClick={() => onEditModule(custom)}
                      aria-label={`Edit ${module.name}`}
                      title="Edit this module"
                    >
                      <PencilSimple size={10} weight="bold" />
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => onToggle(key)}
                    aria-label={`Remove ${module.name}`}
                    title={
                      neededBy.length
                        ? `Removing this also removes ${neededBy.map((m) => m.name).join(', ')}`
                        : `Remove ${module.name}`
                    }
                  >
                    <X size={10} weight="bold" />
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <p className="doc__hint doc__hint--tight">
        {entities.length} {entities.length === 1 ? 'table' : 'tables'} and {apiCount} endpoints
        follow from this selection.
      </p>

      <div className="modactions">
        <button type="button" className="btn btn--sm" onClick={onNewModule}>
          <Plus size={14} weight="bold" />
          New module
        </button>
        <button type="button" className="btn btn--sm" onClick={onOpenLibrary}>
          <BookmarkSimple size={14} weight="bold" />
          Insert from library
        </button>

        {(available.length > 0 || unusedCustom.length > 0) && (
          <select
            className="select select--inline"
            value=""
            onChange={(e) => e.target.value && onToggle(e.target.value)}
            aria-label="Add a module"
          >
            <option value="">Add from the catalogue</option>
            {unusedCustom.length > 0 && (
              <optgroup label="Yours">
                {unusedCustom.map((module) => (
                  <option key={module.key} value={module.key}>
                    {module.name}
                  </option>
                ))}
              </optgroup>
            )}
            <optgroup label="Built in">
              {available.map((module) => (
                <option key={module.key} value={module.key}>
                  {module.name}
                </option>
              ))}
            </optgroup>
          </select>
        )}
      </div>
    </>
  );
}
