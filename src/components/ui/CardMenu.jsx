import { useCallback, useState } from 'react';
import { Copy, DotsThree, PencilSimple, Trash } from '@phosphor-icons/react';
import { useDismissable } from '../../utils/useDismissable';

/** Per-project actions on a dashboard card. */
export default function CardMenu({ label, onRename, onDuplicate, onDelete }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const menu = useDismissable(open, close);

  function run(action) {
    close();
    action();
  }

  return (
    <div className="card__menu menu" ref={menu}>
      <button
        type="button"
        className="card__menu-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Actions for ${label}`}
      >
        <DotsThree size={16} weight="bold" />
      </button>

      {open && (
        <div className="menu__panel menu__panel--compact" role="menu">
          <button type="button" className="menu__item" role="menuitem" onClick={() => run(onRename)}>
            <span className="menu__icon">
              <PencilSimple size={14} weight="bold" />
            </span>
            Rename
          </button>
          <button type="button" className="menu__item" role="menuitem" onClick={() => run(onDuplicate)}>
            <span className="menu__icon">
              <Copy size={14} weight="bold" />
            </span>
            Duplicate
          </button>
          <button
            type="button"
            className="menu__item menu__item--danger"
            role="menuitem"
            onClick={() => run(onDelete)}
          >
            <span className="menu__icon">
              <Trash size={14} weight="bold" />
            </span>
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
