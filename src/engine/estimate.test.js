import assert from 'node:assert';
import {
  COMPLEXITY,
  estimateFacts,
  estimateRows,
  estimateSignature,
  formatMoney,
  totalsFor,
} from './estimate.js';

let failures = 0;
function check(name, fn) {
  try {
    fn();
    console.log(`PASS  ${name}`);
  } catch (err) {
    failures += 1;
    console.error(`FAIL  ${name}\n      ${err.message}`);
  }
}

const facts = { team: 'solo', topology: 'monolith', layering: 'layered' };

/* ---------- rows ---------- */

check('a module is sized by its complexity', () => {
  const [row] = estimateRows({ moduleKeys: ['tags'], facts });
  assert.strictEqual(row.complexity, 'trivial');
  assert.strictEqual(row.days, 1);
});

check('a bigger module costs more', () => {
  const rows = estimateRows({ moduleKeys: ['tags', 'checkout'], facts });
  const tags = rows.find((r) => r.key === 'tags');
  const checkout = rows.find((r) => r.key === 'checkout');
  assert.ok(checkout.days > tags.days, 'checkout should outweigh tags');
});

check('every row says where its number came from', () => {
  const rows = estimateRows({ moduleKeys: ['auth', 'orders'], facts });
  assert.ok(rows.every((r) => r.because && r.because.length > 10));
});

check('a module with no complexity falls back rather than costing nothing', () => {
  const custom = [{ key: 'mine', name: 'Mine', entities: [], apis: [] }];
  const [row] = estimateRows({ moduleKeys: ['mine'], customModules: custom, facts });
  assert.strictEqual(row.complexity, 'medium');
  assert.strictEqual(row.days, 6);
});

check('an unknown module key is skipped, not counted as zero', () => {
  const rows = estimateRows({ moduleKeys: ['auth', 'does-not-exist'], facts });
  assert.strictEqual(rows.filter((r) => r.kind === 'module').length, 1);
});

check('a day you set by hand wins, and says so', () => {
  const [row] = estimateRows({ moduleKeys: ['auth'], facts, overrides: { auth: 30 } });
  assert.strictEqual(row.days, 30);
  assert.strictEqual(row.overridden, true);
  assert.strictEqual(row.baseDays, 6, 'the original is kept so it can be restored');
});

check('an override of zero is honoured rather than treated as unset', () => {
  const [row] = estimateRows({ moduleKeys: ['auth'], facts, overrides: { auth: 0 } });
  assert.strictEqual(row.days, 0);
  assert.strictEqual(row.overridden, true);
});

/* ---------- overheads ---------- */

check('setup is always there', () => {
  const rows = estimateRows({ moduleKeys: ['tags'], facts });
  assert.ok(rows.some((r) => r.key === 'setup'));
});

check('services overhead only when the topology is services', () => {
  const mono = estimateRows({ moduleKeys: ['tags'], facts });
  const svc = estimateRows({ moduleKeys: ['tags'], facts: { ...facts, topology: 'services' } });
  assert.ok(!mono.some((r) => r.key === 'services'));
  assert.ok(svc.some((r) => r.key === 'services'));
});

check('a full-text search inside the database adds no infrastructure', () => {
  // sqlite-fts and postgres-fts are the database you already run, not a
  // second datastore to keep in step with it.
  const inDb = estimateRows({ moduleKeys: ['tags'], facts: { ...facts, searchLayer: 'postgres-fts' } });
  const separate = estimateRows({ moduleKeys: ['tags'], facts: { ...facts, searchLayer: 'meilisearch' } });
  assert.ok(!inDb.some((r) => r.key === 'search'));
  assert.ok(separate.some((r) => r.key === 'search'));
});

check('testing scales with the build rather than being a flat number', () => {
  const small = estimateRows({ moduleKeys: ['tags'], facts });
  const big = estimateRows({ moduleKeys: ['checkout', 'billing', 'sales', 'messaging'], facts });
  const qaOf = (rows) => rows.find((r) => r.key === 'qa')?.days ?? 0;
  assert.ok(qaOf(big) > qaOf(small));
});

