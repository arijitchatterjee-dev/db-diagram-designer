// Checks for the architecture engine and folder generation: `npm test`.
// Pure functions, no React, no network.
import { LAYERING, TOPOLOGY, ARCHITECTURE_ORDER } from './architecture.js';
import { CONCERNS, CONCERN_KEYS } from './concerns.js';
import { ANSWERS } from './planOptions.js';
import { PRESET_KEYS, defaultAnswersFor, suggestedModulesFor } from './presets.js';
import {
  recommendStack,
  recommendArchitecture,
  recommendConcerns,
  applyArchitectureOverrides,
  applyConcernOverrides,
  architectureFacts,
  toArchitectureRows,
  toConcernRows,
  resolveDependencies,
} from './recommend.js';
import {
  generateFolders,
  folderSignature,
  isValidPath,
  isValidSegment,
  subtreeOf,
  repath,
  renameNode,
  removeSubtree,
  addNode,
  setNote,
  buildTree,
} from './folders.js';

let failures = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(
    `${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `  (got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)})`}`
  );
}

const SCALES = ANSWERS.userScale.options.map((o) => o.value);
const TEAMS = ANSWERS.team.options.map((o) => o.value);

// ------------------------------------------------------------- catalogue
const ALL = [...LAYERING, ...TOPOLOGY];
check('every candidate has a name', ALL.every((c) => Boolean(c.name)), true);
check('every candidate has rules', ALL.every((c) => c.rules.length > 0), true);
check('every candidate says what breaks', ALL.every((c) => Boolean(c.breaksAt)), true);
check(
  'every rule carries its explanation',
  ALL.every((c) => c.rules.every((r) => typeof r.because === 'string' && r.because.length > 10)),
  true
);
check(
  'every answer key a rule reads is real',
  ALL.every((c) => c.rules.every((r) => Object.keys(r.when ?? {}).every((k) => k in ANSWERS))),
  true
);
check(
  'every answer value a rule reads is documented',
  ALL.every((c) =>
    c.rules.every((r) =>
      Object.entries(r.when ?? {}).every(([k, v]) =>
        (Array.isArray(v) ? v : [v]).every((x) => ANSWERS[k].options.some((o) => o.value === x))
      )
    )
  ),
  true
);
check('concern keys match the shared list', CONCERN_KEYS.length, 9);
check(
  'every concern option carries reasons',
  CONCERNS.every((c) => c.options.every((o) => o.rules.every((r) => r.because.length > 10))),
  true
);
check(
  'every concern has at least two options',
  CONCERNS.every((c) => c.options.length >= 2),
  true
);

// ------------------------------------------------- the ecommerce scenario
const ecomAnswers = {
  ...defaultAnswersFor('ecommerce'),
  userScale: 'growing',
  team: 'small',
  hosting: 'managed',
  realtime: 'notifications',
};
const ecomStack = recommendStack(ecomAnswers);
const ecomModules = resolveDependencies(suggestedModulesFor('ecommerce')).keys;
const ecomFacts = architectureFacts({ moduleKeys: ecomModules, answers: ecomAnswers }, ecomStack);
const ecomArch = recommendArchitecture(ecomAnswers, ecomFacts);

check('facts count the modules', ecomFacts.moduleCount, ecomModules.length);
check('facts spot money handling', ecomFacts.hasPayments, true);
check('facts spot no realtime', ecomFacts.hasRealtime, false);
check('ecommerce gets a layering', Boolean(ecomArch.layering.choice), true);
check('  ...with reasons', ecomArch.layering.reasons.length > 0, true);
check('  ...and what breaks', Boolean(ecomArch.layering.breaksAt), true);
check('ecommerce gets a topology', Boolean(ecomArch.topology.choice), true);
check('  ...and it is not services', ecomArch.topology.choice === 'services', false);

