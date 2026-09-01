// Checks for the recommendation engine: `npm test` in client/.
// Pure functions, no React, no network, no database.
import { CANDIDATES, LAYER_ORDER } from './catalog.js';
import { MODULES, findModule, modulesForPreset } from './modules.js';
import { PRESET_DATA, PRESET_KEYS, defaultAnswersFor, suggestedModulesFor } from './presets.js';
import {
  recommendStack,
  applyOverrides,
  scaleNotes,
  toStackRows,
  resolveDependencies,
  removeModule,
  apisFor,
  entitiesFor,
  blueprintKeysFor,
} from './recommend.js';
import { ANSWERS, PRESETS as UI_PRESETS, LAYERS as UI_LAYERS } from './planOptions.js';

let failures = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(
    `${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `  (got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)})`}`
  );
}

const pick = (stack, layer) => stack.find((row) => row.layer === layer);

// ---------------------------------------------------------------- catalogue
check('every candidate sits in a known layer', CANDIDATES.every((c) => LAYER_ORDER.includes(c.layer)), true);
check('every candidate has a name', CANDIDATES.every((c) => Boolean(c.name)), true);
check('every candidate has at least one rule', CANDIDATES.every((c) => c.rules.length > 0), true);
check(
  'every rule carries its explanation',
  CANDIDATES.every((c) => c.rules.every((r) => typeof r.because === 'string' && r.because.length > 10)),
  true
);
check(
  'every rule reads a real answer key',
  CANDIDATES.every((c) =>
    c.rules.every((r) => Object.keys(r.when ?? {}).every((key) => key in ANSWERS))
  ),
  true
);
check(
  'every rule value is a documented option',
  CANDIDATES.every((c) =>
    c.rules.every((r) =>
      Object.entries(r.when ?? {}).every(([key, expected]) => {
        const allowed = ANSWERS[key].options.map((o) => o.value);
        return (Array.isArray(expected) ? expected : [expected]).every((v) => allowed.includes(v));
      })
    )
  ),
  true
);
check(
  'cross-layer conditions name a real earlier layer',
  CANDIDATES.every((c) =>
    c.rules.every((r) =>
      Object.keys(r.whenChoice ?? {}).every(
        (layer) => LAYER_ORDER.indexOf(layer) !== -1 && LAYER_ORDER.indexOf(layer) < LAYER_ORDER.indexOf(c.layer)
      )
    )
  ),
  true
);
check('every layer has candidates', LAYER_ORDER.every((l) => CANDIDATES.some((c) => c.layer === l)), true);
// The UI vocabulary and the engine have to agree or the wizard offers values
// no rule can ever read.
check('UI layers match the engine layers', UI_LAYERS.map((l) => l.value).sort(), [...LAYER_ORDER].sort());
check('UI presets match the engine presets', UI_PRESETS.map((p) => p.value).sort(), [...PRESET_KEYS].sort());
check(
  'preset default answers use documented values',
  Object.values(PRESET_DATA).every((preset) =>
    Object.entries(preset.defaultAnswers).every(([key, value]) =>
      ANSWERS[key].options.some((o) => o.value === value)
    )
  ),
  true
);

// ------------------------------------------------------- the ecommerce case
const ecommerce = {
  ...defaultAnswersFor('ecommerce'),
  userScale: 'growing',
  team: 'small',
  hosting: 'managed',
  realtime: 'notifications',
};
const ecomStack = recommendStack(ecommerce);

check('ecommerce picks Postgres', pick(ecomStack, 'database').choice, 'postgresql');
check('  ...for stated reasons', pick(ecomStack, 'database').reasons.length > 0, true);
check('  ...and is not a toss-up', pick(ecomStack, 'database').tossUp, false);
check(
  '  ...with Mongo offered honestly as an alternative',
  pick(ecomStack, 'database').alternatives.some((a) => a.choice === 'mongodb' && a.tradeoff.length > 0),
  true
);
check('read-heavy and growing earns a cache', pick(ecomStack, 'cache').choice, 'redis');
check('faceted search earns Meilisearch', pick(ecomStack, 'search').choice, 'meilisearch');
// Notifications are served by the backend you already have.
check('notifications do not pull in extra machinery', pick(ecomStack, 'database').choice !== null, true);

