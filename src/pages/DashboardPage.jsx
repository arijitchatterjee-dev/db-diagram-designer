import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Compass,
  MagnifyingGlass,
  Plus,
  Table,
  WarningCircle,
  X,
} from '@phosphor-icons/react';
import Navbar from '../components/layout/Navbar';
import CardMenu from '../components/ui/CardMenu';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import ProjectDetailsDialog from '../components/ui/ProjectDetailsDialog';
import * as projectApi from '../api/projectApi';
import { apiErrorMessage } from '../api/axiosInstance';
import { absoluteTime, relativeTime } from '../utils/formatTime';

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
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
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

  useEffect(() => {
    let cancelled = false;
    projectApi
      .listProjects()
      .then((list) => !cancelled && setProjects(list))
      .catch((err) => !cancelled && setError(apiErrorMessage(err, 'Could not load your projects')))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (showForm) nameInput.current?.focus();
  }, [showForm]);

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
      setProjects((list) => [
        { ...copy, tableCount: project.tableCount },
        ...list,
      ]);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not duplicate the project'));
    }
  }

  async function handleSaveDetails(changes) {
    setSavingDetails(true);
    setDetailsError(null);
    try {
      const updated = await projectApi.updateProject(editing._id, changes);
      setProjects((list) =>
        list.map((p) =>
          p._id === updated._id
            ? { ...p, name: updated.name, description: updated.description, updatedAt: updated.updatedAt }
            : p
        )
      );
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
      setProjects((list) => list.filter((p) => p._id !== pendingDelete._id));
      setPendingDelete(null);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not delete the project'));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="app-shell">
      <Navbar />

      <main className="dash">
        <header className="dash__head">
          <div>
            <h1>Projects</h1>
            <p className="dash__sub">
              {loading
                ? 'Loading your schemas'
                : `${projects.length} ${projects.length === 1 ? 'schema' : 'schemas'}, visible only to you`}
            </p>
          </div>

          <div className="dash__actions">
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
              className="btn btn--primary"
              onClick={() => setShowForm((v) => !v)}
            >
              {showForm ? <X size={15} weight="bold" /> : <Plus size={15} weight="bold" />}
              {showForm ? 'Cancel' : 'New project'}
            </button>
          </div>
        </header>

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

        {loading && (
          <ul className="cards" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <li key={i} className="card card--skeleton">
                <span className="sk sk--title" />
                <span className="sk sk--line" />
                <span className="sk sk--meta" />
              </li>
            ))}
          </ul>
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
            <button type="button" className="btn btn--primary" onClick={() => setShowForm(true)}>
              <Plus size={15} weight="bold" />
              Create your first project
            </button>
          </section>
        )}

        {!loading && projects.length > 0 && visible.length === 0 && (
          <p className="dash__none">Nothing matches &ldquo;{query}&rdquo;.</p>
        )}

        {visible.length > 0 && (
          <ul className="cards">
            {visible.map((project) => (
              <li key={project._id} className="card">
                <Link to={`/project/${project._id}`} className="card__link">
                  <h3 className="card__title">{project.name}</h3>
                  {project.description ? (
                    <p className="card__desc">{project.description}</p>
                  ) : (
                    <p className="card__desc card__desc--empty">No description</p>
                  )}

                  <p className="card__meta">
                    <span className="chip">
                      <Table size={11} weight="bold" />
                      {project.tableCount ?? 0} {project.tableCount === 1 ? 'table' : 'tables'}
                    </span>
                    {project.hasPlan && (
                      <span className={`chip chip--plan is-${project.planStatus}`}>
                        <Compass size={11} weight="bold" />
                        {PLAN_STATUS_LABEL[project.planStatus] ?? 'Plan'}
                      </span>
                    )}
                    <time dateTime={project.updatedAt} title={absoluteTime(project.updatedAt)}>
                      {relativeTime(project.updatedAt)}
                    </time>
                  </p>

                  <span className="card__go" aria-hidden="true">
                    <ArrowRight size={14} weight="bold" />
                  </span>
                </Link>

                {/* Outside the card link: a nested anchor would be invalid markup. */}
                <Link to={`/project/${project._id}/plan`} className="card__plan">
                  <Compass size={12} weight="bold" />
                  {project.hasPlan ? 'Open plan' : 'Plan it'}
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
              </li>
            ))}
          </ul>
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
    </div>
  );
}
