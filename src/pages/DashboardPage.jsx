import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Navbar from '../components/layout/Navbar';
import * as projectApi from '../api/projectApi';
import { apiErrorMessage } from '../api/axiosInstance';

function formatDate(value) {
  if (!value) return '';
  return new Date(value).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export default function DashboardPage() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', description: '' });
  const [showForm, setShowForm] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    projectApi
      .listProjects()
      .then((list) => {
        if (!cancelled) setProjects(list);
      })
      .catch((err) => {
        if (!cancelled) setError(apiErrorMessage(err, 'Could not load your projects'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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

  async function handleDelete(project) {
    const confirmed = window.confirm(
      `Delete "${project.name}"? This permanently removes its schema and cannot be undone.`
    );
    if (!confirmed) return;

    try {
      await projectApi.deleteProject(project._id);
      setProjects((list) => list.filter((p) => p._id !== project._id));
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not delete the project'));
    }
  }

  return (
    <div className="app-shell">
      <Navbar />

      <main className="dashboard">
        <div className="dashboard__head">
          <div>
            <h1>Your projects</h1>
            <p className="muted">Only you can see these.</p>
          </div>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => setShowForm((v) => !v)}
          >
            {showForm ? 'Cancel' : '+ New project'}
          </button>
        </div>

        {error && <div className="alert alert--error">{error}</div>}

        {showForm && (
          <form className="new-project" onSubmit={handleCreate}>
            <label className="field">
              <span>Name</span>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Blog schema"
                autoFocus
                required
              />
            </label>
            <label className="field">
              <span>Description</span>
              <input
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Optional"
              />
            </label>
            <button type="submit" className="btn btn--primary" disabled={creating}>
              {creating ? 'Creating…' : 'Create'}
            </button>
          </form>
        )}

        {loading && <p className="muted">Loading…</p>}

        {!loading && projects.length === 0 && (
          <div className="empty-state">
            <h2>Nothing here yet</h2>
            <p className="muted">
              Create your first project — it starts with a small sample schema so the
              canvas isn&apos;t blank.
            </p>
          </div>
        )}

        <ul className="project-grid">
          {projects.map((project) => (
            <li key={project._id} className="project-card">
              <Link to={`/project/${project._id}`} className="project-card__link">
                <h3>{project.name}</h3>
                {project.description && (
                  <p className="project-card__desc">{project.description}</p>
                )}
                <p className="project-card__meta">Updated {formatDate(project.updatedAt)}</p>
              </Link>
              <button
                type="button"
                className="btn btn--danger btn--sm"
                onClick={() => handleDelete(project)}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
