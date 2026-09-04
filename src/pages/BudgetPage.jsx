import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowClockwise,
  CalendarBlank,
  CircleNotch,
  Coins,
  CurrencyCircleDollar,
  Cube,
  FloppyDisk,
  Warning,
  WarningCircle,
} from '@phosphor-icons/react';
import PageHeader from '../components/layout/PageHeader';
import EditableTitle from '../components/editor/EditableTitle';
import SaveState from '../components/ui/SaveState';
import { usePlanStore } from '../store/usePlanStore';
import { usePlanArchitecture } from '../hooks/usePlanArchitecture';
import { hydrateCustomModules } from '../engine/customModules';
import { recommendStack, applyOverrides } from '../engine/recommend';
import {
  COMPLEXITY,
  CURRENCIES,
  estimateFacts,
  estimateRows,
  estimateSignature,
  formatMoney,
  totalsFor,
} from '../engine/estimate';
import * as projectApi from '../api/projectApi';
import { apiErrorMessage } from '../api/axiosInstance';

const AUTOSAVE_IDLE_MS = 3000;
const EMPTY_BUDGET = { currency: 'INR', dayRate: 0, contingency: 15, overrides: [], generatedFrom: '' };

/**
 * What the plan costs, and how long it takes.
 *
 * Derived from the modules and the architecture, the same way the stack is
 * derived from the answers. Every row says where its number came from, because
 * an estimate you cannot argue with line by line is one nobody believes.
 */
