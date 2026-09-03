import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowRight,
  Compass,
  MagnifyingGlass,
  Plus,
  Table,
  WarningCircle,
  X,
} from '@phosphor-icons/react';
import AppShell from '../components/layout/AppShell';
import CardMenu from '../components/ui/CardMenu';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import ProjectDetailsDialog from '../components/ui/ProjectDetailsDialog';
import * as projectApi from '../api/projectApi';
import { apiErrorMessage } from '../api/axiosInstance';
import { absoluteTime, relativeTime } from '../utils/formatTime';
import { useProjectsStore } from '../store/useProjectsStore';

const PLAN_STATUS_LABEL = {
  draft: 'Draft',
  planned: 'Planned',
  building: 'Building',
};

const SORTS = {
  updated: { label: 'Last edited', compare: (a, b) => b.updatedAt.localeCompare(a.updatedAt) },
  name: { label: 'Name', compare: (a, b) => a.name.localeCompare(b.name) },
  tables: { label: 'Table count', compare: (a, b) => (b.tableCount ?? 0) - (a.tableCount ?? 0) },
};

export default function DashboardPage() {
  const projects = useProjectsStore((s) => s.projects);
  const loading = useProjectsStore((s) => s.loading);
  const loadProjects = useProjectsStore((s) => s.load);
  const upsertProject = useProjectsStore((s) => s.upsert);
  const removeProject = useProjectsStore((s) => s.remove);

  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('updated');

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', description: '' });
  const [creating, setCreating] = useState(false);

  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const [editing, setEditing] = useState(null);
  const [savingDetails, setSavingDetails] = useState(false);
  const [detailsError, setDetailsError] = useState(null);

  const nameInput = useRef(null);
  const navigate = useNavigate();

  const [params, setParams] = useSearchParams();

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  // The sidebar's "New project" link lands here with the form already open.
  useEffect(() => {
    if (params.get('new') === '1') {
      setShowForm(true);
      setParams({}, { replace: true });
    }
  }, [params, setParams]);

  useEffect(() => {
    if (showForm) nameInput.current?.focus();
  }, [showForm]);

  // Three numbers you cannot get anywhere else in the app without counting.
  const totals = useMemo(
    () => ({
      projects: projects.length,
      tables: projects.reduce((sum, p) => sum + (p.tableCount ?? 0), 0),
      planned: projects.filter((p) => p.hasPlan).length,
    }),
    [projects]
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matched = q
      ? projects.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            (p.description || '').toLowerCase().includes(q)
        )
      : projects;
    return [...matched].sort(SORTS[sort].compare);
  }, [projects, query, sort]);

  async function handleCreate(e) {
    e.preventDefault();
    if (!form.name.trim()) return;

    setCreating(true);
    setError(null);
    try {
      const project = await projectApi.createProject(form);
      navigate(`/project/${project._id}`);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not create the project'));
      setCreating(false);
    }
  }

  async function handleDuplicate(project) {
    setError(null);
    try {
      const copy = await projectApi.duplicateProject(project._id);
      // The API returns the full copy; the list only needs the card fields.
      upsertProject({ ...copy, tableCount: project.tableCount });
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not duplicate the project'));
    }
  }

  async function handleSaveDetails(changes) {
    setSavingDetails(true);
    setDetailsError(null);
    try {
      const updated = await projectApi.updateProject(editing._id, changes);
      upsertProject({
        _id: updated._id,
        name: updated.name,
        description: updated.description,
        updatedAt: updated.updatedAt,
      });
      setEditing(null);
    } catch (err) {
      setDetailsError(apiErrorMessage(err, 'Could not save the changes'));
    } finally {
      setSavingDetails(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await projectApi.deleteProject(pendingDelete._id);
      removeProject(pendingDelete._id);
      setPendingDelete(null);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not delete the project'));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <AppShell
      topbar={
        <>
          <h1 className="topbar__title">Projects</h1>
          <span className="topbar__count">
            {loading ? '' : projects.length}
          </span>

          <span className="topbar__spacer" />

          {projects.length > 3 && (
            <>
              <div className="search">
                <MagnifyingGlass size={14} weight="bold" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Filter projects"
                  aria-label="Filter projects"
                />
                {query && (
                  <button type="button" onClick={() => setQuery('')} aria-label="Clear filter">
                    <X size={12} weight="bold" />
                  </button>
                )}
              </div>
              <select
                className="select select--inline"
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                aria-label="Sort projects"
              >
                {Object.entries(SORTS).map(([id, option]) => (
                  <option key={id} value={id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </>
          )}
          <button
            type="button"
            className="btn btn--primary btn--sm"
            onClick={() => setShowForm((v) => !v)}
          >
            {showForm ? <X size={14} weight="bold" /> : <Plus size={14} weight="bold" />}
            {showForm ? 'Cancel' : 'New project'}
          </button>
        </>
      }
    >
      <main className="dash">
        {error && (
          <p className="alert alert--error" role="alert">
            <WarningCircle size={15} weight="fill" />
            {error}
          </p>
        )}

        {showForm && (
          <form className="creator" onSubmit={handleCreate}>
            <div className="field">
              <label htmlFor="new-name">Project name</label>
              <div className="field__wrap">
                <input
                  id="new-name"
                  ref={nameInput}
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Blog schema"
                  required
                />
              </div>
            </div>
            <div className="field">
              <label htmlFor="new-desc">Description</label>
              <div className="field__wrap">
                <input
                  id="new-desc"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Optional"
                />
              </div>
            </div>
            <button type="submit" className="btn btn--primary" disabled={creating}>
              {creating ? 'Creating' : 'Create project'}
            </button>
          </form>
        )}

        {!loading && projects.length > 0 && (
          <div className="dstat">
            <div className="dstat__cell">
              <span className="dstat__n">{totals.projects}</span>
              <span className="dstat__k">Projects</span>
            </div>
            <div className="dstat__cell">
              <span className="dstat__n">{totals.tables}</span>
              <span className="dstat__k">Tables</span>
            </div>
            <div className="dstat__cell">
              <span className="dstat__n">{totals.planned}</span>
              <span className="dstat__k">With a plan</span>
            </div>
          </div>
        )}

        {loading && (
          <div className="ptray" aria-hidden="true">
            <ul className="plist">
              {[0, 1, 2, 3].map((i) => (
                <li key={i} className="prow prow--skeleton">
                  <span className="sk sk--mark" />
                  <span className="sk sk--title" />
                  <span className="sk sk--meta" />
                </li>
              ))}
            </ul>
          </div>
        )}

        {!loading && projects.length === 0 && (
          <section className="blank">
            <span className="blank__icon">
              <Table size={22} weight="duotone" />
            </span>
            <h2>No projects yet</h2>
            <p>
              A new project opens with a small sample schema, so there is something on the
              canvas from the first second.
            </p>
            <button
              type="button"
              className="btn btn--primary btn--cta"
              onClick={() => setShowForm(true)}
            >
              Create your first project
              <span className="btn__well" aria-hidden="true">
                <ArrowRight size={15} weight="bold" />
              </span>
            </button>
          </section>
        )}

        {!loading && projects.length > 0 && visible.length === 0 && (
          <p className="dash__none">Nothing matches &ldquo;{query}&rdquo;.</p>
        )}

        {visible.length > 0 && (
          <div className="ptray">
            <ul className="plist">
              {visible.map((project, i) => (
                <li
                  key={project._id}
                  className="prow prow--in"
                  style={{ '--i': Math.min(i, 8) }}
                >
                  {/* The link's ::after covers the row, so anywhere that is not a
                      control opens the project. Nesting the controls inside the
                      anchor instead would be invalid markup. */}
                  <Link to={`/project/${project._id}`} className="prow__main">
                    <span className="prow__mark" aria-hidden="true">
                      {project.name.slice(0, 1).toUpperCase()}
                    </span>
                    <span className="prow__text">
                      <span className="prow__name">{project.name}</span>
                      {project.description && (
                        <span className="prow__desc">{project.description}</span>
                      )}
                    </span>
                  </Link>

                  <span className="prow__chips">
                    <span className="chip">
                      <Table size={11} weight="bold" />
                      {project.tableCount ?? 0}
                    </span>
                    {project.hasPlan && (
                      <span className={`chip chip--plan is-${project.planStatus}`}>
                        <Compass size={11} weight="bold" />
                        {PLAN_STATUS_LABEL[project.planStatus] ?? 'Plan'}
                      </span>
                    )}
                  </span>

                  <time
                    className="prow__time"
                    dateTime={project.updatedAt}
                    title={absoluteTime(project.updatedAt)}
                  >
                    {relativeTime(project.updatedAt)}
                  </time>

                  <span className="prow__actions">
                    <Link to={`/project/${project._id}/plan`} className="prow__plan">
                      <Compass size={13} weight="bold" />
                      {project.hasPlan ? 'Plan' : 'Plan it'}
                    </Link>

                    <CardMenu
                      label={project.name}
                      onRename={() => {
                        setDetailsError(null);
                        setEditing(project);
                      }}
                      onDuplicate={() => handleDuplicate(project)}
                      onDelete={() => setPendingDelete(project)}
                    />
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </main>

      {editing && (
        <ProjectDetailsDialog
          project={editing}
          busy={savingDetails}
          error={detailsError}
          onSave={handleSaveDetails}
          onCancel={() => setEditing(null)}
        />
      )}

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        busy={deleting}
        title={`Delete ${pendingDelete?.name ?? ''}?`}
        body="This removes the schema and its layout for good. There is no undo."
        onConfirm={handleDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </AppShell>
  );
}
