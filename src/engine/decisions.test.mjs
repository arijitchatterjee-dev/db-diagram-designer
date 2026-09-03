// Checks for the decision log: `npm test` in client/.
import {
  decisionsFromPlan,
  seedDecisions,
  sortLog,
  logIsStale,
  blankDecision,
  validateDecision,
  isoDate,
} from './decisions.js';
import {
  recommendStack,
  recommendArchitecture,
  applyArchitectureOverrides,
  architectureFacts,
  resolveDependencies,
} from './recommend.js';
import { defaultAnswersFor, suggestedModulesFor } from './presets.js';

let failures = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(
    `${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `  (got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)})`}`
  );
}

const answers = {
  ...defaultAnswersFor('ecommerce'),
  userScale: 'growing',
  team: 'small',
  hosting: 'managed',
  realtime: 'notifications',
};
const stack = recommendStack(answers);
const keys = resolveDependencies(suggestedModulesFor('ecommerce')).keys;
const facts = architectureFacts({ moduleKeys: keys, answers }, stack);
const architecture = recommendArchitecture(answers, facts);

// ------------------------------------------------------- what gets seeded
const fresh = decisionsFromPlan({ stack, architecture });
const decidedLayers = stack.filter((r) => !r.undecided).length;
check('one entry per decided stack layer, plus layering and topology', fresh.length, decidedLayers + 2);
check('every entry has an id', fresh.every((e) => Boolean(e.id)), true);
check('  ...unique', new Set(fresh.map((e) => e.id)).size, fresh.length);
check('  ...and a title naming the choice', fresh.some((e) => e.title.startsWith('Database: ')), true);
check('every entry is marked as the engine’s', fresh.every((e) => e.source === 'engine'), true);
check('every entry is dated', fresh.every((e) => /^\d{4}-\d{2}-\d{2}$/.test(e.date)), true);

const db = fresh.find((e) => e.id === 'stack:database');
// An ADR is the forces, the decision, and what it costs later. All three are
// already sitting in the recommendation, so none of it has to be invented.
check('the context is the reasoning that applied', db.context.includes('transactions'), true);
check('the choice is the name', db.choice, 'PostgreSQL');
check('what was ruled out is recorded', db.rejected.length > 0, true);
check('  ...with the objection, not just the name', db.rejected[0].includes(':'), true);
check('the consequence is what it breaks at', db.consequence.includes('one primary'), true);

check('layering is logged', Boolean(fresh.find((e) => e.id === 'arch:layering')), true);
check('topology is logged', Boolean(fresh.find((e) => e.id === 'arch:topology')), true);
// An undecided dimension is not a decision, so it does not get an entry.
const blankArch = recommendArchitecture({}, { moduleCount: 0, stack: [] });
check('nothing undecided is logged', decisionsFromPlan({ stack: [], architecture: blankArch }), []);

// -------------------------------------------- entries you wrote are yours
const mine = {
  id: 'manual:abc',
  title: 'Use UUIDs for public ids',
  date: '2026-01-05',
  context: 'Sequential ids leak how many orders exist.',
  choice: 'UUID v7 in every public URL',
  rejected: ['Sequential integers: leaks volume'],
  consequence: 'Slightly larger indexes.',
  source: 'manual',
};

const merged = seedDecisions({ stack, architecture, existing: [mine] });
check('your entry survives a seed', merged.some((e) => e.id === 'manual:abc'), true);
const survived = merged.find((e) => e.id === 'manual:abc');
check('  ...unchanged, word for word', survived, mine);
check('  ...alongside the engine entries', merged.length, fresh.length + 1);

// The hard case: a decision your entry talks about disappears entirely.
const afterStackGone = seedDecisions({ stack: [], architecture: blankArch, existing: [mine] });
check('your entry survives even when the plan empties', afterStackGone, [mine]);

// ------------------------------------- engine entries follow the decision
const seeded = seedDecisions({ stack, architecture, existing: [] });
const overridden = applyArchitectureOverrides(architecture, { layering: 'hexagonal' }, answers, facts);
const reseeded = seedDecisions({ stack, architecture: overridden, existing: seeded });