// ------------- THE ONE THAT MATTERS: services must never win for a solo dev
let soloServices = [];
for (const scale of SCALES) {
  for (const hosting of ANSWERS.hosting.options.map((o) => o.value)) {
    for (const moduleCount of [0, 3, 8, 15, 25]) {
      const answers = { team: 'solo', userScale: scale, hosting, readWrite: 'balanced', consistency: 'strong' };
      const stack = recommendStack(answers);
      const arch = recommendArchitecture(answers, { moduleCount, stack, hasPayments: true, hasRealtime: false });
      if (arch.topology.choice === 'services') {
        soloServices.push(`${scale}/${hosting}/${moduleCount}`);
      }
    }
  }
}
check('services never wins for a solo developer', soloServices, []);

// And its objection has to be visible, not just its score low.
const soloArch = recommendArchitecture(
  { team: 'solo', userScale: 'large', consistency: 'strong' },
  { moduleCount: 20, stack: [], hasPayments: true }
);
const servicesAlt = soloArch.topology.alternatives.find((a) => a.choice === 'services');
check('services is still shown to a solo developer', Boolean(servicesAlt), true);
check('  ...marked as ruled out', servicesAlt?.ruledOut, true);
check('  ...with the reason why', servicesAlt?.tradeoff.includes('operations'), true);

// Both team and scale, not either. At that extreme it becomes a live option
// rather than an automatic answer: a modular monolith is still defensible
// there, and the toss-up flag is the honest way to say so.
const bigBoth = recommendArchitecture(
  { team: 'large', userScale: 'large', consistency: 'strong' },
  { moduleCount: 20, stack: [], hasPayments: true }
);
const servicesLive =
  bigBoth.topology.choice === 'services' ||
  bigBoth.topology.alternatives.some((a) => a.choice === 'services' && !a.ruledOut);
check('services becomes a live option at large team AND large scale', servicesLive, true);
check('  ...and the engine admits it is close', bigBoth.topology.tossUp, true);
const bigTeamOnly = recommendArchitecture(
  { team: 'large', userScale: 'small' },
  { moduleCount: 6, stack: [] }
);
check('  ...but not on a large team alone', bigTeamOnly.topology.choice === 'services', false);

// ---------------------------------------------- the engine can say "small"
const hobby = { team: 'solo', userScale: 'hobby', consistency: 'eventual-ok', hosting: 'self-hosted' };
const hobbyArch = recommendArchitecture(hobby, { moduleCount: 3, stack: [], hasPayments: false });
check('a personal project gets a monolith', hobbyArch.topology.choice, 'monolith');
check('  ...and the simplest layering', ['mvc', 'layered'].includes(hobbyArch.layering.choice), true);
check('  ...not clean architecture', hobbyArch.layering.choice === 'clean', false);
check('  ...not hexagonal', hobbyArch.layering.choice === 'hexagonal', false);

// Many features and many people should move the answer.
const bigArch = recommendArchitecture(
  { team: 'large', userScale: 'growing', consistency: 'strong' },
  { moduleCount: 18, stack: [], hasPayments: true }
);
check('many modules and a large team earn feature modules', ['modular', 'clean'].includes(bigArch.layering.choice), true);
check('  ...and a modular monolith', bigArch.topology.choice, 'modular-monolith');

// ---------------------------------------------------------- no answers
const blank = recommendArchitecture({}, { moduleCount: 0, stack: [] });
check('no answers means no layering', blank.layering.undecided, true);
check('  ...and no topology', blank.topology.undecided, true);
check('  ...and nothing invented', blank.layering.choice, null);
check('  ...so nothing reaches the saved rows', toArchitectureRows(blank).layering.choice, '');

// ---------------------------------------------------- topology reads layering
const modularFirst = recommendArchitecture(
  { team: 'large', userScale: 'growing' },
  { moduleCount: 12, stack: [] }
);
check(
  'topology can cite the layering it follows',
  modularFirst.topology.reasons.some((r) => r.includes('organised by feature')),
  true
);

