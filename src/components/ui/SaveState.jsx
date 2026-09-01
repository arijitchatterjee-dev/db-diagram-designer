import { CheckCircle, CircleNotch } from '@phosphor-icons/react';

/** Shared by the schema editor and the plan document, which autosave alike. */
export default function SaveState({ saving, dirty, lastSavedAt }) {
  if (saving) {
    return (
      <span className="state state--busy">
        <CircleNotch size={13} weight="bold" className="spin" />
        Saving
      </span>
    );
  }
  if (dirty) {
    return (
      <span className="state state--dirty">
        <span className="state__dot" aria-hidden="true" />
        Unsaved
      </span>
    );
  }
  return (
    <span className="state">
      <CheckCircle size={13} weight="fill" />
      {lastSavedAt ? 'Saved' : 'Up to date'}
    </span>
  );
}
