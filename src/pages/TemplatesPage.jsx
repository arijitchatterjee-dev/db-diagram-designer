import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  CircleNotch,
  Cube,
  MagnifyingGlass,
  PencilSimple,
  Plus,
  Stack,
  Trash,
  WarningCircle,
  X,
} from '@phosphor-icons/react';
import PageHeader from '../components/layout/PageHeader';
import TableBtn from '../components/common/TableBtn';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import * as templateApi from '../api/templateApi';
import { apiErrorMessage } from '../api/axiosInstance';
import { relativeTime } from '../utils/formatTime';

/**
 * Templates you have arranged, on their own page.
 *
 * The built-in presets are shapes the engine knows about. A template is the
 * shape *you* keep rebuilding: the modules your projects actually start from,
 * grouped into the phases you actually build them in.
 */
export default function TemplatesPage() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');

  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    templateApi
      .listTemplates()
      .then((list) => !cancelled && setTemplates(list))
      .catch((err) => !cancelled && setError(apiErrorMessage(err, 'Could not load your templates')))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return templates;
    return templates.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.key.toLowerCase().includes(q) ||
        (t.summary || '').toLowerCase().includes(q)
    );
  }, [templates, query]);

  async function handleDelete() {
    setDeleting(true);
    try {
      await templateApi.deleteTemplate(pendingDelete._id);
      setTemplates((list) => list.filter((t) => t._id !== pendingDelete._id));
      setPendingDelete(null);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not delete the template'));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <PageHeader>
        <h1 className="topbar__title">Templates</h1>
        <span className="topbar__count">{loading ? '' : templates.length}</span>

        <span className="topbar__spacer" />

        {templates.length > 4 && (
          <div className="search">
            <MagnifyingGlass size={14} weight="bold" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter templates"
              aria-label="Filter templates"
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
          onClick={() => navigate('/templates/new')}
        >
          <Plus size={14} weight="bold" />
          New template
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
          An arrangement of modules, grouped into the phases you build them in. Applying
          one to a plan copies what it names, so editing it here never rewrites a project
          already under way.
        </p>

        {loading && (
          <p className="chat__note">
            <CircleNotch size={14} weight="bold" className="spin" />
            Loading
          </p>
        )}

        {!loading && templates.length === 0 && (
          <section className="blank">
            <span className="blank__icon">
              <Stack size={22} weight="duotone" />
            </span>
            <h2>No templates yet</h2>
            <p>
              If every project you start begins with the same handful of modules in the
              same order, that arrangement is worth keeping once rather than rebuilding
              each time.
            </p>
            <button
              type="button"
              className="btn btn--primary btn--cta"
              onClick={() => navigate('/templates/new')}
            >
              Arrange your first template
              <span className="btn__well" aria-hidden="true">
                <ArrowRight size={15} weight="bold" />
              </span>
            </button>
          </section>
        )}

        {!loading && templates.length > 0 && visible.length === 0 && (
          <p className="dash__none">Nothing matches &ldquo;{query}&rdquo;.</p>
        )}

        {visible.length > 0 && (
          <div className="ptray">
            <ul className="plist">
              {visible.map((template, i) => (
                <li
                  key={template._id}
                  className="prow prow--in"
                  style={{ '--i': Math.min(i, 8) }}
                >
                  <Link to={`/templates/${template._id}`} className="prow__main">
                    <span className="prow__mark" aria-hidden="true">
                      <Stack size={14} weight="bold" />
                    </span>
                    <span className="prow__text">
                      <span className="prow__name">{template.name}</span>
                      <span className="prow__desc">
                        {template.summary || <em>No summary</em>}
                      </span>
                    </span>
                  </Link>

                  <span className="prow__chips">
                    <span className="chip" title="Phases">
                      {template.phases.length}{' '}
                      {template.phases.length === 1 ? 'phase' : 'phases'}
                    </span>
                    <span className="chip" title="Modules">
                      <Cube size={11} weight="bold" />
                      {template.moduleCount}
                    </span>
                    <time dateTime={template.updatedAt} className="prow__time">
                      {relativeTime(template.updatedAt)}
                    </time>
                  </span>

                  <code className="prow__key">{template.key}</code>

                  <span className="prow__actions">
                    <TableBtn
                      to={`/templates/${template._id}`}
                      icon={<PencilSimple size={13} weight="bold" />}
                      title={`Arrange ${template.name}`}
                    >
                      Arrange
                    </TableBtn>
                    <button
                      type="button"
                      className="card__menu-trigger"
                      onClick={() => setPendingDelete(template)}
                      aria-label={`Delete ${template.name}`}
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

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        busy={deleting}
        title={`Delete ${pendingDelete?.name ?? ''}?`}
        body="Plans already built from it keep what they copied. Only the template goes."
        onConfirm={handleDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </>
  );
}