// ------------------------------------------------------------- concerns
const ecomConcerns = recommendConcerns(ecomAnswers, ecomFacts, ecomArch);
check('one row per concern', ecomConcerns.length, 9);
check('every concern is decided', ecomConcerns.every((c) => !c.undecided), true);
check('every decision carries a reason', ecomConcerns.every((c) => c.reason.length > 0), true);
check('  ...and the keys are the documented ones', ecomConcerns.map((c) => c.key), CONCERN_KEYS);

const byKey = Object.fromEntries(ecomConcerns.map((c) => [c.key, c]));
check('a same-site app gets cookie auth', byKey.auth.choice, 'session-cookie');
check('strong consistency does not get manual validation', byKey.validation.choice === 'manual', false);
check('growing scale gets structured logs', byKey.logging.choice, 'structured-json');
check('a relational database gets migrations', byKey.migrations.choice, 'orm-migrations');

// "none yet" has to be reachable, or the tool cannot say "not needed".
const tinyConcerns = recommendConcerns(hobby, { moduleCount: 2, stack: [] }, hobbyArch);
const tinyByKey = Object.fromEntries(tinyConcerns.map((c) => [c.key, c]));
check('a hobby project needs no queue', tinyByKey.jobs.choice, 'none');
check('  ...and says why', tinyByKey.jobs.reason.includes('second thing that can break'), true);
check('  ...and gets plain console logs', tinyByKey.logging.choice, 'console');
check('  ...but still rate-limits the auth routes', tinyByKey.rateLimit.choice, 'sensitive-routes');

// Serverless changes the auth answer, which is the point of reading the stack.
const serverlessConcerns = recommendConcerns(
  { hosting: 'serverless', team: 'solo', userScale: 'small' },
  { moduleCount: 4, stack: [] },
  {}
);
check('serverless gets a bearer token', serverlessConcerns.find((c) => c.key === 'auth').choice, 'jwt-bearer');

// A document store has no migrations to run, and says so rather than staying blank.
const mongoConcerns = recommendConcerns(
  { dataShape: 'document', consistency: 'eventual-ok', team: 'small', userScale: 'small' },
  { moduleCount: 5, stack: recommendStack({ dataShape: 'document', consistency: 'eventual-ok' }) },
  {}
);
check('a document store gets no migrations', mongoConcerns.find((c) => c.key === 'migrations').choice, 'none');

check('concern rows drop the undecided ones', toConcernRows(ecomConcerns).length, 9);
check('  ...and start un-overridden', toConcernRows(ecomConcerns).every((r) => r.overridden === false), true);

// ------------------------------------------------------------- overrides
const overridden = applyArchitectureOverrides(ecomArch, { layering: 'hexagonal' }, ecomAnswers, ecomFacts);
check('an override replaces the engine pick', overridden.layering.choice, 'hexagonal');
check('  ...and is marked as yours', overridden.layering.overridden, true);
check('  ...remembering what the engine wanted', overridden.layering.enginePick.choice, ecomArch.layering.choice);
check('  ...and is no longer a toss-up', overridden.layering.tossUp, false);
// Overriding shows that choice's real reasoning under the current answers, so
// you can see what you are trading away rather than only that you disagreed.
check('  ...carrying that choice’s own reasons', overridden.layering.reasons.length > 0, true);
check('  ...and what it breaks at', Boolean(overridden.layering.breaksAt), true);
// MVC at ten modules has a live objection, and overriding to it must surface
// that rather than quietly presenting the choice as unopposed.
const toMvc = applyArchitectureOverrides(ecomArch, { layering: 'mvc' }, ecomAnswers, ecomFacts);
check('  ...and a bad choice keeps its objections', toMvc.layering.concerns.length > 0, true);
check('  ...naming the actual problem', toMvc.layering.concerns[0].includes('navigable'), true);
check('the other dimension is untouched', overridden.topology.choice, ecomArch.topology.choice);
check('overriding to the engine pick is a no-op', applyArchitectureOverrides(ecomArch, { layering: ecomArch.layering.choice }, ecomAnswers, ecomFacts).layering.overridden, undefined);
check('an unknown choice is ignored', applyArchitectureOverrides(ecomArch, { layering: 'nope' }, ecomAnswers, ecomFacts).layering.choice, ecomArch.layering.choice);

