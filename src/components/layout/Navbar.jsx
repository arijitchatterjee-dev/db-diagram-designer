import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CaretDown, Database, SignOut } from '@phosphor-icons/react';
import { useAuthStore } from '../../store/useAuthStore';

export default function Navbar({ children }) {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const menu = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onClick = (e) => {
      if (!menu.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <header className="navbar">
      <Link to="/" className="brand" aria-label="Schema Designer home">
        <span className="brand__mark">
          <Database size={15} weight="fill" />
        </span>
        <span className="brand__text">Schema Designer</span>
      </Link>

      <div className="navbar__slot">{children}</div>

      {user && (
        <div className="account" ref={menu}>
          <button
            type="button"
            className="account__trigger"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-haspopup="menu"
          >
            <span className="account__avatar" aria-hidden="true">
              {user.username.slice(0, 1).toUpperCase()}
            </span>
            <span className="account__name">{user.username}</span>
            <CaretDown size={11} weight="bold" />
          </button>

          {open && (
            <div className="account__menu" role="menu">
              <p className="account__email" title={user.email}>
                {user.email}
              </p>
              <button type="button" className="account__item" onClick={handleLogout} role="menuitem">
                <SignOut size={14} weight="bold" />
                Log out
              </button>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
