import { NavLink } from 'react-router-dom';
import { Blueprint, Compass, Table } from '@phosphor-icons/react';

/**
 * The three views of a project. Plan answers "what am I building and with
 * what"; Architecture answers "how is it arranged"; Schema answers "what do
 * the tables look like". Same project id throughout, so these are route
 * changes rather than reloads.
 */
export default function ProjectTabs({ projectId }) {
  return (
    <nav className="tabs" aria-label="Project views">
      <NavLink
        to={`/project/${projectId}/plan`}
        end
        className={({ isActive }) => `tabs__tab${isActive ? ' is-active' : ''}`}
      >
        <Compass size={14} weight="bold" />
        Plan
      </NavLink>
      <NavLink
        to={`/project/${projectId}/architecture`}
        className={({ isActive }) => `tabs__tab${isActive ? ' is-active' : ''}`}
      >
        <Blueprint size={14} weight="bold" />
        Architecture
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