// An undecided dimension can be settled by hand, which is what makes a blank
// plan usable rather than stuck.
const settled = applyArchitectureOverrides(blank, { topology: 'monolith' }, {}, { moduleCount: 0, stack: [] });
check('an undecided dimension can be picked by hand', settled.topology.choice, 'monolith');
check('  ...and stops being undecided', settled.topology.undecided, false);
check('  ...and reaches the saved rows', toArchitectureRows(settled).topology.choice, 'monolith');

// Notes are yours, and no re-run may discard them.
const withNotes = toArchitectureRows(ecomArch, { layering: 'we already know this shape' });
check('a note survives into the saved row', withNotes.layering.note, 'we already know this shape');
check('  ...and an absent one is empty', withNotes.topology.note, '');

const overriddenConcerns = applyConcernOverrides(ecomConcerns, { jobs: 'external-queue' });
const jobsRow = overriddenConcerns.find((c) => c.key === 'jobs');
check('a concern override applies', jobsRow.choice, 'external-queue');
check('  ...is marked as yours', jobsRow.overridden, true);
check('  ...remembers the engine pick', jobsRow.enginePick.choice, byKey.jobs.choice);
// The engine did not argue for it, so there is no rule to quote.
check('  ...and quotes no rule it did not apply', jobsRow.reason, '');
check('other concerns are untouched', overriddenConcerns.find((c) => c.key === 'auth').choice, byKey.auth.choice);
check('an unknown concern choice is ignored', applyConcernOverrides(ecomConcerns, { jobs: 'nope' }).find((c) => c.key === 'jobs').choice, byKey.jobs.choice);
check('concern overrides reach the saved rows', toConcernRows(overriddenConcerns).find((r) => r.key === 'jobs').overridden, true);
check('concern notes survive', toConcernRows(ecomConcerns, { auth: 'same-site only' }).find((r) => r.key === 'auth').note, 'same-site only');

// ------------------------------------------------------------- folders
const stackFor = (backend, frontend) => [
  { layer: 'backend', choice: backend },
  { layer: 'frontend', choice: frontend },
];

const layeredTree = generateFolders({
  stack: stackFor('express', 'react-vite'),
  layering: 'layered',
  moduleKeys: ['auth', 'orders'],
});
check('generates a tree', layeredTree.length > 0, true);
check('  with horizontal folders', layeredTree.some((n) => n.path === 'server/src/services'), true);
check('  and no per-module folder', layeredTree.some((n) => n.path.includes('modules/orders')), false);
check('  plus the frontend', layeredTree.some((n) => n.path === 'client/src/pages'), true);
check('  and a tests folder', layeredTree.some((n) => n.path === 'server/tests'), true);

const modularTree = generateFolders({
  stack: stackFor('express', 'react-vite'),
  layering: 'modular',
  moduleKeys: ['auth', 'orders'],
});
check('modular puts a feature in one folder', modularTree.some((n) => n.path === 'server/src/modules/orders'), true);
check('  with its own service file', modularTree.some((n) => n.path === 'server/src/modules/orders/orders.service.js'), true);
check('  and no horizontal services folder', modularTree.some((n) => n.path === 'server/src/services'), false);

// The whole reason folders are tied to layering rather than to the framework.
check('changing the layering changes the tree', JSON.stringify(layeredTree) === JSON.stringify(modularTree), false);

const hexTree = generateFolders({ stack: stackFor('express', null), layering: 'hexagonal', moduleKeys: ['orders'] });
check('hexagonal isolates the domain', hexTree.some((n) => n.path.startsWith('src/domain')), true);
check('  ...and with no frontend the server is the root', hexTree.every((n) => !n.path.startsWith('server/')), true);

