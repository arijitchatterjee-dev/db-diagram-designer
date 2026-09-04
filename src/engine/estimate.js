import { moduleIndex } from './recommend.js';

/**
 * What a plan costs to build.
 *
 * Deterministic, like every other recommendation here. The same plan gives the
 * same number every time, and every number carries the reason it is that
 * number — an estimate you cannot argue with line by line is one nobody
 * believes, and rightly.
 *
 * Effort and calendar are kept apart on purpose. Effort is person-days and is
 * what costs money. Calendar is how long it takes, and adding people does not
 * divide it: two people are not twice one, and five are not five times one.
 */

export const COMPLEXITY = [
  { value: 'trivial', label: 'Trivial', days: 1 },
  { value: 'small', label: 'Small', days: 3 },
  { value: 'medium', label: 'Medium', days: 6 },
  { value: 'large', label: 'Large', days: 12 },
  { value: 'xlarge', label: 'Very large', days: 20 },
];

const DAYS = Object.fromEntries(COMPLEXITY.map((c) => [c.value, c.days]));
const DEFAULT_COMPLEXITY = 'medium';

export const CURRENCIES = [
  { value: 'INR', label: '₹ INR', symbol: '₹' },
  { value: 'USD', label: '$ USD', symbol: '$' },
  { value: 'EUR', label: '€ EUR', symbol: '€' },
  { value: 'GBP', label: '£ GBP', symbol: '£' },
];

// Effective people, not headcount. Coordination eats the difference, which is
// why five engineers finish a job in rather more than a fifth of the time.
const PARALLELISM = { solo: 1, small: 2.4, large: 4 };

// Work that belongs to no single module but exists because of a choice made
// elsewhere in the plan. Named as its own line rather than hidden inside a
// multiplier, so it can be argued with.
const OVERHEADS = [
  {
    key: 'setup',
    label: 'Project setup',
    days: 3,
    because: () => 'Repository, environments, CI and the first deploy.',
  },
  {
    key: 'services',
    label: 'Service boundaries',
    days: 8,
    when: (f) => f.topology === 'services',
    because: () => 'Separate services need contracts, deployment and tracing between them.',
  },
  {
    key: 'serverless',
    label: 'Serverless plumbing',
    days: 4,
    when: (f) => f.topology === 'serverless',
    because: () => 'Function packaging, cold-path handling and per-function configuration.',
  },
  {
    key: 'hexagonal',
    label: 'Ports and adapters',
    days: 4,
    when: (f) => f.layering === 'hexagonal' || f.layering === 'clean',
    because: (f) => `${f.layering === 'clean' ? 'Clean' : 'Hexagonal'} layering front-loads the interfaces every module then sits behind.`,
  },
  {
    key: 'search',
    label: 'Search infrastructure',
    days: 5,
    when: (f) => f.searchLayer && f.searchLayer !== 'sqlite-fts' && f.searchLayer !== 'postgres-fts',
    because: (f) => `${f.searchLayer} is a second datastore to index into and keep in step.`,
  },
  {
    key: 'cache',
    label: 'Cache layer',
    days: 2,
    when: (f) => f.cacheLayer,
    because: (f) => `${f.cacheLayer} needs invalidation rules deciding before it helps.`,
  },
  {
    key: 'realtime',
    label: 'Realtime delivery',
    days: 6,
    when: (f) => f.realtime === 'live',
    because: () => 'Live updates need a transport, reconnection and per-user fan-out.',
  },
  {
    key: 'scale',
    label: 'Scale hardening',
    days: 6,
    when: (f) => f.userScale === 'large',
    because: () => 'At this scale, load testing and the first round of tuning are real work.',
  },
  {
    key: 'qa',
    label: 'Testing and fixes',
    days: 0,
    percentOfBuild: 0.25,
    because: () => 'A quarter of build time, which is the optimistic end of what testing costs.',
  },
];

function complexityOf(module) {
  const value = module?.complexity;
  return DAYS[value] !== undefined ? value : DEFAULT_COMPLEXITY;
}

