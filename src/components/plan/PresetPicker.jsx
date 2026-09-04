import { PRESETS } from '../../engine/planOptions';

/**
 * A starting point, not a decision. A preset only fills blanks: anything you
 * answered or picked yourself is left exactly as it was.
 */
export default function PresetPicker({ value, onChoose }) {
  return (
    <div className="presets">
      {PRESETS.map((preset) => (
        <button
          type="button"
          key={preset.value}
          className={`preset${value === preset.value ? ' is-active' : ''}`}
          onClick={() => onChoose(preset.value)}
          aria-pressed={value === preset.value}
        >
          <span className="preset__name">{preset.label}</span>
          <span className="preset__detail">{preset.detail}</span>
        </button>
      ))}
    </div>
  );
}