const nestTree = generateFolders({ stack: stackFor('nestjs', null), layering: 'layered', moduleKeys: ['orders'] });
check('nest keeps its own conventions', nestTree.some((n) => n.path === 'src/orders/orders.module.ts'), true);

const nextTree = generateFolders({ stack: stackFor('express', 'nextjs'), layering: 'layered', moduleKeys: [] });
check('next gets an app directory', nextTree.some((n) => n.path === 'client/app'), true);

// A module you named yourself gets a folder with your name on it.
const customTree = generateFolders({
  stack: stackFor('express', null),
  layering: 'modular',
  moduleKeys: ['auth', 'referrals'],
  customModules: [{ key: 'referrals', name: 'Referrals' }],
});
check('a custom module gets its own folder', customTree.some((n) => n.path === 'src/modules/referrals'), true);
check('  ...with its files', customTree.some((n) => n.path === 'src/modules/referrals/referrals.service.js'), true);
check('an unknown key is ignored', customTree.some((n) => n.path.includes('nonexistent')), false);

// Shape guarantees the server-side validator also enforces.
const everyTree = generateFolders({
  stack: stackFor('express', 'react-vite'),
  layering: 'modular',
  moduleKeys: ecomModules,
});
check('paths are unique', new Set(everyTree.map((n) => n.path)).size, everyTree.length);
check('paths are relative', everyTree.every((n) => !n.path.startsWith('/')), true);
check('no traversal', everyTree.every((n) => !n.path.includes('..')), true);
check('no empty segments', everyTree.every((n) => !n.path.includes('//')), true);
check('no path is too deep', everyTree.every((n) => n.path.split('/').length <= 8), true);
check('every node has a kind', everyTree.every((n) => n.kind === 'folder' || n.kind === 'file'), true);
check(
  'sorted, so a diff is readable',
  everyTree.every((node, i) => i === 0 || everyTree[i - 1].path.localeCompare(node.path) <= 0),
  true
);
check('stays under the server cap', everyTree.length < 400, true);
check('no stack means no tree', generateFolders({ stack: [], layering: 'modular', moduleKeys: ['auth'] }), []);

// ------------------------------------------------------ tree editing
const flat = [
  { path: 'server/src/modules/orders', kind: 'folder', note: '' },
  { path: 'server/src/modules/orders/orders.service.js', kind: 'file', note: 'Logic' },
  { path: 'server/src/modules/auth', kind: 'folder', note: '' },
  { path: 'server/src/app.js', kind: 'file', note: '' },
];

// --- path validation, mirroring what the server enforces ---
check('accepts a plain path', isValidPath('server/src'), true);
check('accepts a file', isValidPath('server/src/app.js'), true);
check('rejects an absolute path', isValidPath('/etc/passwd'), false);
check('rejects traversal', isValidPath('server/../etc'), false);
check('rejects a backslash', isValidPath('server\\src'), false);
check('rejects an empty segment', isValidPath('server//src'), false);
check('rejects a space', isValidPath('server/my src'), false);
check('rejects eight levels deep', isValidPath('a/b/c/d/e/f/g/h/i'), false);
check('rejects an empty path', isValidPath(''), false);
check('a segment cannot be dotdot', isValidSegment('..'), false);
check('a segment cannot hold a slash', isValidSegment('a/b'), false);

// --- subtree ---
check('a folder owns its descendants', subtreeOf(flat, 'server/src/modules/orders').length, 2);
check('a file owns only itself', subtreeOf(flat, 'server/src/app.js').length, 1);
// A sibling whose name merely starts the same must not be swept in.
check('a name prefix is not a descendant', subtreeOf(
  [{ path: 'src/order' }, { path: 'src/orders' }], 'src/order'
).length, 1);