const layeringEntry = reseeded.find((e) => e.id === 'arch:layering');
check('changing a decision changes its entry', layeringEntry.choice, 'Ports and adapters');
check('  ...and its context', layeringEntry.context !== seeded.find((e) => e.id === 'arch:layering').context, true);
check('  ...without duplicating it', reseeded.filter((e) => e.id === 'arch:layering').length, 1);
check('  ...leaving the others alone', reseeded.find((e) => e.id === 'stack:database').choice, 'PostgreSQL');

// The date records when a decision was taken, so re-running is not retaking it.
const dated = seeded.map((e) => ({ ...e, date: '2020-01-01' }));
const unchanged = seedDecisions({ stack, architecture, existing: dated });
check('an unchanged decision keeps its original date', unchanged.find((e) => e.id === 'stack:database').date, '2020-01-01');
// Changing your mind is a new decision, and dates as one.
const changed = seedDecisions({ stack, architecture: overridden, existing: dated });
check('a changed decision is dated today', changed.find((e) => e.id === 'arch:layering').date, isoDate());
check('  ...while its neighbours keep theirs', changed.find((e) => e.id === 'stack:database').date, '2020-01-01');

// A layer that stops being decided drops its entry rather than describing a
// choice the plan no longer holds.
const fewer = seedDecisions({ stack: stack.filter((r) => r.layer !== 'cache'), architecture, existing: seeded });
check('a decision that goes away takes its entry with it', fewer.some((e) => e.id === 'stack:cache'), false);
check('  ...and nothing else moves', fewer.some((e) => e.id === 'stack:database'), true);

// ------------------------------------------------------------- ordering
const ordered = sortLog([
  { id: 'a', date: '2026-01-01', source: 'engine' },
  { id: 'b', date: '2026-03-01', source: 'manual' },
  { id: 'c', date: '2026-02-01', source: 'engine' },
]);
check('newest first', ordered.map((e) => e.id), ['b', 'c', 'a']);
check('same-date order is stable', sortLog([
  { id: 'x', date: '2026-01-01' },
  { id: 'y', date: '2026-01-01' },
]).map((e) => e.id), ['x', 'y']);
check('an undated entry sorts last', sortLog([{ id: 'n' }, { id: 'd', date: '2026-01-01' }]).map((e) => e.id), ['d', 'n']);

// ------------------------------------------------------------- staleness
check('a freshly seeded log is not stale', logIsStale(seeded, { stack, architecture }), false);
check('a changed decision makes it stale', logIsStale(seeded, { stack, architecture: overridden }), true);
check('an empty log with decisions to log is stale', logIsStale([], { stack, architecture }), true);
check('an empty log with nothing to log is not', logIsStale([], { stack: [], architecture: blankArch }), false);
// Your entries are not engine entries, so they never make the log look stale.
check('your entries do not affect staleness', logIsStale([...seeded, mine], { stack, architecture }), false);
check('a removed decision makes it stale', logIsStale(seeded, { stack: stack.filter((r) => r.layer !== 'cache'), architecture }), true);

// ------------------------------------------------------------- new entries
const blank = blankDecision();
check('a new entry is yours', blank.source, 'manual');
check('  ...dated today', blank.date, isoDate());
check('  ...with an id', blank.id.startsWith('manual:'), true);
check('  ...short enough for the stored field', blank.id.length < 80, true);
check('  ...and unique between calls', blankDecision().id === blankDecision().id, false);

check('a blank entry does not validate', validateDecision(blank).length, 2);
check('a title alone is not enough', validateDecision({ ...blank, title: 'x' }).length, 1);
check('a title and a choice validate', validateDecision({ ...blank, title: 'x', choice: 'y' }), []);
check('whitespace is not a title', validateDecision({ ...blank, title: '   ', choice: 'y' }).length, 1);

console.log(failures === 0 ? '\nAll decision log checks passed.' : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