/** The facts the overhead rules read, gathered from the plan in one place. */
export function estimateFacts(plan = {}, stack = [], architecture = {}) {
  const layer = (name) => {
    const row = stack.find((r) => r.layer === name);
    return row && !row.undecided && row.choice ? row.choice : '';
  };

  return {
    userScale: plan.answers?.userScale ?? '',
    team: plan.answers?.team ?? 'solo',
    realtime: plan.answers?.realtime ?? '',
    layering: architecture.layering?.undecided ? '' : architecture.layering?.choice ?? '',
    topology: architecture.topology?.undecided ? '' : architecture.topology?.choice ?? '',
    searchLayer: layer('search'),
    cacheLayer: layer('cache'),
  };
}

/**
 * Builds the estimate rows from the plan.
 *
 * `overrides` is keyed by row key and holds days you set by hand; a row you
 * touched keeps your number when the plan changes around it, the same way an
 * overridden stack layer does.
 */
export function estimateRows({ moduleKeys = [], customModules = [], facts = {}, overrides = {} }) {
  const rows = [];
  // A custom module shadows a built-in of the same key, exactly as it does
  // everywhere else. Resolving by hand here would have silently costed the
  // built-in instead — or, for a module with no built-in, nothing at all.
  const index = moduleIndex(customModules);

  for (const key of moduleKeys) {
    const module = index.get(key);
    if (!module) continue;

    const level = complexityOf(module);
    const base = DAYS[level];
    const overridden = Object.prototype.hasOwnProperty.call(overrides, key);

    rows.push({
      key,
      label: module.name,
      kind: 'module',
      complexity: level,
      days: overridden ? overrides[key] : base,
      baseDays: base,
      overridden,
      because: `${COMPLEXITY.find((c) => c.value === level).label} module: ${
        (module.entities ?? []).length
      } tables, ${(module.apis ?? []).length} endpoints.`,
    });
  }

  const buildDays = rows.reduce((sum, r) => sum + r.days, 0);

  for (const overhead of OVERHEADS) {
    if (overhead.when && !overhead.when(facts)) continue;

    const base = overhead.percentOfBuild
      ? Math.round(buildDays * overhead.percentOfBuild)
      : overhead.days;
    if (base <= 0) continue;

    const overridden = Object.prototype.hasOwnProperty.call(overrides, overhead.key);
    rows.push({
      key: overhead.key,
      label: overhead.label,
      kind: 'overhead',
      complexity: '',
      days: overridden ? overrides[overhead.key] : base,
      baseDays: base,
      overridden,
      because: overhead.because(facts),
    });
  }

  return rows;
}

/** Effort, calendar and money, from the rows and the numbers you set. */
export function totalsFor(rows, { contingency = 15, dayRate = 0, team = 'solo' } = {}) {
  const build = rows.reduce((sum, r) => sum + r.days, 0);
  const buffer = Math.round((build * contingency) / 100);
  const effort = build + buffer;

  const people = PARALLELISM[team] ?? 1;
  const calendarDays = Math.ceil(effort / people);

  return {
    build,
    buffer,
    effort,
    people,
    calendarDays,
    // Five-day weeks: nobody ships on the weekend, and an estimate that
    // assumes they will is the reason estimates are not believed.
    calendarWeeks: Math.ceil(calendarDays / 5),
    cost: Math.round(effort * dayRate),
  };
}

/**
 * What the estimate was generated from.
 *
 * When this stops matching what it was generated from, the estimate is stale
 * and says so. Nothing regenerates on its own: numbers you adjusted are your
 * work, and quietly replacing them would be the fastest way to make this
 * untrustworthy.
 */
export function estimateSignature({ moduleKeys = [], facts = {} }) {
  return JSON.stringify([[...moduleKeys].sort(), facts]);
}

export function symbolFor(currency) {
  return CURRENCIES.find((c) => c.value === currency)?.symbol ?? '';
}

export function formatMoney(amount, currency) {
  return `${symbolFor(currency)}${Math.round(amount).toLocaleString('en-IN')}`;
}
