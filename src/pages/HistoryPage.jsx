import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowCounterClockwise,
  ArrowLeft,
  BookmarkSimple,
  CircleNotch,
  ClockCounterClockwise,
  Sparkle,
  User,
  WarningCircle,
} from '@phosphor-icons/react';
import PageHeader from '../components/layout/PageHeader';
import EditableTitle from '../components/editor/EditableTitle';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { ANSWERS, labelFor, PRESETS, STATUSES } from '../engine/planOptions';
import { usePlanStore } from '../store/usePlanStore';
import * as revisionApi from '../api/revisionApi';
import * as projectApi from '../api/projectApi';
import { apiErrorMessage } from '../api/axiosInstance';
import { absoluteTime, relativeTime } from '../utils/formatTime';

const FIELD_LABELS = {
  context: 'The product',
  goal: 'Version one scope',
  moduleKeys: 'Modules',
  presetKey: 'Project type',
  status: 'Status',
  stack: 'Stack',
  architecture: 'Architecture',
  apis: 'API surface',
  folders: 'Folder structure',
  customModules: 'Custom modules',
  answers: 'Constraints',
};

function rowLabel(row) {
  if (row.path.startsWith('answers.')) {
    const key = row.path.slice('answers.'.length);
    return ANSWERS[key]?.label ?? key;
  }
  return FIELD_LABELS[row.path] ?? row.label ?? row.path;
}

function rowValue(row, raw) {
  if (!raw) return null;
  if (row.path.startsWith('answers.')) {
    const key = row.path.slice('answers.'.length);
    return ANSWERS[key]?.options.find((o) => o.value === raw)?.label ?? raw;
  }
  if (row.path === 'presetKey') return labelFor(PRESETS, raw);
  if (row.path === 'status') return labelFor(STATUSES, raw);
  return raw;
}

/**
 * What this plan has been, and how it got here.
 *
 * Not an undo stack. The entries are the decisions somebody deliberately made
 * — a proposal accepted, a checkpoint taken — which is what makes the question
 * "when did the scope grow, and by how much" one this can actually answer.
 */
export default function HistoryPage() {
  const { id } = useParams();

  const project = usePlanStore((s) => s.project);
  const plan = usePlanStore((s) => s.plan);
  const loadPlan = usePlanStore((s) => s.loadPlan);
  const patch = usePlanStore((s) => s.patch);
  const save = usePlanStore((s) => s.save);
  const dirty = usePlanStore((s) => s.dirty);

  const [revisions, setRevisions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(null);

  useEffect(() => {
    loadPlan(id);
  }, [id, loadPlan]);

  const refresh = useCallback(async () => {
    try {
      setRevisions(await revisionApi.listRevisions(id));
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not load the history'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function checkpoint() {
    setBusy(true);
    setError(null);
    try {
      // Saved first, or the checkpoint records the plan as the server last
      // stored it rather than the plan as it is.
      if (dirty) await save();
      await revisionApi.createRevision(id);
      await refresh();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not save a checkpoint'));
    } finally {
      setBusy(false);
    }
  }

  async function restore() {
    setBusy(true);
    setError(null);
    try {
      const restored = await revisionApi.restoreRevision(id, confirm._id);
      patch(restored);
      setConfirm(null);
      await refresh();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not restore that revision'));
    } finally {
      setBusy(false);
    }
  }

  const renameProject = useCallback(
    async (name) => {
      try {
        await projectApi.updateProject(id, { name });
        usePlanStore.setState((s) => ({ project: { ...s.project, name } }));
      } catch (err) {
        setError(apiErrorMessage(err, 'Could not rename the project'));
      }
    },
    [id]
  );

  return (
    <>
      <PageHeader>
        <EditableTitle value={project?.name ?? ''} onChange={renameProject} />
        <span className="topbar__count">{loading ? '' : revisions.length}</span>

        <span className="topbar__spacer" />

        <button type="button" className="btn btn--sm" onClick={checkpoint} disabled={busy || !plan}>
          <BookmarkSimple size={14} weight="bold" />
          Checkpoint now
        </button>
      </PageHeader>

      <main className="doc">
        {error && (
          <p className="alert alert--error" role="alert">
            <WarningCircle size={15} weight="fill" />
            {error}
          </p>
        )}

        <section className="doc__section">
          <div className="doc__head">
            <h2>History</h2>
            <p className="doc__hint">
              Changes somebody meant to make: a proposal you accepted, or a checkpoint you
              took. Autosave writes nothing here, so the list stays readable.
            </p>
          </div>

          {loading && (
            <p className="chat__note">
              <CircleNotch size={14} weight="bold" className="spin" />
              Loading
            </p>
          )}

          {!loading && revisions.length === 0 && (
            <section className="blank">
              <span className="blank__icon">
                <ClockCounterClockwise size={22} weight="duotone" />
              </span>
              <h2>Nothing recorded yet</h2>
              <p>
                Accept a change from the planning conversation, or take a checkpoint, and
                it appears here with what it changed.
              </p>
              <Link to={`/project/${id}/plan`} className="btn btn--primary">
                Back to the plan
              </Link>
            </section>
          )}

          {revisions.length > 0 && (
            <ol className="hist">
              {revisions.map((rev, i) => (
                <li key={rev._id} className="hist__item">
                  <span
                    className={`hist__mark hist__mark--${rev.source}`}
                    title={rev.source === 'assistant' ? 'From the conversation' : 'Yours'}
                  >
                    {rev.source === 'assistant' ? (
                      <Sparkle size={11} weight="fill" />
                    ) : (
                      <User size={11} weight="fill" />
                    )}
                  </span>

                  <div className="hist__body">
                    <div className="hist__top">
                      <p className="hist__summary">{rev.summary}</p>
                      <time dateTime={rev.createdAt} title={absoluteTime(rev.createdAt)}>
                        {relativeTime(rev.createdAt)}
                      </time>
                    </div>

                    {rev.diff.length > 0 && (
                      <ul className="hist__diff">
                        {rev.diff.map((row) => (
                          <li key={row.path}>
                            <span className="hist__field">{rowLabel(row)}</span>
                            <span className="hist__vals">
                              {rowValue(row, row.from) ? (
                                <span className="hist__from">{rowValue(row, row.from)}</span>
                              ) : (
                                <span className="hist__from hist__from--none">not set</span>
                              )}
                              <span aria-hidden="true">→</span>
                              <span className="hist__to">{rowValue(row, row.to) ?? '—'}</span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}

                    {/* The newest entry is where the plan already is. */}
                    {i > 0 && (
                      <button
                        type="button"
                        className="hist__restore"
                        onClick={() => setConfirm(rev)}
                        disabled={busy}
                      >
                        <ArrowCounterClockwise size={13} weight="bold" />
                        Restore this
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="doc__section">
          <div className="doc__head">
            <h2>Back to work</h2>
          </div>
          <Link to={`/project/${id}/plan`} className="btn">
            <ArrowLeft size={15} weight="bold" />
            The plan
          </Link>
        </section>
      </main>

      <ConfirmDialog
        open={Boolean(confirm)}
        busy={busy}
        title="Restore this revision?"
        body="The plan goes back to how it was here. Nothing is lost: the restore is recorded as its own entry, so you can come back."
        confirmLabel="Restore"
        busyLabel="Restoring"
        onConfirm={restore}
        onCancel={() => setConfirm(null)}
      />
    </>
  );
}
