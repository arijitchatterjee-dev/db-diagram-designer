import { labelFor, LAYERS } from './planOptions.js';

/**
 * The decision log.
 *
 * Most of it writes itself. Every stack layer, the layering and the topology
 * are already decisions with reasons and rejected alternatives attached, so
 * seeding them here costs nothing and means the log starts useful rather than
 * empty.
 *
 * Two rules hold it together:
 *   - An entry you wrote is yours. Nothing regenerates, rewrites or removes it.
 *   - An entry the engine seeded follows the decision behind it. Change the
 *     database and that entry changes with it, so the log cannot quietly
 *     describe a plan that no longer exists.
 */

const ENGINE = 'engine';
const MANUAL = 'manual';

function isoDate(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

/** ADR shape: the forces, the decision, and what it costs later. */
function entryFor({ id, title, row }) {
  return {
    id,
    title,
    date: isoDate(),
    // The forces: the rules that argued for it, in scoring order.
    context: (row.reasons ?? []).join(' '),
    choice: row.name ?? row.choice,
    rejected: (row.alternatives ?? [])
      .filter((alt) => alt.ruledOut && alt.tradeoff)
      .map((alt) => `${alt.name}: ${alt.tradeoff}`),
    consequence: row.breaksAt ?? '',
    source: ENGINE,
  };
}

/** Every decision in the plan that deserves an entry, in a stable order. */
export function decisionsFromPlan({ stack = [], architecture = {} } = {}) {
  const out = [];

  for (const row of stack) {
    if (row.undecided || !row.choice) continue;
    out.push(
      entryFor({
        id: `stack:${row.layer}`,
        title: `${labelFor(LAYERS, row.layer)}: ${row.name ?? row.choice}`,
        row,
      })
    );
  }

  for (const [dimension, label] of [
    ['layering', 'Layering'],
    ['topology', 'Deployment'],
  ]) {
    const row = architecture[dimension];
    if (!row || row.undecided || !row.choice) continue;
    out.push({
      ...entryFor({ id: `arch:${dimension}`, title: `${label}: ${row.name ?? row.choice}`, row }),
    });
  }

  return out;
}

/**
 * Merges freshly derived engine entries into the stored log.
 *
 * An engine entry whose decision has not changed keeps its original date: the
 * date records when the decision was made, and re-running the engine is not
 * making it again. Changing your mind is a new decision, and gets today.
 */
export function seedDecisions({ stack = [], architecture = {}, existing = [] } = {}) {
  const fresh = decisionsFromPlan({ stack, architecture });
  const previous = new Map(existing.filter((e) => e.source === ENGINE).map((e) => [e.id, e]));

  const seeded = fresh.map((entry) => {
    const before = previous.get(entry.id);
    // Same decision, so the date it was taken stands.
    if (before && before.choice === entry.choice) return { ...entry, date: before.date };
    return entry;
  });

  // Yours are never touched: not rewritten, not reordered out of existence,
  // and not removed when a decision they mention goes away.
  const mine = existing.filter((entry) => entry.source !== ENGINE);

  return sortLog([...seeded, ...mine]);
}

/** Newest first, and stable within a date so the order does not jitter. */
export function sortLog(entries) {
  return entries
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => {
      const byDate = String(b.entry.date ?? '').localeCompare(String(a.entry.date ?? ''));
      return byDate !== 0 ? byDate : a.index - b.index;
    })
    .map(({ entry }) => entry);
}

/** Does the stored log still describe the decisions the plan holds now? */
export function logIsStale(stored = [], { stack = [], architecture = {} } = {}) {
  const fresh = decisionsFromPlan({ stack, architecture });
  const storedEngine = stored.filter((entry) => entry.source === ENGINE);

  if (fresh.length !== storedEngine.length) return true;

  const byId = new Map(storedEngine.map((entry) => [entry.id, entry]));
  return fresh.some((entry) => byId.get(entry.id)?.choice !== entry.choice);
}

export function blankDecision() {
  return {
    // Random enough for a per-plan log, and short enough for the stored field.
    id: `manual:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
    title: '',
    date: isoDate(),
    context: '',
    choice: '',
    rejected: [],
    consequence: '',
    source: MANUAL,
  };
}

export function validateDecision(entry) {
  const problems = [];
  if (!entry.title?.trim()) problems.push('Give the decision a title.');
  if (!entry.choice?.trim()) problems.push('Say what was decided.');
  return problems;
}

export { ENGINE, MANUAL, isoDate };
