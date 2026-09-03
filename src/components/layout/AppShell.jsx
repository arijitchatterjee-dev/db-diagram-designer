import { useCallback, useEffect, useState } from 'react';
import { List } from '@phosphor-icons/react';
import Sidebar from './Sidebar';

const STORAGE_KEY = 'schema-designer:sidebar';

/**
 * Sidebar plus a content column, which every signed-in page sits inside.
 *
 * The top bar is now only what the page itself is doing: its title and its
 * actions. Navigation moved to the sidebar, so the bar stops being a place
 * where those two unrelated things compete for the same row.
 */
export default function AppShell({ topbar, children }) {
  const [collapsed, setCollapsed] = useState(() => {
    // Storage can throw outright in a locked-down browser, so never assume it.
    try {
      return localStorage.getItem(STORAGE_KEY) === 'collapsed';
    } catch {
      return false;
    }
  });
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, collapsed ? 'collapsed' : 'open');
    } catch {
      /* a remembered sidebar width is not worth breaking navigation over */
    }
  }, [collapsed]);

  const closeMobile = useCallback(() => setMobileOpen(false), []);

  return (
    <div className={`shell${collapsed ? ' is-collapsed' : ''}`}>
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed((v) => !v)}
        mobileOpen={mobileOpen}
        onCloseMobile={closeMobile}
      />

      <div className="shell__main">
        <header className="topbar">
          <button
            type="button"
            className="topbar__burger"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
          >
            <List size={16} weight="bold" />
          </button>
          {topbar}
        </header>

        {children}
      </div>
    </div>
  );
}
