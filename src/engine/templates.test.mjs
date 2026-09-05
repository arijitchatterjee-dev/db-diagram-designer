// Checks for arranging modules into phases: `npm test` in client/.
import {
  addModule,
  addPhase,
  assignedKeys,
  blankTemplate,
  locate,
  moveModule,
  movePhase,
  newPhaseId,
  nudgeModule,
  removeModule,
  removePhase,
  renamePhase,
  slugifyKey,
  validateTemplate,
} from './templates.js';

let failures = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `  (got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)})`}`);
}

// A fixed template, so index arithmetic is readable in the expectations.
const make = () => ({
  key: 'saas',
  name: 'SaaS',
  summary: '',
  phases: [
    { id: 'p1', name: 'Foundation', moduleKeys: ['auth', 'users', 'billing'] },
    { id: 'p2', name: 'Product', moduleKeys: ['orders'] },
  ],
});

const keysIn = (template, phaseId) => template.phases.find((p) => p.id === phaseId).moduleKeys;

// --- the starting point ---
const blank = blankTemplate();
check('a new template opens with one phase, not a blank page', blank.phases.length, 1);
check('  ...which is empty', blank.phases[0].moduleKeys, []);
check('phase ids are unique', newPhaseId() === newPhaseId(), false);

// --- nothing mutates ---
const original = make();
const snapshot = JSON.stringify(original);
addModule(original, 'p2', 'auth');
moveModule(original, 'auth', 'p2', 0);
removePhase(original, 'p1');
check('every operation leaves the input untouched', JSON.stringify(original), snapshot);

// --- phases ---
check('adding a phase names it by position', addPhase(make()).phases[2].name, 'Phase 3');
check('renaming touches only that phase', renamePhase(make(), 'p2', 'Growth').phases[1].name, 'Growth');
check('  ...and leaves the other alone', renamePhase(make(), 'p2', 'Growth').phases[0].name, 'Foundation');

check('a phase moves down', movePhase(make(), 'p1', 1).phases.map((p) => p.id), ['p2', 'p1']);
check('a phase moves up', movePhase(make(), 'p2', -1).phases.map((p) => p.id), ['p2', 'p1']);
check('the first phase cannot move up', movePhase(make(), 'p1', -1).phases.map((p) => p.id), ['p1', 'p2']);
check('the last phase cannot move down', movePhase(make(), 'p2', 1).phases.map((p) => p.id), ['p1', 'p2']);
check('an unknown phase is a no-op', movePhase(make(), 'nope', 1).phases.map((p) => p.id), ['p1', 'p2']);

// Removing a phase must not silently delete work — the modules come back.
const dropped = removePhase(make(), 'p1');
check('removing a phase removes it', dropped.phases.map((p) => p.id), ['p2']);
check('  ...and its modules become unplaced rather than deleted', assignedKeys(dropped), ['orders']);

// --- placing modules ---
check('adding appends to the end of the phase', keysIn(addModule(make(), 'p2', 'search'), 'p2'), ['orders', 'search']);
// One module, one phase: otherwise "which phase is this built in" has no answer.
check('adding to a second phase takes it out of the first', keysIn(addModule(make(), 'p2', 'auth'), 'p1'), ['users', 'billing']);
check('  ...and puts it in the new one', keysIn(addModule(make(), 'p2', 'auth'), 'p2'), ['orders', 'auth']);
check('adding to an unknown phase is a no-op', assignedKeys(addModule(make(), 'nope', 'search')), ['auth', 'users', 'billing', 'orders']);

check('removing takes it out of the arrangement', assignedKeys(removeModule(make(), 'users')), ['auth', 'billing', 'orders']);
check('removing something unplaced changes nothing', assignedKeys(removeModule(make(), 'search')), ['auth', 'users', 'billing', 'orders']);

check('locate finds a placed module', locate(make(), 'billing'), { phaseId: 'p1', index: 2 });
check('locate returns null for an unplaced one', locate(make(), 'search'), null);

// --- moving: the part with the real trap ---

// Dropping onto row 0 means "go before what is there now".
check('moving up lands where the drop target was', keysIn(moveModule(make(), 'billing', 'p1', 0), 'p1'), ['billing', 'auth', 'users']);

// Removing the module first shifts every later index down by one, so a
// downward move within one phase has to compensate or it lands one short.
check('moving down within a phase compensates for its own removal', keysIn(moveModule(make(), 'auth', 'p1', 2), 'p1'), ['users', 'auth', 'billing']);
check('  ...and reaches the end when dropped past it', keysIn(moveModule(make(), 'auth', 'p1', 3), 'p1'), ['users', 'billing', 'auth']);
check('a drop far past the end appends rather than doing nothing', keysIn(moveModule(make(), 'auth', 'p1', 99), 'p1'), ['users', 'billing', 'auth']);
check('a negative index clamps to the front', keysIn(moveModule(make(), 'billing', 'p1', -5), 'p1'), ['billing', 'auth', 'users']);

// Across phases there is no shift to compensate for: the index means itself.
const across = moveModule(make(), 'auth', 'p2', 0);
check('moving across phases inserts at the index given', keysIn(across, 'p2'), ['auth', 'orders']);
check('  ...and leaves the source phase without it', keysIn(across, 'p1'), ['users', 'billing']);
check('moving to the same spot changes nothing', keysIn(moveModule(make(), 'auth', 'p1', 0), 'p1'), ['auth', 'users', 'billing']);
check('moving an unplaced module is a no-op', assignedKeys(moveModule(make(), 'search', 'p1', 0)), ['auth', 'users', 'billing', 'orders']);
check('moving into an unknown phase is a no-op', assignedKeys(moveModule(make(), 'auth', 'nope', 0)), ['auth', 'users', 'billing', 'orders']);

// --- the keyboard path ---
check('nudging down swaps with the next', keysIn(nudgeModule(make(), 'auth', 1), 'p1'), ['users', 'auth', 'billing']);
check('nudging up swaps with the previous', keysIn(nudgeModule(make(), 'users', -1), 'p1'), ['users', 'auth', 'billing']);
check('the first cannot nudge up', keysIn(nudgeModule(make(), 'auth', -1), 'p1'), ['auth', 'users', 'billing']);
check('the last cannot nudge down', keysIn(nudgeModule(make(), 'billing', 1), 'p1'), ['auth', 'users', 'billing']);
check('nudging never crosses into another phase', keysIn(nudgeModule(make(), 'billing', 1), 'p2'), ['orders']);

// --- build order ---
check('assignedKeys reads in build order', assignedKeys(make()), ['auth', 'users', 'billing', 'orders']);
check('  ...and follows a phase reorder', assignedKeys(movePhase(make(), 'p2', -1)), ['orders', 'auth', 'users', 'billing']);

// --- slugify ---
check('a name becomes a key', slugifyKey('SaaS Starter'), 'saas-starter');
check('punctuation is dropped', slugifyKey('Razorpay Payments!'), 'razorpay-payments');
check('leading and trailing hyphens are trimmed', slugifyKey('  --Blog--  '), 'blog');
check('an empty name gives an empty key', slugifyKey(''), '');

// --- validation ---
check('a complete template has nothing wrong', validateTemplate(make()), []);
check('a missing name is caught', validateTemplate({ ...make(), name: '' })[0], 'Give the template a name.');
check('a missing key is caught', validateTemplate({ ...make(), key: '' })[0], 'Give the template a key.');
check('a bad key is caught', validateTemplate({ ...make(), key: 'SaaS!' })[0], 'The key must be lowercase words joined by hyphens, like "saas-starter".');
check('a taken key is caught', validateTemplate(make(), { existingKeys: ['saas'] })[0], 'Another template already uses the key "saas".');
check('an unnamed phase is caught', validateTemplate({ ...make(), phases: [{ id: 'p1', name: '', moduleKeys: ['auth'] }] })[0], 'Every phase needs a name.');
check('no phases at all is caught', validateTemplate({ ...make(), phases: [] })[0], 'Add at least one phase.');
// An empty arrangement saves nothing worth reapplying, which is the whole point.
check('a template with phases but no modules is caught', validateTemplate({ ...make(), phases: [{ id: 'p1', name: 'A', moduleKeys: [] }] })[0], 'Put at least one module into a phase.');
check('a blank template is not saveable', validateTemplate(blankTemplate()).length > 0, true);

console.log(failures === 0 ? '\nAll template arrangement checks passed.' : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
