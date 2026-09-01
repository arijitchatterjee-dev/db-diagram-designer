import { NavLink } from 'react-router-dom';
import { Compass, Table } from '@phosphor-icons/react';

/**
 * The two halves of a project. Plan answers "what am I building and with
 * what"; Schema answers "what do the tables look like". Same project id on
 * both sides, so this is a route change rather than a reload.
 */
export default function ProjectTabs({ projectId }) {
  return (
    <nav className="tabs" aria-label="Project views">
      <NavLink
        to={`/project/${projectId}/plan`}
        className={({ isActive }) => `tabs__tab${isActive ? ' is-active' : ''}`}
      >
        <Compass size={14} weight="bold" />
        Plan
      </NavLink>
      <NavLink
        to={`/project/${projectId}`}
        end
        className={({ isActive }) => `tabs__tab${isActive ? ' is-active' : ''}`}
      >
        <Table size={14} weight="bold" />
        Schema
      </NavLink>
    </nav>
  );
}