// --- rename ---
const renamed = renameNode(flat, 'server/src/modules/orders', 'sales');
check('rename moves the folder', renamed.nodes.some((n) => n.path === 'server/src/modules/sales'), true);
// Children follow, or the rename orphans them.
check('  ...and its children follow', renamed.nodes.some((n) => n.path.startsWith('server/src/modules/sales/')), true);
check('  ...reporting how many moved', renamed.moved, 2);
// The feature-module layout names files for their folder, so a file named
// after the old folder follows the rename rather than contradicting it.
check('  ...renaming files named after the folder', renamed.nodes.some((n) => n.path === 'server/src/modules/sales/sales.service.js'), true);
check('  ...and saying how many', renamed.renamedChildren, 1);
check('  ...keeping notes', renamed.nodes.find((n) => n.path.endsWith('.service.js')).note, 'Logic');

// Anything not named after the folder is left alone: guessing further would be
// renaming files nobody asked about.
const mixed = [
  { path: 'src/utils', kind: 'folder', note: '' },
  { path: 'src/utils/utils.js', kind: 'file', note: '' },
  { path: 'src/utils/format.js', kind: 'file', note: '' },
  { path: 'src/utils/utilities.js', kind: 'file', note: '' },
  { path: 'src/utils/nested/utils.js', kind: 'file', note: '' },
];
const renamedMixed = renameNode(mixed, 'src/utils', 'helpers');
check('a matching file follows', renamedMixed.nodes.some((n) => n.path === 'src/helpers/helpers.js'), true);
check('  ...an unrelated one does not', renamedMixed.nodes.some((n) => n.path === 'src/helpers/format.js'), true);
check('  ...a near-miss prefix does not', renamedMixed.nodes.some((n) => n.path === 'src/helpers/utilities.js'), true);
check('  ...and a nested one is its own business', renamedMixed.nodes.some((n) => n.path === 'src/helpers/nested/utils.js'), true);
check('  ...counted honestly', renamedMixed.renamedChildren, 1);
check('  ...and leaving siblings alone', renamed.nodes.some((n) => n.path === 'server/src/modules/auth'), true);
check('rename to an invalid name is refused', renameNode(flat, 'server/src/modules/orders', 'my folder'), null);
check('rename onto an existing sibling is refused', renameNode(flat, 'server/src/modules/orders', 'auth'), null);

// --- move ---
const moved = repath(flat, 'server/src/modules/orders', 'server/src/features/orders');
check('a move re-paths the subtree', moved.nodes.some((n) => n.path === 'server/src/features/orders/orders.service.js'), true);
check('moving a folder into itself is refused', repath(flat, 'server/src/modules', 'server/src/modules/nested'), null);
check('moving to an invalid path is refused', repath(flat, 'server/src/app.js', '../app.js'), null);
check('moving something that is not there is refused', repath(flat, 'nope', 'src'), null);
check('moving to the same place is a no-op', repath(flat, 'server/src/app.js', 'server/src/app.js').moved, 0);

// --- delete ---
const deleted = removeSubtree(flat, 'server/src/modules/orders');
check('delete takes the subtree', deleted.nodes.length, 2);
check('  ...and says what went', deleted.removed.length, 2);
check('  ...leaving the rest', deleted.nodes.some((n) => n.path === 'server/src/app.js'), true);
check('deleting nothing is refused', removeSubtree(flat, 'nope'), null);

// --- add ---
check('adds a folder', addNode(flat, 'server/src/config').nodes.some((n) => n.path === 'server/src/config'), true);
check('adds a file with its kind', addNode(flat, 'server/src/index.js', 'file').nodes.find((n) => n.path === 'server/src/index.js').kind, 'file');
check('adding a duplicate is refused', addNode(flat, 'server/src/app.js'), null);
check('adding an invalid path is refused', addNode(flat, '../evil'), null);
check('added nodes stay sorted', (() => {
  const paths = addNode(flat, 'server/src/aaa').nodes.map((n) => n.path);
  return paths.every((p, i) => i === 0 || paths[i - 1].localeCompare(p) <= 0);
})(), true);

check('a note can be set', setNote(flat, 'server/src/app.js', 'Wiring only').find((n) => n.path === 'server/src/app.js').note, 'Wiring only');

