import { useEffect, useRef } from 'react';
import { WarningCircle } from '@phosphor-icons/react';

/**
 * Replaces window.confirm for destructive actions, so the wording and the
 * emphasis (cancel is the safe default and gets focus) are ours.
 */
export default function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = 'Delete',
  busy = false,
  onConfirm,
  onCancel,
}) {
  const cancelRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    cancelRef.current?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape' && !busy) onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, busy, onCancel]);

  if (!open) return null;

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && !busy && onCancel()}>
      <div className="dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title">
        <span className="dialog__icon">
          <WarningCircle size={18} weight="fill" />
        </span>
        <h2 className="dialog__title" id="confirm-title">
          {title}
        </h2>
        <p className="dialog__body">{body}</p>
        <div className="dialog__actions">
          <button type="button" className="btn" onClick={onCancel} disabled={busy} ref={cancelRef}>
            Cancel
          </button>
          <button type="button" className="btn btn--danger" onClick={onConfirm} disabled={busy}>
            {busy ? 'Deleting' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
