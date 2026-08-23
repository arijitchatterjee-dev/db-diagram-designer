import { useEffect, useRef, useState } from 'react';
import { PencilSimple } from '@phosphor-icons/react';

/**
 * The project name in the editor header. Reads as text until you click it, so
 * the header still looks like a title bar rather than a form — but renaming
 * doesn't mean going back to the dashboard.
 */
export default function EditableTitle({ value, onChange }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const input = useRef(null);

  useEffect(() => {
    if (editing) {
      input.current?.focus();
      input.current?.select();
    }
  }, [editing]);

  function start() {
    setDraft(value);
    setEditing(true);
  }

  function commit() {
    const name = draft.trim();
    // An empty name would be rejected by the API anyway; treat it as a cancel.
    if (name && name !== value) onChange(name);
    setEditing(false);
  }

  if (!editing) {
    return (
      <button type="button" className="doc-title doc-title--button" onClick={start} title="Rename project">
        <span className="doc-title__text">{value}</span>
        <PencilSimple size={12} weight="bold" className="doc-title__pencil" />
      </button>
    );
  }

  return (
    <input
      ref={input}
      className="doc-title doc-title--input"
      value={draft}
      maxLength={120}
      aria-label="Project name"
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit();
        if (e.key === 'Escape') setEditing(false);
      }}
    />
  );
}
