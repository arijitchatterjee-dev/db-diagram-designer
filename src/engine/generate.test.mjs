// Checks for DBML generation and the handoff: `npm test` in client/.
// The important one is that everything generated actually parses, because a
// schema that does not open in the diagram tool is worse than none.
import { parseDbml } from '../utils/dbmlParser.js';
import { resolveDependencies, entitiesFor } from './recommend.js';
import { suggestedModulesFor, PRESET_KEYS } from './presets.js';
import { MODULE_KEYS } from './modules.js';
import {
  generateDbml,
  generationPlan,
  appendMissingTables,
  isUntouchedSchema,
  STARTER_DBML,
} from './generateDbml.js';

let failures = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(
    `${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `  (got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)})`}`
  );
}

const ecomModules = resolveDependencies(suggestedModulesFor('ecommerce')).keys;
const ecomEntities = entitiesFor(ecomModules);

// ------------------------------------------------------------- basic shape
const dbml = generateDbml(ecomEntities, { title: 'Storefront' });
check('generates something', dbml.length > 0, true);
check('carries the title as a comment', dbml.includes('// Storefront'), true);
check('declares every table', ecomEntities.every((e) => dbml.includes(`Table ${e.name} {`)), true);
check('marks primary keys', dbml.includes('id integer [pk, increment]'), true);
check('marks not null', dbml.includes('[not null]'), true);
check('marks unique', dbml.includes('unique'), true);
check('emits relationships', dbml.includes('Ref: '), true);
check('empty selection generates nothing', generateDbml([]), '');

// --------------------------------------- THE ONE THAT MATTERS: it must parse
for (const presetKey of PRESET_KEYS) {
  const keys = resolveDependencies(suggestedModulesFor(presetKey)).keys;
  const entities = entitiesFor(keys);
  if (entities.length === 0) {
    check(`${presetKey}: no modules, nothing to generate`, generateDbml(entities), '');
    continue;
  }

  const generated = generateDbml(entities, { title: presetKey });
  const parsed = await parseDbml(generated);

  check(`${presetKey}: generated DBML parses`, parsed.ok, true);
  if (!parsed.ok) {
    console.log(`      ${parsed.error.message} (line ${parsed.error.line})`);
    continue;
  }
  check(`${presetKey}: every table survived the round trip`, parsed.schema.tables.length, entities.length);
  check(
    `${presetKey}: every relationship resolved`,
    parsed.schema.refs.every((ref) =>
      parsed.schema.tables.some((t) => t.name === ref.source.table) &&
      parsed.schema.tables.some((t) => t.name === ref.target.table)
    ),
    true
  );
}

// Every module on its own must also produce parseable DBML, since a custom
// plan can select any combination.
let brokenModules = [];
for (const key of MODULE_KEYS) {
  const entities = entitiesFor(resolveDependencies([key]).keys);
  if (entities.length === 0) continue;
  const parsed = await parseDbml(generateDbml(entities));
  if (!parsed.ok) brokenModules.push(`${key}: ${parsed.error.message}`);
}
check('every module generates parseable DBML on its own', brokenModules, []);

// All of them at once, which is the worst case for name collisions.
const everything = entitiesFor(resolveDependencies(MODULE_KEYS).keys);
const allParsed = await parseDbml(generateDbml(everything));
check('the whole catalogue generates parseable DBML', allParsed.ok, true);
check('  ...with no duplicate tables', new Set(everything.map((e) => e.name)).size, everything.length);

// A self-reference is legal DBML and the catalogue has one.
const selfRef = generateDbml(entitiesFor(['catalog']));
check('handles a self-referencing table', selfRef.includes('Ref: categories.parent_id > categories.id'), true);
check('  ...and it parses', (await parseDbml(selfRef)).ok, true);

// ------------------------------------------------------- the safety analysis
const plan = generationPlan(STARTER_DBML, ecomEntities);
check('sees the existing tables', plan.existing.sort(), ['comments', 'posts', 'users']);
check('users overlaps with the plan', plan.overlapping, ['users']);
check('posts and comments are unaccounted for', plan.unaccounted.sort(), ['comments', 'posts']);
check('everything else would be added', plan.adding.includes('products'), true);
check('  ...and the overlap is not double counted', plan.adding.includes('users'), false);

const emptyPlan = generationPlan('', ecomEntities);
check('an empty document has nothing at risk', emptyPlan.unaccounted, []);
check('  ...and everything is an addition', emptyPlan.adding.length, ecomEntities.length);

// ---------------------------------------------------------------- appending
const appended = appendMissingTables(STARTER_DBML, ecomEntities);
check('appending keeps what was there', appended.includes('Table posts {'), true);
check('  ...keeps the original comments table', appended.includes('Table comments {'), true);
check('  ...does not duplicate users', appended.match(/Table users \{/g).length, 1);
check('  ...adds the new tables', appended.includes('Table products {'), true);
const appendedParse = await parseDbml(appended);
check('  ...and the result parses', appendedParse.ok, true);
if (!appendedParse.ok) console.log(`      ${appendedParse.error.message} (line ${appendedParse.error.line})`);

// A ref from a new table to a table that was already in the document must
// survive, since that table really is there.
check(
  '  ...keeps refs into pre-existing tables',
  appended.includes('Ref: carts.user_id > users.id'),
  true
);
check(
  'appending nothing new leaves the document identical',
  appendMissingTables(STARTER_DBML, entitiesFor(['auth'])).includes('Table roles {'),
  true
);
check(
  'appending into an empty document is just generating',
  appendMissingTables('', entitiesFor(['auth'])).includes('Table users {'),
  true
);

// Appending twice must not add the same tables again.
const twice = appendMissingTables(appended, ecomEntities);
check('appending twice is a no-op', twice, appended);

// ----------------------------------------------------- untouched detection
check('an empty schema is untouched', isUntouchedSchema(''), true);
check('whitespace only is untouched', isUntouchedSchema('   \n  '), true);
check('null is untouched', isUntouchedSchema(null), true);
check('the seeded template is untouched', isUntouchedSchema(STARTER_DBML), true);
check('  ...even with trailing whitespace', isUntouchedSchema(`${STARTER_DBML}\n\n`), true);
// Any edit at all counts as work. Failing this way costs a dialog; failing the
// other way destroys a schema.
check('one added table means touched', isUntouchedSchema(`${STARTER_DBML}\nTable x {\n  id integer\n}`), false);
check('one changed character means touched', isUntouchedSchema(STARTER_DBML.replace('title', 'headline')), false);
check('a different schema is touched', isUntouchedSchema('Table a {\n  id integer\n}'), false);

console.log(failures === 0 ? '\nAll generation checks passed.' : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
