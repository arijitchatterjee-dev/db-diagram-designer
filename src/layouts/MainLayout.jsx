import { useCallback, useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../components/layout/Sidebar';
import Header from '../components/layout/Header';
import { HeaderSlotContext } from '../components/layout/headerSlot';

const STORAGE_KEY = 'schema-designer:sidebar';

export default function MainLayout() {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'collapsed';
    } catch {
      return false;
    }
  });
  const [mobileOpen, setMobileOpen] = useState(false);

  // A callback ref rather than useRef: it re-renders once the node exists, so
  // the portal has somewhere to go on the page's first paint.
  const [slot, setSlot] = useState(null);

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
        <Header onOpenNav={() => setMobileOpen(true)} slotRef={setSlot} />

        <HeaderSlotContext.Provider value={slot}>
          <Outlet />
        </HeaderSlotContext.Provider>
      </div>
    </div>
  );
}
