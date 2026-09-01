import { PRESETS } from '../../engine/planOptions';

export default function StepContext({ draft, onChange, onPreset }) {
  return (
    <div className="wstep">
      <header className="wstep__head">
        <h2>What are you building?</h2>
        <p>
          Everything after this is reasoned against what you write here, so a
          sentence of real detail is worth more than a category.
        </p>
      </header>

      <fieldset className="wfield">
        <legend>Start from</legend>
        <div className="presets">
          {PRESETS.map((preset) => (
            <button
              type="button"
              key={preset.value}
              className={`preset${draft.presetKey === preset.value ? ' is-active' : ''}`}
              onClick={() => onPreset(preset.value)}
              aria-pressed={draft.presetKey === preset.value}
            >
              <span className="preset__name">{preset.label}</span>
              <span className="preset__detail">{preset.detail}</span>
            </button>
          ))}
        </div>
        <p className="wfield__hint">
          A preset only fills in blanks. Anything you have already answered or ticked
          yourself is left alone.
        </p>
      </fieldset>

      <div className="field">
        <label htmlFor="w-context">What is it, and who is it for</label>
        <textarea
          id="w-context"
          rows={4}
          value={draft.context}
          onChange={(e) => onChange({ context: e.target.value })}
          placeholder="A storefront for a small clothing brand, selling to customers in one country."
        />
      </div>

      <div className="field">
        <label htmlFor="w-goal">What does done look like</label>
        <textarea
          id="w-goal"
          rows={3}
          value={draft.goal}
          onChange={(e) => onChange({ goal: e.target.value })}
          placeholder="Customers can browse, pay and track an order. I can manage stock."
        />
      </div>
    </div>
  );
}
