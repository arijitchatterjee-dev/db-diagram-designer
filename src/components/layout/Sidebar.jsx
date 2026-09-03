import { useCallback, useEffect, useState } from 'react';
import { Link, NavLink, useNavigate, useParams } from 'react-router-dom';
import {
  Blueprint,
  CaretDown,
  Compass,
  Database,
  Plus,
  SidebarSimple,
  SignOut,
  SquaresFour,
  Table,
  X,
} from '@phosphor-icons/react';
import { useAuthStore } from '../../store/useAuthStore';
import { useProjectsStore } from '../../store/useProjectsStore';
import { useDismissable } from '../../utils/useDismissable';

const RECENT = 6;

/**
 * The app's navigation.
 *
 * Two levels: your projects, and the three views of whichever one is open.
 * Those views used to be tabs in the top bar; here they sit under the project
 * they belong to, which is where they actually live in the model.
 *
 * Collapsed it keeps the icons, so the diagram editor can have its width back
 * without losing the ability to move around.
 */
export default function Sidebar({ collapsed, onToggle, mobileOpen, onCloseMobile }) {
  const { id: openProjectId } = useParams();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const projects = useProjectsStore((s) => s.projects);
  const load = useProjectsStore((s) => s.load);
  const navigate = useNavigate();

  const [menuOpen, setMenuOpen] = useState(false);
  const menu = useDismissable(menuOpen, useCallback(() => setMenuOpen(false), []));

  useEffect(() => {
    load();
  }, [load]);

  // Escape closes the mobile drawer, matching every other overlay in the app.
  useEffect(() => {
    if (!mobileOpen) return undefined;
    const onKey = (e) => e.key === 'Escape' && onCloseMobile();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mobileOpen, onCloseMobile]);

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  const open = projects.find((p) => p._id === openProjectId);
  // The open project always has a row, even if the list has not arrived yet.
  const recent = projects.filter((p) => p._id !== openProjectId).slice(0, RECENT);

  const item = ({ isActive }) => `snav__item${isActive ? ' is-active' : ''}`;

  return (
    <>
      {mobileOpen && <div className="sidebar__scrim" onClick={onCloseMobile} aria-hidden="true" />}

      <aside
        className={`sidebar${collapsed ? ' is-collapsed' : ''}${mobileOpen ? ' is-open' : ''}`}
        aria-label="Main navigation"
      >
        <div className="sidebar__head">
          <Link to="/" className="brand sidebar__hide" title="Schema Designer">
            <span className="brand__mark">
              <Database size={15} weight="fill" />
            </span>
            <span className="brand__text">Schema Designer</span>
          </Link>

          {/* Never hidden when collapsed: it is the only way back out. */}
          <button
            type="button"
            className="sidebar__collapse"
            onClick={onToggle}
            aria-label={collapsed ? 'Expand the sidebar' : 'Collapse the sidebar'}
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            <SidebarSimple size={15} weight="bold" />
          </button>

          <button
            type="button"
            className="sidebar__closemobile"
            onClick={onCloseMobile}
            aria-label="Close navigation"
          >
            <X size={15} weight="bold" />
          </button>
        </div>

        <nav className="sidebar__body">
          <NavLink to="/" end className={item} onClick={onCloseMobile} title="Projects">
            <span className="snav__icon">
              <SquaresFour size={15} weight="bold" />
            </span>
            <span className="sidebar__hide">Projects</span>
          </NavLink>

          {open && (
            <div className="snav__group">
              <p className="snav__label sidebar__hide">Open</p>
              <p className="snav__project sidebar__hide" title={open.name}>
                {open.name}
              </p>

              <NavLink to={`/project/${open._id}/plan`} end className={item} onClick={onCloseMobile} title="Plan">
                <span className="snav__icon">
                  <Compass size={15} weight="bold" />
                </span>
                <span className="sidebar__hide">Plan</span>
              </NavLink>
              <NavLink
                to={`/project/${open._id}/architecture`}
                className={item}
                onClick={onCloseMobile}
                title="Architecture"
              >
                <span className="snav__icon">
                  <Blueprint size={15} weight="bold" />
                </span>
                <span className="sidebar__hide">Architecture</span>
              </NavLink>
              <NavLink to={`/project/${open._id}`} end className={item} onClick={onCloseMobile} title="Schema">
                <span className="snav__icon">
                  <Table size={15} weight="bold" />
                </span>
                <span className="sidebar__hide">Schema</span>
              </NavLink>
            </div>
          )}

          {recent.length > 0 && (
            <div className="snav__group">
              <p className="snav__label sidebar__hide">{open ? 'Other projects' : 'Recent'}</p>
              {recent.map((project) => (
                <NavLink
                  key={project._id}
                  to={`/project/${project._id}/plan`}
                  className={item}
                  onClick={onCloseMobile}
                  title={project.name}
                >
                  <span className="snav__icon snav__icon--dot" aria-hidden="true">
                    {project.name.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="sidebar__hide snav__truncate">{project.name}</span>
                </NavLink>
              ))}
            </div>
          )}

          <Link to="/?new=1" className="snav__item snav__item--quiet" onClick={onCloseMobile} title="New project">
            <span className="snav__icon">
              <Plus size={15} weight="bold" />
            </span>
            <span className="sidebar__hide">New project</span>
          </Link>
        </nav>

        {user && (
          <div className="sidebar__foot" ref={menu}>
            <button
              type="button"
              className="account__trigger"
              onClick={() => setMenuOpen((v) => !v)}
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              title={user.username}
            >
              <span className="account__avatar" aria-hidden="true">
                {user.username.slice(0, 1).toUpperCase()}
              </span>
              <span className="account__name sidebar__hide">{user.username}</span>
              <CaretDown size={11} weight="bold" className="sidebar__hide" />
            </button>

            {menuOpen && (
              <div className="account__menu account__menu--up" role="menu">
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
      </aside>
    </>
  );
}
