import { useEffect, useRef } from 'react';

/**
 * Closes a popover on a click outside it or on Escape. Returns the ref to put
 * on the element that counts as "inside".
 */
export function useDismissable(open, onDismiss) {
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const onClick = (e) => {
      if (!ref.current?.contains(e.target)) onDismiss();
    };
    const onKey = (e) => {
      if (e.key === 'Escape') onDismiss();
    };

    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onDismiss]);

  return ref;
}