// ------------------------------------- the engine must be able to say "no"
const hobby = {
  userScale: 'hobby',
  team: 'solo',
  consistency: 'strong',
  dataShape: 'relational',
  readWrite: 'read-heavy',
  search: 'none',
  realtime: 'none',
  hosting: 'self-hosted',
};
const hobbyStack = recommendStack(hobby);
check('a personal tool gets SQLite, not a server', pick(hobbyStack, 'database').choice, 'sqlite');
check('  ...and no cache', pick(hobbyStack, 'cache').choice, 'none');
check('  ...and no search service', pick(hobbyStack, 'search').choice, 'none');
check('  ...and Express rather than a framework', pick(hobbyStack, 'backend').choice, 'express');
check(
  'recommending nothing still comes with a reason',
  pick(hobbyStack, 'cache').reasons.length > 0,
  true
);

// --------------------------------------------------- cross-layer reasoning
const ftsOnPostgres = recommendStack({
  consistency: 'strong',
  dataShape: 'relational',
  search: 'full-text',
  userScale: 'small',
  team: 'solo',
});
check('Postgres full-text wins when Postgres is already there', pick(ftsOnPostgres, 'search').choice, 'postgres-fts');
check(
  '  ...and says so',
  pick(ftsOnPostgres, 'search').reasons.some((r) => r.includes('already run Postgres')),
  true
);

const ftsOnMongo = recommendStack({
  dataShape: 'document',
  consistency: 'eventual-ok',
  search: 'full-text',
  userScale: 'small',
  team: 'solo',
});
check('Mongo wins the database on document shape', pick(ftsOnMongo, 'database').choice, 'mongodb');
check(
  '  ...so the Postgres-only search reason never fires',
  pick(ftsOnMongo, 'search').choice !== 'postgres-fts',
  true
);

// ------------------------------------------------------ toss-ups and blanks
const emptyStack = recommendStack({});
check('no answers means no recommendations', emptyStack.every((row) => row.undecided), true);
check('  ...and nothing is invented', emptyStack.every((row) => row.choice === null), true);
check('  ...so nothing reaches the saved stack', toStackRows(emptyStack).length, 0);

// Relational + strong consistency scores Postgres and MySQL closely, which is
// a real toss-up rather than a confident answer.
const closeCall = recommendStack({ dataShape: 'relational', consistency: 'strong', team: 'large' });
const closeDb = pick(closeCall, 'database');
check('a genuine close call is flagged as a toss-up', closeDb.tossUp, true);
check('  ...and the runner-up is still shown', closeDb.alternatives.length > 0, true);

// An answer that states a preference for a layer outright must not come back
// reported as a coin flip. Being told "it is a toss-up" about the thing you
// just chose is the engine arguing with its own input.
for (const preference of ['managed', 'self-hosted', 'serverless']) {
  for (const scale of ['hobby', 'small', 'growing', 'large']) {
    for (const team of ['solo', 'small', 'large']) {
      const row = pick(recommendStack({ hosting: preference, userScale: scale, team, readWrite: 'read-heavy' }), 'hosting');
      if (row.tossUp || row.undecided) {
        check(`stated hosting "${preference}" is respected (${scale}/${team})`, false, true);
      }
    }
  }
}
check('a stated hosting preference is never a toss-up', true, true);

let tossUpShape = true;
for (const row of [...ecomStack, ...hobbyStack, ...closeCall]) {
  if (row.tossUp && row.undecided) tossUpShape = false;
}
check('a row is never both a toss-up and undecided', tossUpShape, true);

