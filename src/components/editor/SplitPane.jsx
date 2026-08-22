import { useCallback, useEffect, useRef, useState } from 'react';

const MIN = 22; // percent
const MAX = 68;
const STORAGE_KEY = 'schema-designer:split';

function clamp(value) {
  return Math.min(MAX, Math.max(MIN, value));
}

/**
 * Two panes with a draggable divider. The ratio is remembered per browser, so
 * someone who prefers a wide editor gets it back on the next project too.
 */
export default function SplitPane({ left, right }) {
  const container = useRef(null);
  const [ratio, setRatio] = useState(() => {
    // Storage can throw outright in a locked-down browser, so never assume it.
    try {
      const stored = Number(localStorage.getItem(STORAGE_KEY));
      return Number.isFinite(stored) && stored >= MIN && stored <= MAX ? stored : 38;
    } catch {
      return 38;
    }
  });
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(ratio));
    } catch {
      /* a remembered pane width is not worth breaking the editor over */
    }
  }, [ratio]);

  const applyFromPointer = useCallback((clientX) => {
    const box = container.current?.getBoundingClientRect();
    if (!box || box.width === 0) return;
    setRatio(clamp(((clientX - box.left) / box.width) * 100));
  }, []);

  useEffect(() => {
    if (!dragging) return undefined;

    const onMove = (e) => applyFromPointer(e.clientX);
    const onUp = () => setDragging(false);

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    // Stop the canvas and editor from selecting text mid-drag.
    document.body.classList.add('is-resizing');

    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      document.body.classList.remove('is-resizing');
    };
  }, [dragging, applyFromPointer]);

  const onKeyDown = (e) => {
    if (e.key === 'ArrowLeft') setRatio((r) => clamp(r - 2));
    else if (e.key === 'ArrowRight') setRatio((r) => clamp(r + 2));
    else return;
    e.preventDefault();
  };

  return (
    <div
      className="split"
      ref={container}
      // Three tracks for three children: pane, divider, pane. Two tracks would
      // wrap the second pane onto a new row.
      style={{ gridTemplateColumns: `${ratio}% auto 1fr` }}
    >
      <section className="split__pane">{left}</section>

      <div
        className={`split__handle${dragging ? ' is-dragging' : ''}`}
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize editor"
        aria-valuenow={Math.round(ratio)}
        aria-valuemin={MIN}
        aria-valuemax={MAX}
        tabIndex={0}
        onPointerDown={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDoubleClick={() => setRatio(38)}
        onKeyDown={onKeyDown}
      >
        <span className="split__grip" aria-hidden="true" />
      </div>

      <section className="split__pane">{right}</section>
    </div>
  );
}
