import { Check, CircleNotch, X } from '@phosphor-icons/react';
import { ANSWERS, labelFor, PRESETS, STATUSES } from '../../engine/planOptions';

const FIELD_LABELS = {
  context: 'The product',
  goal: 'Version one scope',
  moduleKeys: 'Modules',
  presetKey: 'Project type',
  status: 'Status',
};

/** Turns a stored path into something a person reads without decoding it. */
function labelFor_(row) {
  if (row.path.startsWith('answers.')) {
    const key = row.path.slice('answers.'.length);
    return ANSWERS[key]?.label ?? key;
  }
  return FIELD_LABELS[row.path] ?? row.label ?? row.path;
}

/** And the same for a value, which is stored as the engine's key. */
function valueFor(row, raw) {
  if (!raw) return null;
  if (row.path.startsWith('answers.')) {
    const key = row.path.slice('answers.'.length);
    return ANSWERS[key]?.options.find((o) => o.value === raw)?.label ?? raw;
  }
  if (row.path === 'presetKey') return labelFor(PRESETS, raw);
  if (row.path === 'status') return labelFor(STATUSES, raw);
  return raw;
}

/**
 * What the assistant wants to change, and the two buttons that decide it.
 *
 * The model never writes to the plan. It proposes, this shows the proposal as
 * a diff, and nothing happens until you say so — which is what keeps the plan
 * something you can still trust as a record of your own decisions.
 */
export default function ProposalCard({ message, busy, onApply, onDiscard }) {
  const settled = message.status === 'applied' || message.status === 'discarded';

  return (
    <div className={`prop prop--${message.status}`}>
      <div className="prop__head">
        <span className="prop__count">
          {message.diff.length} {message.diff.length === 1 ? 'change' : 'changes'}
        </span>
        {settled && <span className="prop__state">{message.status}</span>}
      </div>

      <ul className="prop__rows">
        {message.diff.map((row) => (
          <li key={row.path}>
            <span className="prop__field">{labelFor_(row)}</span>
            <span className="prop__vals">
              {valueFor(row, row.from) ? (
                <span className="prop__from">{valueFor(row, row.from)}</span>
              ) : (
                <span className="prop__from prop__from--none">not set</span>
              )}
              <span className="prop__arrow" aria-hidden="true">
                →
              </span>
              <span className="prop__to">{valueFor(row, row.to) ?? '—'}</span>
            </span>
          </li>
        ))}
      </ul>

      {message.reason && <p className="prop__why">{message.reason}</p>}

      {!settled && (
        <div className="prop__acts">
          <button type="button" className="prop__discard" onClick={onDiscard} disabled={busy}>
            <X size={13} weight="bold" />
            Discard
          </button>
          <button type="button" className="prop__apply" onClick={onApply} disabled={busy}>
            {busy ? (
              <CircleNotch size={13} weight="bold" className="spin" />
            ) : (
              <Check size={13} weight="bold" />
            )}
            Apply
          </button>
        </div>
      )}
    </div>
  );
}