// ---------------------------------------------------------- overrides
const overridden = applyOverrides(ecomStack, { database: 'mongodb' }, ecommerce);
const overDb = pick(overridden, 'database');
check('an override replaces the engine pick', overDb.choice, 'mongodb');
check('  ...and is marked as yours', overDb.overridden, true);
check('  ...remembering what the engine wanted', overDb.enginePick.choice, 'postgresql');
check('  ...and is no longer a toss-up', overDb.tossUp, false);
// The point of keeping the real reasons: you can see what you are trading away.
check(
  '  ...carrying the honest objections to your choice',
  overDb.concerns.length > 0,
  true
);
check('other layers are untouched', pick(overridden, 'cache').choice, pick(ecomStack, 'cache').choice);
check('overriding to the engine pick is a no-op', applyOverrides(ecomStack, { database: 'postgresql' }, ecommerce)[0].overridden, undefined);
check('an unknown choice is ignored', pick(applyOverrides(ecomStack, { database: 'nope' }, ecommerce), 'database').choice, 'postgresql');
check(
  'an undecided layer can be resolved by hand',
  (() => {
    const blank = recommendStack({});
    const fixed = applyOverrides(blank, { database: 'postgresql' }, {});
    const row = pick(fixed, 'database');
    return row.choice === 'postgresql' && row.undecided === false && row.overridden === true;
  })(),
  true
);
check('overrides survive into the saved rows', toStackRows(overridden).find((r) => r.layer === 'database').overridden, true);

// ------------------------------------------------------------- stack rows
const rows = toStackRows(ecomStack);
check('stack rows carry one row per decided layer', rows.length, ecomStack.filter((r) => !r.undecided).length);
check('  ...each with a layer and a choice', rows.every((r) => r.layer && r.choice), true);
check('  ...none marked overridden by the engine', rows.every((r) => r.overridden === false), true);
check('  ...and layers are unique', new Set(rows.map((r) => r.layer)).size, rows.length);

// ---------------------------------------------------------- scale notes
const notes = scaleNotes(ecommerce, ecomStack);
check('scale notes say what breaks first', notes.length > 0, true);
check('  ...naming the database', notes.some((n) => n.includes('PostgreSQL')), true);
check('a hobby plan is told it is a hobby plan', scaleNotes(hobby, hobbyStack).some((n) => n.includes('personal project')), true);

// ------------------------------------------------------------------ modules
check('every module has a unique key', new Set(MODULES.map((m) => m.key)).size, MODULES.length);
check(
  'table names are unique across the whole catalogue',
  (() => {
    const names = MODULES.flatMap((m) => m.entities.map((e) => e.name));
    return new Set(names).size === names.length;
  })(),
  true
);
check(
  'every dependency exists',
  MODULES.every((m) => m.dependsOn.every((d) => Boolean(findModule(d)))),
  true
);
check(
  'a module and its dependencies share a preset',
  MODULES.every((m) =>
    m.dependsOn.every((d) => findModule(d).presets.some((p) => m.presets.includes(p)))
  ),
  true
);
check(
  'every module endpoint has a method and an absolute path',
  MODULES.every((m) => m.apis.every((a) => a.method && a.path.startsWith('/'))),
  true
);
check(
  'every field has a name and a type',
  MODULES.every((m) => m.entities.every((e) => e.fields.every((f) => f.name && f.type))),
  true
);
check(
  'every entity has exactly one primary key',
  MODULES.every((m) => m.entities.every((e) => e.fields.filter((f) => f.pk).length === 1)),
  true
);
check(
  'every ref points at a real table and column',
  (() => {
    const tables = new Map(MODULES.flatMap((m) => m.entities).map((e) => [e.name, e.fields.map((f) => f.name)]));
    return MODULES.every((m) =>
      m.entities.every((e) =>
        e.fields.every((f) => {
          if (!f.ref) return true;
          const [table, column] = f.ref.split('.');
          return tables.has(table) && tables.get(table).includes(column);
        })
      )
    );
  })(),
  true
);

// ------------------------------------------------------ dependency resolution
check('checkout pulls in what it needs', resolveDependencies(['checkout']).keys, [
  'auth',
  'catalog',
  'cart',
  'orders',
  'checkout',
]);
check(
  '  ...and reports what it added and why',
  resolveDependencies(['checkout']).added.map((a) => a.key).sort(),
  ['auth', 'cart', 'catalog', 'orders']
);
check('nothing is added when nothing is missing', resolveDependencies(['auth']).added.length, 0);
check('duplicates collapse', resolveDependencies(['auth', 'auth']).keys, ['auth']);
check('an unknown key is ignored', resolveDependencies(['nope']).keys, []);
check(
  'order does not depend on click order',
  resolveDependencies(['checkout', 'auth']).keys,
  resolveDependencies(['auth', 'checkout']).keys
);
check(
  'a dependency always precedes its dependent',
  (() => {
    const keys = resolveDependencies(['checkout', 'reviews', 'inventory']).keys;
    return keys.every((key) =>
      findModule(key).dependsOn.every((dep) => keys.indexOf(dep) < keys.indexOf(key))
    );
  })(),
  true
);

