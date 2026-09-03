// Checks that a module you defined yourself behaves like a built-in one, all
// the way through to the generated schema: `npm test` in client/.
import { parseDbml } from '../utils/dbmlParser.js';
import {
  moduleIndex,
  resolveDependencies,
  removeModule,
  apisFor,
  entitiesFor,
  blueprintKeysFor,
  tableOwners,
} from './recommend.js';
import {
  hydrateCustomModule,
  hydrateCustomModules,
  schemaToEntities,
  stripAll,
  blankModule,
  slugifyKey,
  validateModule,
  shadowWarning,
  KEY_PATTERN,
} from './customModules.js';
import { generateDbml } from './generateDbml.js';
import { generateFolders } from './folders.js';
import { MODULE_KEYS } from './modules.js';

let failures = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(
    `${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `  (got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)})`}`
  );
}

const REFERRALS_DBML = `Table referrals {
  id integer [pk, increment]
  referrer_id integer [not null]
  code varchar [not null, unique]
  created_at timestamp
}

Table referral_claims {
  id integer [pk, increment]
  referral_id integer [not null]
  claimed_by integer [not null]
}

Ref: referral_claims.referral_id > referrals.id
`;

const referrals = {
  key: 'referrals',
  name: 'Referrals',
  summary: 'Refer a friend, both get credit.',
  dbml: REFERRALS_DBML,
  apis: [
    { method: 'POST', path: '/api/referrals', purpose: 'Create a code', auth: true },
    { method: 'GET', path: '/api/referrals/:code', purpose: 'Look one up', auth: false },
  ],
  dependsOn: ['auth'],
  blueprintKey: 'generic-crud',
  libraryKey: '',
};

// ------------------------------------------------------------- hydration
const hydrated = await hydrateCustomModule(referrals);
check('parses the DBML into entities', hydrated.entities.length, 2);
check('  ...with no error', hydrated.parseError, null);
check('  ...keeping the table names', hydrated.entities.map((e) => e.name), ['referrals', 'referral_claims']);
check('  ...the primary key', hydrated.entities[0].fields[0].pk, true);
check('  ...increment', hydrated.entities[0].fields[0].increment, true);
check('  ...not null', hydrated.entities[0].fields[1].notNull, true);
check('  ...unique', hydrated.entities[0].fields[2].unique, true);
// The parser returns refs separately; folding them back onto the field is what
// makes a relationship survive into the generated schema.
check('folds the relationship onto its field', hydrated.entities[1].fields[1].ref, 'referrals.id');

const broken = await hydrateCustomModule({ key: 'x', name: 'X', dbml: 'Table broken {\n  id integer\n' });
check('a half-typed module does not throw', broken.entities, []);
check('  ...and reports the line', typeof broken.parseError.line, 'number');
const empty = await hydrateCustomModule({ key: 'x', name: 'X', dbml: '   ' });
check('an empty module is not an error', empty.parseError, null);
check('  ...and has no tables', empty.entities, []);

check('hydration is not persisted', Object.keys(stripAll([hydrated])[0]).includes('entities'), false);
check('  ...nor is the parse error', Object.keys(stripAll([hydrated])[0]).includes('parseError'), false);
check('  ...but everything else survives', stripAll([hydrated])[0].dbml, REFERRALS_DBML);

// ---------------------------------------------------------- the index
const index = moduleIndex([hydrated]);
check('custom modules join the catalogue', index.has('referrals'), true);
check('  ...alongside the built-ins', index.has('auth'), true);
check('  ...and the count grows by one', index.size, MODULE_KEYS.length + 1);
// Your product's idea of a module is more authoritative than the catalogue's.
const shadow = moduleIndex([{ key: 'auth', name: 'My auth', entities: [], apis: [], dependsOn: [] }]);
check('a custom module shadows a built-in', shadow.get('auth').name, 'My auth');
check('  ...without changing the count', shadow.size, MODULE_KEYS.length);

// ------------------------------------------------- the chain, end to end
const keys = resolveDependencies(['referrals'], [hydrated]).keys;
check('dependencies resolve through a custom module', keys, ['auth', 'referrals']);
check('  ...reporting what it pulled in', resolveDependencies(['referrals'], [hydrated]).added.map((a) => a.key), ['auth']);
check('  ...and a custom module sorts after the built-ins', keys[keys.length - 1], 'referrals');

const apis = apisFor(keys, [hydrated]);
check('its endpoints reach the API surface', apis.filter((a) => a.moduleKey === 'referrals').length, 2);
check('  ...tagged with the module', apis.find((a) => a.path === '/api/referrals').moduleKey, 'referrals');
check('  ...keeping a public endpoint public', apis.find((a) => a.path === '/api/referrals/:code').auth, false);

const entities = entitiesFor(keys, [hydrated]);
check('its tables reach the entity list', entities.some((e) => e.name === 'referrals'), true);
check('  ...alongside the built-in ones', entities.some((e) => e.name === 'users'), true);
check('its blueprint is collected', blueprintKeysFor(keys, [hydrated]).sort(), ['auth', 'generic-crud']);

