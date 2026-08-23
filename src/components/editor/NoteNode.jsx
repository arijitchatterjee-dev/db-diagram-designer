import { memo, useEffect, useRef, useState } from 'react';
import { Trash } from '@phosphor-icons/react';

const PLACEHOLDER = 'Write a note…';

/**
 * A sticky note on the canvas. Click the body to type; the drag handle is the
 * top strip, so editing text and moving the note never fight each other.
 */
function NoteNode({ id, data, selected }) {
  const { text, onChange, onDelete, autoFocus } = data;
  const [editing, setEditing] = useState(autoFocus);
  const [draft, setDraft] = useState(text);
  const area = useRef(null);

  // Another session or an undo can change the text underneath us.
  useEffect(() => {
    if (!editing) setDraft(text);
  }, [text, editing]);

  useEffect(() => {
    if (editing) {
      area.current?.focus();
      area.current?.setSelectionRange(draft.length, draft.length);
    }
    // Only on entering edit mode — re-running on every keystroke would fight
    // the caret.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  function commit() {
    setEditing(false);
    if (draft !== text) onChange(draft);
  }

  return (
    <div className={`note-node${selected ? ' is-selected' : ''}`}>
      <div className="note-node__grip" title="Drag to move">
        <span className="note-node__grip-dots" aria-hidden="true" />
        <button
          type="button"
          className="note-node__delete nodrag"
          onClick={() => onDelete(id)}
          aria-label="Delete note"
          title="Delete note"
        >
          <Trash size={12} weight="bold" />
        </button>
      </div>

      {editing ? (
        <textarea
          ref={area}
          className="note-node__input nodrag nowheel"
          value={draft}
          maxLength={2000}
          placeholder={PLACEHOLDER}
          aria-label="Note text"
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setDraft(text);
              setEditing(false);
            }
          }}
        />
      ) : (
        <button
          type="button"
          className={`note-node__body nodrag${text ? '' : ' is-empty'}`}
          onClick={() => setEditing(true)}
        >
          {text || PLACEHOLDER}
        </button>
      )}
    </div>
  );
}

export default memo(NoteNode);