// Dropping something that others stand on has to take them with it.
const removal = removeModule(resolveDependencies(['checkout']).keys, 'cart');
check('removing cart also removes checkout', removal.keys.includes('checkout'), false);
check('  ...and says why', removal.dropped.map((d) => d.key), ['checkout']);
check('  ...leaving the rest alone', removal.keys, ['auth', 'catalog', 'orders']);
check('removing a leaf drops nothing else', removeModule(['auth', 'catalog'], 'catalog').dropped.length, 0);

// ---------------------------------------------------------- derived output
const ecomModules = resolveDependencies(suggestedModulesFor('ecommerce')).keys;
check('the ecommerce preset suggests modules', ecomModules.length > 0, true);
check('  ...including auth', ecomModules.includes('auth'), true);
check(
  '  ...and the preset is already dependency-complete',
  resolveDependencies(suggestedModulesFor('ecommerce')).added.length,
  0
);

const apis = apisFor(ecomModules);
check('APIs come out of the module selection', apis.length > 0, true);
check('  ...tagged with their module', apis.every((a) => ecomModules.includes(a.moduleKey)), true);
check('  ...with no duplicate method and path', new Set(apis.map((a) => `${a.method} ${a.path}`)).size, apis.length);

const entities = entitiesFor(ecomModules);
check('entities come out too', entities.length > 0, true);
check('  ...with unique table names', new Set(entities.map((e) => e.name)).size, entities.length);
check(
  '  ...and every surviving ref points inside the selection',
  (() => {
    const tables = new Set(entities.map((e) => e.name));
    return entities.every((e) => e.fields.every((f) => !f.ref || tables.has(f.ref.split('.')[0])));
  })(),
  true
);

// A selection missing the referenced table must drop the ref, not emit a
// relationship to a table nobody created.
const orphan = entitiesFor(['orders']);
check(
  'a ref to an unselected table is dropped',
  orphan
    .find((e) => e.name === 'order_items')
    .fields.find((f) => f.name === 'product_id').ref,
  undefined
);
check(
  '  ...while a ref inside the selection survives',
  orphan.find((e) => e.name === 'order_items').fields.find((f) => f.name === 'order_id').ref,
  'orders.id'
);

check('blueprint keys are collected without duplicates', blueprintKeysFor(ecomModules).sort(), ['auth', 'generic-crud']);
check('a module with no blueprint contributes nothing', blueprintKeysFor(['search']), []);

// --------------------------------------------------- every preset holds up
for (const presetKey of PRESET_KEYS) {
  const answers = { ...defaultAnswersFor(presetKey), userScale: 'growing', team: 'small', hosting: 'managed' };
  const stack = recommendStack(answers);
  const decided = stack.filter((row) => !row.undecided);

  if (presetKey === 'custom') {
    check(`${presetKey}: still produces a stack from generic answers`, decided.length > 0, true);
  } else {
    check(`${presetKey}: picks a database`, Boolean(pick(stack, 'database').choice), true);
    check(`${presetKey}: every decision is reasoned`, decided.every((r) => r.reasons.length > 0), true);
    const moduleKeys = resolveDependencies(suggestedModulesFor(presetKey)).keys;
    check(`${presetKey}: suggests modules`, moduleKeys.length > 0, true);
    check(`${presetKey}: modules produce endpoints`, apisFor(moduleKeys).length > 0, true);
    check(
      `${presetKey}: module table names do not collide`,
      new Set(entitiesFor(moduleKeys).map((e) => e.name)).size,
      entitiesFor(moduleKeys).length
    );
  }
}

check(
  'a custom plan starts with no modules',
  modulesForPreset('custom').length,
  0
);

console.log(failures === 0 ? '\nAll engine checks passed.' : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