export default function BudgetPage() {
  const { id } = useParams();

  const project = usePlanStore((s) => s.project);
  const plan = usePlanStore((s) => s.plan);
  const loading = usePlanStore((s) => s.loading);
  const loadError = usePlanStore((s) => s.loadError);
  const dirty = usePlanStore((s) => s.dirty);
  const saving = usePlanStore((s) => s.saving);
  const lastSavedAt = usePlanStore((s) => s.lastSavedAt);

  const loadPlan = usePlanStore((s) => s.loadPlan);
  const patch = usePlanStore((s) => s.patch);
  const save = usePlanStore((s) => s.save);

  const [hydrated, setHydrated] = useState([]);
  const [pageError, setPageError] = useState(null);

  useEffect(() => {
    loadPlan(id);
  }, [id, loadPlan]);

  useEffect(() => {
    let cancelled = false;
    hydrateCustomModules(plan?.customModules ?? []).then((next) => !cancelled && setHydrated(next));
    return () => {
      cancelled = true;
    };
  }, [plan?.customModules]);

  useEffect(() => {
    if (!dirty || saving) return undefined;
    const timer = setTimeout(save, AUTOSAVE_IDLE_MS);
    return () => clearTimeout(timer);
  }, [dirty, saving, plan, save]);

  const budget = { ...EMPTY_BUDGET, ...(plan?.budget ?? {}) };

  const stackOverrides = useMemo(
    () =>
      Object.fromEntries(
        (plan?.stack ?? []).filter((row) => row.overridden).map((row) => [row.layer, row.choice])
      ),
    [plan?.stack]
  );
  const stack = useMemo(
    () => applyOverrides(recommendStack(plan?.answers ?? {}), stackOverrides, plan?.answers ?? {}),
    [plan?.answers, stackOverrides]
  );
  const { architecture } = usePlanArchitecture(plan, stack, hydrated);

  const facts = useMemo(
    () => estimateFacts(plan ?? {}, stack, architecture),
    [plan, stack, architecture]
  );

  const overrideMap = useMemo(
    () => Object.fromEntries((budget.overrides ?? []).map((row) => [row.key, row.days])),
    [budget.overrides]
  );

  const rows = useMemo(
    () =>
      estimateRows({
        moduleKeys: plan?.moduleKeys ?? [],
        customModules: hydrated,
        facts,
        overrides: overrideMap,
      }),
    [plan?.moduleKeys, hydrated, facts, overrideMap]
  );

  const totals = useMemo(
    () =>
      totalsFor(rows, {
        contingency: budget.contingency,
        dayRate: budget.dayRate,
        team: facts.team,
      }),
    [rows, budget.contingency, budget.dayRate, facts.team]
  );

  const signature = useMemo(
    () => estimateSignature({ moduleKeys: plan?.moduleKeys ?? [], facts }),
    [plan?.moduleKeys, facts]
  );
  // An estimate you adjusted is your work. It is never regenerated silently;
  // this only says the plan has moved since you last agreed with it.
  const stale = Boolean(budget.generatedFrom) && budget.generatedFrom !== signature;

  function setBudget(changes) {
    patch({ budget: { ...budget, ...changes } });
  }

  function setDays(key, days) {
    const value = Number(days);
    const rest = (budget.overrides ?? []).filter((row) => row.key !== key);
    setBudget({
      overrides: Number.isFinite(value) && value >= 0 ? [...rest, { key, days: value, note: '' }] : rest,
    });
  }

  function clearOverride(key) {
    setBudget({ overrides: (budget.overrides ?? []).filter((row) => row.key !== key) });
  }

  const renameProject = useCallback(
    async (name) => {
      try {
        await projectApi.updateProject(id, { name });
        usePlanStore.setState((s) => ({ project: { ...s.project, name } }));
      } catch (err) {
        setPageError(apiErrorMessage(err, 'Could not rename the project'));
      }
    },
    [id]
  );

  if (loading) {
    return (
      <div className="center">
        <CircleNotch size={20} weight="bold" className="spin" />
        <p>Opening</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="center">
        <span className="blank__icon">
          <WarningCircle size={20} weight="fill" />
        </span>
        <h2>{loadError}</h2>
      </div>
    );
  }

  const modules = rows.filter((r) => r.kind === 'module');
  const overheads = rows.filter((r) => r.kind === 'overhead');

  return (
    <>
      <PageHeader>
        <EditableTitle value={project?.name ?? ''} onChange={renameProject} />
        <span className="topbar__spacer" />
        <SaveState saving={saving} dirty={dirty} lastSavedAt={lastSavedAt} />
        <button
          type="button"
          className="btn btn--primary btn--sm"
          onClick={save}
          disabled={saving || !dirty}
          title="Save (Ctrl+S)"
        >
          <FloppyDisk size={14} weight="bold" />
          Save
        </button>
      </PageHeader>

      <main className="doc">
        {pageError && (
          <p className="alert alert--error" role="alert">
            <WarningCircle size={15} weight="fill" />
            {pageError}
          </p>
        )}

        {rows.length === 0 ? (
          <section className="blank">
            <span className="blank__icon">
              <Coins size={22} weight="duotone" />
            </span>
            <h2>Nothing to cost yet</h2>
            <p>
              An estimate is built from the modules the plan covers. Pick some on the plan
              and the numbers appear here with the reasoning behind each one.
            </p>
            <Link to={`/project/${id}/plan`} className="btn btn--primary">
              Go to the plan
            </Link>
          </section>
        ) : (
          <>
            <section className="doc__section">
              <div className="doc__head">
                <h2>The numbers</h2>
                <p className="doc__hint">
                  Effort is what it costs. Calendar is how long it takes, and they are not
                  the same thing: adding people does not divide the weeks.
                </p>
              </div>

              {stale && (
                <p className="wnotice wnotice--warn">
                  <Warning size={14} weight="fill" />
                  <span>
                    The plan has changed since this estimate was agreed. Nothing is
                    regenerated on its own — the days you adjusted are yours.
                    <button
                      type="button"
                      className="linkish"
                      onClick={() => setBudget({ generatedFrom: signature })}
                    >
                      Mark it current
                    </button>
                  </span>
                </p>
              )}

              <div className="bstat">
                <div className="bstat__cell">
                  <span className="bstat__n">{totals.effort}</span>
                  <span className="bstat__k">Person-days</span>
                  <span className="bstat__sub">
                    {totals.build} build + {totals.buffer} buffer
                  </span>
                </div>
                <div className="bstat__cell">
                  <span className="bstat__n">{totals.calendarWeeks}</span>
                  <span className="bstat__k">Weeks</span>
                  <span className="bstat__sub">
                    <CalendarBlank size={11} weight="bold" />
                    {totals.people === 1 ? 'one person' : `${totals.people} effective`}
                  </span>
                </div>
                <div className="bstat__cell">
                  <span className="bstat__n">
                    {budget.dayRate > 0 ? formatMoney(totals.cost, budget.currency) : '—'}
                  </span>
                  <span className="bstat__k">Cost</span>
                  <span className="bstat__sub">
                    {budget.dayRate > 0 ? `at ${formatMoney(budget.dayRate, budget.currency)}/day` : 'set a day rate'}
                  </span>
                </div>
              </div>
            </section>

            <section className="doc__section">
              <div className="doc__head">
                <h2>Rates</h2>
                <p className="doc__hint">
                  The only numbers stored. Everything else is derived from the plan, so an
                  estimate can never disagree with the modules it was made from.
                </p>
              </div>

              <div className="doc__row">
                <div className="field">
                  <label htmlFor="b-currency">Currency</label>
                  <select
                    id="b-currency"
                    className="select"
                    value={budget.currency}
                    onChange={(e) => setBudget({ currency: e.target.value })}
                  >
                    {CURRENCIES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label htmlFor="b-rate">Day rate</label>
                  <input
                    id="b-rate"
                    type="number"
                    min="0"
                    value={budget.dayRate}
                    onChange={(e) => setBudget({ dayRate: Number(e.target.value) || 0 })}
                  />
                </div>
              </div>

              <div className="field">
                <label htmlFor="b-cont">Contingency</label>
                <p className="field__hint">
                  A percentage on top for what the plan has not thought of. Fifteen is
                  optimistic for something you have not built before.
                </p>
                <input
                  id="b-cont"
                  type="number"
                  min="0"
                  max="100"
                  value={budget.contingency}
                  onChange={(e) => setBudget({ contingency: Number(e.target.value) || 0 })}
                />
              </div>
            </section>

            <section className="doc__section">
              <div className="doc__head">
                <h2>
                  Modules <span className="doc__count">{modules.length}</span>
                </h2>
                <p className="doc__hint">
                  Sized by what each one contains. Change a number and it stays yours when
                  the plan moves around it.
                </p>
              </div>
              <Rows rows={modules} onSet={setDays} onClear={clearOverride} />
            </section>

            {overheads.length > 0 && (
              <section className="doc__section">
                <div className="doc__head">
                  <h2>
                    Everything else <span className="doc__count">{overheads.length}</span>
                  </h2>
                  <p className="doc__hint">
                    Work that belongs to no single module but exists because of a choice
                    made elsewhere in the plan.
                  </p>
                </div>
                <Rows rows={overheads} onSet={setDays} onClear={clearOverride} />
              </section>
            )}
          </>
        )}
      </main>
    </>
  );
}

function Rows({ rows, onSet, onClear }) {
  return (
    <ul className="brows">
      {rows.map((row) => (
        <li key={row.key} className={row.overridden ? 'is-overridden' : undefined}>
          <span className="brows__main">
            <span className="brows__name">
              {row.kind === 'module' && <Cube size={12} weight="bold" />}
              {row.label}
              {row.complexity && (
                <span className="brows__level">
                  {COMPLEXITY.find((c) => c.value === row.complexity)?.label}
                </span>
              )}
            </span>
            <span className="brows__why">{row.because}</span>
          </span>

          <span className="brows__days">
            <input
              type="number"
              min="0"
              step="0.5"
              value={row.days}
              onChange={(e) => onSet(row.key, e.target.value)}
              aria-label={`Days for ${row.label}`}
            />
            <span className="brows__unit">d</span>
            {row.overridden && (
              <button
                type="button"
                className="brows__reset"
                onClick={() => onClear(row.key)}
                title={`Back to ${row.baseDays} days`}
              >
                <ArrowClockwise size={12} weight="bold" />
              </button>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}
