import { Info, Table, TreeStructure } from '@phosphor-icons/react';
import { MODULES } from '../../engine/modules';

export default function StepModules({ draft, notice, onToggle }) {
  const selected = new Set(draft.moduleKeys);

  // Everything the preset suggests first, then the rest of the catalogue, so
  // the relevant modules are not buried among the ones that are not.
  const suggested = MODULES.filter((m) => m.presets.includes(draft.presetKey));
  const others = MODULES.filter((m) => !m.presets.includes(draft.presetKey));

  const renderModule = (module) => {
    const isOn = selected.has(module.key);
    const neededBy = MODULES.filter(
      (other) => selected.has(other.key) && other.dependsOn.includes(module.key)
    );

    return (
      <li key={module.key}>
        <button
          type="button"
          className={`module${isOn ? ' is-on' : ''}`}
          onClick={() => onToggle(module.key)}
          aria-pressed={isOn}
        >
          <span className="module__box" aria-hidden="true" />
          <span className="module__body">
            <span className="module__name">{module.name}</span>
            <span className="module__summary">{module.summary}</span>
            <span className="module__meta">
              {module.entities.length > 0 && (
                <span>
                  <Table size={11} weight="bold" />
                  {module.entities.length} {module.entities.length === 1 ? 'table' : 'tables'}
                </span>
              )}
              <span>
                <TreeStructure size={11} weight="bold" />
                {module.apis.length} endpoints
              </span>
              {isOn && neededBy.length > 0 && (
                <span className="module__needed">
                  needed by {neededBy.map((m) => m.name).join(', ')}
                </span>
              )}
            </span>
          </span>
        </button>
      </li>
    );
  };

  return (
    <div className="wstep">
      <header className="wstep__head">
        <h2>Modules</h2>
        <p>
          Ticking a module brings its tables and its endpoints with it. Anything it
          depends on is added for you, and dropping something other modules stand on
          takes them with it.
        </p>
        <p className="wstep__count">{draft.moduleKeys.length} selected</p>
      </header>

      {notice && (
        <p className="wnotice">
          <Info size={14} weight="fill" />
          {notice}
        </p>
      )}

      {suggested.length > 0 && (
        <>
          <h3 className="wgroup">Usual for this kind of project</h3>
          <ul className="modules">{suggested.map(renderModule)}</ul>
        </>
      )}

      <h3 className="wgroup">{suggested.length > 0 ? 'Everything else' : 'All modules'}</h3>
      <ul className="modules">{others.map(renderModule)}</ul>
    </div>
  );
}
