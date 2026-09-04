import { List } from '@phosphor-icons/react';

export default function Header({ onOpenNav, slotRef }) {
  return (
    <header className="topbar">
      <button
        type="button"
        className="topbar__burger"
        onClick={onOpenNav}
        aria-label="Open navigation"
      >
        <List size={16} weight="bold" />
      </button>

      <div className="topbar__slot" ref={slotRef} />
    </header>
  );
}