/* ---------- totals ---------- */

check('contingency is added on top of the build', () => {
  const rows = [{ key: 'a', days: 100, kind: 'module' }];
  const t = totalsFor(rows, { contingency: 20, dayRate: 0, team: 'solo' });
  assert.strictEqual(t.build, 100);
  assert.strictEqual(t.buffer, 20);
  assert.strictEqual(t.effort, 120);
});

check('a bigger team shortens the calendar without changing the effort', () => {
  const rows = [{ key: 'a', days: 100, kind: 'module' }];
  const alone = totalsFor(rows, { contingency: 0, team: 'solo' });
  const crowd = totalsFor(rows, { contingency: 0, team: 'large' });
  assert.strictEqual(alone.effort, crowd.effort, 'effort is what it costs, and it does not change');
  assert.ok(crowd.calendarDays < alone.calendarDays);
});

check('four people are not four times one', () => {
  const rows = [{ key: 'a', days: 100, kind: 'module' }];
  const alone = totalsFor(rows, { contingency: 0, team: 'solo' });
  const small = totalsFor(rows, { contingency: 0, team: 'small' });
  // Two to four people, so a naive reading would be 4x. Coordination is why
  // it is not, and pretending otherwise is how estimates get missed.
  assert.ok(small.calendarDays > alone.calendarDays / 4);
});

check('weeks are five days, not seven', () => {
  const rows = [{ key: 'a', days: 10, kind: 'module' }];
  assert.strictEqual(totalsFor(rows, { contingency: 0, team: 'solo' }).calendarWeeks, 2);
});

check('cost follows effort, not the build alone', () => {
  const rows = [{ key: 'a', days: 10, kind: 'module' }];
  const t = totalsFor(rows, { contingency: 50, dayRate: 1000, team: 'solo' });
  assert.strictEqual(t.cost, 15000);
});

check('no rate means no cost rather than a wrong one', () => {
  assert.strictEqual(totalsFor([{ key: 'a', days: 10 }], { dayRate: 0 }).cost, 0);
});

/* ---------- staleness ---------- */

check('the signature changes when the modules do', () => {
  const a = estimateSignature({ moduleKeys: ['auth'], facts });
  const b = estimateSignature({ moduleKeys: ['auth', 'orders'], facts });
  assert.notStrictEqual(a, b);
});

check('reordering the same modules is not a change', () => {
  const a = estimateSignature({ moduleKeys: ['auth', 'orders'], facts });
  const b = estimateSignature({ moduleKeys: ['orders', 'auth'], facts });
  assert.strictEqual(a, b);
});

check('changing the architecture changes the signature', () => {
  const a = estimateSignature({ moduleKeys: ['auth'], facts });
  const b = estimateSignature({ moduleKeys: ['auth'], facts: { ...facts, topology: 'services' } });
  assert.notStrictEqual(a, b);
});

/* ---------- facts and formatting ---------- */

check('an undecided architecture is not read as a decision', () => {
  const out = estimateFacts({}, [], { topology: { choice: 'services', undecided: true } });
  assert.strictEqual(out.topology, '');
});

check('an undecided stack layer is not read as a decision', () => {
  const out = estimateFacts({}, [{ layer: 'search', choice: 'meilisearch', undecided: true }], {});
  assert.strictEqual(out.searchLayer, '');
});

check('money carries its symbol', () => {
  assert.ok(formatMoney(1000, 'INR').startsWith('₹'));
  assert.ok(formatMoney(1000, 'USD').startsWith('$'));
});

check('the complexity ladder only goes up', () => {
  const days = COMPLEXITY.map((c) => c.days);
  assert.deepStrictEqual(days, [...days].sort((a, b) => a - b));
});

console.log(
  failures === 0 ? '\nAll estimate checks passed.' : `\n${failures} estimate check(s) failed.`
);
process.exit(failures === 0 ? 0 : 1);
