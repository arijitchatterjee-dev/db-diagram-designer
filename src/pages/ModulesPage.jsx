import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  CircleNotch,
  Cube,
  MagnifyingGlass,
  PencilSimple,
  Plus,
  Table,
  Trash,
  WarningCircle,
  X,
} from '@phosphor-icons/react';
import PageHeader from '../components/layout/PageHeader';
import ModuleEditorDialog from '../components/plan/ModuleEditorDialog';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import {
  hydrateCustomModules,
  hydrateCustomModule,
  stripAll,
  blankModule,
} from '../engine/customModules';
import { MODULES } from '../engine/modules';
import * as moduleApi from '../api/moduleApi';
import { apiErrorMessage } from '../api/axiosInstance';

/**
 * The module library, on its own page.
 *
 * It used to be reachable only from a dialog inside one project's plan, which
 * made a library that belongs to you feel like a feature of that plan. Modules
 * outlive the project you first wrote them for; this is where they live.
 */
export default function ModulesPage() {
  const [modules, setModules] = useState([]);
  const [hydrated, setHydrated] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');

  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    moduleApi
      .listModules()
      .then((list) => !cancelled && setModules(list))
      .catch((err) => !cancelled && setError(apiErrorMessage(err, 'Could not load your modules')))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  // The stored module carries DBML; the card wants a table count. Parsed once
  // here, and again whenever the list changes.
  useEffect(() => {
    let cancelled = false;
    hydrateCustomModules(modules).then((next) => !cancelled && setHydrated(next));
    return () => {
      cancelled = true;
    };
  }, [modules]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return hydrated;
    return hydrated.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.key.toLowerCase().includes(q) ||
        (m.summary || '').toLowerCase().includes(q)
    );
  }, [hydrated, query]);

  const builtInKeys = useMemo(() => MODULES.map((m) => m.key), []);

  async function handleSave(draft) {
    setSaving(true);
    setError(null);
    try {
      const stored = stripAll([draft])[0];
      const saved = editing.id
        ? await moduleApi.updateModule(editing.id, stored)
        : await moduleApi.createModule(stored);

      setModules((list) =>
        editing.id ? list.map((m) => (m._id === saved._id ? saved : m)) : [...list, saved]
      );
      setEditing(null);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not save the module'));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await moduleApi.deleteModule(pendingDelete._id);
      setModules((list) => list.filter((m) => m._id !== pendingDelete._id));
      setPendingDelete(null);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not delete the module'));
    } finally {
      setDeleting(false);
    }
  }

  async function startEdit(module) {
    const full = modules.find((m) => m._id === module._id) ?? module;
    setEditing({ id: full._id, module: await hydrateCustomModule(full), isNew: false });
  }

  return (
    <>
      <PageHeader>
        <h1 className="topbar__title">Modules</h1>
        <span className="topbar__count">{loading ? '' : modules.length}</span>

        <span className="topbar__spacer" />

        {modules.length > 4 && (
          <div className="search">
            <MagnifyingGlass size={14} weight="bold" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter modules"
              aria-label="Filter modules"
            />
            {query && (
              <button type="button" onClick={() => setQuery('')} aria-label="Clear filter">
                <X size={12} weight="bold" />
              </button>
            )}
          </div>
        )}

        <button
          type="button"
          className="btn btn--primary btn--sm"
          onClick={() => setEditing({ id: null, module: blankModule(), isNew: true })}
        >
          <Plus size={14} weight="bold" />
          New module
        </button>
      </PageHeader>

      <main className="dash">
        {error && (
          <p className="alert alert--error" role="alert">
            <WarningCircle size={15} weight="fill" />
            {error}
          </p>
        )}

        <p className="mods__lead">
          Modules you defined, reusable across every project. Inserting one into a plan
          copies it, so editing it here never rewrites a project already under way.
        </p>

        {loading && (
          <p className="chat__note">
            <CircleNotch size={14} weight="bold" className="spin" />
            Loading
          </p>
        )}

        {!loading && modules.length === 0 && (
          <section className="blank">
            <span className="blank__icon">
              <Cube size={22} weight="duotone" />
            </span>
            <h2>No modules of your own yet</h2>
            <p>
              The built-in catalogue covers the shapes most products share. This is for
              the ones yours does not: a referrals scheme, the payment provider you
              actually use, an internal service everything at work talks to.
            </p>
            <button
              type="button"
              className="btn btn--primary btn--cta"
              onClick={() => setEditing({ id: null, module: blankModule(), isNew: true })}
            >
              Define your first module
              <span className="btn__well" aria-hidden="true">
                <ArrowRight size={15} weight="bold" />
              </span>
            </button>
          </section>
        )}

        {!loading && modules.length > 0 && visible.length === 0 && (
          <p className="dash__none">Nothing matches &ldquo;{query}&rdquo;.</p>
        )}

        {visible.length > 0 && (
          <div className="ptray">
            <ul className="plist">
              {visible.map((module, i) => (
                <li
                  key={module.key}
                  className="prow prow--in"
                  style={{ '--i': Math.min(i, 8) }}
                >
                  <span className="prow__main prow__main--static">
                    <span className="prow__mark" aria-hidden="true">
                      <Cube size={14} weight="bold" />
                    </span>
                    <span className="prow__text">
                      <span className="prow__name">{module.name}</span>
                      <span className="prow__desc">
                        {module.summary || <em>No summary</em>}
                      </span>
                    </span>
                  </span>

                  <span className="prow__chips">
                    <span className="chip" title="Tables">
                      <Table size={11} weight="bold" />
                      {module.entities?.length ?? 0}
                    </span>
                    <span className="chip" title="Endpoints">
                      {(module.apis ?? []).length} API
                    </span>
                    {builtInKeys.includes(module.key) && (
                      <span className="chip chip--plan is-draft" title="Shadows a built-in module">
                        shadows
                      </span>
                    )}
                  </span>

                  <code className="prow__key">{module.key}</code>

                  <span className="prow__actions">
                    <button
                      type="button"
                      className="prow__plan"
                      onClick={() => startEdit(module)}
                      title="Edit"
                    >
                      <PencilSimple size={13} weight="bold" />
                      Edit
                    </button>
                    <button
                      type="button"
                      className="card__menu-trigger"
                      onClick={() => setPendingDelete(module)}
                      aria-label={`Delete ${module.name}`}
                    >
                      <Trash size={14} weight="bold" />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </main>

      {editing && (
        <ModuleEditorDialog
          module={editing.module}
          isNew={editing.isNew}
          planModuleKeys={[]}
          planCustomModules={hydrated.filter((m) => m.key !== editing.module.key)}
          tableOwners={{}}
          savingToLibrary={saving}
          onSave={handleSave}
          onCancel={() => setEditing(null)}
        />
      )}

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        busy={deleting}
        title={`Delete ${pendingDelete?.name ?? ''}?`}
        body="Projects that already use it keep their own copy. Only the library entry goes."
        onConfirm={handleDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </>
  );
}
