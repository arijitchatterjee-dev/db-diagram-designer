import { Info, Plus, Table, TreeStructure, X } from '@phosphor-icons/react';
import { MODULES, findModule } from '../../engine/modules';

export default function PlanModules({ moduleKeys, entities, apiCount, notice, onToggle }) {
  const selected = new Set(moduleKeys);
  const available = MODULES.filter((module) => !selected.has(module.key));

  return (
    <>
      {notice && (
        <p className="wnotice">
          <Info size={14} weight="fill" />
          <span>{notice}</span>
        </p>
      )}

      {moduleKeys.length === 0 ? (
        <p className="doc__hint">
          No modules yet, so nothing implies a table or an endpoint.
        </p>
      ) : (
        <ul className="modchips">
          {moduleKeys.map((key) => {
            const module = findModule(key);
            if (!module) return null;
            const neededBy = MODULES.filter(
              (other) => selected.has(other.key) && other.dependsOn.includes(key)
            );

            return (
              <li key={key}>
                <span className="modchip">
                  <span className="modchip__name">{module.name}</span>
                  <span className="modchip__meta">
                    {module.entities.length > 0 && (
                      <span title="Tables">
                        <Table size={10} weight="bold" />
                        {module.entities.length}
                      </span>
                    )}
                    <span title="Endpoints">
                      <TreeStructure size={10} weight="bold" />
                      {module.apis.length}
                    </span>
                  </span>
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
        {entities.length} {entities.length === 1 ? 'table' : 'tables'} and {apiCount}{' '}
        endpoints follow from this selection.
      </p>

      {available.length > 0 && (
        <div className="cl__add">
          <span>
            <Plus size={12} weight="bold" /> Add a module
          </span>
          <select
            className="select select--inline"
            value=""
            onChange={(e) => e.target.value && onToggle(e.target.value)}
          >
            <option value="">Choose a module</option>
            {available.map((module) => (
              <option key={module.key} value={module.key}>
                {module.name}
              </option>
            ))}
          </select>
        </div>
      )}
    </>
  );
}