// THE ONE THAT MATTERS: it has to come out the other end as parseable DBML.
const generated = generateDbml(entities, { title: 'With a custom module' });
check('the custom table is in the generated schema', generated.includes('Table referrals {'), true);
check('  ...with its columns', generated.includes('code varchar [not null, unique]'), true);
check('  ...and its relationship', generated.includes('Ref: referral_claims.referral_id > referrals.id'), true);
const reparsed = await parseDbml(generated);
check('the whole thing parses', reparsed.ok, true);
if (!reparsed.ok) console.log(`      ${reparsed.error.message} (line ${reparsed.error.line})`);
check('  ...with every table', reparsed.schema.tables.length, entities.length);

// A ref pointing outside the selection still gets dropped, custom or not.
const orphan = entitiesFor(['referrals'], [hydrated]);
check('an internal ref survives on its own', orphan.find((e) => e.name === 'referral_claims').fields[1].ref, 'referrals.id');
check('  ...and generates', (await parseDbml(generateDbml(orphan))).ok, true);

// ---------------------------------------------------------- folders
const tree = generateFolders({
  stack: [{ layer: 'backend', choice: 'express' }],
  layering: 'modular',
  moduleKeys: keys,
  customModules: [hydrated],
});
check('a custom module gets a folder with your name on it', tree.some((n) => n.path === 'src/modules/referrals'), true);
check('  ...and its files', tree.some((n) => n.path === 'src/modules/referrals/referrals.service.js'), true);

// ---------------------------------------------------------- removal
const removal = removeModule(keys, 'auth', [hydrated]);
check('removing a dependency takes the custom module with it', removal.keys.includes('referrals'), false);
check('  ...and says why', removal.dropped.map((d) => d.key), ['referrals']);

// -------------------------------------------------- collision detection
const clashing = await hydrateCustomModule({
  key: 'my-users',
  name: 'My users',
  dbml: 'Table users {\n  id integer [pk]\n  handle varchar\n}',
});
const owners = tableOwners(['auth', 'my-users'], [clashing]);
check('a clashing table names both owners', owners.get('users'), ['auth', 'my-users']);
check('  ...while an uncontested one names one', owners.get('roles'), ['auth']);
check('no clash when nothing overlaps', tableOwners(['auth', 'referrals'], [hydrated]).get('referrals'), ['referrals']);
// entitiesFor keeps the first silently, which is exactly why the editor warns.
check('the silent winner is the first module listed', entitiesFor(['auth', 'my-users'], [clashing]).find((e) => e.name === 'users').moduleKey, 'auth');

// ---------------------------------------------------------- validation
check('a blank module starts empty', blankModule().dbml, '');
check('a blank module takes a key', blankModule('referrals').key, 'referrals');
check('slugifies a name', slugifyKey('Razorpay Payments!'), 'razorpay-payments');
check('  ...collapsing runs', slugifyKey('a   b'), 'a-b');
check('  ...and trimming edges', slugifyKey('--Referrals--'), 'referrals');
check('the slug always passes the key rule', KEY_PATTERN.test(slugifyKey('My Module 2!')), true);

check('valid module has no problems', validateModule(referrals), []);
check('a missing name is a problem', validateModule({ ...referrals, name: '' })[0].includes('name'), true);
check('a missing key is a problem', validateModule({ ...referrals, key: '' })[0].includes('key'), true);
check('a bad key is a problem', validateModule({ ...referrals, key: 'My Module' })[0].includes('hyphens'), true);
check('a taken key is a problem', validateModule(referrals, { existingKeys: ['referrals'] })[0].includes('already uses'), true);
check('a path with no slash is a problem', validateModule({ ...referrals, apis: [{ method: 'GET', path: 'x' }] })[0].includes('slash'), true);

// Shadowing is allowed, but it must be said out loud.
check('shadowing a built-in warns', shadowWarning({ key: 'auth' }, MODULE_KEYS).includes('replaces the built-in'), true);
check('  ...and is not an error', validateModule({ ...referrals, key: 'auth' }), []);
check('a fresh key does not warn', shadowWarning({ key: 'referrals' }, MODULE_KEYS), null);

// --------------------------------------- nothing changes without customs
check('resolveDependencies is unchanged with no customs', resolveDependencies(['checkout']).keys, ['auth', 'catalog', 'cart', 'orders', 'checkout']);
check('apisFor is unchanged with no customs', apisFor(['auth']).length, 4);
check('entitiesFor is unchanged with no customs', entitiesFor(['auth']).length, 3);
check('an unknown key is still ignored', entitiesFor(['nope'], [hydrated]), []);
check('hydrating nothing gives nothing', await hydrateCustomModules([]), []);

console.log(failures === 0 ? '\nAll custom module checks passed.' : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