// --- building the display tree ---
const tree = buildTree(flat);
check('the tree has one root', tree.length, 1);
check('  ...named for the first segment', tree[0].name, 'server');
// The generator never emits `server` or `server/src` on their own, but the
// tree still has to show them.
check('  ...synthesised, since nothing declared it', tree[0].implicit, true);
check('  ...with src beneath it', tree[0].children[0].name, 'src');
const src = tree[0].children[0];
check('folders come before files', src.children[0].kind, 'folder');
check('  ...and the file is last', src.children[src.children.length - 1].name, 'app.js');
check('a declared node is not implicit', src.children.find((c) => c.name === 'modules').children[0].implicit, false);
check('notes reach the tree', buildTree(flat)[0].children[0].children.find((c) => c.name === 'app.js').note, '');
check('an empty list builds nothing', buildTree([]), []);
// A folder that is both declared and a parent keeps its own note.
check('a declared parent keeps its note', buildTree([
  { path: 'src', kind: 'folder', note: 'Everything' },
  { path: 'src/app.js', kind: 'file', note: '' },
])[0].note, 'Everything');
check('  ...and still shows its child', buildTree([
  { path: 'src', kind: 'folder', note: 'Everything' },
  { path: 'src/app.js', kind: 'file', note: '' },
])[0].children.length, 1);

// Whatever editing does, the result must still satisfy the server.
const edited = renameNode(addNode(flat, 'server/src/utils').nodes, 'server/src/modules', 'features').nodes;
check('edited paths stay valid', edited.every((n) => isValidPath(n.path)), true);
check('  ...and unique', new Set(edited.map((n) => n.path)).size, edited.length);

// --------------------------------------------------------- the signature
const sigA = folderSignature({ stack: stackFor('express', 'react-vite'), layering: 'modular', moduleKeys: ['auth', 'orders'] });
check('the signature is stable', sigA, folderSignature({ stack: stackFor('express', 'react-vite'), layering: 'modular', moduleKeys: ['orders', 'auth'] }));
check('changing the layering changes it', sigA === folderSignature({ stack: stackFor('express', 'react-vite'), layering: 'layered', moduleKeys: ['auth', 'orders'] }), false);
check('changing the modules changes it', sigA === folderSignature({ stack: stackFor('express', 'react-vite'), layering: 'modular', moduleKeys: ['auth'] }), false);
// Same count, different modules: a count alone would miss this.
check(
  'swapping one module for another changes it',
  sigA === folderSignature({ stack: stackFor('express', 'react-vite'), layering: 'modular', moduleKeys: ['auth', 'cart'] }),
  false
);
check('it fits the stored field', sigA.length < 200, true);

// ------------------------------------------------ every preset holds up
for (const presetKey of PRESET_KEYS) {
  const answers = { ...defaultAnswersFor(presetKey), userScale: 'growing', team: 'small', hosting: 'managed' };
  const stack = recommendStack(answers);
  const keys = resolveDependencies(suggestedModulesFor(presetKey)).keys;
  const facts = architectureFacts({ moduleKeys: keys, answers }, stack);
  const arch = recommendArchitecture(answers, facts);
  const concerns = recommendConcerns(answers, facts, arch);

  check(`${presetKey}: picks a layering`, Boolean(arch.layering.choice), true);
  check(`${presetKey}: picks a topology`, Boolean(arch.topology.choice), true);
  check(`${presetKey}: every architecture decision is reasoned`, [arch.layering, arch.topology].every((r) => r.reasons.length > 0), true);
  check(`${presetKey}: every concern is decided`, concerns.every((c) => !c.undecided), true);
  check(`${presetKey}: never microservices at this size`, arch.topology.choice === 'services', false);

  if (keys.length) {
    const tree = generateFolders({ stack, layering: arch.layering.choice, moduleKeys: keys });
    check(`${presetKey}: generates folders`, tree.length > 0, true);
    check(`${presetKey}: paths unique`, new Set(tree.map((n) => n.path)).size, tree.length);
  }
}

console.log(failures === 0 ? '\nAll architecture checks passed.' : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
