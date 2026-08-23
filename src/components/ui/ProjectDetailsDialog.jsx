import { useState } from 'react';
import { CircleNotch, PencilSimple, WarningCircle } from '@phosphor-icons/react';

/** Renames a project and edits its description. */
export default function ProjectDetailsDialog({ project, busy, error, onSave, onCancel }) {
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description || '');

  const trimmed = name.trim();
  const unchanged = trimmed === project.name && description.trim() === (project.description || '');

  function handleSubmit(e) {
    e.preventDefault();
    if (!trimmed || unchanged) return;
    onSave({ name: trimmed, description: description.trim() });
  }

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Project details">
      <form className="dialog" onSubmit={handleSubmit}>
        <span className="dialog__icon dialog__icon--neutral">
          <PencilSimple size={17} weight="bold" />
        </span>

        <h2 className="dialog__title">Project details</h2>
        <p className="dialog__body">The name and description shown on your dashboard.</p>

        <div className="field">
          <label htmlFor="details-name">Name</label>
          <div className="field__wrap">
            <input
              id="details-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
              autoFocus
              required
            />
          </div>
        </div>

        <div className="field">
          <label htmlFor="details-desc">Description</label>
          <div className="field__wrap">
            <input
              id="details-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              placeholder="Optional"
            />
          </div>
        </div>

        {error && (
          <p className="alert alert--error" role="alert">
            <WarningCircle size={15} weight="fill" />
            {error}
          </p>
        )}

        <div className="dialog__actions">
          <button type="button" className="btn" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary" disabled={busy || !trimmed || unchanged}>
            {busy && <CircleNotch size={14} weight="bold" className="spin" />}
            Save changes
          </button>
        </div>
      </form>
    </div>
  );
}
